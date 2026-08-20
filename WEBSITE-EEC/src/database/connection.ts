import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from './migrations'

let database: DatabaseSync | null = null

function databasePath(): string {
    const nodeProcess = globalThis.process as { env?: Record<string, string | undefined> } | undefined
    const configuredPath = nodeProcess?.env?.SQLITE_PATH

    if (!configuredPath) return resolve('data', 'app.sqlite')

    return isAbsolute(configuredPath) ? configuredPath : resolve(configuredPath)
}

export function getDatabase(): DatabaseSync {
    if (database) return database

    const filePath = databasePath()
    mkdirSync(dirname(filePath), { recursive: true })

    database = new DatabaseSync(filePath)
    database.exec('PRAGMA foreign_keys = ON')
    database.exec('PRAGMA busy_timeout = 5000')
    runMigrations(database)

    return database
}

export function initializeDatabase(): void {
    getDatabase()
}
