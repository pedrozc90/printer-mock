export const STX = String.fromCharCode(2);                  // start of text
export const ETX = String.fromCharCode(3);                  // end of text
export const U_12 = String.fromCharCode(12);
export const U_18 = String.fromCharCode(18);
export const REPLACEMENT = String.fromCharCode(65533);      // "�" - replacement character

export const EMPTY = "";
export const SPACE = " ";

export function sanitize(data: Buffer): string {
    const useless: string[] = [ REPLACEMENT ];
    return data.toString("utf8").split(EMPTY)
        .filter((v) => !useless.includes(v))
        .join(EMPTY);
}
