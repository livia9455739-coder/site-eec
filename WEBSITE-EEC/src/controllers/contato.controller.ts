import type { Context } from 'hono'
import { errorBody, HttpError } from '../errors/http-error'
import { processContact } from '../services/contato.service'
import { readJsonBody } from '../utils/request'

const CONTATO_BODY_LIMIT_BYTES = 8 * 1024

export async function postContato(c: Context) {
    try {
        const body = await readJsonBody(c, CONTATO_BODY_LIMIT_BYTES)
        const result = await processContact(body)

        return c.json(result.body, result.status)
    } catch (e) {
        if (e instanceof HttpError) {
            return c.json(errorBody(e.message), e.status)
        }

        return c.json(errorBody('Erro ao processar a mensagem.'), 500)
    }
}
