import { ETX, STX } from "../../utils/index.ts";

export type Command = { type: "PG" } | { type: "PK" } | { type: "PH" } | { type: "PAUSE" } | { type: "RESUME" };

// Command tokens — the payload that appears inside a STX...ETX frame. Control bytes are
// written as \u escapes: \u0010 = DLE, \u0011 = DC1, \u0012 = DC2.
export const PG_CMD = "\u0012PG"; // DC2 + "PG" — status
export const PK_CMD = "\u0012PK"; // DC2 + "PK" — EPC/TID read
export const PH_CMD = "\u0012PH"; // DC2 + "PH" — cancel
export const PAUSE_CMD = "\u0010H"; // DLE + "H" — pause (per the documentation this is just DLE)
export const RESUME_CMD = "\u0011H"; // DC1 + "H" — resume (per the documentation this is just DC1)
export const PGPK_CMD = `${PG_CMD}${PK_CMD}`; // combined PG+PK poll — the only combined form the client sends

const COMMAND_TOKENS: ReadonlyArray<{ token: string; command: Command }> = [
    { token: PG_CMD, command: { type: "PG" } },
    { token: PK_CMD, command: { type: "PK" } },
    { token: PH_CMD, command: { type: "PH" } },
    { token: PAUSE_CMD, command: { type: "PAUSE" } },
    { token: RESUME_CMD, command: { type: "RESUME" } },
];

/**
 * Tokenizes a normalized STX...ETX frame into its ordered list of recognized commands. A
 * combined `PG+PK` request (the only combined form the real client ever sends) naturally
 * produces two tokens with no special-casing. Returns `[]` for anything that doesn't start with
 * a recognized command token — the signal callers use to fall through to SBPL parsing instead.
 */
export const tokenizeCommands = (frame: string): Command[] => {
    if (frame.length < 2) return [];
    if (frame.charCodeAt(0) !== STX || frame.charCodeAt(frame.length - 1) !== ETX) return [];

    const payload = frame.slice(1, -1);
    const commands: Command[] = [];
    let offset = 0;

    while (offset < payload.length) {
        const match = COMMAND_TOKENS.find(({ token }) => payload.startsWith(token, offset));
        if (!match) break;
        commands.push(match.command);
        offset += match.token.length;
    }

    return commands;
};
