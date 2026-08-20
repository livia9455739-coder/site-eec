import { z } from 'zod'
import { hasSuspiciousHtml, sanitizeText } from '../utils/sanitize'

const safeText = (field: string, max: number) => z
    .string({ error: `${field} deve ser texto.` })
    .trim()
    .max(max, `${field} excede o tamanho máximo.`)
    .refine((value) => !hasSuspiciousHtml(value), `${field} contém HTML ou script não permitido.`)
    .transform(sanitizeText)

const optionalText = (field: string, max: number) => safeText(field, max).optional().default('')

const requiredText = (field: string, min: number, max: number) => z
    .string({ error: `${field} deve ser texto.` })
    .trim()
    .min(min, `${field} é obrigatório.`)
    .max(max, `${field} excede o tamanho máximo.`)
    .refine((value) => !hasSuspiciousHtml(value), `${field} contém HTML ou script não permitido.`)
    .transform(sanitizeText)

const emailField = z
    .string({ error: 'E-mail deve ser texto.' })
    .trim()
    .max(254, 'E-mail excede o tamanho máximo.')
    .refine((value) => value === '' || z.email().safeParse(value).success, 'E-mail inválido.')
    .refine((value) => !hasSuspiciousHtml(value), 'E-mail contém conteúdo não permitido.')
    .transform(sanitizeText)
    .optional()
    .default('')

const urlField = z
    .string({ error: 'URL deve ser texto.' })
    .trim()
    .max(300, 'URL excede o tamanho máximo.')
    .refine((value) => value === '' || z.url().safeParse(value).success, 'URL inválida.')
    .refine((value) => !hasSuspiciousHtml(value), 'URL contém conteúdo não permitido.')
    .transform(sanitizeText)
    .optional()
    .default('')

const cursoSchema = z.object({
    nome: requiredText('Nome do curso', 1, 120),
    idade: optionalText('Faixa etária', 60),
    descricao: optionalText('Descrição do curso', 800),
    turno: optionalText('Turno', 80)
}).strip()

const professorSchema = z.object({
    nome: requiredText('Nome do professor', 1, 120),
    cargo: optionalText('Cargo do professor', 160),
    bio: optionalText('Biografia do professor', 800)
}).strip()

const depoimentoSchema = z.object({
    nome: requiredText('Nome do depoimento', 1, 120),
    relacao: optionalText('Relação do depoimento', 120),
    texto: optionalText('Texto do depoimento', 1000)
}).strip()

const eventoSchema = z.object({
    titulo: requiredText('Título do evento', 1, 160),
    data: optionalText('Data do evento', 80),
    tipo: optionalText('Tipo do evento', 60),
    descricao: optionalText('Descrição do evento', 800)
}).strip()

export const formularioSchema = z.object({
    nome_escola: optionalText('Nome da escola', 160),
    slogan: optionalText('Slogan', 220),
    ano_fundacao: optionalText('Ano de fundação', 20),
    descricao_escola: optionalText('Descrição da escola', 2000),
    missao: optionalText('Missão', 1200),
    visao: optionalText('Visão', 1200),
    valores: optionalText('Valores', 1200),
    endereco: optionalText('Endereço', 240),
    bairro: optionalText('Bairro', 120),
    cidade: optionalText('Cidade', 120),
    estado: optionalText('Estado', 80),
    cep: optionalText('CEP', 20),
    telefone: optionalText('Telefone', 40),
    telefone2: optionalText('Telefone secundário', 40),
    whatsapp: optionalText('WhatsApp', 40),
    email: emailField,
    email_matriculas: emailField,
    horario_atendimento: optionalText('Horário de atendimento', 160),
    facebook: urlField,
    instagram: urlField,
    youtube: urlField,
    linkedin: urlField,
    site: urlField,
    num_alunos: optionalText('Número de alunos', 30),
    num_professores: optionalText('Número de professores', 30),
    taxa_aprovacao: optionalText('Taxa de aprovação', 30),
    nota_enem: optionalText('Nota ENEM', 30),
    area_escola: optionalText('Área da escola', 40),
    cor_primaria: optionalText('Cor primária', 40),
    cor_secundaria: optionalText('Cor secundária', 40),
    diferenciais: optionalText('Diferenciais', 2000),
    infraestrutura: optionalText('Infraestrutura', 2000),
    niveis_ensino: z.array(safeText('Nível de ensino', 80)).max(20, 'Muitos níveis de ensino.').optional().default([]),
    cursos: z.array(cursoSchema).max(20, 'Muitos cursos informados.').optional().default([]),
    professores: z.array(professorSchema).max(50, 'Muitos professores informados.').optional().default([]),
    depoimentos: z.array(depoimentoSchema).max(30, 'Muitos depoimentos informados.').optional().default([]),
    eventos: z.array(eventoSchema).max(50, 'Muitos eventos informados.').optional().default([])
}).strip()

export type FormularioPayload = z.infer<typeof formularioSchema>
