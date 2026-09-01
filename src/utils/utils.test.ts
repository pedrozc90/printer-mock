import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateTID, resolvePort } from "./index.ts";

describe("resolvePort", () => {
    it("falls back to the default when unset", () => {
        assert.equal(resolvePort(undefined), 3000);
        assert.equal(resolvePort(undefined, 9100), 9100);
    });

    it("parses a valid port", () => {
        assert.equal(resolvePort("3000"), 3000);
        assert.equal(resolvePort("0"), 0);
        assert.equal(resolvePort("65535"), 65535);
    });

    it("throws on a non-numeric value", () => {
        assert.throws(() => resolvePort("abc"), /Invalid PORT value: abc/);
    });

    it("throws on an out-of-range value", () => {
        assert.throws(() => resolvePort("70000"), /Invalid PORT value/);
        assert.throws(() => resolvePort("-1"), /Invalid PORT value/);
    });
});

describe("TID generation", () => {
    it("Test", () => {
        const tid24 = generateTID();
        assert.equal(tid24.length, 24);
        assert.match(tid24, /[A-Z0-9]{24}/);

        const tid8 = generateTID(8);
        assert.equal(tid8.length, 16);
        assert.match(tid8, /[A-Z0-9]{16}/);
    });
});
