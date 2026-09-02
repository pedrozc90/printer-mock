import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildFrame } from "../../utils/index.ts";
import { PG_CMD, PGPK_CMD, PH_CMD, PAUSE_CMD, PK_CMD, RESUME_CMD, tokenizeCommands } from "./commands.ts";

describe("tokenizeCommands", () => {
    it("recognizes a single PG command", () => {
        assert.deepEqual(tokenizeCommands(buildFrame(PG_CMD)), [{ type: "PG" }]);
    });

    it("recognizes a single PK command", () => {
        assert.deepEqual(tokenizeCommands(buildFrame(PK_CMD)), [{ type: "PK" }]);
    });

    it("recognizes a single PH command", () => {
        assert.deepEqual(tokenizeCommands(buildFrame(PH_CMD)), [{ type: "PH" }]);
    });

    it("recognizes a pause (DLE) command", () => {
        assert.deepEqual(tokenizeCommands(buildFrame(PAUSE_CMD)), [{ type: "PAUSE" }]);
    });

    it("recognizes a resume (DC1) command", () => {
        assert.deepEqual(tokenizeCommands(buildFrame(RESUME_CMD)), [{ type: "RESUME" }]);
    });

    it("recognizes a combined PG+PK frame as two tokens, in order", () => {
        assert.deepEqual(tokenizeCommands(buildFrame(PGPK_CMD)), [{ type: "PG" }, { type: "PK" }]);
    });

    it("returns an empty array for a non-command (SBPL) frame", () => {
        assert.deepEqual(tokenizeCommands(buildFrame("\u0012PI,SB\n\u001bZ")), []);
    });

    it("returns an empty array for a frame missing STX/ETX", () => {
        assert.deepEqual(tokenizeCommands(PG_CMD), []);
    });

    it("regression: detecting the same literal command frame twice in a row both succeed", () => {
        // Guards against the previous implementation's global-regex `.test()` lastIndex bug,
        // which silently alternated true/false on repeated identical input.
        const pg = buildFrame(PG_CMD);
        assert.deepEqual(tokenizeCommands(pg), [{ type: "PG" }]);
        assert.deepEqual(tokenizeCommands(pg), [{ type: "PG" }]);
        assert.deepEqual(tokenizeCommands(pg), [{ type: "PG" }]);
    });
});
