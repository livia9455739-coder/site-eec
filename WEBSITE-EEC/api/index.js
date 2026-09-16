// src/serverless.ts
import { getRequestListener } from "@hono/node-server";

// src/app.ts
import { Hono as Hono12 } from "hono";

// src/routes/admin.routes.ts
import { Hono } from "hono";

// src/errors/http-error.ts
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
  status;
};
function errorBody(message) {
  return { error: message };
}

// src/lib/supabase.ts
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { setCookie } from "hono/cookie";

// src/config/env.ts
import { z } from "zod";
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  PORT: z.coerce.number().int().positive().default(3e3),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url("DATABASE_URL deve ser uma URL v\xE1lida.").optional(),
  PG_POOL_MAX: z.coerce.number().int().positive().default(1),
  PGSSLMODE: z.enum(["require", "verify-full", "verify-ca", "disable"]).optional(),
  SQLITE_PATH: z.string().default("./data/app.sqlite"),
  APP_VERSION: z.string().default("2.0.0"),
  SUPABASE_URL: z.string().url("SUPABASE_URL deve ser uma URL v\xE1lida.").optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional()
});
function computeAppEnv(nodeEnv, vercelEnv) {
  if (vercelEnv === "preview") {
    return "preview";
  }
  if (vercelEnv === "production" || nodeEnv === "production") {
    return "production";
  }
  if (nodeEnv === "test") {
    return "test";
  }
  return "development";
}
function validateEnv(rawEnv = process.env) {
  const parseResult = envSchema.safeParse(rawEnv);
  if (!parseResult.success) {
    const formattedErrors = parseResult.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Configura\xE7\xE3o de ambiente inv\xE1lida: ${formattedErrors}`);
  }
  const {
    NODE_ENV,
    VERCEL_ENV,
    PORT,
    ALLOWED_ORIGINS,
    DATABASE_URL,
    PG_POOL_MAX,
    PGSSLMODE,
    SQLITE_PATH,
    APP_VERSION
  } = parseResult.data;
  const APP_ENV = computeAppEnv(NODE_ENV, VERCEL_ENV);
  const isProduction = APP_ENV === "production";
  const isPreview = APP_ENV === "preview";
  const isDevelopment = APP_ENV === "development";
  const isTest = APP_ENV === "test";
  const isCloud = isProduction || isPreview;
  if (isCloud && !DATABASE_URL) {
    throw new Error(
      `DATABASE_URL \xE9 obrigat\xF3ria no ambiente "${APP_ENV}". O uso de SQLite n\xE3o \xE9 permitido em produ\xE7\xE3o ou preview.`
    );
  }
  if (isCloud) {
    if (PGSSLMODE === "disable") {
      throw new Error(
        `Conex\xE3o sem SSL (PGSSLMODE=disable) \xE9 estritamente proibida no ambiente "${APP_ENV}". Utilize "require" ou "verify-full".`
      );
    }
    if (DATABASE_URL) {
      try {
        const parsedUrl = new URL(DATABASE_URL);
        if (parsedUrl.searchParams.get("sslmode") === "disable") {
          throw new Error(
            `Conex\xE3o sem SSL (sslmode=disable na DATABASE_URL) \xE9 estritamente proibida no ambiente "${APP_ENV}".`
          );
        }
      } catch (err) {
        if (err.message?.includes("estritamente proibida")) {
          throw err;
        }
      }
    }
  }
  const parsedOrigins = ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
  return {
    NODE_ENV,
    VERCEL_ENV,
    APP_ENV,
    PORT,
    ALLOWED_ORIGINS: parsedOrigins.length > 0 ? parsedOrigins : ["http://localhost:3000"],
    DATABASE_URL,
    PG_POOL_MAX,
    PGSSLMODE,
    SQLITE_PATH,
    APP_VERSION,
    SUPABASE_URL: parseResult.data.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: parseResult.data.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_ANON_KEY: parseResult.data.SUPABASE_ANON_KEY || parseResult.data.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: parseResult.data.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: parseResult.data.SUPABASE_SERVICE_ROLE_KEY || parseResult.data.SUPABASE_SECRET_KEY,
    SUPABASE_JWT_SECRET: parseResult.data.SUPABASE_JWT_SECRET,
    SESSION_SECRET: parseResult.data.SESSION_SECRET,
    isProduction,
    isPreview,
    isDevelopment,
    isTest,
    isCloud
  };
}
var cachedConfig = null;
function getEnv() {
  if (!cachedConfig) {
    cachedConfig = validateEnv(process.env);
  }
  return cachedConfig;
}

// src/utils/auth-diagnostics.ts
var CAMPOS_PERMITIDOS = /* @__PURE__ */ new Set([
  "etapa",
  "email",
  "supabaseConfigurado",
  "ambiente",
  "erroCodigo",
  "erroStatus",
  "erroMensagem",
  "temSessao",
  "temUsuario",
  "usuarioId",
  "emailConfirmado",
  "perfilEncontrado",
  "perfilAtivo",
  "papel",
  "cookiesEmitidos",
  "cookiesRecebidos",
  "origem",
  "resultado",
  "statusHttp",
  "motivo"
]);
var PADRAO_SEGREDO = /(senha|password|secret|refresh_token|access_token|apikey|api_key|bearer)/i;
function diagnosticoHabilitado() {
  if (process.env.AUTH_DIAGNOSTICS === "0") return false;
  if (process.env.AUTH_DIAGNOSTICS === "1") return true;
  return process.env.NODE_ENV !== "production";
}
function mascararEmail(email) {
  const valor = String(email ?? "").trim();
  if (!valor.includes("@")) return valor ? "(informado)" : "(vazio)";
  const [local, dominio] = valor.split("@");
  const visivel = local.slice(0, 3);
  return `${visivel}${local.length > 3 ? "***" : ""}@${dominio}`;
}
function registrarEtapaAuth(etapa, detalhes = {}) {
  if (!diagnosticoHabilitado()) return;
  const saida = { etapa };
  for (const [chave, valor] of Object.entries(detalhes)) {
    if (!CAMPOS_PERMITIDOS.has(chave)) continue;
    if (typeof valor === "string" && PADRAO_SEGREDO.test(valor) && chave !== "erroMensagem") {
      saida[chave] = "[omitido]";
      continue;
    }
    saida[chave] = valor;
  }
  console.log(`[AUTH] ${JSON.stringify(saida)}`);
}
function nomesCookiesSessao(cabecalhoCookie) {
  const cabecalho = String(cabecalhoCookie ?? "");
  if (!cabecalho) return [];
  return [...new Set(
    cabecalho.split(";").map((parte) => parte.split("=")[0]?.trim()).filter((nome) => Boolean(nome) && (nome.startsWith("sb-") || nome === "eec_session"))
  )];
}

// src/lib/supabase.ts
var anonClientInstance = null;
function isSupabaseConfigured() {
  const env = getEnv();
  if (env.isTest && !process.env.TEST_REMOTE_SUPABASE) {
    return false;
  }
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}
function createHonoSupabaseClient(c) {
  const env = getEnv();
  if (!isSupabaseConfigured()) {
    return null;
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return createRequestSupabaseClient(token);
    }
  }
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const cookieHeader = c.req.header("Cookie") ?? "";
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet) {
        const emitidos = [];
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(c, name, value, {
            ...options,
            httpOnly: options.httpOnly ?? true,
            sameSite: options.sameSite ?? "Lax",
            // Cookie Secure sobre HTTP local seria descartado pelo navegador,
            // impedindo a persistência da sessão em http://localhost.
            secure: env.isCloud ? true : false,
            path: options.path ?? "/"
          });
          emitidos.push(name);
        });
        if (emitidos.length) {
          registrarEtapaAuth("login.cookies", {
            origem: c.req.path,
            cookiesEmitidos: emitidos
          });
        }
      }
    }
  });
}
function getSupabaseAnonClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!anonClientInstance) {
    const env = getEnv();
    anonClientInstance = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return anonClientInstance;
}
function createRequestSupabaseClient(token) {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

// src/database/connection.ts
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
var database = null;
function getDatabase() {
  const config2 = getEnv();
  if (config2.isCloud) {
    throw new Error(
      `Opera\xE7\xE3o SQLite abortada: SQLite \xE9 estritamente proibido no ambiente "${config2.APP_ENV}". Configure DATABASE_URL com PostgreSQL.`
    );
  }
  if (database) return database;
  const filePath = resolve(process.cwd(), config2.SQLITE_PATH);
  mkdirSync(dirname(filePath), { recursive: true });
  database = new DatabaseSync(filePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
  return database;
}

// src/repositories/formulario.repository.ts
async function saveFormularioData(data, client) {
  if (client) {
    const { data: inserted, error } = await client.from("formularios").insert({ payload_json: data }).select("id").single();
    if (error || !inserted) {
      throw new Error(`Falha ao salvar configura\xE7\xE3o via Supabase: ${error?.message || "erro RLS"}`);
    }
    return Number(inserted.id);
  }
  const database2 = getDatabase();
  const result = database2.prepare("INSERT INTO formularios (payload_json) VALUES (?)").run(JSON.stringify(data));
  return Number(result.lastInsertRowid);
}
async function getFormularioData(client) {
  if (client) {
    const { data, error } = await client.from("formularios").select("payload_json").order("id", { ascending: false }).limit(1);
    if (error) {
      return null;
    }
    const row2 = data?.[0];
    if (!row2) return null;
    return typeof row2.payload_json === "string" ? JSON.parse(row2.payload_json) : row2.payload_json;
  }
  const database2 = getDatabase();
  const row = database2.prepare("SELECT payload_json FROM formularios ORDER BY id DESC LIMIT 1").get();
  if (!row) return null;
  try {
    return typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
  } catch {
    return null;
  }
}
async function getIdentidadePublica(client) {
  if (client) {
    const { data, error } = await client.from("site_identidade_publica").select("nome_escola, slogan, descricao_escola").limit(1);
    if (error || !data?.length) return null;
    return data[0];
  }
  const dados = await getFormularioData();
  if (!dados) return null;
  return {
    nome_escola: dados.nome_escola,
    slogan: dados.slogan,
    descricao_escola: dados.descricao_escola
  };
}

// src/schemas/formulario.schema.ts
import { z as z2 } from "zod";

// src/utils/sanitize.ts
var htmlPattern = /<\/?[a-z][\s\S]*>/i;
var dangerousPattern = /<\s*script|on[a-z]+\s*=|javascript\s*:|<\s*(iframe|object|embed|svg|link|meta)/i;
function hasSuspiciousHtml(value) {
  return dangerousPattern.test(value) || htmlPattern.test(value);
}
function sanitizeText(value) {
  return value.replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/\s+on[a-z]+\s*=\s*(['"]).*?\1/gi, "").replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "").replace(/javascript\s*:/gi, "").trim();
}

// src/schemas/formulario.schema.ts
var safeText = (field, max) => z2.string({ error: `${field} deve ser texto.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitido.`).transform(sanitizeText);
var optionalText = (field, max) => safeText(field, max).optional().default("");
var requiredText = (field, min, max) => z2.string({ error: `${field} deve ser texto.` }).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitido.`).transform(sanitizeText);
var emailField = z2.string({ error: "E-mail deve ser texto." }).trim().max(254, "E-mail excede o tamanho m\xE1ximo.").refine((value) => value === "" || z2.email().safeParse(value).success, "E-mail inv\xE1lido.").refine((value) => !hasSuspiciousHtml(value), "E-mail cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText).optional().default("");
var urlField = z2.string({ error: "URL deve ser texto." }).trim().max(300, "URL excede o tamanho m\xE1ximo.").refine((value) => value === "" || z2.url().safeParse(value).success, "URL inv\xE1lida.").refine((value) => !hasSuspiciousHtml(value), "URL cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText).optional().default("");
var cursoSchema = z2.object({
  nome: requiredText("Nome do curso", 1, 120),
  idade: optionalText("Faixa et\xE1ria", 60),
  descricao: optionalText("Descri\xE7\xE3o do curso", 800),
  turno: optionalText("Turno", 80)
}).strip();
var professorSchema = z2.object({
  nome: requiredText("Nome do professor", 1, 120),
  cargo: optionalText("Cargo do professor", 160),
  bio: optionalText("Biografia do professor", 800)
}).strip();
var depoimentoSchema = z2.object({
  nome: requiredText("Nome do depoimento", 1, 120),
  relacao: optionalText("Rela\xE7\xE3o do depoimento", 120),
  texto: optionalText("Texto do depoimento", 1e3)
}).strip();
var eventoSchema = z2.object({
  titulo: requiredText("T\xEDtulo do evento", 1, 160),
  data: optionalText("Data do evento", 80),
  tipo: optionalText("Tipo do evento", 60),
  descricao: optionalText("Descri\xE7\xE3o do evento", 800)
}).strip();
var formularioSchema = z2.object({
  nome_escola: optionalText("Nome da escola", 160),
  slogan: optionalText("Slogan", 220),
  ano_fundacao: optionalText("Ano de funda\xE7\xE3o", 20),
  descricao_escola: optionalText("Descri\xE7\xE3o da escola", 2e3),
  missao: optionalText("Miss\xE3o", 1200),
  visao: optionalText("Vis\xE3o", 1200),
  valores: optionalText("Valores", 1200),
  endereco: optionalText("Endere\xE7o", 240),
  bairro: optionalText("Bairro", 120),
  cidade: optionalText("Cidade", 120),
  estado: optionalText("Estado", 80),
  cep: optionalText("CEP", 20),
  telefone: optionalText("Telefone", 40),
  telefone2: optionalText("Telefone secund\xE1rio", 40),
  whatsapp: optionalText("WhatsApp", 40),
  email: emailField,
  email_matriculas: emailField,
  horario_atendimento: optionalText("Hor\xE1rio de atendimento", 160),
  facebook: urlField,
  instagram: urlField,
  youtube: urlField,
  linkedin: urlField,
  site: urlField,
  num_alunos: optionalText("N\xFAmero de alunos", 30),
  num_professores: optionalText("N\xFAmero de professores", 30),
  taxa_aprovacao: optionalText("Taxa de aprova\xE7\xE3o", 30),
  nota_enem: optionalText("Nota ENEM", 30),
  area_escola: optionalText("\xC1rea da escola", 40),
  cor_primaria: optionalText("Cor prim\xE1ria", 40),
  cor_secundaria: optionalText("Cor secund\xE1ria", 40),
  diferenciais: optionalText("Diferenciais", 2e3),
  infraestrutura: optionalText("Infraestrutura", 2e3),
  niveis_ensino: z2.array(safeText("N\xEDvel de ensino", 80)).max(20, "Muitos n\xEDveis de ensino.").optional().default([]),
  cursos: z2.array(cursoSchema).max(20, "Muitos cursos informados.").optional().default([]),
  professores: z2.array(professorSchema).max(50, "Muitos professores informados.").optional().default([]),
  depoimentos: z2.array(depoimentoSchema).max(30, "Muitos depoimentos informados.").optional().default([]),
  eventos: z2.array(eventoSchema).max(50, "Muitos eventos informados.").optional().default([]),
  site_publico: z2.record(z2.string(), z2.any()).optional().default({})
}).strip();

// src/services/formulario.service.ts
async function saveFormulario(payload, client) {
  const result = formularioSchema.safeParse(payload);
  if (!result.success) {
    return {
      status: 400,
      body: errorBody("Dados do formul\xE1rio inv\xE1lidos.")
    };
  }
  await saveFormularioData(result.data, client);
  return {
    status: 200,
    body: { success: true, message: "Dados salvos com sucesso!" }
  };
}
async function findFormulario(client) {
  return { data: await getFormularioData(client) };
}

// src/utils/request.ts
var textEncoder = new TextEncoder();
async function readJsonBody(c, maxBytes) {
  const contentLength = c.req.header("content-length");
  const declaredLength = contentLength ? Number(contentLength) : void 0;
  if (declaredLength && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new HttpError(413, "Payload muito grande.");
  }
  const rawBody = await c.req.text();
  if (textEncoder.encode(rawBody).byteLength > maxBytes) {
    throw new HttpError(413, "Payload muito grande.");
  }
  try {
    return JSON.parse(rawBody);
  } catch (e) {
    throw new HttpError(400, "JSON inv\xE1lido.");
  }
}

// src/controllers/formulario.controller.ts
var FORMULARIO_BODY_LIMIT_BYTES = 32 * 1024;
async function postFormulario(c) {
  try {
    const body = await readJsonBody(c, FORMULARIO_BODY_LIMIT_BYTES);
    const client = createHonoSupabaseClient(c);
    const result = await saveFormulario(body, client);
    return c.json(result.body, result.status);
  } catch (e) {
    if (e instanceof HttpError) {
      return c.json(errorBody(e.message), e.status);
    }
    return c.json(errorBody("Erro ao salvar dados."), 500);
  }
}
async function getFormulario(c) {
  const client = createHonoSupabaseClient(c);
  return c.json(await findFormulario(client));
}

// src/services/auth.service.ts
import { deleteCookie, getCookie, setCookie as setCookie2 } from "hono/cookie";

// src/database/postgres.ts
import tls from "node:tls";
import pg from "pg";
var { Pool } = pg;
var SUPABASE_ROOT_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;
var globalState = globalThis;
function state() {
  globalState.__websiteEecPostgres ??= {};
  return globalState.__websiteEecPostgres;
}
function hasPostgresConfig() {
  const config2 = getEnv();
  return Boolean(config2.DATABASE_URL);
}
function getSslConfig(connectionString) {
  const config2 = getEnv();
  if (config2.isCloud) {
    if (config2.PGSSLMODE === "disable") {
      throw new Error(`Conex\xE3o sem SSL (PGSSLMODE=disable) \xE9 estritamente proibida no ambiente "${config2.APP_ENV}".`);
    }
    try {
      const url = new URL(connectionString);
      if (url.searchParams.get("sslmode") === "disable") {
        throw new Error(`Conex\xE3o sem SSL (sslmode=disable) \xE9 estritamente proibida no ambiente "${config2.APP_ENV}".`);
      }
    } catch (err) {
      if (err.message?.includes("estritamente proibida")) {
        throw err;
      }
    }
  }
  if (config2.PGSSLMODE === "disable") {
    return false;
  }
  try {
    const url = new URL(connectionString);
    const urlSslMode = url.searchParams.get("sslmode");
    if (urlSslMode === "disable") {
      return false;
    }
  } catch {
  }
  const isSupabase = connectionString.includes("supabase.co") || connectionString.includes("supabase.com");
  if (config2.isCloud || config2.PGSSLMODE === "require" || config2.PGSSLMODE === "verify-full" || config2.PGSSLMODE === "verify-ca" || isSupabase) {
    return {
      rejectUnauthorized: true,
      ca: [SUPABASE_ROOT_CA_PEM, ...tls.rootCertificates]
    };
  }
  return void 0;
}
function getPostgresPool() {
  const currentState = state();
  if (currentState.pool) return currentState.pool;
  const config2 = getEnv();
  const connectionString = config2.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL n\xE3o configurada no ambiente.");
  }
  currentState.pool = new Pool({
    connectionString,
    max: config2.PG_POOL_MAX,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 1e4,
    ssl: getSslConfig(connectionString)
  });
  return currentState.pool;
}
async function queryPostgres(text, params = []) {
  return getPostgresPool().query(text, params);
}

// src/repositories/user.repository.ts
function normalizeProfile(row) {
  return {
    id: String(row.id),
    email: String(row.email),
    nome: String(row.nome),
    ativo: Boolean(row.ativo),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}
async function findProfileById(id, client) {
  if (client) {
    const { data, error } = await client.from("profiles").select("id, email, nome, ativo, created_at, updated_at").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return normalizeProfile(data);
  }
  if (hasPostgresConfig()) {
    const result = await queryPostgres(
      "SELECT id, email, nome, ativo, created_at, updated_at FROM public.profiles WHERE id = $1 LIMIT 1",
      [id]
    );
    return result.rows[0] ? normalizeProfile(result.rows[0]) : null;
  }
  const db = getDatabase();
  const row = db.prepare("SELECT id, email, nome, ativo, created_at, updated_at FROM profiles WHERE id = ? LIMIT 1").get(id);
  return row ? normalizeProfile(row) : null;
}
async function findProfileByEmail(email, client) {
  if (client) {
    const { data, error } = await client.from("profiles").select("id, email, nome, ativo, created_at, updated_at").ilike("email", email).maybeSingle();
    if (error || !data) return null;
    return normalizeProfile(data);
  }
  if (hasPostgresConfig()) {
    const result = await queryPostgres(
      "SELECT id, email, nome, ativo, created_at, updated_at FROM public.profiles WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    return result.rows[0] ? normalizeProfile(result.rows[0]) : null;
  }
  const db = getDatabase();
  const row = db.prepare("SELECT id, email, nome, ativo, created_at, updated_at FROM profiles WHERE LOWER(email) = LOWER(?) LIMIT 1").get(email);
  return row ? normalizeProfile(row) : null;
}
async function getUserRole(userId, client) {
  if (client) {
    const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return data.role || null;
  }
  if (hasPostgresConfig()) {
    const result = await queryPostgres(
      "SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    return result.rows[0]?.role || null;
  }
  const db = getDatabase();
  const row = db.prepare("SELECT role FROM user_roles WHERE user_id = ? LIMIT 1").get(userId);
  return row?.role || null;
}
async function setUserRole(userId, role, assignedBy, client) {
  if (client) {
    const { error } = await client.from("user_roles").upsert(
      {
        user_id: userId,
        role,
        atribuido_por: assignedBy || null
      },
      { onConflict: "user_id" }
    );
    if (error) {
      throw new Error(`Erro ao atribuir papel via Supabase: ${error.message}`);
    }
    return;
  }
  if (hasPostgresConfig()) {
    await queryPostgres(
      `INSERT INTO public.user_roles (user_id, role, atribuido_por)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, atribuido_em = NOW(), atribuido_por = EXCLUDED.atribuido_por`,
      [userId, role, assignedBy || null]
    );
    return;
  }
  const db = getDatabase();
  db.prepare(`
        INSERT INTO user_roles (user_id, role, atribuido_por)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET role = excluded.role, atribuido_em = datetime('now'), atribuido_por = excluded.atribuido_por
    `).run(userId, role, assignedBy || null);
}
async function countActiveSuperAdmins(client) {
  if (client) {
    const { count, error } = await client.from("user_roles").select("id, profiles!inner(ativo)", { count: "exact", head: true }).eq("role", "super_admin").eq("profiles.ativo", true);
    if (error) {
      return 1;
    }
    return count || 0;
  }
  if (hasPostgresConfig()) {
    const result = await queryPostgres(
      `SELECT COUNT(*) as count FROM public.user_roles ur
             JOIN public.profiles p ON p.id = ur.user_id
             WHERE ur.role = 'super_admin' AND p.ativo = TRUE`
    );
    return Number(result.rows[0]?.count || 0);
  }
  const db = getDatabase();
  const row = db.prepare(`
            SELECT COUNT(*) as count FROM user_roles ur
            JOIN profiles p ON p.id = ur.user_id
            WHERE ur.role = 'super_admin' AND p.ativo = 1
        `).get();
  return Number(row?.count || 0);
}
async function logAudit(entry, client) {
  if (client) {
    await client.from("audit_logs").insert({
      user_id: entry.user_id || null,
      acao: entry.acao,
      recurso: entry.recurso,
      registro_id: entry.registro_id || null,
      detalhes_json: entry.detalhes_json || null,
      ip_origem: entry.ip_origem || null
    });
    return;
  }
  if (hasPostgresConfig()) {
    await queryPostgres(
      `INSERT INTO public.audit_logs (user_id, acao, recurso, registro_id, detalhes_json, ip_origem)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        entry.user_id || null,
        entry.acao,
        entry.recurso,
        entry.registro_id || null,
        entry.detalhes_json ? JSON.stringify(entry.detalhes_json) : null,
        entry.ip_origem || null
      ]
    );
    return;
  }
  const db = getDatabase();
  db.prepare(`
        INSERT INTO audit_logs (user_id, acao, recurso, registro_id, detalhes_json, ip_origem)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
    entry.user_id || null,
    entry.acao,
    entry.recurso,
    entry.registro_id || null,
    entry.detalhes_json ? JSON.stringify(entry.detalhes_json) : null,
    entry.ip_origem || null
  );
}
async function listUsers(client) {
  if (client) {
    const { data: profiles, error } = await client.from("profiles").select("id, email, nome, ativo, created_at, updated_at").order("created_at", { ascending: false });
    if (error || !profiles) return [];
    const { data: roles } = await client.from("user_roles").select("user_id, role");
    const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
    return profiles.map((p) => ({
      ...normalizeProfile(p),
      role: roleMap.get(p.id) || null
    }));
  }
  if (hasPostgresConfig()) {
    const result = await queryPostgres(
      `SELECT p.id, p.email, p.nome, p.ativo, p.created_at, p.updated_at, ur.role
             FROM public.profiles p
             LEFT JOIN public.user_roles ur ON ur.user_id = p.id
             ORDER BY p.created_at DESC`
    );
    return result.rows.map((r) => ({
      ...normalizeProfile(r),
      role: r.role || null
    }));
  }
  const db = getDatabase();
  const rows = db.prepare(`
        SELECT p.id, p.email, p.nome, p.ativo, p.created_at, p.updated_at, ur.role
        FROM profiles p
        LEFT JOIN user_roles ur ON ur.user_id = p.id
        ORDER BY p.created_at DESC
    `).all();
  return rows.map((r) => ({
    ...normalizeProfile(r),
    role: r.role || null
  }));
}
async function updateProfileName(userId, nome, client) {
  if (client) {
    const { error } = await client.from("profiles").update({ nome, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId);
    if (error) throw new Error(`Falha ao atualizar nome do perfil: ${error.message}`);
    return;
  }
  if (hasPostgresConfig()) {
    await queryPostgres(
      `UPDATE public.profiles SET nome = $1, updated_at = NOW() WHERE id = $2`,
      [nome, userId]
    );
    return;
  }
  const db = getDatabase();
  db.prepare(`UPDATE profiles SET nome = ?, updated_at = datetime('now') WHERE id = ?`).run(nome, userId);
}
var TRANSFER_FAILURE_MESSAGES = {
  ALVO_INVALIDO: "Selecione um servidor diferente do Administrador Geral atual.",
  ALVO_NAO_ENCONTRADO: "O servidor selecionado n\xE3o foi encontrado na Central EEC.",
  ALVO_INATIVO: "O servidor selecionado est\xE1 inativo e n\xE3o pode assumir a fun\xE7\xE3o de Administrador Geral.",
  ALVO_SEM_PAPEL: "O servidor selecionado ainda n\xE3o possui uma fun\xE7\xE3o atribu\xEDda na Central EEC.",
  ALVO_JA_SUPER_ADMIN: "O servidor selecionado j\xE1 \xE9 o Administrador Geral.",
  OPERADOR_NAO_AUTORIZADO: "Apenas o Administrador Geral ativo pode transferir esta responsabilidade.",
  FALHA_TRANSACAO: "N\xE3o foi poss\xEDvel concluir a transfer\xEAncia. Nenhuma altera\xE7\xE3o foi aplicada."
};
var TRANSFER_FAILURE_CODES = Object.keys(TRANSFER_FAILURE_MESSAGES);
function failTransfer(code) {
  return { ok: false, code, message: TRANSFER_FAILURE_MESSAGES[code] };
}
function mapTransferError(message) {
  const found = TRANSFER_FAILURE_CODES.find((code) => message.includes(code));
  return found || "FALHA_TRANSACAO";
}
function isMissingRpcFunction(message) {
  return /could not find the function|does not exist|PGRST202|schema cache/i.test(message);
}
async function assertTransferPreconditions(currentSuperAdminId, targetUserId, client) {
  if (!targetUserId || targetUserId === currentSuperAdminId) {
    return failTransfer("ALVO_INVALIDO");
  }
  const operatorRole = await getUserRole(currentSuperAdminId, client);
  if (operatorRole !== "super_admin") {
    return failTransfer("OPERADOR_NAO_AUTORIZADO");
  }
  const targetProfile = await findProfileById(targetUserId, client);
  if (!targetProfile) {
    return failTransfer("ALVO_NAO_ENCONTRADO");
  }
  if (!targetProfile.ativo) {
    return failTransfer("ALVO_INATIVO");
  }
  const targetRole = await getUserRole(targetUserId, client);
  if (!targetRole) {
    return failTransfer("ALVO_SEM_PAPEL");
  }
  if (targetRole === "super_admin") {
    return failTransfer("ALVO_JA_SUPER_ADMIN");
  }
  return { ok: true, papelAnteriorAlvo: targetRole };
}
async function transferSuperAdmin(currentSuperAdminId, targetUserId, client) {
  if (client) {
    const { error } = await client.rpc("transfer_super_admin_role", { p_target: targetUserId });
    if (!error) {
      const novoPapel = await getUserRole(targetUserId, client);
      return { ok: true, papelAnteriorAlvo: novoPapel || "docente" };
    }
    if (!isMissingRpcFunction(error.message)) {
      return failTransfer(mapTransferError(error.message));
    }
    const preconditions2 = await assertTransferPreconditions(currentSuperAdminId, targetUserId, client);
    if (!preconditions2.ok) return preconditions2;
    const papelAnteriorAlvo = preconditions2.papelAnteriorAlvo;
    await setUserRole(targetUserId, "super_admin", currentSuperAdminId, client);
    try {
      await setUserRole(currentSuperAdminId, "admin", currentSuperAdminId, client);
    } catch (demotionError) {
      try {
        await setUserRole(targetUserId, papelAnteriorAlvo, currentSuperAdminId, client);
      } catch {
      }
      return failTransfer("FALHA_TRANSACAO");
    }
    return { ok: true, papelAnteriorAlvo };
  }
  if (hasPostgresConfig()) {
    const preconditions2 = await assertTransferPreconditions(currentSuperAdminId, targetUserId);
    if (!preconditions2.ok) return preconditions2;
    try {
      await queryPostgres("SELECT public.transfer_super_admin_role($1, $2)", [
        currentSuperAdminId,
        targetUserId
      ]);
    } catch (error) {
      return failTransfer(mapTransferError(error instanceof Error ? error.message : ""));
    }
    return { ok: true, papelAnteriorAlvo: preconditions2.papelAnteriorAlvo };
  }
  const preconditions = await assertTransferPreconditions(currentSuperAdminId, targetUserId);
  if (!preconditions.ok) return preconditions;
  const db = getDatabase();
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE user_roles SET role = 'super_admin', atribuido_em = datetime('now'), atribuido_por = ? WHERE user_id = ?`
    ).run(currentSuperAdminId, targetUserId);
    db.prepare(
      `UPDATE user_roles SET role = 'admin', atribuido_em = datetime('now'), atribuido_por = ? WHERE user_id = ?`
    ).run(currentSuperAdminId, currentSuperAdminId);
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
    }
    return failTransfer("FALHA_TRANSACAO");
  }
  return { ok: true, papelAnteriorAlvo: preconditions.papelAnteriorAlvo };
}
async function setProfileActive(userId, ativo, client) {
  if (client) {
    const { error } = await client.from("profiles").update({ ativo, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId);
    if (error) throw new Error(`Falha ao atualizar status do perfil: ${error.message}`);
    return;
  }
  if (hasPostgresConfig()) {
    await queryPostgres(
      `UPDATE public.profiles SET ativo = $1, updated_at = NOW() WHERE id = $2`,
      [ativo, userId]
    );
    return;
  }
  const db = getDatabase();
  db.prepare(`UPDATE profiles SET ativo = ?, updated_at = datetime('now') WHERE id = ?`).run(ativo ? 1 : 0, userId);
}

// src/services/auth.service.ts
var SESSION_COOKIE_NAME = "eec_session";
var localTestSessions = /* @__PURE__ */ new Map();
function registerLocalTestSession(sessionId, userId, ttlMs = 36e5) {
  localTestSessions.set(sessionId, {
    userId,
    expiresAt: Date.now() + ttlMs
  });
}
async function authenticateWithPassword(c, email, password) {
  if (!email || !password) {
    throw new HttpError(400, "E-mail e senha s\xE3o obrigat\xF3rios.");
  }
  const env = getEnv();
  const isCloudOrProd = env.isCloud || env.APP_ENV === "production" || env.APP_ENV === "preview";
  registrarEtapaAuth("login.recebido", {
    email: mascararEmail(email),
    supabaseConfigurado: isSupabaseConfigured(),
    ambiente: env.APP_ENV,
    cookiesRecebidos: nomesCookiesSessao(c.req.header("Cookie"))
  });
  if (isSupabaseConfigured()) {
    const supabase = createHonoSupabaseClient(c);
    if (!supabase) {
      registrarEtapaAuth("login.falha", { motivo: "cliente_supabase_indisponivel", statusHttp: 500 });
      throw new HttpError(500, "Servi\xE7o de autentica\xE7\xE3o temporariamente indispon\xEDvel.");
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    registrarEtapaAuth("login.supabase.resposta", {
      email: mascararEmail(email),
      erroCodigo: error?.code ?? null,
      erroStatus: error?.status ?? null,
      erroMensagem: error?.message ?? null,
      temSessao: Boolean(data?.session),
      temUsuario: Boolean(data?.user),
      usuarioId: data?.user?.id ?? null,
      emailConfirmado: data?.user?.email_confirmed_at ? true : Boolean(data?.user?.confirmed_at)
    });
    if (error || !data.session || !data.user) {
      registrarEtapaAuth("login.falha", {
        motivo: "credenciais_recusadas_pelo_provedor",
        erroCodigo: error?.code ?? null,
        statusHttp: 401
      });
      throw new HttpError(401, "Credenciais institucionais inv\xE1lidas.");
    }
    const profile2 = await findProfileById(data.user.id, supabase);
    registrarEtapaAuth("login.perfil", {
      usuarioId: data.user.id,
      perfilEncontrado: Boolean(profile2),
      perfilAtivo: profile2 ? Boolean(profile2.ativo) : null
    });
    if (profile2 && !profile2.ativo) {
      registrarEtapaAuth("login.falha", { motivo: "perfil_inativo", statusHttp: 403 });
      await supabase.auth.signOut();
      throw new HttpError(403, "Esta conta institucional est\xE1 inativa.");
    }
    const role2 = await getUserRole(data.user.id, supabase);
    registrarEtapaAuth("login.papel", { usuarioId: data.user.id, papel: role2 });
    const authUser = {
      id: data.user.id,
      email: data.user.email || email,
      nome: profile2?.nome || email.split("@")[0],
      role: role2,
      ativo: profile2 ? profile2.ativo : true
    };
    registrarEtapaAuth("login.concluido", {
      usuarioId: authUser.id,
      papel: authUser.role,
      perfilAtivo: authUser.ativo,
      resultado: "sessao_estabelecida"
    });
    return { user: authUser };
  }
  if (isCloudOrProd) {
    throw new HttpError(503, "Servi\xE7o de autentica\xE7\xE3o em nuvem indispon\xEDvel.");
  }
  const profile = await findProfileByEmail(email);
  if (!profile) {
    throw new HttpError(401, "Credenciais institucionais inv\xE1lidas.");
  }
  if (!profile.ativo) {
    throw new HttpError(403, "Esta conta institucional est\xE1 inativa.");
  }
  const role = await getUserRole(profile.id);
  const sessionId = `eec-sess-${profile.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  registerLocalTestSession(sessionId, profile.id);
  setCookie2(c, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: env.isCloud,
    maxAge: 86400
  });
  return {
    user: {
      id: profile.id,
      email: profile.email,
      nome: profile.nome,
      role,
      ativo: profile.ativo
    }
  };
}
function listarCookiesSupabase(c) {
  const cabecalho = c.req.header("Cookie") ?? "";
  if (!cabecalho) return [];
  const nomes = cabecalho.split(";").map((parte) => parte.split("=")[0]?.trim()).filter((nome) => Boolean(nome) && /^sb-.+-auth-token(\.\d+)?$/.test(nome));
  return [...new Set(nomes)];
}
function clearSupabaseSessionCookies(c) {
  for (const nome of listarCookiesSupabase(c)) {
    deleteCookie(c, nome, { path: "/" });
  }
}
async function terminateSession(c) {
  if (isSupabaseConfigured()) {
    const supabase = createHonoSupabaseClient(c);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
      }
    }
  }
  const env = getEnv();
  const isCloudOrProd = env.isCloud || env.APP_ENV === "production" || env.APP_ENV === "preview";
  if (!isCloudOrProd) {
    const localSessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (localSessionId) {
      localTestSessions.delete(localSessionId);
    }
  }
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/"
  });
  clearSupabaseSessionCookies(c);
}
async function validateRequestSession(c) {
  const env = getEnv();
  const isCloudOrProd = env.isCloud || env.APP_ENV === "production" || env.APP_ENV === "preview";
  const cookiesPresentes = nomesCookiesSessao(c.req.header("Cookie"));
  if (isSupabaseConfigured()) {
    const supabase = createHonoSupabaseClient(c);
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if ((error || !data?.user) && cookiesPresentes.length > 0) {
          registrarEtapaAuth("sessao.falha", {
            origem: c.req.path,
            cookiesRecebidos: cookiesPresentes,
            erroCodigo: error?.code ?? null,
            erroStatus: error?.status ?? null,
            erroMensagem: error?.message ?? null,
            motivo: "getUser_sem_usuario"
          });
        }
        if (!error && data?.user) {
          const profile = await findProfileById(data.user.id, supabase);
          const role = await getUserRole(data.user.id, supabase);
          registrarEtapaAuth("sessao.validacao", {
            origem: c.req.path,
            usuarioId: data.user.id,
            perfilEncontrado: Boolean(profile),
            perfilAtivo: profile ? Boolean(profile.ativo) : null,
            papel: role,
            resultado: "sessao_valida"
          });
          return {
            id: data.user.id,
            email: data.user.email || "",
            nome: profile?.nome || data.user.email?.split("@")[0] || "Usu\xE1rio",
            role,
            ativo: profile ? Boolean(profile.ativo) : true
          };
        }
      } catch (erro) {
        registrarEtapaAuth("sessao.falha", {
          origem: c.req.path,
          cookiesRecebidos: cookiesPresentes,
          erroMensagem: erro instanceof Error ? erro.message : String(erro),
          motivo: "excecao_token_invalido"
        });
        clearSupabaseSessionCookies(c);
      }
    }
  }
  if (!isCloudOrProd) {
    const localSessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (localSessionId) {
      const testSession = localTestSessions.get(localSessionId);
      if (testSession) {
        if (Date.now() > testSession.expiresAt) {
          localTestSessions.delete(localSessionId);
          deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
          return null;
        }
        const profile = await findProfileById(testSession.userId);
        if (!profile) {
          return null;
        }
        const role = await getUserRole(profile.id);
        return {
          id: profile.id,
          email: profile.email,
          nome: profile.nome,
          role,
          ativo: Boolean(profile.ativo)
        };
      }
    }
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    if (isSupabaseConfigured()) {
      const client = createRequestSupabaseClient(token);
      if (client) {
        try {
          const { data, error } = await client.auth.getUser();
          if (!error && data?.user) {
            const profile = await findProfileById(data.user.id, client);
            const role = await getUserRole(data.user.id, client);
            return {
              id: data.user.id,
              email: data.user.email || "",
              nome: profile?.nome || data.user.email?.split("@")[0] || "Usu\xE1rio",
              role,
              ativo: profile ? Boolean(profile.ativo) : true
            };
          }
        } catch {
        }
      }
    }
    if (!isCloudOrProd) {
      const testSession = localTestSessions.get(token);
      if (testSession) {
        if (Date.now() > testSession.expiresAt) {
          localTestSessions.delete(token);
          return null;
        }
        const profile = await findProfileById(testSession.userId);
        if (!profile) return null;
        const role = await getUserRole(profile.id);
        return {
          id: profile.id,
          email: profile.email,
          nome: profile.nome,
          role,
          ativo: Boolean(profile.ativo)
        };
      }
    }
  }
  return null;
}
async function requestPasswordReset(email, redirectUrl) {
  if (!email) return { sent: false };
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAnonClient();
    if (supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl || "http://localhost:3130/admin/reset-password"
        });
        if (error) {
          return { sent: false, message: error.message };
        }
        return { sent: true };
      } catch (err) {
        return { sent: false, message: err instanceof Error ? err.message : "Erro no envio" };
      }
    }
  }
  return { sent: true };
}

// src/middlewares/auth.ts
async function requireAuth(c, next) {
  const user = await validateRequestSession(c);
  if (!user) {
    const accept = c.req.header("Accept") || "";
    const isApi = c.req.path.startsWith("/api");
    if (accept.includes("text/html") || !isApi && !accept.includes("application/json")) {
      return c.redirect("/admin/login", 302);
    }
    return c.json({ error: "Autentica\xE7\xE3o necess\xE1ria." }, 401);
  }
  if (!user.ativo) {
    return c.json({ error: "Conta institucional desativada." }, 403);
  }
  c.set("user", user);
  c.set("role", user.role);
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
  await next();
}

// src/middlewares/rate-limit.ts
var buckets = /* @__PURE__ */ new Map();
function getClientIp(headers) {
  return headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
function rateLimit(options) {
  return async (c, next) => {
    const now = Date.now();
    const ip = getClientIp(c.req.raw.headers);
    const key = `${ip}:${c.req.path}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }
    if (current.count >= options.maxRequests) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1e3);
      c.header("Retry-After", String(retryAfter));
      return c.json(errorBody("Muitas requisi\xE7\xF5es. Tente novamente mais tarde."), 429);
    }
    current.count += 1;
    await next();
  };
}

// src/utils/assets.ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve as resolve2 } from "node:path";
var cacheVersao = /* @__PURE__ */ new Map();
function raizPublica() {
  const producao = resolve2("dist", "public");
  if (getEnv().isCloud) {
    return existsSync(producao) ? producao : resolve2("public");
  }
  return existsSync(resolve2("public")) ? resolve2("public") : producao;
}
function assetUrl(caminho) {
  const emCache = cacheVersao.get(caminho);
  if (emCache) return emCache;
  let versao = "dev";
  try {
    const absoluto = resolve2(raizPublica(), caminho.replace(/^\/+/, ""));
    versao = createHash("sha1").update(readFileSync(absoluto)).digest("hex").slice(0, 10);
  } catch {
    return `${caminho}?v=dev`;
  }
  const url = `${caminho}?v=${versao}`;
  cacheVersao.set(caminho, url);
  return url;
}

// src/middlewares/rbac.ts
function requireRole(...allowedRoles) {
  return async (c, next) => {
    const user = c.get("user");
    const role = c.get("role");
    if (!user || !role) {
      return c.json({ error: "Acesso restrito: usu\xE1rio sem perfil homologado." }, 403);
    }
    if (role === "super_admin") {
      return await next();
    }
    if (allowedRoles.includes(role)) {
      return await next();
    }
    const accept = c.req.header("Accept") || "";
    if (accept.includes("text/html")) {
      return c.html(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <title>403 - Acesso Negado | Central EEC</title>
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
                    <link rel="stylesheet" href="${assetUrl("/styles/tailwind.css")}">
                    <link rel="stylesheet" href="${assetUrl("/static/styles.css")}">
                </head>
                <body class="font-poppins bg-gray-100 flex items-center justify-center min-h-screen p-4">
                    <div class="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                        <div class="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                            !
                        </div>
                        <h1 class="text-2xl font-bold text-gray-800 mb-2">403 - Acesso Negado</h1>
                        <p class="text-gray-600 mb-6 text-sm">Seu perfil atual (<strong>${role}</strong>) n\xE3o possui autoriza\xE7\xE3o para acessar este recurso.</p>
                        <a href="/admin" class="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all text-sm">
                            Voltar ao Painel
                        </a>
                    </div>
                </body>
                </html>
            `, 403);
    }
    return c.json({ error: "Acesso negado para este perfil." }, 403);
  };
}

// src/repositories/contato.repository.ts
async function saveContact(data, client) {
  const activeClient = client || getSupabaseAnonClient();
  if (activeClient) {
    const { error } = await activeClient.from("contatos").insert({
      nome: data.nome,
      email: data.email,
      telefone: data.telefone || null,
      assunto: data.assunto || null,
      mensagem: data.mensagem
    });
    if (error) {
      throw new Error(`Falha ao registrar contato via Supabase: ${error.message}`);
    }
    return 0;
  }
  if (hasPostgresConfig()) {
    const res = await queryPostgres(
      `INSERT INTO public.contatos (nome, email, telefone, assunto, mensagem)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
      [data.nome, data.email, data.telefone || null, data.assunto || null, data.mensagem]
    );
    return Number(res.rows[0].id);
  }
  const database2 = getDatabase();
  const result = database2.prepare(`
            INSERT INTO contatos (
                nome,
                email,
                telefone,
                assunto,
                mensagem
            ) VALUES (?, ?, ?, ?, ?)
        `).run(
    data.nome,
    data.email,
    data.telefone || null,
    data.assunto || null,
    data.mensagem
  );
  return Number(result.lastInsertRowid);
}
async function listContatos(client) {
  if (client) {
    const { data, error } = await client.from("contatos").select("id, nome, email, telefone, assunto, mensagem, created_at").order("id", { ascending: false }).limit(50);
    if (error) {
      throw new Error(`Acesso a contatos negado por pol\xEDtica RLS ou erro no banco: ${error.message}`);
    }
    return data || [];
  }
  if (hasPostgresConfig()) {
    const res = await queryPostgres(
      "SELECT id, nome, email, telefone, assunto, mensagem, created_at FROM public.contatos ORDER BY id DESC LIMIT 50"
    );
    return res.rows;
  }
  const db = getDatabase();
  const rows = db.prepare("SELECT id, nome, email, telefone, assunto, mensagem, created_at FROM contatos ORDER BY id DESC LIMIT 50").all();
  return rows;
}

// src/services/site-publico.service.ts
function getDefaultSitePublico() {
  return {
    inicio: {
      hero_titulo: "Escola Estadual do Cariri",
      hero_subtitulo: "Central EEC \u2014 Ensino Integral e Profissionalizante",
      hero_chamada: "Transformando realidades atrav\xE9s do conhecimento, dedica\xE7\xE3o pedag\xF3gica e acolhimento comunit\xE1rio.",
      cta_texto: "Conhe\xE7a Nossos Cursos",
      cta_link: "#cursos",
      banner_imagem: "",
      destaque_ativo: true,
      status: "publicado"
    },
    sobre: {
      titulo: "Sobre a Escola Estadual do Cariri",
      apresentacao: "A Escola Estadual do Cariri \xE9 uma institui\xE7\xE3o p\xFAblica comprometida com a forma\xE7\xE3o cidad\xE3 e profissional de seus estudantes.",
      historia: "Fundada com a miss\xE3o de expandir os horizontes educacionais e oferecer forma\xE7\xE3o de excel\xEAncia para a juventude.",
      missao: "Proporcionar uma educa\xE7\xE3o de excel\xEAncia, integrando forma\xE7\xE3o acad\xEAmica, tecnol\xF3gica e humanit\xE1ria.",
      visao: "Ser refer\xEAncia regional em ensino integral e desenvolvimento integral do estudante.",
      valores: "\xC9tica, respeito, compromisso educacional, inova\xE7\xE3o pedag\xF3gica e acolhimento comunit\xE1rio.",
      proposta_pedagogica: "Metodologias ativas, protagonismo juvenil e integra\xE7\xE3o com as demandas do mundo do trabalho.",
      estrutura: "Salas de aula climatizadas, laborat\xF3rio de inform\xE1tica, biblioteca, quadra poliesportiva e refeit\xF3rio.",
      status: "publicado"
    },
    cursos: [
      {
        id: "curso-1",
        nome: "Fundamental II Integral",
        modalidade: "Ensino Fundamental",
        turno: "Integral",
        descricao: "Forma\xE7\xE3o ampla do 6\xBA ao 9\xBA ano com acompanhamento pedag\xF3gico individualizado e atividades complementares.",
        idade: "11 a 14 anos",
        visibilidade: true,
        ordem: 1
      },
      {
        id: "curso-2",
        nome: "M\xE9dio T\xE9cnico Integral",
        modalidade: "Ensino M\xE9dio e T\xE9cnico",
        turno: "Integral",
        descricao: "Ensino m\xE9dio de excel\xEAncia integrado \xE0 forma\xE7\xE3o profissionalizante.",
        idade: "15 a 17 anos",
        visibilidade: true,
        ordem: 2
      }
    ],
    projetos: [
      {
        id: "proj-1",
        titulo: "Feira de Ci\xEAncias e Tecnologia",
        resumo: "Apresenta\xE7\xE3o anual de projetos cient\xEDficos desenvolvidos pelos estudantes.",
        descricao: "Espa\xE7o para compartilhamento do conhecimento com a comunidade escolar.",
        periodo: "2026",
        status: "publicado",
        destaque: true
      }
    ],
    noticias: [
      {
        id: "noticia-1",
        titulo: "Abertura do Ano Letivo na Escola Estadual do Cariri",
        slug: "abertura-ano-letivo-2026",
        resumo: "Comunidade escolar reunida para o in\xEDcio de um novo ciclo de aprendizado.",
        conteudo: "Boas-vindas a todos os estudantes, servidores e fam\xEDlias.",
        data: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        autor: "Dire\xE7\xE3o Escolar",
        categoria: "Institucional",
        status: "publicado",
        destaque: true
      }
    ],
    galeria: [
      {
        id: "album-1",
        titulo: "Instala\xE7\xF5es da Escola Estadual do Cariri",
        descricao: "Registro dos espa\xE7os dedicados ao aprendizado e conviv\xEAncia.",
        fotos: [],
        visibilidade: true,
        ordem: 1
      }
    ],
    equipe: [
      {
        id: "equipe-1",
        nome: "Equipe Gestora e Docente",
        cargo: "Corpo Pedag\xF3gico",
        bio: "Servidores dedicados ao desenvolvimento integral dos estudantes da EEC.",
        ordem: 1,
        visibilidade: true
      }
    ],
    contatos: {
      telefones: ["(38) 99999-0000"],
      emails: ["escola.eec@hotmail.com"],
      horario_atendimento: "Segunda a Sexta, das 07:00 \xE0s 17:00",
      redes_sociais: {
        instagram: "https://instagram.com"
      },
      orientacoes: "Para atendimento presencial, procure a secretaria escolar no hor\xE1rio regular.",
      status: "publicado"
    },
    documentos_publicos: [
      {
        id: "doc-pub-1",
        titulo: "Calend\xE1rio Escolar Oficial",
        descricao: "Cronograma oficial de dias letivos, reuni\xF5es e eventos do ano corrente.",
        categoria: "Calend\xE1rio",
        arquivo_url: "",
        data_publicacao: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        visibilidade: true,
        ordem: 1
      }
    ],
    links_uteis: [
      {
        id: "link-1",
        titulo: "Portal da Secretaria de Estado de Educa\xE7\xE3o",
        url: "https://educacao.mg.gov.br",
        descricao: "Acesso \xE0s diretrizes estaduais e orienta\xE7\xF5es pedag\xF3gicas.",
        categoria: "Governo",
        ordem: 1,
        visibilidade: true
      }
    ],
    secoes_adicionais: []
  };
}
async function getSitePublicoConfig(client) {
  const raw = await getFormularioData(client);
  const defaults = getDefaultSitePublico();
  if (!raw || !raw.site_publico || typeof raw.site_publico !== "object") {
    return defaults;
  }
  const saved = raw.site_publico;
  return {
    ...defaults,
    ...saved,
    inicio: { ...defaults.inicio, ...saved.inicio || {} },
    sobre: { ...defaults.sobre, ...saved.sobre || {} },
    contatos: { ...defaults.contatos, ...saved.contatos || {} },
    cursos: Array.isArray(saved.cursos) ? saved.cursos : defaults.cursos,
    projetos: Array.isArray(saved.projetos) ? saved.projetos : defaults.projetos,
    noticias: Array.isArray(saved.noticias) ? saved.noticias : defaults.noticias,
    galeria: Array.isArray(saved.galeria) ? saved.galeria : defaults.galeria,
    equipe: Array.isArray(saved.equipe) ? saved.equipe : defaults.equipe,
    documentos_publicos: Array.isArray(saved.documentos_publicos) ? saved.documentos_publicos : defaults.documentos_publicos,
    links_uteis: Array.isArray(saved.links_uteis) ? saved.links_uteis : defaults.links_uteis,
    secoes_adicionais: Array.isArray(saved.secoes_adicionais) ? saved.secoes_adicionais : defaults.secoes_adicionais
  };
}
async function saveSitePublicoSection(section, data, client) {
  const current = await getSitePublicoConfig(client);
  current[section] = data;
  const rawForm = await getFormularioData(client) || {
    nome_escola: "Escola Estadual do Cariri",
    slogan: "Central EEC"
  };
  rawForm.site_publico = current;
  await saveFormularioData(rawForm, client);
  return current;
}

// src/types/auth.ts
var VALID_ROLES = [
  "super_admin",
  "admin",
  "admin_tecnico",
  "secretaria",
  "docente"
];
function isValidRole(role) {
  return typeof role === "string" && VALID_ROLES.includes(role);
}

// src/routes/admin.routes.ts
var adminRoutes = new Hono();
var TRANSFER_ERROR_STATUS = {
  ALVO_INVALIDO: 400,
  ALVO_NAO_ENCONTRADO: 404,
  ALVO_INATIVO: 400,
  ALVO_SEM_PAPEL: 400,
  ALVO_JA_SUPER_ADMIN: 409,
  OPERADOR_NAO_AUTORIZADO: 403,
  FALHA_TRANSACAO: 500
};
adminRoutes.use("*", requireAuth);
adminRoutes.get(
  "/configuracao",
  requireRole("super_admin", "admin"),
  getFormulario
);
adminRoutes.post(
  "/configuracao",
  requireRole("super_admin", "admin"),
  rateLimit({ maxRequests: 10, windowMs: 6e4 }),
  postFormulario
);
adminRoutes.get(
  "/contatos",
  requireRole("super_admin", "admin", "secretaria"),
  async (c) => {
    const client = createHonoSupabaseClient(c);
    try {
      const rows = await listContatos(client);
      return c.json({ contatos: rows });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Erro ao consultar contatos." }, 500);
    }
  }
);
adminRoutes.post(
  "/usuarios/role",
  requireRole("super_admin", "admin"),
  async (c) => {
    const body = await readJsonBody(c, 2 * 1024);
    const targetUserId = body?.userId?.trim();
    const newRole = body?.role?.trim();
    if (!targetUserId || !newRole || !isValidRole(newRole)) {
      return c.json({ error: "Par\xE2metros inv\xE1lidos. Papel deve ser um dos pap\xE9is oficiais." }, 400);
    }
    const currentUser = c.get("user");
    const operatorRole = c.get("role");
    if (currentUser.id === targetUserId) {
      return c.json({ error: "Opera\xE7\xE3o n\xE3o permitida: um usu\xE1rio n\xE3o pode alterar o pr\xF3prio papel." }, 403);
    }
    const client = createHonoSupabaseClient(c);
    const currentTargetRole = await getUserRole(targetUserId, client);
    if (operatorRole === "admin") {
      if (newRole === "super_admin") {
        return c.json({ error: "Opera\xE7\xE3o n\xE3o permitida: admin n\xE3o possui permiss\xE3o para criar ou atribuir o papel super_admin." }, 403);
      }
      if (currentTargetRole === "super_admin") {
        return c.json({ error: "Opera\xE7\xE3o n\xE3o permitida: admin n\xE3o possui permiss\xE3o para alterar ou rebaixar super_admin." }, 403);
      }
    }
    if (currentTargetRole === "super_admin" && newRole !== "super_admin") {
      const activeSuperAdmins = await countActiveSuperAdmins(client);
      if (activeSuperAdmins <= 1) {
        return c.json({ error: "Opera\xE7\xE3o bloqueada: n\xE3o \xE9 permitido remover ou rebaixar o \xFAltimo super_admin ativo." }, 400);
      }
    }
    await setUserRole(targetUserId, newRole, currentUser.id, client);
    await logAudit({
      user_id: currentUser.id,
      acao: "ALTERAR_PAPEL",
      recurso: "user_roles",
      registro_id: targetUserId,
      detalhes_json: { papel_anterior: currentTargetRole, novo_papel: newRole },
      ip_origem: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip")
    }, client);
    return c.json({
      success: true,
      message: `Papel atualizado com sucesso para ${newRole}.`
    });
  }
);
adminRoutes.get(
  "/usuarios",
  requireRole("super_admin", "admin"),
  async (c) => {
    const client = createHonoSupabaseClient(c);
    try {
      const users = await listUsers(client);
      return c.json({ usuarios: users });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Erro ao listar usu\xE1rios." }, 500);
    }
  }
);
adminRoutes.post(
  "/usuarios/nome",
  requireRole("super_admin", "admin"),
  async (c) => {
    const body = await readJsonBody(c, 2 * 1024);
    const targetUserId = body?.userId?.trim();
    const newNome = body?.nome?.trim();
    if (!targetUserId || !newNome || newNome.length < 2) {
      return c.json({ error: "Par\xE2metros inv\xE1lidos. Nome deve ter pelo menos 2 caracteres." }, 400);
    }
    const currentUser = c.get("user");
    const operatorRole = c.get("role");
    const client = createHonoSupabaseClient(c);
    if (operatorRole === "admin") {
      const targetRole = await getUserRole(targetUserId, client);
      if (targetRole === "super_admin" && currentUser.id !== targetUserId) {
        return c.json({ error: "Opera\xE7\xE3o n\xE3o permitida: admin n\xE3o pode renomear Administrador Geral." }, 403);
      }
    }
    await updateProfileName(targetUserId, newNome, client);
    await logAudit({
      user_id: currentUser.id,
      acao: "EDITAR_NOME_PERFIL",
      recurso: "profiles",
      registro_id: targetUserId,
      detalhes_json: { novo_nome: newNome },
      ip_origem: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip")
    }, client);
    return c.json({ success: true, message: "Nome atualizado com sucesso." });
  }
);
adminRoutes.post(
  "/usuarios/status",
  requireRole("super_admin", "admin"),
  async (c) => {
    const body = await readJsonBody(c, 2 * 1024);
    const targetUserId = body?.userId?.trim();
    const ativo = Boolean(body?.ativo);
    if (!targetUserId) {
      return c.json({ error: "ID do usu\xE1rio \xE9 obrigat\xF3rio." }, 400);
    }
    const currentUser = c.get("user");
    const client = createHonoSupabaseClient(c);
    const targetRole = await getUserRole(targetUserId, client);
    if (!ativo && targetRole === "super_admin") {
      const activeSuperAdmins = await countActiveSuperAdmins(client);
      if (activeSuperAdmins <= 1) {
        return c.json({ error: "Opera\xE7\xE3o bloqueada: n\xE3o \xE9 permitido desativar o \xFAltimo Administrador Geral ativo." }, 400);
      }
    }
    await setProfileActive(targetUserId, ativo, client);
    await logAudit({
      user_id: currentUser.id,
      acao: ativo ? "ATIVAR_USUARIO" : "DESATIVAR_USUARIO",
      recurso: "profiles",
      registro_id: targetUserId,
      detalhes_json: { ativo },
      ip_origem: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip")
    }, client);
    return c.json({ success: true, message: `Status do usu\xE1rio atualizado para ${ativo ? "ativo" : "inativo"}.` });
  }
);
adminRoutes.post(
  "/usuarios/transferir-super-admin",
  requireRole("super_admin"),
  async (c) => {
    const body = await readJsonBody(c, 2 * 1024);
    const novoSuperAdminId = body?.novoSuperAdminId?.trim();
    if (!novoSuperAdminId) {
      return c.json({ error: "ID do novo Administrador Geral \xE9 obrigat\xF3rio." }, 400);
    }
    const currentUser = c.get("user");
    if (currentUser.id === novoSuperAdminId) {
      return c.json({ error: "Voc\xEA j\xE1 \xE9 o Administrador Geral ativo." }, 400);
    }
    const client = createHonoSupabaseClient(c);
    const resultado = await transferSuperAdmin(currentUser.id, novoSuperAdminId, client);
    if (!resultado.ok) {
      return c.json({ error: resultado.message }, TRANSFER_ERROR_STATUS[resultado.code]);
    }
    await logAudit({
      user_id: currentUser.id,
      acao: "TRANSFERIR_SUPER_ADMIN",
      recurso: "user_roles",
      registro_id: novoSuperAdminId,
      detalhes_json: {
        anterior: currentUser.id,
        novo: novoSuperAdminId,
        papel_anterior_alvo: resultado.papelAnteriorAlvo
      },
      ip_origem: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip")
    }, client);
    return c.json({ success: true, message: "Responsabilidade de Administrador Geral transferida com sucesso." });
  }
);
adminRoutes.get(
  "/site-publico",
  requireRole("super_admin", "admin"),
  async (c) => {
    const client = createHonoSupabaseClient(c);
    try {
      const config2 = await getSitePublicoConfig(client);
      return c.json({ config: config2 });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Erro ao obter dados do site p\xFAblico." }, 500);
    }
  }
);
adminRoutes.post(
  "/site-publico/:secao",
  requireRole("super_admin", "admin"),
  async (c) => {
    const secao = c.req.param("secao");
    const allowedSections = [
      "inicio",
      "sobre",
      "cursos",
      "projetos",
      "noticias",
      "galeria",
      "equipe",
      "contatos",
      "documentos_publicos",
      "links_uteis",
      "secoes_adicionais"
    ];
    if (!allowedSections.includes(secao)) {
      return c.json({ error: `Se\xE7\xE3o '${secao}' n\xE3o reconhecida.` }, 400);
    }
    const body = await readJsonBody(c, 500 * 1024);
    if (!body || !body.dados) {
      return c.json({ error: "Dados da se\xE7\xE3o s\xE3o obrigat\xF3rios." }, 400);
    }
    const client = createHonoSupabaseClient(c);
    const currentUser = c.get("user");
    const updated = await saveSitePublicoSection(secao, body.dados, client);
    await logAudit({
      user_id: currentUser.id,
      acao: "EDITAR_SITE_PUBLICO",
      recurso: `site_publico.${secao}`,
      detalhes_json: { secao },
      ip_origem: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip")
    }, client);
    return c.json({ success: true, message: `Se\xE7\xE3o '${secao}' salva com sucesso.`, config: updated });
  }
);
var admin_routes_default = adminRoutes;

// src/routes/auth.routes.ts
import { Hono as Hono2 } from "hono";

// src/controllers/auth.controller.ts
async function postLogin(c) {
  try {
    const body = await readJsonBody(c, 4 * 1024);
    const email = body?.email?.trim() || "";
    const password = body?.password || "";
    const { user } = await authenticateWithPassword(c, email, password);
    return c.json({
      success: true,
      user
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: "Erro ao processar autentica\xE7\xE3o." }, 500);
  }
}
async function postLogout(c) {
  await terminateSession(c);
  return c.json({
    success: true,
    message: "Sess\xE3o encerrada com sucesso."
  });
}
async function postRecuperarSenha(c) {
  try {
    const body = await readJsonBody(c, 2 * 1024);
    const email = body?.email?.trim() || "";
    if (email) {
      const host = c.req.header("host") || "localhost:3130";
      const proto = c.req.header("x-forwarded-proto") || "http";
      const redirectUrl = `${proto}://${host}/admin/reset-password`;
      const result = await requestPasswordReset(email, redirectUrl);
      if (!result.sent && result.message) {
        return c.json({
          success: false,
          error: result.message
        }, 400);
      }
    }
    return c.json({
      success: true,
      message: "Solicita\xE7\xE3o de redefini\xE7\xE3o de senha processada. Verifique sua caixa de entrada e pasta de lixo eletr\xF4nico/spam."
    });
  } catch {
    return c.json({
      success: true,
      message: "Solicita\xE7\xE3o de redefini\xE7\xE3o de senha processada. Verifique sua caixa de entrada e pasta de lixo eletr\xF4nico/spam."
    });
  }
}
async function getMe(c) {
  const user = c.get("user");
  const role = c.get("role");
  return c.json({
    user,
    role
  });
}
async function postUpdateProfile(c) {
  const user = c.get("user");
  const body = await readJsonBody(c, 2 * 1024);
  const nome = body?.nome?.trim();
  if (!nome || nome.length < 2) {
    return c.json({ error: "Nome inv\xE1lido. M\xEDnimo de 2 caracteres." }, 400);
  }
  const client = createHonoSupabaseClient(c);
  await updateProfileName(user.id, nome, client);
  return c.json({ success: true, message: "Perfil atualizado com sucesso.", nome });
}

// src/routes/auth.routes.ts
var authRoutes = new Hono2();
authRoutes.post("/login", rateLimit({ maxRequests: 5, windowMs: 6e4 }), postLogin);
authRoutes.post("/logout", postLogout);
authRoutes.post("/recuperar-senha", rateLimit({ maxRequests: 3, windowMs: 6e4 }), postRecuperarSenha);
authRoutes.get("/me", requireAuth, getMe);
authRoutes.post("/perfil", requireAuth, postUpdateProfile);
var auth_routes_default = authRoutes;

// src/routes/comunicado.routes.ts
import { Hono as Hono3 } from "hono";

// src/middlewares/csrf.ts
var MUTATIVE_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
var CSRF_EXEMPT_PATHS = /* @__PURE__ */ new Set(["/api/contato", "/api/auth/login", "/api/auth/recuperar-senha"]);
async function csrfProtection(c, next) {
  const method = c.req.method.toUpperCase();
  if (!MUTATIVE_METHODS.has(method)) {
    return await next();
  }
  const path = c.req.path;
  if (CSRF_EXEMPT_PATHS.has(path)) {
    return await next();
  }
  const secFetchSite = c.req.header("Sec-Fetch-Site");
  if (secFetchSite === "cross-site") {
    return c.json({ error: "Requisi\xE7\xE3o bloqueada por pol\xEDtica de seguran\xE7a CSRF (cross-site)." }, 403);
  }
  const origin = c.req.header("Origin");
  if (origin) {
    const env = getEnv();
    const host = c.req.header("Host") || "";
    const isAllowedOrigin = env.ALLOWED_ORIGINS.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        return origin === allowedUrl.origin || origin.includes(host);
      } catch {
        return false;
      }
    });
    const matchesHost = host && (origin.includes(host) || origin.includes("localhost") || origin.includes("127.0.0.1"));
    if (!isAllowedOrigin && !matchesHost) {
      return c.json({ error: "Origem da requisi\xE7\xE3o n\xE3o autorizada." }, 403);
    }
  }
  await next();
}

// src/schemas/comunicado.schema.ts
import { z as z3 } from "zod";
var AUDIENCIAS_COMUNICADO = [
  "todos_internos",
  "admin_secretaria",
  "docentes",
  "admin_tecnico"
];
var STATUS_COMUNICADO = [
  "rascunho",
  "publicado",
  "arquivado"
];
var createComunicadoSchema = z3.object({
  titulo: z3.string().min(3, "T\xEDtulo deve ter no m\xEDnimo 3 caracteres.").max(150, "T\xEDtulo deve ter no m\xE1ximo 150 caracteres.").trim(),
  conteudo: z3.string().min(5, "Conte\xFAdo deve ter no m\xEDnimo 5 caracteres.").trim(),
  audiencia: z3.enum(AUDIENCIAS_COMUNICADO),
  status: z3.enum(STATUS_COMUNICADO).optional().default("rascunho")
});

// src/repositories/comunicado.repository.ts
async function listComunicados(client, userRole, userId) {
  if (client) {
    const { data, error } = await client.from("comunicados").select("*").order("id", { ascending: false });
    if (error) {
      throw new Error(`Erro ao consultar comunicados no Supabase: ${error.message}`);
    }
    return data || [];
  }
  const db = getDatabase();
  if (userRole === "super_admin" || userRole === "admin") {
    const stmt = db.prepare("SELECT * FROM comunicados ORDER BY id DESC");
    return stmt.all();
  }
  if (userRole === "secretaria") {
    const stmt = db.prepare(`
            SELECT * FROM comunicados
            WHERE (status = 'publicado' AND audiencia IN ('todos_internos', 'admin_secretaria'))
               OR (criado_por = ?)
            ORDER BY id DESC
        `);
    return stmt.all(userId || "");
  }
  if (userRole === "docente") {
    const stmt = db.prepare(`
            SELECT * FROM comunicados
            WHERE (status = 'publicado' AND audiencia IN ('todos_internos', 'docentes'))
               OR (criado_por = ?)
            ORDER BY id DESC
        `);
    return stmt.all(userId || "");
  }
  if (userRole === "admin_tecnico") {
    const stmt = db.prepare(`
            SELECT * FROM comunicados
            WHERE status = 'publicado' AND audiencia IN ('todos_internos', 'admin_tecnico')
            ORDER BY id DESC
        `);
    return stmt.all();
  }
  return [];
}
async function findComunicadoById(id, client) {
  if (client) {
    const { data, error } = await client.from("comunicados").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw new Error(`Erro ao buscar comunicado: ${error.message}`);
    }
    return data || null;
  }
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM comunicados WHERE id = ?").get(id);
  return row || null;
}
async function createComunicado(data, client) {
  if (client) {
    const { data: created, error } = await client.from("comunicados").insert({
      titulo: data.titulo,
      conteudo: data.conteudo,
      status: data.status,
      audiencia: data.audiencia,
      criado_por: data.criado_por,
      publicado_em: data.publicado_em || null
    }).select().single();
    if (error) {
      throw new Error(`Erro ao criar comunicado no Supabase: ${error.message}`);
    }
    return created;
  }
  const db = getDatabase();
  const stmt = db.prepare(`
        INSERT INTO comunicados (titulo, conteudo, status, audiencia, criado_por, publicado_em)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(
    data.titulo,
    data.conteudo,
    data.status,
    data.audiencia,
    data.criado_por,
    data.publicado_em || null
  );
  const selectStmt = db.prepare("SELECT * FROM comunicados WHERE id = ?");
  return selectStmt.get(info.lastInsertRowid);
}
async function updateComunicadoStatus(id, newStatus, client) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const updatePayload = {
    status: newStatus,
    updated_at: nowIso
  };
  if (newStatus === "publicado") {
    updatePayload.publicado_em = nowIso;
  } else if (newStatus === "arquivado") {
    updatePayload.arquivado_em = nowIso;
  }
  if (client) {
    const { error } = await client.from("comunicados").update(updatePayload).eq("id", id);
    if (error) {
      throw new Error(`Erro ao atualizar status do comunicado: ${error.message}`);
    }
    return;
  }
  const db = getDatabase();
  if (newStatus === "publicado") {
    db.prepare("UPDATE comunicados SET status = ?, publicado_em = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
  } else {
    db.prepare("UPDATE comunicados SET status = ?, arquivado_em = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(newStatus, id);
  }
}

// src/services/comunicado.service.ts
async function listUserComunicados(currentUser, client) {
  return listComunicados(client, currentUser.role || void 0, currentUser.id);
}
async function getComunicado(id, currentUser, client) {
  const comunicado = await findComunicadoById(id, client);
  if (!comunicado) {
    throw new HttpError(404, "Comunicado n\xE3o encontrado.");
  }
  if (currentUser.role === "admin_tecnico" && !["todos_internos", "admin_tecnico"].includes(comunicado.audiencia)) {
    throw new HttpError(403, "Acesso negado: administradores t\xE9cnicos n\xE3o acessam conte\xFAdo restrito a outros setores.");
  }
  if (currentUser.role === "docente") {
    if (comunicado.status !== "publicado" && comunicado.criado_por !== currentUser.id) {
      throw new HttpError(403, "Acesso negado a comunicados em rascunho ou arquivados.");
    }
    if (!["todos_internos", "docentes"].includes(comunicado.audiencia)) {
      throw new HttpError(403, "Acesso negado: este comunicado n\xE3o \xE9 destinado aos docentes.");
    }
  }
  if (currentUser.role === "secretaria") {
    if (comunicado.status !== "publicado" && comunicado.criado_por !== currentUser.id) {
      throw new HttpError(403, "Acesso negado a comunicados em rascunho ou arquivados.");
    }
    if (!["todos_internos", "admin_secretaria"].includes(comunicado.audiencia) && comunicado.criado_por !== currentUser.id) {
      throw new HttpError(403, "Acesso negado: comunicado n\xE3o destinado \xE0 secretaria.");
    }
  }
  return comunicado;
}
async function publishUserComunicado(id, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin"].includes(currentUser.role)) {
    throw new HttpError(403, "Apenas administradores (super_admin e admin) podem publicar comunicados.");
  }
  const comunicado = await findComunicadoById(id, client);
  if (!comunicado) {
    throw new HttpError(404, "Comunicado n\xE3o encontrado.");
  }
  await updateComunicadoStatus(id, "publicado", client);
  await logAudit({
    user_id: currentUser.id,
    acao: "PUBLICAR_COMUNICADO",
    recurso: "comunicados",
    registro_id: String(id),
    detalhes_json: { titulo: comunicado.titulo, audiencia: comunicado.audiencia }
  }, client);
}
async function archiveUserComunicado(id, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin"].includes(currentUser.role)) {
    throw new HttpError(403, "Apenas administradores (super_admin e admin) podem arquivar comunicados.");
  }
  const comunicado = await findComunicadoById(id, client);
  if (!comunicado) {
    throw new HttpError(404, "Comunicado n\xE3o encontrado.");
  }
  await updateComunicadoStatus(id, "arquivado", client);
  await logAudit({
    user_id: currentUser.id,
    acao: "ARQUIVAR_COMUNICADO",
    recurso: "comunicados",
    registro_id: String(id),
    detalhes_json: { titulo: comunicado.titulo }
  }, client);
}
async function createUserComunicado(input, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin", "secretaria"].includes(currentUser.role)) {
    throw new HttpError(403, `Usu\xE1rios com o papel "${currentUser.role}" n\xE3o possuem permiss\xE3o para criar comunicados.`);
  }
  let finalStatus = "rascunho";
  if (currentUser.role === "secretaria") {
    finalStatus = "rascunho";
  } else if (input.status === "publicado") {
    finalStatus = "publicado";
  }
  const created = await createComunicado({
    titulo: input.titulo,
    conteudo: input.conteudo,
    status: finalStatus,
    audiencia: input.audiencia,
    criado_por: currentUser.id,
    publicado_em: finalStatus === "publicado" ? (/* @__PURE__ */ new Date()).toISOString() : null
  }, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "CRIAR_COMUNICADO",
    recurso: "comunicados",
    registro_id: String(created.id),
    detalhes_json: { titulo: created.titulo, status: created.status, audiencia: created.audiencia }
  }, client);
  return created;
}

// src/controllers/comunicado.controller.ts
async function listComunicadosHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const comunicados = await listUserComunicados(user, client);
  return c.json({ success: true, data: comunicados });
}
async function getComunicadoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de comunicado inv\xE1lido.");
  }
  const comunicado = await getComunicado(id, user, client);
  return c.json({ success: true, data: comunicado });
}
async function createComunicadoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const body = await c.req.json().catch(() => null);
  if (!body) {
    throw new HttpError(400, "Corpo da requisi\xE7\xE3o inv\xE1lido.");
  }
  const parseResult = createComunicadoSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new HttpError(400, `Dados inv\xE1lidos: ${errorMsg}`);
  }
  const created = await createUserComunicado(parseResult.data, user, client);
  return c.json({ success: true, data: created }, 201);
}
async function publishComunicadoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de comunicado inv\xE1lido.");
  }
  await publishUserComunicado(id, user, client);
  return c.json({ success: true, message: "Comunicado publicado com sucesso." });
}
async function archiveComunicadoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de comunicado inv\xE1lido.");
  }
  await archiveUserComunicado(id, user, client);
  return c.json({ success: true, message: "Comunicado arquivado com sucesso." });
}

// src/routes/comunicado.routes.ts
var router = new Hono3();
router.get("/", requireAuth, listComunicadosHandler);
router.get("/:id", requireAuth, getComunicadoHandler);
router.post("/", requireAuth, csrfProtection, requireRole("super_admin", "admin", "secretaria"), createComunicadoHandler);
router.patch("/:id/publicar", requireAuth, csrfProtection, requireRole("super_admin", "admin"), publishComunicadoHandler);
router.patch("/:id/arquivar", requireAuth, csrfProtection, requireRole("super_admin", "admin"), archiveComunicadoHandler);
var comunicado_routes_default = router;

// src/routes/contato.routes.ts
import { Hono as Hono4 } from "hono";

// src/schemas/contato.schema.ts
import { z as z4 } from "zod";
var safeRequiredText = (field, min, max) => z4.string({ error: `${field} deve ser texto.` }).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText);
var safeOptionalText = (field, max) => z4.string({ error: `${field} deve ser texto.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText).optional();
var contatoSchema = z4.object({
  nome: safeRequiredText("Nome", 2, 120),
  email: z4.string({ error: "E-mail deve ser texto." }).trim().email("E-mail inv\xE1lido.").max(254, "E-mail excede o tamanho m\xE1ximo.").refine((value) => !hasSuspiciousHtml(value), "E-mail cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText),
  telefone: safeOptionalText("Telefone", 40),
  assunto: safeOptionalText("Assunto", 160),
  mensagem: safeRequiredText("Mensagem", 5, 2e3)
}).strip();

// src/services/contato.service.ts
async function processContact(payload, client) {
  const result = contatoSchema.safeParse(payload);
  if (!result.success) {
    return {
      status: 400,
      body: errorBody("Dados de contato inv\xE1lidos.")
    };
  }
  await saveContact(result.data, client);
  return {
    status: 200,
    body: {
      success: true,
      message: "Mensagem enviada com sucesso! Entraremos em contato em breve."
    }
  };
}

// src/controllers/contato.controller.ts
var CONTATO_BODY_LIMIT_BYTES = 8 * 1024;
async function postContato(c) {
  try {
    const body = await readJsonBody(c, CONTATO_BODY_LIMIT_BYTES);
    const client = createHonoSupabaseClient(c);
    const result = await processContact(body, client);
    return c.json(result.body, result.status);
  } catch (e) {
    if (e instanceof HttpError) {
      return c.json(errorBody(e.message), e.status);
    }
    console.error("[CONTATO_ERROR]", e);
    return c.json(errorBody("Erro ao processar a mensagem."), 500);
  }
}

// src/routes/contato.routes.ts
var contatoRoutes = new Hono4();
contatoRoutes.post("/", rateLimit({ maxRequests: 10, windowMs: 6e4 }), postContato);
var contato_routes_default = contatoRoutes;

// src/routes/docente.routes.ts
import { Hono as Hono5 } from "hono";
var docenteRoutes = new Hono5();
docenteRoutes.use("*", requireAuth);
docenteRoutes.get(
  "/comunicados",
  requireRole("super_admin", "admin", "docente"),
  async (c) => {
    const user = c.get("user");
    const client = createHonoSupabaseClient(c);
    const list = await listUserComunicados(user, client);
    return c.json({ success: true, comunicados: list });
  }
);
var docente_routes_default = docenteRoutes;

// src/routes/documento.routes.ts
import { Hono as Hono6 } from "hono";

// src/schemas/documento.schema.ts
import { z as z5 } from "zod";
var CATEGORIAS_DOCUMENTO = [
  "pedagogico",
  "institucional",
  "administrativo",
  "planejamento"
];
var TIPOS_DESTINO_COMPARTILHAMENTO = [
  "perfil",
  "usuario",
  "grupo"
];
var createCompartilhamentoSchema = z5.object({
  tipo_destino: z5.enum(TIPOS_DESTINO_COMPARTILHAMENTO),
  destino_id: z5.string().min(1, "Identificador de destino inv\xE1lido.").max(60, "Identificador de destino muito longo.").trim()
});
var rejeitarDocumentoSchema = z5.object({
  motivo: z5.string().min(5, "Motivo deve conter ao menos 5 caracteres.").max(500, "Motivo n\xE3o pode exceder 500 caracteres.").trim()
});
var uploadIntentSchema = z5.object({
  fileName: z5.string().min(1, "Nome do arquivo \xE9 obrigat\xF3rio.").max(255),
  mimeType: z5.string().min(1, "Tipo MIME \xE9 obrigat\xF3rio.").max(100),
  declaredSize: z5.number().int().positive("Tamanho declarado deve ser maior que zero.").max(10 * 1024 * 1024, "Tamanho do arquivo excede o limite m\xE1ximo permitido de 10 MB."),
  categoria: z5.enum(CATEGORIAS_DOCUMENTO).default("pedagogico")
});
var uploadFinalizarSchema = z5.object({
  storagePath: z5.string().min(1, "Caminho de armazenamento \xE9 obrigat\xF3rio.").max(500),
  originalName: z5.string().min(1, "Nome original \xE9 obrigat\xF3rio.").max(255),
  mimeType: z5.string().min(1, "Tipo MIME \xE9 obrigat\xF3rio.").max(100),
  categoria: z5.enum(CATEGORIAS_DOCUMENTO).default("pedagogico"),
  titulo: z5.string().max(255).optional()
});

// src/repositories/documento.repository.ts
async function listDocumentos(client, userRole, userId) {
  if (client) {
    const { data, error } = await client.from("documentos").select("*").order("id", { ascending: false });
    if (error) {
      throw new Error(`Erro ao consultar documentos no Supabase: ${error.message}`);
    }
    return data || [];
  }
  if (userRole === "admin_tecnico") {
    return [];
  }
  const db = getDatabase();
  if (userRole === "super_admin" || userRole === "admin") {
    const stmt = db.prepare("SELECT * FROM documentos ORDER BY id DESC");
    return stmt.all();
  }
  if (userRole === "secretaria") {
    const stmt = db.prepare(`
            SELECT DISTINCT d.* FROM documentos d
            LEFT JOIN documento_compartilhamentos dc ON dc.documento_id = d.id
            WHERE d.enviado_por = ?
               OR (d.status = 'aprovado' AND (dc.destino_id = 'secretaria' OR dc.destino_id = ?))
            ORDER BY d.id DESC
        `);
    return stmt.all(userId || "", userId || "");
  }
  if (userRole === "docente") {
    const stmt = db.prepare(`
            SELECT DISTINCT d.* FROM documentos d
            LEFT JOIN documento_compartilhamentos dc ON dc.documento_id = d.id
            WHERE d.enviado_por = ?
               OR (d.status = 'aprovado' AND (dc.destino_id = 'docente' OR dc.destino_id = ?))
            ORDER BY d.id DESC
        `);
    return stmt.all(userId || "", userId || "");
  }
  return [];
}
async function findDocumentoById(id, client) {
  if (client) {
    const { data, error } = await client.from("documentos").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw new Error(`Erro ao buscar documento: ${error.message}`);
    }
    return data || null;
  }
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM documentos WHERE id = ?").get(id);
  return row || null;
}
async function createDocumento(data, client) {
  if (client) {
    const { data: created, error } = await client.from("documentos").insert({
      nome_original: data.nome_original,
      nome_armazenado: data.nome_armazenado,
      storage_path: data.storage_path,
      mime_type: data.mime_type,
      tamanho_bytes: data.tamanho_bytes,
      categoria: data.categoria,
      status: data.status,
      enviado_por: data.enviado_por,
      aprovado_por: data.aprovado_por || null
    }).select().single();
    if (error) {
      throw new Error(`Erro ao criar registro de documento no Supabase: ${error.message}`);
    }
    return created;
  }
  const db = getDatabase();
  const stmt = db.prepare(`
        INSERT INTO documentos (
            nome_original, nome_armazenado, storage_path, mime_type,
            tamanho_bytes, categoria, status, enviado_por, aprovado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  const info = stmt.run(
    data.nome_original,
    data.nome_armazenado,
    data.storage_path,
    data.mime_type,
    data.tamanho_bytes,
    data.categoria,
    data.status,
    data.enviado_por,
    data.aprovado_por || null
  );
  const selectStmt = db.prepare("SELECT * FROM documentos WHERE id = ?");
  return selectStmt.get(info.lastInsertRowid);
}
async function addCompartilhamento(documentoId, tipoDestino, destinoId, criadoPor, client) {
  if (client) {
    const { data, error } = await client.from("documento_compartilhamentos").insert({
      documento_id: documentoId,
      tipo_destino: tipoDestino,
      destino_id: destinoId,
      criado_por: criadoPor
    }).select().single();
    if (error) {
      throw new Error(`Erro ao adicionar compartilhamento: ${error.message}`);
    }
    return data;
  }
  const db = getDatabase();
  const stmt = db.prepare(`
        INSERT INTO documento_compartilhamentos (documento_id, tipo_destino, destino_id, criado_por)
        VALUES (?, ?, ?, ?)
    `);
  const info = stmt.run(documentoId, tipoDestino, destinoId, criadoPor);
  const selectStmt = db.prepare("SELECT * FROM documento_compartilhamentos WHERE id = ?");
  return selectStmt.get(info.lastInsertRowid);
}
async function updateDocumentoStatus(id, status, aprovadoPor, motivoRejeicao, client) {
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (client) {
    const { error } = await client.from("documentos").update({
      status,
      aprovado_por: aprovadoPor || null,
      motivo_rejeicao: motivoRejeicao || null,
      updated_at: nowIso
    }).eq("id", id);
    if (error) {
      throw new Error(`Erro ao atualizar status do documento: ${error.message}`);
    }
    return;
  }
  const db = getDatabase();
  db.prepare(`
        UPDATE documentos
        SET status = ?, aprovado_por = ?, motivo_rejeicao = ?, updated_at = datetime('now')
        WHERE id = ?
    `).run(status, aprovadoPor || null, motivoRejeicao || null, id);
}

// src/services/storage.service.ts
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { extname, basename } from "node:path";
var STORAGE_BUCKET = "documentos-privados";
var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
var ALLOWED_EXTENSIONS_MAP = {
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".doc": ["application/msword"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".xls": ["application/vnd.ms-excel"],
  ".odt": ["application/vnd.oasis.opendocument.text"],
  ".ods": ["application/vnd.oasis.opendocument.spreadsheet"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"]
};
var BLOCKED_EXTENSIONS = /* @__PURE__ */ new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".vbs",
  ".js",
  ".mjs",
  ".ts",
  ".msi",
  ".php",
  ".py",
  ".com",
  ".scr",
  ".jar"
]);
var localFileStore = /* @__PURE__ */ new Map();
var LOCAL_HMAC_SECRET = randomBytes(32).toString("hex");
function validateAndPrepareUpload(fileName, fileBuffer, reportedMimeType) {
  const safeBaseName = basename(fileName).replace(/[\0\r\n/\\]/g, "");
  if (!safeBaseName || safeBaseName.includes("..")) {
    throw new HttpError(400, "Nome de arquivo inv\xE1lido ou tentativa de path traversal detectada.");
  }
  const rawExt = extname(safeBaseName).toLowerCase();
  if (!rawExt) {
    throw new HttpError(400, "O arquivo deve possuir uma extens\xE3o v\xE1lida.");
  }
  if (BLOCKED_EXTENSIONS.has(rawExt)) {
    throw new HttpError(400, `Arquivos execut\xE1veis com extens\xE3o "${rawExt}" s\xE3o terminantemente proibidos.`);
  }
  const validMimes = ALLOWED_EXTENSIONS_MAP[rawExt];
  if (!validMimes) {
    throw new HttpError(400, `Extens\xE3o "${rawExt}" n\xE3o permitida. Permitidos: PDF, Word, Excel, OpenOffice e Imagens.`);
  }
  const normalizedMime = reportedMimeType.toLowerCase().split(";")[0].trim();
  if (!validMimes.includes(normalizedMime)) {
    throw new HttpError(400, `MIME type "${reportedMimeType}" incompat\xEDvel com a extens\xE3o "${rawExt}".`);
  }
  if (fileBuffer.length <= 0) {
    throw new HttpError(400, "Arquivo enviado est\xE1 vazio.");
  }
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new HttpError(400, `Tamanho do arquivo (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB) excede o limite m\xE1ximo permitido de 10 MB.`);
  }
  const uuid = randomUUID();
  const storedName = `${uuid}${rawExt}`;
  const now = /* @__PURE__ */ new Date();
  const ano = now.getUTCFullYear();
  const mes = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storagePath = `uploads/${ano}/${mes}/${storedName}`;
  return {
    originalName: safeBaseName,
    storedName,
    storagePath,
    mimeType: normalizedMime,
    sizeBytes: fileBuffer.length,
    buffer: fileBuffer
  };
}
function validateUploadMetadata(fileName, reportedMimeType, declaredSize) {
  const safeBaseName = basename(fileName).replace(/[\0\r\n/\\]/g, "");
  if (!safeBaseName || safeBaseName.includes("..")) {
    throw new HttpError(400, "Nome de arquivo inv\xE1lido ou tentativa de path traversal detectada.");
  }
  const rawExt = extname(safeBaseName).toLowerCase();
  if (!rawExt) {
    throw new HttpError(400, "O arquivo deve possuir uma extens\xE3o v\xE1lida.");
  }
  if (BLOCKED_EXTENSIONS.has(rawExt)) {
    throw new HttpError(400, `Arquivos execut\xE1veis com extens\xE3o "${rawExt}" s\xE3o terminantemente proibidos.`);
  }
  const validMimes = ALLOWED_EXTENSIONS_MAP[rawExt];
  if (!validMimes) {
    throw new HttpError(400, `Extens\xE3o "${rawExt}" n\xE3o permitida. Permitidos: PDF, Word, Excel, OpenOffice e Imagens.`);
  }
  const normalizedMime = reportedMimeType.toLowerCase().split(";")[0].trim();
  if (!validMimes.includes(normalizedMime)) {
    throw new HttpError(400, `MIME type "${reportedMimeType}" incompat\xEDvel com a extens\xE3o "${rawExt}".`);
  }
  if (declaredSize <= 0) {
    throw new HttpError(400, "Tamanho declarado do arquivo deve ser maior que zero.");
  }
  if (declaredSize > MAX_FILE_SIZE_BYTES) {
    throw new HttpError(400, `Tamanho declarado (${(declaredSize / (1024 * 1024)).toFixed(2)} MB) excede o limite m\xE1ximo permitido de 10 MB.`);
  }
  const uuid = randomUUID();
  const storedName = `${uuid}${rawExt}`;
  const now = /* @__PURE__ */ new Date();
  const ano = now.getUTCFullYear();
  const mes = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storagePath = `uploads/${ano}/${mes}/${storedName}`;
  return { safeBaseName, storedName, storagePath, normalizedMime, rawExt };
}
async function createUploadIntent(fileName, reportedMimeType, declaredSize, supabaseClient) {
  const { safeBaseName, storagePath, normalizedMime } = validateUploadMetadata(fileName, reportedMimeType, declaredSize);
  if (supabaseClient) {
    const { data, error } = await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data?.signedUrl) {
      throw new HttpError(500, `Falha ao gerar URL assinada de upload no storage: ${error?.message || "Erro desconhecido"}`);
    }
    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: storagePath,
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
      mimeType: normalizedMime,
      originalName: safeBaseName
    };
  }
  const expires = Date.now() + 300 * 1e3;
  const hmac = createHmac("sha256", LOCAL_HMAC_SECRET);
  hmac.update(`${storagePath}:${expires}`);
  const sig = hmac.digest("hex");
  const signedUrl = `/api/documentos/upload-direct-local?path=${encodeURIComponent(storagePath)}&expires=${expires}&sig=${sig}`;
  return {
    signedUrl,
    token: "local-test-token",
    path: storagePath,
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    mimeType: normalizedMime,
    originalName: safeBaseName
  };
}
async function verifyAndFinalizeUpload(storagePath, originalName, reportedMimeType, supabaseClient) {
  if (!storagePath.startsWith("uploads/") || storagePath.includes("..") || storagePath.includes("\\")) {
    throw new HttpError(400, "Caminho de armazenamento inv\xE1lido ou tentativa de path traversal detectada.");
  }
  const rawExt = extname(storagePath).toLowerCase();
  if (!rawExt || BLOCKED_EXTENSIONS.has(rawExt) || !ALLOWED_EXTENSIONS_MAP[rawExt]) {
    throw new HttpError(400, `Extens\xE3o do arquivo "${rawExt}" inv\xE1lida ou proibida.`);
  }
  const validMimes = ALLOWED_EXTENSIONS_MAP[rawExt];
  const normalizedMime = reportedMimeType.toLowerCase().split(";")[0].trim();
  if (!validMimes.includes(normalizedMime)) {
    throw new HttpError(400, `MIME type "${reportedMimeType}" incompat\xEDvel com a extens\xE3o "${rawExt}".`);
  }
  const storedName = basename(storagePath);
  if (supabaseClient) {
    const lastSlash = storagePath.lastIndexOf("/");
    const folder = lastSlash > 0 ? storagePath.substring(0, lastSlash) : "";
    const filename = lastSlash > 0 ? storagePath.substring(lastSlash + 1) : storagePath;
    const { data: files, error } = await supabaseClient.storage.from(STORAGE_BUCKET).list(folder, { search: filename });
    if (error) {
      throw new HttpError(500, `Falha ao verificar arquivo no storage privado: ${error.message}`);
    }
    const fileEntry = files?.find((f) => f.name === filename);
    if (!fileEntry) {
      throw new HttpError(404, "Arquivo n\xE3o encontrado no armazenamento ap\xF3s a tentativa de upload.");
    }
    const sizeBytes = Number(fileEntry.metadata?.size || fileEntry.size || 0);
    if (sizeBytes <= 0) {
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw new HttpError(400, "Arquivo enviado para o storage est\xE1 vazio.");
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw new HttpError(400, `Tamanho do arquivo no storage (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) excede o limite m\xE1ximo permitido de 10 MB.`);
    }
    return { sizeBytes, storedName, mimeType: normalizedMime };
  }
  const local = localFileStore.get(storagePath);
  if (!local) {
    throw new HttpError(404, "Arquivo n\xE3o encontrado no armazenamento ap\xF3s a tentativa de upload.");
  }
  if (local.buffer.length <= 0) {
    localFileStore.delete(storagePath);
    throw new HttpError(400, "Arquivo enviado para o storage est\xE1 vazio.");
  }
  if (local.buffer.length > MAX_FILE_SIZE_BYTES) {
    localFileStore.delete(storagePath);
    throw new HttpError(400, `Tamanho do arquivo (${(local.buffer.length / (1024 * 1024)).toFixed(2)} MB) excede o limite m\xE1ximo permitido de 10 MB.`);
  }
  return { sizeBytes: local.buffer.length, storedName, mimeType: normalizedMime };
}
function saveLocalDirectUpload(storagePath, buffer, mimeType) {
  if (!storagePath.startsWith("uploads/") || storagePath.includes("..")) {
    throw new HttpError(400, "Caminho de armazenamento inv\xE1lido.");
  }
  localFileStore.set(storagePath, { buffer, mimeType });
}
async function uploadToStorage(file, supabaseClient) {
  if (supabaseClient) {
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(file.storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: false
      // Não permite sobrescrita silenciosa
    });
    if (error) {
      throw new HttpError(500, `Falha ao persistir arquivo no storage privado: ${error.message}`);
    }
  } else {
    localFileStore.set(file.storagePath, {
      buffer: file.buffer,
      mimeType: file.mimeType
    });
  }
}
async function createSignedDownloadUrl(storagePath, expiresInSeconds = 60, supabaseClient) {
  if (!storagePath.startsWith("uploads/") || storagePath.includes("..")) {
    throw new HttpError(400, "Caminho de arquivo inv\xE1lido.");
  }
  if (supabaseClient) {
    const { data, error } = await supabaseClient.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new HttpError(500, `Falha ao gerar link assinado de download: ${error?.message || "Erro desconhecido"}`);
    }
    return data.signedUrl;
  }
  const expires = Date.now() + expiresInSeconds * 1e3;
  const hmac = createHmac("sha256", LOCAL_HMAC_SECRET);
  hmac.update(`${storagePath}:${expires}`);
  const sig = hmac.digest("hex");
  return `/api/documentos/download-file?path=${encodeURIComponent(storagePath)}&expires=${expires}&sig=${sig}`;
}
function getLocalFileFromSignedRequest(storagePath, expiresStr, sig) {
  if (!storagePath.startsWith("uploads/") || storagePath.includes("..")) {
    throw new HttpError(400, "Caminho de arquivo inv\xE1lido.");
  }
  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires) || Date.now() > expires) {
    throw new HttpError(403, "Link assinado expirado. Solicite uma nova URL de download.");
  }
  const hmac = createHmac("sha256", LOCAL_HMAC_SECRET);
  hmac.update(`${storagePath}:${expires}`);
  const expectedSig = hmac.digest("hex");
  if (sig !== expectedSig) {
    throw new HttpError(403, "Assinatura do link de download inv\xE1lida.");
  }
  const file = localFileStore.get(storagePath);
  if (!file) {
    throw new HttpError(404, "Arquivo n\xE3o encontrado no armazenamento.");
  }
  return file;
}
var MIDIA_BUCKET = "site-publico-midia";
var MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
var ALLOWED_IMAGE_MAP = {
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"]
};
function detectarFormatoReal(buffer) {
  if (buffer.length >= 8 && buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return "image/jpeg";
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}
function validarImagemGaleria(fileName, fileBuffer, reportedMimeType) {
  const safeBaseName = basename(fileName).replace(/[\0\r\n/\\]/g, "");
  if (!safeBaseName || safeBaseName.includes("..")) {
    throw new HttpError(400, "Nome de arquivo inv\xE1lido.");
  }
  const rawExt = extname(safeBaseName).toLowerCase();
  if (!rawExt) {
    throw new HttpError(400, "O arquivo precisa ter extens\xE3o.");
  }
  if (BLOCKED_EXTENSIONS.has(rawExt)) {
    throw new HttpError(400, `Arquivos com extens\xE3o "${rawExt}" n\xE3o s\xE3o aceitos.`);
  }
  const mimesDaExtensao = ALLOWED_IMAGE_MAP[rawExt];
  if (!mimesDaExtensao) {
    throw new HttpError(400, `Formato "${rawExt}" n\xE3o aceito na galeria. Use PNG, JPG ou WEBP.`);
  }
  const normalizedMime = reportedMimeType.toLowerCase().split(";")[0].trim();
  if (!mimesDaExtensao.includes(normalizedMime)) {
    throw new HttpError(400, `O tipo informado (${reportedMimeType}) n\xE3o corresponde \xE0 extens\xE3o "${rawExt}".`);
  }
  if (fileBuffer.length <= 0) {
    throw new HttpError(400, "O arquivo enviado est\xE1 vazio.");
  }
  if (fileBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    const mb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    throw new HttpError(400, `A imagem tem ${mb} MB e o limite \xE9 5 MB. Reduza o arquivo e tente de novo.`);
  }
  const formatoReal = detectarFormatoReal(fileBuffer);
  if (!formatoReal) {
    throw new HttpError(400, "O arquivo n\xE3o \xE9 uma imagem PNG, JPG ou WEBP v\xE1lida.");
  }
  if (formatoReal !== normalizedMime) {
    throw new HttpError(400, `O conte\xFAdo do arquivo \xE9 ${formatoReal}, diferente do que a extens\xE3o "${rawExt}" indica.`);
  }
  const now = /* @__PURE__ */ new Date();
  const ano = now.getUTCFullYear();
  const mes = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storedName = `${randomUUID()}${rawExt}`;
  return {
    originalName: safeBaseName,
    storedName,
    storagePath: `galeria/${ano}/${mes}/${storedName}`,
    mimeType: formatoReal,
    sizeBytes: fileBuffer.length,
    buffer: fileBuffer
  };
}
async function enviarImagemGaleria(imagem, supabaseClient) {
  if (supabaseClient) {
    const { error } = await supabaseClient.storage.from(MIDIA_BUCKET).upload(imagem.storagePath, imagem.buffer, {
      contentType: imagem.mimeType,
      upsert: false,
      cacheControl: "31536000"
    });
    if (error) {
      throw new HttpError(500, `N\xE3o foi poss\xEDvel enviar a imagem: ${error.message}`);
    }
    const { data } = supabaseClient.storage.from(MIDIA_BUCKET).getPublicUrl(imagem.storagePath);
    return {
      storagePath: imagem.storagePath,
      publicUrl: data.publicUrl,
      mimeType: imagem.mimeType,
      sizeBytes: imagem.sizeBytes,
      originalName: imagem.originalName
    };
  }
  localFileStore.set(imagem.storagePath, { buffer: imagem.buffer, mimeType: imagem.mimeType });
  return {
    storagePath: imagem.storagePath,
    publicUrl: `/midia/${imagem.storagePath}`,
    mimeType: imagem.mimeType,
    sizeBytes: imagem.sizeBytes,
    originalName: imagem.originalName
  };
}
async function removerImagemGaleria(storagePath, supabaseClient) {
  if (!storagePath) return;
  if (supabaseClient) {
    await supabaseClient.storage.from(MIDIA_BUCKET).remove([storagePath]);
    return;
  }
  localFileStore.delete(storagePath);
}
function obterImagemLocal(storagePath) {
  return localFileStore.get(storagePath) || null;
}
function caminhoDaUrlDeMidia(url) {
  if (!url) return null;
  const marcador = `/${MIDIA_BUCKET}/`;
  const i = url.indexOf(marcador);
  if (i > -1) return url.slice(i + marcador.length).split("?")[0];
  if (url.startsWith("/midia/")) return url.slice("/midia/".length).split("?")[0];
  return null;
}
var MAX_DOC_PUBLICO_BYTES = 10 * 1024 * 1024;
var ALLOWED_DOC_PUBLICO_MAP = {
  ".pdf": ["application/pdf"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".doc": ["application/msword"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".xls": ["application/vnd.ms-excel"],
  ".odt": ["application/vnd.oasis.opendocument.text"],
  ".ods": ["application/vnd.oasis.opendocument.spreadsheet"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"]
};
function assinaturaCompativel(buffer, mime) {
  const comeca = (bytes) => buffer.length >= bytes.length && bytes.every((b, i) => buffer[i] === b);
  if (mime === "application/pdf") {
    return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
  }
  if (mime === "image/png") return comeca([137, 80, 78, 71, 13, 10, 26, 10]);
  if (mime === "image/jpeg") return comeca([255, 216, 255]);
  const zip = comeca([80, 75, 3, 4]) || comeca([80, 75, 5, 6]) || comeca([80, 75, 7, 8]);
  if (mime.includes("openxmlformats") || mime.includes("opendocument")) return zip;
  if (mime === "application/msword" || mime === "application/vnd.ms-excel") {
    return comeca([208, 207, 17, 224, 161, 177, 26, 225]) || zip;
  }
  return false;
}
function validarDocumentoPublico(fileName, fileBuffer, reportedMimeType) {
  const safeBaseName = basename(fileName).replace(/[\0\r\n/\\]/g, "");
  if (!safeBaseName || safeBaseName.includes("..")) {
    throw new HttpError(400, "Nome de arquivo inv\xE1lido.");
  }
  const rawExt = extname(safeBaseName).toLowerCase();
  if (!rawExt) {
    throw new HttpError(400, "O arquivo precisa ter extens\xE3o.");
  }
  if (BLOCKED_EXTENSIONS.has(rawExt)) {
    throw new HttpError(400, `Arquivos com extens\xE3o "${rawExt}" n\xE3o s\xE3o aceitos.`);
  }
  const mimesDaExtensao = ALLOWED_DOC_PUBLICO_MAP[rawExt];
  if (!mimesDaExtensao) {
    throw new HttpError(
      400,
      `Formato "${rawExt}" n\xE3o aceito. Use PDF, Word, Excel, OpenDocument ou imagem.`
    );
  }
  const normalizedMime = reportedMimeType.toLowerCase().split(";")[0].trim();
  if (!mimesDaExtensao.includes(normalizedMime)) {
    throw new HttpError(400, `O tipo informado (${reportedMimeType}) n\xE3o corresponde \xE0 extens\xE3o "${rawExt}".`);
  }
  if (fileBuffer.length <= 0) {
    throw new HttpError(400, "O arquivo enviado est\xE1 vazio.");
  }
  if (fileBuffer.length > MAX_DOC_PUBLICO_BYTES) {
    const mb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    throw new HttpError(400, `O arquivo tem ${mb} MB e o limite \xE9 10 MB.`);
  }
  if (!assinaturaCompativel(fileBuffer, normalizedMime)) {
    throw new HttpError(
      400,
      `O conte\xFAdo do arquivo n\xE3o corresponde a um ${rawExt.replace(".", "").toUpperCase()} v\xE1lido.`
    );
  }
  const now = /* @__PURE__ */ new Date();
  const ano = now.getUTCFullYear();
  const mes = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storedName = `${randomUUID()}${rawExt}`;
  return {
    originalName: safeBaseName,
    storedName,
    storagePath: `documentos/${ano}/${mes}/${storedName}`,
    mimeType: normalizedMime,
    sizeBytes: fileBuffer.length,
    buffer: fileBuffer
  };
}
async function enviarDocumentoPublico(documento, supabaseClient) {
  return enviarImagemGaleria(documento, supabaseClient);
}
async function removerArquivoMidia(storagePath, supabaseClient) {
  return removerImagemGaleria(storagePath, supabaseClient);
}

// src/services/documento.service.ts
async function createUploadIntentDocumento(input, currentUser, client) {
  if (currentUser.role === "admin_tecnico") {
    throw new HttpError(403, "Acesso negado: administradores t\xE9cnicos n\xE3o possuem permiss\xE3o para upload de documentos.");
  }
  return createUploadIntent(input.fileName, input.mimeType, input.declaredSize, client);
}
async function finalizeDirectUploadDocumento(input, currentUser, client) {
  if (currentUser.role === "admin_tecnico") {
    throw new HttpError(403, "Acesso negado: administradores t\xE9cnicos n\xE3o possuem permiss\xE3o para upload de documentos.");
  }
  const verified = await verifyAndFinalizeUpload(
    input.storagePath,
    input.originalName,
    input.mimeType,
    client
  );
  let initialStatus = "aprovado";
  if (currentUser.role === "docente") {
    initialStatus = "pendente";
  }
  const created = await createDocumento({
    nome_original: input.originalName,
    nome_armazenado: verified.storedName,
    storage_path: input.storagePath,
    mime_type: verified.mimeType,
    tamanho_bytes: verified.sizeBytes,
    categoria: input.categoria || "pedagogico",
    status: initialStatus,
    enviado_por: currentUser.id,
    aprovado_por: initialStatus === "aprovado" ? currentUser.id : null
  }, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "UPLOAD_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(created.id),
    detalhes_json: {
      nome_original: created.nome_original,
      categoria: created.categoria,
      status: created.status,
      tamanho_bytes: created.tamanho_bytes,
      metodo: "DIRECT_SIGNED_UPLOAD"
    }
  }, client);
  return created;
}
async function listUserDocumentos(currentUser, client) {
  if (currentUser.role === "admin_tecnico") {
    return [];
  }
  return listDocumentos(client, currentUser.role || void 0, currentUser.id);
}
async function uploadUserDocumento(fileInfo, currentUser, client) {
  if (currentUser.role === "admin_tecnico") {
    throw new HttpError(403, "Acesso negado: administradores t\xE9cnicos n\xE3o possuem permiss\xE3o para upload de documentos.");
  }
  const validated = validateAndPrepareUpload(fileInfo.fileName, fileInfo.fileBuffer, fileInfo.mimeType);
  let initialStatus = "aprovado";
  if (currentUser.role === "docente") {
    initialStatus = "pendente";
  }
  await uploadToStorage(validated, client);
  const created = await createDocumento({
    nome_original: validated.originalName,
    nome_armazenado: validated.storedName,
    storage_path: validated.storagePath,
    mime_type: validated.mimeType,
    tamanho_bytes: validated.sizeBytes,
    categoria: fileInfo.categoria || "pedagogico",
    status: initialStatus,
    enviado_por: currentUser.id,
    aprovado_por: initialStatus === "aprovado" ? currentUser.id : null
  }, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "UPLOAD_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(created.id),
    detalhes_json: {
      nome_original: created.nome_original,
      categoria: created.categoria,
      status: created.status,
      tamanho_bytes: created.tamanho_bytes
    }
  }, client);
  return created;
}
async function approveUserDocumento(id, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin"].includes(currentUser.role)) {
    throw new HttpError(403, "Apenas administradores (super_admin e admin) possuem permiss\xE3o para aprovar documentos.");
  }
  const doc = await findDocumentoById(id, client);
  if (!doc) {
    throw new HttpError(404, "Documento n\xE3o encontrado.");
  }
  if (doc.enviado_por === currentUser.id) {
    throw new HttpError(403, "Opera\xE7\xE3o proibida: um usu\xE1rio n\xE3o pode aprovar o pr\xF3prio documento submetido.");
  }
  await updateDocumentoStatus(id, "aprovado", currentUser.id, null, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "APROVAR_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(id),
    detalhes_json: { nome_original: doc.nome_original }
  }, client);
}
async function rejectUserDocumento(id, motivo, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin"].includes(currentUser.role)) {
    throw new HttpError(403, "Apenas administradores (super_admin e admin) possuem permiss\xE3o para rejeitar documentos.");
  }
  const doc = await findDocumentoById(id, client);
  if (!doc) {
    throw new HttpError(404, "Documento n\xE3o encontrado.");
  }
  await updateDocumentoStatus(id, "rejeitado", null, motivo, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "REJEITAR_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(id),
    detalhes_json: { nome_original: doc.nome_original, motivo }
  }, client);
}
async function archiveUserDocumento(id, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin"].includes(currentUser.role)) {
    throw new HttpError(403, "Apenas administradores (super_admin e admin) possuem permiss\xE3o para arquivar documentos.");
  }
  const doc = await findDocumentoById(id, client);
  if (!doc) {
    throw new HttpError(404, "Documento n\xE3o encontrado.");
  }
  await updateDocumentoStatus(id, "arquivado", currentUser.id, null, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "ARQUIVAR_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(id),
    detalhes_json: { nome_original: doc.nome_original }
  }, client);
}
async function shareUserDocumento(id, input, currentUser, client) {
  if (!currentUser.role || !["super_admin", "admin"].includes(currentUser.role)) {
    throw new HttpError(403, "Apenas administradores (super_admin e admin) podem compartilhar documentos.");
  }
  const doc = await findDocumentoById(id, client);
  if (!doc) {
    throw new HttpError(404, "Documento n\xE3o encontrado.");
  }
  await addCompartilhamento(id, input.tipo_destino, input.destino_id, currentUser.id, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "COMPARTILHAR_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(id),
    detalhes_json: { tipo_destino: input.tipo_destino, destino_id: input.destino_id }
  }, client);
}
async function getDocumentoDownloadUrl(id, currentUser, client) {
  if (currentUser.role === "admin_tecnico") {
    throw new HttpError(403, "Acesso negado: administradores t\xE9cnicos n\xE3o possuem permiss\xE3o para download de documentos institucionais.");
  }
  const doc = await findDocumentoById(id, client);
  if (!doc) {
    throw new HttpError(404, "Documento n\xE3o encontrado.");
  }
  const isOwner = doc.enviado_por === currentUser.id;
  const isAdmin = !!(currentUser.role && ["super_admin", "admin"].includes(currentUser.role));
  if (!isOwner && !isAdmin) {
    if (doc.status !== "aprovado") {
      throw new HttpError(403, "Acesso negado: documentos pendentes ou rejeitados s\xF3 podem ser acessados pelo autor ou administra\xE7\xE3o.");
    }
    if (currentUser.role === "docente") {
      const docsList = await listDocumentos(client, currentUser.role, currentUser.id);
      const isAuthorized = docsList.some((d) => d.id === id);
      if (!isAuthorized) {
        throw new HttpError(403, "Acesso negado: documento n\xE3o compartilhado com o seu perfil.");
      }
    }
  }
  const signedUrl = await createSignedDownloadUrl(doc.storage_path, 60, client);
  await logAudit({
    user_id: currentUser.id,
    acao: "DOWNLOAD_DOCUMENTO",
    recurso: "documentos",
    registro_id: String(id),
    detalhes_json: { nome_original: doc.nome_original }
  }, client);
  return {
    downloadUrl: signedUrl,
    nomeOriginal: doc.nome_original,
    mimeType: doc.mime_type
  };
}

// src/controllers/documento.controller.ts
async function listDocumentosHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const docs = await listUserDocumentos(user, client);
  return c.json({ success: true, data: docs });
}
async function uploadDocumentoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const body = await c.req.parseBody().catch(() => null);
  if (!body || !body["arquivo"]) {
    throw new HttpError(400, 'Nenhum arquivo enviado no campo "arquivo".');
  }
  const file = body["arquivo"];
  if (typeof file === "string" || !(file instanceof File)) {
    throw new HttpError(400, "Arquivo inv\xE1lido ou formato incorreto.");
  }
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const categoria = typeof body["categoria"] === "string" ? body["categoria"] : "pedagogico";
  const doc = await uploadUserDocumento({
    fileName: file.name,
    fileBuffer,
    mimeType: file.type || "application/octet-stream",
    categoria
  }, user, client);
  return c.json({ success: true, data: doc }, 201);
}
async function getDownloadUrlHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de documento inv\xE1lido.");
  }
  const result = await getDocumentoDownloadUrl(id, user, client);
  return c.json({ success: true, ...result });
}
async function approveDocumentoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de documento inv\xE1lido.");
  }
  await approveUserDocumento(id, user, client);
  return c.json({ success: true, message: "Documento aprovado com sucesso." });
}
async function rejectDocumentoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de documento inv\xE1lido.");
  }
  const body = await c.req.json().catch(() => null);
  const parseResult = rejeitarDocumentoSchema.safeParse(body);
  if (!parseResult.success) {
    throw new HttpError(400, "Motivo da rejei\xE7\xE3o \xE9 obrigat\xF3rio e deve ter ao menos 5 caracteres.");
  }
  await rejectUserDocumento(id, parseResult.data.motivo, user, client);
  return c.json({ success: true, message: "Documento rejeitado." });
}
async function archiveDocumentoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de documento inv\xE1lido.");
  }
  await archiveUserDocumento(id, user, client);
  return c.json({ success: true, message: "Documento arquivado com sucesso." });
}
async function shareDocumentoHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new HttpError(400, "Identificador de documento inv\xE1lido.");
  }
  const body = await c.req.json().catch(() => null);
  const parseResult = createCompartilhamentoSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new HttpError(400, `Dados de compartilhamento inv\xE1lidos: ${errorMsg}`);
  }
  await shareUserDocumento(id, parseResult.data, user, client);
  return c.json({ success: true, message: "Documento compartilhado com sucesso." });
}
async function downloadLocalFileHandler(c) {
  const path = c.req.query("path") || "";
  const expires = c.req.query("expires") || "";
  const sig = c.req.query("sig") || "";
  if (!path || !expires || !sig) {
    throw new HttpError(400, "Par\xE2metros de assinatura incompletos.");
  }
  const file = getLocalFileFromSignedRequest(path, expires, sig);
  c.header("Content-Type", file.mimeType);
  c.header("Content-Disposition", "attachment");
  c.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return c.body(new Uint8Array(file.buffer));
}
async function uploadIntentHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const body = await c.req.json().catch(() => null);
  const parseResult = uploadIntentSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new HttpError(400, `Dados de intent de upload inv\xE1lidos: ${errorMsg}`);
  }
  const intent = await createUploadIntentDocumento(parseResult.data, user, client);
  return c.json({ success: true, data: intent });
}
async function uploadFinalizarHandler(c) {
  const user = c.get("user");
  const client = createHonoSupabaseClient(c);
  const body = await c.req.json().catch(() => null);
  const parseResult = uploadFinalizarSchema.safeParse(body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    throw new HttpError(400, `Dados de finaliza\xE7\xE3o de upload inv\xE1lidos: ${errorMsg}`);
  }
  const doc = await finalizeDirectUploadDocumento(parseResult.data, user, client);
  return c.json({ success: true, data: doc }, 201);
}
async function directUploadLocalHandler(c) {
  const path = c.req.query("path") || "";
  const expires = c.req.query("expires") || "";
  const sig = c.req.query("sig") || "";
  if (!path || !expires || !sig) {
    throw new HttpError(400, "Par\xE2metros de assinatura incompletos.");
  }
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || Date.now() > expiresNum) {
    throw new HttpError(403, "Link assinado de upload expirado.");
  }
  const rawBody = await c.req.arrayBuffer();
  const contentType = c.req.header("content-type") || "application/octet-stream";
  saveLocalDirectUpload(path, Buffer.from(rawBody), contentType);
  return c.json({ success: true, message: "Upload direto local conclu\xEDdo com sucesso." });
}

// src/routes/documento.routes.ts
var router2 = new Hono6();
router2.get("/download-file", downloadLocalFileHandler);
router2.put("/upload-direct-local", directUploadLocalHandler);
router2.get("/", requireAuth, listDocumentosHandler);
router2.post("/upload-intent", requireAuth, csrfProtection, requireRole("super_admin", "admin", "secretaria", "docente"), uploadIntentHandler);
router2.post("/upload-finalizar", requireAuth, csrfProtection, requireRole("super_admin", "admin", "secretaria", "docente"), uploadFinalizarHandler);
router2.post("/upload", requireAuth, csrfProtection, requireRole("super_admin", "admin", "secretaria", "docente"), uploadDocumentoHandler);
router2.get("/:id/download-url", requireAuth, getDownloadUrlHandler);
router2.patch("/:id/aprovar", requireAuth, csrfProtection, requireRole("super_admin", "admin"), approveDocumentoHandler);
router2.patch("/:id/rejeitar", requireAuth, csrfProtection, requireRole("super_admin", "admin"), rejectDocumentoHandler);
router2.patch("/:id/arquivar", requireAuth, csrfProtection, requireRole("super_admin", "admin"), archiveDocumentoHandler);
router2.post("/:id/compartilhar", requireAuth, csrfProtection, requireRole("super_admin", "admin"), shareDocumentoHandler);
var documento_routes_default = router2;

// src/routes/formulario.routes.ts
import { Hono as Hono7 } from "hono";
var formularioRoutes = new Hono7();
formularioRoutes.use("*", requireAuth, requireRole("super_admin", "admin"));
formularioRoutes.post("/", rateLimit({ maxRequests: 10, windowMs: 6e4 }), postFormulario);
formularioRoutes.get("/", getFormulario);
var formulario_routes_default = formularioRoutes;

// src/routes/health.routes.ts
import { Hono as Hono8 } from "hono";

// src/controllers/health.controller.ts
function getHealth(c) {
  return c.json({ status: "ok" }, 200);
}

// src/routes/health.routes.ts
var healthRoutes = new Hono8();
healthRoutes.get("/", getHealth);
var health_routes_default = healthRoutes;

// src/routes/pages.routes.ts
import { Hono as Hono9 } from "hono";

// src/repositories/site-cms.repository.ts
import { randomUUID as randomUUID2 } from "node:crypto";
var TABELAS_CMS = {
  site_pagina_inicial: {
    singleton: true,
    colunas: {
      hero_titulo: "texto",
      hero_subtitulo: "texto",
      hero_chamada: "texto",
      cta_texto: "texto",
      cta_link: "texto",
      banner_imagem_url: "texto",
      destaques_ativo: "booleano"
    },
    ordenacao: { coluna: "id", ascendente: true }
  },
  site_pagina_inicial_destaques: {
    colunas: {
      etiqueta: "texto",
      titulo: "texto",
      titulo_destaque: "texto",
      subtitulo: "texto",
      descricao: "texto",
      cta_texto: "texto",
      cta_link: "texto",
      paleta: "texto",
      imagem_url: "texto",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_sobre: {
    singleton: true,
    colunas: {
      titulo: "texto",
      apresentacao: "texto",
      historia: "texto",
      missao: "texto",
      visao: "texto",
      valores: "texto",
      proposta_pedagogica: "texto",
      estrutura: "texto",
      imagem_url: "texto"
    },
    ordenacao: { coluna: "id", ascendente: true }
  },
  site_contatos: {
    singleton: true,
    colunas: {
      telefones_json: "listaJson",
      emails_json: "listaJson",
      horario_atendimento: "texto",
      endereco: "texto",
      instagram_url: "texto",
      facebook_url: "texto",
      youtube_url: "texto",
      orientacoes: "texto"
    },
    ordenacao: { coluna: "id", ascendente: true }
  },
  site_cursos: {
    colunas: {
      nome: "texto",
      modalidade: "texto",
      turno: "texto",
      descricao: "texto",
      informacoes_adicionais: "texto",
      imagem_url: "texto",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_projetos: {
    colunas: {
      titulo: "texto",
      resumo: "texto",
      conteudo: "texto",
      capa_url: "texto",
      responsaveis: "texto",
      periodo: "texto",
      destaque: "booleano",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_noticias: {
    colunas: {
      titulo: "texto",
      slug: "texto",
      resumo: "texto",
      conteudo: "texto",
      capa_url: "texto",
      categoria: "texto",
      autor: "texto",
      data_publicacao: "data",
      destaque: "booleano"
    },
    ordenacao: { coluna: "data_publicacao", ascendente: false }
  },
  site_albuns: {
    colunas: {
      titulo: "texto",
      descricao: "texto",
      capa_url: "texto",
      data_album: "data",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_fotos: {
    semStatus: true,
    colunas: { album_id: "texto", imagem_url: "texto", legenda: "texto", ordem: "numero" },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_equipe: {
    colunas: {
      nome: "texto",
      funcao_publica: "texto",
      foto_url: "texto",
      descricao: "texto",
      grupo: "texto",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_documentos: {
    colunas: {
      titulo: "texto",
      descricao: "texto",
      categoria: "texto",
      arquivo_url: "texto",
      data_publicacao: "data",
      ordem: "numero",
      // Procedência do arquivo anexado. Só a rota de upload escreve nestas
      // colunas: o formulário da administração não as envia, e o schema
      // Zod as descarta, para que editar o título não apague o anexo.
      arquivo_nome: "texto",
      arquivo_tipo: "texto",
      arquivo_tamanho: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_links: {
    colunas: {
      titulo: "texto",
      url: "texto",
      descricao: "texto",
      categoria: "texto",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  },
  site_secoes_extras: {
    colunas: {
      titulo: "texto",
      subtitulo: "texto",
      conteudo: "texto",
      imagem_url: "texto",
      ordem: "numero"
    },
    ordenacao: { coluna: "ordem", ascendente: true }
  }
};
function parametros(payload, colunas) {
  return colunas.map((c) => payload[c]);
}
function def(tabela) {
  return TABELAS_CMS[tabela];
}
function colunasSelect(tabela) {
  const d = def(tabela);
  const base = ["id", ...Object.keys(d.colunas)];
  if (!d.semStatus) base.push("status", "publicado_em");
  base.push("created_at", "updated_at");
  return base;
}
function normalizarRegistro(tabela, row) {
  const d = def(tabela);
  const saida = { id: String(row.id) };
  for (const [coluna, tipo] of Object.entries(d.colunas)) {
    const valor = row[coluna];
    switch (tipo) {
      case "booleano":
        saida[coluna] = Boolean(valor);
        break;
      case "numero":
        saida[coluna] = Number(valor ?? 0);
        break;
      case "listaJson":
        saida[coluna] = parseListaJson(valor);
        break;
      case "data":
        saida[coluna] = valor ? String(valor).slice(0, 10) : "";
        break;
      default:
        saida[coluna] = valor === null || valor === void 0 ? "" : String(valor);
    }
  }
  if (!d.semStatus) {
    saida.status = row.status || "rascunho";
    saida.publicado_em = row.publicado_em ? String(row.publicado_em) : null;
  }
  saida.created_at = row.created_at ? String(row.created_at) : null;
  saida.updated_at = row.updated_at ? String(row.updated_at) : null;
  return saida;
}
function parseListaJson(valor) {
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === "string" && valor.trim()) {
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}
function serializarValor(tipo, valor, motor) {
  switch (tipo) {
    case "booleano":
      return motor === "sqlite" ? valor ? 1 : 0 : Boolean(valor);
    case "numero":
      return Number(valor ?? 0);
    case "listaJson": {
      const lista = Array.isArray(valor) ? valor.map(String) : [];
      return motor === "sqlite" ? JSON.stringify(lista) : lista;
    }
    case "data": {
      const texto2 = typeof valor === "string" ? valor.trim() : "";
      if (!texto2) return motor === "sqlite" ? "" : null;
      return texto2;
    }
    default:
      return valor === null || valor === void 0 ? "" : String(valor);
  }
}
function montarPayload(tabela, dados, motor) {
  const d = def(tabela);
  const payload = {};
  for (const [coluna, tipo] of Object.entries(d.colunas)) {
    if (Object.prototype.hasOwnProperty.call(dados, coluna)) {
      payload[coluna] = serializarValor(tipo, dados[coluna], motor);
    }
  }
  return payload;
}
function carimboPublicacao(status, motor) {
  if (status !== "publicado") return null;
  return motor === "sqlite" ? (/* @__PURE__ */ new Date()).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
}
async function listarRegistros(tabela, opcoes = {}, client) {
  const d = def(tabela);
  const colunas = colunasSelect(tabela);
  const filtrarPublicados = Boolean(opcoes.apenasPublicados) && !d.semStatus;
  if (client) {
    let consulta = client.from(tabela).select(colunas.join(", "));
    if (filtrarPublicados) consulta = consulta.eq("status", "publicado");
    consulta = consulta.order(d.ordenacao.coluna, { ascending: d.ordenacao.ascendente });
    if (opcoes.limite) consulta = consulta.limit(opcoes.limite);
    const { data, error } = await consulta;
    if (error || !data) return [];
    return data.map((r) => normalizarRegistro(tabela, r));
  }
  if (hasPostgresConfig()) {
    const where2 = filtrarPublicados ? `WHERE status = 'publicado'` : "";
    const direcao2 = d.ordenacao.ascendente ? "ASC" : "DESC";
    const limite2 = opcoes.limite ? `LIMIT ${Number(opcoes.limite)}` : "";
    const resultado = await queryPostgres(
      `SELECT ${colunas.join(", ")} FROM public.${tabela} ${where2} ORDER BY ${d.ordenacao.coluna} ${direcao2} ${limite2}`
    );
    return resultado.rows.map((r) => normalizarRegistro(tabela, r));
  }
  const db = getDatabase();
  const where = filtrarPublicados ? `WHERE status = 'publicado'` : "";
  const direcao = d.ordenacao.ascendente ? "ASC" : "DESC";
  const limite = opcoes.limite ? `LIMIT ${Number(opcoes.limite)}` : "";
  const rows = db.prepare(`SELECT ${colunas.join(", ")} FROM ${tabela} ${where} ORDER BY ${d.ordenacao.coluna} ${direcao} ${limite}`).all();
  return rows.map((r) => normalizarRegistro(tabela, r));
}
async function obterRegistro(tabela, id, client) {
  const colunas = colunasSelect(tabela);
  if (client) {
    const { data, error } = await client.from(tabela).select(colunas.join(", ")).eq("id", id).maybeSingle();
    if (error || !data) return null;
    return normalizarRegistro(tabela, data);
  }
  if (hasPostgresConfig()) {
    const resultado = await queryPostgres(
      `SELECT ${colunas.join(", ")} FROM public.${tabela} WHERE id = $1 LIMIT 1`,
      [id]
    );
    return resultado.rows[0] ? normalizarRegistro(tabela, resultado.rows[0]) : null;
  }
  const db = getDatabase();
  const row = db.prepare(`SELECT ${colunas.join(", ")} FROM ${tabela} WHERE id = ? LIMIT 1`).get(id);
  return row ? normalizarRegistro(tabela, row) : null;
}
async function obterSingleton(tabela, client) {
  return obterRegistro(tabela, "1", client);
}
async function salvarSingleton(tabela, dados, atualizadoPor, client) {
  const status = dados.status;
  if (client) {
    const payload2 = montarPayload(tabela, dados, "supabase");
    payload2.status = status || "rascunho";
    payload2.atualizado_por = atualizadoPor;
    payload2.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (status === "publicado") payload2.publicado_em = carimboPublicacao(status, "supabase");
    const { error } = await client.from(tabela).update(payload2).eq("id", 1);
    if (error) throw new Error(`Falha ao salvar a se\xE7\xE3o: ${error.message}`);
    return obterSingleton(tabela, client);
  }
  if (hasPostgresConfig()) {
    const payload2 = montarPayload(tabela, dados, "postgres");
    payload2.status = status || "rascunho";
    payload2.atualizado_por = atualizadoPor;
    payload2.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    if (status === "publicado") payload2.publicado_em = carimboPublicacao(status, "postgres");
    const colunas2 = Object.keys(payload2);
    const atribuicoes2 = colunas2.map((c, i) => `${c} = $${i + 1}`).join(", ");
    await queryPostgres(
      `UPDATE public.${tabela} SET ${atribuicoes2} WHERE id = 1`,
      parametros(payload2, colunas2)
    );
    return obterSingleton(tabela);
  }
  const db = getDatabase();
  const payload = montarPayload(tabela, dados, "sqlite");
  payload.status = status || "rascunho";
  payload.atualizado_por = atualizadoPor;
  payload.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  if (status === "publicado") payload.publicado_em = carimboPublicacao(status, "sqlite");
  const colunas = Object.keys(payload);
  const atribuicoes = colunas.map((c) => `${c} = ?`).join(", ");
  db.prepare(`UPDATE ${tabela} SET ${atribuicoes} WHERE id = 1`).run(...colunas.map((c) => payload[c]));
  return obterSingleton(tabela);
}
async function criarRegistro(tabela, dados, atualizadoPor, client) {
  const d = def(tabela);
  const id = randomUUID2();
  const status = dados.status;
  if (client) {
    const payload2 = montarPayload(tabela, dados, "supabase");
    payload2.id = id;
    if (!d.semStatus) {
      payload2.status = status || "rascunho";
      payload2.publicado_em = carimboPublicacao(status, "supabase");
      payload2.atualizado_por = atualizadoPor;
    }
    const { error } = await client.from(tabela).insert(payload2);
    if (error) throw new Error(`Falha ao criar registro: ${error.message}`);
    return obterRegistro(tabela, id, client);
  }
  if (hasPostgresConfig()) {
    const payload2 = montarPayload(tabela, dados, "postgres");
    payload2.id = id;
    if (!d.semStatus) {
      payload2.status = status || "rascunho";
      payload2.publicado_em = carimboPublicacao(status, "postgres");
      payload2.atualizado_por = atualizadoPor;
    }
    const colunas2 = Object.keys(payload2);
    const marcadores2 = colunas2.map((_, i) => `$${i + 1}`).join(", ");
    await queryPostgres(
      `INSERT INTO public.${tabela} (${colunas2.join(", ")}) VALUES (${marcadores2})`,
      parametros(payload2, colunas2)
    );
    return obterRegistro(tabela, id);
  }
  const db = getDatabase();
  const payload = montarPayload(tabela, dados, "sqlite");
  payload.id = id;
  if (!d.semStatus) {
    payload.status = status || "rascunho";
    payload.publicado_em = carimboPublicacao(status, "sqlite");
    payload.atualizado_por = atualizadoPor;
  }
  const colunas = Object.keys(payload);
  const marcadores = colunas.map(() => "?").join(", ");
  db.prepare(`INSERT INTO ${tabela} (${colunas.join(", ")}) VALUES (${marcadores})`).run(...colunas.map((c) => payload[c]));
  return obterRegistro(tabela, id);
}
async function atualizarRegistro(tabela, id, dados, atualizadoPor, client) {
  const d = def(tabela);
  const status = dados.status;
  const aplicarComuns = (payload2, motor) => {
    if (!d.semStatus && status) {
      payload2.status = status;
      if (status === "publicado") payload2.publicado_em = carimboPublicacao(status, motor);
    }
    if (!d.semStatus) payload2.atualizado_por = atualizadoPor;
    payload2.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    return payload2;
  };
  if (client) {
    const payload2 = aplicarComuns(montarPayload(tabela, dados, "supabase"), "supabase");
    const { error } = await client.from(tabela).update(payload2).eq("id", id);
    if (error) throw new Error(`Falha ao atualizar registro: ${error.message}`);
    return obterRegistro(tabela, id, client);
  }
  if (hasPostgresConfig()) {
    const payload2 = aplicarComuns(montarPayload(tabela, dados, "postgres"), "postgres");
    const colunas2 = Object.keys(payload2);
    const atribuicoes2 = colunas2.map((c, i) => `${c} = $${i + 1}`).join(", ");
    await queryPostgres(
      `UPDATE public.${tabela} SET ${atribuicoes2} WHERE id = $${colunas2.length + 1}`,
      [...parametros(payload2, colunas2), id]
    );
    return obterRegistro(tabela, id);
  }
  const db = getDatabase();
  const payload = aplicarComuns(montarPayload(tabela, dados, "sqlite"), "sqlite");
  const colunas = Object.keys(payload);
  const atribuicoes = colunas.map((c) => `${c} = ?`).join(", ");
  db.prepare(`UPDATE ${tabela} SET ${atribuicoes} WHERE id = ?`).run(...[...colunas.map((c) => payload[c]), id]);
  return obterRegistro(tabela, id);
}
async function alterarStatusRegistro(tabela, id, status, atualizadoPor, client) {
  if (def(tabela).semStatus) {
    throw new Error(`A tabela ${tabela} n\xE3o possui controle pr\xF3prio de publica\xE7\xE3o.`);
  }
  const agora = (/* @__PURE__ */ new Date()).toISOString();
  if (client) {
    const payload = { status, atualizado_por: atualizadoPor, updated_at: agora };
    if (status === "publicado") payload.publicado_em = agora;
    const { error } = await client.from(tabela).update(payload).eq("id", id);
    if (error) throw new Error(`Falha ao alterar o estado de publica\xE7\xE3o: ${error.message}`);
    return obterRegistro(tabela, id, client);
  }
  if (hasPostgresConfig()) {
    if (status === "publicado") {
      await queryPostgres(
        `UPDATE public.${tabela} SET status = $1, publicado_em = $2, atualizado_por = $3, updated_at = $4 WHERE id = $5`,
        [status, agora, atualizadoPor, agora, id]
      );
    } else {
      await queryPostgres(
        `UPDATE public.${tabela} SET status = $1, atualizado_por = $2, updated_at = $3 WHERE id = $4`,
        [status, atualizadoPor, agora, id]
      );
    }
    return obterRegistro(tabela, id);
  }
  const db = getDatabase();
  if (status === "publicado") {
    db.prepare(`UPDATE ${tabela} SET status = ?, publicado_em = ?, atualizado_por = ?, updated_at = ? WHERE id = ?`).run(status, agora, atualizadoPor, agora, id);
  } else {
    db.prepare(`UPDATE ${tabela} SET status = ?, atualizado_por = ?, updated_at = ? WHERE id = ?`).run(status, atualizadoPor, agora, id);
  }
  return obterRegistro(tabela, id);
}
async function removerRegistro(tabela, id, client) {
  if (client) {
    const { error } = await client.from(tabela).delete().eq("id", id);
    if (error) throw new Error(`Falha ao remover registro: ${error.message}`);
    return;
  }
  if (hasPostgresConfig()) {
    await queryPostgres(`DELETE FROM public.${tabela} WHERE id = $1`, [id]);
    return;
  }
  const db = getDatabase();
  db.prepare(`DELETE FROM ${tabela} WHERE id = ?`).run(id);
}
async function reordenarRegistros(tabela, itens2, client) {
  if (!Object.prototype.hasOwnProperty.call(def(tabela).colunas, "ordem")) {
    throw new Error(`A tabela ${tabela} n\xE3o suporta reordena\xE7\xE3o.`);
  }
  const agora = (/* @__PURE__ */ new Date()).toISOString();
  if (client) {
    for (const item of itens2) {
      const { error } = await client.from(tabela).update({ ordem: item.ordem, updated_at: agora }).eq("id", item.id);
      if (error) throw new Error(`Falha ao reordenar: ${error.message}`);
    }
    return;
  }
  if (hasPostgresConfig()) {
    for (const item of itens2) {
      await queryPostgres(
        `UPDATE public.${tabela} SET ordem = $1, updated_at = $2 WHERE id = $3`,
        [item.ordem, agora, item.id]
      );
    }
    return;
  }
  const db = getDatabase();
  db.exec("BEGIN");
  try {
    const stmt = db.prepare(`UPDATE ${tabela} SET ordem = ?, updated_at = ? WHERE id = ?`);
    for (const item of itens2) {
      stmt.run(item.ordem, agora, item.id);
    }
    db.exec("COMMIT");
  } catch (erro) {
    try {
      db.exec("ROLLBACK");
    } catch {
    }
    throw erro;
  }
}
async function slugNoticiaEmUso(slug, ignorarId, client) {
  if (client) {
    let consulta = client.from("site_noticias").select("id").eq("slug", slug);
    if (ignorarId) consulta = consulta.neq("id", ignorarId);
    const { data } = await consulta.limit(1);
    return Boolean(data && data.length > 0);
  }
  if (hasPostgresConfig()) {
    const resultado = ignorarId ? await queryPostgres(
      "SELECT id FROM public.site_noticias WHERE slug = $1 AND id <> $2 LIMIT 1",
      [slug, ignorarId]
    ) : await queryPostgres(
      "SELECT id FROM public.site_noticias WHERE slug = $1 LIMIT 1",
      [slug]
    );
    return resultado.rows.length > 0;
  }
  const db = getDatabase();
  const row = ignorarId ? db.prepare("SELECT id FROM site_noticias WHERE slug = ? AND id <> ? LIMIT 1").get(slug, ignorarId) : db.prepare("SELECT id FROM site_noticias WHERE slug = ? LIMIT 1").get(slug);
  return Boolean(row);
}
async function listarFotosDoAlbum(albumId, client) {
  const colunas = colunasSelect("site_fotos");
  if (client) {
    const { data, error } = await client.from("site_fotos").select(colunas.join(", ")).eq("album_id", albumId).order("ordem", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => normalizarRegistro("site_fotos", r));
  }
  if (hasPostgresConfig()) {
    const resultado = await queryPostgres(
      `SELECT ${colunas.join(", ")} FROM public.site_fotos WHERE album_id = $1 ORDER BY ordem ASC`,
      [albumId]
    );
    return resultado.rows.map((r) => normalizarRegistro("site_fotos", r));
  }
  const db = getDatabase();
  const rows = db.prepare(`SELECT ${colunas.join(", ")} FROM site_fotos WHERE album_id = ? ORDER BY ordem ASC`).all(albumId);
  return rows.map((r) => normalizarRegistro("site_fotos", r));
}

// src/schemas/site-cms.schema.ts
import { z as z6 } from "zod";
var safeText2 = (field, max) => z6.string({ error: `${field} deve ser texto.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitido.`).transform(sanitizeText);
var optionalText2 = (field, max) => safeText2(field, max).optional().default("");
var requiredText2 = (field, min, max) => z6.string({ error: `${field} deve ser texto.` }).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitido.`).transform(sanitizeText);
var ALLOWED_URL_PROTOCOLS = ["http:", "https:"];
function isSafeUrl(value) {
  if (value === "") return true;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    return ALLOWED_URL_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
var urlField2 = (field, max = 500) => z6.string({ error: `${field} deve ser texto.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine(isSafeUrl, `${field} deve ser um endere\xE7o http(s) v\xE1lido.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText).optional().default("");
var requiredUrlField = (field, max = 500) => z6.string({ error: `${field} deve ser texto.` }).trim().min(1, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine(isSafeUrl, `${field} deve ser um endere\xE7o http(s) v\xE1lido.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText);
var emailField2 = (field) => z6.string({ error: `${field} deve ser texto.` }).trim().max(254, `${field} excede o tamanho m\xE1ximo.`).refine((value) => value === "" || z6.email().safeParse(value).success, `${field} inv\xE1lido.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText);
var dateField = (field) => z6.string({ error: `${field} deve ser texto.` }).trim().refine(
  (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
  `${field} deve estar no formato AAAA-MM-DD.`
).optional().default("");
var ordemField = z6.number({ error: "Ordem deve ser num\xE9rica." }).int("Ordem deve ser um n\xFAmero inteiro.").min(0, "Ordem n\xE3o pode ser negativa.").max(9999, "Ordem excede o limite permitido.").optional().default(0);
var idField = (field) => z6.string({ error: `${field} deve ser texto.` }).trim().min(1, `${field} \xE9 obrigat\xF3rio.`).max(64, `${field} excede o tamanho m\xE1ximo.`).regex(/^[A-Za-z0-9_-]+$/, `${field} possui formato inv\xE1lido.`);
var SITE_STATUS = ["rascunho", "publicado", "oculto"];
var statusField = z6.enum(SITE_STATUS, { error: "Status deve ser rascunho, publicado ou oculto." }).optional().default("rascunho");
var slugField = z6.string({ error: "Endere\xE7o da not\xEDcia deve ser texto." }).trim().min(3, "Endere\xE7o da not\xEDcia deve ter ao menos 3 caracteres.").max(160, "Endere\xE7o da not\xEDcia excede o tamanho m\xE1ximo.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Endere\xE7o da not\xEDcia deve conter apenas letras min\xFAsculas, n\xFAmeros e h\xEDfens.");
function gerarSlug(titulo) {
  return titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}
var paginaInicialSchema = z6.object({
  hero_titulo: optionalText2("T\xEDtulo principal", 160),
  hero_subtitulo: optionalText2("Subt\xEDtulo", 220),
  hero_chamada: optionalText2("Chamada", 600),
  cta_texto: optionalText2("Texto do bot\xE3o", 80),
  cta_link: urlField2("Link do bot\xE3o"),
  banner_imagem_url: urlField2("Imagem do banner"),
  destaques_ativo: z6.boolean({ error: "Destaques deve ser verdadeiro ou falso." }).optional().default(true),
  status: statusField
}).strip();
var PALETAS_HERO = ["dourado", "azul", "roxo", "verde", "coral"];
var paletaHeroField = z6.enum(PALETAS_HERO, { error: "Cor de destaque inv\xE1lida." }).optional().default("dourado");
var heroDestaqueSchema = z6.object({
  etiqueta: optionalText2("Etiqueta", 80),
  titulo: requiredText2("T\xEDtulo", 1, 120),
  titulo_destaque: optionalText2("Trecho em destaque", 120),
  subtitulo: optionalText2("Subt\xEDtulo", 160),
  descricao: optionalText2("Descri\xE7\xE3o", 600),
  cta_texto: optionalText2("Texto do bot\xE3o", 80),
  cta_link: urlField2("Link do bot\xE3o"),
  paleta: paletaHeroField,
  imagem_url: urlField2("Imagem de fundo"),
  ordem: ordemField,
  status: statusField
}).strip();
var sobreSchema = z6.object({
  titulo: optionalText2("T\xEDtulo", 160),
  apresentacao: optionalText2("Apresenta\xE7\xE3o", 3e3),
  historia: optionalText2("Hist\xF3ria", 5e3),
  missao: optionalText2("Miss\xE3o", 1500),
  visao: optionalText2("Vis\xE3o", 1500),
  valores: optionalText2("Valores", 1500),
  proposta_pedagogica: optionalText2("Proposta pedag\xF3gica", 5e3),
  estrutura: optionalText2("Estrutura", 3e3),
  imagem_url: urlField2("Imagem"),
  status: statusField
}).strip();
var cursoSchema2 = z6.object({
  nome: requiredText2("Nome do curso", 1, 160),
  modalidade: optionalText2("Modalidade", 120),
  turno: optionalText2("Turno", 80),
  descricao: optionalText2("Descri\xE7\xE3o", 2e3),
  informacoes_adicionais: optionalText2("Informa\xE7\xF5es adicionais", 2e3),
  imagem_url: urlField2("Imagem do curso"),
  ordem: ordemField,
  status: statusField
}).strip();
var projetoSchema = z6.object({
  titulo: requiredText2("T\xEDtulo do projeto", 1, 180),
  resumo: optionalText2("Resumo", 600),
  conteudo: optionalText2("Conte\xFAdo", 8e3),
  capa_url: urlField2("Capa do projeto"),
  responsaveis: optionalText2("Respons\xE1veis", 400),
  periodo: optionalText2("Per\xEDodo", 120),
  destaque: z6.boolean({ error: "Destaque deve ser verdadeiro ou falso." }).optional().default(false),
  ordem: ordemField,
  status: statusField
}).strip();
var noticiaSchema = z6.object({
  titulo: requiredText2("T\xEDtulo da not\xEDcia", 1, 180),
  slug: slugField.optional(),
  resumo: optionalText2("Resumo", 600),
  conteudo: optionalText2("Conte\xFAdo", 12e3),
  capa_url: urlField2("Capa da not\xEDcia"),
  categoria: optionalText2("Categoria", 80),
  autor: optionalText2("Autor", 120),
  data_publicacao: dateField("Data de publica\xE7\xE3o"),
  destaque: z6.boolean({ error: "Destaque deve ser verdadeiro ou falso." }).optional().default(false),
  status: statusField
}).strip();
var albumSchema = z6.object({
  titulo: requiredText2("T\xEDtulo do \xE1lbum", 1, 180),
  descricao: optionalText2("Descri\xE7\xE3o do \xE1lbum", 1200),
  capa_url: urlField2("Capa do \xE1lbum"),
  data_album: dateField("Data do \xE1lbum"),
  ordem: ordemField,
  status: statusField
}).strip();
var fotoSchema = z6.object({
  imagem_url: requiredUrlField("Endere\xE7o da imagem"),
  legenda: optionalText2("Legenda", 300),
  ordem: ordemField
}).strip();
var equipeSchema = z6.object({
  nome: requiredText2("Nome", 1, 160),
  funcao_publica: optionalText2("Fun\xE7\xE3o p\xFAblica", 160),
  foto_url: urlField2("Foto"),
  descricao: optionalText2("Descri\xE7\xE3o", 1200),
  grupo: optionalText2("Grupo", 120),
  ordem: ordemField,
  status: statusField
}).strip();
var contatosSchema = z6.object({
  telefones: z6.array(safeText2("Telefone", 40)).max(10, "M\xE1ximo de 10 telefones.").optional().default([]),
  emails: z6.array(emailField2("E-mail")).max(10, "M\xE1ximo de 10 e-mails.").optional().default([]),
  horario_atendimento: optionalText2("Hor\xE1rio de atendimento", 400),
  endereco: optionalText2("Endere\xE7o", 300),
  instagram_url: urlField2("Instagram"),
  facebook_url: urlField2("Facebook"),
  youtube_url: urlField2("YouTube"),
  orientacoes: optionalText2("Orienta\xE7\xF5es", 1500),
  status: statusField
}).strip();
var documentoPublicoSchema = z6.object({
  titulo: requiredText2("T\xEDtulo do documento", 1, 180),
  descricao: optionalText2("Descri\xE7\xE3o", 1e3),
  categoria: optionalText2("Categoria", 100),
  arquivo_url: urlField2("Endere\xE7o do arquivo"),
  data_publicacao: dateField("Data de publica\xE7\xE3o"),
  ordem: ordemField,
  status: statusField
}).strip();
var linkUtilSchema = z6.object({
  titulo: requiredText2("T\xEDtulo do link", 1, 180),
  url: requiredUrlField("Endere\xE7o do link"),
  descricao: optionalText2("Descri\xE7\xE3o", 600),
  categoria: optionalText2("Categoria", 100),
  ordem: ordemField,
  status: statusField
}).strip();
var secaoExtraSchema = z6.object({
  titulo: requiredText2("T\xEDtulo da se\xE7\xE3o", 1, 180),
  subtitulo: optionalText2("Subt\xEDtulo", 220),
  conteudo: optionalText2("Conte\xFAdo", 8e3),
  imagem_url: urlField2("Imagem"),
  ordem: ordemField,
  status: statusField
}).strip();
var alterarStatusSchema = z6.object({
  status: z6.enum(SITE_STATUS, { error: "Status deve ser rascunho, publicado ou oculto." })
}).strip();
var reordenarSchema = z6.object({
  itens: z6.array(z6.object({
    id: idField("Identificador"),
    ordem: z6.number().int().min(0).max(9999)
  }).strip()).min(1, "Informe ao menos um item para reordenar.").max(200, "Excesso de itens em uma \xFAnica reordena\xE7\xE3o.")
}).strip();
var AREAS_CMS = [
  { chave: "inicio", titulo: "P\xE1gina Inicial", tipo: "singleton", tabela: "site_pagina_inicial" },
  { chave: "hero", titulo: "Destaques do Her\xF3i", tipo: "colecao", tabela: "site_pagina_inicial_destaques" },
  { chave: "sobre", titulo: "Sobre a Escola", tipo: "singleton", tabela: "site_sobre" },
  { chave: "cursos", titulo: "Cursos e Modalidades", tipo: "colecao", tabela: "site_cursos" },
  { chave: "projetos", titulo: "Projetos", tipo: "colecao", tabela: "site_projetos" },
  { chave: "noticias", titulo: "Not\xEDcias e Avisos P\xFAblicos", tipo: "colecao", tabela: "site_noticias" },
  { chave: "galeria", titulo: "Galeria", tipo: "colecao", tabela: "site_albuns" },
  { chave: "equipe", titulo: "Equipe", tipo: "colecao", tabela: "site_equipe" },
  { chave: "contatos", titulo: "Contatos", tipo: "singleton", tabela: "site_contatos" },
  { chave: "documentos", titulo: "Documentos P\xFAblicos", tipo: "colecao", tabela: "site_documentos" },
  { chave: "links", titulo: "Links \xDAteis", tipo: "colecao", tabela: "site_links" },
  { chave: "secoes", titulo: "Se\xE7\xF5es Adicionais", tipo: "colecao", tabela: "site_secoes_extras" }
];
function isAreaCmsValida(chave) {
  return typeof chave === "string" && AREAS_CMS.some((a) => a.chave === chave);
}

// src/services/site-cms.service.ts
var AREA_PARA_TABELA = {
  inicio: "site_pagina_inicial",
  hero: "site_pagina_inicial_destaques",
  sobre: "site_sobre",
  cursos: "site_cursos",
  projetos: "site_projetos",
  noticias: "site_noticias",
  galeria: "site_albuns",
  equipe: "site_equipe",
  contatos: "site_contatos",
  documentos: "site_documentos",
  links: "site_links",
  secoes: "site_secoes_extras"
};
var AREAS_SINGLETON = ["inicio", "sobre", "contatos"];
function isAreaSingleton(area) {
  return AREAS_SINGLETON.includes(area);
}
function tabelaDaArea(area) {
  return AREA_PARA_TABELA[area];
}
function validarEntradaArea(area, entrada) {
  const schemas = {
    inicio: paginaInicialSchema,
    hero: heroDestaqueSchema,
    sobre: sobreSchema,
    cursos: cursoSchema2,
    projetos: projetoSchema,
    noticias: noticiaSchema,
    galeria: albumSchema,
    equipe: equipeSchema,
    contatos: contatosSchema,
    documentos: documentoPublicoSchema,
    links: linkUtilSchema,
    secoes: secaoExtraSchema
  };
  const resultado = schemas[area].safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, erros: resultado.error.issues.map((i) => i.message) };
  }
  return { ok: true, dados: resultado.data };
}
function prepararContatos(dados) {
  const { telefones, emails, ...resto } = dados;
  return {
    ...resto,
    telefones_json: Array.isArray(telefones) ? telefones : [],
    emails_json: Array.isArray(emails) ? emails : []
  };
}
function expandirContatos(registro) {
  if (!registro) return null;
  const { telefones_json, emails_json, ...resto } = registro;
  return {
    ...resto,
    telefones: Array.isArray(telefones_json) ? telefones_json : [],
    emails: Array.isArray(emails_json) ? emails_json : []
  };
}
async function obterAreaAdmin(area, client) {
  const tabela = tabelaDaArea(area);
  if (isAreaSingleton(area)) {
    const registro = await obterSingleton(tabela, client);
    return area === "contatos" ? expandirContatos(registro) : registro;
  }
  const itens2 = await listarRegistros(tabela, {}, client);
  if (area === "galeria") {
    return Promise.all(itens2.map(async (album) => ({
      ...album,
      fotos: await listarFotosDoAlbum(String(album.id), client)
    })));
  }
  return itens2;
}
async function obterResumoAreas(client) {
  const resumo = [];
  for (const area of Object.keys(AREA_PARA_TABELA)) {
    const tabela = tabelaDaArea(area);
    if (isAreaSingleton(area)) {
      const registro = await obterSingleton(tabela, client);
      const status = registro?.status || "rascunho";
      resumo.push({
        area,
        total: 1,
        publicados: status === "publicado" ? 1 : 0,
        rascunhos: status === "rascunho" ? 1 : 0,
        ocultos: status === "oculto" ? 1 : 0
      });
      continue;
    }
    const itens2 = await listarRegistros(tabela, {}, client);
    resumo.push({
      area,
      total: itens2.length,
      publicados: itens2.filter((i) => i.status === "publicado").length,
      rascunhos: itens2.filter((i) => i.status === "rascunho").length,
      ocultos: itens2.filter((i) => i.status === "oculto").length
    });
  }
  return resumo;
}
async function salvarSecaoSingleton(area, entrada, usuarioId, client) {
  if (!isAreaSingleton(area)) {
    return { ok: false, erros: [`A \xE1rea '${area}' n\xE3o \xE9 uma se\xE7\xE3o \xFAnica.`] };
  }
  const validacao = validarEntradaArea(area, entrada);
  if (!validacao.ok || !validacao.dados) return validacao;
  const dados = area === "contatos" ? prepararContatos(validacao.dados) : validacao.dados;
  const salvo = await salvarSingleton(tabelaDaArea(area), dados, usuarioId, client);
  return { ok: true, dados: (area === "contatos" ? expandirContatos(salvo) : salvo) || void 0 };
}
async function criarItemColecao(area, entrada, usuarioId, client) {
  if (isAreaSingleton(area)) {
    return { ok: false, erros: [`A \xE1rea '${area}' n\xE3o aceita novos registros.`] };
  }
  const validacao = validarEntradaArea(area, entrada);
  if (!validacao.ok || !validacao.dados) return validacao;
  const dados = { ...validacao.dados };
  if (area === "noticias") {
    const slugResolvido = await resolverSlugUnico(
      dados.slug || gerarSlug(String(dados.titulo || "")),
      void 0,
      client
    );
    if (!slugResolvido) {
      return { ok: false, erros: ["N\xE3o foi poss\xEDvel gerar um endere\xE7o \xFAnico para esta not\xEDcia."] };
    }
    dados.slug = slugResolvido;
  }
  const criado = await criarRegistro(tabelaDaArea(area), dados, usuarioId, client);
  return { ok: true, dados: criado || void 0 };
}
async function atualizarItemColecao(area, id, entrada, usuarioId, client) {
  if (isAreaSingleton(area)) {
    return { ok: false, erros: [`A \xE1rea '${area}' n\xE3o possui registros individuais.`] };
  }
  const existente = await obterRegistro(tabelaDaArea(area), id, client);
  if (!existente) {
    return { ok: false, erros: ["Registro n\xE3o encontrado."] };
  }
  const validacao = validarEntradaArea(area, entrada);
  if (!validacao.ok || !validacao.dados) return validacao;
  const dados = somenteCamposEnviados(validacao.dados, entrada);
  if (area === "noticias") {
    const slugResolvido = await resolverSlugUnico(
      dados.slug || gerarSlug(String(dados.titulo || existente.titulo || "")),
      id,
      client
    );
    if (!slugResolvido) {
      return { ok: false, erros: ["N\xE3o foi poss\xEDvel gerar um endere\xE7o \xFAnico para esta not\xEDcia."] };
    }
    dados.slug = slugResolvido;
  }
  const atualizado = await atualizarRegistro(tabelaDaArea(area), id, dados, usuarioId, client);
  return { ok: true, dados: atualizado || void 0 };
}
function somenteCamposEnviados(validados, entradaBruta) {
  if (!entradaBruta || typeof entradaBruta !== "object" || Array.isArray(entradaBruta)) {
    return { ...validados };
  }
  const enviadas = new Set(Object.keys(entradaBruta));
  const saida = {};
  for (const [chave, valor] of Object.entries(validados)) {
    if (enviadas.has(chave)) saida[chave] = valor;
  }
  return saida;
}
async function resolverSlugUnico(base, ignorarId, client) {
  const raiz = gerarSlug(base) || "noticia";
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const candidato = tentativa === 0 ? raiz : `${raiz}-${tentativa + 1}`;
    if (!await slugNoticiaEmUso(candidato, ignorarId, client)) {
      return candidato;
    }
  }
  return null;
}
async function alterarStatusItem(area, id, status, usuarioId, client) {
  const tabela = tabelaDaArea(area);
  const alvoId = isAreaSingleton(area) ? "1" : id;
  const existente = await obterRegistro(tabela, alvoId, client);
  if (!existente) {
    return { ok: false, erros: ["Registro n\xE3o encontrado."] };
  }
  const atualizado = await alterarStatusRegistro(tabela, alvoId, status, usuarioId, client);
  return { ok: true, dados: atualizado || void 0 };
}
async function removerItemColecao(area, id, client) {
  if (isAreaSingleton(area)) {
    return { ok: false, erros: [`A \xE1rea '${area}' n\xE3o permite remo\xE7\xE3o de registros.`] };
  }
  const existente = await obterRegistro(tabelaDaArea(area), id, client);
  if (!existente) {
    return { ok: false, erros: ["Registro n\xE3o encontrado."] };
  }
  await removerRegistro(tabelaDaArea(area), id, client);
  return { ok: true };
}
async function reordenarItens(area, itens2, client) {
  if (isAreaSingleton(area)) {
    return { ok: false, erros: [`A \xE1rea '${area}' n\xE3o \xE9 orden\xE1vel.`] };
  }
  await reordenarRegistros(tabelaDaArea(area), itens2, client);
  return { ok: true };
}
async function adicionarFoto(albumId, entrada, client) {
  const album = await obterRegistro("site_albuns", albumId, client);
  if (!album) {
    return { ok: false, erros: ["\xC1lbum n\xE3o encontrado."] };
  }
  const resultado = fotoSchema.safeParse(entrada);
  if (!resultado.success) {
    return { ok: false, erros: resultado.error.issues.map((i) => i.message) };
  }
  const criado = await criarRegistro("site_fotos", { ...resultado.data, album_id: albumId }, null, client);
  return { ok: true, dados: criado || void 0 };
}
async function removerFoto(fotoId, client) {
  const foto = await obterRegistro("site_fotos", fotoId, client);
  if (!foto) {
    return { ok: false, erros: ["Foto n\xE3o encontrada."] };
  }
  await removerRegistro("site_fotos", fotoId, client);
  return { ok: true };
}
function projetarSingleton(registro, incluirRascunhos) {
  if (!registro) return null;
  if (incluirRascunhos) return registro.status === "oculto" ? null : registro;
  return registro.status === "publicado" ? registro : null;
}
async function obterConteudoSitePublico(client, incluirRascunhos = false) {
  const filtro = incluirRascunhos ? {} : { apenasPublicados: true };
  const visivel = (itens2) => incluirRascunhos ? itens2.filter((i) => i.status !== "oculto") : itens2;
  const [inicio, heroDestaques, sobre, contatosBruto, cursos, projetos, noticias, albuns, equipe, documentos, links, secoes] = await Promise.all([
    obterSingleton("site_pagina_inicial", client),
    // A coleção de destaques do herói é posterior às demais. Se o banco de um
    // ambiente ainda não recebeu a migration, o site público não pode cair por
    // isso: a ausência da tabela vira "nenhum destaque", e o herói fica com o
    // slide institucional.
    listarRegistros("site_pagina_inicial_destaques", filtro, client).catch(() => []),
    obterSingleton("site_sobre", client),
    obterSingleton("site_contatos", client),
    listarRegistros("site_cursos", filtro, client),
    listarRegistros("site_projetos", filtro, client),
    listarRegistros("site_noticias", filtro, client),
    listarRegistros("site_albuns", filtro, client),
    listarRegistros("site_equipe", filtro, client),
    listarRegistros("site_documentos", filtro, client),
    listarRegistros("site_links", filtro, client),
    listarRegistros("site_secoes_extras", filtro, client)
  ]);
  const galeria = await Promise.all(
    visivel(albuns).map(async (album) => ({
      ...album,
      fotos: await listarFotosDoAlbum(String(album.id), client)
    }))
  );
  return {
    inicio: projetarSingleton(inicio, incluirRascunhos),
    heroDestaques: visivel(heroDestaques),
    sobre: projetarSingleton(sobre, incluirRascunhos),
    contatos: expandirContatos(projetarSingleton(contatosBruto, incluirRascunhos)),
    cursos: visivel(cursos),
    projetos: visivel(projetos),
    noticias: visivel(noticias),
    galeria,
    equipe: visivel(equipe),
    documentos: visivel(documentos),
    links: visivel(links),
    secoes: visivel(secoes),
    preview: incluirRascunhos
  };
}

// src/utils/roles.ts
var ROLE_LABELS = {
  super_admin: "Administrador Geral",
  admin: "Administrador Escolar",
  admin_tecnico: "Suporte T\xE9cnico",
  secretaria: "Secretaria Escolar",
  docente: "Professor(a)"
};
function getRoleLabel(role) {
  if (!role) return "Servidor(a)";
  return ROLE_LABELS[role] || "Servidor(a)";
}
function escaparHtml(valor) {
  return String(valor).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// src/views/admin-site-publico.ts
var AREAS = [
  {
    chave: "inicio",
    rotulo: "P\xE1gina Inicial",
    icone: "fa-house-laptop",
    tipo: "singleton",
    campos: [
      { chave: "hero_titulo", rotulo: "T\xEDtulo principal", tipo: "text", max: 160 },
      { chave: "hero_subtitulo", rotulo: "Subt\xEDtulo", tipo: "text", max: 220 },
      { chave: "hero_chamada", rotulo: "Chamada de boas-vindas", tipo: "textarea", max: 600 },
      { chave: "cta_texto", rotulo: "Texto do bot\xE3o de destaque", tipo: "text", max: 80 },
      { chave: "cta_link", rotulo: "Link do bot\xE3o", tipo: "url", max: 500, dica: "Endere\xE7o http(s) ou \xE2ncora interna (ex.: #cursos)" },
      { chave: "banner_imagem_url", rotulo: "Imagem do banner (URL)", tipo: "url", max: 500 },
      { chave: "destaques_ativo", rotulo: "Exibir blocos de destaque", tipo: "bool" }
    ]
  },
  {
    chave: "hero",
    rotulo: "Destaques do Her\xF3i",
    icone: "fa-images",
    tipo: "colecao",
    item: "destaque",
    campos: [
      { chave: "etiqueta", rotulo: "Etiqueta", tipo: "text", max: 80, dica: "Frase curta acima do t\xEDtulo (ex.: Rede Estadual de Minas Gerais)" },
      { chave: "titulo", rotulo: "T\xEDtulo", tipo: "text", max: 120, obrigatorio: true },
      { chave: "titulo_destaque", rotulo: "Trecho em destaque", tipo: "text", max: 120, dica: "Aparece logo abaixo do t\xEDtulo, em cor de destaque" },
      { chave: "subtitulo", rotulo: "Subt\xEDtulo", tipo: "text", max: 160 },
      { chave: "descricao", rotulo: "Descri\xE7\xE3o", tipo: "textarea", max: 600 },
      { chave: "cta_texto", rotulo: "Texto do bot\xE3o", tipo: "text", max: 80 },
      { chave: "cta_link", rotulo: "Link do bot\xE3o", tipo: "url", max: 500, dica: "Endere\xE7o http(s) ou \xE2ncora interna (ex.: #cursos)" },
      {
        chave: "paleta",
        rotulo: "Cor de destaque",
        tipo: "escolha",
        opcoes: [
          { valor: "dourado", rotulo: "Dourado" },
          { valor: "azul", rotulo: "Azul" },
          { valor: "roxo", rotulo: "Roxo" },
          { valor: "verde", rotulo: "Verde" },
          { valor: "coral", rotulo: "Coral" }
        ]
      },
      { chave: "imagem_url", rotulo: "Imagem de fundo (URL)", tipo: "url", max: 500 },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "sobre",
    rotulo: "Sobre a Escola",
    icone: "fa-school",
    tipo: "singleton",
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo da se\xE7\xE3o", tipo: "text", max: 160 },
      { chave: "apresentacao", rotulo: "Apresenta\xE7\xE3o", tipo: "textarea", max: 3e3 },
      { chave: "historia", rotulo: "Hist\xF3ria", tipo: "textarea", max: 5e3 },
      { chave: "missao", rotulo: "Miss\xE3o", tipo: "textarea", max: 1500 },
      { chave: "visao", rotulo: "Vis\xE3o", tipo: "textarea", max: 1500 },
      { chave: "valores", rotulo: "Valores", tipo: "textarea", max: 1500 },
      { chave: "proposta_pedagogica", rotulo: "Proposta pedag\xF3gica", tipo: "textarea", max: 5e3 },
      { chave: "estrutura", rotulo: "Estrutura f\xEDsica", tipo: "textarea", max: 3e3 },
      { chave: "imagem_url", rotulo: "Imagem (URL)", tipo: "url", max: 500 }
    ]
  },
  {
    chave: "cursos",
    rotulo: "Cursos e Modalidades",
    icone: "fa-graduation-cap",
    tipo: "colecao",
    item: "curso",
    campos: [
      { chave: "nome", rotulo: "Nome do curso", tipo: "text", max: 160, obrigatorio: true },
      { chave: "modalidade", rotulo: "Modalidade", tipo: "text", max: 120 },
      { chave: "turno", rotulo: "Turno", tipo: "text", max: 80 },
      { chave: "descricao", rotulo: "Descri\xE7\xE3o", tipo: "textarea", max: 2e3 },
      { chave: "informacoes_adicionais", rotulo: "Informa\xE7\xF5es adicionais", tipo: "textarea", max: 2e3 },
      { chave: "imagem_url", rotulo: "Imagem (URL)", tipo: "url", max: 500 },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "projetos",
    rotulo: "Projetos Escolares",
    icone: "fa-lightbulb",
    tipo: "colecao",
    item: "projeto",
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo do projeto", tipo: "text", max: 180, obrigatorio: true },
      { chave: "resumo", rotulo: "Resumo", tipo: "textarea", max: 600 },
      { chave: "conteudo", rotulo: "Conte\xFAdo", tipo: "textarea", max: 8e3 },
      { chave: "capa_url", rotulo: "Capa (URL)", tipo: "url", max: 500 },
      { chave: "responsaveis", rotulo: "Respons\xE1veis", tipo: "text", max: 400 },
      { chave: "periodo", rotulo: "Per\xEDodo", tipo: "text", max: 120 },
      { chave: "destaque", rotulo: "Marcar como destaque", tipo: "bool" },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "noticias",
    rotulo: "Not\xEDcias e Avisos",
    icone: "fa-newspaper",
    tipo: "colecao",
    item: "not\xEDcia",
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo", tipo: "text", max: 180, obrigatorio: true },
      { chave: "resumo", rotulo: "Resumo", tipo: "textarea", max: 600 },
      { chave: "conteudo", rotulo: "Conte\xFAdo", tipo: "textarea", max: 12e3 },
      { chave: "capa_url", rotulo: "Capa (URL)", tipo: "url", max: 500 },
      { chave: "categoria", rotulo: "Categoria", tipo: "text", max: 80 },
      { chave: "autor", rotulo: "Autor", tipo: "text", max: 120 },
      { chave: "data_publicacao", rotulo: "Data de publica\xE7\xE3o", tipo: "date" },
      { chave: "destaque", rotulo: "Marcar como destaque", tipo: "bool" }
    ]
  },
  {
    chave: "galeria",
    rotulo: "Galeria de Fotos",
    icone: "fa-images",
    tipo: "colecao",
    item: "\xE1lbum",
    fotos: true,
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo do \xE1lbum", tipo: "text", max: 180, obrigatorio: true },
      { chave: "descricao", rotulo: "Descri\xE7\xE3o", tipo: "textarea", max: 1200 },
      { chave: "capa_url", rotulo: "Capa (URL)", tipo: "url", max: 500 },
      { chave: "data_album", rotulo: "Data", tipo: "date" },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "equipe",
    rotulo: "Equipe Escolar",
    icone: "fa-users",
    tipo: "colecao",
    item: "integrante",
    campos: [
      { chave: "nome", rotulo: "Nome", tipo: "text", max: 160, obrigatorio: true },
      { chave: "funcao_publica", rotulo: "Fun\xE7\xE3o p\xFAblica", tipo: "text", max: 160 },
      { chave: "foto_url", rotulo: "Foto (URL)", tipo: "url", max: 500 },
      { chave: "descricao", rotulo: "Descri\xE7\xE3o", tipo: "textarea", max: 1200 },
      { chave: "grupo", rotulo: "Grupo", tipo: "text", max: 120, dica: "Ex.: Gest\xE3o, Docentes, Apoio" },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "contatos",
    rotulo: "Contatos & Canais",
    icone: "fa-address-book",
    tipo: "singleton",
    campos: [
      { chave: "telefones", rotulo: "Telefones", tipo: "list", dica: "Um por linha" },
      { chave: "emails", rotulo: "E-mails", tipo: "list", dica: "Um por linha" },
      { chave: "horario_atendimento", rotulo: "Hor\xE1rio de atendimento", tipo: "textarea", max: 400 },
      { chave: "endereco", rotulo: "Endere\xE7o", tipo: "text", max: 300, dica: "Informe apenas se oficialmente confirmado" },
      { chave: "instagram_url", rotulo: "Instagram (URL)", tipo: "url", max: 500 },
      { chave: "facebook_url", rotulo: "Facebook (URL)", tipo: "url", max: 500 },
      { chave: "youtube_url", rotulo: "YouTube (URL)", tipo: "url", max: 500 },
      { chave: "orientacoes", rotulo: "Orienta\xE7\xF5es de atendimento", tipo: "textarea", max: 1500 }
    ]
  },
  {
    chave: "documentos",
    rotulo: "Documentos P\xFAblicos",
    icone: "fa-file-lines",
    tipo: "colecao",
    item: "documento",
    arquivo: true,
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo", tipo: "text", max: 180, obrigatorio: true },
      { chave: "descricao", rotulo: "Descri\xE7\xE3o", tipo: "textarea", max: 1e3 },
      { chave: "categoria", rotulo: "Categoria", tipo: "text", max: 100 },
      { chave: "arquivo_url", rotulo: "Endere\xE7o do arquivo (URL)", tipo: "url", max: 500, dica: "Use apenas para documento j\xE1 publicado em outro endere\xE7o. Para enviar do computador, use o clipe no cart\xE3o do documento." },
      { chave: "data_publicacao", rotulo: "Data de publica\xE7\xE3o", tipo: "date" },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "links",
    rotulo: "Links \xDAteis",
    icone: "fa-link",
    tipo: "colecao",
    item: "link",
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo", tipo: "text", max: 180, obrigatorio: true },
      { chave: "url", rotulo: "Endere\xE7o (URL)", tipo: "url", max: 500, obrigatorio: true },
      { chave: "descricao", rotulo: "Descri\xE7\xE3o", tipo: "textarea", max: 600 },
      { chave: "categoria", rotulo: "Categoria", tipo: "text", max: 100 },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  },
  {
    chave: "secoes",
    rotulo: "Se\xE7\xF5es Adicionais",
    icone: "fa-layer-group",
    tipo: "colecao",
    item: "se\xE7\xE3o",
    campos: [
      { chave: "titulo", rotulo: "T\xEDtulo", tipo: "text", max: 180, obrigatorio: true },
      { chave: "subtitulo", rotulo: "Subt\xEDtulo", tipo: "text", max: 220 },
      { chave: "conteudo", rotulo: "Conte\xFAdo", tipo: "textarea", max: 8e3 },
      { chave: "imagem_url", rotulo: "Imagem (URL)", tipo: "url", max: 500 },
      { chave: "ordem", rotulo: "Ordem de exibi\xE7\xE3o", tipo: "number" }
    ]
  }
];
var STATUS_LABELS = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  oculto: "Oculto"
};
function renderAdminSitePublicoPage(userName, role, activeSection = "inicio") {
  const roleLabel = getRoleLabel(role);
  const secaoValida = AREAS.some((a) => a.chave === activeSection) ? activeSection : "inicio";
  const configCliente = JSON.stringify({
    areas: AREAS,
    statusLabels: STATUS_LABELS,
    ativa: secaoValida,
    usuario: userName,
    papel: roleLabel
  });
  const itensMenu = AREAS.map((a, i) => `
        <button type="button" data-nav="${a.chave}" class="nav-item w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${a.chave === secaoValida ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:bg-slate-800"}">
            <span class="flex items-center gap-2.5">
                <i class="fas ${a.icone} w-4 text-center"></i>
                <span>${i + 1}. ${a.rotulo}</span>
            </span>
            <span class="nav-count text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-700/70 text-slate-300 hidden"></span>
        </button>`).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Site P\xFAblico \u2014 Central EEC</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="${assetUrl("/styles/tailwind.css")}">
    <link rel="stylesheet" href="${assetUrl("/static/styles.css")}">
</head>
<body class="bg-slate-900 text-slate-100 font-poppins min-h-full flex flex-col selection:bg-blue-600 selection:text-white">
    <header class="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        <a href="/admin" class="flex items-center gap-3 group min-w-0 shrink">
            <div class="h-10 w-10 shrink-0 bg-white rounded-xl px-1.5 py-1 flex items-center justify-center shadow-md">
                <img src="/images/logo-eec-oficial.png" alt="Escola Estadual do Cariri" class="h-8 w-auto object-contain">
            </div>
            <div class="hidden min-[420px]:block min-w-0">
                <h1 class="font-bold text-white text-sm sm:text-base leading-tight group-hover:text-blue-400 transition-colors truncate">Central de Comando</h1>
                <p class="text-[11px] text-slate-400 truncate">Escola Estadual do Cariri</p>
            </div>
        </a>
        <div class="flex items-center gap-2 sm:gap-4 shrink-0">
            <a href="/admin/site-publico/preview" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 text-xs font-medium rounded-lg transition-colors border border-amber-600/40">
                <i class="fas fa-eye text-[11px]"></i><span>Pr\xE9-visualizar</span>
            </a>
            <a href="/" target="_blank" class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700">
                <i class="fas fa-arrow-up-right-from-square text-[11px] text-blue-400"></i><span>Ver site p\xFAblico</span>
            </a>
            <div class="text-right leading-tight">
                <span class="block text-xs sm:text-sm font-semibold text-white truncate max-w-[9rem]">${escaparHtml(userName)}</span>
                <span class="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">${escaparHtml(roleLabel)}</span>
            </div>
            <button type="button" data-action="logout" class="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 text-slate-300 text-xs rounded-lg transition-all border border-slate-700 cursor-pointer" title="Sair da sess\xE3o">
                <i class="fas fa-right-from-bracket"></i>
            </button>
        </div>
    </header>

    <div class="bg-slate-950/70 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <nav aria-label="Trilha de navega\xE7\xE3o" class="flex items-center gap-2 text-xs text-slate-400">
            <a href="/admin" class="hover:text-white transition-colors flex items-center gap-1.5 font-medium">
                <i class="fas fa-house text-[11px]"></i><span>Vis\xE3o Geral</span>
            </a>
            <i class="fas fa-chevron-right text-[9px] text-slate-600"></i>
            <span class="text-blue-400 font-semibold flex items-center gap-1.5">
                <i class="fas fa-globe text-[11px]"></i><span>Site P\xFAblico</span>
            </span>
            <i class="fas fa-chevron-right text-[9px] text-slate-600"></i>
            <span id="trilha-area" class="text-white font-medium"></span>
        </nav>
        <a href="/admin" class="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors">
            <i class="fas fa-arrow-left text-[11px]"></i><span>Voltar ao Painel</span>
        </a>
    </div>

    <div class="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 sm:p-6 gap-6">
        <aside class="w-full md:w-72 shrink-0 space-y-1">
            <div class="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">P\xE1ginas &amp; Conte\xFAdos</div>
            <nav class="space-y-1" id="menu-areas">${itensMenu}</nav>
        </aside>

        <main class="flex-1 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl relative min-h-[520px]">
            <div id="toast" class="hidden fixed z-50 bottom-6 right-6 max-w-sm px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border"></div>
            <div id="area-root"></div>
        </main>
    </div>

    <!-- Di\xE1logo de confirma\xE7\xE3o -->
    <div id="confirm-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div class="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 text-slate-100 shadow-2xl">
            <p id="confirm-msg" class="text-sm text-slate-200 mb-5"></p>
            <div class="flex justify-end gap-2">
                <button type="button" data-confirm="no" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold">Cancelar</button>
                <button type="button" data-confirm="yes" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold">Confirmar</button>
            </div>
        </div>
    </div>

    <script id="cms-config" type="application/json">${configCliente.replace(/</g, "\\u003c")}</script>
    <script src="${assetUrl("/static/admin-site-publico.js")}"></script>
</body>
</html>`;
}

// src/views/admin-shell.ts
var MENU_ADMIN = [
  { chave: "visao-geral", rotulo: "Vis\xE3o Geral", href: "/admin", icone: "fa-chart-pie", cor: "text-blue-400" },
  { chave: "site-publico", rotulo: "Site P\xFAblico", href: "/admin/site-publico", icone: "fa-globe", cor: "text-blue-400", papeis: ["super_admin", "admin"] },
  { chave: "institucional", rotulo: "Personaliza\xE7\xE3o Institucional", href: "/admin/configuracao-institucional", icone: "fa-sliders", cor: "text-amber-400", papeis: ["super_admin", "admin"] },
  { chave: "comunicados", rotulo: "Comunicados Internos", href: "/admin/comunicados", icone: "fa-bullhorn", cor: "text-sky-400" },
  { chave: "documentos", rotulo: "An\xE1lise de Documentos", href: "/admin/documentos", icone: "fa-file-shield", cor: "text-emerald-400" },
  { chave: "usuarios", rotulo: "Usu\xE1rios e Acessos", href: "/admin/usuarios", icone: "fa-users-gear", cor: "text-purple-400", papeis: ["super_admin", "admin"] },
  { chave: "mensagens", rotulo: "Mensagens da Comunidade", href: "/admin/mensagens", icone: "fa-envelope-open-text", cor: "text-rose-400", papeis: ["super_admin", "admin"] },
  { chave: "portal-docente", rotulo: "Portal do Professor", href: "/portal-docente", icone: "fa-chalkboard-user", cor: "text-indigo-400" }
];
var MENU_DOCENTE = [
  { chave: "portal-docente", rotulo: "Portal do Professor", href: "/portal-docente", icone: "fa-chalkboard-user", cor: "text-indigo-400" },
  { chave: "docente-comunicados", rotulo: "Comunicados Internos", href: "/professor/comunicados", icone: "fa-bullhorn", cor: "text-sky-400" },
  { chave: "docente-documentos", rotulo: "Documentos Pedag\xF3gicos", href: "/professor/documentos", icone: "fa-folder-open", cor: "text-emerald-400" }
];
function itensVisiveis(role) {
  if (role === "docente") return MENU_DOCENTE;
  return MENU_ADMIN.filter((i) => !i.papeis || i.papeis.includes(role));
}
function layoutAdmin(o) {
  const roleLabel = getRoleLabel(o.role);
  const itens2 = itensVisiveis(o.role);
  const acento = o.acento ?? "azul";
  const selecao = acento === "indigo" ? "selection:bg-indigo-600" : "selection:bg-blue-600";
  const ativoCls = acento === "indigo" ? "bg-indigo-600" : "bg-blue-600";
  const configCliente = JSON.stringify({ papel: o.role, nome: o.userName, ...o.config ?? {} });
  const linkMenu = (i) => i.chave === o.ativo ? `<a href="${i.href}" aria-current="page" class="px-4 min-h-[44px] rounded-xl text-base font-semibold flex items-center gap-3 ${ativoCls} text-white shadow-md">
               <i class="fas ${i.icone} w-5 text-center"></i><span>${escaparHtml(i.rotulo)}</span>
           </a>` : `<a href="${i.href}" class="px-4 min-h-[44px] rounded-xl text-base font-medium flex items-center gap-3 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
               <i class="fas ${i.icone} w-5 text-center ${i.cor}"></i><span>${escaparHtml(i.rotulo)}</span>
           </a>`;
  const navegacao = itens2.map(linkMenu).join("\n                ");
  const trilha = (o.trilha ?? []).map(
    (t) => t.href ? `<a href="${t.href}" class="hover:text-white transition-colors">${escaparHtml(t.rotulo)}</a>
           <i class="fas fa-chevron-right text-[10px] text-slate-600"></i>` : `<span>${escaparHtml(t.rotulo)}</span>
           <i class="fas fa-chevron-right text-[10px] text-slate-600"></i>`
  ).join("\n            ");
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escaparHtml(o.tituloPagina || o.titulo)} \u2014 Central EEC</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="${assetUrl("/styles/tailwind.css")}">
    <link rel="stylesheet" href="${assetUrl("/static/styles.css")}">
</head>
<body class="bg-slate-900 text-slate-100 font-poppins text-base min-h-full flex flex-col ${selecao} selection:text-white">
    ${o.aviso ?? ""}

    <header class="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
            <button type="button" data-action="menu-lateral"
                    class="md:hidden w-11 h-11 shrink-0 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center justify-center"
                    aria-label="Abrir menu de navega\xE7\xE3o" aria-expanded="false" aria-controls="menu-lateral">
                <i class="fas fa-bars text-lg"></i>
            </button>

            <a href="/admin" class="flex items-center gap-3 group min-w-0 shrink">
                <div class="h-11 w-11 shrink-0 bg-white rounded-xl px-1.5 py-1 flex items-center justify-center shadow-md">
                    <img src="/images/logo-eec-oficial.png" alt="Escola Estadual do Cariri" class="h-9 w-auto object-contain">
                </div>
                <div class="hidden min-[420px]:block min-w-0">
                    <span class="block font-bold text-white text-base leading-tight group-hover:text-blue-400 transition-colors truncate">Central de Comando</span>
                    <span class="block text-xs text-slate-400 truncate">Escola Estadual do Cariri</span>
                </div>
            </a>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            <a href="/" target="_blank" rel="noopener"
               class="hidden md:inline-flex items-center gap-2 px-4 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-base font-medium rounded-xl transition-colors border border-slate-700">
                <i class="fas fa-arrow-up-right-from-square text-sm text-blue-400"></i><span>Ver site</span>
            </a>

            <div class="relative">
                <button type="button" data-action="menu-usuario"
                        class="flex items-center gap-3 p-1.5 min-h-[44px] rounded-xl hover:bg-slate-800 transition-colors text-left cursor-pointer">
                    <span class="hidden sm:block text-right leading-tight">
                        <span id="header-user-name" class="block text-base font-semibold text-white truncate max-w-[11rem]">${escaparHtml(o.userName)}</span>
                        <span class="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">${escaparHtml(roleLabel)}</span>
                    </span>
                    <span class="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300 flex items-center justify-center font-bold text-base shrink-0">
                        ${escaparHtml(o.userName.charAt(0).toUpperCase())}
                    </span>
                    <i class="fas fa-chevron-down text-xs text-slate-400"></i>
                </button>

                <div id="user-menu-dropdown" class="hidden absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl py-2 z-50">
                    <button type="button" data-action="abrir-perfil"
                            class="w-full text-left px-4 min-h-[44px] text-base text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 cursor-pointer">
                        <i class="fas fa-user-pen text-blue-400 w-5 text-center"></i> Meu Perfil
                    </button>
                    <div class="my-1.5 border-t border-slate-800"></div>
                    <button type="button" data-action="logout"
                            class="w-full text-left px-4 min-h-[44px] text-base text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2.5 cursor-pointer">
                        <i class="fas fa-right-from-bracket w-5 text-center"></i> Sair da Sess\xE3o
                    </button>
                </div>
            </div>
        </div>
    </header>

    <div class="bg-slate-950/70 border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 text-base">
        <nav aria-label="Trilha de navega\xE7\xE3o" class="flex items-center gap-2 text-slate-400 min-w-0 overflow-x-auto">
            ${trilha}
            <span class="text-blue-400 font-semibold flex items-center gap-2 whitespace-nowrap">
                <i class="fas ${o.icone} text-sm"></i><span>${escaparHtml(o.titulo)}</span>
            </span>
        </nav>
        <span class="hidden sm:flex text-sm text-slate-500 items-center gap-2 shrink-0">
            <i class="fas fa-circle text-[6px] text-emerald-500"></i> Sess\xE3o ativa
        </span>
    </div>

    <div id="toast" class="hidden"></div>

    <div class="flex-1 flex flex-col md:flex-row w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:px-8 gap-6">
        <aside id="menu-lateral" class="hidden md:block w-full md:w-72 xl:w-80 shrink-0 space-y-1">
            <div class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400">Navega\xE7\xE3o</div>
            <nav class="space-y-1">
                ${navegacao}
            </nav>
        </aside>

        <main class="flex-1 min-w-0 space-y-6">
            <div>
                <h1 class="text-[30px] lg:text-[32px] font-bold text-white leading-tight flex items-center gap-3">
                    <i class="fas ${o.icone} ${o.corIcone ?? "text-blue-400"} text-2xl"></i>${escaparHtml(o.titulo)}
                </h1>
                ${o.descricao ? `<p class="text-slate-400 text-base lg:text-[17px] mt-2 leading-relaxed max-w-3xl">${escaparHtml(o.descricao)}</p>` : ""}
            </div>

            ${o.conteudo}
        </main>
    </div>

    <div id="edit-profile-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 text-slate-100 shadow-2xl">
            <div class="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
                <h2 class="font-bold text-white text-xl flex items-center gap-2.5">
                    <i class="fas fa-user-pen text-blue-400"></i> Meu Perfil
                </h2>
                <button type="button" data-action="fechar-perfil"
                        class="w-11 h-11 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center justify-center" aria-label="Fechar">
                    <i class="fas fa-xmark text-lg"></i>
                </button>
            </div>
            <form id="form-edit-profile" class="space-y-5">
                <div>
                    <label for="my-profile-name" class="block text-base font-semibold text-slate-300 mb-2">Nome completo</label>
                    <input type="text" id="my-profile-name" value="${escaparHtml(o.userName)}" required maxlength="120"
                        class="w-full px-4 min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="flex justify-end gap-3 pt-1">
                    <button type="button" data-action="fechar-perfil"
                            class="px-5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-base font-medium">Cancelar</button>
                    <button type="submit"
                            class="px-6 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-base font-semibold">Salvar</button>
                </div>
            </form>
        </div>
    </div>

    ${o.extras ?? ""}

    <script id="admin-config" type="application/json">${configCliente.replace(/</g, "\\u003c")}</script>
    ${(o.scripts ?? []).map((src) => `<script src="${assetUrl(src)}"></script>`).join("\n    ")}
</body>
</html>`;
}
function cartaoIndicador(id, rotulo, icone, cor, nota, href) {
  const corpo = `
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <span class="text-sm sm:text-[15px] font-semibold uppercase tracking-wider text-slate-400 leading-snug">${escaparHtml(rotulo)}</span>
                        <i class="fas ${icone} text-lg sm:text-xl ${cor} shrink-0"></i>
                    </div>
                    <div id="stat-${id}" class="text-3xl font-bold text-white">\u2014</div>
                    <p class="text-sm sm:text-[15px] text-slate-400 mt-1.5 leading-snug">${escaparHtml(nota)}</p>`;
  return href ? `<a href="${href}" class="block bg-slate-800 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/70 p-5 rounded-2xl transition-colors min-h-[44px]">${corpo}</a>` : `<div class="bg-slate-800 border border-slate-700 p-5 rounded-2xl">${corpo}</div>`;
}

// src/views/admin.ts
function renderLoginPage() {
  const sinal = (icone, titulo, apoio) => `
                        <li class="flex items-start gap-3.5">
                            <span class="w-10 h-10 shrink-0 rounded-xl bg-white/10 border border-white/15 text-school-gold flex items-center justify-center">
                                <i class="fas ${icone} text-sm" aria-hidden="true"></i>
                            </span>
                            <span class="min-w-0">
                                <span class="block text-white font-semibold text-[15px] leading-tight">${titulo}</span>
                                <span class="block text-white/55 text-sm leading-snug mt-0.5">${apoio}</span>
                            </span>
                        </li>`;
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acesso Institucional \u2014 Central de Comando EEC</title>
    <meta name="description" content="Acesso institucional \xE0 Central de Comando Escolar da Escola Estadual do Cariri.">
    <meta name="robots" content="noindex, nofollow">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="${assetUrl("/styles/tailwind.css")}">
    <link rel="stylesheet" href="${assetUrl("/static/styles.css")}">
</head>
<body class="min-h-full bg-school-navy text-slate-900 font-poppins antialiased selection:bg-school-gold selection:text-school-navy">

    <!-- Fundo em camadas, o mesmo do her\xF3i do site p\xFAblico: degrad\xEA profundo,
         halos desfocados e trama de pontos. Nada aqui captura clique. -->
    <div class="fixed inset-0 -z-10 bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333]" aria-hidden="true"></div>
    <div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
        <div class="absolute -top-32 -right-24 w-[32rem] h-[32rem] bg-school-gold/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-40 -left-32 w-[36rem] h-[36rem] bg-school-sky/10 rounded-full blur-3xl"></div>
        <div class="absolute top-1/2 left-1/2 w-[42rem] h-[42rem] -translate-x-1/2 -translate-y-1/2 bg-primary-500/5 rounded-full blur-3xl"></div>
        <div class="absolute inset-0 opacity-[0.05]" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 38px 38px;"></div>
    </div>

    <main class="min-h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div class="w-full max-w-6xl grid lg:grid-cols-[1.02fr_1fr] rounded-3xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10">

            <!-- ============================ FACE INSTITUCIONAL ============================ -->
            <section class="relative bg-gradient-to-br from-[#12205a] via-school-navy to-[#0c1333] px-6 py-6 lg:px-11 lg:py-12 flex lg:flex-col items-center lg:items-stretch gap-4 lg:gap-0">
                <span class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-school-gold via-warm-500 to-school-coral" aria-hidden="true"></span>
                <div class="absolute -top-20 -left-16 w-64 h-64 bg-school-gold/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>

                <!-- Marca. O logotipo oficial entra sem tratamento art\xEDstico. -->
                <div class="relative flex items-center gap-4 shrink-0">
                    <span class="h-14 w-14 lg:h-16 lg:w-16 shrink-0 bg-white rounded-2xl p-2 shadow-lg flex items-center justify-center">
                        <img src="/images/logo-eec-oficial.png" alt="Escola Estadual do Cariri" class="max-h-full max-w-full object-contain">
                    </span>
                    <span class="min-w-0">
                        <span class="block text-white font-bold text-lg lg:text-2xl leading-tight">Central de Comando</span>
                        <span class="block text-school-gold text-[11px] lg:text-xs font-semibold uppercase tracking-[0.18em] mt-1 truncate">Escola Estadual do Cariri</span>
                    </span>
                </div>

                <!-- Bloco de contexto: s\xF3 existe no desktop, onde h\xE1 altura para ele.
                     No celular a face institucional se resume \xE0 faixa de marca acima. -->
                <div class="relative hidden lg:flex flex-col flex-1 mt-11">
                    <p class="text-white/70 text-[17px] leading-relaxed max-w-sm">
                        Ambiente de trabalho da equipe da escola: gest\xE3o do site p\xFAblico, comunicados
                        internos e documentos pedag\xF3gicos, em um lugar s\xF3.
                    </p>

                    <ul class="space-y-6 mt-10">
                        ${sinal("fa-shield-halved", "Acesso restrito", "Somente contas institucionais ativas.")}
                        ${sinal("fa-users-gear", "Perfis e permiss\xF5es", "Cada servidor enxerga o que lhe cabe.")}
                        ${sinal("fa-clock-rotate-left", "Registro de atividade", "As a\xE7\xF5es administrativas ficam auditadas.")}
                    </ul>

                    <p class="mt-auto pt-10 text-white/35 text-xs flex items-center gap-2">
                        <i class="fas fa-building-columns text-[11px]" aria-hidden="true"></i>
                        Rede Estadual de Ensino de Minas Gerais
                    </p>
                </div>
            </section>

            <!-- ============================== FACE OPERACIONAL ============================== -->
            <section class="bg-white px-6 py-8 sm:px-10 sm:py-11 lg:px-12 lg:py-12 flex flex-col justify-center">
                <header class="mb-7">
                    <span class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-bold uppercase tracking-[0.12em]">
                        <i class="fas fa-right-to-bracket text-[10px]" aria-hidden="true"></i>Acesso institucional
                    </span>
                    <h1 class="text-[28px] sm:text-[32px] font-bold text-school-navy leading-tight mt-4">Entrar na Central</h1>
                    <p class="text-slate-500 text-[15px] leading-relaxed mt-2">
                        Use o e-mail e a senha fornecidos pela administra\xE7\xE3o da escola.
                    </p>
                </header>

                <!-- Caixa de Alerta Global / Feedback -->
                <div id="alert-box" role="alert" aria-live="polite" class="hidden p-4 rounded-2xl text-sm border-2 transition-all duration-200">
                    <div class="flex items-start gap-3">
                        <i id="alert-icon" class="fas fa-circle-exclamation text-base mt-0.5 shrink-0" aria-hidden="true"></i>
                        <div id="alert-content" class="flex-1 font-medium leading-relaxed"></div>
                    </div>
                </div>

                <!-- Formul\xE1rio de Autentica\xE7\xE3o -->
                <form id="login-form" class="space-y-6" novalidate>
                    <div>
                        <label for="email" class="block text-xs font-bold text-school-navy uppercase tracking-[0.12em] mb-2.5">
                            E-mail institucional <span class="text-rose-600" aria-hidden="true">*</span>
                        </label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none" aria-hidden="true">
                                <i class="fas fa-envelope text-[15px]"></i>
                            </span>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                required
                                autocomplete="username"
                                placeholder="nome@escola.eec ou hotmail.com"
                                class="w-full min-h-[52px] pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 text-slate-900 placeholder:text-slate-400 text-[15px] rounded-xl hover:border-slate-300 focus:bg-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-100 transition-all">
                        </div>
                        <p id="email-error" class="hidden text-xs text-rose-600 mt-2 flex items-center gap-1 font-medium" role="alert"></p>
                    </div>

                    <div>
                        <div class="flex items-center justify-between gap-3 mb-2.5">
                            <label for="password" class="block text-xs font-bold text-school-navy uppercase tracking-[0.12em]">
                                Senha de acesso <span class="text-rose-600" aria-hidden="true">*</span>
                            </label>
                            <button
                                type="button"
                                id="btn-open-forgot"
                                class="text-[13px] text-primary-700 hover:text-primary-900 font-semibold transition-colors rounded-lg px-2 py-1 -mr-2 hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-200 cursor-pointer">
                                Esqueceu a senha?
                            </button>
                        </div>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none" aria-hidden="true">
                                <i class="fas fa-lock text-[15px]"></i>
                            </span>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                required
                                autocomplete="current-password"
                                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                                class="w-full min-h-[52px] pl-11 pr-14 py-3.5 bg-slate-50 border-2 border-slate-200 text-slate-900 placeholder:text-slate-400 text-[15px] rounded-xl hover:border-slate-300 focus:bg-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-100 transition-all">
                            <button
                                type="button"
                                id="btn-toggle-password"
                                aria-label="Mostrar senha em texto claro"
                                title="Mostrar ou ocultar senha"
                                class="absolute inset-y-0 right-0 my-auto mr-2 w-11 h-11 rounded-xl text-slate-500 hover:text-primary-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-colors cursor-pointer flex items-center justify-center">
                                <i id="toggle-password-icon" class="fas fa-eye text-[15px]" aria-hidden="true"></i>
                            </button>
                        </div>
                        <p id="password-error" class="hidden text-xs text-rose-600 mt-2 flex items-center gap-1 font-medium" role="alert"></p>
                    </div>

                    <button
                        type="submit"
                        id="btn-submit"
                        class="w-full min-h-[56px] py-4 px-4 bg-gradient-to-r from-primary-700 to-school-navy hover:from-primary-800 hover:to-[#0b1540] active:scale-[0.99] text-white font-bold rounded-xl text-base transition-all duration-200 shadow-lg shadow-primary-900/25 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                        <span id="btn-text">Entrar na Central EEC</span>
                        <i id="btn-icon" class="fas fa-arrow-right text-xs" aria-hidden="true"></i>
                    </button>
                </form>

                <footer class="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <a href="/" class="text-[15px] text-slate-600 hover:text-school-navy transition-colors inline-flex items-center gap-2 font-semibold rounded-lg px-2 py-1.5 -ml-2 hover:bg-slate-100">
                        <i class="fas fa-arrow-left text-[11px]" aria-hidden="true"></i>
                        Voltar ao site da escola
                    </a>
                    <p class="text-xs text-slate-400 flex items-center gap-2">
                        <i class="fas fa-lock text-[10px]" aria-hidden="true"></i>
                        Conex\xE3o e sess\xE3o protegidas
                    </p>
                </footer>
            </section>
        </div>
    </main>

    <!-- ================================ RECUPERAR SENHA ================================ -->
    <div id="forgot-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-school-navy/85 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="forgot-title">
        <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div class="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-slate-200">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-11 h-11 shrink-0 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center">
                        <i class="fas fa-key" aria-hidden="true"></i>
                    </span>
                    <div class="min-w-0">
                        <h2 id="forgot-title" class="text-lg font-bold text-school-navy leading-tight">Recuperar senha</h2>
                        <p class="text-[13px] text-slate-500 mt-0.5">Enviaremos as instru\xE7\xF5es por e-mail</p>
                    </div>
                </div>
                <button type="button" id="btn-close-forgot" class="w-11 h-11 shrink-0 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-200 transition-colors cursor-pointer flex items-center justify-center" aria-label="Fechar janela">
                    <i class="fas fa-xmark text-lg" aria-hidden="true"></i>
                </button>
            </div>

            <div class="px-6 py-6">
                <div id="forgot-alert" class="hidden mb-5 p-3.5 rounded-xl text-[13px] border"></div>

                <form id="forgot-form" class="space-y-5">
                    <div>
                        <label for="forgot-email" class="block text-xs font-bold text-school-navy uppercase tracking-[0.12em] mb-2.5">
                            E-mail institucional
                        </label>
                        <input
                            type="email"
                            id="forgot-email"
                            required
                            autocomplete="username"
                            placeholder="nome@escola.eec"
                            class="w-full min-h-[52px] px-4 py-3.5 bg-slate-50 border-2 border-slate-200 text-slate-900 placeholder:text-slate-400 text-[15px] rounded-xl hover:border-slate-300 focus:bg-white focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-100 transition-all">
                    </div>

                    <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-1">
                        <button type="button" id="btn-cancel-forgot" class="min-h-[48px] px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[15px] font-semibold transition-colors cursor-pointer">
                            Cancelar
                        </button>
                        <button type="submit" id="btn-submit-forgot" class="min-h-[48px] px-6 bg-gradient-to-r from-primary-700 to-school-navy hover:from-primary-800 text-white rounded-xl text-[15px] font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2">
                            <i class="fas fa-paper-plane text-xs" aria-hidden="true"></i>Enviar instru\xE7\xF5es
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        const loginForm = document.getElementById('login-form');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const emailError = document.getElementById('email-error');
        const passwordError = document.getElementById('password-error');
        const alertBox = document.getElementById('alert-box');
        const alertIcon = document.getElementById('alert-icon');
        const alertContent = document.getElementById('alert-content');
        const btnSubmit = document.getElementById('btn-submit');
        const btnText = document.getElementById('btn-text');
        const btnIcon = document.getElementById('btn-icon');
        const btnTogglePassword = document.getElementById('btn-toggle-password');
        const togglePasswordIcon = document.getElementById('toggle-password-icon');

        const forgotModal = document.getElementById('forgot-modal');
        const btnOpenForgot = document.getElementById('btn-open-forgot');
        const btnCloseForgot = document.getElementById('btn-close-forgot');
        const btnCancelForgot = document.getElementById('btn-cancel-forgot');
        const forgotForm = document.getElementById('forgot-form');
        const forgotEmail = document.getElementById('forgot-email');
        const forgotAlert = document.getElementById('forgot-alert');
        const btnSubmitForgot = document.getElementById('btn-submit-forgot');

        function showAlert(type, message) {
            alertBox.classList.remove('hidden');
            if (type === 'error') {
                alertBox.className = 'mb-6 p-4 rounded-2xl text-sm border-2 bg-rose-50 border-rose-200 text-rose-900 block';
                alertIcon.className = 'fas fa-circle-exclamation text-base text-rose-600 mt-0.5 shrink-0';
            } else if (type === 'warning') {
                alertBox.className = 'mb-6 p-4 rounded-2xl text-sm border-2 bg-amber-50 border-amber-200 text-amber-900 block';
                alertIcon.className = 'fas fa-triangle-exclamation text-base text-amber-600 mt-0.5 shrink-0';
            } else if (type === 'success') {
                alertBox.className = 'mb-6 p-4 rounded-2xl text-sm border-2 bg-emerald-50 border-emerald-200 text-emerald-900 block';
                alertIcon.className = 'fas fa-circle-check text-base text-emerald-600 mt-0.5 shrink-0';
            }
            alertContent.innerText = message;
        }

        function clearAlert() {
            alertBox.classList.add('hidden');
            alertContent.innerText = '';
        }

        btnTogglePassword.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePasswordIcon.className = isPassword ? 'fas fa-eye-slash text-[15px] text-primary-700' : 'fas fa-eye text-[15px]';
            btnTogglePassword.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha em texto claro');
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAlert();
            emailError.classList.add('hidden');
            passwordError.classList.add('hidden');

            const email = emailInput.value.trim();
            const password = passwordInput.value;
            let hasError = false;

            if (!email) {
                emailError.innerText = 'Informe seu e-mail institucional.';
                emailError.classList.remove('hidden');
                hasError = true;
            } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
                emailError.innerText = 'Formato de e-mail inv\xE1lido.';
                emailError.classList.remove('hidden');
                hasError = true;
            }

            if (!password) {
                passwordError.innerText = 'Informe sua senha de acesso.';
                passwordError.classList.remove('hidden');
                hasError = true;
            }

            if (hasError) return;

            btnSubmit.disabled = true;
            btnText.innerText = 'Autenticando na Central...';
            btnIcon.className = 'fas fa-circle-notch fa-spin text-xs';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json().catch(() => null);

                if (!res.ok) {
                    btnSubmit.disabled = false;
                    btnText.innerText = 'Entrar na Central EEC';
                    btnIcon.className = 'fas fa-arrow-right text-xs';

                    if (res.status === 401) {
                        showAlert('error', 'E-mail institucional ou senha incorretos.');
                    } else if (res.status === 403) {
                        showAlert('warning', 'Sua conta institucional est\xE1 desativada. Procure a administra\xE7\xE3o da escola.');
                    } else if (res.status === 429) {
                        showAlert('warning', 'Muitas tentativas seguidas. Aguarde 1 minuto antes de tentar novamente.');
                    } else if (res.status === 503) {
                        showAlert('error', 'O servi\xE7o de autentica\xE7\xE3o est\xE1 temporariamente indispon\xEDvel. Tente novamente em instantes.');
                    } else {
                        showAlert('error', 'N\xE3o foi poss\xEDvel concluir o acesso agora (c\xF3digo ' + res.status + '). Tente novamente em instantes.');
                    }
                    return;
                }

                showAlert('success', 'Autentica\xE7\xE3o realizada com sucesso! Redirecionando...');

                setTimeout(() => {
                    if (data?.user?.role === 'docente') {
                        window.location.href = '/portal-docente';
                    } else {
                        window.location.href = '/admin';
                    }
                }, 300);

            } catch (err) {
                btnSubmit.disabled = false;
                btnText.innerText = 'Entrar na Central EEC';
                btnIcon.className = 'fas fa-arrow-right text-xs';
                showAlert('error', 'Falha na conex\xE3o com o servidor de autentica\xE7\xE3o.');
            }
        });

        btnOpenForgot.addEventListener('click', () => {
            forgotModal.classList.remove('hidden');
            forgotEmail.value = emailInput.value.trim();
            forgotAlert.classList.add('hidden');
        });

        btnCloseForgot.addEventListener('click', () => forgotModal.classList.add('hidden'));
        btnCancelForgot.addEventListener('click', () => forgotModal.classList.add('hidden'));

        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = forgotEmail.value.trim();
            if (!email) return;

            btnSubmitForgot.disabled = true;
            btnSubmitForgot.innerHTML = '<i class="fas fa-circle-notch fa-spin text-xs"></i> Enviando...';

            try {
                const res = await fetch('/api/auth/recuperar-senha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const json = await res.json().catch(() => ({}));

                forgotAlert.className = 'mb-5 p-3.5 rounded-xl text-[13px] border block ' +
                    (res.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900');
                forgotAlert.innerText = json.message || 'Solicita\xE7\xE3o registrada. Verifique sua caixa de entrada e pasta de lixo eletr\xF4nico.';

                if (res.ok) {
                    setTimeout(() => {
                        forgotModal.classList.add('hidden');
                        showAlert('success', 'Solicita\xE7\xE3o processada. Verifique suas orienta\xE7\xF5es no e-mail.');
                    }, 2500);
                }
            } catch {
                forgotAlert.className = 'mb-5 p-3.5 rounded-xl text-[13px] border bg-amber-50 border-amber-200 text-amber-900 block';
                forgotAlert.innerText = 'Solicita\xE7\xE3o registrada no sistema. Procure a administra\xE7\xE3o escolar.';
            } finally {
                btnSubmitForgot.disabled = false;
                btnSubmitForgot.innerHTML = '<i class="fas fa-paper-plane text-xs"></i>Enviar instru\xE7\xF5es';
            }
        });
    </script>
</body>
</html>`;
}
function renderResetPasswordPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinir Senha \u2014 Central EEC</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="${assetUrl("/styles/tailwind.css")}">
    <link rel="stylesheet" href="${assetUrl("/static/styles.css")}">
</head>
<body class="bg-slate-100 text-slate-800 min-h-full flex items-center justify-center p-4 font-poppins selection:bg-blue-600 selection:text-white">
    <div class="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-200">
        <div class="text-center mb-6">
            <div class="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-md inline-block mb-3">
                <img src="/images/logo-eec-oficial.png" alt="Escola Estadual do Cariri" class="h-12 w-auto object-contain">
            </div>
            <h1 class="text-xl font-bold text-slate-900">Redefinir Senha de Acesso</h1>
            <p class="text-xs text-slate-600 mt-1">Defina uma nova senha para sua conta institucional.</p>
        </div>

        <div id="reset-alert" class="hidden mb-4 p-3 rounded-xl text-xs border"></div>

        <form id="reset-form" class="space-y-4">
            <div>
                <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Nova Senha</label>
                <input type="password" id="nova-senha" required minlength="8" placeholder="M\xEDnimo de 8 caracteres" class="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-blue-600">
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Confirmar Nova Senha</label>
                <input type="password" id="confirmar-senha" required minlength="8" placeholder="Repita a nova senha" class="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-blue-600">
            </div>
            <button type="submit" id="btn-save-pass" class="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm transition-all shadow-md">
                Salvar Nova Senha
            </button>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-200 text-center">
            <a href="/admin/login" class="text-xs text-blue-700 font-semibold hover:underline">Voltar \xE0 tela de login</a>
        </div>
    </div>
</body>
</html>`;
}
function renderAdminDashboard(userName, role) {
  const gestor = role === "super_admin" || role === "admin";
  const primeiroNome = userName.trim().split(/\s+/)[0] || userName;
  const papel = getRoleLabel(role);
  const acao = (href, icone, cor, rotulo, nota, novaAba = false) => `
                    <a href="${href}"${novaAba ? ' target="_blank" rel="noopener"' : ""}
                       class="group flex items-center gap-4 px-5 py-4 min-h-[44px] bg-slate-800/70 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-2xl transition-colors">
                        <span class="w-11 h-11 shrink-0 rounded-xl bg-slate-900 border border-slate-700 ${cor} flex items-center justify-center">
                            <i class="fas ${icone}" aria-hidden="true"></i>
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="block text-white font-semibold text-[17px] leading-tight">${escaparHtml(rotulo)}</span>
                            <span class="block text-slate-400 text-base leading-snug mt-0.5">${escaparHtml(nota)}</span>
                        </span>
                        <i class="fas fa-arrow-right text-slate-500 group-hover:text-blue-400 transition-colors text-sm shrink-0" aria-hidden="true"></i>
                    </a>`;
  const conteudo = `
            <!-- 1. Sauda\xE7\xE3o e contexto -->
            <section class="bg-gradient-to-br from-slate-800 to-slate-800/40 border border-slate-700 rounded-2xl p-6 sm:p-7">
                <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-2xl sm:text-[28px] font-bold text-white leading-tight">Ol\xE1, ${escaparHtml(primeiroNome)}.</h2>
                    <span class="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-sm font-semibold">${escaparHtml(papel)}</span>
                </div>
                <p class="text-[17px] text-slate-400 mt-3 leading-relaxed max-w-3xl">
                    Esta \xE9 a leitura r\xE1pida da Central. Os n\xFAmeros abaixo dizem como est\xE3o as coisas;
                    cada m\xF3dulo tem a sua pr\xF3pria p\xE1gina, com a interface completa.
                </p>
            </section>

            <!-- 2. Indicadores -->
            <section aria-label="Indicadores">
                <!-- No celular os indicadores ficam 2x2: empilhados em coluna \xFAnica,
                     sozinhos j\xE1 ocupavam uma tela inteira de rolagem. -->
                <div class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                    ${cartaoIndicador("comunicados", "Comunicados", "fa-bullhorn", "text-sky-400", "Publicados para os servidores", "/admin/comunicados")}
                    ${cartaoIndicador("documentos", "Documentos", "fa-file-circle-check", "text-emerald-400", "Aguardando an\xE1lise", "/admin/documentos")}
                    ${gestor ? cartaoIndicador("usuarios", "Usu\xE1rios ativos", "fa-users-gear", "text-purple-400", "Contas institucionais em uso", "/admin/usuarios") : ""}
                    ${gestor ? cartaoIndicador("contatos", "Mensagens", "fa-envelope-open-text", "text-rose-400", "Recebidas da comunidade", "/admin/mensagens") : ""}
                </div>
            </section>

            <!-- 3. Uma \xFAnica lista compacta, atravessando os m\xF3dulos -->
            <section class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-700">
                    <div class="min-w-0">
                        <h2 class="text-xl font-bold text-white flex items-center gap-2.5">
                            <i class="fas fa-list-check text-amber-400" aria-hidden="true"></i> Precisa da sua aten\xE7\xE3o
                        </h2>
                        <p class="text-base text-slate-400 mt-0.5">Pend\xEAncias e registros recentes, em uma linha cada</p>
                    </div>
                    <button type="button" data-action="recarregar-painel"
                            class="shrink-0 px-4 min-h-[44px] inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base font-medium rounded-xl transition-colors cursor-pointer">
                        <i class="fas fa-rotate text-sm" aria-hidden="true"></i> Atualizar
                    </button>
                </div>
                <div id="painel-atencao" class="divide-y divide-slate-700/70"></div>
            </section>

            <!-- 4. A\xE7\xF5es r\xE1pidas -->
            <section aria-label="A\xE7\xF5es r\xE1pidas">
                <h2 class="text-xl font-bold text-white mb-4">Ir direto para</h2>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    ${acao("/admin/comunicados", "fa-bullhorn", "text-sky-400", "Comunicados Internos", "Informes publicados aos servidores")}
                    ${acao("/admin/documentos", "fa-file-shield", "text-emerald-400", "An\xE1lise de Documentos", "Revisar e aprovar documentos pedag\xF3gicos")}
                    ${gestor ? acao("/admin/usuarios", "fa-users-gear", "text-purple-400", "Usu\xE1rios e Acessos", "Contas, pap\xE9is e permiss\xF5es") : ""}
                    ${gestor ? acao("/admin/mensagens", "fa-envelope-open-text", "text-rose-400", "Mensagens da Comunidade", "Recebidas pelo formul\xE1rio do site") : ""}
                    ${gestor ? acao("/admin/site-publico", "fa-globe", "text-blue-400", "Site P\xFAblico", "Destaques do her\xF3i, cursos, projetos e not\xEDcias") : ""}
                    ${gestor ? acao("/admin/site-publico/preview", "fa-eye", "text-amber-400", "Pr\xE9-visualizar o Site", "Ver rascunhos sem publicar", true) : ""}
                </div>
            </section>`;
  return layoutAdmin({
    titulo: "Vis\xE3o Geral",
    tituloPagina: "Painel Administrativo",
    descricao: "Leitura r\xE1pida da Central de Comando. Os m\xF3dulos abrem em p\xE1ginas pr\xF3prias.",
    icone: "fa-chart-pie",
    ativo: "visao-geral",
    userName,
    role,
    conteudo,
    scripts: ["/static/admin-dashboard.js"]
  });
}
var MODULOS_ADMIN = {
  comunicados: {
    chave: "comunicados",
    titulo: "Comunicados Internos",
    icone: "fa-bullhorn",
    cor: "text-sky-400",
    descricao: "Informes institucionais distribu\xEDdos aos servidores da escola.",
    rodape: "Esta p\xE1gina lista todos os comunicados internos aos quais o seu perfil tem acesso. A Vis\xE3o Geral aponta apenas os que pedem a\xE7\xE3o.",
    lista: "comunicados"
  },
  documentos: {
    chave: "documentos",
    titulo: "An\xE1lise de Documentos",
    icone: "fa-file-shield",
    cor: "text-emerald-400",
    descricao: "Documentos pedag\xF3gicos enviados para revis\xE3o e aprova\xE7\xE3o.",
    rodape: "Esta p\xE1gina lista os documentos pedag\xF3gicos em todos os estados. O indicador da Vis\xE3o Geral conta apenas os que aguardam an\xE1lise.",
    lista: "documentos"
  },
  usuarios: {
    chave: "usuarios",
    titulo: "Usu\xE1rios e Acessos",
    icone: "fa-users-gear",
    cor: "text-purple-400",
    descricao: "Contas institucionais, pap\xE9is e transfer\xEAncia de Administrador Geral.",
    rodape: "A transfer\xEAncia de Administrador Geral \xE9 transacional e altera o seu pr\xF3prio papel. Revise antes de confirmar.",
    lista: "usuarios"
  },
  mensagens: {
    chave: "mensagens",
    titulo: "Mensagens da Comunidade",
    icone: "fa-envelope-open-text",
    cor: "text-rose-400",
    descricao: "Mensagens recebidas pelo formul\xE1rio p\xFAblico de contato.",
    rodape: "Mensagens enviadas pela comunidade no formul\xE1rio do site p\xFAblico. A Vis\xE3o Geral aponta apenas as que pedem a\xE7\xE3o.",
    lista: "contatos"
  }
};
function isModuloAdmin(valor) {
  return Object.prototype.hasOwnProperty.call(MODULOS_ADMIN, valor);
}
function renderAdminModuloPage(modulo, userName, role) {
  const m = MODULOS_ADMIN[modulo];
  return layoutAdmin({
    titulo: m.titulo,
    descricao: m.descricao,
    icone: m.icone,
    corIcone: m.cor,
    ativo: m.chave,
    userName,
    role,
    trilha: [{ rotulo: "Vis\xE3o Geral", href: "/admin" }],
    conteudo: `
            <section aria-labelledby="titulo-modulo" data-modulo-pagina="${escaparHtml(modulo)}"
                     class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div class="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-700 bg-slate-800/60">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="w-11 h-11 shrink-0 rounded-xl bg-slate-900 border border-slate-700 ${m.cor} flex items-center justify-center">
                            <i class="fas ${m.icone} text-lg"></i>
                        </span>
                        <div class="min-w-0">
                            <h2 id="titulo-modulo" class="text-xl font-bold text-white truncate">${escaparHtml(m.titulo)}</h2>
                            <p class="text-[15px] text-slate-400">
                                <span id="contagem-${m.lista}">\u2014</span> registro(s) neste m\xF3dulo
                            </p>
                        </div>
                    </div>
                    <button type="button" data-action="recarregar" data-modulo="${m.lista}"
                            class="shrink-0 px-5 min-h-[44px] inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[15px] font-medium rounded-xl transition-colors cursor-pointer">
                        <i class="fas fa-rotate text-sm"></i> Atualizar
                    </button>
                </div>

                <div class="p-6">
                    <div id="lista-${m.lista}"></div>
                </div>
            </section>

            <p class="text-[15px] text-slate-500 flex items-start gap-2.5">
                <i class="fas fa-circle-info text-slate-600 mt-1 shrink-0"></i>
                <span>${escaparHtml(m.rodape)}</span>
            </p>`,
    scripts: ["/static/admin-dashboard.js"]
  });
}
var AVISO_VISUALIZACAO = (roleLabel) => `
    <div class="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-base px-4 sm:px-6 lg:px-8 py-3 flex items-start gap-2.5">
        <i class="fas fa-eye text-sm mt-1 shrink-0" aria-hidden="true"></i>
        <span><strong>Modo de visualiza\xE7\xE3o administrativa \u2014 Portal do Professor.</strong>
        Voc\xEA est\xE1 inspecionando a experi\xEAncia destinada aos docentes; seu acesso continua como ${escaparHtml(roleLabel)}.</span>
    </div>`;
function renderPortalDocentePage(userName, role) {
  const roleLabel = getRoleLabel(role);
  const modoVisualizacao = role !== "docente";
  const primeiroNome = userName.trim().split(/\s+/)[0] || userName;
  const painelRecentes = (id, titulo, icone, href, nota) => `
                <section class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
                    <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-700">
                        <div class="min-w-0">
                            <h2 class="text-xl font-bold text-white flex items-center gap-2.5">
                                <i class="fas ${icone} text-indigo-400" aria-hidden="true"></i> ${escaparHtml(titulo)}
                            </h2>
                            <p class="text-base text-slate-400 mt-0.5">${escaparHtml(nota)}</p>
                        </div>
                        <a href="${href}"
                           class="shrink-0 px-4 min-h-[44px] inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base font-medium rounded-xl transition-colors">
                            Ver todos <span id="total-${id}" class="text-slate-400"></span>
                            <i class="fas fa-arrow-right text-xs" aria-hidden="true"></i>
                        </a>
                    </div>
                    <div id="resumo-${id}" class="p-6 flex-1"></div>
                </section>`;
  const conteudo = `
            <!-- 1. Quem \xE9 e onde est\xE1 -->
            <section class="bg-gradient-to-br from-indigo-950/60 to-slate-800/40 border border-indigo-800/60 rounded-2xl p-6 sm:p-7">
                <div class="flex flex-wrap items-center gap-3">
                    <h2 class="text-2xl sm:text-[28px] font-bold text-white leading-tight">Ol\xE1, ${escaparHtml(primeiroNome)}.</h2>
                    <span class="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm font-semibold">${escaparHtml(roleLabel)}</span>
                    <span class="px-3 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600 text-sm font-semibold inline-flex items-center gap-1.5">
                        <i class="fas fa-chalkboard-user text-[11px]" aria-hidden="true"></i>\xC1rea docente
                    </span>
                </div>
                <p class="text-[17px] text-slate-300 mt-3 leading-relaxed max-w-3xl">
                    \xC1rea docente institucional da Escola Estadual do Cariri. Aqui ficam os comunicados
                    internos dirigidos ao corpo docente e os documentos pedag\xF3gicos compartilhados pela gest\xE3o.
                </p>
            </section>

            <!-- 2. Indicadores -->
            <section aria-label="Indicadores">
                <div class="grid grid-cols-2 gap-3 sm:gap-4">
                    ${cartaoIndicador("docente-comunicados", "Comunicados", "fa-bullhorn", "text-indigo-400", "Dirigidos ao corpo docente", "/professor/comunicados")}
                    ${cartaoIndicador("docente-documentos", "Documentos", "fa-folder-open", "text-indigo-400", "Materiais pedag\xF3gicos dispon\xEDveis", "/professor/documentos")}
                </div>
            </section>

            <!-- 3. Registros recentes, com acesso \xE0 lista completa no cabe\xE7alho -->
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                ${painelRecentes("docente-comunicados", "Comunicados recentes", "fa-bullhorn", "/professor/comunicados", "Os tr\xEAs \xFAltimos publicados")}
                ${painelRecentes("docente-documentos", "Documentos recentes", "fa-folder-open", "/professor/documentos", "Os tr\xEAs \xFAltimos compartilhados")}
            </div>`;
  return layoutAdmin({
    titulo: "Portal do Professor",
    descricao: "\xC1rea docente institucional: comunicados internos e documentos pedag\xF3gicos.",
    icone: "fa-chalkboard-user",
    corIcone: "text-indigo-400",
    ativo: "portal-docente",
    acento: "indigo",
    userName,
    role,
    aviso: modoVisualizacao ? AVISO_VISUALIZACAO(roleLabel) : "",
    conteudo,
    scripts: ["/static/portal-docente.js"]
  });
}
var MODULOS_DOCENTE = {
  comunicados: {
    titulo: "Comunicados Internos",
    icone: "fa-bullhorn",
    descricao: "Informes publicados pela gest\xE3o para o corpo docente.",
    rodape: "Lista completa dos comunicados internos dirigidos ao corpo docente. A p\xE1gina inicial do portal mostra apenas os mais recentes.",
    lista: "docente-comunicados"
  },
  documentos: {
    titulo: "Documentos Pedag\xF3gicos",
    icone: "fa-folder-open",
    descricao: "Materiais compartilhados pela gest\xE3o, com download quando dispon\xEDvel.",
    rodape: "Materiais pedag\xF3gicos compartilhados com o corpo docente. O bot\xE3o de download aparece quando o arquivo est\xE1 dispon\xEDvel.",
    lista: "docente-documentos"
  }
};
function isModuloDocente(valor) {
  return Object.prototype.hasOwnProperty.call(MODULOS_DOCENTE, valor);
}
function renderPortalDocenteModuloPage(modulo, userName, role) {
  const m = MODULOS_DOCENTE[modulo];
  const roleLabel = getRoleLabel(role);
  const modoVisualizacao = role !== "docente";
  const ativo = modoVisualizacao ? "portal-docente" : modulo === "comunicados" ? "docente-comunicados" : "docente-documentos";
  return layoutAdmin({
    titulo: m.titulo,
    descricao: m.descricao,
    icone: m.icone,
    corIcone: "text-indigo-400",
    ativo,
    acento: "indigo",
    userName,
    role,
    aviso: modoVisualizacao ? AVISO_VISUALIZACAO(roleLabel) : "",
    trilha: [{ rotulo: "Portal do Professor", href: "/portal-docente" }],
    conteudo: `
            <section aria-labelledby="titulo-modulo" data-modulo-pagina="${escaparHtml(modulo)}"
                     class="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                <div class="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-700 bg-slate-800/60">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="w-11 h-11 shrink-0 rounded-xl bg-slate-900 border border-slate-700 text-indigo-400 flex items-center justify-center">
                            <i class="fas ${m.icone} text-lg"></i>
                        </span>
                        <div class="min-w-0">
                            <h2 id="titulo-modulo" class="text-xl font-bold text-white truncate">${escaparHtml(m.titulo)}</h2>
                            <p class="text-[15px] text-slate-400">
                                <span id="contagem-${m.lista}">\u2014</span> registro(s) dispon\xEDveis
                            </p>
                        </div>
                    </div>
                    <button type="button" data-action="recarregar" data-modulo="${m.lista}"
                            class="shrink-0 px-5 min-h-[44px] inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[15px] font-medium rounded-xl transition-colors cursor-pointer">
                        <i class="fas fa-rotate text-sm"></i> Atualizar
                    </button>
                </div>

                <div class="p-6">
                    <div id="lista-${m.lista}"></div>
                </div>
            </section>

            <p class="text-[15px] text-slate-500 flex items-start gap-2.5">
                <i class="fas fa-circle-info text-slate-600 mt-1 shrink-0"></i>
                <span>${escaparHtml(m.rodape)}</span>
            </p>`,
    scripts: ["/static/portal-docente.js"]
  });
}

// src/views/formulario.ts
function renderFormularioPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Personaliza\xE7\xE3o Institucional</title>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="${assetUrl("/styles/tailwind.css")}" rel="stylesheet">
    <style>
        /* Smooth scrolling */
        html { scroll-behavior: smooth; }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #1a365d; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: #2c5282; }

        /* Animations */
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-20px); } 100% { transform: translateY(0px); } }
        .floating-element { animation: float 6s ease-in-out infinite; }
        .floating-element-delay { animation: float 6s ease-in-out 3s infinite; }

        /* Navbar blur */
        .glass-nav { background: rgba(26, 54, 93, 0.95); backdrop-filter: blur(10px); }

        /* Slider agora controlado via classes Tailwind inline */
    </style>
</head>
<body class="font-poppins bg-gray-50 min-h-screen">

    <!-- Navega\xE7\xE3o administrativa: trilha e retorno expl\xEDcito ao painel -->
    <div class="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between text-xs">
        <nav aria-label="Trilha de navega\xE7\xE3o" class="flex items-center gap-2 text-slate-400">
            <a href="/admin" class="hover:text-white transition-colors flex items-center gap-1.5 font-medium">
                <i class="fas fa-house text-[11px]"></i><span>Vis\xE3o Geral</span>
            </a>
            <i class="fas fa-chevron-right text-[9px] text-slate-600"></i>
            <span class="text-amber-400 font-semibold flex items-center gap-1.5">
                <i class="fas fa-sliders text-[11px]"></i><span>Personaliza\xE7\xE3o Institucional</span>
            </span>
        </nav>
        <a href="/admin" class="inline-flex items-center gap-1.5 text-slate-400 hover:text-white font-medium transition-colors">
            <i class="fas fa-arrow-left text-[11px]"></i><span>Voltar ao Painel</span>
        </a>
    </div>

    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-8 px-4">
        <div class="max-w-5xl mx-auto text-center">
            <div class="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                <i class="fas fa-wand-magic-sparkles text-3xl text-yellow-400"></i>
            </div>
            <h1 class="text-3xl lg:text-4xl font-bold mb-3">Personalize o Site da Sua Escola</h1>
            <p class="text-white/70 text-lg max-w-2xl mx-auto">
                Identidade e informa\xE7\xF5es globais da escola \u2014 nome, slogan, contatos gerais e identidade visual. O conte\xFAdo das p\xE1ginas p\xFAblicas \xE9 editado em <a href="/admin/site-publico" class="underline hover:text-white">Site P\xFAblico</a>.
            </p>
        </div>
    </div>

    <!-- Progress Bar -->
    <div class="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div class="max-w-5xl mx-auto px-4 py-4">
            <div class="flex items-center justify-between mb-3">
                <span id="progress-text" class="text-sm font-semibold text-gray-600">Etapa 1 de 7</span>
                <span class="text-xs text-gray-400">* Campos obrigatorios</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div id="progress-bar" class="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" style="width: 14.28%"></div>
            </div>
            <!-- Step Dots -->
            <div class="flex justify-between mt-4">
                <div id="step-dot-1" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-200 transition-all duration-300">1</div>
                <div id="step-dot-2" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300">2</div>
                <div id="step-dot-3" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300">3</div>
                <div id="step-dot-4" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300">4</div>
                <div id="step-dot-5" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300">5</div>
                <div id="step-dot-6" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300">6</div>
                <div id="step-dot-7" class="step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300">7</div>
            </div>
        </div>
    </div>

    <!-- Form Container -->
    <div id="form-container" class="max-w-5xl mx-auto px-4 py-8">
        <form id="school-form">

            <!-- ==================== STEP 1: Identidade ==================== -->
            <div id="step-1" class="form-step">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-school text-blue-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Identidade da Escola</h2>
                            <p class="text-gray-400 text-sm">Informacoes basicas sobre a instituicao</p>
                        </div>
                    </div>

                    <div class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Nome completo da escola *</label>
                            <input type="text" name="nome_escola" required placeholder="Ex: Escola Estadual Professor Joao Silva" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Slogan / Lema da escola</label>
                            <input type="text" name="slogan" placeholder="Ex: Educacao que transforma vidas" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            <p class="text-xs text-gray-400 mt-1">Se nao tiver, deixe em branco que criaremos um</p>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Ano de fundacao</label>
                            <input type="text" name="ano_fundacao" placeholder="Ex: 1998" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Descricao da escola *</label>
                            <textarea name="descricao_escola" rows="4" required placeholder="Descreva a escola com suas proprias palavras: historia, proposta, diferenciais, o que a torna especial..." class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm resize-none"></textarea>
                        </div>

                        <div class="grid md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Missao</label>
                                <textarea name="missao" rows="3" placeholder="Qual a missao da escola?" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm resize-none"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Visao</label>
                                <textarea name="visao" rows="3" placeholder="Qual a visao de futuro?" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm resize-none"></textarea>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Valores</label>
                                <textarea name="valores" rows="3" placeholder="Quais sao os valores? (separados por virgula)" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm resize-none"></textarea>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Niveis de ensino oferecidos *</label>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <label class="flex items-center space-x-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100">
                                    <input type="checkbox" name="niveis_ensino" value="educacao_infantil" class="w-4 h-4 text-blue-600 rounded">
                                    <span class="text-sm text-gray-700">Educacao Infantil</span>
                                </label>
                                <label class="flex items-center space-x-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100">
                                    <input type="checkbox" name="niveis_ensino" value="fundamental_1" class="w-4 h-4 text-blue-600 rounded">
                                    <span class="text-sm text-gray-700">Fundamental I</span>
                                </label>
                                <label class="flex items-center space-x-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100">
                                    <input type="checkbox" name="niveis_ensino" value="fundamental_2" class="w-4 h-4 text-blue-600 rounded">
                                    <span class="text-sm text-gray-700">Fundamental II</span>
                                </label>
                                <label class="flex items-center space-x-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100">
                                    <input type="checkbox" name="niveis_ensino" value="ensino_medio" class="w-4 h-4 text-blue-600 rounded">
                                    <span class="text-sm text-gray-700">Ensino Medio</span>
                                </label>
                                <label class="flex items-center space-x-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100">
                                    <input type="checkbox" name="niveis_ensino" value="eja" class="w-4 h-4 text-blue-600 rounded">
                                    <span class="text-sm text-gray-700">EJA</span>
                                </label>
                                <label class="flex items-center space-x-3 bg-gray-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors border border-gray-100">
                                    <input type="checkbox" name="niveis_ensino" value="tecnico" class="w-4 h-4 text-blue-600 rounded">
                                    <span class="text-sm text-gray-700">Tecnico</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ==================== STEP 2: Contato & Localizacao ==================== -->
            <div id="step-2" class="form-step hidden">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-location-dot text-emerald-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Contato e Localizacao</h2>
                            <p class="text-gray-400 text-sm">Como os pais podem encontrar e contatar a escola</p>
                        </div>
                    </div>

                    <div class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Endereco completo *</label>
                            <input type="text" name="endereco" required placeholder="Rua, numero, complemento" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                        </div>

                        <div class="grid md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Bairro</label>
                                <input type="text" name="bairro" placeholder="Bairro" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Cidade *</label>
                                <input type="text" name="cidade" required placeholder="Cidade" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Estado *</label>
                                <select name="estado" required class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                                    <option value="">Selecione</option>
                                    <option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option><option value="AM">AM</option>
                                    <option value="BA">BA</option><option value="CE">CE</option><option value="DF">DF</option><option value="ES">ES</option>
                                    <option value="GO">GO</option><option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option>
                                    <option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option><option value="PR">PR</option>
                                    <option value="PE">PE</option><option value="PI">PI</option><option value="RJ">RJ</option><option value="RN">RN</option>
                                    <option value="RS">RS</option><option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option>
                                    <option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">CEP</label>
                            <input type="text" name="cep" placeholder="00000-000" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                        </div>

                        <div class="grid md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Telefone principal *</label>
                                <input type="tel" name="telefone" required placeholder="(00) 0000-0000" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Telefone secundario</label>
                                <input type="tel" name="telefone2" placeholder="(00) 0000-0000" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">WhatsApp</label>
                                <input type="tel" name="whatsapp" placeholder="(00) 00000-0000" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                        </div>

                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Email principal *</label>
                                <input type="email" name="email" required placeholder="contato@escola.edu.br" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Email matriculas</label>
                                <input type="email" name="email_matriculas" placeholder="matriculas@escola.edu.br" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Horario de atendimento</label>
                            <input type="text" name="horario_atendimento" placeholder="Ex: Seg a Sex: 7h - 17h | Sab: 8h - 12h" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                        </div>

                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5"><i class="fab fa-facebook text-blue-600 mr-1"></i> Facebook</label>
                                <input type="url" name="facebook" placeholder="https://facebook.com/suaescola" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5"><i class="fab fa-instagram text-pink-600 mr-1"></i> Instagram</label>
                                <input type="url" name="instagram" placeholder="https://instagram.com/suaescola" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5"><i class="fab fa-youtube text-red-600 mr-1"></i> YouTube</label>
                                <input type="url" name="youtube" placeholder="https://youtube.com/@suaescola" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5"><i class="fas fa-globe text-blue-500 mr-1"></i> Site atual (se houver)</label>
                                <input type="url" name="site" placeholder="https://www.suaescola.edu.br" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ==================== STEP 3: Numeros e Cores ==================== -->
            <div id="step-3" class="form-step hidden">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-chart-bar text-yellow-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Numeros e Visual</h2>
                            <p class="text-gray-400 text-sm">Estatisticas da escola e preferencias visuais</p>
                        </div>
                    </div>

                    <div class="space-y-5">
                        <div class="grid md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Numero de alunos</label>
                                <input type="number" name="num_alunos" placeholder="Ex: 500" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Numero de professores</label>
                                <input type="number" name="num_professores" placeholder="Ex: 30" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Taxa aprovacao (%)</label>
                                <input type="number" name="taxa_aprovacao" placeholder="Ex: 95" max="100" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                        </div>

                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Nota media ENEM (se aplicavel)</label>
                                <input type="number" name="nota_enem" placeholder="Ex: 650" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Area total da escola (m2)</label>
                                <input type="text" name="area_escola" placeholder="Ex: 3000" class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm">
                            </div>
                        </div>

                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Cor primaria da escola</label>
                                <div class="flex items-center space-x-3">
                                    <input type="color" name="cor_primaria" value="#1E40AF" class="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer p-1">
                                    <span class="text-sm text-gray-500">Cor principal do uniforme ou da escola</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Cor secundaria</label>
                                <div class="flex items-center space-x-3">
                                    <input type="color" name="cor_secundaria" value="#F59E0B" class="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer p-1">
                                    <span class="text-sm text-gray-500">Cor de destaque ou complementar</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Diferenciais da escola</label>
                            <textarea name="diferenciais" rows="3" placeholder="O que torna sua escola especial? Ex: laboratorio de informatica, quadra poliesportiva, biblioteca, ensino bilingue, projetos sociais, horta comunitaria..." class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm resize-none"></textarea>
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Infraestrutura</label>
                            <textarea name="infraestrutura" rows="3" placeholder="Descreva a estrutura: salas de aula, laboratorios, quadra, refeitorio, biblioteca, etc." class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-gray-50 text-sm resize-none"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ==================== STEP 4: Cursos ==================== -->
            <div id="step-4" class="form-step hidden">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-book-open text-purple-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Cursos e Niveis de Ensino</h2>
                            <p class="text-gray-400 text-sm">Detalhe cada curso ou nivel oferecido</p>
                        </div>
                    </div>

                    <div id="cursos-container" class="space-y-4">
                        <div class="curso-item bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Nome do Curso/Nivel *</label>
                                    <input type="text" name="curso_nome_1" required placeholder="Ex: Educacao Infantil" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Faixa Etaria</label>
                                    <input type="text" name="curso_idade_1" placeholder="Ex: 2-5 anos" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                            </div>
                            <div class="mt-3">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Descricao breve</label>
                                <input type="text" name="curso_desc_1" placeholder="Descreva brevemente este curso..." class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                            </div>
                            <div class="mt-3">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Turno</label>
                                <select name="curso_turno_1" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                    <option value="Matutino">Matutino</option>
                                    <option value="Vespertino">Vespertino</option>
                                    <option value="Matutino e Vespertino">Matutino e Vespertino</option>
                                    <option value="Integral">Integral</option>
                                    <option value="Noturno">Noturno</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <button type="button" id="add-curso" class="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center">
                        <i class="fas fa-plus mr-2"></i>Adicionar outro curso
                    </button>
                </div>
            </div>

            <!-- ==================== STEP 5: Equipe ==================== -->
            <div id="step-5" class="form-step hidden">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-users text-teal-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Equipe (opcional)</h2>
                            <p class="text-gray-400 text-sm">Diretores, coordenadores e professores destaque</p>
                        </div>
                    </div>

                    <div id="professores-container" class="space-y-4">
                        <div class="professor-item bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                                    <input type="text" name="prof_nome_1" placeholder="Ex: Profa. Maria Silva" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Cargo/Disciplina</label>
                                    <input type="text" name="prof_cargo_1" placeholder="Ex: Diretora / Matematica" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                            </div>
                            <div class="mt-3">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Mini Biografia</label>
                                <input type="text" name="prof_bio_1" placeholder="Breve descricao profissional..." class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                            </div>
                        </div>
                    </div>

                    <button type="button" id="add-professor" class="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50 transition-all flex items-center justify-center">
                        <i class="fas fa-plus mr-2"></i>Adicionar outro membro da equipe
                    </button>
                </div>
            </div>

            <!-- ==================== STEP 6: Depoimentos & Eventos ==================== -->
            <div id="step-6" class="form-step hidden">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-comments text-rose-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Depoimentos (opcional)</h2>
                            <p class="text-gray-400 text-sm">O que pais e alunos dizem sobre a escola</p>
                        </div>
                    </div>

                    <div id="depoimentos-container" class="space-y-4">
                        <div class="depoimento-item bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                                    <input type="text" name="dep_nome_1" placeholder="Nome do pai/mae/aluno" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Relacao</label>
                                    <input type="text" name="dep_relacao_1" placeholder="Ex: Mae de aluno - 3o ano" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                            </div>
                            <div class="mt-3">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Depoimento</label>
                                <textarea name="dep_texto_1" rows="2" placeholder="O que essa pessoa diria sobre a escola..." class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm resize-none"></textarea>
                            </div>
                        </div>
                    </div>

                    <button type="button" id="add-depoimento" class="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center">
                        <i class="fas fa-plus mr-2"></i>Adicionar outro depoimento
                    </button>
                </div>

                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-calendar text-orange-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Proximos Eventos (opcional)</h2>
                            <p class="text-gray-400 text-sm">Eventos, feiras, reunioes que estao por vir</p>
                        </div>
                    </div>

                    <div id="eventos-container" class="space-y-4">
                        <div class="evento-item bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <div class="grid md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Titulo do Evento</label>
                                    <input type="text" name="evt_titulo_1" placeholder="Nome do evento" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Data</label>
                                    <input type="text" name="evt_data_1" placeholder="Ex: 15 de Marco" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                                    <select name="evt_tipo_1" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                                        <option value="academico">Academico</option>
                                        <option value="cultural">Cultural</option>
                                        <option value="esportivo">Esportivo</option>
                                        <option value="institucional">Institucional</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mt-3">
                                <label class="block text-sm font-semibold text-gray-700 mb-1">Descricao</label>
                                <input type="text" name="evt_desc_1" placeholder="Breve descricao do evento..." class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm">
                            </div>
                        </div>
                    </div>

                    <button type="button" id="add-evento" class="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 transition-all flex items-center justify-center">
                        <i class="fas fa-plus mr-2"></i>Adicionar outro evento
                    </button>
                </div>
            </div>

            <!-- ==================== STEP 7: Revisao ==================== -->
            <div id="step-7" class="form-step hidden">
                <div class="bg-white rounded-3xl shadow-sm border p-8 mb-6">
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <i class="fas fa-check-double text-indigo-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Revisao Final</h2>
                            <p class="text-gray-400 text-sm">Confira se esta tudo certo antes de enviar</p>
                        </div>
                    </div>

                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6">
                        <div class="flex items-start space-x-4">
                            <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                                <i class="fas fa-lightbulb text-2xl text-yellow-500"></i>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 mb-1">Dica importante!</h3>
                                <p class="text-gray-600 text-sm">Voce nao precisa preencher TUDO agora. Os campos vazios serao preenchidos com dados gen\xE9ricos que podemos ajustar depois. O mais importante e o <strong>nome da escola</strong>, <strong>descricao</strong> e <strong>informacoes de contato</strong>.</p>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div class="flex items-center justify-between py-3 border-b border-gray-100">
                            <span class="text-gray-600 text-sm">Identidade da escola</span>
                            <button type="button" onclick="showStep(1)" class="text-blue-500 text-sm font-medium hover:underline">Editar</button>
                        </div>
                        <div class="flex items-center justify-between py-3 border-b border-gray-100">
                            <span class="text-gray-600 text-sm">Contato e localizacao</span>
                            <button type="button" onclick="showStep(2)" class="text-blue-500 text-sm font-medium hover:underline">Editar</button>
                        </div>
                        <div class="flex items-center justify-between py-3 border-b border-gray-100">
                            <span class="text-gray-600 text-sm">Numeros e visual</span>
                            <button type="button" onclick="showStep(3)" class="text-blue-500 text-sm font-medium hover:underline">Editar</button>
                        </div>
                        <div class="flex items-center justify-between py-3 border-b border-gray-100">
                            <span class="text-gray-600 text-sm">Cursos</span>
                            <button type="button" onclick="showStep(4)" class="text-blue-500 text-sm font-medium hover:underline">Editar</button>
                        </div>
                        <div class="flex items-center justify-between py-3 border-b border-gray-100">
                            <span class="text-gray-600 text-sm">Equipe</span>
                            <button type="button" onclick="showStep(5)" class="text-blue-500 text-sm font-medium hover:underline">Editar</button>
                        </div>
                        <div class="flex items-center justify-between py-3">
                            <span class="text-gray-600 text-sm">Depoimentos e eventos</span>
                            <button type="button" onclick="showStep(6)" class="text-blue-500 text-sm font-medium hover:underline">Editar</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ==================== NAVIGATION BUTTONS ==================== -->
            <div class="flex items-center justify-between mt-6 pb-8">
                <button type="button" id="btn-prev" onclick="prevStep()" class="invisible px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center">
                    <i class="fas fa-arrow-left mr-2"></i>Anterior
                </button>

                <button type="button" id="btn-next" onclick="nextStep()" class="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all flex items-center">
                    Proximo<i class="fas fa-arrow-right ml-2"></i>
                </button>

                <button type="submit" id="btn-submit" class="hidden px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-green-500/30 transform hover:-translate-y-0.5 transition-all flex items-center">
                    <i class="fas fa-rocket mr-2"></i>Finalizar e Personalizar o Site
                </button>
            </div>
        </form>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.7.2/dist/axios.min.js"></script>
    <script src="/static/utils/dom.js"></script>
    <script src="/static/formulario.js"></script>
</body>
</html>`;
}

// src/views/home.ts
function esc(valor) {
  return String(valor ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escUrl(valor) {
  const bruto = String(valor ?? "").trim();
  if (!bruto) return "";
  if (bruto.startsWith("/") || bruto.startsWith("#")) return esc(bruto);
  try {
    const url = new URL(bruto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return esc(bruto);
  } catch {
    return "";
  }
}
function paragrafos(texto2, classe = "text-gray-600 leading-relaxed mb-4") {
  const conteudo = String(texto2 ?? "").trim();
  if (!conteudo) return "";
  return conteudo.split(/\n{2,}/).map((bloco) => `<p class="${classe}">${esc(bloco).replace(/\n/g, "<br>")}</p>`).join("");
}
function texto(registro, campo) {
  return String(registro?.[campo] ?? "").trim();
}
function dataBr(valor) {
  const bruto = String(valor ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return "";
  const [ano, mes, dia] = bruto.split("-");
  return `${dia}/${mes}/${ano}`;
}
function itens(valor, limite = 6) {
  return String(valor ?? "").split(/\n|;/).map((parte) => parte.trim()).filter(Boolean).slice(0, limite);
}
var PALETAS = {
  azul: { pilula: "bg-primary-50", icone: "text-primary-500", rotulo: "text-primary-600", realce: "from-school-sky to-primary-600" },
  ambar: { pilula: "bg-warm-50", icone: "text-warm-500", rotulo: "text-warm-600", realce: "from-school-gold to-warm-500" },
  esmeralda: { pilula: "bg-green-50", icone: "text-emerald-500", rotulo: "text-emerald-600", realce: "from-school-emerald to-emerald-600" },
  rosa: { pilula: "bg-rose-50", icone: "text-rose-500", rotulo: "text-rose-600", realce: "from-school-coral to-rose-500" },
  claro: { pilula: "bg-white/10", icone: "text-school-gold", rotulo: "text-white/80", realce: "from-school-gold to-warm-400" }
};
function cabecalhoSecao(opcoes) {
  const { pilula, icone, titulo, destaque = "", descricao = "", claro = false } = opcoes;
  const p = PALETAS[opcoes.paleta ?? (claro ? "claro" : "azul")];
  return `
            <div class="text-center mb-16">
                <div class="inline-flex items-center px-4 py-2 ${p.pilula} ${claro ? "border border-white/15" : ""} rounded-full mb-4" data-aos="fade-up">
                    <i class="fas ${icone} ${p.icone} mr-2 text-sm"></i>
                    <span class="${p.rotulo} text-sm font-semibold">${esc(pilula)}</span>
                </div>
                <h2 class="text-4xl lg:text-5xl font-bold ${claro ? "text-white" : "text-school-navy"} mb-6" data-aos="fade-up" data-aos-delay="100">
                    ${esc(titulo)}${destaque ? ` <span class="bg-gradient-to-r ${p.realce} bg-clip-text text-transparent">${esc(destaque)}</span>` : ""}
                </h2>
                ${descricao ? `<p class="${claro ? "text-white/50" : "text-gray-500"} max-w-2xl mx-auto text-lg leading-relaxed" data-aos="fade-up" data-aos-delay="200">${esc(descricao)}</p>` : ""}
            </div>`;
}
var FUNDOS = {
  branco: "bg-white",
  cinza: "bg-gray-50",
  escuro: "bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333]"
};
function secaoCms(opcoes) {
  const { id, fundo, cabecalho, conteudo, vazio, linhaSuperior, pontilhado, ornamentos = "" } = opcoes;
  const escuro = fundo === "escuro";
  const corpo = conteudo || `
            <div class="min-h-[300px] flex items-center justify-center rounded-3xl border border-dashed ${escuro ? "border-white/15 bg-white/[0.03]" : "border-gray-200 bg-white/60"}" data-aos="fade-up">
                <div class="text-center px-6 py-12 max-w-md">
                    <div class="w-16 h-16 mx-auto mb-5 rounded-2xl ${escuro ? "bg-white/5 border border-white/10 text-white/30" : "bg-white border border-gray-200 text-gray-300"} flex items-center justify-center shadow-sm">
                        <i class="fas ${cabecalho.icone} text-2xl"></i>
                    </div>
                    <p class="${escuro ? "text-white/40" : "text-gray-400"} text-sm leading-relaxed">${esc(vazio || "Conte\xFAdo em prepara\xE7\xE3o.")}</p>
                </div>
            </div>`;
  return `
    <section id="${esc(id)}" class="py-24 ${FUNDOS[fundo]} relative overflow-hidden">
        ${linhaSuperior ? `<div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-school-gold/30 to-transparent"></div>` : ""}
        ${pontilhado ? `<div class="absolute inset-0 opacity-5 pointer-events-none" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 40px 40px;"></div>` : ""}
        ${ornamentos}

        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            ${cabecalhoSecao({ ...cabecalho, claro: escuro })}
            ${corpo}
        </div>
    </section>`;
}
function whatsappFlutuante(contatos) {
  const telefones = Array.isArray(contatos?.telefones) ? contatos.telefones : [];
  const primeiro = telefones.map((t) => String(t).replace(/\D/g, "")).find((t) => t.length >= 10);
  if (!primeiro) return "";
  const numero = primeiro.startsWith("55") ? primeiro : `55${primeiro}`;
  return `
    <a href="https://wa.me/${esc(numero)}" target="_blank" rel="noopener noreferrer"
       aria-label="Falar com a escola pelo WhatsApp"
       class="fixed bottom-24 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform duration-300">
        <i class="fab fa-whatsapp text-white text-2xl"></i>
    </a>`;
}
function camadasDecorativas() {
  return `
        <div class="absolute inset-0 bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333]"></div>

        <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="particle particle-1"></div>
            <div class="particle particle-2"></div>
            <div class="particle particle-3"></div>
            <div class="particle particle-4"></div>
            <div class="particle particle-5"></div>
            <div class="particle particle-6"></div>
        </div>

        <div class="absolute top-20 right-10 w-72 h-72 bg-school-gold/5 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
        <div class="absolute bottom-20 left-10 w-96 h-96 bg-school-sky/5 rounded-full blur-3xl animate-pulse pointer-events-none" style="animation-delay: 2s"></div>
        <div class="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 bg-accent-500/5 rounded-full blur-3xl animate-pulse pointer-events-none" style="animation-delay: 4s"></div>

        <div class="absolute inset-0 opacity-[0.04] pointer-events-none" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 50px 50px;"></div>`;
}
var ACENTOS = [
  { icone: "fa-compass", texto: "text-school-gold", hover: "hover:bg-school-gold" },
  { icone: "fa-lightbulb", texto: "text-school-sky", hover: "hover:bg-school-sky" },
  { icone: "fa-hands-holding-circle", texto: "text-school-emerald", hover: "hover:bg-school-emerald" },
  { icone: "fa-heart", texto: "text-school-coral", hover: "hover:bg-school-coral" }
];
function visualHero(conteudo, navegacao, institucional) {
  const ladrilho = (icone, acento, principal, apoio, href) => {
    const conteudoLadrilho = `
                            <i class="fas ${icone} text-4xl ${acento.texto} mb-3 group-hover:text-white transition-colors"></i>
                            <p class="text-white font-semibold text-sm leading-snug">${esc(principal)}</p>
                            ${apoio ? `<p class="text-white/55 text-[11px] mt-1 leading-snug">${esc(apoio)}</p>` : ""}`;
    const classe = `p-6 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-center border border-white/5 h-40 transition-all duration-300 ${acento.hover} hover:-translate-y-1 group`;
    return href ? `<a href="${href}" class="${classe}">${conteudoLadrilho}</a>` : `<div class="${classe}">${conteudoLadrilho}</div>`;
  };
  const valores = itens(conteudo.sobre?.valores, 4);
  let ladrilhos = valores.map((valor, i) => ladrilho(ACENTOS[i % ACENTOS.length].icone, ACENTOS[i % ACENTOS.length], valor, "")).join("");
  if (!ladrilhos) {
    ladrilhos = [
      ["fa-graduation-cap", conteudo.cursos.length, "Cursos e modalidades"],
      ["fa-lightbulb", conteudo.projetos.length, "Projetos escolares"],
      ["fa-newspaper", conteudo.noticias.length, "Not\xEDcias e avisos"],
      ["fa-images", conteudo.galeria.length, "\xC1lbuns de fotos"]
    ].filter(([, total]) => total > 0).map(([icone, total, rotulo], i) => ladrilho(icone, ACENTOS[i % ACENTOS.length], String(total), rotulo)).join("");
  }
  if (!ladrilhos) {
    const ICONES_SECAO = {
      sobre: "fa-school",
      cursos: "fa-graduation-cap",
      projetos: "fa-lightbulb",
      noticias: "fa-newspaper",
      galeria: "fa-images",
      equipe: "fa-users",
      documentos: "fa-folder-open",
      contato: "fa-headset"
    };
    ladrilhos = navegacao.filter((s) => s.id !== "inicio").slice(0, 4).map((s, i) => ladrilho(
      ICONES_SECAO[s.id] || "fa-circle-dot",
      ACENTOS[i % ACENTOS.length],
      s.rotulo,
      "",
      `#${s.id}`
    )).join("");
  }
  const descricao = String(institucional?.descricao_escola ?? "").trim();
  const slogan = String(institucional?.slogan ?? "").trim();
  const corpo = ladrilhos ? `<div class="grid grid-cols-2 gap-4">${ladrilhos}</div>` : slogan || descricao ? `<div class="space-y-4">
                            ${slogan ? `<p class="text-white text-lg font-semibold leading-snug">${esc(slogan)}</p>` : ""}
                            ${descricao ? `<p class="text-white/60 text-sm leading-relaxed">${esc(descricao)}</p>` : ""}
                        </div>` : "";
  if (!corpo) return "";
  return `
                <div class="hidden lg:block relative">
                    <div class="absolute -top-10 -right-10 w-64 h-64 __HALO__ rounded-full blur-3xl animate-pulse pointer-events-none"></div>
                    <div class="absolute -bottom-10 -left-10 w-56 h-56 bg-school-sky/15 rounded-full blur-3xl animate-pulse pointer-events-none" style="animation-delay: 1.5s"></div>

                    <div class="hero-card bg-gradient-to-br __CARTAO__ backdrop-blur-xl rounded-3xl p-8 border shadow-2xl relative">
                        ${corpo}
                    </div>
                </div>`;
}
var PALETAS_SLIDE = {
  dourado: {
    etiqueta: "bg-white/10 border-white/20",
    ponto: "bg-school-gold",
    gradiente: "from-school-gold via-warm-400 to-school-coral",
    botao: "from-school-gold to-warm-500 hover:shadow-school-gold/30",
    halo: "bg-school-gold/20",
    cartao: "from-white/10 to-white/5 border-white/10"
  },
  azul: {
    etiqueta: "bg-blue-500/20 border-blue-400/30",
    ponto: "bg-blue-400",
    gradiente: "from-blue-400 via-indigo-400 to-purple-400",
    botao: "from-blue-600 to-indigo-600 hover:shadow-blue-600/30",
    halo: "bg-blue-500/20",
    cartao: "from-blue-900/40 to-indigo-900/40 border-blue-500/20"
  },
  roxo: {
    etiqueta: "bg-purple-500/20 border-purple-400/30",
    ponto: "bg-purple-400",
    gradiente: "from-purple-400 via-fuchsia-400 to-pink-400",
    botao: "from-purple-600 to-pink-600 hover:shadow-purple-600/30",
    halo: "bg-purple-500/20",
    cartao: "from-purple-900/40 to-pink-900/40 border-purple-500/20"
  },
  verde: {
    etiqueta: "bg-emerald-500/20 border-emerald-400/30",
    ponto: "bg-emerald-400",
    gradiente: "from-emerald-400 via-teal-400 to-cyan-400",
    botao: "from-emerald-600 to-teal-600 hover:shadow-emerald-600/30",
    halo: "bg-emerald-500/20",
    cartao: "from-emerald-900/40 to-teal-900/40 border-emerald-500/20"
  },
  coral: {
    etiqueta: "bg-rose-500/20 border-rose-400/30",
    ponto: "bg-rose-400",
    gradiente: "from-school-coral via-rose-400 to-orange-400",
    botao: "from-school-coral to-rose-600 hover:shadow-rose-600/30",
    halo: "bg-school-coral/20",
    cartao: "from-rose-900/40 to-orange-900/40 border-rose-500/20"
  }
};
function paletaSlide(valor) {
  const nome = String(valor ?? "");
  return nome in PALETAS_SLIDE ? nome : "dourado";
}
function slideHero(opcoes) {
  const {
    indice,
    etiqueta,
    etiquetaComLogo = false,
    titulo,
    destaque = "",
    subtitulo = "",
    descricao = "",
    ctaTexto = "",
    ctaLink = "",
    coluna
  } = opcoes;
  const p = PALETAS_SLIDE[opcoes.paleta];
  const ativo = indice === 0;
  const duasColunas = Boolean(coluna);
  const colunaVisual = coluna ? coluna.replace("__HALO__", p.halo).replace("__CARTAO__", p.cartao) : "";
  const temCta = Boolean(ctaTexto && ctaLink);
  const botaoBase = "px-7 py-3.5 rounded-2xl font-bold text-base lg:text-lg transition-all duration-300 inline-flex items-center justify-center text-center";
  const botaoSecundario = botaoBase + " bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm";
  const botaoPrincipal = botaoBase + " bg-gradient-to-r " + p.botao + " text-white hover:shadow-lg transform hover:-translate-y-1";
  const escalaTitulo = "text-[clamp(2.25rem,4.4vw,4rem)] leading-[1.12]";
  const escalaSubtitulo = "text-[clamp(1.25rem,2.2vw,2rem)] leading-[1.25]";
  const escalaDescricao = "text-[clamp(0.95rem,1.15vw,1.125rem)] leading-relaxed";
  return `
                <div class="hero-slide" data-slide="${indice}" aria-hidden="${ativo ? "false" : "true"}"
                     style="position:absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; display:flex; align-items:center; opacity:${ativo ? 1 : 0}; z-index:${ativo ? 10 : 0}; pointer-events:${ativo ? "auto" : "none"}; transition: opacity 1s ease-in-out, transform 1s ease-in-out;">
                    <!-- Respiro vertical como reserva de espaco: o padding superior mantem a
                         etiqueta abaixo da navbar fixa e o inferior guarda a faixa dos
                         indicadores e do "Role para baixo", antes alcancada pelo texto. -->
                    <div class="grid ${duasColunas ? "lg:grid-cols-[1.05fr_0.95fr]" : ""} gap-10 lg:gap-12 items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-40 sm:pb-44">
                        <div class="min-w-0${duasColunas ? "" : " max-w-3xl"}">
                            ${etiqueta ? `
                            <div class="inline-flex items-center max-w-full px-4 py-2 ${p.etiqueta} backdrop-blur-md border rounded-full mb-6">
                                ${etiquetaComLogo ? `<img src="/images/logo-eec-oficial.png" alt="" class="h-5 w-auto object-contain mr-3 shrink-0">` : `<span class="w-2 h-2 ${p.ponto} rounded-full mr-3 animate-pulse shrink-0"></span>`}
                                <span class="text-white text-sm font-medium tracking-wide min-w-0 break-words">${esc(etiqueta)}</span>
                            </div>` : ""}

                            <h1 class="${escalaTitulo} font-bold text-white mb-5 break-words hyphens-auto">
                                ${esc(titulo)}${destaque ? `
                                <span class="block mt-1.5 bg-gradient-to-r ${p.gradiente} bg-clip-text text-transparent">${esc(destaque)}</span>` : ""}${subtitulo ? `
                                <span class="block ${escalaSubtitulo} mt-3 font-light text-white/70">${esc(subtitulo)}</span>` : ""}
                            </h1>

                            ${descricao ? `<p class="${escalaDescricao} text-white/60 mb-8 max-w-xl break-words">${esc(descricao)}</p>` : ""}

                            <div class="flex flex-wrap gap-3 sm:gap-4">
                                ${temCta ? `
                                <a href="${ctaLink}" class="${botaoPrincipal}">
                                    ${esc(ctaTexto)}<i class="fas fa-arrow-right ml-2 text-sm"></i>
                                </a>` : ""}
                                <a href="#contato" class="${temCta ? botaoSecundario : botaoPrincipal}">
                                    <i class="fas fa-envelope mr-2.5 text-sm"></i>Fale com a Escola
                                </a>
                            </div>
                        </div>

                        ${colunaVisual}
                    </div>
                </div>`;
}
function renderHero(conteudo, navegacao, institucional) {
  const inicio = conteudo.inicio;
  const titulo = texto(inicio, "hero_titulo") || "Escola Estadual do Cariri";
  const banner = escUrl(inicio?.banner_imagem_url);
  const coluna = visualHero(conteudo, navegacao, institucional);
  const palavras = titulo.split(/\s+/);
  const ultima = palavras.length > 2 ? palavras.pop() : "";
  const publicados = conteudo.heroDestaques.filter((d) => String(d.titulo ?? "").trim());
  const slides = publicados.length ? publicados.map((d, i) => slideHero({
    indice: i,
    paleta: paletaSlide(d.paleta),
    etiqueta: texto(d, "etiqueta"),
    // A marca institucional acompanha o primeiro slide, como no gabarito.
    etiquetaComLogo: i === 0,
    titulo: String(d.titulo).trim(),
    destaque: texto(d, "titulo_destaque"),
    subtitulo: texto(d, "subtitulo"),
    descricao: texto(d, "descricao"),
    ctaTexto: texto(d, "cta_texto"),
    ctaLink: escUrl(d.cta_link),
    coluna
  })) : [
    slideHero({
      indice: 0,
      paleta: "dourado",
      etiqueta: "Rede Estadual de Minas Gerais",
      etiquetaComLogo: true,
      titulo: palavras.join(" "),
      destaque: ultima,
      subtitulo: texto(inicio, "hero_subtitulo"),
      descricao: texto(inicio, "hero_chamada"),
      ctaTexto: texto(inicio, "cta_texto"),
      ctaLink: escUrl(inicio?.cta_link),
      coluna
    })
  ];
  const indicadores = slides.length > 1 ? `
        <div class="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5" role="tablist" aria-label="Destaques da p\xE1gina inicial">
            ${slides.map((_, i) => `
            <button type="button" class="hero-dot h-2 rounded-full transition-all duration-300 cursor-pointer ${i === 0 ? "w-8 bg-school-gold" : "w-2 bg-white/30 hover:bg-white/60"}"
                    data-slide-alvo="${i}" role="tab" aria-selected="${i === 0 ? "true" : "false"}" aria-label="Destaque ${i + 1}"></button>`).join("")}
        </div>` : "";
  return `
    <section id="inicio" class="relative min-h-screen flex items-center overflow-hidden">
        ${camadasDecorativas()}
        ${banner ? `<div class="absolute inset-0 pointer-events-none"><img src="${banner}" alt="" class="w-full h-full object-cover opacity-25"></div>` : ""}

        <div class="relative z-10 w-full h-full min-h-screen flex items-center">
            <div id="hero-slider" class="relative w-full" style="min-height: calc(100vh - 80px)">
                ${slides.join("")}
            </div>
        </div>

        ${indicadores}

        <a href="#sobre" aria-label="Rolar para a pr\xF3xima se\xE7\xE3o"
           class="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center gap-2 text-white/40 hover:text-white/80 transition-colors">
            <span class="text-[10px] uppercase tracking-[3px]">Role para baixo</span>
            <span class="w-6 h-10 rounded-full border-2 border-current flex items-start justify-center p-1.5">
                <span class="w-1 h-2 rounded-full bg-current animate-bounce"></span>
            </span>
        </a>
    </section>`;
}
function renderSobre(sobre) {
  const titulo = texto(sobre, "titulo") || "Sobre a Escola";
  const imagem = escUrl(sobre?.imagem_url);
  const apresentacao = texto(sobre, "apresentacao");
  const CARTOES = [
    { rotulo: "Miss\xE3o", campo: "missao", icone: "fa-bullseye", classe: "from-primary-500 to-primary-700 shadow-primary-500/20" },
    { rotulo: "Vis\xE3o", campo: "visao", icone: "fa-eye", classe: "from-school-emerald to-emerald-700 shadow-emerald-500/20" },
    { rotulo: "Valores", campo: "valores", icone: "fa-heart", classe: "from-school-gold to-warm-600 shadow-warm-500/20" },
    { rotulo: "Proposta Pedag\xF3gica", campo: "proposta_pedagogica", icone: "fa-compass", classe: "from-school-coral to-rose-700 shadow-rose-500/20" }
  ];
  const cartoesVisiveis = CARTOES.map((c) => ({ ...c, conteudo: texto(sobre, c.campo) })).filter((c) => c.conteudo);
  const destaques = [
    ["fa-landmark", "Nossa Hist\xF3ria", texto(sobre, "historia")],
    ["fa-building-columns", "Estrutura", texto(sobre, "estrutura")]
  ];
  const destaquesVisiveis = destaques.filter(([, , conteudo]) => conteudo);
  const coluna = (indices, deslocado) => `
                        <div class="space-y-4${deslocado ? " mt-8" : ""}">
                            ${indices.filter((i) => cartoesVisiveis[i]).map((i) => {
    const c = cartoesVisiveis[i];
    return `
                            <div class="bg-gradient-to-br ${c.classe} rounded-3xl p-7 text-white shadow-xl transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas ${c.icone} text-3xl mb-4 opacity-90"></i>
                                <h4 class="font-bold text-lg mb-2">${esc(c.rotulo)}</h4>
                                <p class="text-white/85 text-sm leading-relaxed">${esc(c.conteudo)}</p>
                            </div>`;
  }).join("")}
                        </div>`;
  const grelhaCartoes = cartoesVisiveis.length ? `
                <div class="relative" data-aos="fade-right">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        ${coluna([0, 2], false)}
                        ${coluna([1, 3], true)}
                    </div>
                </div>` : "";
  const colunaTexto = `
                <div data-aos="fade-left">
                    ${apresentacao ? paragrafos(apresentacao, "text-gray-600 mb-6 leading-relaxed text-lg") : ""}

                    ${destaquesVisiveis.length ? `
                    <div class="space-y-5 mt-8">
                        ${destaquesVisiveis.map(([icone, rotulo, conteudo]) => `
                        <div class="flex items-start gap-4 group">
                            <div class="w-11 h-11 bg-school-gold/10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-gold transition-all duration-300">
                                <i class="fas ${icone} text-school-gold group-hover:text-white transition-colors"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy mb-1">${esc(rotulo)}</h5>
                                <p class="text-gray-500 text-sm leading-relaxed">${esc(conteudo)}</p>
                            </div>
                        </div>`).join("")}
                    </div>` : ""}

                    ${imagem ? `
                    <img src="${imagem}" alt="${esc(titulo)}" class="w-full rounded-3xl shadow-xl object-cover mt-8">` : ""}
                </div>`;
  const duasColunas = Boolean(grelhaCartoes);
  const temAlgo = Boolean(sobre && (grelhaCartoes || apresentacao || destaquesVisiveis.length || imagem));
  return secaoCms({
    id: "sobre",
    fundo: "branco",
    ornamentos: `
        <div class="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-50 to-transparent pointer-events-none"></div>
        <div class="absolute bottom-0 left-0 w-64 h-64 bg-school-gold/5 rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>`,
    cabecalho: {
      pilula: "Institucional",
      icone: "fa-school",
      paleta: "azul",
      titulo: "Sobre a",
      destaque: "Escola",
      descricao: "Identidade, prop\xF3sito e proposta pedag\xF3gica da institui\xE7\xE3o."
    },
    conteudo: temAlgo ? `
            <div class="grid ${duasColunas ? "lg:grid-cols-2" : ""} gap-16 items-center">
                ${grelhaCartoes}
                ${colunaTexto}
            </div>` : "",
    vazio: "As informa\xE7\xF5es institucionais ser\xE3o publicadas pela administra\xE7\xE3o da escola."
  });
}
function renderFaixaInstitucional(indicadores = []) {
  const corpo = indicadores.length ? `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
                    ${indicadores.map((ind, i) => `
                    <div class="text-center" data-aos="fade-up" data-aos-delay="${i % 4 * 100}">
                        <div class="text-4xl lg:text-5xl font-bold ${ind.cor} mb-2">${esc(ind.valor)}</div>
                        <div class="text-white/60 text-sm uppercase tracking-wider">${esc(ind.rotulo)}</div>
                    </div>`).join("")}
                </div>` : `
                <div class="text-center">
                    <p class="text-white/40 text-sm uppercase tracking-wider">
                        <i class="fas fa-chart-simple text-school-gold/60 mr-2"></i>
                        Indicadores institucionais em prepara\xE7\xE3o
                    </p>
                </div>`;
  return `
    <section class="py-16 bg-gradient-to-r from-school-navy via-[#162464] to-school-navy relative overflow-hidden">
        <div class="absolute inset-0 opacity-5 pointer-events-none" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 40px 40px;"></div>
        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            ${corpo}
        </div>
    </section>`;
}
function renderCursos(cursos) {
  const cartoes = !cursos.length ? "" : `
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                ${cursos.map((curso, i) => {
    const imagem = escUrl(curso.imagem_url);
    const modalidade = texto(curso, "modalidade");
    const turno = texto(curso, "turno");
    const infos = texto(curso, "informacoes_adicionais");
    return `
                <article class="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 flex flex-col transform hover:-translate-y-2" data-aos="fade-up" data-aos-delay="${i % 3 * 100}">
                    ${imagem ? `<img src="${imagem}" alt="${esc(curso.nome)}" class="w-full h-44 object-cover">` : `<div class="h-44 bg-gradient-to-br from-school-navy to-[#162464] flex items-center justify-center">
                               <img src="/images/logo-eec-oficial.png" alt="" class="h-16 w-auto object-contain opacity-80">
                           </div>`}
                    <div class="p-7 flex-1 flex flex-col">
                        <div class="flex flex-wrap gap-2 mb-3">
                            ${modalidade ? `<span class="px-3 py-1 bg-school-navy/10 text-school-navy rounded-full text-xs font-semibold">${esc(modalidade)}</span>` : ""}
                            ${turno ? `<span class="px-3 py-1 bg-school-gold/15 text-warm-700 rounded-full text-xs font-semibold">${esc(turno)}</span>` : ""}
                        </div>
                        <h3 class="text-lg font-bold text-school-navy mb-3">${esc(curso.nome)}</h3>
                        ${paragrafos(curso.descricao, "text-gray-600 text-sm leading-relaxed mb-3")}
                        ${infos ? `<p class="text-gray-500 text-xs leading-relaxed mt-auto pt-3 border-t border-gray-100">${esc(infos)}</p>` : ""}
                    </div>
                </article>`;
  }).join("")}
            </div>`;
  return secaoCms({
    id: "cursos",
    fundo: "cinza",
    linhaSuperior: true,
    cabecalho: {
      pilula: "Nossos Cursos",
      icone: "fa-book-open",
      paleta: "ambar",
      titulo: "Cursos e",
      destaque: "Modalidades",
      descricao: "As modalidades de ensino ofertadas pela escola."
    },
    conteudo: cartoes,
    vazio: "Os cursos e modalidades ser\xE3o publicados pela administra\xE7\xE3o da escola."
  });
}
function renderProjetos(projetos) {
  const cartoes = !projetos.length ? "" : `
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                ${projetos.map((projeto, i) => {
    const capa = escUrl(projeto.capa_url);
    const responsaveis = texto(projeto, "responsaveis");
    const periodo = texto(projeto, "periodo");
    return `
                <article class="bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col transform hover:-translate-y-2" data-aos="fade-up" data-aos-delay="${i % 3 * 100}">
                    ${capa ? `<img src="${capa}" alt="${esc(projeto.titulo)}" class="w-full h-44 object-cover">` : ""}
                    <div class="p-7 flex-1 flex flex-col">
                        ${projeto.destaque ? `<span class="self-start px-3 py-1 bg-school-gold text-white rounded-full text-[10px] font-bold uppercase tracking-wider mb-3">Destaque</span>` : ""}
                        <h3 class="text-lg font-bold text-school-navy mb-3">${esc(projeto.titulo)}</h3>
                        ${paragrafos(projeto.resumo, "text-gray-600 text-sm leading-relaxed mb-3")}
                        ${paragrafos(projeto.conteudo, "text-gray-500 text-sm leading-relaxed mb-3")}
                        ${responsaveis || periodo ? `
                        <div class="mt-auto pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-1">
                            ${responsaveis ? `<p><i class="fas fa-users mr-2 text-school-navy/40"></i>${esc(responsaveis)}</p>` : ""}
                            ${periodo ? `<p><i class="fas fa-calendar mr-2 text-school-navy/40"></i>${esc(periodo)}</p>` : ""}
                        </div>` : ""}
                    </div>
                </article>`;
  }).join("")}
            </div>`;
  return secaoCms({
    id: "projetos",
    fundo: "branco",
    cabecalho: {
      pilula: "Pedag\xF3gico",
      icone: "fa-lightbulb",
      paleta: "esmeralda",
      titulo: "Projetos",
      destaque: "Escolares",
      descricao: "Iniciativas desenvolvidas pela comunidade escolar."
    },
    conteudo: cartoes,
    vazio: "Os projetos escolares ser\xE3o publicados pela administra\xE7\xE3o da escola."
  });
}
function renderNoticias(noticias) {
  const cartoes = !noticias.length ? "" : `
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                ${noticias.map((noticia, i) => {
    const capa = escUrl(noticia.capa_url);
    const data = dataBr(noticia.data_publicacao);
    const categoria = texto(noticia, "categoria");
    const autor = texto(noticia, "autor");
    return `
                <article class="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 flex flex-col transform hover:-translate-y-2" data-aos="fade-up" data-aos-delay="${i % 3 * 100}">
                    ${capa ? `<img src="${capa}" alt="${esc(noticia.titulo)}" class="w-full h-44 object-cover">` : ""}
                    <div class="p-7 flex-1 flex flex-col">
                        <div class="flex flex-wrap items-center gap-3 mb-3 text-xs">
                            ${categoria ? `<span class="px-3 py-1 bg-school-sky/15 text-school-navy rounded-full font-semibold">${esc(categoria)}</span>` : ""}
                            ${data ? `<span class="text-gray-400"><i class="far fa-calendar mr-1"></i>${esc(data)}</span>` : ""}
                        </div>
                        <h3 class="text-lg font-bold text-school-navy mb-3">${esc(noticia.titulo)}</h3>
                        ${paragrafos(noticia.resumo, "text-gray-600 text-sm leading-relaxed mb-3")}
                        ${paragrafos(noticia.conteudo, "text-gray-500 text-sm leading-relaxed mb-3")}
                        ${autor ? `<p class="mt-auto pt-4 border-t border-gray-100 text-xs text-gray-500"><i class="fas fa-pen-nib mr-2 text-school-navy/40"></i>${esc(autor)}</p>` : ""}
                    </div>
                </article>`;
  }).join("")}
            </div>`;
  return secaoCms({
    id: "noticias",
    fundo: "escuro",
    pontilhado: true,
    cabecalho: {
      pilula: "Comunica\xE7\xE3o",
      icone: "fa-bullhorn",
      titulo: "Not\xEDcias e",
      destaque: "Avisos",
      descricao: "Acompanhe o que acontece na escola."
    },
    conteudo: cartoes,
    vazio: "As not\xEDcias e avisos ser\xE3o publicados pela administra\xE7\xE3o da escola."
  });
}
function renderGaleria(albuns) {
  const conteudo = !albuns.length ? "" : `

            <div class="space-y-14">
                ${albuns.map((album) => {
    const fotos = Array.isArray(album.fotos) ? album.fotos : [];
    const data = dataBr(album.data_album);
    return `
                <div data-aos="fade-up">
                    <div class="flex flex-wrap items-baseline gap-3 mb-5">
                        <h3 class="text-xl font-bold text-school-navy">${esc(album.titulo)}</h3>
                        ${data ? `<span class="text-xs text-gray-400"><i class="far fa-calendar mr-1"></i>${esc(data)}</span>` : ""}
                    </div>
                    ${paragrafos(album.descricao, "text-gray-600 text-sm leading-relaxed mb-5")}
                    ${fotos.length ? `
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        ${fotos.map((foto) => {
      const src = escUrl(foto.imagem_url);
      if (!src) return "";
      return `
                        <figure class="group relative overflow-hidden rounded-2xl bg-gray-100 aspect-[4/3]">
                            <img src="${src}" alt="${esc(foto.legenda)}" loading="lazy"
                                 class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                            ${foto.legenda ? `
                            <figcaption class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-3">
                                ${esc(foto.legenda)}
                            </figcaption>` : ""}
                        </figure>`;
    }).join("")}
                    </div>` : ""}
                </div>`;
  }).join("")}
            </div>`;
  return secaoCms({
    id: "galeria",
    fundo: "branco",
    cabecalho: {
      pilula: "Nossa Escola",
      icone: "fa-images",
      paleta: "azul",
      titulo: "Galeria de",
      destaque: "Fotos",
      descricao: "Registros da rotina e dos momentos da comunidade escolar."
    },
    conteudo,
    vazio: "Os \xE1lbuns de fotos ser\xE3o publicados pela administra\xE7\xE3o da escola."
  });
}
function renderEquipe(equipe) {
  const grupos = /* @__PURE__ */ new Map();
  for (const membro of equipe) {
    const grupo = texto(membro, "grupo") || "";
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push(membro);
  }
  const cartao = (membro, i) => {
    const foto = escUrl(membro.foto_url);
    const funcao = texto(membro, "funcao_publica");
    const inicial = String(membro.nome ?? "?").trim().charAt(0).toUpperCase();
    return `
        <div class="bg-white rounded-3xl p-7 text-center border border-gray-100 hover:shadow-xl transition-all duration-300" data-aos="fade-up" data-aos-delay="${i % 4 * 80}">
            ${foto ? `<img src="${foto}" alt="${esc(membro.nome)}" class="w-24 h-24 rounded-full object-cover mx-auto mb-5 shadow-md">` : `<div class="w-24 h-24 rounded-full bg-school-navy/10 text-school-navy flex items-center justify-center mx-auto mb-5 text-2xl font-bold">${esc(inicial)}</div>`}
            <h3 class="text-base font-bold text-school-navy">${esc(membro.nome)}</h3>
            ${funcao ? `<p class="text-school-gold text-sm font-semibold mt-1">${esc(funcao)}</p>` : ""}
            ${paragrafos(membro.descricao, "text-gray-500 text-xs leading-relaxed mt-3")}
        </div>`;
  };
  const conteudo = !equipe.length ? "" : `
            ${[...grupos.entries()].map(([grupo, membros]) => `
            <div class="mb-14 last:mb-0">
                ${grupo ? `<h3 class="text-lg font-bold text-school-navy mb-6 flex items-center gap-3"><span class="w-8 h-0.5 bg-school-gold"></span>${esc(grupo)}</h3>` : ""}
                <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    ${membros.map(cartao).join("")}
                </div>
            </div>`).join("")}`;
  return secaoCms({
    id: "equipe",
    fundo: "cinza",
    cabecalho: {
      pilula: "Quem faz a escola",
      icone: "fa-chalkboard-user",
      paleta: "esmeralda",
      titulo: "Nossa",
      destaque: "Equipe",
      descricao: "Servidoras e servidores que atuam na escola."
    },
    conteudo,
    vazio: "A equipe escolar ser\xE1 publicada pela administra\xE7\xE3o da escola."
  });
}
function renderDestaques(secoes) {
  const cartoes = !secoes.length ? "" : `
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
                ${secoes.slice(0, 8).map((secao, i) => {
    const imagem = escUrl(secao.imagem_url);
    const subtitulo = texto(secao, "subtitulo");
    return `
                <article class="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 flex flex-col" data-aos="fade-up" data-aos-delay="${i % 4 * 100}">
                    ${imagem ? `<img src="${imagem}" alt="${esc(secao.titulo)}" class="w-full h-32 object-cover rounded-2xl mb-5">` : `<div class="w-12 h-12 rounded-2xl bg-school-coral/10 text-school-coral flex items-center justify-center mb-5">
                               <i class="fas fa-star text-lg"></i>
                           </div>`}
                    <h3 class="text-base font-bold text-school-navy mb-2">${esc(secao.titulo)}</h3>
                    ${subtitulo ? `<p class="text-school-gold text-xs font-semibold mb-2">${esc(subtitulo)}</p>` : ""}
                    ${paragrafos(secao.conteudo, "text-gray-600 text-sm leading-relaxed")}
                </article>`;
  }).join("")}
            </div>`;
  return secaoCms({
    id: "destaques",
    fundo: "branco",
    cabecalho: {
      pilula: "Nossa escola",
      icone: "fa-star",
      paleta: "rosa",
      titulo: "Se\xE7\xF5es em",
      destaque: "Destaque",
      descricao: "Espa\xE7o reservado aos conte\xFAdos que a escola quiser evidenciar."
    },
    conteudo: cartoes,
    vazio: "Esta \xE1rea est\xE1 preparada para receber destaques cadastrados pela administra\xE7\xE3o da escola."
  });
}
function renderSecoesExtras(secoes) {
  if (!secoes.length) return "";
  return secoes.map((secao, i) => {
    const imagem = escUrl(secao.imagem_url);
    const subtitulo = texto(secao, "subtitulo");
    return `
    <section class="py-20 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-10" data-aos="fade-up">
                <h2 class="text-3xl lg:text-4xl font-bold text-school-navy">${esc(secao.titulo)}</h2>
                ${subtitulo ? `<p class="text-school-gold font-semibold mt-2">${esc(subtitulo)}</p>` : ""}
            </div>
            ${imagem ? `<img src="${imagem}" alt="${esc(secao.titulo)}" class="w-full rounded-3xl shadow-lg mb-8 object-cover" data-aos="fade-up">` : ""}
            <div data-aos="fade-up">${paragrafos(secao.conteudo)}</div>
        </div>
    </section>`;
  }).join("");
}
function renderDocumentosELinks(documentos, links) {
  const conteudo = !documentos.length && !links.length ? "" : `

            <div class="grid ${documentos.length && links.length ? "lg:grid-cols-2" : ""} gap-12">
                ${documentos.length ? `
                <div data-aos="fade-up">
                    <h3 class="text-lg font-bold text-school-navy mb-6 flex items-center gap-3">
                        <i class="fas fa-file-lines text-school-gold"></i>Documentos P\xFAblicos
                    </h3>
                    <ul class="space-y-3">
                        ${documentos.map((doc) => {
    const arquivo = escUrl(doc.arquivo_url);
    const data = dataBr(doc.data_publicacao);
    const categoria = texto(doc, "categoria");
    const nomeArquivo = texto(doc, "arquivo_nome");
    const bytes = Number(doc.arquivo_tamanho ?? 0);
    const tamanho = bytes > 0 ? bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "";
    const meta = [categoria, data, nomeArquivo, tamanho].filter(Boolean);
    const corpo = `
                                <div class="flex-1 min-w-0">
                                    <p class="font-semibold text-school-navy text-sm">${esc(doc.titulo)}</p>
                                    ${doc.descricao ? `<p class="text-gray-500 text-xs mt-1">${esc(doc.descricao)}</p>` : ""}
                                    ${meta.length ? `<p class="text-gray-400 text-[11px] mt-1 break-words">${meta.map((m) => esc(m)).join(" &middot; ")}</p>` : ""}
                                </div>
                                ${arquivo ? '<i class="fas fa-arrow-down text-school-gold shrink-0"></i>' : ""}`;
    return `
                        <li>
                            ${arquivo ? `<a href="${arquivo}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-colors">${corpo}</a>` : `<div class="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">${corpo}</div>`}
                        </li>`;
  }).join("")}
                    </ul>
                </div>` : ""}

                ${links.length ? `
                <div data-aos="fade-up" data-aos-delay="100">
                    <h3 class="text-lg font-bold text-school-navy mb-6 flex items-center gap-3">
                        <i class="fas fa-link text-school-gold"></i>Links \xDAteis
                    </h3>
                    <ul class="space-y-3">
                        ${links.map((link) => {
    const url = escUrl(link.url);
    if (!url) return "";
    const categoria = texto(link, "categoria");
    return `
                        <li>
                            <a href="${url}" target="_blank" rel="noopener noreferrer"
                               class="flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-colors">
                                <div class="flex-1">
                                    <p class="font-semibold text-school-navy text-sm">${esc(link.titulo)}</p>
                                    ${link.descricao ? `<p class="text-gray-500 text-xs mt-1">${esc(link.descricao)}</p>` : ""}
                                    ${categoria ? `<p class="text-gray-400 text-[11px] mt-1">${esc(categoria)}</p>` : ""}
                                </div>
                                <i class="fas fa-arrow-up-right-from-square text-school-gold text-xs"></i>
                            </a>
                        </li>`;
  }).join("")}
                    </ul>
                </div>` : ""}
            </div>`;
  return secaoCms({
    id: "documentos",
    fundo: "cinza",
    cabecalho: {
      pilula: "Transpar\xEAncia",
      icone: "fa-folder-open",
      paleta: "rosa",
      titulo: "Documentos e",
      destaque: "Links",
      descricao: "Documentos p\xFAblicos e endere\xE7os oficiais de consulta."
    },
    conteudo,
    vazio: "Os documentos p\xFAblicos e links \xFAteis ser\xE3o publicados pela administra\xE7\xE3o da escola."
  });
}
function renderContato(contatos) {
  const telefones = Array.isArray(contatos?.telefones) ? contatos.telefones : [];
  const emails = Array.isArray(contatos?.emails) ? contatos.emails : [];
  const horario = texto(contatos, "horario_atendimento");
  const endereco = texto(contatos, "endereco");
  const orientacoes = texto(contatos, "orientacoes");
  const instagram = escUrl(contatos?.instagram_url);
  const facebook = escUrl(contatos?.facebook_url);
  const youtube = escUrl(contatos?.youtube_url);
  const temRedes = Boolean(instagram || facebook || youtube);
  const infoItem = (icone, rotulo, corpo) => `
                        <div class="flex items-start gap-4">
                            <div class="w-12 h-12 shrink-0 bg-white/10 rounded-2xl flex items-center justify-center text-school-gold">
                                <i class="fas ${icone}"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-white font-semibold text-sm mb-1">${rotulo}</p>
                                <div class="text-white/60 text-sm space-y-0.5 break-words">${corpo}</div>
                            </div>
                        </div>`;
  const blocos = [
    endereco ? infoItem("fa-location-dot", "Endere\xE7o", `<p>${esc(endereco)}</p>`) : "",
    telefones.length ? infoItem(
      "fa-phone",
      "Telefones",
      telefones.map((t) => `<p><a href="tel:${esc(String(t).replace(/[^\d+]/g, ""))}" class="hover:text-school-gold transition-colors">${esc(t)}</a></p>`).join("")
    ) : "",
    emails.length ? infoItem(
      "fa-envelope",
      "E-mails",
      emails.map((e) => `<p><a href="mailto:${esc(e)}" class="hover:text-school-gold transition-colors break-all">${esc(e)}</a></p>`).join("")
    ) : "",
    horario ? infoItem("fa-clock", "Atendimento", `<p>${esc(horario)}</p>`) : ""
  ].filter(Boolean);
  const rede = (href, rotulo, icone) => href ? `
                            <a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${rotulo}"
                               class="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center text-white/70 hover:bg-school-gold hover:text-white transition-all">
                                <i class="fab ${icone}"></i>
                            </a>` : "";
  const campo = (id, rotulo, tipo, extras = "") => `
                            <div>
                                <label for="${id}" class="block text-xs font-semibold text-gray-700 mb-1.5">${rotulo}</label>
                                <input type="${tipo}" id="${id}" name="${id.replace("contato-", "")}" ${extras}
                                    class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:border-school-gold focus:ring-2 focus:ring-school-gold/20 outline-none transition-all">
                            </div>`;
  return `
    <section id="contato" class="py-24 bg-white relative overflow-hidden">
        <div class="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-50/60 to-transparent pointer-events-none"></div>
        <div class="absolute -bottom-32 -left-24 w-96 h-96 bg-school-gold/5 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            ${cabecalhoSecao({
    pilula: "Atendimento",
    icone: "fa-headset",
    paleta: "azul",
    titulo: "Fale com a",
    destaque: "Escola",
    descricao: "Canais oficiais de atendimento \xE0 comunidade escolar."
  })}

            <div class="grid lg:grid-cols-5 gap-12">

                <!-- Cart\xE3o escuro com as informa\xE7\xF5es (2/5) -->
                <div class="lg:col-span-2" data-aos="fade-right">
                    <div class="bg-gradient-to-br from-school-navy to-[#162464] rounded-3xl p-8 text-white h-full relative overflow-hidden">
                        <div class="absolute -top-16 -right-16 w-48 h-48 bg-school-gold/10 rounded-full blur-2xl pointer-events-none"></div>

                        <div class="relative">
                            <h3 class="text-2xl font-bold mb-8">Informa\xE7\xF5es de Contato</h3>

                            ${blocos.length ? `
                            <div class="space-y-7">${blocos.join("")}</div>` : `
                            <div class="p-5 bg-white/5 border border-white/15 rounded-2xl">
                                <p class="text-white/60 text-sm leading-relaxed">
                                    <i class="fas fa-circle-info text-school-gold mr-2"></i>
                                    Os canais oficiais de atendimento ser\xE3o divulgados assim que confirmados
                                    pela administra\xE7\xE3o da escola. Enquanto isso, utilize o formul\xE1rio ao lado.
                                </p>
                            </div>`}

                            ${orientacoes ? `
                            <div class="mt-8 pt-8 border-t border-white/10">
                                ${paragrafos(orientacoes, "text-white/60 text-sm leading-relaxed")}
                            </div>` : ""}

                            ${temRedes ? `
                            <div class="mt-8 pt-8 border-t border-white/10">
                                <p class="text-white font-semibold text-sm mb-4">Redes Oficiais</p>
                                <div class="flex gap-3">
                                    ${rede(instagram, "Instagram", "fa-instagram")}
                                    ${rede(facebook, "Facebook", "fa-facebook-f")}
                                    ${rede(youtube, "YouTube", "fa-youtube")}
                                </div>
                            </div>` : ""}
                        </div>
                    </div>
                </div>

                <!-- Formul\xE1rio (3/5) -->
                <div class="lg:col-span-3" data-aos="fade-left" data-aos-delay="100">
                    <form id="contact-form" class="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                        <div class="flex items-center gap-3 mb-8">
                            <span class="w-12 h-12 rounded-2xl bg-school-gold/15 text-school-gold flex items-center justify-center shrink-0">
                                <i class="fas fa-paper-plane"></i>
                            </span>
                            <div>
                                <h3 class="text-xl font-bold text-school-navy leading-tight">Envie sua mensagem</h3>
                                <p class="text-gray-500 text-xs mt-0.5">Retornaremos pelo canal informado</p>
                            </div>
                        </div>

                        <div class="grid md:grid-cols-2 gap-6 mb-6">
                            ${campo("contato-nome", "Nome completo *", "text", 'required maxlength="120"')}
                            ${campo("contato-email", "E-mail *", "email", 'required maxlength="254" placeholder="seu@email.com"')}
                        </div>

                        <div class="grid md:grid-cols-2 gap-6 mb-6">
                            ${campo("contato-telefone", "Telefone", "tel", 'maxlength="40"')}
                            <div>
                                <label for="contato-assunto" class="block text-xs font-semibold text-gray-700 mb-1.5">Assunto</label>
                                <input type="text" id="contato-assunto" name="assunto" maxlength="120"
                                    class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:border-school-gold focus:ring-2 focus:ring-school-gold/20 outline-none transition-all">
                            </div>
                        </div>

                        <div class="mb-6">
                            <label for="contato-mensagem" class="block text-xs font-semibold text-gray-700 mb-1.5">Mensagem *</label>
                            <textarea id="contato-mensagem" name="mensagem" rows="5" required maxlength="2000"
                                class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 text-sm focus:border-school-gold focus:ring-2 focus:ring-school-gold/20 outline-none transition-all resize-none"></textarea>
                        </div>

                        <button type="submit" id="submit-btn"
                            class="w-full py-4 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-xl font-bold text-base hover:shadow-lg hover:shadow-school-gold/30 transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:transform-none">
                            <i class="fas fa-paper-plane mr-2"></i>Enviar Mensagem
                        </button>

                        <div id="form-message" class="mt-4 text-center text-sm hidden" role="status" aria-live="polite"></div>
                    </form>
                </div>
            </div>
        </div>
    </section>`;
}
function renderChamadaFinal() {
  return `
    <section class="py-20 bg-gradient-to-r from-school-gold via-warm-500 to-school-coral relative overflow-hidden">
        <div class="absolute inset-0 opacity-10 pointer-events-none" style="background-image: radial-gradient(circle, white 1.5px, transparent 1.5px); background-size: 30px 30px;"></div>

        <div class="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center" data-aos="zoom-in">
            <h2 class="text-3xl lg:text-5xl font-bold text-white mb-6">Precisa falar com a escola?</h2>
            <p class="text-white/90 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
                Use o formul\xE1rio oficial deste portal para enviar sua mensagem \xE0 administra\xE7\xE3o da escola.
            </p>
            <div class="flex flex-wrap justify-center gap-4">
                <a href="#contato" class="px-10 py-4 bg-white text-school-navy rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
                    <i class="fas fa-paper-plane mr-3"></i>Ir para o formul\xE1rio
                </a>
            </div>
        </div>
    </section>`;
}
function renderRodape(contatos, navegacao, nomeInstitucional, marcaCurta, slogan) {
  const instagram = escUrl(contatos?.instagram_url);
  const facebook = escUrl(contatos?.facebook_url);
  const youtube = escUrl(contatos?.youtube_url);
  const temRedes = Boolean(instagram || facebook || youtube);
  const ano = (/* @__PURE__ */ new Date()).getFullYear();
  const telefones = Array.isArray(contatos?.telefones) ? contatos.telefones : [];
  const emails = Array.isArray(contatos?.emails) ? contatos.emails : [];
  const endereco = texto(contatos, "endereco");
  const horario = texto(contatos, "horario_atendimento");
  const rede = (href, rotulo, icone) => href ? `
                        <a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${rotulo}"
                           class="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-school-gold hover:text-white transition-all text-sm">
                            <i class="fab ${icone}"></i>
                        </a>` : "";
  const linhaContato = (icone, conteudo) => `
                        <li class="flex items-start gap-2.5 text-white/50 text-sm">
                            <i class="fas ${icone} text-school-gold/70 text-xs mt-1 w-3.5 text-center shrink-0"></i>
                            <span class="min-w-0 break-words">${conteudo}</span>
                        </li>`;
  const itensContato = [
    endereco ? linhaContato("fa-location-dot", esc(endereco)) : "",
    ...telefones.map((t) => linhaContato(
      "fa-phone",
      `<a href="tel:${esc(String(t).replace(/[^\d+]/g, ""))}" class="hover:text-school-gold transition-colors">${esc(t)}</a>`
    )),
    ...emails.map((e) => linhaContato(
      "fa-envelope",
      `<a href="mailto:${esc(e)}" class="hover:text-school-gold transition-colors">${esc(e)}</a>`
    )),
    horario ? linhaContato("fa-clock", esc(horario)) : ""
  ].filter(Boolean).join("");
  const secoes = navegacao.filter((s) => s.id !== "inicio");
  const linkNav = (s) => `
                        <li>
                            <a href="#${esc(s.id)}" class="text-white/50 hover:text-school-gold transition-colors text-sm inline-flex items-center gap-2">
                                <i class="fas fa-chevron-right text-[9px] text-school-gold/60"></i>${esc(s.rotulo)}
                            </a>
                        </li>`;
  const colunaTitulo = (titulo) => `<h4 class="text-white font-semibold mb-5 text-sm uppercase tracking-wider">${esc(titulo)}</h4>`;
  return `
    <footer class="bg-school-navy pt-16 pb-8 relative overflow-hidden">
        <div class="absolute -top-24 -right-24 w-80 h-80 bg-school-gold/5 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-32 -left-24 w-80 h-80 bg-school-sky/5 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

                <!-- Coluna 1: identidade institucional -->
                <div class="lg:col-span-1">
                    <div class="flex items-center gap-3 mb-5">
                        <div class="h-12 w-auto bg-white/95 rounded-xl px-2 py-1 flex items-center justify-center shadow-md">
                            <img src="/images/logo-eec-oficial.png" alt="${esc(nomeInstitucional)}" class="h-10 w-auto object-contain">
                        </div>
                        <div class="min-w-0">
                            <span class="text-xl font-bold text-white">${esc(marcaCurta)}</span>
                            <span class="block text-[10px] text-white/70 uppercase tracking-[2px] truncate">${esc(nomeInstitucional)}</span>
                        </div>
                    </div>
                    <p class="text-white/50 text-sm leading-relaxed">
                        ${slogan ? esc(slogan) : "Portal institucional da " + esc(nomeInstitucional) + " \u2014 Rede Estadual de Ensino de Minas Gerais."}
                    </p>
                    ${temRedes ? `
                    <div class="flex gap-3 mt-6">
                        ${rede(instagram, "Instagram", "fa-instagram")}
                        ${rede(facebook, "Facebook", "fa-facebook-f")}
                        ${rede(youtube, "YouTube", "fa-youtube")}
                    </div>` : ""}
                </div>

                <!-- Coluna 2: navega\xE7\xE3o da p\xE1gina -->
                ${secoes.length ? `
                <div>
                    ${colunaTitulo("Navega\xE7\xE3o")}
                    <ul class="space-y-3">
                        ${secoes.slice(0, 5).map(linkNav).join("")}
                    </ul>
                </div>` : ""}

                ${secoes.length > 5 ? `
                <div>
                    ${colunaTitulo("Mais conte\xFAdo")}
                    <ul class="space-y-3">
                        ${secoes.slice(5).map(linkNav).join("")}
                    </ul>
                </div>` : ""}

                <!-- Coluna 3: canais de atendimento publicados -->
                ${itensContato ? `
                <div>
                    ${colunaTitulo("Atendimento")}
                    <ul class="space-y-3">${itensContato}</ul>
                </div>` : ""}

                <!-- Coluna 4: informa\xE7\xE3o institucional -->
                <div>
                    ${colunaTitulo("Institucional")}
                    <ul class="space-y-3">
                        <li class="flex items-start gap-2.5 text-white/50 text-sm">
                            <i class="fas fa-building-columns text-school-gold/70 text-xs mt-1 w-3.5 text-center shrink-0"></i>
                            <span>Rede Estadual de Ensino de Minas Gerais</span>
                        </li>
                        <li>
                            <a href="#contato" class="text-white/50 hover:text-school-gold transition-colors text-sm inline-flex items-start gap-2.5">
                                <i class="fas fa-paper-plane text-school-gold/70 text-xs mt-1 w-3.5 text-center shrink-0"></i>
                                <span>Enviar mensagem \xE0 escola</span>
                            </a>
                        </li>
                        <li>
                            <a href="/admin/login" class="text-white/50 hover:text-school-gold transition-colors text-sm inline-flex items-start gap-2.5">
                                <i class="fas fa-lock text-school-gold/70 text-xs mt-1 w-3.5 text-center shrink-0"></i>
                                <span>Acesso institucional</span>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p class="text-white/40 text-sm">&copy; ${ano} ${esc(nomeInstitucional)}.</p>
                <p class="text-white/30 text-xs flex items-center gap-2">
                    <i class="fas fa-shield-halved text-[10px]"></i>
                    Ambiente institucional protegido
                </p>
            </div>
        </div>
    </footer>`;
}
function renderHomePage(conteudo, institucional = null) {
  const nomeInstitucional = String(institucional?.nome_escola ?? "").trim() || "Escola Estadual do Cariri";
  const sloganInstitucional = String(institucional?.slogan ?? "").trim();
  const marcaCurta = (() => {
    const acronimo = nomeInstitucional.match(/[-–(]\s*([A-ZÁÊÇÕ]{2,6})\s*\)?\s*$/);
    if (acronimo) return acronimo[1];
    const iniciais = nomeInstitucional.split(/\s+/).filter((palavra) => palavra.length >= 3).map((palavra) => palavra.charAt(0).toUpperCase()).join("");
    return iniciais.slice(0, 4) || "EEC";
  })();
  const navegacao = [
    { id: "inicio", rotulo: "In\xEDcio" },
    { id: "sobre", rotulo: "Sobre" },
    { id: "cursos", rotulo: "Cursos" },
    { id: "projetos", rotulo: "Projetos" },
    { id: "noticias", rotulo: "Not\xEDcias" },
    { id: "galeria", rotulo: "Galeria" },
    { id: "equipe", rotulo: "Equipe" },
    { id: "documentos", rotulo: "Documentos" },
    { id: "contato", rotulo: "Contato" }
  ];
  const tituloPagina = texto(conteudo.inicio, "hero_titulo") || nomeInstitucional;
  const descricaoPagina = texto(conteudo.inicio, "hero_chamada") || texto(conteudo.sobre, "apresentacao").slice(0, 160) || sloganInstitucional || `Portal institucional da ${nomeInstitucional}, Rede Estadual de Ensino de Minas Gerais.`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(tituloPagina)}</title>
    <meta name="description" content="${esc(descricaoPagina)}">

    <link rel="icon" href="/images/logo-eec-oficial.png">

    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css" rel="stylesheet">
    <link href="${assetUrl("/styles/tailwind.css")}" rel="stylesheet">
    <link href="${assetUrl("/static/styles.css")}" rel="stylesheet">
</head>

<body class="font-poppins bg-white text-gray-800 overflow-x-hidden">

    ${conteudo.preview ? `
    <div class="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-amber-950 text-center py-2 px-4 text-xs sm:text-sm font-semibold shadow-lg">
        <i class="fas fa-eye mr-2"></i>
        Visualiza\xE7\xE3o pr\xE9via \u2014 inclui conte\xFAdo em rascunho e ainda n\xE3o publicado.
        <a href="/admin/site-publico" class="underline ml-2 hover:text-amber-900">Voltar \xE0 administra\xE7\xE3o</a>
    </div>` : ""}

    <div id="preloader" class="fixed inset-0 z-[9999] bg-school-navy flex items-center justify-center transition-opacity duration-700">
        <div class="text-center">
            <img src="/images/logo-eec-oficial.png" alt="Escola Estadual do Cariri" class="h-20 w-auto object-contain mx-auto mb-6">
            <div class="flex space-x-2 justify-center">
                <div class="w-3 h-3 rounded-full bg-school-sky animate-pulse" style="animation-delay: 0s"></div>
                <div class="w-3 h-3 rounded-full bg-school-gold animate-pulse" style="animation-delay: 0.2s"></div>
                <div class="w-3 h-3 rounded-full bg-school-emerald animate-pulse" style="animation-delay: 0.4s"></div>
            </div>
            <p class="text-white/70 mt-4 text-sm tracking-widest uppercase">Carregando...</p>
        </div>
    </div>

    <nav id="navbar" class="fixed ${conteudo.preview ? "top-9" : "top-0"} left-0 right-0 z-50 transition-all duration-500">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-20">
                <a href="#inicio" class="flex items-center gap-3 group shrink-0">
                    <div class="h-12 w-auto bg-white/95 rounded-xl px-2 py-1 flex items-center justify-center shadow-md transition-transform group-hover:scale-105 shrink-0">
                        <img src="/images/logo-eec-oficial.png" alt="Escola Estadual do Cariri" class="h-10 w-auto object-contain">
                    </div>
                    <div>
                        <span class="text-xl font-bold text-white group-hover:text-school-gold transition-colors">${esc(marcaCurta)}</span>
                        <span class="hidden xl:block text-[10px] text-white/70 uppercase tracking-[2px] whitespace-nowrap">${esc(nomeInstitucional)}</span>
                    </div>
                </a>

                <div class="hidden md:flex items-center space-x-1">
                    ${navegacao.filter((s) => s.id !== "contato").map((s) => `
                    <a href="#${esc(s.id)}" class="nav-link px-1.5 lg:px-2 xl:px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-xs lg:text-[13px] xl:text-sm font-medium whitespace-nowrap">${esc(s.rotulo)}</a>`).join("")}

                    <!--
                        Entre 768px e 1023px o bot\xE3o dourado n\xE3o cabe ao lado de oito se\xE7\xF5es sem
                        espremer os r\xF3tulos. Nessa faixa o contato entra como link de texto, como
                        as demais se\xE7\xF5es; a partir de lg o bot\xE3o volta ao lugar do gabarito.
                    -->
                    <a href="#contato" class="lg:hidden nav-link px-1.5 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-xs font-medium whitespace-nowrap">Contato</a>
                    <a href="#contato" class="hidden lg:inline-flex ml-2 xl:ml-4 px-4 xl:px-6 py-2.5 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-full font-semibold text-[13px] xl:text-sm whitespace-nowrap shrink-0 hover:shadow-lg hover:shadow-school-gold/30 transform hover:-translate-y-0.5 transition-all duration-300 items-center gap-2">
                        <i class="fas fa-envelope text-xs"></i>Fale com a Escola
                    </a>
                </div>

                <button id="mobile-menu-btn" class="md:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Abrir menu de navega\xE7\xE3o">
                    <i class="fas fa-bars text-xl"></i>
                </button>
            </div>
        </div>

        <div id="mobile-menu" class="md:hidden hidden bg-school-navy/98 backdrop-blur-xl border-t border-white/10">
            <div class="px-4 py-6 space-y-2">
                ${navegacao.map((s) => `
                <a href="#${esc(s.id)}" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">${esc(s.rotulo)}</a>`).join("")}
                <a href="#contato" class="block mt-3 px-4 py-3 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-xl font-bold text-center">
                    <i class="fas fa-envelope mr-2 text-xs"></i>Fale com a Escola
                </a>
            </div>
        </div>
    </nav>

    ${renderHero(conteudo, navegacao, institucional)}
    ${renderSobre(conteudo.sobre)}
    ${renderFaixaInstitucional()}
    ${renderCursos(conteudo.cursos)}
    ${renderProjetos(conteudo.projetos)}
    ${renderNoticias(conteudo.noticias)}
    ${renderGaleria(conteudo.galeria)}
    ${renderEquipe(conteudo.equipe)}
    ${renderSecoesExtras(conteudo.secoes)}
    ${renderDestaques(conteudo.secoes)}
    ${renderDocumentosELinks(conteudo.documentos, conteudo.links)}
    ${renderContato(conteudo.contatos)}
    ${renderChamadaFinal()}
    ${renderRodape(conteudo.contatos, navegacao, nomeInstitucional, marcaCurta, sloganInstitucional)}

    ${whatsappFlutuante(conteudo.contatos)}

    <button id="back-to-top"
        class="fixed bottom-6 right-6 z-50 w-12 h-12 bg-school-navy rounded-full flex items-center justify-center shadow-lg hover:bg-school-gold transform hover:scale-110 transition-all duration-300 opacity-0 translate-y-10"
        aria-label="Voltar ao topo">
        <i class="fas fa-arrow-up text-white"></i>
    </button>

    <script src="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.7.2/dist/axios.min.js"></script>
    <script src="${assetUrl("/static/utils/dom.js")}"></script>
    <script src="${assetUrl("/static/app.js")}"></script>
</body>
</html>`;
}

// src/routes/pages.routes.ts
var pagesRoutes = new Hono9();
async function conteudoVazio() {
  return {
    inicio: null,
    heroDestaques: [],
    sobre: null,
    contatos: null,
    cursos: [],
    projetos: [],
    noticias: [],
    galeria: [],
    equipe: [],
    documentos: [],
    links: [],
    secoes: [],
    preview: false
  };
}
async function identidadeInstitucional(client) {
  try {
    return await getIdentidadePublica(client);
  } catch {
    return null;
  }
}
pagesRoutes.get("/", async (c) => {
  const client = createHonoSupabaseClient(c);
  try {
    const [conteudo, institucional] = await Promise.all([
      obterConteudoSitePublico(client, false),
      identidadeInstitucional(client)
    ]);
    return c.html(renderHomePage(conteudo, institucional));
  } catch {
    return c.html(renderHomePage(await conteudoVazio()));
  }
});
pagesRoutes.get(
  "/admin/site-publico/preview",
  requireAuth,
  requireRole("super_admin", "admin"),
  async (c) => {
    const client = createHonoSupabaseClient(c);
    const [conteudo, institucional] = await Promise.all([
      obterConteudoSitePublico(client, true),
      identidadeInstitucional(client)
    ]);
    return c.html(renderHomePage(conteudo, institucional));
  }
);
pagesRoutes.get("/formulario", (c) => c.redirect("/admin/configuracao-institucional", 302));
pagesRoutes.get("/admin/login", (c) => c.html(renderLoginPage()));
pagesRoutes.get("/admin/reset-password", (c) => c.html(renderResetPasswordPage()));
pagesRoutes.get("/admin", requireAuth, (c) => {
  const user = c.get("user");
  const role = c.get("role") || "sem_perfil";
  if (role === "docente") {
    return c.redirect("/portal-docente", 302);
  }
  return c.html(renderAdminDashboard(user.nome, role));
});
var MODULOS_RESTRITOS = /* @__PURE__ */ new Set(["usuarios", "mensagens"]);
for (const modulo of ["comunicados", "documentos", "usuarios", "mensagens"]) {
  pagesRoutes.get(`/admin/${modulo}`, requireAuth, (c) => {
    if (!isModuloAdmin(modulo)) {
      return c.redirect("/admin", 302);
    }
    const user = c.get("user");
    const role = c.get("role") || "sem_perfil";
    if (role === "docente") {
      return c.redirect("/portal-docente", 302);
    }
    if (MODULOS_RESTRITOS.has(modulo) && role !== "super_admin" && role !== "admin") {
      return c.redirect("/admin", 302);
    }
    return c.html(renderAdminModuloPage(modulo, user.nome, role));
  });
}
pagesRoutes.get(
  "/admin/site-publico",
  requireAuth,
  requireRole("super_admin", "admin"),
  (c) => {
    const user = c.get("user");
    const role = c.get("role") || "admin";
    return c.html(renderAdminSitePublicoPage(user.nome, role, "inicio"));
  }
);
pagesRoutes.get(
  "/admin/site-publico/:secao",
  requireAuth,
  requireRole("super_admin", "admin"),
  (c) => {
    const user = c.get("user");
    const role = c.get("role") || "admin";
    const secao = c.req.param("secao");
    return c.html(renderAdminSitePublicoPage(user.nome, role, secao));
  }
);
pagesRoutes.get(
  "/admin/configuracao-institucional",
  requireAuth,
  requireRole("super_admin", "admin"),
  (c) => c.html(renderFormularioPage())
);
pagesRoutes.get(
  "/portal-docente",
  requireAuth,
  requireRole("super_admin", "admin", "docente"),
  (c) => {
    const user = c.get("user");
    const role = c.get("role") || "docente";
    return c.html(renderPortalDocentePage(user.nome, role));
  }
);
pagesRoutes.get(
  "/professor/:modulo",
  requireAuth,
  requireRole("super_admin", "admin", "docente"),
  (c) => {
    const modulo = c.req.param("modulo");
    if (!isModuloDocente(modulo)) {
      return c.redirect("/portal-docente", 302);
    }
    const user = c.get("user");
    const role = c.get("role") || "docente";
    return c.html(renderPortalDocenteModuloPage(modulo, user.nome, role));
  }
);
pagesRoutes.get("/midia/*", (c) => {
  const caminho = c.req.path.replace(/^\/midia\//, "");
  const imagem = obterImagemLocal(caminho);
  if (!imagem) {
    return c.text("Imagem n\xE3o encontrada.", 404);
  }
  return new Response(new Uint8Array(imagem.buffer), {
    headers: {
      "Content-Type": imagem.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
});
var pages_routes_default = pagesRoutes;

// src/routes/school.routes.ts
import { Hono as Hono10 } from "hono";

// src/repositories/school.repository.ts
function getCursos() {
  return [
    {
      id: 1,
      nome: "Fundamental II Integral",
      descricao: "Forma\xE7\xE3o s\xF3lida do 6\xBA ao 9\xBA ano com foco no desenvolvimento integral e atividades pr\xE1ticas.",
      icone: "fa-book-open-reader",
      cor: "#4ECDC4",
      idade: "11-14 anos",
      turno: "Integral"
    },
    {
      id: 2,
      nome: "M\xE9dio T\xE9cnico Integral",
      descricao: "Ensino m\xE9dio integrado \xE0 forma\xE7\xE3o t\xE9cnica profissionalizante de alta qualidade.",
      icone: "fa-microchip",
      cor: "#45B7D1",
      idade: "15-17 anos",
      turno: "Integral"
    },
    {
      id: 3,
      nome: "T\xE9cnico Noturno",
      descricao: "Qualifica\xE7\xE3o profissional para quem busca inser\xE7\xE3o r\xE1pida no mercado de trabalho.",
      icone: "fa-briefcase",
      cor: "#96CEB4",
      idade: "+18 anos",
      turno: "Noturno"
    }
  ];
}
function getProfessores() {
  return [
    {
      id: 1,
      nome: "Profa. Maria Silva",
      cargo: "Coordenadora Pedag\xF3gica",
      bio: "Mestre em Educa\xE7\xE3o pela USP com 15 anos de experi\xEAncia em gest\xE3o escolar.",
      avatar: "MS",
      cor: "#FF6B6B"
    },
    {
      id: 2,
      nome: "Prof. Carlos Oliveira",
      cargo: "Matem\xE1tica e Ci\xEAncias",
      bio: "Doutor em Matem\xE1tica Aplicada, apaixonado por tornar n\xFAmeros divertidos.",
      avatar: "CO",
      cor: "#4ECDC4"
    },
    {
      id: 3,
      nome: "Profa. Ana Santos",
      cargo: "L\xEDngua Portuguesa e Literatura",
      bio: "Especialista em Lingu\xEDstica com foco em metodologias ativas de ensino.",
      avatar: "AS",
      cor: "#45B7D1"
    },
    {
      id: 4,
      nome: "Prof. Ricardo Lima",
      cargo: "Tecnologia e Rob\xF3tica",
      bio: "Engenheiro de Software que encontrou sua paix\xE3o na educa\xE7\xE3o tecnol\xF3gica.",
      avatar: "RL",
      cor: "#96CEB4"
    }
  ];
}
function getDiferenciais() {
  return [
    {
      id: 1,
      titulo: "Laborat\xF3rios Maker",
      descricao: "Espa\xE7os equipados com impressoras 3D e kits de rob\xF3tica para aprendizagem pr\xE1tica.",
      icone: "fa-microchip",
      cor: "#FF6B6B"
    },
    {
      id: 2,
      titulo: "Est\xE1gios Garantidos",
      descricao: "Parcerias com as maiores empresas da regi\xE3o para inser\xE7\xE3o no mercado.",
      icone: "fa-handshake",
      cor: "#4ECDC4"
    },
    {
      id: 3,
      titulo: "Certifica\xE7\xE3o T\xE9cnica",
      descricao: "Diplomas reconhecidos pelo MEC e valorizados pelo setor produtivo.",
      icone: "fa-certificate",
      cor: "#45B7D1"
    },
    {
      id: 4,
      titulo: "Projetos Inovadores",
      descricao: "Fomento ao empreendedorismo e desenvolvimento de solu\xE7\xF5es reais.",
      icone: "fa-lightbulb",
      cor: "#96CEB4"
    }
  ];
}
function getEstatisticas() {
  return {
    alunos: 1250,
    professores: 85,
    aprovacaoVestibular: 97,
    anosExperiencia: 28,
    notaEnem: 780,
    areaVerde: 5e3
  };
}
function getEventos() {
  return [
    {
      id: 1,
      titulo: "Feira de Ci\xEAncias 2026",
      data: "15 de Mar\xE7o",
      descricao: "Projetos inovadores dos alunos do Fundamental e M\xE9dio.",
      tipo: "acad\xEAmico"
    },
    {
      id: 2,
      titulo: "Festival de Artes",
      data: "22 de Abril",
      descricao: "Apresenta\xE7\xF5es de m\xFAsica, dan\xE7a e teatro.",
      tipo: "cultural"
    },
    {
      id: 3,
      titulo: "Olimp\xEDada Esportiva",
      data: "10 de Maio",
      descricao: "Competi\xE7\xF5es entre turmas em diversas modalidades.",
      tipo: "esportivo"
    },
    {
      id: 4,
      titulo: "Reuni\xE3o de Pais",
      data: "05 de Mar\xE7o",
      descricao: "Encontro com a equipe pedag\xF3gica para alinhamento do semestre.",
      tipo: "institucional"
    }
  ];
}

// src/routes/school.routes.ts
var schoolRoutes = new Hono10();
schoolRoutes.get("/cursos", (c) => c.json(getCursos()));
schoolRoutes.get("/professores", (c) => c.json(getProfessores()));
schoolRoutes.get("/diferenciais", (c) => c.json(getDiferenciais()));
schoolRoutes.get("/estatisticas", (c) => c.json(getEstatisticas()));
schoolRoutes.get("/eventos", (c) => c.json(getEventos()));
var school_routes_default = schoolRoutes;

// src/routes/site-cms.routes.ts
import { Hono as Hono11 } from "hono";
var siteCmsRoutes = new Hono11();
siteCmsRoutes.use("*", requireAuth);
siteCmsRoutes.use("*", requireRole("super_admin", "admin"));
var LIMITE_CORPO = 128 * 1024;
function areaValida(valor) {
  return isAreaCmsValida(valor);
}
function ipOrigem(c) {
  return c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip");
}
siteCmsRoutes.get("/resumo", async (c) => {
  const client = createHonoSupabaseClient(c);
  try {
    const resumo = await obterResumoAreas(client);
    return c.json({ areas: resumo });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Erro ao carregar o panorama do site." }, 500);
  }
});
siteCmsRoutes.get("/:area", async (c) => {
  const area = c.req.param("area");
  if (!areaValida(area)) {
    return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
  }
  const client = createHonoSupabaseClient(c);
  try {
    const conteudo = await obterAreaAdmin(area, client);
    return c.json({ area, singleton: isAreaSingleton(area), conteudo });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Erro ao carregar a \xE1rea." }, 500);
  }
});
siteCmsRoutes.put(
  "/:area",
  rateLimit({ maxRequests: 40, windowMs: 6e4 }),
  async (c) => {
    const area = c.req.param("area");
    if (!areaValida(area)) {
      return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
    }
    if (!isAreaSingleton(area)) {
      return c.json({ error: "Esta \xE1rea \xE9 composta por registros individuais." }, 400);
    }
    const corpo = await readJsonBody(c, LIMITE_CORPO);
    const client = createHonoSupabaseClient(c);
    const usuario = c.get("user");
    const resultado = await salvarSecaoSingleton(area, corpo, usuario.id, client);
    if (!resultado.ok) {
      return c.json({ error: "N\xE3o foi poss\xEDvel salvar.", detalhes: resultado.erros }, 400);
    }
    await logAudit({
      user_id: usuario.id,
      acao: "EDITAR_SITE_PUBLICO",
      recurso: `site.${area}`,
      detalhes_json: { area, status: resultado.dados?.status || "rascunho" },
      ip_origem: ipOrigem(c)
    }, client);
    return c.json({ success: true, conteudo: resultado.dados });
  }
);
siteCmsRoutes.post(
  "/:area",
  rateLimit({ maxRequests: 60, windowMs: 6e4 }),
  async (c) => {
    const area = c.req.param("area");
    if (!areaValida(area)) {
      return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
    }
    const corpo = await readJsonBody(c, LIMITE_CORPO);
    const client = createHonoSupabaseClient(c);
    const usuario = c.get("user");
    const resultado = await criarItemColecao(area, corpo, usuario.id, client);
    if (!resultado.ok) {
      return c.json({ error: "N\xE3o foi poss\xEDvel criar o registro.", detalhes: resultado.erros }, 400);
    }
    await logAudit({
      user_id: usuario.id,
      acao: "CRIAR_ITEM_SITE_PUBLICO",
      recurso: `site.${area}`,
      registro_id: String(resultado.dados?.id ?? ""),
      detalhes_json: { area },
      ip_origem: ipOrigem(c)
    }, client);
    return c.json({ success: true, conteudo: resultado.dados }, 201);
  }
);
siteCmsRoutes.post(
  "/:area/reordenar",
  rateLimit({ maxRequests: 40, windowMs: 6e4 }),
  async (c) => {
    const area = c.req.param("area");
    if (!areaValida(area)) {
      return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
    }
    const corpo = await readJsonBody(c, LIMITE_CORPO);
    const validacao = reordenarSchema.safeParse(corpo);
    if (!validacao.success) {
      return c.json({
        error: "Dados de reordena\xE7\xE3o inv\xE1lidos.",
        detalhes: validacao.error.issues.map((i) => i.message)
      }, 400);
    }
    const client = createHonoSupabaseClient(c);
    const resultado = await reordenarItens(area, validacao.data.itens, client);
    if (!resultado.ok) {
      return c.json({ error: "N\xE3o foi poss\xEDvel reordenar.", detalhes: resultado.erros }, 400);
    }
    return c.json({ success: true });
  }
);
siteCmsRoutes.put(
  "/:area/:id",
  rateLimit({ maxRequests: 60, windowMs: 6e4 }),
  async (c) => {
    const area = c.req.param("area");
    const id = c.req.param("id");
    if (!areaValida(area)) {
      return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
    }
    const corpo = await readJsonBody(c, LIMITE_CORPO);
    const client = createHonoSupabaseClient(c);
    const usuario = c.get("user");
    const resultado = await atualizarItemColecao(area, id, corpo, usuario.id, client);
    if (!resultado.ok) {
      const naoEncontrado = resultado.erros?.includes("Registro n\xE3o encontrado.");
      return c.json(
        { error: "N\xE3o foi poss\xEDvel atualizar o registro.", detalhes: resultado.erros },
        naoEncontrado ? 404 : 400
      );
    }
    await logAudit({
      user_id: usuario.id,
      acao: "EDITAR_ITEM_SITE_PUBLICO",
      recurso: `site.${area}`,
      registro_id: id,
      detalhes_json: { area },
      ip_origem: ipOrigem(c)
    }, client);
    return c.json({ success: true, conteudo: resultado.dados });
  }
);
siteCmsRoutes.patch(
  "/:area/:id/status",
  rateLimit({ maxRequests: 60, windowMs: 6e4 }),
  async (c) => {
    const area = c.req.param("area");
    const id = c.req.param("id");
    if (!areaValida(area)) {
      return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
    }
    const corpo = await readJsonBody(c, 2 * 1024);
    const validacao = alterarStatusSchema.safeParse(corpo);
    if (!validacao.success) {
      return c.json({
        error: "Estado de publica\xE7\xE3o inv\xE1lido.",
        detalhes: validacao.error.issues.map((i) => i.message)
      }, 400);
    }
    const client = createHonoSupabaseClient(c);
    const usuario = c.get("user");
    const resultado = await alterarStatusItem(area, id, validacao.data.status, usuario.id, client);
    if (!resultado.ok) {
      return c.json({ error: "N\xE3o foi poss\xEDvel alterar o estado.", detalhes: resultado.erros }, 404);
    }
    await logAudit({
      user_id: usuario.id,
      acao: validacao.data.status === "publicado" ? "PUBLICAR_SITE_PUBLICO" : "ALTERAR_ESTADO_SITE_PUBLICO",
      recurso: `site.${area}`,
      registro_id: id,
      detalhes_json: { area, status: validacao.data.status },
      ip_origem: ipOrigem(c)
    }, client);
    return c.json({ success: true, conteudo: resultado.dados });
  }
);
siteCmsRoutes.delete("/:area/:id", async (c) => {
  const area = c.req.param("area");
  const id = c.req.param("id");
  if (!areaValida(area)) {
    return c.json({ error: "\xC1rea do site n\xE3o reconhecida." }, 404);
  }
  const client = createHonoSupabaseClient(c);
  const usuario = c.get("user");
  const resultado = await removerItemColecao(area, id, client);
  if (!resultado.ok) {
    return c.json({ error: "N\xE3o foi poss\xEDvel remover.", detalhes: resultado.erros }, 404);
  }
  await logAudit({
    user_id: usuario.id,
    acao: "REMOVER_ITEM_SITE_PUBLICO",
    recurso: `site.${area}`,
    registro_id: id,
    detalhes_json: { area },
    ip_origem: ipOrigem(c)
  }, client);
  return c.json({ success: true });
});
siteCmsRoutes.post(
  "/galeria/:albumId/fotos",
  rateLimit({ maxRequests: 80, windowMs: 6e4 }),
  async (c) => {
    const albumId = c.req.param("albumId");
    const corpo = await readJsonBody(c, LIMITE_CORPO);
    const client = createHonoSupabaseClient(c);
    const resultado = await adicionarFoto(albumId, corpo, client);
    if (!resultado.ok) {
      const naoEncontrado = resultado.erros?.includes("\xC1lbum n\xE3o encontrado.");
      return c.json(
        { error: "N\xE3o foi poss\xEDvel adicionar a foto.", detalhes: resultado.erros },
        naoEncontrado ? 404 : 400
      );
    }
    return c.json({ success: true, conteudo: resultado.dados }, 201);
  }
);
siteCmsRoutes.post(
  "/galeria/:albumId/fotos/upload",
  rateLimit({ maxRequests: 30, windowMs: 6e4 }),
  async (c) => {
    const albumId = c.req.param("albumId");
    const client = createHonoSupabaseClient(c);
    const album = await obterRegistro("site_albuns", albumId, client);
    if (!album) {
      return c.json({ error: "\xC1lbum n\xE3o encontrado." }, 404);
    }
    const corpo = await c.req.parseBody({ all: true }).catch(() => null);
    if (!corpo) {
      return c.json({ error: "N\xE3o foi poss\xEDvel ler os arquivos enviados." }, 400);
    }
    const bruto = corpo["arquivos"];
    const arquivos = (Array.isArray(bruto) ? bruto : [bruto]).filter((f) => f instanceof File);
    if (!arquivos.length) {
      return c.json({ error: "Nenhuma imagem foi enviada." }, 400);
    }
    if (arquivos.length > 20) {
      return c.json({ error: "Envie no m\xE1ximo 20 imagens por vez." }, 400);
    }
    const legendasBrutas = corpo["legendas"];
    const legendas = (Array.isArray(legendasBrutas) ? legendasBrutas : [legendasBrutas]).map((l) => typeof l === "string" ? l : "");
    const criadas = [];
    const falhas = [];
    const enviados = [];
    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      try {
        if (arquivo.size > MAX_IMAGE_SIZE_BYTES) {
          throw new HttpError(400, `A imagem tem ${(arquivo.size / (1024 * 1024)).toFixed(2)} MB e o limite \xE9 5 MB.`);
        }
        const buffer = Buffer.from(await arquivo.arrayBuffer());
        const validada = validarImagemGaleria(arquivo.name, buffer, arquivo.type || "");
        const armazenada = await enviarImagemGaleria(validada, client);
        enviados.push(armazenada.storagePath);
        const resultado = await adicionarFoto(albumId, {
          imagem_url: armazenada.publicUrl,
          legenda: legendas[i] || "",
          ordem: i
        }, client);
        if (!resultado.ok) {
          await removerImagemGaleria(armazenada.storagePath, client);
          enviados.pop();
          throw new HttpError(400, resultado.erros?.join(" ") || "Registro da foto recusado.");
        }
        criadas.push(resultado.dados);
      } catch (erro) {
        falhas.push({
          arquivo: arquivo.name,
          motivo: erro instanceof HttpError ? erro.message : erro instanceof Error ? erro.message : "Falha inesperada no envio."
        });
      }
    }
    if (!criadas.length) {
      return c.json({ error: "Nenhuma imagem p\xF4de ser enviada.", falhas }, 400);
    }
    await logAudit({
      user_id: c.get("user").id,
      acao: "UPLOAD_FOTO_GALERIA",
      recurso: `site.galeria.${albumId}`,
      detalhes_json: { enviadas: criadas.length, recusadas: falhas.length, caminhos: enviados },
      ip_origem: ipOrigem(c)
    }, client).catch(() => void 0);
    return c.json({ success: true, conteudo: criadas, enviadas: criadas.length, falhas }, 201);
  }
);
siteCmsRoutes.delete("/galeria/fotos/:fotoId", async (c) => {
  const client = createHonoSupabaseClient(c);
  const fotoId = c.req.param("fotoId");
  const foto = await obterRegistro("site_fotos", fotoId, client);
  const caminho = foto ? caminhoDaUrlDeMidia(String(foto.imagem_url ?? "")) : null;
  const resultado = await removerFoto(fotoId, client);
  if (!resultado.ok) {
    return c.json({ error: "N\xE3o foi poss\xEDvel remover a foto.", detalhes: resultado.erros }, 404);
  }
  if (caminho) {
    await removerImagemGaleria(caminho, client).catch(() => void 0);
  }
  return c.json({ success: true, arquivoRemovido: Boolean(caminho) });
});
siteCmsRoutes.post(
  "/documentos/:id/arquivo",
  rateLimit({ maxRequests: 30, windowMs: 6e4 }),
  async (c) => {
    const id = c.req.param("id");
    const client = createHonoSupabaseClient(c);
    const documento = await obterRegistro("site_documentos", id, client);
    if (!documento) {
      return c.json({ error: "Documento n\xE3o encontrado." }, 404);
    }
    const corpo = await c.req.parseBody().catch(() => null);
    const arquivo = corpo?.["arquivo"];
    if (!(arquivo instanceof File)) {
      return c.json({ error: "Nenhum arquivo enviado." }, 400);
    }
    let armazenado;
    try {
      if (arquivo.size > MAX_DOC_PUBLICO_BYTES) {
        throw new HttpError(400, `O arquivo tem ${(arquivo.size / (1024 * 1024)).toFixed(2)} MB e o limite \xE9 10 MB.`);
      }
      const buffer = Buffer.from(await arquivo.arrayBuffer());
      const validado = validarDocumentoPublico(arquivo.name, buffer, arquivo.type || "");
      armazenado = await enviarDocumentoPublico(validado, client);
    } catch (erro) {
      const mensagem = erro instanceof HttpError ? erro.message : erro instanceof Error ? erro.message : "N\xE3o foi poss\xEDvel enviar o arquivo.";
      return c.json({ error: mensagem }, 400);
    }
    const anterior = caminhoDaUrlDeMidia(String(documento.arquivo_url ?? ""));
    const atualizado = await atualizarRegistro("site_documentos", id, {
      arquivo_url: armazenado.publicUrl,
      arquivo_nome: armazenado.originalName,
      arquivo_tipo: armazenado.mimeType,
      arquivo_tamanho: armazenado.sizeBytes
    }, c.get("user")?.id ?? null, client);
    if (!atualizado) {
      await removerArquivoMidia(armazenado.storagePath, client).catch(() => void 0);
      return c.json({ error: "O arquivo foi recusado ao vincular ao documento." }, 500);
    }
    if (anterior && anterior !== armazenado.storagePath) {
      await removerArquivoMidia(anterior, client).catch(() => void 0);
    }
    await logAudit({
      user_id: c.get("user").id,
      acao: anterior ? "SUBSTITUIR_ARQUIVO_DOCUMENTO_PUBLICO" : "ANEXAR_ARQUIVO_DOCUMENTO_PUBLICO",
      recurso: `site.documentos.${id}`,
      detalhes_json: {
        arquivo: armazenado.originalName,
        tipo: armazenado.mimeType,
        bytes: armazenado.sizeBytes,
        substituiu: anterior || null
      },
      ip_origem: ipOrigem(c)
    }, client).catch(() => void 0);
    return c.json({ success: true, conteudo: atualizado, substituiu: Boolean(anterior) });
  }
);
siteCmsRoutes.delete("/documentos/:id/arquivo", async (c) => {
  const id = c.req.param("id");
  const client = createHonoSupabaseClient(c);
  const documento = await obterRegistro("site_documentos", id, client);
  if (!documento) {
    return c.json({ error: "Documento n\xE3o encontrado." }, 404);
  }
  const caminho = caminhoDaUrlDeMidia(String(documento.arquivo_url ?? ""));
  const atualizado = await atualizarRegistro("site_documentos", id, {
    arquivo_url: "",
    arquivo_nome: "",
    arquivo_tipo: "",
    arquivo_tamanho: 0
  }, c.get("user")?.id ?? null, client);
  if (caminho) {
    await removerArquivoMidia(caminho, client).catch(() => void 0);
  }
  return c.json({ success: true, conteudo: atualizado, arquivoRemovido: Boolean(caminho) });
});
var site_cms_routes_default = siteCmsRoutes;

// src/middlewares/cors.ts
import { cors } from "hono/cors";
function configuredOrigins() {
  try {
    return getEnv().ALLOWED_ORIGINS;
  } catch {
    return ["http://localhost:3000"];
  }
}
function requestOrigin(c) {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}
var restrictedCors = cors({
  origin: (origin, c) => {
    if (!origin) return void 0;
    const allowedOrigins = /* @__PURE__ */ new Set([
      requestOrigin(c),
      ...configuredOrigins()
    ]);
    return allowedOrigins.has(origin) ? origin : void 0;
  }
});

// src/middlewares/security-headers.ts
function securityHeaders() {
  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  };
}

// src/app.ts
var app = new Hono12();
app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json(errorBody(err.message), err.status);
  }
  console.error("[UNHANDLED_ERROR]", err);
  return c.json(errorBody("Erro interno do servidor."), 500);
});
app.use("*", securityHeaders());
app.use("*", csrfProtection);
app.use("/api/*", restrictedCors);
app.route("/api/health", health_routes_default);
app.route("/api/auth", auth_routes_default);
app.route("/api/admin/site", site_cms_routes_default);
app.route("/api/admin", admin_routes_default);
app.route("/api/docente", docente_routes_default);
app.route("/api/comunicados", comunicado_routes_default);
app.route("/api/documentos", documento_routes_default);
app.route("/api/formulario", formulario_routes_default);
app.route("/api/contato", contato_routes_default);
app.route("/api", school_routes_default);
app.route("/", pages_routes_default);
var app_default = app;

// src/serverless.ts
var config = {
  runtime: "nodejs"
};
var MAX_SERVERLESS_BODY_BYTES = 1024 * 1024;
var nodeListener = getRequestListener(app_default.fetch.bind(app_default));
async function bufferIncomingBody(req) {
  const method = req.method?.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return;
  }
  if (req.rawBody && req.rawBody instanceof Buffer) {
    return;
  }
  const contentLength = req.headers["content-length"] ? parseInt(req.headers["content-length"], 10) : void 0;
  if (contentLength && contentLength > MAX_SERVERLESS_BODY_BYTES) {
    const error = new Error("Payload Too Large");
    error.statusCode = 413;
    throw error;
  }
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > MAX_SERVERLESS_BODY_BYTES) {
      if (typeof req.destroy === "function") {
        req.destroy();
      }
      const error = new Error("Payload Too Large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buf);
  }
  ;
  req.rawBody = Buffer.concat(chunks);
}
async function handler(req, res) {
  if (res && typeof res.writeHead === "function") {
    const incoming = req;
    try {
      await bufferIncomingBody(incoming);
    } catch (err) {
      if (err?.statusCode === 413 || err?.message === "Payload Too Large") {
        const responseObj = {
          error: "Payload Too Large",
          message: `O tamanho da requisi\xE7\xE3o excede o limite m\xE1ximo permitido de ${MAX_SERVERLESS_BODY_BYTES / (1024 * 1024)}MB. Para envio de arquivos, utilize o fluxo de upload direto com URLs assinadas.`
        };
        const bodyJson = JSON.stringify(responseObj);
        res.writeHead(413, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyJson).toString()
        });
        res.end(bodyJson);
        return;
      }
      throw err;
    }
    return nodeListener(incoming, res);
  }
  return app_default.fetch(req);
}
export {
  MAX_SERVERLESS_BODY_BYTES,
  bufferIncomingBody,
  config,
  handler as default
};
