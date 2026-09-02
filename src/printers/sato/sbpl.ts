import { ESC, generateTID, toChar } from "../../utils/index.ts";
import { type EpcTid, type PrinterState, enqueueTag, setPaused } from "./state.ts";

export interface SbplBlockResult {
    hasPrintModeMarker: boolean;
    tags: EpcTid[];
}

const ESC_CHAR = toChar(ESC);

const printBlockPattern = (): RegExp => new RegExp(`${ESC_CHAR}A[\\s\\S]*?${ESC_CHAR}Z`, "g");

/** Extracts each `ESC+A ... ESC+Z` print-block substring from a frame's text. */
export const extractPrintBlocks = (text: string): string[] => Array.from(text.matchAll(printBlockPattern()), (m) => m[0]);

const EPC_PARAM_REGEXP = /epc:([0-9a-zA-Z]+)[,;]/;

/** Extracts the `epc:` parameter value from an `ESC+IP0` line, if present. */
export const extractEpcParam = (line: string): string | undefined => line.match(EPC_PARAM_REGEXP)?.[1];

/**
 * Parses one print block per mock-behavior.md's rules: a line starting with `ESC+PM` marks the
 * start of a new printing process; each `ESC+IP0` line with a usable `epc:` parameter becomes a
 * tag (EPC uppercased to match observed real-printer PK replies; TID generated fresh per tag). An
 * `ESC+IP0` line with no `epc:` parameter is skipped — no other parameter matters to the mock.
 */
export const parsePrintBlock = (block: string): SbplBlockResult => {
    const lines = block.split("\n");
    const hasPrintModeMarker = lines.some((line) => line.startsWith(`${ESC_CHAR}PM`));

    const tags: EpcTid[] = [];
    for (const line of lines) {
        if (!line.startsWith(`${ESC_CHAR}IP0`)) continue;
        const epc = extractEpcParam(line);
        if (!epc) continue;
        tags.push({ epc: epc.toUpperCase(), tid: generateTID(12) });
    }

    return { hasPrintModeMarker, tags };
};

/**
 * Ingests an SBPL frame's print blocks into the printer state. A block with neither `ESC+PM` nor
 * a usable `ESC+IP0` is skipped entirely. `ESC+PM` and each extracted tag both independently
 * reset `paused = false` (redundant with `DC2+PH`'s own reset, by design — see
 * mock-behavior.md's "Print blocks" section).
 */
export const ingestSbplFrame = (state: PrinterState, frameText: string, now: number): PrinterState => {
    let next = state;
    for (const block of extractPrintBlocks(frameText)) {
        const { hasPrintModeMarker, tags } = parsePrintBlock(block);
        if (!hasPrintModeMarker && tags.length === 0) continue;
        if (hasPrintModeMarker) next = setPaused(next, false, now);
        for (const tag of tags) next = enqueueTag(next, tag, now);
    }
    return next;
};
