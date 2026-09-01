import { type Settings } from "../types/types.ts";
import { toInt } from "../utils/index.ts";

const env = (name: string) => {
    const value = process.env["PORT"];
    if (!value) {
        throw new Error(`Environment '${name}' not defined.`);
    }
    return value;
};

const resolvePort = (fallback: number = 3000): number => {
    const value = env("PORT");
    if (value === undefined) return fallback;

    const port: number | undefined = toInt(value);
    if (port === undefined || port < 0 || port > 65535) {
        throw new Error(`Invalid PORT value: ${value}`);
    }

    return port;
};

const createSettings = (): Settings => ({
    port: resolvePort(),
});

export const settings = createSettings();
