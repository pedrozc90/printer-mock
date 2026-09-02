import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ESC, toChar } from "../../utils/index.ts";
import { createInitialState } from "./state.ts";
import { extractEpcParam, extractPrintBlocks, ingestSbplFrame, parsePrintBlock } from "./sbpl.ts";

const lines = (...parts: string[]): string => parts.join("\n");

const headerBlock = lines(`${toChar(ESC)}A`, `${toChar(ESC)}PM0`, `${toChar(ESC)}Z`);
const tagBlock = (epc: string): string => lines(`${toChar(ESC)}A`, `${toChar(ESC)}IP0e:h,epc:${epc},fsw:0;`, `${toChar(ESC)}Z`);
const emptyBlock = lines(`${toChar(ESC)}A`, `${toChar(ESC)}IG1`, `${toChar(ESC)}Z`); // neither PM nor IP0

describe("extractPrintBlocks", () => {
    it("finds each ESC+A ... ESC+Z span in a multi-block frame, ignoring surrounding text", () => {
        const text = `${toChar(0x12)}PI,SB\n${headerBlock}\n${tagBlock("3be10000202fc068000000a2")}`;
        const blocks = extractPrintBlocks(text);
        assert.equal(blocks.length, 2);
        assert.equal(blocks[0], headerBlock);
        assert.equal(blocks[1], tagBlock("3be10000202fc068000000a2"));
    });
});

describe("extractEpcParam", () => {
    it("extracts the epc: value up to the trailing comma or semicolon", () => {
        assert.equal(extractEpcParam(`${toChar(ESC)}IP0e:h,epc:3be10000202fc068000000a2,fsw:0;`), "3be10000202fc068000000a2");
    });

    it("returns undefined when there is no epc: parameter", () => {
        assert.equal(extractEpcParam(`${toChar(ESC)}IP0e:h,usr:1234,fsw:0;`), undefined);
    });
});

describe("parsePrintBlock", () => {
    it("detects the ESC+PM marker and no tags in a header block", () => {
        const result = parsePrintBlock(headerBlock);
        assert.equal(result.hasPrintModeMarker, true);
        assert.deepEqual(result.tags, []);
    });

    it("extracts an EPC (uppercased) with a generated TID from a tag block", () => {
        const result = parsePrintBlock(tagBlock("3be10000202fc068000000a2"));
        assert.equal(result.hasPrintModeMarker, false);
        assert.equal(result.tags.length, 1);
        assert.equal(result.tags[0]?.epc, "3BE10000202FC068000000A2");
        assert.match(result.tags[0]?.tid ?? "", /^[A-F0-9]{24}$/);
    });

    it("skips an ESC+IP0 line with no epc: parameter", () => {
        const block = lines(`${toChar(ESC)}A`, `${toChar(ESC)}IP0e:h,usr:1234,fsw:0;`, `${toChar(ESC)}Z`);
        const result = parsePrintBlock(block);
        assert.deepEqual(result.tags, []);
    });

    it("reports neither marker for a block with no PM and no usable IP0", () => {
        const result = parsePrintBlock(emptyBlock);
        assert.equal(result.hasPrintModeMarker, false);
        assert.deepEqual(result.tags, []);
    });
});

describe("ingestSbplFrame", () => {
    it("skips a block with neither marker, leaving state unchanged", () => {
        const state = createInitialState();
        const next = ingestSbplFrame(state, emptyBlock, Date.now());
        assert.deepEqual(next, state);
    });

    it("processes a header block and a tag block across one frame: unpauses and enqueues", () => {
        const now = Date.now();
        const state = { ...createInitialState(), paused: true };

        const frameText = `${headerBlock}\n${tagBlock("3be10000202fc068000000a2")}`;
        const next = ingestSbplFrame(state, frameText, now);

        assert.equal(next.paused, false);
        assert.equal(next.queue.length, 1);
        assert.equal(next.queue[0]?.epc, "3BE10000202FC068000000A2");
    });
});
