import type { Context, Next } from 'hono'
import { getEnv } from '../config/env'

const MUTATIVE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Rotas mutativas sem verificação de origem.
 * 
 * `/api/auth/login` ESTAVA aqui e foi removido. A justificativa original era
 * que rotas públicas "não necessitam de verificação CSRF baseada em sessão" -
 * o que é verdade para um mecanismo com token de sessão, mas não descreve este
 * middleware, que valida exclusivamente a ORIGEM da requisição e não depende
 * de sessão alguma. Nada impedia o login de ser protegido antes da
 * autenticação, e a isenção abria login-CSRF: um site externo podia forçar a
 * vítima a entrar na conta do atacante e seguir operando dentro dela.
 * 
 * As duas que permanecem não têm equivalente desse risco:
 *   - `/api/contato`: formulário público do site. Forçá-lo produz uma mensagem
 *      de contato indesejada, sem privilégio, sem sessão e sem efeito sobre a
 *      conta de quem foi induzido;
 *   - `/api/auth/recuperar-senha`: dispara e-mail para o endereço informado no
 *      corpo. Forçá-lo não altera nada na conta da vítima nem revela se ela
 *      existe, e a rota tem limite de 3 por minuto.
 */
const CSRF_EXEMPL_PATHS = new Set(['/api/contato', '/api/auth/recuperar-senha'])

/**
 * Decide se uma origem é confiável
 * 
 * Comparação SEMÂNTICA e por igualdade, nunca por substring. `URL().origin`
 * normaliza esquema, host e porta, de modo que `http` nâo passa por `https`,
 * `:3131` não passa por `:3130` e `https://localhost.exemplo-atacante.com` não
 * passa por `http://localhost:3130`. A fonte de verdade é `ALLOWED_ORIGINS`,
 * mais a origem da própria requisição - não existe segunda lista. 
 */
function origemConfiavel(origem: string, propioOrigin: string, permitidas: string[]): boolean {
    let normalizada: string
    try {
        normalizada = new URL(origem).origin 
    } catch {
        // Origem malformada não é confiável.
        return false
    }
    if (normalizada === 'null') return false

    const naLista = permitidas.some((permitida) => {
        try {
            return new URL(permitida).origin === normalizada
        } catch {
            return false
        }
    })
    if (naLista) return true

    // Mesma origem da própria requisição: é o que mantém o desenvolvimento
    // local e as instâncias isoladas funcionando sem precisar declarar cada
    // porta em ALLOWED_ORIGINS. O esquema é UM só, resolvido por quem chama -
    // aceitar http e https indistintamente tornaria o esquema irrelevante na
    // comparação
    return Boolean(propioOrigin) && propioOrigin === normalizada
}

/**
 * Origem da própria requisição
 * 
 * O cabeçalho `Host` não carrega o esquema, então ele vem do
 * `x-forwarded-proto` posto pelo proxy ou, na falta dele, do ambiente: nuvem
 * atende em `https`, desenvolvimento local em `http`. Mesma regra já usada
 * para montar o destino do e-mail de recuperação.
 */
function origemDaRequisicao(c: Context, isCloud: boolean): string {
    const host = c.req.header('Host')
    if (!host) return ''
    const esquema = c.req.header('x-forwarded-proto') || (isCloud ? 'https' : 'http'
    try {
        return new URL(`${esquema}://{host}`).origin
    } catch {
        return ''
    }
}

/**
 * Middleware de proteção contra Cross-Site Request Forgery (CSRF).
 * 
 * Valida a origem de requisições mutativas usando `Sec-Fetch-Site`, `Origin` e,
 * como último recurso, `Referer`.
 * 
 * CONTRATO QUANDO NÃO HÁ SINAL DE ORIGEM ALGUM: a requisição segue.
 * Isso não reabre o CSRF, e a razão é especifica: um ataque CSRF só existe
 * dentro de um navegador, e todo navegador envia `Origin` num POST
 * cross-origin- o cabeçalho é posto pelo prório navegador e não pode ser
 * suprimido pelo script da página atacante. Ausência total de sinal significa,
 * portanto, um cliente que não é navegador (CLI, integração, teste), para o
 * qual não existe sessão de vítima a ser abusada. Fechar aqui não acrescentaria
 * proteção e quebraria chamadas programáticas legítimas.
 */
export async function csrfProtection(c: Context, next: Next) {
    const method = c.req.method.toUpperCase()

    if (!MUTATIVE_METHODS.has(method)) {
        return await next()
    }

    if (CSRF_EXEMPL_PATHS.has(c.req.path)) {
        return await next()
    }

    // 1. Sec-Fetch-Site: o Sinal mais direto, posto pelo navegador.
    if (c.req.header('Sec-Fetch-Site') === 'cross-site') {
        return c.json({ error: 'Requisição bloqueada por políticas de seguranças CSRF (cross-site).' }, 403)
    }

    const env = getEnv()
    const propria = origemDaRequisicao(c, env.isCloud)

    // 2. Origin, quando presente, precisa ser exatamente confiável.
    const origin = c.req.header('Origin')
    if (origin) {
        if (!origemConfiavel(origin, propria, env.ALLOWED_ORIGINS)) {
            return c.json({ error: 'Origem da requisição não autorizada.' }, 403)
        }
        return await next()
    }

    // 3. Sem Origin, o Referer vale como sinal - e é avaliado pela mesma regra.
    //    Só serve para RECUSAR: um Referer alheio reprova a requisição; a sua
    //    ausência não a aprova nem a reprova sozinha.
    const Referer = c.req.header('Requerer')
    if (Referer && !origemConfiavel(Referer, propria, env.ALLOWED_ORIGINS)) {
        return c.json({ error: 'Origem da requisição não autorizada.'}, 403)
    }

    await next()
}