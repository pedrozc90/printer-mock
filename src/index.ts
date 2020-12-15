import { createServer, Server, Socket } from "net";

import { createDirectory, formatAddress, writeContentFile, writeEpcFile, isNotEmpty, writeTagFile } from "./utils";
import { ReceivedData, ServerError, Tag } from "./types";

import * as Sato from "./sato";

import path from "path";

const PORT: number = parseInt(process.env.PORT || "9100");
const HOST: string = process.env.HOST || "localhost";
const ROOT_DIR: string = path.join(__dirname, "../logs");

createDirectory(ROOT_DIR);

const server: Server = createServer((socket: Socket) => {
    // socket connection event
    console.log("client connected!");

    const receivedData: ReceivedData[] = [];

    socket.on("data", (data: Buffer) => {
        const content = data.toString("utf8");

        const epcs = Sato.captureAllEpcs(content);
        if (!epcs || !epcs.length) return;

        console.info("[DATA]", content);
        Sato.sendEPC(socket, epcs);

        
        receivedData.push({ content, epcs });
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
            const epcs = receivedData.map((v) => v.epcs).filter(isNotEmpty).flat();
            const content = receivedData.map((v) => v.content).flat().join("\n\n");
            
            const tags: Tag[] = content.split("U,01")
                .map((v) => Sato.captureInfo(v))
                .filter(isNotEmpty);

            let total = 0;
            let table: { size: string, quantity: number }[] = [];
            const tagsBySize = tags.reduce((map: Map<string, string[]>, v: Tag) => {
                const size = v.size;
                if (size && v.epc) {
                    map.set(size, [ ...map.get(size) || [], v.epc ]);
                }
                return map;
            }, new Map<string, string[]>()).forEach((v: string[], k: string) => {
                const quantity = v.filter((v, index, self) => index === self.indexOf(v)).length;
                table.push({ size: k, quantity });
            });

            table.push({ size: "Uniques", quantity: table.map((v) => v.quantity).reduce((r, v) => r + v, 0) });
            table.push({ size: "All", quantity: epcs.length });
            
            console.table(table, [ "size", "quantity" ]);

            const now = (new Date()).toISOString().replace("T","-").replace(":", "-").replace("Z", "");
            writeEpcFile(path.join(ROOT_DIR, `epcs-${ now }.txt`), epcs);
            writeContentFile(path.join(ROOT_DIR, `content-${ now }.txt`), content);
            writeTagFile(path.join(ROOT_DIR, `tags-${ now }.txt`), tags);

            // clear result list
            receivedData.splice(0, receivedData.length);
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
