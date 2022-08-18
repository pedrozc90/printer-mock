import { createServer, Server, Socket } from "net";

import { formatAddress, BufferUtils } from "./utils";
import { ServerError } from "./types";
import { PrinterStatus } from "./sato";
import * as Sato from "./sato";

const PORT: number = parseInt(process.env.PORT || "9100");
const HOST: string = process.env.HOST || "localhost";

const COUNTER_LIMIT: number = 4;

const buffer: string[] = [];
let paused: boolean = false;
let counter: number = 0;
let analysing: boolean = false;

const reset: () => void = () => {
    paused = false;
    counter = 0;
    analysing = false;
}

const server: Server = createServer((socket: Socket) => {
    // socket connection event
    console.log("client connected!");

    socket.on("data", async (data: Buffer) => {
        // convert buffer to string
        const content = data.toString("utf8");
        console.log(content);
        
        const lines: string[] = BufferUtils.parse(data);

        while (lines.length > 0) {
            const line: string | undefined = lines.shift();
            if (line === undefined) continue;

            let printer_status: PrinterStatus = PrinterStatus.STANDBY;
            let epc: string | undefined;

            // cancel command
            if (Sato.isPHCommand(line)) {
                reset();
                // clear epc buffer
                buffer.splice(0, buffer.length);
            }
            // resume
            else if (Sato.isHResumeCommand(line)) {
                paused = false;
            }
            // pause
            else if (Sato.isHPauseCommand(line)) {
                paused = true;
            }
            else if (Sato.isPKCommand(line)) {
                counter++;
                if (counter > COUNTER_LIMIT) {
                    counter = 0;
                }
            }
            else if (Sato.isPGCommand(line)) {
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
                }
                else if (analysing) {
                    printer_status = PrinterStatus.ANALYSING;
                }
                else if (counter !== 0) {
                    printer_status = PrinterStatus.PRITING;
                }
                
                if (counter === COUNTER_LIMIT) {
                    counter = 0;
                    if (buffer.length > 0 && !analysing) {
                        epc = buffer.shift();
                    }
                }
            }

            const message: string = Sato.message({ printer_status, remaining: buffer.length, epc });

            Sato.send(socket, message, 100);
        }

        analysing = false;
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
        console.log((had_error) ?
            "socket was closed due to a transmission error." :
            "socket successfully closed.");
    });

    socket.on("error", (err: Error) => {
        console.error(`${ err.name }: ${ err.message }`, err.stack);
    });
});

// server events
server.on("close", () => console.log("[SERVER]", "[CLOSE]", "connection closed!"));
server.on("error", (err: ServerError) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Address ${ err.address }:${ err.port } in use, closing server...`);
        server.close();
        process.exit(1);
    } else {
        console.error(err);
        console.error(`${ err.name }: ${ err.message }`, err.stack);
    }
});

server.listen(PORT, HOST, () => {
    const address = formatAddress(server.address());
    console.log("server is listening on", address);
});
