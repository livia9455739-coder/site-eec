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