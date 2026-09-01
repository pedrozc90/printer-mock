import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BufferUtils } from "../src/utils/index.ts";

describe("Parse", () => {
    it("pkpg cmd", () => {
        const data: Buffer = Buffer.from([
            172, 237, 0, 5, 116, 0, 3, 18, 80, 71, 172, 237, 0, 5, 116, 0, 3, 18, 80, 75, 172, 237, 0, 5, 116, 0, 1, 3,
        ]);

        BufferUtils.print(data);

        const results: string[] = BufferUtils.parse(data);

        console.log("RESULTS:", results);

        // expect(result).toEqual([ "\x02\x12PH\x03" ]);
    });

    it("ph cmd", () => {
        const data: Buffer = Buffer.from([172, 237, 0, 5, 116, 0, 3, 18, 80, 72, 172, 237, 0, 5, 116, 0, 1, 3]);

        BufferUtils.print(data);

        const results: string[] = BufferUtils.parse(data);

        console.log(results);
    });

    it("ph cmd - inline", () => {
        const data: Buffer = Buffer.from([116, 0, 5, 2, 18, 80, 72, 3]);
        const results: string[] = BufferUtils.parse(data);
        assert.equal(results, ["\x02\x12PH\x03"]);
    });

    it("epc", () => {
        const epc: string = "3be10000202fc0680000006f";
        const header: number = Number(`0x${epc.substring(0, 3)}`);
        const authority: number = Number(`0x${epc.substring(3, 4)}`);
        const product_id: number = Number(`0x${epc.substring(4, 16)}`);
        const serial_number: number = Number(`0x${epc.substring(16)}`);
        console.log(epc, header, authority, product_id, serial_number);
    });
});
