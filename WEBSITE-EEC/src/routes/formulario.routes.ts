import { Hono } from 'hono'
import { getFormulario, postFormulario } from '../controllers/formulario.controller'
import { rateLimit } from '../middlewares/rate-limit'

const formularioRoutes = new Hono()

formularioRoutes.post('/', rateLimit({ maxRequests: 10, windowMs: 60_000 }), postFormulario)
formularioRoutes.get('/', getFormulario)

export default formularioRoutes
