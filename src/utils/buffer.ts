import { REPLACEMENT, sanitize } from "./ascii";

export const parse: (data: Buffer) => string[] = (data: Buffer) => {
    const result: string[] = [];
    let prev = 0;
    for (const [ index, value ] of data.entries()) {
        if (value === 2) {
            prev = index;
        }
        if (value === 3) {
            let s: string = data.toString("utf8", prev, index + 1);
            if (data[prev] !== 2) {
                s = "\x02" + s;
            }
            const t = sanitize(s);
            if (t !== '\x02\x03') {
                result.push(t);
            }
            prev = index + 1;
        }
    }
    return result;
};

export const print: (data: Buffer) => void = (data: Buffer) => {
    const array: { code: number, character: string }[] = [];
    for (let v of data.values()) {
        array.push({ code: v, character: String.fromCharCode(v) });
    }
    console.table(array);
}
