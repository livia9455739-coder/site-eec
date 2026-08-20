import type { Context } from 'hono'
import { HttpError } from '../errors/http-error'

const textEncoder = new TextEncoder()

export async function readJsonBody(c: Context, maxBytes: number): Promise<unknown> {
    const contentLength = c.req.header('content-length')
    const declaredLength = contentLength ? Number(contentLength) : undefined

    if (declaredLength && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new HttpError(413, 'Payload muito grande.')
    }

    const rawBody = await c.req.text()

    if (textEncoder.encode(rawBody).byteLength > maxBytes) {
        throw new HttpError(413, 'Payload muito grande.')
    }

    try {
        return JSON.parse(rawBody)
    } catch (e) {
        throw new HttpError(400, 'JSON inválido.')
    }
}
