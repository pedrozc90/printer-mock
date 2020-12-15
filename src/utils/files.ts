import fs from "fs";
import path from "path";

import { Tag } from "../types";

export function createDirectory(dirname: string): void {
    const GITKEEP_FILE = path.join(dirname, ".gitkeep");
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname);
    }
    if (!fs.existsSync(GITKEEP_FILE)) {
        fs.writeFileSync(GITKEEP_FILE, "");
    }
}

export function writeEpcFile(filename: string, epcs: string[]): void {
    if (!epcs.length) return;
    try {
        const uniques = epcs.filter((v, index, self) => index === self.indexOf(v));
        fs.writeFileSync(filename, `unique epcs: ${ uniques.length }\n`, { encoding: "utf8", flag: "w+" });
        fs.writeFileSync(filename, epcs.join("\n"), { encoding: "utf8", flag: "a+" });
    } catch (e) {
        console.error(e);
    }
}

export function writeContentFile(filename: string, content: string): void {
    try {
        fs.writeFileSync(filename, content, { encoding: "ascii", flag: "w+" });
    } catch (e) {
        console.error(e);
    }
}

export function writeTagFile(filename: string, tags: Tag[]): void {
    if (!tags.length) return;
    try {
        const content = tags.map((v) => `sku: ${v.sku}, size: ${v.size}, epc: ${v.epc}`).join("\n");
        fs.writeFileSync(filename, content, { encoding: "utf8", flag: "w+" });
    } catch (e) {
        console.error(e);
    }
}
