// REFERENCES:
// https://honeywellaidc.force.com/supportppr/s/article/What-do-Control-Characters-SOH-STX-etc-mean-when-scanning

export const EMPTY = String.fromCharCode();                 // empty (length = 0)
export const NUL = 0;               // null
export const SOH = 1;               // start of heading
export const STX = 2;               // start of text
export const ETX = 3;               // end of text
export const EOT = 4;               // end of transmission
export const ENQ = 5;               // enquirying
export const ACK = 6;               // acknowledge
export const BEL = 7;               // bell
export const BS  = 8;               // backspace
export const TAB = 9;               // horizontal tab
export const LF  = 10;              // NL line feed, new line
export const VT  = 11;              // vertical tab
export const FF  = 12;              // NP from feed, new page
export const CR  = 13;              // carriage return
export const SO  = 14;              // shift out
export const SI  = 15;              // shift in
export const DLE = 16;              // data link escape
export const DC1 = 17;              // device control 1
export const DC2 = 18;              // device control 2
export const DC3 = 19;              // device control 3
export const DC4 = 20;              // device control 4
export const NAK = 21;              // negative acknowledge
export const SYN = 22;              // synchronous idle
export const ETB = 23;              // enf of trans. block
export const CAN = 24;              // cancel
export const EM  = 25;              // end of medium
export const SUB = 26;              // substitute
export const ESC = 27;              // escape
export const FS  = 28;              // file separator
export const GS  = 29;              // group separator
export const RS  = 30;              // record separator
export const US  = 31;              // unit separator
export const SPACE = 32;            // " " - space
export const DELETE = 127;          // DEL
export const REPLACEMENT = 65533;   // "�" - replacement character

export const JUNK = Buffer.from([ 0, 5, 116, 0 ]).toString("utf8");

export function sanitize(s: string): string {
    // const useless: string[] = [ String.fromCharCode(REPLACEMENT) ];
    // return data.toString("utf8").split(EMPTY)
    //     .filter((v) => !useless.includes(v))
    //     .join(EMPTY);
    const t = s.replaceAll(String.fromCharCode(REPLACEMENT), "")
        .replaceAll(JUNK, "")
        .replaceAll(String.fromCharCode(SOH), "")
        // .replaceAll(String.fromCharCode(NUL), "")
        ;

    const bs = Buffer.from(s);
    const bt = Buffer.from(t);

    return t;
}

export function cleanTextContent(text: string): string {
    return text.replace("[^\\x00-\\x7F]", "")   // strips off all non-ASCII characters
        .replace("[\\p{Cntrl}&&[^\r\n\t]]", "") // erases all the ASCII control characters
        .replace("\\p{C}", "")                  // removes non-printable characters from Unicode
        .trim();
}
