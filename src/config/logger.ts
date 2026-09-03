type LogLevel = "INFO" | "WARN" | "ERROR";

/** Renders an Error argument as its stack trace so a trace always prints when one is logged. */
const render = (arg: unknown): unknown => (arg instanceof Error ? (arg.stack ?? `${arg.name}: ${arg.message}`) : arg);

const emit = (level: LogLevel, write: (...args: unknown[]) => void, args: unknown[]): void => {
    write(`${new Date().toISOString()} ${level}`, ...args.map(render));
};

/** Thin wrapper over `console` that prefixes every line with an ISO timestamp and level. */
export const logger = {
    info: (...args: unknown[]): void => emit("INFO", console.log, args),
    warn: (...args: unknown[]): void => emit("WARN", console.warn, args),
    error: (...args: unknown[]): void => emit("ERROR", console.error, args),
};
