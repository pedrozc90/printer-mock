import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitize, splitFrames } from "./buffer.ts";

/** Decodes each frame Buffer the way handleData does, for readable assertions. */
const decode = (frames: Buffer[]): string[] => frames.map((f) => f.toString("utf8"));

// ---- helpers to build Java ObjectOutputStream-shaped buffers ----------

const STREAM_HEADER = Buffer.from([0xac, 0xed, 0x00, 0x05]);

/** Encodes a string the way ObjectOutputStream#writeObject(String) does
 *  for short strings: TC_STRING (0x74) + u16 length + raw bytes. */
const tcString = (str: string): Buffer => {
    const body = Buffer.from(str, "utf8");
    const header = Buffer.alloc(3);
    header[0] = 0x74; // TC_STRING
    header.writeUInt16BE(body.length, 1);
    return Buffer.concat([header, body]);
};

/** Builds a full "one send() call" payload: header + TC_STRING block. */
const javaSend = (str: string): Buffer => {
    return Buffer.concat([STREAM_HEADER, tcString(str)]);
};

describe("splitFrames", () => {
    // \x02\x12PH\x03
    const PH_FRAME: number[] = [2, 18, 80, 72, 3];

    it("returns a complete frame with no leftover", () => {
        const { frames, rest } = splitFrames(Buffer.from(PH_FRAME));

        assert.deepEqual(decode(frames), ["\x02\x12PH\x03"]);
        assert.equal(rest.length, 0);
    });

    it("carries a partial frame to the next chunk", () => {
        const first = splitFrames(Buffer.from(PH_FRAME.slice(0, 3)));
        assert.deepEqual(first.frames, []);
        assert.deepEqual(first.rest, Buffer.from(PH_FRAME.slice(0, 3)));

        const second = splitFrames(Buffer.concat([first.rest, Buffer.from(PH_FRAME.slice(3))]));
        assert.deepEqual(decode(second.frames), ["\x02\x12PH\x03"]);
        assert.equal(second.rest.length, 0);
    });

    it("keeps trailing bytes after the last complete frame", () => {
        const { frames, rest } = splitFrames(Buffer.from([...PH_FRAME, ...PH_FRAME.slice(0, 3)]));

        assert.deepEqual(decode(frames), ["\x02\x12PH\x03"]);
        assert.deepEqual(rest, Buffer.from(PH_FRAME.slice(0, 3)));
    });

    it("skips an empty frame (bare STX+ETX)", () => {
        const { frames, rest } = splitFrames(Buffer.from([2, 3]));

        assert.deepEqual(frames, []);
        assert.equal(rest.length, 0);
    });

    it("skips an empty frame preceding a real one", () => {
        const { frames, rest } = splitFrames(Buffer.from([2, 3, ...PH_FRAME]));

        assert.deepEqual(decode(frames), ["\x02\x12PH\x03"]);
        assert.equal(rest.length, 0);
    });
});

describe("sanitize", () => {
    /* --- Usage --- */
    describe("sanitize — basic usage", () => {
        it("recovers the original string from a single send() payload", () => {
            const raw = javaSend("^XA^FO50,50^A0N,30,30^FDHello^FS^XZ");

            const result = sanitize(raw);

            assert.equal(result.toString("utf8"), "^XA^FO50,50^A0N,30,30^FDHello^FS^XZ");
        });

        it("also works when the stream header was already stripped off", () => {
            // e.g. if you only captured the TC_STRING block itself
            const raw = tcString("STATUS?");

            const result = sanitize(raw);

            assert.equal(result.toString("utf8"), "STATUS?");
        });
    });

    /* --- Partial / unrecognized input is forwarded verbatim, not dropped --- */
    describe("sanitize — partial / unrecognized input is forwarded, not dropped", () => {
        it("unwraps the first message and forwards the rest of the stream verbatim", () => {
            // Mirrors PrinterConnection.send() being called twice in a row: each call creates a
            // brand-new ObjectOutputStream, so a SECOND stream header lands mid-stream. 0xAC is
            // not a TC_* tag, so sanitize() stops structural parsing there — but now forwards the
            // remaining bytes so a downstream STX/ETX split can still recover a frame from them.
            const raw = Buffer.concat([javaSend("FIRST"), javaSend("SECOND")]);

            const result = sanitize(raw);

            assert.equal(result.subarray(0, 5).toString("utf8"), "FIRST");
            assert.deepEqual(result.subarray(5), Buffer.concat([STREAM_HEADER, tcString("SECOND")]));
        });

        it("forwards an unrecognized marker (e.g. a real object graph) untouched", () => {
            // A genuine object graph starts with TC_OBJECT (0x73) + class descriptor bytes, not
            // TC_STRING. sanitize() can't walk that; it forwards the bytes and lets splitFrames()
            // ignore them (they contain no STX/ETX frame).
            const raw = Buffer.concat([
                STREAM_HEADER,
                Buffer.from([0x73, 0x00, 0x00]), // TC_OBJECT + junk, not a real object
            ]);

            assert.deepEqual(sanitize(raw), Buffer.from([0x73, 0x00, 0x00]));
        });

        it("keeps a truncated record so the next chunk can complete it", () => {
            // Header says length 10 but only 3 bytes follow (record cut by a packet boundary).
            const header = Buffer.alloc(3);
            header[0] = 0x74; // TC_STRING
            header.writeUInt16BE(10, 1); // claims 10 bytes...
            const raw = Buffer.concat([STREAM_HEADER, header, Buffer.from("abc")]); // ...only 3 given

            // The truncated record (tag + declared length + partial payload) is forwarded whole,
            // for the caller's leftover buffer to complete with the next chunk.
            assert.deepEqual(sanitize(raw), Buffer.from([0x74, 0x00, 0x0a, 0x61, 0x62, 0x63]));
        });

        it("does not decode Java's 'modified UTF-8', so embedded NUL bytes round-trip incorrectly", () => {
            // Java's modified UTF-8 encodes U+0000 as the two bytes C0 80,
            // instead of a single 0x00 byte like standard UTF-8. sanitize()
            // just slices raw bytes — it doesn't know about this special case.
            const modifiedUtf8Null = Buffer.from([0x74, 0x00, 0x03, 0x41, 0xc0, 0x80]); // "A" + modified-UTF-8 NUL
            // TC_STRING, len=3, bytes: 0x41 'A', 0xC0 0x80 (Java's encoding of U+0000)

            const result = sanitize(modifiedUtf8Null);

            // A correct decoder would produce "A\u0000" (2 chars). Treating the
            // bytes as standard UTF-8 instead produces "A" + U+0080, which is wrong.
            assert.notEqual(result.toString("utf8"), "A\u0000");
        });
    });
});

