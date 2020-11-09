export interface ServerError extends Error {
    name: string;
    message: string;
    stack?: string;

    code?: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
}
