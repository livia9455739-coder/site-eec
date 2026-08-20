import pg from 'pg'

const { Pool } = pg

const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS contatos (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    assunto TEXT,
    mensagem TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formularios (
    id BIGSERIAL PRIMARY KEY,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contatos_created_at
    ON contatos(created_at);

CREATE INDEX IF NOT EXISTS idx_formularios_created_at
    ON formularios(created_at);
`

type QueryParams = Array<string | number | boolean | null | object>

interface GlobalPostgresState {
    pool?: pg.Pool
    schemaReady?: Promise<void>
}

const globalState = globalThis as typeof globalThis & {
    __websiteEecPostgres?: GlobalPostgresState
}

function state(): GlobalPostgresState {
    globalState.__websiteEecPostgres ??= {}
    return globalState.__websiteEecPostgres
}

export function hasPostgresConfig(): boolean {
    return Boolean(process.env.DATABASE_URL)
}

function sslConfig(connectionString: string) {
    const sslMode = process.env.PGSSLMODE

    if (sslMode === 'disable') return false
    if (sslMode === 'require' || sslMode === 'no-verify') {
        return { rejectUnauthorized: false }
    }

    try {
        const url = new URL(connectionString)
        const urlSslMode = url.searchParams.get('sslmode')
        if (urlSslMode === 'require' || urlSslMode === 'no-verify') {
            return { rejectUnauthorized: false }
        }
    } catch (e) {
        return undefined
    }

    return undefined
}

export function getPostgresPool(): pg.Pool {
    const currentState = state()
    if (currentState.pool) return currentState.pool

    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
        throw new Error('DATABASE_URL nao configurada.')
    }

    currentState.pool = new Pool({
        connectionString,
        max: Number(process.env.PG_POOL_MAX ?? 1),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        ssl: sslConfig(connectionString)
    })

    return currentState.pool
}

export async function ensurePostgresSchema(): Promise<void> {
    const currentState = state()

    currentState.schemaReady ??= getPostgresPool()
        .query(POSTGRES_SCHEMA_SQL)
        .then(() => undefined)

    return currentState.schemaReady
}

export async function queryPostgres<T extends pg.QueryResultRow>(
    text: string,
    params: QueryParams = []
): Promise<pg.QueryResult<T>> {
    await ensurePostgresSchema()
    return getPostgresPool().query<T>(text, params)
}

export const postgres = {
    pool: getPostgresPool,
    query: queryPostgres,
    ensureSchema: ensurePostgresSchema
}
