import { Hono } from 'hono'
import { postContato } from '../controllers/contato.controller'
import { rateLimit } from '../middlewares/rate-limit'

const contatoRoutes = new Hono()

contatoRoutes.post('/', rateLimit({ maxRequests: 10, windowMs: 60_000 }), postContato)

export default contatoRoutes
