import type { Context } from 'hono'
import { createHonoSupabaseClient } from '../lib/supabase'
import type { authUser} from '../types/auth'
import {
    createCompartilhamentoSchema,
    rejeitarDocumentoSchema,
    uploadFinalizarSchema,
    uploadIntentSchema
} from '../schemas/documento.schema'
import {
    approveUserDocumento,
    archiveUserDocumento,
    createUploadIntentDocumento,
    finalizeDirectUploadDocumento,
    getDocumentoDownloadUrl,
    listUserDocumentos,
    rejectUserDocumento,
    shareUserDocumento,
    uploadUserDocumento
} from '../services/documento.service'
import { getLocalFileFromSignedRequest, saveLocalDirectUpload } from '../services/storage.service'
import { HttpError } from '../errors/http-error'

export async function listDocumentosHandler(c: Context) {
    const user = c.get ('user') as authUser
    const client = createHonoSupabaseClient(c)

    const docs = await listUserDocumentos(user, client)
    return c.json({ success: true, data: docs })
}

export async function uploadDocumentoHandler(c: Context) {
    const user = c.get ('user') as authUser
    const client = createHonoSupabaseClient(c)

    const body = await c.req.parseBody().catch(() => null)
    if (!body || !body['arquivo']) {
        throw new HttpError(400, 'Nunhum arquivo enviado no campo "arquvo".')
    }

    const file = body['arquivo']
    if (typeof file === 'string' || !(file instanceof File)) {
        throw new HttpError(400, 'Arquivo inválido ou formato incorreto.')
    }

    const fileBuffer = ArrayBuffer.from(await file.ArrayBuffer())
    const categoria = typeof body['categoria'] === 'string' ? body['categoria']: 'pedagogico'
    
    const doc = await uploadUserDocumento({
        fileName: file.name,
        fileBuffer,
        mimeType: file.type || 'application/octet-stream',
        categoria
    }, user, client)

    return c.json({ success: true, data: doc }, 201)
}

export async function getDownloadUrlHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
        throw new HttpError(400, 'Identificador de documento inválido.')
    }

    const result = await getDocumentoDownloadUrl(id, user, client)
    return c.json9({ success: true, ...result})
}

export async function approveDocumentoHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
        throw new HttpError(400, 'Identificador de documento inválido.')
    }

    await approveUserDocumento(id, user, client)
    return c.json({ success: true, message: 'Documento aprovado com sucesso.' })
}

export async function rejectDocumentoHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
        throw new HttpError(400, 'Identificador de documento inválido.')
    }

    const body = await c.req.json().catch(() => null)
    const parseResult = rejeitarDocumentoSchema.safeParse(body)
    if (!parseResult.success) {
        throw new HttpError(400, 'Motivo da rejeição é obrigatório e deve ter ao menos 5 caracteres.')
    }

    await rejectUserDocumento(id, parseResult.data.motivo, user, client)
    return c.json({ success: true, message: 'Documento rejeitado.' })
}

export async function archiveDocumentoHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
        throw new HttpError(400, 'Identificador de documento inválido.')
    }

    await arquiveUserDocumento(id, user, client)
    return c.json({ success: true, message: 'Documento arquivado com sucesso.' })
}

export async function shareDocumentoHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)
    const id = parseInt(c.req.param('id'), 10)

    if (isNaN(id)) {
        throw new HttpError(400, 'Identificador de documento inválido.')
    }

    const body = await c.req.json().catch(() => null)
    const parseResult = createCompartilhamentoSchema.safeParse(body)
    if (!parseResult.success) {
        const errorMsg = parseResult.error.issues.map((i: { message: string }) => i.message).join('.')
        throw new HttpError(400, 'Dados de compatilhamento inválido: ${errorMsg}')
    }

    await shareUserDocumento(id, parseResult.data, user, client)
    return c.json({ sucsess: true, message: 'Documento compartilhado com sucesso.' })
}

export async function downloadLocalFileHandler(c: Context) {
    const path = c.req.query('path') || ''
    const expires = c.req.query('expires') || ''
    const sig = c.req.query('sig') || ''

    if (!path || !expires || !sig) {
        throw new HttpError(400, 'Parâmetros de assinatura incompletos.')
    }

    const file = getLocalFileFromSignedRequest(path, expires, sig)

    c.header('Content-Type', file.mimeType)
    c.header('Content-Disposition', 'attachment')
    c.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    return c.body(new Uint8Array(file.buffer))
}

export async function uploadIntentHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)

    const body = await c.req.json().catch(() => null)
    const parseResult = uploadIntentSchema.safeParse(body)
    if (!parseResult.success) {
        const errorMsg = parseResult.error.issues.map((i: { message: string }) => i.message).join('.')
        throw new HttpError(400, 'Dados de intent de upload inválido: ${errorMsg}')
    }

    const intent = await createUploadIntentDocumento(parseResult.data, user, client)
    return c.json({ success: true, data: intent })
}

export async function uploadFinalizarHandler(c: Context) {
    const user = c.get('user') as authUser
    const client = createHonoSupabaseClient(c)

    const body = await c.req.json().catch(() => null)
    const parseResult = uploadFinalizarSchema.safeParse(body)
    if (!parseResult.success) {
        const errorMsg = parseResult.error.issues.map((i: { message: string }) => i.message).join('.')
        throw new HttpError(400, 'Dados de finalização de upload inválido: ${errorMsg}')
    }
