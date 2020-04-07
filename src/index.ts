import { createServer, Socket } from "net";

const port: number = parseInt(process.env.SATO_PORT || "9100");

const server = createServer((socket: Socket) => {
    console.log("Connected");

    socket.on("data", (data: Buffer) => {
        console.log(data.toString());

        const epcs = getSatoEPCs(data.toString("utf8"));

        sendEPC(socket, epcs, 0, 2000);
    });
});

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

server.listen(port);

console.log("Printer simulator listen port: " + port);
