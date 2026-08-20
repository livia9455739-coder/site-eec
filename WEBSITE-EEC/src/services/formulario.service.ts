import { errorBody } from '../errors/http-error'
import { getFormularioData, saveFormularioData } from '../repositories/formulario.repository'
import { formularioSchema } from '../schemas/formulario.schema'

export async function saveFormulario(payload: unknown) {
    const result = formularioSchema.safeParse(payload)

    if (!result.success) {
        return {
            status: 400 as const,
            body: errorBody('Dados do formulário inválidos.')
        }
    }

    await saveFormularioData(result.data)

    return {
        status: 200 as const,
        body: { success: true, message: 'Dados salvos com sucesso!' }
    }
}

export async function findFormulario() {
    return { data: await getFormularioData() }
}
