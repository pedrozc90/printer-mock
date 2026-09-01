import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parse, print, splitFrames } from "./index.ts";

// \x02\x12PH\x03
const PH_FRAME: number[] = [2, 18, 80, 72, 3];

describe("splitFrames", () => {
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
