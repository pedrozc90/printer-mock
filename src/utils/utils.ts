import { randomBytes } from "node:crypto";

export const toInt = (value: string | number | undefined): number | undefined => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        let result = parseInt(value);
        if (isNaN(result)) return;
        return result;
    }
    return undefined;
};

export const resolvePort = (value: string | undefined, fallback: number = 3000): number => {
    if (value === undefined) return fallback;

    const port: number | undefined = toInt(value);
    if (port === undefined || port < 0 || port > 65535) {
        throw new Error(`Invalid PORT value: ${value}`);
    }

    return port;
};

/**
 * Generate a random TID.
 *
 * @param bytes - number of bytes
 * @returns a random TID hexadecimal string, like 'E2A41B7C93D02F184A65B901'
 */
export const generateTID = (bytes: number = 12): string => {
    const tid = randomBytes(bytes);

    // TID memory bank typically starts with an E2 manufacturer/chip identifier.
    // EPCglobal / ISO 18000-63-style TID prefix
    tid[0] = 0xe2;

    return tid.toString("hex").toUpperCase();
};
