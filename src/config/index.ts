import { type Settings } from "../types/types.ts";
import { resolvePort } from "../utils/index.ts";

const createSettings = (): Settings => ({
    port: resolvePort(process.env["PORT"]),
});

export const settings = createSettings();
