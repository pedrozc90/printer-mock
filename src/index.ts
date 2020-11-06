import { createServer, Server, Socket } from "net";
import { getServerAddress } from "./utils/utils";
import * as sato from "./sato";

const port: number = parseInt(process.env.PORT || "9100");
const host: string = process.env.HOST || "localhost";

const pgpk_regexp = new RegExp(/.*[PG|PK]{2}.*/g);
const ph_regexp = new RegExp(/.*PH.*/g);

const server: Server = createServer((socket: Socket) => {
    // socket connection events
    console.log("client connected!");

    const results: string[] = [];

    socket.on("data", (data: Buffer) => {
        const content = data.toString("utf8");

        const epcs = sato.captureEpcs(content);
        if (!epcs || !epcs.length) return;

        console.log("[DATA]", content);
        
        results.push(...epcs);

        sato.sendEPC(socket, epcs, 0, 2000);
    });

    socket.on("ready", () => console.log("[SOCKET]", "[READY]", "connection is ready!"));

    socket.on("timeout", () => {
        console.log("[SOCKET]", "[TIMEOUT]", "connection has been idle!");
        socket.end();
    });

    socket.on("end", () => console.warn("[SOCKET]", "[END]", "connection ended."));

    socket.on("close", (had_error: boolean) => {

        console.log("Total Number of EPCs:", results.length);

        results.splice(0, results.length);

        console.log("[SOCKET]", "[CLOSE]", (had_error) ?
            "socket was closed due to a transmission error." :
            "socket successfully closed.");
    });

    socket.on("error", (e: Error) => console.error("[SOCKET]", "[ERROR]", `${ e.name }: ${ e.message }`, e.stack));
});

// server events
server.on("close", () => console.log("[SERVER]", "[CLOSE]", "connection closed!"));
server.on("error", (e: Error) => console.error("[SERVER]", "[ERROR]", `${ e.name }: ${ e.message }`, e.stack));

server.listen(port, host, () => console.log("[SERVER]", "[START]", `server is listening on ${ getServerAddress(server.address()) }`));
