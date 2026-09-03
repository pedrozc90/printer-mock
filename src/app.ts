import { createServer, Server, Socket } from "net";

import { ACK, NAK, sanitize, splitFrames } from "./utils/index.ts";
import { Sato } from "./printers/index.ts";
import { logger } from "./config/index.ts";

// cap on unterminated bytes held between data events before they are discarded
const MAX_LEFTOVER: number = 1_000_000;

export const createApp = (): Server => {
    // Printer state lives here, above the per-connection callback, so it persists across TCP
    // disconnects/reconnects — matching real hardware, where printing continues independently of
    // the host connection. Only DC2+PH clears it.
    let state: Sato.PrinterState = Sato.createInitialState();

    const server: Server = createServer((socket: Socket) => {
        // socket connection event
        logger.info("client connected");

        // bytes received but not yet terminated by ETX, carried into the next chunk
        let leftover: Buffer = Buffer.alloc(0);
        // serialize processing so awaited sends do not interleave across data events
        let queue: Promise<void> = Promise.resolve();

        const handleFrame = async (frame: Buffer): Promise<void> => {
            const now = Date.now();

            const content = frame.toString("utf8");
            // logger.info(`Processing frame '${content}'`, frame)

            const commands: Sato.Command[] = Sato.tokenizeCommands(content);

            // remember the last-printed tag so we can log below whenever handling this frame
            // advances the cycle far enough to finish a new one (PG and PK both advance it, so
            // the check has to span the whole frame, not a single command)
            const printedBefore = state.lastPrinted?.epc;

            if (commands.length === 0) {
                // not a recognized command frame: treat it as SBPL data. No reply is sent for
                // SBPL frames — neither spec documents one, and the Java client doesn't wait for
                // one between sending the file and starting its PG+PK poll loop.
                const queuedBefore = state.queue.length;
                state = Sato.ingestSbplFrame(state, content, now);
                const queued = state.queue.length - queuedBefore;
                if (queued > 0) logger.info(`SBPL print job: ${queued} tag(s) queued (queue=${state.queue.length})`);
            }

            for (const command of commands) {
                switch (command.type) {
                    case "PG": {
                        const result = Sato.getStatus(state, now);
                        state = result.state;
                        await Sato.sendFrame(socket, Sato.buildStatusReply(result.snapshot));
                        break;
                    }
                    case "PK": {
                        const result = Sato.getLastPrinted(state, now);
                        state = result.state;
                        await Sato.sendFrame(socket, Sato.buildEpcReply(result.lastPrinted));
                        break;
                    }
                    case "PH": {
                        state = Sato.clearForCancel(state);
                        logger.info("DC2+PH cancel - print buffer and last-printed cleared");
                        await Sato.sendBare(socket, ACK);
                        break;
                    }
                    case "PAUSE": {
                        const wasPaused = state.paused;
                        state = Sato.setPaused(state, true, now);
                        logger.info(`DLE pause -> ${wasPaused ? "NAK (already paused)" : "ACK"}`);
                        await Sato.sendBare(socket, wasPaused ? NAK : ACK);
                        break;
                    }
                    case "RESUME": {
                        const wasPaused = state.paused;
                        state = Sato.setPaused(state, false, now);
                        logger.info(`DC1 resume -> ${wasPaused ? "ACK" : "NAK (not paused)"}`);
                        await Sato.sendBare(socket, wasPaused ? ACK : NAK);
                        break;
                    }
                }
            }

            if (state.lastPrinted && state.lastPrinted.epc !== printedBefore) {
                logger.info(`printed EPC ${state.lastPrinted.epc} (TID ${state.lastPrinted.tid})`);
            }
        };

        const handleData = async (data: Buffer): Promise<void> => {
            // Unwrap the Java ObjectOutputStream framing the client puts around each message before
            // frame splitting. Already-unframed bytes (and continuation chunks) pass through
            // unchanged; a record truncated by a packet boundary is forwarded verbatim and
            // reassembled here via `leftover`.
            const chunk: Buffer = sanitize(data);
            const combined: Buffer = leftover.length > 0 ? Buffer.concat([leftover, chunk]) : chunk;

            const { frames, rest } = splitFrames(combined);
            if (rest.length > MAX_LEFTOVER) {
                logger.warn("discarding unterminated data: exceeded leftover limit");
                leftover = Buffer.alloc(0);
            } else {
                leftover = rest;
            }

            // logger.info("Frames", frames);

            for (const frame of frames) {
                await handleFrame(frame);
            }
        };

        socket.on("data", (data: Buffer) => {
            logger.info("Received", data);
            queue = queue.then(() => handleData(data)).catch((err: unknown) => logger.error("error handling data", err));
        });

        socket.on("ready", () => {
            logger.info("connection ready");
        });

        socket.on("timeout", () => {
            logger.warn("socket timeout - closing connection");
            socket.end();
        });

        socket.on("end", () => {
            logger.info("client disconnected");
        });

        socket.on("close", (had_error: boolean) => {
            if (had_error) logger.warn("socket was closed due to a transmission error");
            else logger.info("socket successfully closed");
        });

        socket.on("error", (err: Error) => {
            logger.error(err);
        });
    });

    // the mock simulates a single printer; reject any additional connection
    server.maxConnections = 1;

    // server events
    server.on("close", () => logger.info("server closed"));

    return server;
};
