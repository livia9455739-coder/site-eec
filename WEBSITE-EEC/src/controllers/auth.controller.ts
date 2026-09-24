import type { context } from 'hono'
import { httpError } from '../errors/http-error'
import { createHonoSupabaseClient } from '../lib/supabase'
import { updateProfileName } from '../repositories/user.repository'
import { authenticateWithPassword, requestPasswordReset, terminateSession } from '../services/auth.service'
import { readJsonBody } from '../utils/request'

export async function postLogin(c: Context) { // cria e exporta a função responsável pelo login
    try {
        const body = (await readJsonBody(c, 4 * 1024)) as { email?: string; password?: string }
        const email = body?.email?.trim() || ''
        const password = body?.password || ''

        const { user } = await authenticateWithPassword(c, email, password)

        // A sessão é estabelecida por cookis HttpOnly seguros gerenciados pelo servidor.
        // Nenhum token de acesso é exposto no corpo do payload JSON.
        return c.json({
            sucess: true,
            user
        })
    } catch (err) {
        if (err instanceof HttpError) {
            return c.json({ error: err.message }, err.status)
        }
        return c.json({error: 'Erro ao processar autenticação.'}, 500)
    }
}