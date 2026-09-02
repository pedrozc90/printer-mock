import { describe, it, type TestContext } from "node:test";
import assert from "node:assert/strict";
import net, { type AddressInfo, type Socket } from "net";

import { createApp } from "./app.ts";
import { Sato } from "./printers/index.ts";
import { ACK, buildFrame, ESC, ETX, NAK, STX, toChar } from "./utils/index.ts";

// Wraps a payload the way the Java client's ObjectOutputStream#writeObject(String) does:
// AC ED 00 05 (stream header) + 74 (TC_STRING) + u16 length + raw bytes.
const javaWrap = (payload: string): Buffer => {
    const body = Buffer.from(payload, "latin1");
    const header = Buffer.alloc(7);
    header.set([0xac, 0xed, 0x00, 0x05, 0x74], 0);
    header.writeUInt16BE(body.length, 5);
    return Buffer.concat([header, body]);
};

const PH_REQUEST = buildFrame(Sato.PH_CMD);
const PAUSE_REQUEST = buildFrame(Sato.PAUSE_CMD);
const RESUME_REQUEST = buildFrame(Sato.RESUME_CMD);
const PGPK_REQUEST = buildFrame(Sato.PGPK_CMD);

const lines = (...parts: string[]): string => parts.join("\n");
const HEADER_BLOCK = lines(`${toChar(ESC)}A`, `${toChar(ESC)}PM0`, `${toChar(ESC)}Z`);
const tagBlock = (epc: string): string => lines(`${toChar(ESC)}A`, `${toChar(ESC)}IP0e:h,epc:${epc},fsw:0;`, `${toChar(ESC)}Z`);

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Collector {
    readBytes: (n: number, timeoutMs?: number) => Promise<Buffer>;
    readFrame: (timeoutMs?: number) => Promise<string>;
}

const collectBytes = (socket: Socket): Collector => {
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);
    });

    const readBytes = (n: number, timeoutMs = 2000): Promise<Buffer> =>
        new Promise((resolve, reject) => {
            const start = Date.now();
            const check = (): void => {
                if (buffered.length >= n) {
                    const result = buffered.subarray(0, n);
                    buffered = buffered.subarray(n);
                    resolve(result);
                    return;
                }
                if (Date.now() - start > timeoutMs) {
                    reject(new Error(`timed out waiting for ${n} bytes, only got ${buffered.length}`));
                    return;
                }
                setTimeout(check, 5);
            };
            check();
        });

    const readFrame = (timeoutMs = 2000): Promise<string> =>
        new Promise((resolve, reject) => {
            const start = Date.now();
            const check = (): void => {
                const etxIndex = buffered.indexOf(ETX);
                if (etxIndex !== -1) {
                    const result = buffered.subarray(0, etxIndex + 1);
                    buffered = buffered.subarray(etxIndex + 1);
                    resolve(result.toString("latin1"));
                    return;
                }
                if (Date.now() - start > timeoutMs) {
                    reject(
                        new Error(`timed out waiting for a frame, buffered so far: ${JSON.stringify(buffered.toString("latin1"))}`),
                    );
                    return;
                }
                setTimeout(check, 5);
            };
            check();
        });

    return { readBytes, readFrame };
};

interface Harness {
    connect: () => Promise<Socket>;
    close: () => Promise<void>;
}

