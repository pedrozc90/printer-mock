import { createServer, Socket } from "net";
import { getServerAddress } from "./utils/utils";

const port: number = parseInt(process.env.PORT || "9100");

const server = createServer((socket: Socket) => {
    // socket connection events
    console.log("client connected!");

    socket.on("data", (data: Buffer) => {
        console.log("Received:", data.toString());

        const epcs = getSatoEPCs(data.toString("utf8"));

        sendEPC(socket, epcs, 0, 2000);
    });

    socket.on("ready", () => console.log("connection is ready!"));

    socket.on("timeout", () => {
        console.log("socket timeout: connection has been idle!");
        socket.end();
    });

    socket.on("end", () => console.warn("connection ended."));

    socket.on("close", (had_error: boolean) => {
        console.log((had_error) ?
            "socket was closed due to a transmission error." :
            "socket successfully closed.");
    });

    socket.on("error", (err: Error) => console.error(`Socket Error - ${err.name}: ${err.message}`, err.stack));
});

// server events
server.on("close", () => console.log("connection closed!"));
server.on("error", (err: Error) => console.error(`Server Error - ${err.name}: ${err.message}`, err.stack));

server.listen(port, "127.0.0.1", () => console.log(`server is listening on ${ getServerAddress(server.address()) }`));

function sendEPC(socket: Socket, epcs: string[], index: number, delay: number = 2000) {
    setTimeout(() => {
        const epc = epcs[index];
        if (epc) {
            send(socket, "EP:" + epc);
            index++;
            if (index < epcs.length) {
                sendEPC(socket, epcs, index, 100);
            } else {
                // Finaliza a impressao
                send(socket, ",PS0,");
            }
        }
    }, delay);
}

function send(socket: Socket, message: string): void {
    console.log("Send: " + message);
    socket.write("\u0002" + message + "\u0003\n");
}

function getSatoEPCs(data: string): string[] {
    //F1+1,8,0,1IP0e:h,epc:${epc},fsw:0;
    const epcRgex = /[epc:]([a-zA-Z0-9]+)[,]/g;

    const matches = [];

    let match;
    while ((match = epcRgex.exec(data)) !== null) {
        if (match[1] != "h") {
            matches.push(match[1]);
        }
    }

    return matches;
}
