export function renderHomePage(): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <!-- ============================================
    META TAGS - SEO e Configurações Básicas
    ============================================ -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Escola Estadual do Cariri - EEC | Ensino Técnico de Excelência</title>
    <meta name="description" content="Escola Estadual do Cariri (EEC) - Transforma vidas com ensino técnico e fundamental de qualidade.">
    
    <!-- ============================================
    CDN SCRIPTS & STYLES
    ============================================ -->
    
    <!-- Font Awesome - Biblioteca de ícones -->
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
    
    <!-- Google Fonts - Tipografia personalizada -->
    <!-- Poppins: Fonte principal (corpo do texto) -->
    <!-- Playfair Display: Fonte decorativa (títulos) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    
    <!-- AOS - Animate On Scroll Library -->
    <link href="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.css" rel="stylesheet">
    
    <link href="/styles/tailwind.css" rel="stylesheet">
    <!-- Estilos CSS customizados (animações, scrollbar, cards, etc.) -->
    <link href="/static/styles.css" rel="stylesheet">
</head>

<!-- ============================================
BODY - Corpo da Página
============================================
Classes Tailwind aplicadas:
- font-poppins: Fonte Poppins como padrão
- bg-white: Fundo branco
- text-gray-800: Texto cinza escuro
- overflow-x-hidden: Esconde scroll horizontal
============================================ -->
<body class="font-poppins bg-white text-gray-800 overflow-x-hidden">

    <!-- ============================================
    PRELOADER - Tela de Carregamento Inicial
    ============================================
    Exibido enquanto a página carrega
    Ocultado após 1.5 segundos via JavaScript (app.js)
    
    Estrutura:
    - Container fixo que cobre toda a tela (z-index: 9999)
    - Ícone de formatura animado (bounce)
    - 3 círculos pulsando (loading indicator)
    - Texto "Carregando..."
    ============================================ -->
    <div id="preloader" class="fixed inset-0 z-[9999] bg-school-navy flex items-center justify-center transition-opacity duration-700">
        <div class="text-center">
            <!-- Ícone de formatura com animação de bounce -->
            <div class="preloader-logo mb-6">
                <i class="fas fa-graduation-cap text-6xl text-school-gold animate-bounce"></i>
            </div>
            <!-- Indicador de loading: 3 círculos pulsando com delay -->
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
    NAVBAR - Barra de Navegação Fixa
    ============================================
    Comportamento:
    - Fixa no topo (fixed top-0)
    - z-index 50 para ficar acima do conteúdo
    - Muda de transparente para sólida ao rolar (via JS)
    
    Componentes:
    - Logo com ícone e nome da escola
    - Menu Desktop (visível em md:)
    - Botão hamburguer para mobile
    - Menu Mobile (toggle via JS)
    ============================================ -->
    <nav id="navbar" class="fixed top-0 left-0 right-0 z-50 transition-all duration-500">
        <!-- Container centralizado com padding responsivo -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Flexbox: logo à esquerda, menu à direita -->
            <div class="flex items-center justify-between h-20">
                
                <!-- ===== LOGO ===== -->
                <!-- Clicável, leva ao início da página -->
                <a href="#inicio" class="flex items-center space-x-3 group">
                    <!-- Ícone quadrado com gradiente dourado -->
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
                <!-- Visível apenas em telas médias e maiores (md:flex) -->
                <div class="hidden md:flex items-center space-x-8">
                    <!-- Link ativo (Início) - estilo diferenciado -->
                    <a href="#inicio" class="nav-link px-4 py-2 rounded-lg text-white font-semibold hover:bg-white/10 transition-all duration-300 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-0.5 after:bg-school-gold after:transition-all hover:after:w-full">Início</a>
                    <!-- Links de navegação principais -->
                    <a href="#sobre" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Sobre</a>
                    <a href="#cursos" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Cursos</a>
                    <a href="#professores" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Equipe</a>
                    <a href="#eventos" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Eventos</a>
                    <a href="#diferenciais" class="nav-link px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300 text-sm font-medium">Diferenciais</a>
                    <!-- Botão CTA (Call to Action) - Matricule-se -->
                    <a href="#contato" class="ml-4 px-6 py-2.5 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-school-gold/30 transform hover:-translate-y-0.5 transition-all duration-300">
                        <i class="fas fa-phone mr-2"></i>Matricule-se
                    </a>
                </div>
                
                <!-- ===== BOTÃO MENU MOBILE (Hamburger) ===== -->
                <!-- Visível apenas em telas pequenas (lg:hidden) -->
                <!-- Controlado via JavaScript para toggle do menu -->
                <button id="mobile-menu-btn" class="lg:hidden text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <i class="fas fa-bars text-xl"></i>
                </button>
            </div>
        </div>
        
        <!-- ===== MENU MOBILE ===== -->
        <!-- Inicialmente oculto (hidden), toggle via JS -->
        <!-- Aparece abaixo da navbar com blur e transparência -->
        <div id="mobile-menu" class="lg:hidden hidden bg-school-navy/98 backdrop-blur-xl border-t border-white/10">
            <div class="px-4 py-6 space-y-2">
                <!-- Links de navegação em formato de lista vertical -->
                <a href="#inicio" class="block px-4 py-3 text-white font-semibold bg-white/10 rounded-lg">Início</a>
                <a href="#sobre" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Sobre</a>
                <a href="#cursos" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Cursos</a>
                <a href="#professores" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Equipe</a>
                <a href="#eventos" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Eventos</a>
                <a href="#diferenciais" class="block px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">Diferenciais</a>
                <!-- Botão CTA centralizado -->
                <a href="#contato" class="block mt-4 text-center px-6 py-3 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-full font-semibold">
                    <i class="fas fa-phone mr-2"></i>Matricule-se
                </a>
            </div>
        </div>
    </nav>

    <!-- ============================================
    HERO SECTION - Slideshow Principal
    ============================================
    Seção de destaque na página inicial
    
    Características:
    - Tela cheia (min-h-screen)
    - Background com gradiente azul escuro
    - Partículas animadas (decoração sutil)
    - Formas geométricas com blur (decoração)
    - Padrão de grid pontilhado (decoração)
    - Slideshow com 4 slides (controle via JS)
    
    Slides:
    1. Educação que Transforma
    2. Ensino Técnico Profissionalizante
    3. Tecnologia e Inovação
    4. Nossa Comunidade
    ============================================ -->
    <section id="inicio" class="relative min-h-screen flex items-center overflow-hidden">
        
        <!-- ===== BACKGROUND ===== -->
        <!-- Gradiente diagonal do azul navy para tons mais escuros -->
        <div class="absolute inset-0 bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333]"></div>
        
        <!-- ===== PARTÍCULAS ANIMADAS ===== -->
        <!-- Círculos pequenos que flutuam ao fundo (estilizados no CSS) -->
        <div class="absolute inset-0 overflow-hidden">
            <div class="particle particle-1"></div>
            <div class="particle particle-2"></div>
            <div class="particle particle-3"></div>
            <div class="particle particle-4"></div>
            <div class="particle particle-5"></div>
            <div class="particle particle-6"></div>
        </div>
        
        <!-- ===== FORMAS GEOMÉTRICAS DECORATIVAS ===== -->
        <!-- Círculos grandes com blur que pulsam sutilmente -->
        <div class="absolute top-20 right-10 w-72 h-72 bg-school-gold/5 rounded-full blur-3xl animate-pulse"></div>
        <div class="absolute bottom-20 left-10 w-96 h-96 bg-school-sky/5 rounded-full blur-3xl animate-pulse" style="animation-delay: 2s"></div>
        <div class="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-accent-500/3 rounded-full blur-3xl animate-pulse" style="animation-delay: 4s"></div>
        
        <!-- ===== PADRÃO DE GRID PONTILHADO ===== -->
        <!-- Grade de pontos sutis para profundidade visual -->
        <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 50px 50px;"></div>
        
        <!-- ===== CONTEÚDO DO HERO ===== -->
        <div class="relative z-10 w-full h-full min-h-screen flex items-center">
            
            <!-- ===== CONTAINER DO SLIDESHOW ===== -->
            <!-- Gerenciado via initHeroSlider() em app.js -->
            <!-- Cada slide tem opacity e z-index controlados dinamicamente -->
            <div id="hero-slider" class="relative w-full" style="min-height: calc(100vh - 80px)">
                
                <!-- ================================================================
                SLIDE 1: EDUCAÇÃO QUE TRANSFORMA
                ================================================================
                Slide inicial visível por padrão (opacity: 1, z-index: 10)
                Estrutura: Grid 2 colunas (texto à esquerda, visual à direita)
                ================================================================ -->
                <div class="hero-slide" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; display: flex; align-items: center; opacity: 1; z-index: 10; transition: opacity 1s ease-in-out, transform 1s ease-in-out;">
                    <div class="grid lg:grid-cols-2 gap-12 items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        
                        <!-- ===== COLUNA ESQUERDA: TEXTO ===== -->
                        <div>
                            <!-- Badge: Matrículas Abertas -->
                            <div class="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-8">
                                <span class="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse"></span>
                                <span class="text-white text-sm font-medium tracking-wide">Matrículas Abertas 2026</span>
                            </div>
                            <!-- Título principal com gradiente -->
                            <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                                Educação que
                                <span class="block mt-2 bg-gradient-to-r from-school-gold via-warm-400 to-school-coral bg-clip-text text-transparent">Transforma</span>
                                <span class="block text-3xl sm:text-4xl lg:text-5xl mt-2 font-light text-white/70">Vidas e Futuros</span>
                            </h1>
                            <!-- Descrição -->
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Há mais de 28 anos formando cidadãos criativos, críticos e preparados para os desafios do século XXI.
                            </p>
                            <!-- Botões de ação -->
                            <div class="flex flex-wrap gap-4">
                                <!-- Botão primário: Agende uma Visita -->
                                <a href="#contato" class="px-8 py-4 bg-gradient-to-r from-school-gold to-warm-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-school-gold/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Agende uma Visita <i class="fas fa-arrow-right ml-2"></i>
                                </a>
                                <!-- Botão secundário: Conheça a Escola -->
                                <a href="#sobre" class="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-2xl font-bold text-lg hover:bg-white/20 backdrop-blur-sm transition-all duration-300 flex items-center">
                                    <div class="w-8 h-8 rounded-full bg-white text-school-navy flex items-center justify-center mr-3 text-xs"><i class="fas fa-play"></i></div>
                                    Conheça a Escola
                                </a>
                            </div>
                        </div>
                        
                        <!-- Visual 1 -->
                        <div class="hidden lg:block relative">
                            <div class="absolute -top-10 -right-10 w-64 h-64 bg-school-gold/20 rounded-full blur-3xl animate-pulse"></div>
                            
                            <!-- Card Flutuante: +1250 Alunos (posicionado à ESQUERDA do grid, acima) -->
                            <div class="absolute -top-8 left-0 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 shadow-xl flex items-center space-x-3 animate-float z-20">
                                <div class="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                                    <i class="fas fa-users text-sm"></i>
                                </div>
                                <div>
                                    <p class="text-white font-bold text-sm">+1250</p>
                                    <p class="text-white/60 text-xs">Alunos Felizes</p>
                                </div>
                            </div>
                            
                            <!-- Badge: Nota 9.8 MEC (posicionado à DIREITA do grid, acima, SEM sobreposição) -->
                            <div class="absolute -top-6 right-0 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 rounded-full shadow-xl flex items-center space-x-2 animate-float z-20" style="animation-delay: 0.5s;">
                                <i class="fas fa-star text-yellow-300 text-sm"></i>
                                <span class="text-white font-bold text-sm">Nota 9.8 MEC</span>
                            </div>
                            
                            <div class="hero-card bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-6 bg-white/10 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-school-gold transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-brain text-4xl text-school-gold mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Pensamento Crítico</p>
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
                                
                                <!-- Card Flutuante: Prêmio Escola Transformação (canto inferior ESQUERDO) -->
                                <div class="absolute -bottom-6 -left-6 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl flex items-center space-x-4 animate-float">
                                    <div class="w-12 h-12 rounded-full bg-gradient-to-r from-school-gold to-warm-500 flex items-center justify-center text-white shadow-lg"> 
                                        <i class="fas fa-trophy text-xl"></i>
                                    </div>
                                    <div>
                                        <p class="text-white font-bold text-sm">Prêmio Escola Transformação</p>
                                        <p class="text-white/60 text-xs">Ensino Fundamental II - EFTI</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================================================================
                SLIDE 2: ENSINO TÉCNICO PROFISSIONALIZANTE
                ================================================================
                Oculto por padrão (opacity: 0, pointer-events: none)
                Foco: Cursos técnicos e preparação para o mercado
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
                            <!-- Título com gradiente azul/roxo -->
                            <h1 class="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6">
                                Ensino Técnico
                                <span class="block mt-2 text-2xl sm:text-3xl lg:text-5xl xl:text-6xl bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Profissionalizante</span>
                                <span class="block text-xl sm:text-2xl lg:text-4xl xl:text-5xl mt-2 font-light text-white/70">Escola Estadual do Cariri</span>
                            </h1>
                            <!-- Descrição do slide -->
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Formação técnica de excelência conectada ao mercado. Laboratórios modernos e certificação reconhecida.
                            </p>
                            <!-- CTA: Conheça os Cursos -->
                            <div class="flex flex-wrap gap-4">
                                <a href="#cursos" class="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-blue-600/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Conheça os Cursos <i class="fas fa-arrow-right ml-2"></i>
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
                                    <!-- Card: Certificação -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-indigo-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-certificate text-4xl text-indigo-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Certificação</p>
                                    </div>
                                    <!-- Card: Laboratórios -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-purple-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-flask text-4xl text-purple-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Laboratórios</p>
                                    </div>
                                    <!-- Card: Inovação -->
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-cyan-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-rocket text-4xl text-cyan-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Inovação</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================================================================
                SLIDE 3: ENSINO MÉDIO TÉCNICO INTEGRADO
                ================================================================
                Oculto por padrão (opacity: 0, pointer-events: none)
                Foco: Formação integral com teoria e prática
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
                            <!-- Título com gradiente roxo/rosa -->
                            <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                                Ensino Médio
                                <span class="block mt-2 bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Técnico Integrado</span>
                                <span class="block text-3xl sm:text-4xl lg:text-5xl mt-2 font-light text-white/70">Teoria e Prática</span>
                            </h1>
                            <!-- Descrição do slide -->
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Preparação para o ENEM e formação profissional em um único curso. O caminho completo para o seu sucesso.
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
                                        <p class="text-white font-semibold text-sm">Técnico</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-fuchsia-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-clock text-4xl text-fuchsia-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Integral</p>
                                    </div>
                                    <div class="p-6 bg-white/5 rounded-3xl flex flex-col items-center justify-center text-center hover:bg-rose-600 transition-colors duration-300 border border-white/5 h-40 group cursor-pointer">
                                        <i class="fas fa-book-open text-4xl text-rose-400 mb-3 group-hover:text-white"></i>
                                        <p class="text-white font-semibold text-sm">Excelência</p>
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
                                <span class="text-white text-sm font-medium tracking-wide">6º ao 9º Ano</span>
                            </div>
                            <h1 class="text-4xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight mb-6">
                                Ensino
                                <span class="block mt-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Fundamental II</span>
                                <span class="block text-3xl sm:text-4xl lg:text-5xl mt-2 font-light text-white/70">Formação Completa</span>
                            </h1>
                            <p class="text-lg text-white/60 mb-10 max-w-xl leading-relaxed">
                                Base sólida e aprendizado integral. Projetos interdisciplinares e acompanhamento próximo para o desenvolvimento do seu filho.
                            </p>
                            <div class="flex flex-wrap gap-4">
                                <a href="#pedagogico" class="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-emerald-600/30 transform hover:-translate-y-1 transition-all duration-300">
                                    Conheça a Proposta <i class="fas fa-arrow-right ml-2"></i>
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
    SEÇÃO SOBRE - Quem Somos
    ============================================
    Apresenta a história e valores da escola
    
    Estrutura:
    - Header com badge e título
    - Grid 2 colunas: Visual (esquerda), Texto (direita)
    - Cards com valores: Inovação, Acolhimento, Excelência, Comunidade
    - Contadores de estatísticas
    - Linha do tempo da história da escola
    ============================================ -->
    <section id="sobre" class="py-24 bg-white relative overflow-hidden">
        
        <!-- ===== DECORAÇÕES DE FUNDO ===== -->
        <div class="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary-50 to-transparent"></div>
        <div class="absolute bottom-0 left-0 w-64 h-64 bg-school-gold/5 rounded-full -translate-x-1/2 translate-y-1/2"></div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            
            <!-- ===== HEADER DA SEÇÃO ===== -->
            <div class="text-center mb-16">
                <!-- Badge superior -->
                <div class="inline-flex items-center px-4 py-2 bg-primary-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-school text-primary-500 mr-2"></i>
                    <span class="text-primary-600 text-sm font-semibold">Quem Somos</span>
                </div>
                <!-- Título com destaque em gradiente -->
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Uma Escola com <span class="bg-gradient-to-r from-school-gold to-warm-500 bg-clip-text text-transparent">Alma</span>
                </h2>
                <!-- Subtítulo descritivo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Somos mais que uma instituição de ensino. Somos uma comunidade que acredita no potencial único de cada estudante.
                </p>
            </div>
            
            <div class="grid lg:grid-cols-2 gap-16 items-center">
                
                <!-- ===== COLUNA ESQUERDA: CARDS VISUAIS ===== -->
                <div class="relative" data-aos="fade-right">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Primeira coluna de cards -->
                        <div class="space-y-4">
                            <!-- Card: Inovação -->
                            <div class="bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl p-8 text-white shadow-xl shadow-primary-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-lightbulb text-4xl mb-4 text-school-gold"></i>
                                <h4 class="font-bold text-lg mb-2">Inovação</h4>
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
                            <!-- Card: Excelência -->
                            <div class="bg-gradient-to-br from-school-gold to-warm-600 rounded-3xl p-8 text-white shadow-xl shadow-warm-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-award text-4xl mb-4"></i>
                                <h4 class="font-bold text-lg mb-2">Excelência</h4>
                                <p class="text-white/80 text-sm">28 anos de resultados excepcionais em educação.</p>
                            </div>
                            <!-- Card: Comunidade -->
                            <div class="bg-gradient-to-br from-school-coral to-rose-700 rounded-3xl p-8 text-white shadow-xl shadow-rose-500/20 transform hover:-translate-y-2 transition-transform duration-300">
                                <i class="fas fa-globe text-4xl mb-4"></i>
                                <h4 class="font-bold text-lg mb-2">Visão Global</h4>
                                <p class="text-white/80 text-sm">Preparamos cidadãos para um mundo globalizado.</p>
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
                        A Escola Estadual do Cariri (EEC) nasceu do compromisso de oferecer educação pública de excelência integrada ao ensino profissionalizante. Referência na região, formamos jovens preparados para os desafios do mercado de trabalho.
                    </p>
                    <p class="text-gray-600 mb-8 leading-relaxed">
                        Nossa proposta pedagógica une a base do <strong class="text-school-navy">Ensino Fundamental II</strong> com a inovação do <strong class="text-school-navy">Ensino Técnico</strong>, proporcionando uma formação integral que valoriza tanto o conhecimento acadêmico quanto as competências práticas.
                    </p>
                    
                    <!-- Features List -->
                    <div class="space-y-4 mb-8">
                        <div class="flex items-start space-x-4 group">
                            <div class="w-10 h-10 bg-school-emerald/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-emerald group-hover:text-white transition-all duration-300">
                                <i class="fas fa-check text-school-emerald group-hover:text-white"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy">Laboratórios de Última Geração</h5>
                                <p class="text-gray-500 text-sm">Ciências, informática, robótica e maker space completo.</p>
                            </div>
                        </div>
                        <div class="flex items-start space-x-4 group">
                            <div class="w-10 h-10 bg-school-gold/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-gold group-hover:text-white transition-all duration-300">
                                <i class="fas fa-check text-school-gold group-hover:text-white"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy">Ensino Bilíngue</h5>
                                <p class="text-gray-500 text-sm">Programa de imersão em inglês desde a educação infantil.</p>
                            </div>
                        </div>
                        <div class="flex items-start space-x-4 group">
                            <div class="w-10 h-10 bg-school-sky/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-school-sky group-hover:text-white transition-all duration-300">
                                <i class="fas fa-check text-school-sky group-hover:text-white"></i>
                            </div>
                            <div>
                                <h5 class="font-semibold text-school-navy">5.000m² de Área Verde</h5>
                                <p class="text-gray-500 text-sm">Espaços ao ar livre para aprendizagem e lazer.</p>
                            </div>
                        </div>
                    </div>
                    
                    <a href="#contato" class="inline-flex items-center px-8 py-4 bg-school-navy text-white rounded-2xl font-semibold hover:bg-school-navy/90 transform hover:-translate-y-1 transition-all duration-300 shadow-lg shadow-school-navy/20">
                        Conheça nossa estrutura
                        <i class="fas fa-arrow-right ml-3"></i>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- ============================================
    BARRA DE ESTATÍSTICAS
    ============================================
    Faixa com contadores animados
    
    Dados:
    - Alunos Matriculados: 1250
    - Professores Qualificados: 85
    - Aprovação Vestibular: 97%
    - Anos de Experiência: 28
    
    Os contadores são animados via JavaScript (Intersection Observer)
    quando a seção entra na viewport
    ============================================ -->
    <section class="py-16 bg-gradient-to-r from-school-navy via-[#162464] to-school-navy relative overflow-hidden">
        <!-- Padrão de pontos decorativo -->
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
                
                <!-- Contador: Aprovação Vestibular (%) -->
                <div class="text-center" data-aos="zoom-in" data-aos-delay="200">
                    <div class="text-4xl lg:text-5xl font-bold text-school-emerald mb-2"><span class="counter-stat" data-target="97">0</span>%</div>
                    <div class="text-white/60 text-sm uppercase tracking-wider">Aprovação Vestibular</div>
                </div>
                
                <!-- Contador: Anos de Experiência -->
                <div class="text-center" data-aos="zoom-in" data-aos-delay="300">
                    <div class="text-4xl lg:text-5xl font-bold text-school-coral mb-2 counter-stat" data-target="28">0</div>
                    <div class="text-white/60 text-sm uppercase tracking-wider">Anos de Experiência</div>
                </div>
            </div>
        </div>
    </section>

    <!-- ============================================
    SEÇÃO CURSOS - Formação Completa
    ============================================
    Apresenta os cursos oferecidos pela escola
    
    Características:
    - Header com badge e título
    - Grid responsivo (1/2/3 colunas)
    - Cards carregados dinamicamente via API
    - Skeleton loading enquanto carrega
    
    Dados via: GET /api/cursos
    ============================================ -->
    <section id="cursos" class="py-24 bg-gray-50 relative overflow-hidden">
        <!-- Linha decorativa superior -->
        <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-school-gold/30 to-transparent"></div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <!-- ===== HEADER DA SEÇÃO ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Nossos Cursos -->
                <div class="inline-flex items-center px-4 py-2 bg-warm-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-book-open text-warm-500 mr-2"></i>
                    <span class="text-warm-600 text-sm font-semibold">Nossos Cursos</span>
                </div>
                <!-- Título com gradiente -->
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Formação <span class="bg-gradient-to-r from-school-sky to-primary-600 bg-clip-text text-transparent">Completa</span>
                </h2>
                <!-- Subtítulo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Da educação infantil ao ensino médio, oferecemos uma jornada educacional completa e personalizada.
                </p>
            </div>
            
            <!-- ===== GRID DE CURSOS ===== -->
            <!-- Populado dinamicamente via loadCursos() em app.js -->
            <!-- Usa skeleton loading enquanto aguarda dados da API -->
            <div id="cursos-grid" class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Cards serão carregados dinamicamente via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SEÇÃO PROFESSORES - Nossa Equipe
    ============================================
    Apresenta a equipe docente da escola
    
    Características:
    - Header com badge e título
    - Grid responsivo de cards
    - Avatares com iniciais e cores personalizadas
    - Informações de contato e redes sociais
    
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
                    Uma equipe apaixonada por educação, dedicada a transformar a vida de cada aluno.
                </p>
            </div>
            
            <!-- ===== GRID DE PROFESSORES ===== -->
            <!-- Populado dinamicamente via loadProfessores() em app.js -->
            <div id="professores-grid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Cards serão carregados via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SEÇÃO EVENTOS - Calendário Escolar
    ============================================
    Apresenta os próximos eventos da escola
    
    Características:
    - Fundo escuro (azul navy)
    - Grid com 4 colunas
    - Cards de eventos com datas e descrições
    - Padrão de pontos decorativo
    
    Dados via: GET /api/eventos
    ============================================ -->
    <section id="eventos" class="py-24 bg-gradient-to-br from-school-navy via-[#162464] to-[#0c1333] relative overflow-hidden">
        <!-- Padrão de pontos decorativo -->
        <div class="absolute inset-0 opacity-5" style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 40px 40px;"></div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            
            <!-- ===== HEADER DA SEÇÃO ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Calendário Escolar -->
                <div class="inline-flex items-center px-4 py-2 bg-white/10 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-calendar-star text-school-gold mr-2"></i>
                    <span class="text-white/80 text-sm font-semibold">Calendário Escolar</span>
                </div>
                <!-- Título -->
                <h2 class="text-4xl lg:text-5xl font-bold text-white mb-6" data-aos="fade-up" data-aos-delay="100">
                    Próximos <span class="bg-gradient-to-r from-school-gold to-warm-400 bg-clip-text text-transparent">Eventos</span>
                </h2>
                <!-- Subtítulo -->
                <p class="text-white/50 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Fique por dentro das atividades e eventos que movimentam nossa escola.
                </p>
            </div>
            
            <!-- ===== GRID DE EVENTOS ===== -->
            <!-- Populado dinamicamente via loadEventos() em app.js -->
            <div id="eventos-grid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Serão carregados via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SEÇÃO DIFERENCIAIS - Por que escolher a EEC?
    ============================================
    Apresenta os diferenciais da escola
    
    Características:
    - Fundo cinza claro
    - Grid responsivo de cards
    - Ícones e descrições
    - Hover effects
    
    Dados via: GET /api/diferenciais
    ============================================ -->
    <section id="diferenciais" class="py-24 bg-gray-50 relative overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <!-- ===== HEADER DA SEÇÃO ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Por que escolher a EEC? -->
                <div class="inline-flex items-center px-4 py-2 bg-rose-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-rocket text-rose-500 mr-2"></i>
                    <span class="text-rose-600 text-sm font-semibold">Por que escolher a EEC?</span>
                </div>
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Diferenciais <span class="bg-gradient-to-r from-school-coral to-rose-500 bg-clip-text text-transparent">Técnicos</span>
                </h2>
                <!-- Subtítulo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Estrutura completa para potenciar o aprendizado prático e profissional.
                </p>
            </div>
            
            <!-- ===== GRID DE DIFERENCIAIS ===== -->
            <!-- Populado dinamicamente via loadDiferenciais() em app.js -->
            <div id="diferenciais-grid" class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Serão carregados via JS -->
            </div>
        </div>
    </section>

    <!-- ============================================
    SEÇÃO CONTATO - Fale Conosco
    ============================================
    Formulário de contato e informações
    
    Estrutura:
    - Header com badge e título
    - Grid 5 colunas (2 info + 3 form)
    - Card de informações de contato
    - Formulário com validação

    Componentes:
    - Endereço, telefone, email, horário
    - Links de redes sociais
    - Campos: Nome, Email, Telefone, Mensagem
    
    Submissão via: POST /api/contato
    ============================================ -->
    <section id="contato" class="py-24 bg-white relative overflow-hidden">
        <!-- Linha decorativa superior -->
        <div class="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-school-gold/30 to-transparent"></div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            <!-- ===== HEADER DA SEÇÃO ===== -->
            <div class="text-center mb-16">
                <!-- Badge: Fale Conosco -->
                <div class="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full mb-4" data-aos="fade-up">
                    <i class="fas fa-envelope text-blue-500 mr-2"></i>
                    <span class="text-blue-600 text-sm font-semibold">Fale Conosco</span>
                </div>
                <!-- Título -->
                <h2 class="text-4xl lg:text-5xl font-bold text-school-navy mb-6" data-aos="fade-up" data-aos-delay="100">
                    Entre em <span class="bg-gradient-to-r from-primary-500 to-school-sky bg-clip-text text-transparent">Contato</span>
                </h2>
                <!-- Subtítulo -->
                <p class="text-gray-500 max-w-2xl mx-auto text-lg" data-aos="fade-up" data-aos-delay="200">
                    Estamos prontos para atender você. Agende uma visita e conheça nossa escola pessoalmente!
                </p>
            </div>
            
            <div class="grid lg:grid-cols-5 gap-12">
                <!-- Contact Info -->
                <div class="lg:col-span-2 space-y-6" data-aos="fade-right">
                    <div class="bg-gradient-to-br from-school-navy to-[#162464] rounded-3xl p-8 text-white">
                        <h3 class="text-2xl font-bold mb-8">Informações de Contato</h3>
                        
                        <div class="space-y-6">
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-location-dot text-school-gold"></i>
                                </div>
                                <div>
                                    <h5 class="font-semibold mb-1">Endereço</h5>
                                    <p class="text-white/60 text-sm">Rua da Educação, 1000<br>Bairro Jardim Saber<br>São Paulo - SP, 01000-000</p>
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
                                    <p class="text-white/60 text-sm">contato@eec.edu.br<br>matriculas@eec.edu.br</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start space-x-4">
                                <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-clock text-school-coral"></i>
                                </div>
                                <div>
                                    <h5 class="font-semibold mb-1">Horário de Atendimento</h5>
                                    <p class="text-white/60 text-sm">Seg a Sex: 7h - 18h<br>Sab: 8h - 12h</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Social Links -->
                        <div class="flex space-x-3 mt-8 pt-6 border-t border-white/10">
                            <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-school-gold hover:text-white transition-all duration-300">
                                 
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
                                    <option value="matricula">Matrícula</option>
                                    <option value="visita">Agendar Visita</option>
                                    <option value="bolsa">Bolsa de Estudo</option>
                                    <option value="transferencia">Transferência</option>
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
                Vagas limitadas para 2026. Garanta já a matrícula e ofereça a melhor educação para quem você ama.
            </p>
            <!-- Botões de ação -->
            <div class="flex flex-wrap justify-center gap-4">
                <!-- Botão: Matricule-se Agora -->
                <a href="#contato" class="px-10 py-4 bg-white text-school-navy rounded-2xl font-bold text-lg hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
                    <i class="fas fa-graduation-cap mr-3"></i>Matricule-se Agora
                </a>
                <!-- Botão: WhatsApp -->
                <a href="https://wa.me/5511987654321" target="_blank" class="px-10 py-4 bg-transparent text-white border-2 border-white rounded-2xl font-bold text-lg hover:bg-white hover:text-school-navy transition-all duration-300">
                    <i class="fab fa-whatsapp mr-3"></i>WhatsApp
                </a>
            </div>
        </div>
    </section>

    <!-- ============================================
    FOOTER - Rodapé do Site
    ============================================
    Informações institucionais e links úteis
    
    Estrutura:
    - Grid 4 colunas
    - Coluna 1: Logo e descrição
    - Coluna 2: Links rápidos
    - Coluna 3: Cursos
    - Coluna 4: Newsletter
    
    Componentes:
    - Redes sociais
    - Navegação secundária
    - Formulário de newsletter
    - Copyright
    ============================================ -->
    <footer class="bg-school-navy pt-16 pb-8">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                
                <!-- ===== COLUNA 1: LOGO E DESCRIÇÃO ===== -->
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
                    <!-- Descrição -->
                    <p class="text-white/50 text-sm leading-relaxed mb-6">
                        Transformando vidas através da educação técnica e integral. Qualidade e compromisso com o futuro.
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
                    <h4 class="text-white font-semibold mb-6 text-lg">Links Rápidos</h4>
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
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Educação Infantil</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Fundamental I</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Fundamental II</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Ensino Médio</a></li>
                        <li><a href="#" class="text-white/50 hover:text-school-gold transition-colors text-sm flex items-center"><i class="fas fa-chevron-right mr-2 text-xs"></i>Período Integral</a></li>
                    </ul>
                </div>
                
                <!-- ===== COLUNA 4: NEWSLETTER ===== -->
                <div>
                    <h4 class="text-white font-semibold mb-6 text-lg">Newsletter</h4>
                    <p class="text-white/50 text-sm mb-4">Receba novidades e informações da escola direto no seu email.</p>
                    <!-- Formulário de inscrição na newsletter -->
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
                <!-- Links de políticas -->
                <div class="flex items-center space-x-6">
                    <a href="#" class="text-white/40 hover:text-school-gold text-sm transition-colors">Política de Privacidade</a>
                    <a href="#" class="text-white/40 hover:text-school-gold text-sm transition-colors">Termos de Uso</a>
                </div>
            </div>
        </div>
    </footer>

    <!-- ============================================
    BOTÃO FLUTUANTE WHATSAPP
    ============================================
    Botão fixo no canto inferior direito
    - Abre chat no WhatsApp
    - Animação de entrada (via JS)
    - Aparece após scroll da página
    ============================================ -->
    <a href="https://wa.me/5511987654321" target="_blank" id="whatsapp-btn"
        class="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 hover:bg-green-600 transform hover:scale-110 transition-all duration-300 opacity-0 translate-y-10">
        <i class="fab fa-whatsapp text-white text-2xl"></i>
    </a>
    
    <!-- ============================================
    BOTÃO VOLTAR AO TOPO
    ============================================
    Botão fixo no canto inferior esquerdo
    - Rola suavemente para o início da página
    - Aparece após scroll da página (via JS)
    ============================================ -->
    <button id="back-to-top"
        class="fixed bottom-6 left-6 z-50 w-12 h-12 bg-school-navy rounded-full flex items-center justify-center shadow-lg hover:bg-school-gold transform hover:scale-110 transition-all duration-300 opacity-0 translate-y-10">
        <i class="fas fa-arrow-up text-white"></i>
    </button>

    <!-- ============================================
    SCRIPTS - Bibliotecas e Lógica Principal
    ============================================
    Ordem de carregamento:
    1. AOS - Animações de scroll
    2. Axios - Cliente HTTP para API
    3. app.js - Lógica principal da aplicação
    
    Nota: app.js tem parâmetro ?v=XX para cache busting
    ============================================ -->
    <!-- AOS Library - Animate On Scroll -->
    <script src="https://cdn.jsdelivr.net/npm/aos@2.3.4/dist/aos.js"></script>
    <!-- Axios - Cliente HTTP -->
    <script src="https://cdn.jsdelivr.net/npm/axios@1.7.2/dist/axios.min.js"></script>
    <script src="/static/utils/dom.js"></script>
    <!-- Main App JS - Lógica principal da aplicação -->
    <script src="/static/app.js?v=16"></script>
</body>
</html>`
}
