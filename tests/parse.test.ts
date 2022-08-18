import { BufferUtils } from "../src/utils";

test("pkpg cmd", () => {
    const data: Buffer = Buffer.from([ 172, 237, 0, 5, 116, 0, 3, 18, 80, 71, 172, 237, 0, 5, 116, 0, 3, 18, 80, 75, 172, 237, 0, 5, 116, 0, 1, 3 ]);
    
    BufferUtils.print(data);
    
    const results: string[] = BufferUtils.parse(data);

    console.log("RESULTS:", results);

    // expect(result).toEqual([ "\x02\x12PH\x03" ]);
});

test("ph cmd", () => {
    const data: Buffer = Buffer.from([ 172, 237, 0, 5, 116, 0, 3, 18, 80, 72, 172, 237, 0, 5, 116, 0, 1, 3 ]);
    
    BufferUtils.print(data);

    const results: string[] = BufferUtils.parse(data);

    console.log(results);
});

test("ph cmd - inline", () => {
    const data: Buffer = Buffer.from([ 116, 0, 5, 2, 18, 80, 72, 3 ]);
    const results: string[] = BufferUtils.parse(data);
    expect(results).toEqual([ "\x02\x12PH\x03" ]);
});

test("epc", () => {
    const epc: string = "3be10000202fc0680000006f";
    const header: number = Number(`0x${epc.substring(0, 3)}`);
    const authority: number = Number(`0x${epc.substring(3, 4)}`);
    const product_id: number = Number(`0x${epc.substring(4, 16)}`);
    const serial_number: number = Number(`0x${epc.substring(16)}`);
    console.log(epc, header, authority, product_id, serial_number);
});
