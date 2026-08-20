import type { DatabaseSync } from 'node:sqlite'

export function runMigrations(database: DatabaseSync): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS contatos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL,
            telefone TEXT,
            assunto TEXT,
            mensagem TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS formularios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_contatos_created_at
            ON contatos(created_at);

        CREATE INDEX IF NOT EXISTS idx_formularios_created_at
            ON formularios(created_at);
    `)
}
