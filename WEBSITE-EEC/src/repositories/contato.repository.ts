import { getDatabase } from '../database/connection'
import { hasPostgresConfig, queryPostgres } from '../database/postgres'
import type { ContactPayload } from '../schemas/contato.schema'

export async function saveContact(data: ContactPayload): Promise<number> {
    if (hasPostgresConfig()) {
        const result = await queryPostgres<{ id: string }>(
            `
                INSERT INTO contatos (
                    nome,
                    email,
                    telefone,
                    assunto,
                    mensagem
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `,
            [
                data.nome,
                data.email,
                data.telefone || null,
                data.assunto || null,
                data.mensagem
            ]
        )

        return Number(result.rows[0]?.id)
    }

    const database = getDatabase()
    const result = database
        .prepare(`
            INSERT INTO contatos (
                nome,
                email,
                telefone,
                assunto,
                mensagem
            ) VALUES (?, ?, ?, ?, ?)
        `)
        .run(
            data.nome,
            data.email,
            data.telefone || null,
            data.assunto || null,
            data.mensagem
        )

    return Number(result.lastInsertRowid)
}
