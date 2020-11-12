import { Socket } from "net";

const PGPK_REGEXP = new RegExp(/.*[PG|PK]{2}.*/g);
const PH_REGEXP = new RegExp(/.*PH.*/g);

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

//
/**
 * Extract epc string from data.
 * String Pattern: "F1+1,8,0,1IP0e:h,epc:${epc},fsw:0;"
 * Epc Example: IP0e:h,epc:3be100001debfe3f77359854,fsw:0;
 * 
 * @param data -- string received from socket
 */
export function captureEpcs(data: string): string[] | undefined {
    const regexp = new RegExp(/(?!epc\:)([a-zA-Z0-9]{24})(?=[,])/g);
    const matches = data.match(regexp);
    if (!matches) return;
    return matches;
}
