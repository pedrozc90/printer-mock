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

export interface Tag {
    epc: string | null;
    size: string | null;
    size_es?: string | null;
    description: string | null;
    description_es?: string | null;
    sku: string | null;
}

export interface ReceivedData {
    content: string;
    epcs?: string[];
}