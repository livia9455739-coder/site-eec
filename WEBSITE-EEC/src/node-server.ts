import 'dotenv/config'

import { existsSync } from 'node-fs'
import { resolve } from 'node-path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import app from './app'

function configuredPort(): number {
    const value = Number(process.env.PORT ?? 3000)
    return Number.isInteger(value) && value > 0 ? value : 3000
}

function publicRoot(): string {
    const productionPublic = resolve('dist', 'public')
    return existsSync(productionPublic) ? './dist/public' : './public'
}

const server = new Hono()
const staticRoot = publicRoot()

server.use(
    '/static/*',
    serveStatic({
        root: staticRoot,
        onFound: (_path, c) => {
            c.header('Cache-Control', 'public, max-age=31536000, immutable')
        }
    })
)

server.use(
    '/static/*',
    serveStatic({
        root: staticRoot,
        onFound: (_path, c) => {
            c.header('Cache-Control', 'public, max-age=31536000, immutable')
        }
    })
)

server.route('*', app)

const port = configuredPort()

serve(
    {
        fetch: server.fetch,
        port
    },
    (info) => {
        console.log(`Server running at http://localhost:${info.port}`)
    }
)