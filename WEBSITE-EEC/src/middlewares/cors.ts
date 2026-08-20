import type { Context } from 'hono'
import { cors } from 'hono/cors'

function configuredOrigins(c: Context): string[] {
    const nodeProcess = globalThis.process as { env?: Record<string, string | undefined> } | undefined
    const value =
        c.env?.ALLOWED_ORIGIN ||
        c.env?.ALLOWED_ORIGINS ||
        nodeProcess?.env?.ALLOWED_ORIGIN ||
        nodeProcess?.env?.ALLOWED_ORIGINS ||
        ''

    return String(value)
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
}

function requestOrigin(c: Context): string {
    const url = new URL(c.req.url)
    return `${url.protocol}//${url.host}`
}

export const restrictedCors = cors({
    origin: (origin, c) => {
        if (!origin) return undefined

        const allowedOrigins = new Set([
            requestOrigin(c),
            ...configuredOrigins(c)
        ])

        return allowedOrigins.has(origin) ? origin : undefined
    }
})
