import { createServer, Server, Socket } from "net";

import { formatAddress } from "./utils";
import { ServerError } from "./types";

import * as Sato from "./sato";

const PORT: number = parseInt(process.env.PORT || "9100");
const HOST: string = process.env.HOST || "localhost";

const PGPK_REGEXP = new RegExp(/.*[PG|PK]{2}.*/g);
const PH_REGEXP = new RegExp(/.*PH.*/g);

const server: Server = createServer((socket: Socket) => {
    // socket connection event
    console.log("client connected!");

    const results: string[] = [];

    socket.on("data", (data: Buffer) => {
        const content = data.toString("utf8");

        const epcs = Sato.captureEpcs(content);
        if (!epcs || !epcs.length) return;

        console.log("[DATA]", content);
        
        results.push(...epcs);

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

        console.log("Total Number of EPCs:", results.length);

        results.splice(0, results.length);

        console.log("[SOCKET]", "[CLOSE]", (had_error) ?
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
