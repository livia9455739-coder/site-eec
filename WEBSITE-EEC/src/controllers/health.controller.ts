import type { Context } from 'hono'

export function getHealth(c: Context ) {
    return c.json({ status: 'ok'}, 200)
}