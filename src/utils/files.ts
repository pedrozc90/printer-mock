import fs from "fs";
import path from "path";

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
        fs.writeFileSync(filename, `number of epcs: ${ epcs.length }\n`, { encoding: "utf8", flag: "w+" });
        fs.writeFileSync(filename, epcs.join("\n"), { encoding: "utf8", flag: "a+" });
    } catch (e) {
        console.error(e);
    }
}

export function writeContentFile(filename: string, content: string): void {
    try {
        fs.writeFileSync(filename, content, { encoding: "utf8", flag: "w+" });
    } catch (e) {
        console.error(e);
    }
}
