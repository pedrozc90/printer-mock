import { createServer, Server, Socket } from "net";

import { createDirectory, formatAddress, writeContentFile, writeEpcFile } from "./utils";
import { ServerError } from "./types";

import * as Sato from "./sato";

import path from "path";

const PORT: number = parseInt(process.env.PORT || "9100");
const HOST: string = process.env.HOST || "localhost";
const ROOT_DIR: string = path.join(__dirname, "../logs");

createDirectory(ROOT_DIR);

const server: Server = createServer((socket: Socket) => {
    // socket connection event
    console.log("client connected!");

    const receivedData: { content: string, epcs: string[] }[] = [];

    socket.on("data", (data: Buffer) => {
        const content = data.toString("utf8");

        const epcs = Sato.captureEpcs(content);
        if (!epcs || !epcs.length) return;

        console.info("[DATA]", content);
        
        receivedData.push({ content, epcs });

        Sato.sendEPC(socket, epcs);
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
            const epcs = receivedData.map((v) => v.epcs).flat();
            const content = receivedData.map((v) => v.content).flat().join("\n\n");

            console.info("total number of epcs:", epcs.length);

            const now = (new Date()).toISOString().replace("T","-").replace(":", "-");
            writeEpcFile(path.join(ROOT_DIR, `epcs-${ now }.txt`), epcs);
            writeContentFile(path.join(ROOT_DIR, `content-${ now }.txt`), content);

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
