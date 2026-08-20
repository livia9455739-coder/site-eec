import { errorBody } from '../errors/http-error'
import { saveContact } from '../repositories/contato.repository'
import { contatoSchema } from '../schemas/contato.schema'

export async function processContact(payload: unknown) {
    const result = contatoSchema.safeParse(payload)

    if (!result.success) {
        return {
            status: 400 as const,
            body: errorBody('Dados de contato inválidos.')
        }
    }

    await saveContact(result.data)

    return {
        status: 200 as const,
        body: {
            success: true,
            message: 'Mensagem enviada com sucesso! Entraremos em contato em breve.'
        }
    }
}
