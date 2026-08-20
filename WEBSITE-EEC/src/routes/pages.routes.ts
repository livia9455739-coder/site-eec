import { Hono } from 'hono'
import { renderFormularioPage } from '../views/formulario'
import { renderHomePage } from '../views/home'

const pagesRoutes = new Hono()

pagesRoutes.get('/', (c) => c.html(renderHomePage()))
pagesRoutes.get('/formulario', (c) => c.html(renderFormularioPage()))

export default pagesRoutes