describe("sanitize + splitFrames (handleData decoding)", () => {
    it("recovers a Java-wrapped frame with no leftover", () => {
        const payload = javaSend("\x02\x12PG\x12PK\x03");
        const buffer = sanitize(payload);
        const { frames, rest } = splitFrames(buffer);

        assert.deepEqual(decode(frames), ["\x02\x12PG\x12PK\x03"]);
        assert.equal(rest.length, 0);
    });

    it("unwraps a bare TC_STRING record with no stream header", () => {
        const data = Buffer.from([116, 0, 5, 2, 18, 80, 72, 3]); // TC_STRING, len 5, \x02\x12PH\x03

        assert.deepEqual(decode(splitFrames(sanitize(data)).frames), ["\x02\x12PH\x03"]);
    });

    it("recovers a large Java-wrapped frame at a realistic SBPL body size", () => {
        // One STX...ETX frame around ~2KB of filler, wrapped exactly as PrinterConnection.send()
        // does: [AC ED 00 05] + TC_STRING(0x74) + u16 length + payload. The length's big-endian
        // bytes (2002 = 0x07D2) don't collide with STX(0x02)/ETX(0x03), isolating "stays correct
        // at a realistic large size" from length-prefix collision concerns.
        const bodySize = 2000;
        const innerFrame = `\x02${"A".repeat(bodySize)}\x03`;
        const payload = Buffer.from(innerFrame, "utf8");
        assert.equal(payload.length, bodySize + 2);

        const header = Buffer.alloc(3);
        header[0] = 0x74; // TC_STRING
        header.writeUInt16BE(payload.length, 1);

        const raw = Buffer.concat([Buffer.from([0xac, 0xed, 0x00, 0x05]), header, payload]);

        assert.deepEqual(decode(splitFrames(sanitize(raw)).frames), [innerFrame]);
    });

    it("reassembles a Java record split mid-payload across two chunks", () => {
        // length 3002 = 0x0BBA — no length byte collides with STX/ETX/TC_STRING/TC_LONGSTRING.
        const body = `\x02${"A".repeat(3000)}\x03`;
        const wire = javaSend(body);
        const cut = 12; // inside the TC_STRING payload

        // mirrors handleData: sanitize each chunk, prepend the previous rest, never re-sanitize it
        const first = splitFrames(sanitize(wire.subarray(0, cut)));
        assert.deepEqual(first.frames, []);

        const combined = Buffer.concat([first.rest, sanitize(wire.subarray(cut))]);
        const second = splitFrames(combined);

        assert.deepEqual(decode(second.frames), [body]);
        assert.equal(second.rest.length, 0);
    });

    it("passes a raw STX...ETX frame through untouched (sanitize is a no-op)", () => {
        const raw = Buffer.from("\x02\x12PH\x03", "latin1");

        assert.deepEqual(sanitize(raw), raw);
        assert.deepEqual(decode(splitFrames(sanitize(raw)).frames), ["\x02\x12PH\x03"]);
    });
});
