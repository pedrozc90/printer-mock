import { ETX, STX } from "./constants.ts";

const STREAM_MAGIC = 0xaced;
const TC_STRING = 0x74;
const TC_LONGSTRING = 0x7c;

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
 * (class descriptors, TC_OBJECT, field data, etc). When it meets an
 * unknown marker, or a record truncated by a TCP packet boundary, it
 * stops and forwards the remaining bytes verbatim rather than dropping
 * them — the caller prepends that tail to the next chunk (via its
 * leftover buffer), so a record split across packets is not lost.
 */
export const sanitize = (value: Buffer): Buffer => {
    let offset = 0;
    const chunks: Buffer[] = [];

    // Skip the stream header if present (AC ED 00 05)
    if (value.length >= 4 && value.readUInt16BE(0) === STREAM_MAGIC) {
        offset = 4;
    }

    while (offset < value.length) {
        const tag = value[offset];
        if (tag === TC_STRING) {
            if (offset + 3 > value.length) {
                chunks.push(value.subarray(offset)); // truncated header — forward the tail
                break;
            }
            const len = value.readUInt16BE(offset + 1);
            const start = offset + 3;
            if (start + len > value.length) {
                chunks.push(value.subarray(offset)); // truncated payload — forward the tail
                break;
            }
            chunks.push(value.subarray(start, start + len));
            offset = start + len;
        } else if (tag === TC_LONGSTRING) {
            if (offset + 9 > value.length) {
                chunks.push(value.subarray(offset)); // truncated header — forward the tail
                break;
            }
            const len = Number(value.readBigUInt64BE(offset + 1));
            const start = offset + 9;
            if (start + len > value.length) {
                chunks.push(value.subarray(offset)); // truncated payload — forward the tail
                break;
            }
            chunks.push(value.subarray(start, start + len));
            offset = start + len;
        } else {
            // Unknown/unsupported marker (e.g. a real object graph) — forward the
            // rest verbatim and let the STX/ETX frame splitter deal with it.
            chunks.push(value.subarray(offset));
            break;
        }
    }

    return Buffer.concat(chunks);
};

/**
 * Split a stream chunk into complete STX..ETX frames plus any trailing bytes
 * that have not been terminated yet. Bytes outside a frame are ignored; an empty
 * frame (STX immediately followed by ETX) is skipped. Frames are returned as raw
 * Buffers — the caller decodes them. The caller is expected to prepend `rest` to
 * the next chunk so a frame split across TCP packets is not lost.
 */
export const splitFrames = (data: Buffer): { frames: Buffer[]; rest: Buffer } => {
    const frames: Buffer[] = [];
    let cursor = 0;

    for (;;) {
        const stx = data.indexOf(STX, cursor);
        if (stx === -1) break;
        const etx = data.indexOf(ETX, stx + 1);
        if (etx === -1) break;

        if (etx > stx + 1) {
            // etx === stx + 1 -> bare STX+ETX, an empty frame; skip it
            frames.push(Buffer.from(data.subarray(stx, etx + 1)));
        }
        cursor = etx + 1;
    }

    return { frames, rest: Buffer.from(data.subarray(cursor)) };
};

/** Build-side inverse of `splitFrames`: wraps a payload string in a single STX..ETX frame. */
export const buildFrame = (payload: string): string => {
    return `\u0002${payload}\u0003`;
};

export const print: (data: Buffer) => void = (data: Buffer) => {
    const array: { code: number; character: string }[] = [];
    for (const v of data.values()) {
        array.push({ code: v, character: String.fromCharCode(v) });
    }
    console.table(array);
};
