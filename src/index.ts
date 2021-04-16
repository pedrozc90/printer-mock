import { createServer, Server, Socket } from "net";

import { createDirectory, formatAddress, ETX } from "./utils";
import { ReceivedData, ServerError } from "./types";

import * as Sato from "./sato";

import path from "path";
import { BatteryStatus, BufferStatus, ErrorNumber, MediaStatus, PrinterStatus, RibbonStatus } from "./sato/enums";

const PORT: number = parseInt(process.env.PORT || "9100");
const HOST: string = process.env.HOST || "localhost";
const ROOT_DIR: string = path.join(__dirname, "../logs");

const buffer: string[] = [];
const list_of_epcs: string[] = [];
const options = {
    printer_status: false,
    rfid_tag: false,
    pause: false
};

let attempts: number = 0;
let counter: number = 0;

createDirectory(ROOT_DIR);

function manipulated_error(buffer: string[], attempts: number) {
    // if (buffer.length == 20) {
    //     console.log("ERROR");
    //     return true;
    // }
    // return true;
    return attempts > 5;
}

const server: Server = createServer((socket: Socket) => {
    // socket connection event
    console.log("client connected!");

    const receivedData: ReceivedData[] = [];

    socket.on("data", async (data: Buffer) => {
        
        const content = data.toString("utf8");
        console.log("data:", content);

        const lines: string[] = content.split(ETX)
            .filter((v) => v.length !== 0)
            .map((v) => v.concat(ETX));

        for (const line of lines) {
            const start = Date.now();
            let printer_status: PrinterStatus | undefined;
            let buffer_status: BufferStatus | undefined;
            let ribbon_status: RibbonStatus | undefined;
            let media_status: MediaStatus | undefined;
            let error_number: ErrorNumber | undefined;
            let battery_status: BatteryStatus | undefined;
            let remaining: number = (buffer.length > 0) && 1 || 0;
            let epc: string | undefined;

            if (!line || line.length == 0) {
                return;
            }

            if (manipulated_error(buffer, attempts)) {
                printer_status = PrinterStatus.PRITING;
                buffer_status = BufferStatus.BUFFER_FULL;
                ribbon_status = RibbonStatus.NO_RIBBON;
                error_number = ErrorNumber.OFFLINE;
            }
            // cancel command
            else if (Sato.isHCommand(line)) {
                options.pause = true;
            }
            // cancel command
            else if (Sato.isPHCommand(line)) {
                break;
            }
            // printer status command
            else if (Sato.isPGCommand(line) || Sato.isPKCommand(line) || Sato.isPKPGCommand(line)) {
                if (Sato.isPGCommand(line)) {
                    options.printer_status = true;
                } else if (Sato.isPKCommand(line)) {
                    options.rfid_tag = true;
                } else {
                    options.printer_status = true;
                    options.rfid_tag = true;
                }


                if (options.printer_status && options.rfid_tag && buffer.length > 0) {
                    printer_status = PrinterStatus.PRITING;
                    
                    epc = buffer.pop();

                    if (epc) {
                        options.printer_status = false;
                        options.rfid_tag = false;
                    }
                }
            }
            // file
            else {
                const epcs = Sato.captureAllEpcs(line);

                console.log("number of epcs:", epcs?.length || 0);
                if (epcs) {
                    printer_status = PrinterStatus.ANALYSING;
                    buffer.push(...epcs);
                }
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

            console.log("elapsed time:", Date.now() - start);
        };

        attempts += 1;
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
        console.error("[ERROR]", `${ err.name }: ${ err.message }`, err.stack);
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
        console.error("[SERVER]", "[ERROR]", `${ err.name }: ${ err.message }`, err.stack);
    }
});

server.listen(PORT, HOST, () => {
    const address = formatAddress(server.address());
    console.log("server is listening on", address);
});
