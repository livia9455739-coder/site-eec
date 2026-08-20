import type { MiddlewareHandler } from 'hono'
import { errorBody } from '../errors/http-error'

interface RateLimitOptions {
    maxRequests: number
    windowMs: number
}

interface RateLimitEntry {
    count: number
    resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

function getClientIp(headers: Headers): string {
    return (
        headers.get('cf-connecting-ip') ||
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip') ||
        'unknown'
    )
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
    return async (c, next) => {
        const now = Date.now()
        const ip = getClientIp(c.req.raw.headers)
        const key = `${ip}:${c.req.path}`
        const current = buckets.get(key)

        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + options.windowMs })
            await next()
            return
        }

        if (current.count >= options.maxRequests) {
            const retryAfter = Math.ceil((current.resetAt - now) / 1000)
            c.header('Retry-After', String(retryAfter))
            return c.json(errorBody('Muitas requisições. Tente novamente mais tarde.'), 429)
        }

        current.count += 1
        await next()
    }
}
