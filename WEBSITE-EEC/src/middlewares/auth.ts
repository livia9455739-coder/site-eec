import type { Context, Next } from 'hono'
import { validateRequestSession } from '../services/auth.services'
import type { AuthUser, Role } from '../types/auth'

declare module 'hono' {
    interface ContextVariableMap {
        user: AuthUser 
        role: Role | null
    }
}

/**
 * Middleware de Autenticação da Central EEC.
 * Valida a sessão via cookies oficiais (@supabase/ssr ou eec_session local)
 * e aplica cabeçalhos estritos de controle de cache em todas as respostas autenticadas.
 */
export async function requireAuth(c: Context, next: Next) {
    const user = await validateRequestSession(c)

    if (!user) {
        const accept = c.req.header('Accept') || ''
        const isApi = c.req.path.startsWith('/api')
        if (accept.includes('text/html') || (!isApi && !accept.includes('application/json'))) {
            return c.redirect('/admin/login', 302)
        }
        return c.json({ error: 'Autenticação necessária.'}, 401)
    }

    if (!user.ativo) {
        return c.json({ error: 'Conta institucional desativada.' }, 403)
    }

    c.set('user', user)
    c.set('role', user.role)
    
    // Cabeçalhos mandatórios de prevenção de cache para dados autenticados
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    c.header('Pragma', 'no-cache')
    c.header('Expires', '0')

    await next()
}