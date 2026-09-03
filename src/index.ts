import { Socket } from "net";
import { logger, settings } from "./config/index.ts";
import { createApp } from "./app.ts";

const { port } = settings;

const app = createApp();

const server = app.listen(port);

server.on("listening", () => {
    if (!server.listening) return;

    const addr = server.address();
    logger.info("Address:", addr);

    const bind = addr ? (typeof addr === "string" ? `Pipe ${addr}` : `http://${addr.address}:${addr.port}`) : null;

    logger.info("----------------------------------------------------------------------");
    logger.info(`Application running on ${bind}`);
    logger.info("To shut it down, press CTRL + C at any time.");
    logger.info("----------------------------------------------------------------------");
    logger.info(`Process PID: ${process.pid}`);
    logger.info("----------------------------------------------------------------------");
});

server.on("error", (error: Error) => {
    const syscall = "syscall" in error ? error.syscall : null;
    if (syscall !== "listen") {
        throw error;
    }

    const bind: string = typeof port === "string" ? "Pipe " + port : "Port " + port;
    const code = "code" in error ? error.code : null;

    // handle specific listen errors with friendly messages
    switch (code) {
        case "EACCES": {
            logger.error(bind + " requires elevated privileges");
            return process.exit(1);
        }
        case "EADDRINUSE": {
            logger.error(bind + " is already in use");
            return process.exit(1);
        }
        default:
            throw error;
    }
});

// track the active connection so shutdown can close it promptly
let socket: Socket | undefined;
server.on("connection", (s: Socket) => {
    socket = s;
    s.on("close", () => {
        if (socket === s) socket = undefined;
    });
});

let shuttingDown: boolean = false;

const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received. Shutting down gracefully...`);

    const forceExitTimer = setTimeout(() => {
        logger.warn("Graceful shutdown timed out. Forcing exit.");
        process.exit(1);
    }, 10_000);

    forceExitTimer.unref();

    try {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
            socket?.destroy();
        });

        logger.info("Shutdown complete");
        process.exit(0);
    } catch (e) {
        logger.error("Error during shutdown", e);
        process.exit(1);
    }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
