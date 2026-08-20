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
