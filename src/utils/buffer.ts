import { ETX, normalize, STX } from "./ascii.ts";

/**
 * Strips the ObjectOutputStream framing that `PrinterConnection.send()`
 * accidentally puts around outgoing strings, recovering the original
 * payload bytes.
 *
 * Handles ONLY the "bare string" fast path that
 * `ObjectOutputStream#writeObject(String)` takes:
 *   [AC ED 00 05]?           optional stream header (magic + version)
 *   74 <u16 len> <bytes>     TC_STRING  (string <= 65535 bytes)
 *   7C <u64 len> <bytes>     TC_LONGSTRING (string > 65535 bytes)
 *
 * It does NOT implement the general Java serialization protocol
 * (class descriptors, TC_OBJECT, field data, etc). Anything else
 * causes it to stop parsing and return whatever it recovered so far.
 */
export const sanitize = (value: Buffer): Buffer => {
    const STREAM_MAGIC = 0xaced;
    const TC_STRING = 0x74;
    const TC_LONGSTRING = 0x7c;

    let offset = 0;
    const chunks: Buffer[] = [];

    // Skip the stream header if present (AC ED 00 05)
    if (value.length >= 4 && value.readUInt16BE(0) === STREAM_MAGIC) {
        offset = 4;
    }

    while (offset < value.length) {
        const tag = value[offset];
        if (tag === TC_STRING) {
            if (offset + 3 > value.length) break; // truncated header
            const len = value.readUInt16BE(offset + 1);
            const start = offset + 3;
            if (start + len > value.length) break; // truncated payload
            chunks.push(value.subarray(start, start + len));
            offset = start + len;
        } else if (tag === TC_LONGSTRING) {
            if (offset + 9 > value.length) break; // truncated header
            const len = Number(value.readBigUInt64BE(offset + 1));
            const start = offset + 9;
            if (start + len > value.length) break; // truncated payload
            chunks.push(value.subarray(start, start + len));
            offset = start + len;
        } else {
            // Unknown/unsupported marker (e.g. a real object graph) — bail out.
            break;
        }
    }

    return Buffer.concat(chunks);
};

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
            const t = normalize(s);
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
