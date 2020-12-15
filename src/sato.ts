import { Socket } from "net";
import { Tag } from "./types";

const PGPK_REGEXP = new RegExp(/.*[PG|PK]{2}.*/g);
const PH_REGEXP = new RegExp(/.*PH.*/g);

const EPC_REGEXP = new RegExp(/(?!epc\:)([a-zA-Z0-9]{24})(?=[,])/g);
const TAG_REGEXP = new RegExp(/SATOSANS.*,\d{3},\d{3},(.*)/g);
const TAG_SIZE_REGEXP: RegExp = new RegExp(/(?:027700080H0.*,039,042),(.*)/i);

export function isPKPGCommand(cmd: string): boolean {
    return PGPK_REGEXP.test(cmd);
}

export function isPHCommand(cmd: string): boolean {
    return PH_REGEXP.test(cmd);
}

export function sendEPC(socket: Socket, epcs: string[], index: number = 0, delay: number = 2000) {
    setTimeout(() => {
        const epc = epcs[index++];
        if (epc) {
            send(socket, `EP:${ epc }`);
            if (index < epcs.length) {
                sendEPC(socket, epcs, index, 100);
            } else {
                // Finaliza a impressao
                send(socket, ",PS0,");
            }
        }
    }, delay);
}

export function send(socket: Socket, message: string): void {
    console.log(`Send: ${message}`);
    socket.write(`\u0002${message}\u0003\n`);
}

/**
 * Extract epc string from data.
 * String Pattern: "F1+1,8,0,1IP0e:h,epc:${epc},fsw:0;"
 * Epc Example: IP0e:h,epc:3be100001debfe3f77359854,fsw:0;
 * 
 * @param data -- string received from socket
 */
export function captureAllEpcs(data: string): string[] | undefined {
    const matches = data.match(EPC_REGEXP);
    if (!matches) return;
    return matches;
}

export function captureEpc(data: string): string | null {
    const matches: RegExpMatchArray | null = data.match(EPC_REGEXP);
    if (!matches) return null;
    return matches[0];
}

export function captureInfo(data: string): Tag | undefined {
    const epc: string | null = captureEpc(data);
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
