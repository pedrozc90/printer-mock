import { Socket } from "net";
import { BatteryStatus, BufferStatus, ErrorNumber, MediaStatus, PrinterStatus, RibbonStatus } from "./enums";
import { Tag } from "../types";
import { STX, ETX } from "../utils";

// --------------------------------------------------
// PARSER
// --------------------------------------------------

const PG_REGEXP = new RegExp(/\u{0002}\u{0012}PG\u{0003}/gu);
const PK_REGEXP = new RegExp(/\u{0002}\u{0012}PK\u{0003}/gu);
const PGPK_REGEXP = new RegExp(/\u{0002}\u{0012}PG\u{0012}PK\u{0003}/gu);
const PH_REGEXP = new RegExp(/\u{0002}\u{0012}PH\u{0003}/gui);
const H_PAUSE_REGEXP = new RegExp(/\u{0002}\u{0010}H\u{0003}/gu);
const H_RESUME_REGEXP = new RegExp(/\u{0002}\u{0011}H\u{0003}/gu);

// const LINE_REGEX = new RegExp(`${STX}(.*)${ETX}`, "g");

const EPC_REGEXP = new RegExp(/(?!epc\:)([a-zA-Z0-9]{24})(?=[,])/g);
const TAG_REGEXP = new RegExp(/SATOSANS.*,\d{3},\d{3},(.*)/g);
const TAG_SIZE_REGEXP: RegExp = new RegExp(/(?:027700080H0.*,039,042),(.*)/i);

// export function split(data: string): string[] {
//     const match = LINE_REGEX.exec(data);
//     if (!match) return [];
//     return match;
// }

export function isPGCommand(cmd: string): boolean {
    return PG_REGEXP.test(cmd);
}

export function isPKCommand(cmd: string): boolean {
    return PK_REGEXP.test(cmd);
}

export function isPKPGCommand(cmd: string): boolean {
    return PGPK_REGEXP.test(cmd);
}

export function isPHCommand(cmd: string): boolean {
    return PH_REGEXP.test(cmd);
}

export function isHPauseCommand(cmd: string): boolean {
    return H_PAUSE_REGEXP.test(cmd);
}

export function isHResumeCommand(cmd: string): boolean {
    return H_RESUME_REGEXP.test(cmd);
}

export function sendEPC(socket: Socket, epcs: string[], index: number = 0, delay: number = 200) {
    setTimeout(() => {
        const epc = epcs[index++];
        if (epc) {
            send(socket, message({ epc }));
            if (index < epcs.length) {
                sendEPC(socket, epcs, index, 100);
            } else {
                // Finaliza a impressao
                standby(socket);
            }
        }
    }, delay);
}

export async function send(socket: Socket, message: string, ms: number = 500): Promise<void> {
    console.log(`Send: ${message}`);
    socket.write(`\u0002${message}\u0003\n`);
    await delay(ms);
}

export async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract epc string from data.
 * String Pattern: "F1+1,8,0,1IP0e:h,epc:${epc},fsw:0;"
 * Epc Example: IP0e:h,epc:3be100001debfe3f77359854,fsw:0;
 * 
 * @param data                                      -- string received from socket
 */
export function captureAllEpcs(data: string): string[] | undefined {
    const matches = data.match(EPC_REGEXP);
    if (!matches) return;
    return matches;
}

export function captureEpc(data: string): string | undefined {
    const matches: RegExpMatchArray | null = data.match(EPC_REGEXP);
    if (!matches) return;
    return matches[0];
}

export function captureInfo(data: string): Tag | undefined {
    const epc: string | undefined = captureEpc(data);
    if (!epc) return;

    const matches: RegExpMatchArray | null = data.match(TAG_REGEXP);
    if (!matches) return;
    const result = matches.filter((v, i) => [1,4,6].includes(i))
        .map((v) => {
            const r = v.match(/\d{3},\d{3},(.*)/i);
            if (!r) return null;
            return r[1];
        });
    return {
        epc,
        description: result[0],
        size: result[1],
        sku: result[2]
    };
}

export function captureSizeBR(data: string): string | undefined {
    const matches: RegExpMatchArray | null = data.match(TAG_SIZE_REGEXP);
    if (!matches) return;
    return matches[1];
}

// --------------------------------------------------
// MESSAGE
// --------------------------------------------------

export interface Message {
    printer_status?: PrinterStatus;
    buffer_status?: BufferStatus;
    ribbon_status?: RibbonStatus;
    media_status?: MediaStatus;
    error_number?: ErrorNumber;
    battery_status?: BatteryStatus;
    remaining?: number;
    epc?: string;
    tid?: string | number;
}

export function message(data: Message): string {
    const ps: string = `PS${ data.printer_status || PrinterStatus.STANDBY }`;
    const rs: string = `RS${ data.buffer_status || BufferStatus.BUFFER_AVAILABLE }`;
    const re: string = `RE${ data.ribbon_status || RibbonStatus.RIBBON_PRESENT }`;
    const pe: string = `PE${ data.media_status || MediaStatus.MEDIA_PRESENT }`;
    const en: string = `EN${ String(data.error_number || ErrorNumber.ONLINE).padStart(2, "0") }`;
    const bt: string = `BT${ data.battery_status || BatteryStatus.NORMAL }`;
    const q: string = `Q${ String(data.remaining || 0).padStart(6, "0") }`

    //      S000000                32,PS0,RS0,RE0,PE0,EN00,BT0,Q000000     A000000                     A000000                     S000000                61,1,N,EP:3BE1000020DE9330000005CF,ID:E2806894200050092D95FCCA
    const info: string = `${ps},${rs},${re},${pe},${en},${bt},${q}`;
    const printer_info: string = `${info.length},${info}`;

    if (!data.tid && data.epc) {
        data.tid = String(1).padStart(24, "0");
    } else if (data.tid) {
        data.tid = String(data.tid).padStart(24, "0");
    }

    const epc_data: string = (!data.epc && !data.tid) ? "" : `1,N,EP:${data.epc || ""},ID:${data.tid || ""}`;
    const epc_info: string = `${epc_data.length},${epc_data}`

    return `${printer_info} ${epc_info}`;
}

export function analysing(socket: Socket, data: Message = {}): Promise<void> {
    const msg = message({ printer_status: PrinterStatus.ANALYSING, ...data });
    return send(socket, msg);
}

export function standby(socket: Socket, data: Message = {}): Promise<void> {
    const msg = message({ printer_status: PrinterStatus.STANDBY, ...data });
    return send(socket, msg);
}
