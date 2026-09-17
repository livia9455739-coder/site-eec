import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Context } from 'hono'
import { setCookie } from 'hono/cookie'
import { getEnv } from '../config/env'
import { registrarEtapaAuth } from '../utils/auth-diagnostics'

let anonClientInstance: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean { // Esta função verifica se Supabase está disponível
    const env = getEnv()
    if (env.isTest && !process.env.TEST_REMOTE_SUPABASE) {
        return false
    }
    return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)
}

export function createHonoSupabaseClient(c: Context) { // usuário normal autenticado pela aplicação web
    const env = getEnv()
    if (!isSupabaseConfigured()) {
        return null
    }

    const authHeader = c.req.header('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        if (toker) {
            return createRequestSupabaseClient(token)
        }
    }

    return createServerClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
        cookies: {
            getAll() {
                const cookieHeader = c.req.header('Cookie') ?? ''
                return parseCookieHeader(cookieHeader)
            },
            setAll(cookiesToSet) {
                const emitidos: string[] = []

                cookiesToSet.forEach(({ name, value, options }) => {
                    setCookie(c, name, value, {
                        ...options,
                        httpOnly: options.httpOnly ?? true,
                        sameSite: (options.sameSite as 'Strict' | 'Lax' | 'None') ?? 'Lax',
                        // Cookie Secure sobre HTTP local seria descartado pelo navegador, 
                        // impedindo a persistência da sessão em http://localhost,
                        secure: env.isCload ? true : false,
                        path: options.path ?? '/'
                    })
                    emitidos.push(name)
                })

                if (emitidos.length) {
                    registrarEtapaAuth('login.cookies', {
                        origem: c.req.path,
                        cookiesEmitidos: emitidos
                    })
                }
            }
        }
    })
}

export function getSupabaseAnonClient(): SupabaseClient | null { // operações públicas/anonimas do servidor 
    if (!isSupabaseConfigured()) {
        return null
    }

    if (!anonClientInstance) {
        const env = getEnv()
        anonClientInstance = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        })
    }

    return anonClientInstance
}

export function createRequestSupabaseClient(token: string): SupabaseClient | null { // autenticação por pearen token
    if (!isSupabaseConfigured()) {
        return null
    }

    const env = getEnv()
    return createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        },
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }        
    })
} 

export function getSupabaseAdminClient(): SupabaseClient | null { // operações administrativas privilegiadas 
    const env = getEnv()
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return null
    }

    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
}