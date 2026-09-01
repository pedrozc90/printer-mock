// REFERENCES:
// https://honeywellaidc.force.com/supportppr/s/article/What-do-Control-Characters-SOH-STX-etc-mean-when-scanning
// https://sps-support.honeywell.com/s/article/What-do-Control-Characters-SOH-STX-etc-mean-when-scanning

export const EMPTY  = String.fromCharCode(); // empty (length = 0)
export const NUL    = 0x00; //  0 = null
export const SOH    = 0x01; //  1 = start of heading
export const STX    = 0x02; //  2 = start of text
export const ETX    = 0x03; //  3 = end of text
export const EOT    = 0x04; //  4 = end of transmission
export const ENQ    = 0x05; //  5 = enquirying
export const ACK    = 0x06; //  6 = acknowledge
export const BEL    = 0x07; //  7 = bell
export const BS     = 0x08; //  8 = backspace
export const TAB    = 0x09; //  9 = horizontal tab
export const LF     = 0x0A; // 10 = NL line feed, new line
export const VT     = 0x0B; // 11 = vertical tab
export const FF     = 0x0C; // 12 = NP from feed, new page
export const CR     = 0x0D; // 13 = carriage return
export const SO     = 0x0E; // 14 = shift out
export const SI     = 0x0F; // 15 = shift in
export const DLE    = 0x10; // 16 = data link escape
export const DC1    = 0x11; // 17 = device control 1
export const DC2    = 0x12; // 18 = device control 2
export const DC3    = 0x13; // 19 = device control 3
export const DC4    = 0x14; // 20 = device control 4
export const NAK    = 0x15; // 21 = negative acknowledge
export const SYN    = 0x16; // 22 = synchronous idle
export const ETB    = 0x17; // 23 = enf of trans. block
export const CAN    = 0x18; // 24 = cancel
export const EM     = 0x19; // 25 = end of medium
export const SUB    = 0x1A; // 26 = substitute
export const ESC    = 0x1B; // 27 = escape
export const FS     = 0x1C; // 28 = file separator
export const GS     = 0x1D; // 29 = group separator
export const RS     = 0x1E; // 30 = record separator
export const US     = 0x1F; // 31 = unit separator
export const DELETE = 0x7F; // 127 = DEL
export const SPACE  = 32; // " " - space
export const REPLACEMENT = 65533; // "�" - replacement character

export const JUNK = Buffer.from([0, 5, 116, 0]).toString("utf8");

export const normalize = (s: string): string => {
    // const useless: string[] = [ String.fromCharCode(REPLACEMENT) ];
    // return data.toString("utf8").split(EMPTY)
    //     .filter((v) => !useless.includes(v))
    //     .join(EMPTY);
    const t = s.replaceAll(String.fromCharCode(REPLACEMENT), "").replaceAll(JUNK, "").replaceAll(String.fromCharCode(SOH), "");

    // .replaceAll(String.fromCharCode(NUL), "")
    // const bs = Buffer.from(s);
    // const bt = Buffer.from(t);

    return t;
};

export const cleanTextContent = (text: string): string => {
    return text
        .replace("[^\\x00-\\x7F]", "") // strips off all non-ASCII characters
        .replace("[\\p{Cntrl}&&[^\r\n\t]]", "") // erases all the ASCII control characters
        .replace("\\p{C}", "") // removes non-printable characters from Unicode
        .trim();
};