// Registers guaranteed cleanup via t.after() so a failed assertion never leaks a listening
// server/open socket that would keep the process alive past the test run.
const startServer = async (t: TestContext): Promise<Harness> => {
    const server = createApp();
    const sockets: Socket[] = [];

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    t.after(async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const connect = (): Promise<Socket> =>
        new Promise((resolve, reject) => {
            const socket = net.createConnection({ port }, () => resolve(socket));
            socket.on("error", reject);
            sockets.push(socket);
        });

    const close = (): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

    return { connect, close };
};

describe("app (integration, real socket)", () => {
    it("DLE replies with a bare ACK, no framing", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(PAUSE_REQUEST);
        const reply = await collector.readBytes(1);
        assert.deepEqual(reply, Buffer.from([ACK]));
    });

    it("unwraps a Java ObjectOutputStream-framed request", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(javaWrap(PH_REQUEST));
        const reply = await collector.readBytes(1);
        assert.deepEqual(reply, Buffer.from([ACK]));
    });

    it("reassembles a Java-wrapped request split across two socket writes", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        const wire = javaWrap(PH_REQUEST);
        socket.write(wire.subarray(0, 5)); // AC ED 00 05 74 — tag only, payload truncated
        await wait(20);
        socket.write(wire.subarray(5)); // u16 length + payload

        const reply = await collector.readBytes(1);
        assert.deepEqual(reply, Buffer.from([ACK]));
    });

    it("a second DLE while already paused replies with a bare NAK", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(PAUSE_REQUEST);
        await collector.readBytes(1); // ACK

        socket.write(PAUSE_REQUEST);
        const reply = await collector.readBytes(1);
        assert.deepEqual(reply, Buffer.from([NAK]));
    });

    it("DC1 while not paused replies with a bare NAK", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(RESUME_REQUEST);
        const reply = await collector.readBytes(1);
        assert.deepEqual(reply, Buffer.from([NAK]));
    });

    it("DC2+PH replies with a bare ACK and clears state (status reports STANDBY afterwards)", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(PH_REQUEST);
        const reply = await collector.readBytes(1);
        assert.deepEqual(reply, Buffer.from([ACK]));

        socket.write(PGPK_REQUEST);
        const pgReply = await collector.readFrame();
        assert.match(pgReply, /PS0,/);
        assert.match(pgReply, /Q000000/);
    });

    it("a combined PG+PK request produces two independent STX...ETX reply frames", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(PH_REQUEST);
        await collector.readBytes(1); // ACK for PH

        socket.write(buildFrame(HEADER_BLOCK));
        socket.write(buildFrame(tagBlock("3be10000202fc068000000a2")));
        await wait(50); // let both SBPL frames get processed (no reply is sent for them)

        socket.write(PGPK_REQUEST);

        const pgReply = await collector.readFrame();
        const pkReply = await collector.readFrame();

        assert.equal(pgReply[0], toChar(STX));
        assert.equal(pgReply[pgReply.length - 1], toChar(ETX));
        assert.match(pgReply, /Q000001/); // one tag queued, not yet finished

        assert.equal(pkReply[0], toChar(STX));
        assert.equal(pkReply[pkReply.length - 1], toChar(ETX));
        assert.match(pkReply, /EP:,ID:/); // nothing printed yet (cycle takes ~550ms)
    });

    it("Q decreases and EP/ID eventually populate once the tag finishes printing", async (t) => {
        const harness = await startServer(t);
        const socket = await harness.connect();
        const collector = collectBytes(socket);

        socket.write(PH_REQUEST);
        await collector.readBytes(1);

        socket.write(buildFrame(HEADER_BLOCK));
        socket.write(buildFrame(tagBlock("3be10000202fc068000000a2")));
        await wait(650); // past the full ~550ms per-tag cycle

        socket.write(PGPK_REQUEST);
        const pgReply = await collector.readFrame();
        const pkReply = await collector.readFrame();

        assert.match(pgReply, /PS0,/); // back to STANDBY
        assert.match(pgReply, /Q000000/); // drained
        assert.match(pkReply, /EP:3BE10000202FC068000000A2/); // uppercased on the way out
    });

    it("state persists across disconnect/reconnect", async (t) => {
        const harness = await startServer(t);

        const socket1 = await harness.connect();
        const collector1 = collectBytes(socket1);

        socket1.write(PH_REQUEST);
        await collector1.readBytes(1);

        socket1.write(buildFrame(HEADER_BLOCK));
        socket1.write(buildFrame(tagBlock("3be10000202fc068000000a2")));
        await wait(50);

        socket1.destroy();
        await wait(50); // let the server notice the disconnect

        const socket2 = await harness.connect();
        const collector2 = collectBytes(socket2);

        // the tag's cycle finishes on its own while nobody is connected
        await wait(650);

        socket2.write(PGPK_REQUEST);
        const pgReply = await collector2.readFrame();
        const pkReply = await collector2.readFrame();

        assert.match(pgReply, /Q000000/); // finished printing even though nobody was connected
        assert.match(pkReply, /EP:3BE10000202FC068000000A2/); // and the result survived the reconnect
    });
});
