import { createServer, Server, Socket } from "net";

import { splitFrames } from "./utils/index.ts";
import { PrinterStatus, Sato } from "./printers/index.ts";

const COUNTER_LIMIT: number = 4;

// cap on unterminated bytes held between data events before they are discarded
const MAX_LEFTOVER: number = 1_000_000;

export const createApp = (): Server => {
    const buffer: string[] = [];
    let paused: boolean = false;
    let counter: number = 0;
    let analysing: boolean = false;

    const reset: () => void = () => {
        paused = false;
        counter = 0;
        analysing = false;
        buffer.splice(0, buffer.length);
    };

    const server: Server = createServer((socket: Socket) => {
        // socket connection event
        console.log("client connected!");

        // bytes received but not yet terminated by ETX, carried into the next chunk
        let leftover: Buffer = Buffer.alloc(0);
        // serialize processing so awaited sends do not interleave across data events
        let queue: Promise<void> = Promise.resolve();

        const handleData = async (data: Buffer): Promise<void> => {
            const combined: Buffer = leftover.length > 0 ? Buffer.concat([leftover, data]) : data;
            console.log(combined.toString("utf8"));

            const { frames, rest } = splitFrames(combined);
            if (rest.length > MAX_LEFTOVER) {
                console.warn("discarding unterminated data: exceeded leftover limit");
                leftover = Buffer.alloc(0);
            } else {
                leftover = rest;
            }

            for (const line of frames) {
                let printer_status: PrinterStatus = PrinterStatus.STANDBY;
                let epc: string | undefined;

                // cancel command
                if (Sato.isPHCommand(line)) {
                    reset();
                }
                // resume
                else if (Sato.isHResumeCommand(line)) {
                    paused = false;
                }
                // pause
                else if (Sato.isHPauseCommand(line)) {
                    paused = true;
                } else if (Sato.isPKCommand(line)) {
                    counter++;
                    if (counter > COUNTER_LIMIT) {
                        counter = 0;
                    }
                } else if (Sato.isPGCommand(line)) {
                    counter++;
                    if (counter > COUNTER_LIMIT) {
                        counter = 0;
                    }
                }
                // return epc
                else if (Sato.isPKPGCommand(line)) {
                    counter += 2;
                    if (counter > COUNTER_LIMIT) {
                        counter = 0;
                    }
                }
                // others
                else {
                    const epc = Sato.captureEpc(line);
                    if (epc) {
                        buffer.push(epc);
                    }
                }

                if (buffer.length > 0) {
                    if (paused) {
                        printer_status = PrinterStatus.WAITING;
                    } else if (analysing) {
                        printer_status = PrinterStatus.ANALYSING;
                    } else if (counter !== 0) {
                        printer_status = PrinterStatus.PRITING;
                    }

                    if (counter === COUNTER_LIMIT) {
                        counter = 0;
                        if (buffer.length > 0 && !analysing) {
                            epc = buffer.shift();
                        }
                    }
                }

                const message: string = Sato.message({
                    printer_status,
                    remaining: buffer.length,
                    epc,
                });

                await Sato.send(socket, message, 100);
            }

            analysing = false;
        };

        socket.on("data", (data: Buffer) => {
            queue = queue.then(() => handleData(data)).catch((err: unknown) => console.error("error handling data:", err));
        });

        socket.on("ready", () => {
            console.log("connection is ready!");
        });

        socket.on("timeout", () => {
            console.warn("socket timeout");
            socket.end();
        });

        socket.on("end", () => {
            console.log("client disconnected.");
        });

        socket.on("close", (had_error: boolean) => {
            reset();
            console.log(had_error ? "socket was closed due to a transmission error." : "socket successfully closed.");
        });

        socket.on("error", (err: Error) => {
            console.error(`${err.name}: ${err.message}`, err.stack);
        });
    });

    // the mock simulates a single printer; reject any additional connection
    server.maxConnections = 1;

    // server events
    server.on("close", () => console.log("[SERVER]", "[CLOSE]", "connection closed!"));

    return server;
};
