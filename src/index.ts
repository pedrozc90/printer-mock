import { createServer, Server, Socket } from "net";

import { createDirectory, formatAddress, ETX, STX, EMPTY, notEmpty } from "./utils";
import { ReceivedData, ServerError } from "./types";

import * as Sato from "./sato";

import path from "path";

const PORT: number = parseInt(process.env.PORT || "9100");
const HOST: string = process.env.HOST || "localhost";
const ROOT_DIR: string = path.join(__dirname, "../logs");

const buffer: string[] = [ "PEDRO" ];
const list_of_epcs: string[] = [];
const options = {
    printer_status: false,
    rfid_tag: false,
    pause: false
};

let attempts: number = 0;
let counter: number = 0;

createDirectory(ROOT_DIR);

function mislead(buffer: string[], attempts: number) {
    return false;
}

function printAscII(content: string): void {
    const tmp = content.split(EMPTY).map((char) => {
        const code = char.charCodeAt(0);
        return { char, code };
    });

    console.table(tmp, [ "char", "code" ]);
}

const server: Server = createServer((socket: Socket) => {
    // socket connection event
    console.log("client connected!");

    const receivedData: ReceivedData[] = [];

    socket.on("data", async (data: Buffer) => {
        
        const content = data.toString("utf8");
        
        // const isLabelFile: boolean = (Sato.captureAllEpcs(content) || []).length > 0;
        // if (!isLabelFile) {
        //     console.log("data:", content);
        // }

        const lines: string[] = content.replace(/[\n|\r]/g, "").split(ETX)
            .map((v) => `${STX}${v}${ETX}`)
            .filter(notEmpty);

        for (const line of lines) {
            const start = Date.now();

            let printer_status: Sato.PrinterStatus | undefined;
            let buffer_status: Sato.BufferStatus | undefined;
            let ribbon_status: Sato.RibbonStatus | undefined;
            let media_status: Sato.MediaStatus | undefined;
            let error_number: Sato.ErrorNumber | undefined;
            let battery_status: Sato.BatteryStatus | undefined;
            let remaining: number = (buffer.length > 0) && 1 || 0;

            let epc: string | undefined = Sato.captureEpc(line);
            if (epc) {
                console.log(`pushing epc ${epc} into the buffer.`);
                buffer.push(epc);
                epc = undefined;
            }

            // force any kind of error
            if (mislead(buffer, attempts)) {
                printer_status = Sato.PrinterStatus.PRITING;
                buffer_status = Sato.BufferStatus.BUFFER_FULL;
                ribbon_status = Sato.RibbonStatus.NO_RIBBON;
                error_number = Sato.ErrorNumber.OFFLINE;
            }
            // cancel command
            else if (Sato.isPHCommand(line)) {
                console.log("CANCEL COMMAND");
                buffer.splice(0, buffer.length);
            }
            // pg command
            else if (Sato.isPGCommand(line)) {
                console.log("PG COMMAND");
                options.printer_status = true;
            }
            // pk command
            else if (Sato.isPKCommand(line)) {
                console.log("PK COMMAND");
                options.rfid_tag = true;
            }
            // pgpk command
            else if (Sato.isPKPGCommand(line)) {
                console.log("PGPK COMMAND");
                options.printer_status = true;
                options.rfid_tag = true;
            }
            else if (!epc) {
                await Sato.delay(100);
                continue;
            }

            if (options.printer_status && options.rfid_tag) {
                if (buffer.length > 0 && attempts >= 5) {
                    printer_status = Sato.PrinterStatus.PRITING;
                    
                    epc = buffer.pop();
                    if (epc) {
                        options.printer_status = false;
                        options.rfid_tag = false;

                        list_of_epcs.push(epc);
                    }

                    attempts = 0;
                } else {
                    printer_status = Sato.PrinterStatus.STANDBY;
                }

                attempts += 1;
            }

            if (buffer.length == 0) {
                printer_status = Sato.PrinterStatus.STANDBY;
            } else {
                printer_status = Sato.PrinterStatus.ANALYSING;
            }

            const params = {
                printer_status,
                buffer_status,
                ribbon_status,
                media_status,
                error_number,
                battery_status,
                remaining,
                epc,
                tid: (epc) && list_of_epcs.length || undefined 
            };

            const message = Sato.message(params);

            Sato.send(socket, message, 1000);

            console.log("attempts:", attempts, "buffer size:", buffer.length, "elapsed time:", Date.now() - start);
        };

        await Sato.delay(100);
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
        if (receivedData.length > 0) {
            // const epcs = receivedData.map((v) => v.epcs).filter(isNotEmpty).flat();
            // const content = receivedData.map((v) => v.content).flat().join("\n\n");
            
            // const tags: Tag[] = content.split("U,01")
            //     .map((v) => Sato.captureInfo(v))
            //     .filter(isNotEmpty);

            // let total = 0;
            // let table: { size: string, quantity: number }[] = [];
            // const tagsBySize = tags.reduce((map: Map<string, string[]>, v: Tag) => {
            //     const size = v.size;
            //     if (size && v.epc) {
            //         map.set(size, [ ...map.get(size) || [], v.epc ]);
            //     }
            //     return map;
            // }, new Map<string, string[]>()).forEach((v: string[], k: string) => {
            //     const quantity = v.filter((v, index, self) => index === self.indexOf(v)).length;
            //     table.push({ size: k, quantity });
            // });

            // table.push({ size: "Uniques", quantity: table.map((v) => v.quantity).reduce((r, v) => r + v, 0) });
            // table.push({ size: "All", quantity: epcs.length });
            
            // console.table(table, [ "size", "quantity" ]);

            // const now = (new Date()).toISOString().replace("T","-").replace(":", "-").replace("Z", "");
            // writeEpcFile(path.join(ROOT_DIR, `epcs-${ now }.txt`), epcs);
            // writeContentFile(path.join(ROOT_DIR, `content-${ now }.txt`), content);
            // writeTagFile(path.join(ROOT_DIR, `tags-${ now }.txt`), tags);

            // // clear result list
            // receivedData.splice(0, receivedData.length);
        }

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
