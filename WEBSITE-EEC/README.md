# Escola Estadual do Cariri (EEC) - Website institucional

## Visão Geral

| Item | Descrição |
|------|-----------|
| **Nome** | Escola Estadual do Cariri (EEC) |
| **Tipo** | Website institucional moderno e criativo |
| **Objetivo** | Apresentar a escola, cursos, equipe e formulário de contato |
| **Stack** | Hono.js + TypeScript + Tailwind CSS + Font Awesome + AOS |
| **Versão** | 2.0.0 |
| **Last Update** | 2026-02-08 |

---

## URLs e Endpoints

### Ambiente de Desenvolvimento
- **Dev Server**: `http://localhost:5173`
- **Preview**: `http://localhost:300` (Wrangler)

### Rotas da API
| Método | Endpoint | Descrição |
| ------ | -------- | --------- |
| `Get` | `/api/cursos` | lista de cursos oferecidos |
| `Get` | `/api/professores` | Equipe docente |
| `Get` | `/api/depoimentos` | Depoimentos de pais e alunos |
| `Get` | `/api/estatísticas` | Números de escola |
| `Get` | `/api/eventos` | Próximos eventos |
| `Get` | `/api/diferenciais` | Diferenciais pedagógicos |
| `POST` | `/api/formulario` | Envio de formulário de contato |
| `Get` | `/api/formulario` | Recuperar dados do formulário |

--- 

## Funcionalidades

### Frontend (página Principal)

#### Hero Section (Slideshow Dinâmico)
- **4 slides temáticos** com transição automática (fade)
- Slides: Educação que transforma, Técnico Profissionalizante, Médio Técnico, Fundamental II
- Cards flutuantes animados (+1250 alunos, Nota 9.8 MEC, Prêmio Escola transformação)
- Grid de 4 valores (Pensamento Crítico, Tecnologia, Criatividade, Empatia)
- Intervalo: 5 segundos entre slides

#### Navegação
- Navbar fixa com efeito glasmorphism
- Efeito de scroll (transparente para solido)
- Menu hamburguer responsivo para mobile
- Highlight automático de seção ativa

#### Seções de conteúdo
- **Sobre**: História e missão da escola
- **Cursos**: Grid com cards interativos
- **Equipe**: Professores com fotos e redes sociais
- **Eventos**: Timeline de próximos eventos
- **Diferenciais**: Cards com ícones animados
- **Contato**: Formulário completo com validação

#### Interatividade
- Contadores animados (estatísticas)
- Animações on-scroll (AOS library)
- Hover effects em todos os cards
- Smooth scroll para navegação
- Botão WhatsApp flutuante
- Botão "voltar ao topo"
- Preloader animado

### Backend (API)
- Servidor Hono.js ultrarrápido
- Rotas RESTful para dados
- CORS habilitado para desenvolvimento
- Armazenamento em memória (DEV)

---

## Tecnologias Utilizadas

### Core
| Tecnologia | Versão | Propósito |
| ---------- | ------ | --------- |
| **Hono.js** | 4.x | Framework backend |
| **TypeScript** | 5.x | Tipagem estática |
| **Vite** | 6.x | Build tool e dev server |

### Frontend
| Biblioteca | Versão | Propósito |
| ---------- | ------ | --------- |
| **Tailwind CSS** | 3.x (CDN) | Tipagem estática |
| **Font Awesome** | 6.5 | Ícones profissionais |
| **AOS** | 2.x | Animações on-scroll |
| **Axios** | 1.7.x | HTTP cliente |
| **Google fonts** | - | Poppins + Playfair Display |

### Deploy
| Ferramenta | Propósito |
| ---------- | --------- |
| **Cloudflare Pages** | Hospefagem edge |
| **Wrangler** | CLI do Cloudflare |
| **PM2** | Process manager (opcional) |

---

## Estrutura do Projeto

```

```

---

## Design System

### Paleta de Cores
``` css
school-navy:        #1a365d     /* Azul escuro principal */
school-gold:        #f59e0b     /* Dourado/laranja destaque */
school-sky:         #0ea5e9     /* Azul claro */
school-esmeralda:   #10b981     /* Verde */
school-coral:       #f43f5e     /* Coral/vermelho */
```

### Tipografia
- **Corpo**: Poppins (sans-serif)
- **Decorativa**: Playfair Display (serif)

### Animações
- `animate-float`: Flutuação suave (cards)
- `animate-pulse`: Pulsação (badges)
- `particle-float`: Particulas decorativas

---

## Comandos

```bash
# Desenvolvimento
npm run dev             # Inicia servidor de desenvolvimento (porta 5173)

# Preview
npm rum preview         # Preview local com Wrangler

# Build
npm run build           # Gera build de produção

# Deploy
npm run deploy          # Build + deploy para Cloudflare Pages
npm run deploy:prod     # Deploy em produção
```

---

## Scripts do package.json

| Script | Comando | Descrição |
| ------ | ------- | --------- |
| `dev` | `vite` | Dev server com hot reload |
| `dev:sandbox` | `wrangler pages dev dist` | Sandbox local |
| `build` | `vite build` | Build de produção |
| `preview` | `wrangler pages dev dist` | Preview local |
| `deploy` | `npm run build && wrangler pages deploy dist` | Deploy |
| `deploy:prod` | `npm run build && wrangler pages deploy dist --project-name colegio-nova-era` | Deploy produção |

---

## Documentação Adicional

- **Documentação Técnica Complete**: `.context/docs/DOCUMENTACAO_TECNICA.md`
- **Arquitetura**: `.context/docs/architecture.md`
- **Changelog**: `.context/docs/CHANGELOG.md`
- **Glorrário**: `.context/docs/glossary.md`

---

## Roadmap

- [ ] Galeria de fotos da escola
- [ ] Blog/Notícias
- [ ] Área do aluno (login)
- [ ] Sistema de matrículas online
- [ ] Mapa interativo da localização
- [ ] SEO otimazado com meta tags
- [ ] PWA (Progressive Web App)
- [ ] Integração com WhatsApp Business API

--- 

## Equipe

- **Desnvolvimento**: Alunos do Curso técnico em Desenvolvimento de Sistemas com orientação do professor Edmar Santos
- **Design**: Baseada em padrões modernos de UI/UX
- **Manutenção**: Contínua

---

## Licença
© 2026 Escola Estadual do Cariri - Todos os direitos reservados