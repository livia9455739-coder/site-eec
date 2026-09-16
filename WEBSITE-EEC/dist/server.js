// src/node-server.ts
import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve as resolve2 } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono as Hono7 } from "hono";

// src/app.ts
import { Hono as Hono6 } from "hono";

// src/routes/contato.routes.ts
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

// src/database/connection.ts
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

// src/config/env.ts
import { z } from "zod";
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  PORT: z.coerce.number().int().positive().default(3e3),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().url("DATABASE_URL deve ser uma URL v\xE1lida.").optional(),
  PG_POOL_MAX: z.coerce.number().int().positive().default(1),
  PGSSLMODE: z.enum(["require", "verify-full", "disable", "no-verify"]).optional(),
  SQLITE_PATH: z.string().default("./data/app.sqlite"),
  APP_VERSION: z.string().default("2.0.0")
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

// src/database/connection.ts
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

// src/database/postgres.ts
import pg from "pg";
var { Pool } = pg;
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
  if (config2.isCloud) {
    return { rejectUnauthorized: true };
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

// src/repositories/contato.repository.ts
async function saveContact(data) {
  if (hasPostgresConfig()) {
    const result2 = await queryPostgres(
      `
                INSERT INTO contatos (
                    nome,
                    email,
                    telefone,
                    assunto,
                    mensagem
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `,
      [
        data.nome,
        data.email,
        data.telefone || null,
        data.assunto || null,
        data.mensagem
      ]
    );
    return Number(result2.rows[0]?.id);
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

// src/schemas/contato.schema.ts
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

// src/schemas/contato.schema.ts
var safeRequiredText = (field, min, max) => z2.string({ error: `${field} deve ser texto.` }).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText);
var safeOptionalText = (field, max) => z2.string({ error: `${field} deve ser texto.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m conte\xFAdo n\xE3o permitido.`).transform(sanitizeText).optional();
var contatoSchema = z2.object({
  nome: safeRequiredText("Nome", 2, 120),
  email: z2.string({ error: "E-mail deve ser texto." }).trim().email("E-mail inv\xE1lido.").max(254, "E-mail excede o tamanho m\xE1ximo.").refine((value) => !hasSuspiciousHtml(value), "E-mail cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText),
  telefone: safeOptionalText("Telefone", 40),
  assunto: safeOptionalText("Assunto", 160),
  mensagem: safeRequiredText("Mensagem", 5, 2e3)
}).strip();

// src/services/contato.service.ts
async function processContact(payload) {
  const result = contatoSchema.safeParse(payload);
  if (!result.success) {
    return {
      status: 400,
      body: errorBody("Dados de contato inv\xE1lidos.")
    };
  }
  await saveContact(result.data);
  return {
    status: 200,
    body: {
      success: true,
      message: "Mensagem enviada com sucesso! Entraremos em contato em breve."
    }
  };
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

// src/controllers/contato.controller.ts
var CONTATO_BODY_LIMIT_BYTES = 8 * 1024;
async function postContato(c) {
  try {
    const body = await readJsonBody(c, CONTATO_BODY_LIMIT_BYTES);
    const result = await processContact(body);
    return c.json(result.body, result.status);
  } catch (e) {
    if (e instanceof HttpError) {
      return c.json(errorBody(e.message), e.status);
    }
    return c.json(errorBody("Erro ao processar a mensagem."), 500);
  }
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

// src/routes/contato.routes.ts
var contatoRoutes = new Hono();
contatoRoutes.post("/", rateLimit({ maxRequests: 10, windowMs: 6e4 }), postContato);
var contato_routes_default = contatoRoutes;

// src/routes/formulario.routes.ts
import { Hono as Hono2 } from "hono";

// src/repositories/formulario.repository.ts
async function saveFormularioData(data) {
  if (hasPostgresConfig()) {
    const result2 = await queryPostgres(
      "INSERT INTO formularios (payload_json) VALUES ($1::jsonb) RETURNING id",
      [JSON.stringify(data)]
    );
    return Number(result2.rows[0]?.id);
  }
  const database2 = getDatabase();
  const result = database2.prepare("INSERT INTO formularios (payload_json) VALUES (?)").run(JSON.stringify(data));
  return Number(result.lastInsertRowid);
}
async function getFormularioData() {
  if (hasPostgresConfig()) {
    const result = await queryPostgres(
      "SELECT payload_json FROM formularios ORDER BY id DESC LIMIT 1"
    );
    const row2 = result.rows[0];
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

// src/schemas/formulario.schema.ts
import { z as z3 } from "zod";
var safeText = (field, max) => z3.string({ error: `${field} deve ser texto.` }).trim().max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitido.`).transform(sanitizeText);
var optionalText = (field, max) => safeText(field, max).optional().default("");
var requiredText = (field, min, max) => z3.string({ error: `${field} deve ser texto.` }).trim().min(min, `${field} \xE9 obrigat\xF3rio.`).max(max, `${field} excede o tamanho m\xE1ximo.`).refine((value) => !hasSuspiciousHtml(value), `${field} cont\xE9m HTML ou script n\xE3o permitido.`).transform(sanitizeText);
var emailField = z3.string({ error: "E-mail deve ser texto." }).trim().max(254, "E-mail excede o tamanho m\xE1ximo.").refine((value) => value === "" || z3.email().safeParse(value).success, "E-mail inv\xE1lido.").refine((value) => !hasSuspiciousHtml(value), "E-mail cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText).optional().default("");
var urlField = z3.string({ error: "URL deve ser texto." }).trim().max(300, "URL excede o tamanho m\xE1ximo.").refine((value) => value === "" || z3.url().safeParse(value).success, "URL inv\xE1lida.").refine((value) => !hasSuspiciousHtml(value), "URL cont\xE9m conte\xFAdo n\xE3o permitido.").transform(sanitizeText).optional().default("");
var cursoSchema = z3.object({
  nome: requiredText("Nome do curso", 1, 120),
  idade: optionalText("Faixa et\xE1ria", 60),
  descricao: optionalText("Descri\xE7\xE3o do curso", 800),
  turno: optionalText("Turno", 80)
}).strip();
var professorSchema = z3.object({
  nome: requiredText("Nome do professor", 1, 120),
  cargo: optionalText("Cargo do professor", 160),
  bio: optionalText("Biografia do professor", 800)
}).strip();
var depoimentoSchema = z3.object({
  nome: requiredText("Nome do depoimento", 1, 120),
  relacao: optionalText("Rela\xE7\xE3o do depoimento", 120),
  texto: optionalText("Texto do depoimento", 1e3)
}).strip();
var eventoSchema = z3.object({
  titulo: requiredText("T\xEDtulo do evento", 1, 160),
  data: optionalText("Data do evento", 80),
  tipo: optionalText("Tipo do evento", 60),
  descricao: optionalText("Descri\xE7\xE3o do evento", 800)
}).strip();
var formularioSchema = z3.object({
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
  niveis_ensino: z3.array(safeText("N\xEDvel de ensino", 80)).max(20, "Muitos n\xEDveis de ensino.").optional().default([]),
  cursos: z3.array(cursoSchema).max(20, "Muitos cursos informados.").optional().default([]),
  professores: z3.array(professorSchema).max(50, "Muitos professores informados.").optional().default([]),
  depoimentos: z3.array(depoimentoSchema).max(30, "Muitos depoimentos informados.").optional().default([]),
  eventos: z3.array(eventoSchema).max(50, "Muitos eventos informados.").optional().default([])
}).strip();

// src/services/formulario.service.ts
async function saveFormulario(payload) {
  const result = formularioSchema.safeParse(payload);
  if (!result.success) {
    return {
      status: 400,
      body: errorBody("Dados do formul\xE1rio inv\xE1lidos.")
    };
  }
  await saveFormularioData(result.data);
  return {
    status: 200,
    body: { success: true, message: "Dados salvos com sucesso!" }
  };
}
async function findFormulario() {
  return { data: await getFormularioData() };
}

// src/controllers/formulario.controller.ts
var FORMULARIO_BODY_LIMIT_BYTES = 32 * 1024;
async function postFormulario(c) {
  try {
    const body = await readJsonBody(c, FORMULARIO_BODY_LIMIT_BYTES);
    const result = await saveFormulario(body);
    return c.json(result.body, result.status);
  } catch (e) {
    if (e instanceof HttpError) {
      return c.json(errorBody(e.message), e.status);
    }
    return c.json(errorBody("Erro ao salvar dados."), 500);
  }
}
async function getFormulario(c) {
  return c.json(await findFormulario());
}

// src/routes/formulario.routes.ts
var formularioRoutes = new Hono2();
formularioRoutes.post("/", rateLimit({ maxRequests: 10, windowMs: 6e4 }), postFormulario);
formularioRoutes.get("/", getFormulario);
var formulario_routes_default = formularioRoutes;

// src/routes/health.routes.ts
import { Hono as Hono3 } from "hono";

// src/controllers/health.controller.ts
function getHealth(c) {
  return c.json({ status: "ok" }, 200);
}

// src/routes/health.routes.ts
var healthRoutes = new Hono3();
healthRoutes.get("/", getHealth);
var health_routes_default = healthRoutes;

// src/routes/pages.routes.ts
import { Hono as Hono4 } from "hono";

// src/views/formulario.ts
function renderFormularioPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Personalize o Site da Sua Escola</title>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="/styles/tailwind.css" rel="stylesheet">
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
<body class="bg-gray-50 min-h-screen">

    <!-- Header -->
    <div class="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-8 px-4">
        <div class="max-w-4xl mx-auto text-center">
            <div class="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20">
                <i class="fas fa-wand-magic-sparkles text-3xl text-yellow-400"></i>
            </div>
            <h1 class="text-3xl lg:text-4xl font-bold mb-3">Personalize o Site da Sua Escola</h1>
            <p class="text-white/70 text-lg max-w-2xl mx-auto">
                Preencha as informacoes abaixo para que eu possa criar um site 100% personalizado para sua escola. Quanto mais detalhes, melhor!
            </p>
        </div>
    </div>

    <!-- Progress Bar -->
    <div class="sticky top-0 z-40 bg-white shadow-sm border-b">
        <div class="max-w-4xl mx-auto px-4 py-4">
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
    <div id="form-container" class="max-w-4xl mx-auto px-4 py-8">
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
function renderHomePage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <!-- ============================================
    META TAGS - SEO e Configura\xE7\xF5es B\xE1sicas
    ============================================ -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Escola Estadual do Cariri - EEC | Ensino T\xE9cnico de Excel\xEAncia</title>
    <meta name="description" content="Escola Estadual do Cariri (EEC) - Transforma vidas com ensino t\xE9cnico e fundamental de qualidade.">
   
    <!-- ============================================
    CDN SCRIPTS & STYLES
    ============================================ -->
   
    <!-- Font Awesome - Biblioteca de \xEDcones -->
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
   
    <!-- Google Fonts - Tipografia personalizada -->
    <!-- Poppins: Fonte principal (corpo do texto) -->
    <!-- Playfair Display: Fonte decorativa (t\xEDtulos) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
   
    <!-- AOS - Animate On Scroll Library -->
    <link href="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css" rel="stylesheet">
   
    <link href="/styles/tailwind.css" rel="stylesheet">
    <!-- Estilos CSS customizados (anima\xE7\xF5es, scrollbar, cards, etc.) -->
    <link href="/static/styles.css" rel="stylesheet">
</head>

<!-- ============================================
BODY - Corpo da P\xE1gina
============================================
Classes Tailwind aplicadas:
- font-poppins: Fonte Poppins como padr\xE3o
- bg-white: Fundo branco
- text-gray-800: Texto cinza escuro
- overflow-x-hidden: Esconde scroll horizontal
============================================ -->
<body class="font-poppins bg-white text-gray-800 overflow-x-hidden">

    <!-- ============================================
    PRELOADER - Tela de Carregamento Inicial
    ============================================
    Exibido enquanto a p\xE1gina carrega
    Ocultado ap\xF3s 1.5 segundos via JavaScript (app.js)
   
    Estrutura:
    - Container fixo que cobre toda a tela (z-index: 9999)
    - \xCDcone de formatura animado (bounce)
    - 3 c\xEDrculos pulsando (loading indicator)
    - Texto "Carregando..."
    ============================================ -->
    <div id="preloader" class="fixed inset-0 z-[9999] bg-school-navy flex items-center justify-center transition-opacity duration-700">
        <div class="text-center">
            <!-- \xCDcone de formatura com anima\xE7\xE3o de bounce -->
            <div class="preloader-logo mb-6">
                <i class="fas fa-graduation-cap text-6xl text-school-gold animate-bounce"></i>
            </div>
            <!-- Indicador de loading: 3 c\xEDrculos pulsando com delay -->
            <div class="flex space-x-2 justify-center">
                <div class="w-3 h-3 rounded-full bg-school-sky animate-pulse" style="animation-delay: 0s"></div>
                <div class="w-3 h-3 rounded-full bg-school-gold animate-pulse" style="animation-delay: 0.2s"></div>
                <div class="w-3 h-3 rounded-full bg-school-emerald animate-pulse" style="animation-delay: 0.4s"></div>
            </div>
            <!-- Texto de carregamento -->
            <p class="text-white/70 mt-4 text-sm tracking-widest uppercase">Carregando...</p>
        </div>
    </div>

    <!-- ============================================
    NAVBAR - Barra de Navega\xE7\xE3o Fixa
    ============================================
    Comportamento:
    - Fixa no topo (fixed top-0)
    - z-index 50 para ficar acima do conte\xFAdo
    - Muda de transparente para s\xF3lida ao rolar (via JS)
   
    Componentes:
    - Logo com \xEDcone e nome da escola
    - Menu Desktop (vis\xEDvel em md:)
    - Bot\xE3o hamburguer para mobile
    - Menu Mobile (toggle via JS)
    ============================================ -->
    <nav id="navbar" class="fixed top-0 left-0 right-0 z-50 transition-all duration-500">
        <!-- Container centralizado com padding responsivo -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Flexbox: logo \xE0 esquerda, menu \xE0 direita -->
            <div class="flex items-center justify-between h-20">
               
                <!-- ===== LOGO ===== -->
                <!-- Clic\xE1vel, leva ao in\xEDcio da p\xE1gina -->
                <a href="#inicio" class="flex items-center space-x-3 group">
                    <!-- \xCDcone quadrado com gradiente dourado -->
                    <div class="w-12 h-12 bg-gradient-to-br from-school-gold to-warm-500 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-lg">
                        <i class="fas fa-graduation-cap text-white text-xl"></i>
                    </div>
                    <!-- Texto do logo -->
                    <div>
                        <span class="text-xl font-bold text-white group-hover:text-school-gold transition-colors">EEC</span>
                        <span class="block text-[10px] text-white/60 uppercase tracking-[3px]">Escola Estadual do Cariri</span>
                    </div>
                </a>
               
                <!-- ===== MENU DESKTOP ===== -->
                <!-- Vis\xEDvel apenas em telas m\xE9dias e maiores (md:flex) -->
                <div class="hidden md:flex items-center space-x-8">
                    <!-- Link ativo (In\xEDcio) - estilo diferenciado -->
                    <a href="#inicio" class="nav-link px-4 py-2 rounded-lg text-white font-semibold hover:bg-white/10 transition-all duration-300 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-0.5 after:bg-school-gold after:transition-all hover:after:w-full">In\xEDcio</a>
                    <!-- Links de navega\xE7\xE3o principais -->
                    <a href="#sobre" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Sobre</a>
                    <a href="#cursos" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Cursos</a>
                    <a href="#professores" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Equipe</a>
                    <a href="#eventos" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Eventos</a>
                    <a href="#diferenciais" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Diferenciais</a>
                    <!-- Bot\xE3o CTA (Call to Action) - Matricule-se -->
                    <a href="#contato" class="ml-4 px-6 py-2.5 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-school-gold/30 transform hover:-translate-y-0.5 transition-all duration-300">
                        <i class="fas fa-phone mr-2"></i>Matricule-se
                    </a>
                </div>
               
                <!-- ===== BOT\xC3O MENU MOBILE (Hamburger) ===== -->
                <!-- Vis\xEDvel apenas em telas pequenas (lg:hidden) -->
                <!-- Controlado via JavaScript para toggle do menu -->
                <button id="mobile-menu-btn" class="lg:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <i class="fas fa-bars text-xl"></i>
                </button>
            </div>
        </div>
       
        <!-- ===== MENU MOBILE ===== -->
        <!-- Inicialmente oculto (hidden), toggle via JS -->
        <!-- Aparece abaixo da navbar com blur e transpar\xEAncia -->
        <div id="mobile-menu" class="lg:hidden hidden bg-school-navy/98 backdrop-blur-xl border-t border-white/10">
            <div class="px-4 py-6 space-y-2">
                <!-- Links de navega\xE7\xE3o em formato de lista vertical -->
                <a href="#inicio" class="block px-4 py-3 text-white font-semibold bg-white/10 rounded-lg">In\xEDcio</a>
                <a href="#sobre" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Sobre</a>
                <a href="#cursos" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Cursos</a>
                <a href="#professores" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Equipe</a>
                <a href="#eventos" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Eventos</a>
                <a href="#diferenciais" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Diferenciais</a>
                <!-- Bot\xE3o CTA centralizado -->
                <a href="#contato" class="block mt-4 text-center px-6 py-3 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-full font-semibold">
                    <i class="fas fa-phone mr-2"></i>Matricule-se
                </a>
            </div>
        </div>
    </nav>

    <!-- ============================================
    HERO SECTION - Slideshow Principal
    ============================================
    Se\xE7\xE3o de destaque na p\xE1gina inicial
   
    Caracter\xEDsticas:
    - Tela cheia (min-h-screen)
    - Background com gradiente azul escuro
    - Part\xEDculas animadas (decora\xE7\xE3o sutil)
    - Formas geom\xE9tricas com blur (decora\xE7\xE3o)
    - Padr\xE3o de grid pontilhado (decora\xE7\xE3o)
    - Slideshow com 4 slides (controle via JS)
   
    Slides:
    1. Educa\xE7\xE3o que Transforma
    2. Ensino T\xE9cnico Profissionalizante
    3. Tecnologia e Inova\xE7\xE3o
    4. Nossa Comunidade
    ============================================ -->
    <section id="inicio" class="relative min-h-screen flex items-center overflow-hidden">
       
        <!-- ===== BACKGROUND ===== -->
        <!-- Gradiente diagonal do azul navy para tons mais escuros -->
        <div class="absolute inset-0 bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333]"></div>
       
        <!-- ===== PART\xCDCULAS ANIMADAS ===== -->
        <!-- C\xEDrculos pequenos que flutuam ao fundo (estilizados no CSS) -->
        <div class="absolute inset-0 overflow-hidden">
            <div class="particle particle-1"></div>
            <div class="particle particle-2"></div>
            <div class="particle particle-3"></div>
            <div class="particle particle-4"></div>
            <div class="particle particle-5"></div>
            <div class="particle particle-6"></div>
        </div>
       
        <!-- ===== FORMAS GEOM\xC9TRICAS DECORATIVAS ===== -->
        <!-- C\xEDrculos grandes com blur que pulsam sutilmente -->
        <div class="absolute top-20 right-10 w-72 h-72 bg-school-gold/5 rounded-full blur-3xl animate-pulse"></div>
        <div class="absolute bottom-20 left-10 w-96 h-96 bg-school-sky/5 rounded-full blur-3xl animate-pulse" style="animation-delay: 2s"></div>
        <div class="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-accent-500/3 rounded-full blur-3xl animate-pulse" style="animation-delay: 4s"></div>
       
        <!-- ===== PADR\xC3O DE GRID PONTILHADO ===== -->
        <!-- Grade de pontos sutis para profundidade visual -->
        <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 50px 50px;"></div>
       
        <!-- ===== CONTE\xDADO DO HERO ===== -->
        <div class="relative z-10 w-full h-full min-h-screen flex items-center">
           
            <!-- ===== CONTAINER DO SLIDESHOW ===== -->
            <!-- Gerenciado via initHeroSlider() em app.js -->
            <!-- Cada slide tem opacity e z-index controlados dinamicamente -->
            <div id="hero-slider" class="relative w-full" style="min-height: calc(100vh - 80px)">
               
                <!-- ================================================================
                SLIDE 1: EDUCA\xC7\xC3O QUE TRANSFORMA
                ================================================================
                Slide inicial vis\xEDvel por padr\xE3o (opacity: 1, z-index: 10)
                Estrutura: Grid 2 colunas (texto \xE0 esquerda, visual \xE0 direita)
                ================================================================ -->
                <div class="hero-slide" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; align-items: center; opacity: 1; z-index: 10; transition: opacity 1s ease-in-out, transform 1s ease-in-out;">
                    <div class="grid lg:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                       
                        <!-- ===== COLUNA ESQUERDA: TEXTO ===== -->
                        <div>
                            <!-- Badge: Matr\xEDculas Abertas -->
                            <div class="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-8">
                                <span class="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse"></span>
                                <span class="text-white text-sm font-medium tracking-wide">Matr\xEDculas Abertas 2026</span>
                            </div>
                            <!-- T\xEDtulo principal com gradiente -->
                            <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                                Educa\xE7\xE3o que
                                <span class="block mt-2 bg-gradient-to-r from-school-gold via-warm-400 to-school-coral bg-clip-text text-transparent">Transforma</span>
                                <span class="block text-3xl sm:text-4xl lg:text-5xl mt-2 font-light text-white/70">Vidas e Futuros</span>
                            </h1>
                            <!-- Descri\xE7\xE3o -->
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                H\xE1 mais de 28 anos formando cidad\xE3os criativos, cr\xEDticos e preparados para os desafios do s\xE9culo XXI.
                            </p>
                            <!-- Bot\xF5es de a\xE7\xE3o -->
                            <div class="flex flex-wrap gap-4">
                                <!-- Bot\xE3o prim\xE1rio: Agende uma Visita -->
                                <a href="#contato" class="px-8 py-4 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-school-gold/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Agende uma Visita <i class="fas fa-arrow-right ml-2"></i>
                                </a>
                                <!-- Bot\xE3o secund\xE1rio: Conhe\xE7a a Escola -->
                                <a href="#sobre" class="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-bold text-lg hover:bg-white/20 backdrop-blur-sm transition-all duration-300 flex items-center">
                                    <div class="w-8 h-8 rounded-full bg-white text-school-navy flex items-center justify-center mr-3 text-xs"><i class="fas fa-play"></i></div>
                                    Conhe\xE7a a Escola
                                </a>
                            </div>
                        </div>
                       
                        <!-- Visual 1 -->
                        <div class="hidden lg:block relative">
                            <div class="absolute -top-10 -right-10 w-64 h-64 bg-school-gold/20 rounded-full blur-3xl animate-pulse"></div>
                           
                            <!-- Card Flutuante: +1250 Alunos (posicionado \xE0 ESQUERDA do grid, acima) -->
                            <div class="absolute -top-8 left-0 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-xl flex items-center space-x-3 animate-float z-20">
                                <div class="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                                    <i class="fas fa-users text-sm"></i>
                                </div>
                                <div>
                                    <p class="text-white font-bold text-sm">+1250</p>
                                    <p class="text-white/60 text-xs">Alunos Felizes</p>
                                </div>
                            </div>
                           
                            <!-- Badge: Nota 9.8 MEC (posicionado \xE0 DIREITA do grid, acima, SEM sobreposi\xE7\xE3o) -->
                            <div class="absolute -top-6 right-0 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 rounded-full shadow-xl flex items-center space-x-2 animate-float z-20" style="animation-delay: 0.5s;">
                                <i class="fas fa-star text-yellow-300 text-sm"></i>
                                <span class="text-white font-bold text-sm">Nota 9.8 MEC</span>
                            </div>
                           
                            <div class="hero-card bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-6 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-school-gold transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-brain text-4xl text-school-gold mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Pensamento Cr\xEDtico</p>
                                    </div>
                                    <div class="p-6 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-school-sky transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-robot text-4xl text-school-sky mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Tecnologia</p>
                                    </div>
                                    <div class="p-6 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-school-emerald transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-palette text-4xl text-school-emerald mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Criatividade</p>
                                    </div>
                                    <div class="p-6 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-school-coral transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-heart text-4xl text-school-coral mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Empatia</p>
                                    </div>
                                </div>
                               
                                <!-- Card Flutuante: Pr\xEAmio Escola Transforma\xE7\xE3o (canto inferior ESQUERDO) -->
                                <div class="absolute -bottom-6 -left-6 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl flex items-center space-x-4 animate-float">
                                    <div class="w-12 h-12 rounded-full bg-gradient-to-r from-school-gold to-warm-500 flex items-center justify-center text-white shadow-lg">
                                        <i class="fas fa-trophy text-xl"></i>
                                    </div>
                                    <div>
                                        <p class="text-white font-bold text-sm">Pr\xEAmio Escola Transforma\xE7\xE3o</p>
                                        <p class="text-white/60 text-xs">Ensino Fundamental II - EFTI</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================================================================
                SLIDE 2: ENSINO T\xC9CNICO PROFISSIONALIZANTE
                ================================================================
                Oculto por padr\xE3o (opacity: 0, pointer-events: none)
                Foco: Cursos t\xE9cnicos e prepara\xE7\xE3o para o mercado
                ================================================================ -->
                <div class="hero-slide" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; align-items: center; opacity: 0; z-index: 0; pointer-events: none; transition: opacity 1s ease-in-out, transform 1s ease-in-out;">
                    <div class="grid lg:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <!-- Coluna de texto -->
                        <div>
                            <!-- Badge azul: Carreira & Futuro -->
                            <div class="inline-flex items-center px-4 py-2 bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full mb-8">
                                <span class="w-2 h-2 bg-blue-400 rounded-full mr-3 animate-pulse"></span>
                                <span class="text-white text-sm font-medium tracking-wide">Carreira & Futuro</span>
                            </div>
                            <!-- T\xEDtulo com gradiente azul/roxo -->
                            <h1 class="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6">
                                Ensino T\xE9cnico
                                <span class="block mt-2 text-2xl sm:text-3xl lg:text-5xl xl:text-6xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Profissionalizante</span>
                                <span class="block text-xl sm:text-2xl lg:text-4xl xl:text-5xl mt-2 font-light text-white/70">Escola Estadual do Cariri</span>
                            </h1>
                            <!-- Descri\xE7\xE3o do slide -->
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Forma\xE7\xE3o t\xE9cnica de excel\xEAncia conectada ao mercado. Laborat\xF3rios modernos e certifica\xE7\xE3o reconhecida.
                            </p>
                            <!-- CTA: Conhe\xE7a os Cursos -->
                            <div class="flex flex-wrap gap-4">
                                <a href="#cursos" class="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-blue-600/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Conhe\xE7a os Cursos <i class="fas fa-arrow-right ml-2"></i>
                                </a>
                            </div>
                        </div>
                       
                        <!-- Coluna visual: Cards de recursos -->
                        <div class="hidden lg:block relative">
                            <!-- Forma decorativa com blur -->
                            <div class="absolute -top-10 -right-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                            <!-- Card principal com grid de recursos -->
                            <div class="hero-card bg-gradient-to-br from-blue-900/40 to-indigo-900/40 backdrop-blur-xl rounded-3xl p-8 border border-blue-500/20 shadow-2xl relative">
                                <div class="grid grid-cols-2 gap-4">
                                    <!-- Card: Mercado -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-blue-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-briefcase text-4xl text-blue-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Mercado</p>
                                    </div>
                                    <!-- Card: Certifica\xE7\xE3o -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-indigo-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-certificate text-4xl text-indigo-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Certifica\xE7\xE3o</p>
                                    </div>
                                    <!-- Card: Laborat\xF3rios -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-purple-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-flask text-4xl text-purple-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Laborat\xF3rios</p>
                                    </div>
                                    <!-- Card: Inova\xE7\xE3o -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-cyan-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-rocket text-4xl text-cyan-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Inova\xE7\xE3o</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================================================================
                SLIDE 3: ENSINO M\xC9DIO T\xC9CNICO INTEGRADO
                ================================================================
                Oculto por padr\xE3o (opacity: 0, pointer-events: none)
                Foco: Forma\xE7\xE3o integral com teoria e pr\xE1tica
                ================================================================ -->
                <div class="hero-slide" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; align-items: center; opacity: 0; z-index: 0; pointer-events: none; transition: opacity 1s ease-in-out, transform 1s ease-in-out;">
                    <div class="grid lg:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <!-- Coluna de texto -->
                        <div>
                            <!-- Badge roxo: Ensino Integral -->
                            <div class="inline-flex items-center px-4 py-2 bg-purple-500/20 backdrop-blur-md border border-purple-400/30 rounded-full mb-8">
                                <span class="w-2 h-2 bg-purple-400 rounded-full mr-3 animate-pulse"></span>
                                <span class="text-white text-sm font-medium tracking-wide">Ensino Integral</span>
                            </div>
                            <!-- T\xEDtulo com gradiente roxo/rosa -->
                            <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                                Ensino M\xE9dio
                                <span class="block mt-2 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">T\xE9cnico Integrado</span>
                                <span class="block text-3xl sm:text-4xl lg:text-5xl mt-2 font-light text-white/70">Teoria e Pr\xE1tica</span>
                            </h1>
                            <!-- Descri\xE7\xE3o do slide -->
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Prepara\xE7\xE3o para o ENEM e forma\xE7\xE3o profissional em um \xFAnico curso. O caminho completo para o seu sucesso.
                            </p>
                            <div class="flex flex-wrap gap-4">
                                <a href="#diferenciais" class="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-purple-600/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Saiba Mais <i class="fas fa-plus ml-2"></i>
                                </a>
                            </div>
                        </div>
                       
                        <div class="hidden lg:block relative">
                             <div class="absolute -top-10 -right-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
                            <div class="hero-card bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/20 shadow-2xl relative">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-purple-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-graduation-cap text-4xl text-purple-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Foco no ENEM</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-pink-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-laptop-code text-4xl text-pink-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">T\xE9cnico</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-fuchsia-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-clock text-4xl text-fuchsia-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Integral</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-rose-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-book-open text-4xl text-rose-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Excel\xEAncia</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SLIDE 4: FUNDAMENTAL II -->
                <div class="hero-slide" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; align-items: center; opacity: 0; z-index: 0; pointer-events: none; transition: opacity 1s ease-in-out, transform 1s ease-in-out;">
                    <div class="grid lg:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div>
                            <div class="inline-flex items-center px-4 py-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 rounded-full mb-8">
                                <span class="w-2 h-2 bg-emerald-400 rounded-full mr-3 animate-pulse"></span>
                                <span class="text-white text-sm font-medium tracking-wide">6\xBA ao 9\xBA Ano</span>
                            </div>
                            <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                                Ensino
                                <span class="block mt-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Fundamental II</span>
                                <span class="block text-3xl sm:text-4xl lg:text-5xl mt-2 font-light text-white/70">Forma\xE7\xE3o Completa</span>
                            </h1>
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Base s\xF3lida e aprendizado integral. Projetos interdisciplinares e acompanhamento pr\xF3ximo para o desenvolvimento do seu filho.
                            </p>
                            <div class="flex flex-wrap gap-4">
                                <a href="#pedagogico" class="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-600/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Conhe\xE7a a Proposta <i class="fas fa-arrow-right ml-2"></i>
                                </a>
                            </div>
                        </div>
                       
                        <div class="hidden lg:block relative">
                             <div class="absolute -top-10 -right-10 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
                            <div class="hero-card bg-gradient-to-br from-emerald-900/40 to-teal-900/40 backdrop-blur-xl rounded-3xl p-8 border border-emerald-500/20 shadow-2xl relative">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-emerald-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-hands-helping text-4xl text-emerald-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Acolhimento</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-teal-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-layer-group text-4xl text-teal-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Base Forte</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-green-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-seedling text-4xl text-green-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Crescimento</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-cyan-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-project-diagram text-4xl text-cyan-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Projetos</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
               
            </div>
        </div>
       
        <!-- ===== INDICADOR DE SCROLL ===== -->
        <!-- Mouse animado indicando que pode rolar para baixo -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
            <div class="scroll-indicator">
                <div class="mouse">
                    <div class="wheel"></div>
                </div>
                <p class="text-white/40 text-xs mt-3 tracking-widest uppercase">Role para baixo</p>
            </div>
        </div>
    </section>

    <!-- ============================================
    SE\xC7\xC3O SOBRE - Quem Somos
    ============================================
    Apresenta a hist\xF3ria e valores da escola
   
    Estrutura:
    - Header com badge e t\xEDtulo
    - Grid 2 colunas: Visual (esquerda), Texto (direita)
    - Cards com valores: Inova\xE7\xE3o, Acolhimento, Excel\xEAncia, Comunidade
    - Contadores de estat\xEDsticas
    - Linha do tempo da hist\xF3ria da escola
    ============================================ -->
    <section id="sobre" class="py-24 bg-white relative overflow-hidden">
       
        <!-- ===== DECORA\xC7\xD5ES DE FUNDO ===== -->
        <div class="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-50 to-transparent"></div>
        <div class="absolute bottom-0 left-0 w-64 h-64 bg-school-gold/5 rounded-full -translate-x-1/2 translate-y-1/2"></div>
       
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
           
            <!-- ===== HEADER DA SE\xC7\xC3O ===== -->
            <div class="text-center mb-16">
                <!-- Badge superior -->
                <div class="inline-flex items-center px-4 py-2 bg-primary-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-school text-primary-500 mr-2"></i>
                    <span class="text-primary-600 text-sm font-semibold">Quem Somos</span>
                </div>
                <!-- T\xEDtulo com destaque em gradiente -->
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Uma Escola com <span class="bg-gradient-to-r from-school-gold to-warm-500 bg-clip-text text-transparent">Alma</span>
                </h2>
                <!-- Subt\xEDtulo descritivo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Somos mais que uma institui\xE7\xE3o de ensino. Somos uma comunidade que acredita no potencial \xFAnico de cada estudante.
                </p>
            </div>
           
            <div class="grid lg:grid-cols-2 gap-16 items-center">
               
                <!-- ===== COLUNA ESQUERDA: CARDS VISUAIS ===== -->
                <div class="relative" data-aos="fade-right">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Primeira coluna de cards -->
                        <div class="space-y-4">
                            <!-- Card: Inova\xE7\xE3o -->
                            <div class="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-8 text-white shadow-xl shadow-primary-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-lightbulb text-4xl mb-4 text-school-gold"></i>
                                <h4 class="font-bold text-lg mb-2">Inova\xE7\xE3o</h4>
                                <p class="text-white/80 text-sm">Metodologias ativas e tecnologia educacional de ponta.</p>
                            </div>
                            <!-- Card: Acolhimento -->
                            <div class="bg-gradient-to-br from-school-emerald to-emerald-700 rounded-3xl p-8 text-white shadow-xl shadow-emerald-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-hands-holding-child text-4xl mb-4"></i>
                                <h4 class="font-bold text-lg mb-2">Acolhimento</h4>
                                <p class="text-white/80 text-sm">Ambiente seguro e acolhedor para todos os alunos.</p>
                            </div>
                        </div>
                        <!-- Segunda coluna de cards (offset) -->
                        <div class="space-y-4 mt-8">
                            <!-- Card: Excel\xEAncia -->
                            <div class="bg-gradient-to-br from-school-gold to-warm-600 rounded-3xl p-8 text-white shadow-xl shadow-warm-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-award text-4xl mb-4"></i>
                                <h4 class="font-bold text-lg mb-2">Excel\xEAncia</h4>
                                <p class="text-white/80 text-sm">28 anos de resultados excepcionais em educa\xE7\xE3o.</p>
                            </div>
                            <!-- Card: Comunidade -->
                            <div class="bg-gradient-to-br from-school-coral to-rose-700 rounded-3xl p-8 text-white shadow-xl shadow-rose-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-globe text-4xl mb-4"></i>
                                <h4 class="font-bold text-lg mb-2">Vis\xE3o Global</h4>
                                <p class="text-white/80 text-sm">Preparamos cidad\xE3os para um mundo globalizado.</p>
                            </div>
                        </div>
                    </div>
                </div>
               
                <!-- Right - Content -->
                <div data-aos="fade-left">
                    <h3 class="text-3xl font-bold text-school-navy mb-6">
                        Construindo o futuro, <br>um aluno de cada vez
                    </h3>
                    <p class="text-gray-600 mb-6 leading-relaxed">
                        A Escola Estadual do Cariri (EEC) nasceu do compromisso de oferecer educa\xE7\xE3o p\xFAblica de excel\xEAncia integrada ao ensino profissionalizante. Refer\xEAncia na regi\xE3o, formamos jovens preparados para os desafios do mercado de trabalho.
                    </p>
                    <p class="text-gray-600 mb-8 leading-relaxed">
                        Nossa proposta pedag\xF3gica une a base do <strong class="text-school-navy">Ensino Fundamental II</strong> com a inova\xE7\xE3o do <strong class="text-school-navy">Ensino T\xE9cnico</strong>, proporcionando uma forma\xE7\xE3o integral que valoriza tanto o conhecimento acad\xEAmico quanto as compet\xEAncias pr\xE1ticas.
                    </p>
                   
                    <!-- Features List -->
                    <div class="space-y-4 mb-8">
                        <div class="flex items-start space-x-4 group">
                            <div class="w-10 h-10 bg-school-emerald/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-emerald group-hover:text-white transition-all duration-300">
                                <i class="fas fa-check text-school-emerald group-hover:text-white"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy">Laborat\xF3rios de \xDAltima Gera\xE7\xE3o</h5>
                                <p class="text-gray-500 text-sm">Ci\xEAncias, inform\xE1tica, rob\xF3tica e maker space completo.</p>
                            </div>
                        </div>
                        <div class="flex items-start space-x-4 group">
                            <div class="w-10 h-10 bg-school-gold/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-gold group-hover:text-white transition-all duration-300">
                                <i class="fas fa-check text-school-gold group-hover:text-white"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy">Ensino Bil\xEDngue</h5>
                                <p class="text-gray-500 text-sm">Programa de imers\xE3o em ingl\xEAs desde a educa\xE7\xE3o infantil.</p>
                            </div>
                        </div>
                        <div class="flex items-start space-x-4 group">
                            <div class="w-10 h-10 bg-school-sky/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-sky group-hover:text-white transition-all duration-300">
                                <i class="fas fa-check text-school-sky group-hover:text-white"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy">5.000m\xB2 de \xC1rea Verde</h5>
                                <p class="text-gray-500 text-sm">Espa\xE7os ao ar livre para aprendizagem e lazer.</p>
                            </div>
                        </div>
                    </div>
                   
                    <a href="#contato" class="inline-flex items-center px-8 py-4 bg-school-navy text-white rounded-2xl font-semibold hover:bg-school-navy/90 transform hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-school-navy/20">
                        Conhe\xE7a nossa estrutura
                        <i class="fas fa-arrow-right ml-3"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- ============================================
    BARRA DE ESTAT\xCDSTICAS
    ============================================
    Faixa com contadores animados
   
    Dados:
    - Alunos Matriculados: 1250
    - Professores Qualificados: 85
    - Aprova\xE7\xE3o Vestibular: 97%
    - Anos de Experi\xEAncia: 28
   
    Os contadores s\xE3o animados via JavaScript (Intersection Observer)
    quando a se\xE7\xE3o entra na viewport
    ============================================ -->
    <section class="py-16 bg-gradient-to-r from-school-navy via-[#162464] to-school-navy relative overflow-hidden">
        <!-- Padr\xE3o de pontos decorativo -->
        <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 30px 30px;"></div>
       
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
               
                <!-- Contador: Alunos Matriculados -->
                <div class="text-center" data-aos="zoom-in" data-aos-delay="0">
                    <div class="text-4xl lg:text-5xl font-bold text-school-gold mb-2 counter-stat" data-target="1250">0</div>
                    <div class="text-white/60 text-sm uppercase tracking-wider">Alunos Matriculados</div>
                </div>
               
                <!-- Contador: Professores Qualificados -->
                <div class="text-center" data-aos="zoom-in" data-aos-delay="100">
                    <div class="text-4xl lg:text-5xl font-bold text-school-sky mb-2 counter-stat" data-target="85">0</div>
                    <div class="text-white/60 text-sm uppercase tracking-wider">Professores Qualificados</div>
                </div>
               
                <!-- Contador: Aprova\xE7\xE3o Vestibular (%) -->
                <div class="text-center" data-aos="zoom-in" data-aos-delay="200">
                    <div class="text-4xl lg:text-5xl font-bold text-school-emerald mb-2"><span class="counter-stat" data-target="97">0</span>%</div>
                    <div class="text-white/60 text-sm uppercase tracking-wider">Aprova\xE7\xE3o Vestibular</div>
                </div>
               
                <!-- Contador: Anos de Experi\xEAncia -->
                <div class="text-center" data-aos="zoom-in" data-aos-delay="300">
                    <div class="text-4xl lg:text-5xl font-bold text-school-coral mb-2 counter-stat" data-target="28">0</div>
                    <div class="text-white/60 text-sm uppercase tracking-wider">Anos de Experi\xEAncia</div>
                </div>
            </div>
        </div>
    </section>

    <!-- ============================================
    SE\xC7\xC3O CURSOS - Forma\xE7\xE3o Completa
    ============================================
    Apresenta os cursos oferecidos pela escola
   
    Caracter\xEDsticas:
    - Header com badge e t\xEDtulo
    - Grid responsivo (1/2/3 colunas)
    - Cards carregados dinamicamente via API
    - Skeleton loading enquanto carrega
   
    Dados via: GET /api/cursos
    ============================================ -->
    <section id="cursos" class="py-24 bg-gray-50 relative overflow-hidden">
        <!-- Linha decorativa superior -->
        <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-school-gold/30 to-transparent"></div>
       
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           
            <!-- ===== HEADER DA SE\xC7\xC3O ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Nossos Cursos -->
                <div class="inline-flex items-center px-4 py-2 bg-warm-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-book-open text-warm-500 mr-2"></i>
                    <span class="text-warm-600 text-sm font-semibold">Nossos Cursos</span>
                </div>
                <!-- T\xEDtulo com gradiente -->
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Forma\xE7\xE3o <span class="bg-gradient-to-r from-school-sky to-primary-600 bg-clip-text text-transparent">Completa</span>
                </h2>
                <!-- Subt\xEDtulo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Da educa\xE7\xE3o infantil ao ensino m\xE9dio, oferecemos uma jornada educacional completa e personalizada.
                </p>
            </div>
           
            <!-- ===== GRID DE CURSOS ===== -->
            <!-- Populado dinamicamente via loadCursos() em app.js -->
            <!-- Usa skeleton loading enquanto aguarda dados da API -->
            <div id="cursos-grid" class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Cards ser\xE3o carregados dinamicamente via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SE\xC7\xC3O PROFESSORES - Nossa Equipe
    ============================================
    Apresenta a equipe docente da escola
   
    Caracter\xEDsticas:
    - Header com badge e t\xEDtulo
    - Grid responsivo de cards
    - Avatares com iniciais e cores personalizadas
    - Informa\xE7\xF5es de contato e redes sociais
   
    Dados via: GET /api/professores
    ============================================ -->
    <section id="professores" class="py-24 bg-white relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Section Header -->
            <div class="text-center mb-16">
                <div class="inline-flex items-center px-4 py-2 bg-green-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-chalkboard-user text-emerald-500 mr-2"></i>
                    <span class="text-emerald-600 text-sm font-semibold">Nossa Equipe</span>
                </div>
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Professores <span class="bg-gradient-to-r from-school-emerald to-emerald-600 bg-clip-text text-transparent">Inspiradores</span>
                </h2>
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Uma equipe apaixonada por educa\xE7\xE3o, dedicada a transformar a vida de cada aluno.
                </p>
            </div>
           
            <!-- ===== GRID DE PROFESSORES ===== -->
            <!-- Populado dinamicamente via loadProfessores() em app.js -->
            <div id="professores-grid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Cards ser\xE3o carregados via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SE\xC7\xC3O EVENTOS - Calend\xE1rio Escolar
    ============================================
    Apresenta os pr\xF3ximos eventos da escola
   
    Caracter\xEDsticas:
    - Fundo escuro (azul navy)
    - Grid com 4 colunas
    - Cards de eventos com datas e descri\xE7\xF5es
    - Padr\xE3o de pontos decorativo
   
    Dados via: GET /api/eventos
    ============================================ -->
    <section id="eventos" class="py-24 bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333] relative overflow-hidden">
        <!-- Padr\xE3o de pontos decorativo -->
        <div class="absolute inset-0 opacity-5" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 40px 40px;"></div>
       
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
           
            <!-- ===== HEADER DA SE\xC7\xC3O ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Calend\xE1rio Escolar -->
                <div class="inline-flex items-center px-4 py-2 bg-white/10 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-calendar-star text-school-gold mr-2"></i>
                    <span class="text-white/80 text-sm font-semibold">Calend\xE1rio Escolar</span>
                </div>
                <!-- T\xEDtulo -->
                <h2 class="text-4xl lg:text-5xl font-bold text-white mb-6" data-aos="fade-up" data-aos-delay="100">
                    Pr\xF3ximos <span class="bg-gradient-to-r from-school-gold to-warm-400 bg-clip-text text-transparent">Eventos</span>
                </h2>
                <!-- Subt\xEDtulo -->
                <p class="text-white/50 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Fique por dentro das atividades e eventos que movimentam nossa escola.
                </p>
            </div>
           
            <!-- ===== GRID DE EVENTOS ===== -->
            <!-- Populado dinamicamente via loadEventos() em app.js -->
            <div id="eventos-grid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Ser\xE3o carregados via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SE\xC7\xC3O DIFERENCIAIS - Por que escolher a EEC?
    ============================================
    Apresenta os diferenciais da escola
   
    Caracter\xEDsticas:
    - Fundo cinza claro
    - Grid responsivo de cards
    - \xCDcones e descri\xE7\xF5es
    - Hover effects
   
    Dados via: GET /api/diferenciais
    ============================================ -->
    <section id="diferenciais" class="py-24 bg-gray-50 relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           
            <!-- ===== HEADER DA SE\xC7\xC3O ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Por que escolher a EEC? -->
                <div class="inline-flex items-center px-4 py-2 bg-rose-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-rocket text-rose-500 mr-2"></i>
                    <span class="text-rose-600 text-sm font-semibold">Por que escolher a EEC?</span>
                </div>
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Diferenciais <span class="bg-gradient-to-r from-school-coral to-rose-500 bg-clip-text text-transparent">T\xE9cnicos</span>
                </h2>
                <!-- Subt\xEDtulo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Estrutura completa para potenciar o aprendizado pr\xE1tico e profissional.
                </p>
            </div>
           
            <!-- ===== GRID DE DIFERENCIAIS ===== -->
            <!-- Populado dinamicamente via loadDiferenciais() em app.js -->
            <div id="diferenciais-grid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Ser\xE3o carregados via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SE\xC7\xC3O CONTATO - Fale Conosco
    ============================================
    Formul\xE1rio de contato e informa\xE7\xF5es
   
    Estrutura:
    - Header com badge e t\xEDtulo
    - Grid 5 colunas (2 info + 3 form)
    - Card de informa\xE7\xF5es de contato
    - Formul\xE1rio com valida\xE7\xE3o

    Componentes:
    - Endere\xE7o, telefone, email, hor\xE1rio
    - Links de redes sociais
    - Campos: Nome, Email, Telefone, Mensagem
   
    Submiss\xE3o via: POST /api/contato
    ============================================ -->
    <section id="contato" class="py-24 bg-white relative overflow-hidden">
        <!-- Linha decorativa superior -->
        <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-school-gold/30 to-transparent"></div>
       
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           
            <!-- ===== HEADER DA SE\xC7\xC3O ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Fale Conosco -->
                <div class="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-envelope text-blue-500 mr-2"></i>
                    <span class="text-blue-600 text-sm font-semibold">Fale Conosco</span>
                </div>
                <!-- T\xEDtulo -->
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Entre em <span class="bg-gradient-to-r from-primary-500 to-school-sky bg-clip-text text-transparent">Contato</span>
                </h2>
                <!-- Subt\xEDtulo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Estamos prontos para atender voc\xEA. Agende uma visita e conhe\xE7a nossa escola pessoalmente!
                </p>
            </div>
           
            <div class="grid lg:grid-cols-5 gap-12">
                <!-- Contact Info -->
                <div class="lg:col-span-2 space-y-6" data-aos="fade-right">
                    <div class="bg-gradient-to-br from-school-navy to-[#162464] rounded-3xl p-8 text-white">
                        <h3 class="text-2xl font-bold mb-8">Informa\xE7\xF5es de Contato</h3>
                       
                        <div class="space-y-6">
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-location-dot text-school-gold"></i>
                                </div>
                                <div>
                                    <h5 class="font-semibold mb-1">Endere\xE7o</h5>
                                    <p class="text-white/60 text-sm">Rua da Educa\xE7\xE3o, 1000<br>Bairro Jardim Saber<br>S\xE3o Paulo - SP, 01000-000</p>
                                </div>
                            </div>
                           
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-phone text-school-emerald"></i>
                                </div>
                                <div>
                                    <h5 class="font-semibold mb-1">Telefone</h5>
                                    <p class="text-white/60 text-sm">(11) 3456-7890<br>(11) 98765-4321</p>
                                </div>
                            </div>
                           
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-envelope text-school-sky"></i>
                                </div>
                                <div>
                                    <h5 class="font-semibold mb-1">Email</h5>
                                    <p class="text-white/60 text-sm">contato@colegionovaera.edu.br<br>matriculas@colegionovaera.edu.br</p>
                                </div>
                            </div>
                           
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-clock text-school-coral"></i>
                                </div>
                                <div>
                                    <h5 class="font-semibold mb-1">Hor\xE1rio de Atendimento</h5>
                                    <p class="text-white/60 text-sm">Seg a Sex: 7h - 18h<br>Sab: 8h - 12h</p>
                                </div>
                            </div>
                        </div>
                       
                        <!-- Social Links -->
                        <div class="flex space-x-3 mt-8 pt-6 border-t border-white/10">
                            <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-school-gold hover:text-white transition-all duration-300">
                                <i class="fab fa-facebook-f"></i>
                            </a>
                            <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-school-gold hover:text-white transition-all duration-300">
                                <i class="fab fa-instagram"></i>
                            </a>
                            <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-school-gold hover:text-white transition-all duration-300">
                                <i class="fab fa-youtube"></i>
                            </a>
                            <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-school-gold hover:text-white transition-all duration-300">
                                <i class="fab fa-whatsapp"></i>
                            </a>
                        </div>
                    </div>
                </div>
               
                <!-- Contact Form -->
                <div class="lg:col-span-3" data-aos="fade-left">
                    <form id="contact-form" class="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                        <div class="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Nome Completo *</label>
                                <input type="text" name="nome" required
                                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-school-sky focus:ring-2 focus:ring-school-sky/20 outline-none transition-all duration-300 bg-gray-50 hover:bg-white"
                                    placeholder="Seu nome completo">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                                <input type="email" name="email" required
                                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-school-sky focus:ring-2 focus:ring-school-sky/20 outline-none transition-all duration-300 bg-gray-50 hover:bg-white"
                                    placeholder="seu@email.com">
                            </div>
                        </div>
                       
                        <div class="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Telefone</label>
                                <input type="tel" name="telefone"
                                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-school-sky focus:ring-2 focus:ring-school-sky/20 outline-none transition-all duration-300 bg-gray-50 hover:bg-white"
                                    placeholder="(11) 99999-9999">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Assunto</label>
                                <select name="assunto"
                                    class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-school-sky focus:ring-2 focus:ring-school-sky/20 outline-none transition-all duration-300 bg-gray-50 hover:bg-white">
                                    <option value="">Selecione o assunto</option>
                                    <option value="matricula">Matr\xEDcula</option>
                                    <option value="visita">Agendar Visita</option>
                                    <option value="bolsa">Bolsa de Estudo</option>
                                    <option value="transferencia">Transfer\xEAncia</option>
                                    <option value="outro">Outro</option>
                                </select>
                            </div>
                        </div>
                       
                        <div class="mb-6">
                            <label class="block text-sm font-semibold text-gray-700 mb-2">Mensagem *</label>
                            <textarea name="mensagem" rows="5" required
                                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-school-sky focus:ring-2 focus:ring-school-sky/20 outline-none transition-all duration-300 bg-gray-50 hover:bg-white resize-none"
                                placeholder="Escreva sua mensagem aqui..."></textarea>
                        </div>
                       
                        <button type="submit" id="submit-btn"
                            class="w-full py-4 bg-gradient-to-r from-school-navy to-primary-700 text-white rounded-xl font-semibold text-lg hover:shadow-lg hover:shadow-primary-500/30 transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center">
                            <i class="fas fa-paper-plane mr-3"></i>
                            Enviar Mensagem
                        </button>
                       
                        <div id="form-message" class="mt-4 text-center hidden"></div>
                    </form>
                </div>
            </div>
        </div>
    </section>

    <!-- ============================================ -->
    <!-- CTA SECTION -->
    <!-- ============================================ -->
    <section class="py-20 bg-gradient-to-r from-school-gold via-warm-500 to-school-coral relative overflow-hidden">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
       
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative" data-aos="zoom-in">
            <h2 class="text-3xl lg:text-5xl font-bold text-white mb-6">
                Pronto para transformar o futuro do seu filho?
            </h2>
            <p class="text-white/90 text-lg mb-10 max-w-2xl mx-auto">
                Vagas limitadas para 2026. Garanta j\xE1 a matr\xEDcula e ofere\xE7a a melhor educa\xE7\xE3o para quem voc\xEA ama.
            </p>
            <!-- Bot\xF5es de a\xE7\xE3o -->
            <div class="flex flex-wrap justify-center gap-4">
                <!-- Bot\xE3o: Matricule-se Agora -->
                <a href="#contato" class="px-10 py-4 bg-white text-school-navy rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
                    <i class="fas fa-graduation-cap mr-3"></i>Matricule-se Agora
                </a>
                <!-- Bot\xE3o: WhatsApp -->
                <a href="https://wa.me/5511987654321" target="_blank" class="px-10 py-4 bg-transparent text-white border-2 border-white rounded-2xl font-bold text-lg hover:bg-white hover:text-school-navy transition-all duration-300">
                    <i class="fab fa-whatsapp mr-3"></i>WhatsApp
                </a>
            </div>
        </div>
    </section>

    <!-- ============================================
    FOOTER - Rodap\xE9 do Site
    ============================================
    Informa\xE7\xF5es institucionais e links \xFAteis
   
    Estrutura:
    - Grid 4 colunas
    - Coluna 1: Logo e descri\xE7\xE3o
    - Coluna 2: Links r\xE1pidos
    - Coluna 3: Cursos
    - Coluna 4: Newsletter
   
    Componentes:
    - Redes sociais
    - Navega\xE7\xE3o secund\xE1ria
    - Formul\xE1rio de newsletter
    - Copyright
    ============================================ -->
    <footer class="bg-school-navy pt-16 pb-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
               
                <!-- ===== COLUNA 1: LOGO E DESCRI\xC7\xC3O ===== -->
                <div class="lg:col-span-1">
                    <!-- Logo -->
                    <div class="flex items-center space-x-3 mb-6">
                        <div class="w-12 h-12 bg-gradient-to-br from-school-gold to-warm-500 rounded-xl flex items-center justify-center shadow-lg">
                            <i class="fas fa-graduation-cap text-white text-xl"></i>
                        </div>
                        <div>
                            <span class="text-xl font-bold text-white">EEC</span>
                            <span class="block text-[10px] text-white/50 uppercase tracking-[3px]">Escola Estadual</span>
                        </div>
                    </div>
                    <!-- Descri\xE7\xE3o -->
                    <p class="text-white/50 text-sm leading-relaxed mb-6">
                        Transformando vidas atrav\xE9s da educa\xE7\xE3o t\xE9cnica e integral. Qualidade e compromisso com o futuro.
                    </p>
                    <!-- Redes Sociais -->
                    <div class="flex space-x-3">
                        <a href="#" class="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-school-gold hover:text-white transition-all duration-300 text-sm">
                            <i class="fab fa-facebook-f"></i>
                        </a>
                        <a href="#" class="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-school-gold hover:text-white transition-all duration-300 text-sm">
                            <i class="fab fa-instagram"></i>
                        </a>
                        <a href="#" class="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-school-gold hover:text-white transition-all duration-300 text-sm">
                            <i class="fab fa-youtube"></i>
                        </a>
                        <a href="#" class="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-school-gold hover:text-white transition-all duration-300 text-sm">
                            <i class="fab fa-linkedin-in"></i>
                        </a>
                    </div>
                </div>
               
                <!-- Links Rapidos -->
                <div>
                    <h4 class="text-white font-semibold mb-6 text-lg">Links R\xE1pidos</h4>
                    <ul class="space-y-3">
                        <li><a href="#sobre" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Sobre a Escola</a></li>
                        <li><a href="#cursos" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Cursos</a></li>
                        <li><a href="#professores" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Nossa Equipe</a></li>
                        <li><a href="#eventos" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Eventos</a></li>
                        <li><a href="#contato" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Contato</a></li>
                    </ul>
                </div>
               
                <!-- Cursos -->
                <div>
                    <h4 class="text-white font-semibold mb-6 text-lg">Ensino</h4>
                    <ul class="space-y-3">
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Educa\xE7\xE3o Infantil</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Fundamental I</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Fundamental II</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Ensino M\xE9dio</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Per\xEDodo Integral</a></li>
                    </ul>
                </div>
               
                <!-- ===== COLUNA 4: NEWSLETTER ===== -->
                <div>
                    <h4 class="text-white font-semibold mb-6 text-lg">Newsletter</h4>
                    <p class="text-white/50 text-sm mb-4">Receba novidades e informa\xE7\xF5es da escola direto no seu email.</p>
                    <!-- Formul\xE1rio de inscri\xE7\xE3o na newsletter -->
                    <form class="space-y-3" onsubmit="event.preventDefault(); this.querySelector('button').innerHTML='<i class=\\'fas fa-check mr-2\\'></i>Inscrito!'; this.querySelector('button').classList.add('bg-school-emerald');">
                        <input type="email" placeholder="Seu melhor email" required
                            class="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-school-gold focus:ring-1 focus:ring-school-gold/20 outline-none text-sm transition-all">
                        <button type="submit" class="w-full py-3 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all duration-300">
                            <i class="fas fa-paper-plane mr-2"></i>Inscrever-se
                        </button>
                    </form>
                </div>
            </div>
           
            <!-- ===== BARRA INFERIOR (COPYRIGHT) ===== -->
            <div class="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <p class="text-white/40 text-sm">&copy; 2026 Escola Estadual do Cariri - EEC. Todos os direitos reservados.</p>
                <!-- Links de pol\xEDticas -->
                <div class="flex items-center space-x-6">
                    <a href="#" class="text-white/40 hover:text-school-gold text-sm transition-colors">Pol\xEDtica de Privacidade</a>
                    <a href="#" class="text-white/40 hover:text-school-gold text-sm transition-colors">Termos de Uso</a>
                </div>
            </div>
        </div>
    </footer>

    <!-- ============================================
    BOT\xC3O FLUTUANTE WHATSAPP
    ============================================
    Bot\xE3o fixo no canto inferior direito
    - Abre chat no WhatsApp
    - Anima\xE7\xE3o de entrada (via JS)
    - Aparece ap\xF3s scroll da p\xE1gina
    ============================================ -->
    <a href="https://wa.me/5511987654321" target="_blank" id="whatsapp-btn"
        class="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 hover:bg-green-600 transform hover:scale-110 transition-all duration-300 opacity-0 translate-y-10">
        <i class="fab fa-whatsapp text-white text-2xl"></i>
    </a>
   
    <!-- ============================================
    BOT\xC3O VOLTAR AO TOPO
    ============================================
    Bot\xE3o fixo no canto inferior esquerdo
    - Rola suavemente para o in\xEDcio da p\xE1gina
    - Aparece ap\xF3s scroll da p\xE1gina (via JS)
    ============================================ -->
    <button id="back-to-top"
        class="fixed bottom-6 left-6 z-50 w-12 h-12 bg-school-navy rounded-full flex items-center justify-center shadow-lg hover:bg-school-gold transform hover:scale-110 transition-all duration-300 opacity-0 translate-y-10">
        <i class="fas fa-arrow-up text-white"></i>
    </button>

    <!-- ============================================
    SCRIPTS - Bibliotecas e L\xF3gica Principal
    ============================================
    Ordem de carregamento:
    1. AOS - Anima\xE7\xF5es de scroll
    2. Axios - Cliente HTTP para API
    3. app.js - L\xF3gica principal da aplica\xE7\xE3o
   
    Nota: app.js tem par\xE2metro ?v=XX para cache busting
    ============================================ -->
    <!-- AOS Library - Animate On Scroll -->
    <script src="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"></script>
    <!-- Axios - Cliente HTTP -->
    <script src="https://cdn.jsdelivr.net/npm/axios@1.7.2/dist/axios.min.js"></script>
    <script src="/static/utils/dom.js"></script>
    <!-- Main App JS - L\xF3gica principal da aplica\xE7\xE3o -->
    <script src="/static/app.js?v=16"></script>
</body>
</html>`;
}

// src/routes/pages.routes.ts
var pagesRoutes = new Hono4();
pagesRoutes.get("/", (c) => c.html(renderHomePage()));
pagesRoutes.get("/formulario", (c) => c.html(renderFormularioPage()));
var pages_routes_default = pagesRoutes;

// src/routes/school.routes.ts
import { Hono as Hono5 } from "hono";

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
var schoolRoutes = new Hono5();
schoolRoutes.get("/cursos", (c) => c.json(getCursos()));
schoolRoutes.get("/professores", (c) => c.json(getProfessores()));
schoolRoutes.get("/diferenciais", (c) => c.json(getDiferenciais()));
schoolRoutes.get("/estatisticas", (c) => c.json(getEstatisticas()));
schoolRoutes.get("/eventos", (c) => c.json(getEventos()));
var school_routes_default = schoolRoutes;

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
var app = new Hono6();
app.use("*", securityHeaders());
app.use("/api/*", restrictedCors);
app.route("/api/health", health_routes_default);
app.route("/api/formulario", formulario_routes_default);
app.route("/api/contato", contato_routes_default);
app.route("/api", school_routes_default);
app.route("/", pages_routes_default);
var app_default = app;

// src/node-server.ts
function publicRoot() {
  const productionPublic = resolve2("dist", "public");
  return existsSync(productionPublic) ? "./dist/public" : "./public";
}
var server = new Hono7();
var staticRoot = publicRoot();
server.use(
  "/static/*",
  serveStatic({
    root: staticRoot,
    onFound: (_path, c) => {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    }
  })
);
server.use(
  "/styles/*",
  serveStatic({
    root: staticRoot,
    onFound: (_path, c) => {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    }
  })
);
server.route("/", app_default);
var config = getEnv();
var port = config.PORT;
serve(
  {
    fetch: server.fetch,
    port
  },
  (info) => {
    console.log(`Central EEC rodando em http://localhost:${info.port} [${config.APP_ENV}]`);
  }
);
