import { Hono } from 'hono'
import { getCursos, getDiferenciais, getEstatisticas, getEventos, getProfessores } from '../repositories/school.repository'

const schoolRoutes = new Hono()

schoolRoutes.get('/cursos', (c) => c.json(getCursos()))
schoolRoutes.get('/professores', (c) => c.json(getProfessores()))
schoolRoutes.get('/diferenciais', (c) => c.json(getDiferenciais()))
schoolRoutes.get('/estatisticas', (c) => c.json(getEstatisticas()))
schoolRoutes.get('/eventos', (c) => c.json(getEventos()))

export default schoolRoutes
