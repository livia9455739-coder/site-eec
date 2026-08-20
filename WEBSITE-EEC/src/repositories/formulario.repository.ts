import type { FormularioPayload } from '../schemas/formulario.schema'
import { getDatabase } from '../database/connection'
import { hasPostgresConfig, queryPostgres } from '../database/postgres'

interface FormularioRow {
    payload_json: string | FormularioPayload
}

export async function saveFormularioData(data: FormularioPayload): Promise<number> {
    if (hasPostgresConfig()) {
        const result = await queryPostgres<{ id: string }>(
            'INSERT INTO formularios (payload_json) VALUES ($1::jsonb) RETURNING id',
            [JSON.stringify(data)]
        )

        return Number(result.rows[0]?.id)
    }

    const database = getDatabase()
    const result = database
        .prepare('INSERT INTO formularios (payload_json) VALUES (?)')
        .run(JSON.stringify(data))

    return Number(result.lastInsertRowid)
}

export async function getFormularioData(): Promise<FormularioPayload | null> {
    if (hasPostgresConfig()) {
        const result = await queryPostgres<FormularioRow>(
            'SELECT payload_json FROM formularios ORDER BY id DESC LIMIT 1'
        )
        const row = result.rows[0]

        if (!row) return null

        return typeof row.payload_json === 'string'
            ? JSON.parse(row.payload_json) as FormularioPayload
            : row.payload_json
    }

    const database = getDatabase()
    const row = database
        .prepare('SELECT payload_json FROM formularios ORDER BY id DESC LIMIT 1')
        .get() as FormularioRow | undefined

    if (!row) return null

    try {
        return JSON.parse(row.payload_json) as FormularioPayload
    } catch (e) {
        return null
    }
}
