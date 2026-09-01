import { ETX, STX, sanitize } from "./ascii.ts";

export const parse: (data: Buffer) => string[] = (data: Buffer) => {
    const result: string[] = [];
    let prev = 0;
    for (const [index, value] of data.entries()) {
        if (value === STX) {
            prev = index;
        }
        if (value === ETX) {
            let s: string = data.toString("utf8", prev, index + 1);
            if (data[prev] !== STX) {
                s = "\x02" + s;
            }
            const t = sanitize(s);
            if (t !== "\x02\x03") {
                result.push(t);
            }
            prev = index + 1;
        }
    }
    return result;
};

/**
 * Split a stream chunk into complete STX..ETX frames plus any trailing bytes
 * that have not been terminated yet. The caller is expected to prepend `rest`
 * to the next chunk so a frame split across TCP packets is not lost.
 */
export const splitFrames: (data: Buffer) => { frames: string[]; rest: Buffer } = (data: Buffer) => {
    const lastEtx = data.lastIndexOf(ETX);
    if (lastEtx === -1) {
        return { frames: [], rest: data };
    }
    return {
        frames: parse(data.subarray(0, lastEtx + 1)),
        rest: Buffer.from(data.subarray(lastEtx + 1)),
    };
};

export const print: (data: Buffer) => void = (data: Buffer) => {
    const array: { code: number; character: string }[] = [];
    for (const v of data.values()) {
        array.push({ code: v, character: String.fromCharCode(v) });
    }
    console.table(array);
};
