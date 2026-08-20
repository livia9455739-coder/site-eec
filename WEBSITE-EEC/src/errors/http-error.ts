import type { StatusCode } from 'hono/utils/http-status'

export class HttpError extends Error {
    constructor(
        public readonly status: StatusCode,
        message: string
    ) {
        super(message)
        this.name = 'HttpError'
    }
}

export function errorBody(message: string) {
    return { error: message }
}
