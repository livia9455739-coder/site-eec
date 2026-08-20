import type { Context } from 'hono'
import { errorBody, HttpError } from '../errors/http-error'
import { findFormulario, saveFormulario } from '../services/formulario.service'
import { readJsonBody } from '../utils/request'

const FORMULARIO_BODY_LIMIT_BYTES = 32 * 1024

export async function postFormulario(c: Context) {
    try {
        const body = await readJsonBody(c, FORMULARIO_BODY_LIMIT_BYTES)
        const result = await saveFormulario(body)

        return c.json(result.body, result.status)
    } catch (e) {
        if (e instanceof HttpError) {
            return c.json(errorBody(e.message), e.status)
        }

        return c.json(errorBody('Erro ao salvar dados.'), 500)
    }
}

export async function getFormulario(c: Context) {
    return c.json(await findFormulario())
}
