// REFERENCES:
// https://honeywellaidc.force.com/supportppr/s/article/What-do-Control-Characters-SOH-STX-etc-mean-when-scanning

export const NUL = String.fromCharCode(0);                  // null
export const SOH = String.fromCharCode(1);                  // start of heading
export const STX = String.fromCharCode(2);                  // start of text
export const ETX = String.fromCharCode(3);                  // end of text
export const EOT = String.fromCharCode(4);                  // end of transmission
export const ENQ = String.fromCharCode(5);                  // enquirying
export const ACK = String.fromCharCode(6);                  // acknowledge
export const BEL = String.fromCharCode(7);                  // bell
export const BS  = String.fromCharCode(8);                  // backspace
export const TAB = String.fromCharCode(9);                  // horizontal tab
export const LF  = String.fromCharCode(10);                 // NL line feed, new line
export const VT  = String.fromCharCode(11);                 // vertical tab
export const FF  = String.fromCharCode(12);                 // NP from feed, new page
export const CR  = String.fromCharCode(13);                 // carriage return
export const SO  = String.fromCharCode(14);                 // shift out
export const SI  = String.fromCharCode(15);                 // shift in
export const DLE = String.fromCharCode(16);                 // data link escape
export const DC1 = String.fromCharCode(17);                 // device control 1
export const DC2 = String.fromCharCode(18);                 // device control 2
export const DC3 = String.fromCharCode(19);                 // device control 3
export const DC4 = String.fromCharCode(20);                 // device control 4
export const NAK = String.fromCharCode(21);                 // negative acknowledge
export const SYN = String.fromCharCode(22);                 // synchronous idle
export const ETB = String.fromCharCode(23);                 // enf of trans. block
export const CAN = String.fromCharCode(24);                 // cancel
export const EM  = String.fromCharCode(25);                 // end of medium
export const SUB = String.fromCharCode(26);                 // substitute
export const ESC = String.fromCharCode(27);                 // escape
export const FS  = String.fromCharCode(28);                 // file separator
export const GS  = String.fromCharCode(29);                 // group separator
export const RS  = String.fromCharCode(30);                 // record separator
export const US  = String.fromCharCode(31);                 // unit separator
export const SPACE = String.fromCharCode(32);               // " " - sapce

export const U_10 = String.fromCharCode(10);
export const U_11 = String.fromCharCode(11);
export const U_12 = String.fromCharCode(12);
export const U_18 = String.fromCharCode(18);
export const REPLACEMENT = String.fromCharCode(65533);      // "�" - replacement character

export const EMPTY = String.fromCharCode();                 // empty (length = 0)

export function sanitize(data: Buffer): string {
    const useless: string[] = [ REPLACEMENT ];
    return data.toString("utf8").split(EMPTY)
        .filter((v) => !useless.includes(v))
        .join(EMPTY);
}

export function cleanTextContent(text: string): string {
    return text.replace("[^\\x00-\\x7F]", "")   // strips off all non-ASCII characters
        .replace("[\\p{Cntrl}&&[^\r\n\t]]", "") // erases all the ASCII control characters
        .replace("\\p{C}", "")                  // removes non-printable characters from Unicode
        .trim();
}
