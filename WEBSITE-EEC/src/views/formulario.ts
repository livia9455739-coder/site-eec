export function renderFormularioPage(): string {
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
                Preencha as informações abaixo para que eu possa criar um site 100% personalizado para sua escola. Quanto mais detalhes, melhor!
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
                                <p class="text-gray-600 text-sm">Voce nao precisa preencher TUDO agora. Os campos vazios serao preenchidos com dados genéricos que podemos ajustar depois. O mais importante e o <strong>nome da escola</strong>, <strong>descricao</strong> e <strong>informacoes de contato</strong>.</p>
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
</html>`
}
