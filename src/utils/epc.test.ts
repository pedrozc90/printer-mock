import { describe, it } from "node:test";

describe("epc", () => {
    it("epc", () => {
        const epc: string = "3be10000202fc0680000006f";
        const header: number = Number(`0x${epc.substring(0, 3)}`);
        const authority: number = Number(`0x${epc.substring(3, 4)}`);
        const product_id: number = Number(`0x${epc.substring(4, 16)}`);
        const serial_number: number = Number(`0x${epc.substring(16)}`);
        console.log(epc, header, authority, product_id, serial_number);
    });
});
