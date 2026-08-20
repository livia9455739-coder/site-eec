import { z } from 'zod'
import { hasSuspiciousHtml, sanitizeText } from '../utils/sanitize'

const safeRequiredText = (field: string, min: number, max: number) => z
    .string({ error: `${field} deve ser texto.` })
    .trim()
    .min(min, `${field} é obrigatório.`)
    .max(max, `${field} excede o tamanho máximo.`)
    .refine((value) => !hasSuspiciousHtml(value), `${field} contém conteúdo não permitido.`)
    .transform(sanitizeText)

const safeOptionalText = (field: string, max: number) => z
    .string({ error: `${field} deve ser texto.` })
    .trim()
    .max(max, `${field} excede o tamanho máximo.`)
    .refine((value) => !hasSuspiciousHtml(value), `${field} contém conteúdo não permitido.`)
    .transform(sanitizeText)
    .optional()

export const contatoSchema = z.object({
    nome: safeRequiredText('Nome', 2, 120),
    email: z
        .string({ error: 'E-mail deve ser texto.' })
        .trim()
        .email('E-mail inválido.')
        .max(254, 'E-mail excede o tamanho máximo.')
        .refine((value) => !hasSuspiciousHtml(value), 'E-mail contém conteúdo não permitido.')
        .transform(sanitizeText),
    telefone: safeOptionalText('Telefone', 40),
    assunto: safeOptionalText('Assunto', 160),
    mensagem: safeRequiredText('Mensagem', 5, 2000)
}).strip()

export type ContactPayload = z.infer<typeof contatoSchema>
