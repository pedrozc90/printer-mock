import { Server, AddressInfo } from "net";

export function normalizeInt(value?: string): number | undefined {
    if (!value) return;

    let result: number = parseInt(value);

    if (isNaN(result)) {
        return;
    }

    return result;
}

export function formatAddress(info: AddressInfo | string | null): string {
    if (!info) {
        throw new Error("Address not found.");
    };
    return typeof info === "string" ? info : `${info.address}:${info.port}`;
}

/**
 * Event listener for HTTP server "error" event.
 * @param error
 */
export function onError(server: Server): (error: any) => void {
    let info = server.address();
    let port = (!info) ? "???" : (typeof info === "string") ? info : info.port;

    return function(error: any): (error: any) => void {
        if (error.syscall !== "listen") {
            throw error;
        }

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case "EACCES":
                console.error(`Port ${port} requires elevated privileges`);
                process.exit(1);
                // break;
            case "EADDRINUSE":
                console.error(`Port ${port} is already in use`);
                process.exit(1);
                // break;
            default:
                throw error;
        }
    }
}

/**
 * Verify if a value exists.
 * @param t                                 -- data.
 */
export function isNotEmpty<T>(t: T | undefined | null): t is T {
    return !!t;
}
