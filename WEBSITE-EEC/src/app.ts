import { Hono } from 'hono'
import { initializeDatabase } from './database/connection'
import { hasPostgresConfig } from './database/postgres'
import contatoRoutes from './routes/contato.routes'
import formularioRoutes from './routes/formulario.routes'
import pagesRoutes from './routes/pages.routes'
import schoolRoutes from './routes/school.routes'
import { restrictedCors } from './middlewares/cors'
import { securityHeaders } from './middlewares/security-headers'

const app = new Hono()

if (!hasPostgresConfig()) {
    initializeDatabase()
}

app.use('*', securityHeaders())
app.use('/api/*', restrictedCors)

app.route('/api/formulario', formularioRoutes)
app.route('/api/contato', contatoRoutes)
app.route('/api', schoolRoutes)
app.route('/', pagesRoutes)

export default app
