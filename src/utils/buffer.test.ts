import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parse, print, sanitize, splitFrames } from "./buffer.ts";

describe("splitFrames", () => {
    // \x02\x12PH\x03
    const PH_FRAME: number[] = [2, 18, 80, 72, 3];

    it("returns a complete frame with no leftover", () => {
        const { frames, rest } = splitFrames(Buffer.from(PH_FRAME));

        assert.deepEqual(frames, ["\x02\x12PH\x03"]);
        assert.equal(rest.length, 0);
    });

    it("carries a partial frame to the next chunk", () => {
        const first = splitFrames(Buffer.from(PH_FRAME.slice(0, 3)));
        assert.deepEqual(first.frames, []);
        assert.deepEqual(first.rest, Buffer.from(PH_FRAME.slice(0, 3)));

        const second = splitFrames(Buffer.concat([first.rest, Buffer.from(PH_FRAME.slice(3))]));
        assert.deepEqual(second.frames, ["\x02\x12PH\x03"]);
        assert.equal(second.rest.length, 0);
    });

    it("keeps trailing bytes after the last complete frame", () => {
        const { frames, rest } = splitFrames(Buffer.from([...PH_FRAME, ...PH_FRAME.slice(0, 3)]));

        assert.deepEqual(frames, ["\x02\x12PH\x03"]);
        assert.deepEqual(rest, Buffer.from(PH_FRAME.slice(0, 3)));
    });
});

describe("parse", () => {
    it("pkpg cmd", () => {
        const data: Buffer = Buffer.from([
            172, 237, 0, 5, 116, 0, 3, 18, 80, 71, 172, 237, 0, 5, 116, 0, 3, 18, 80, 75, 172, 237, 0, 5, 116, 0, 1, 3,
        ]);

        print(data);

        const results: string[] = parse(data);

        assert.deepEqual(results, ["\x02\x12PG\x03", "\x02\x12PK\x03"]);
    });

    it("ph cmd", () => {
        const data: Buffer = Buffer.from([172, 237, 0, 5, 116, 0, 3, 18, 80, 72, 172, 237, 0, 5, 116, 0, 1, 3]);

        print(data);

        const results: string[] = parse(data);

        assert.deepEqual(results, ["\x02\x12PH\x03"]);
    });

    it("ph cmd - inline", () => {
        const data: Buffer = Buffer.from([116, 0, 5, 2, 18, 80, 72, 3]);
        const results: string[] = parse(data);
        assert.deepEqual(results, ["\x02\x12PH\x03"]);
    });
});

describe("sanitize", () => {
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

    /* --- Cases where sanitize() does NOT do what you might expect --- */
    describe("sanitize — known limitations / failure cases", () => {
        it("only recovers the FIRST message when several send() calls are concatenated", () => {
            // This mirrors PrinterConnection.send() being called twice in a row:
            // each call creates a brand-new ObjectOutputStream, so a SECOND
            // stream header gets written mid-stream. That header byte sequence
            // is not a valid TC_* tag, so parsing stops there.
            const raw = Buffer.concat([javaSend("FIRST"), javaSend("SECOND")]);

            const result = sanitize(raw);

            // What you'd probably want:
            // assert.equal(result.toString("utf8"), "FIRSTSECOND");
            //
            // What actually happens: parsing stops at the second AC ED header
            // because 0xAC is not TC_STRING (0x74) or TC_LONGSTRING (0x7C).
            assert.equal(result.toString("utf8"), "FIRST");
            assert.notEqual(result.toString("utf8"), "FIRSTSECOND");
        });

        it("returns an empty buffer for a real serialized object (not a bare String)", () => {
            // A genuine object graph starts with TC_OBJECT (0x73) plus class
            // descriptor bytes, not TC_STRING. sanitize() has no idea how to
            // walk that structure, so it bails out immediately with nothing.
            const fakeObjectPayload = Buffer.concat([
                STREAM_HEADER,
                Buffer.from([0x73, 0x00, 0x00]), // TC_OBJECT + junk, not a real object
            ]);

            const result = sanitize(fakeObjectPayload);

            assert.equal(result.length, 0);
        });

        it("silently drops trailing bytes if the declared string length is truncated", () => {
            // Corrupt/partial capture: header says length 10 but only 3 bytes follow.
            const header = Buffer.alloc(3);
            header[0] = 0x74; // TC_STRING
            header.writeUInt16BE(10, 1); // claims 10 bytes...
            const raw = Buffer.concat([STREAM_HEADER, header, Buffer.from("abc")]); // ...only 3 given

            const result = sanitize(raw);

            // It does NOT throw and does NOT return the partial "abc" — the
            // bounds check rejects the whole (truncated) block and returns
            // whatever was collected before it, i.e. nothing here.
            assert.equal(result.length, 0);
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
