/* ============================================
   FORMULARIO DE PERSONALIZAÇÃO - COLEGIO
   Coleta dados da escola para personalizar o site
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initSteps();
    initFormLogic();
    initDynamicFields();
});

// ============================================
// STEP NAVIGATION
// ============================================
let currentStep = 1;
const totalSteps = 7;

const {
    appendChildren,
    clearChildren,
    createElementSafe,
    createIcon,
    createInput,
    createSelect,
    createTextarea,
    setButtonContent,
    setElementContent
} = window.SafeDOM;

const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm';

function createRemoveButton() {
    const button = createElementSafe('button', '', 'absolute top-3 right-3 w-8 h-8 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white');
    button.type = 'button';
    button.addEventListener('click', () => button.parentElement?.remove());
    button.appendChild(createIcon('fas fa-times text-xs'));
    return button;
}

function createField(labelText, control) {
    const wrapper = createElementSafe('div');
    const label = createElementSafe('label', labelText, 'block text-sm font-semibold text-gray-700 mb-1');
    appendChildren(wrapper, [label, control]);
    return wrapper;
}

function createTextField(label, name, placeholder, required = false) {
    return createField(label, createInput({
        name,
        placeholder,
        required,
        className: inputClass
    }));
}

function createSelectField(label, name, options) {
    return createField(label, createSelect({
        name,
        className: inputClass,
        options
    }));
}

function createDynamicItem(className) {
    const div = createElementSafe('div', '', className);
    div.appendChild(createRemoveButton());
    return div;
}

function initSteps() {
    showStep(1);
    updateProgress();
}

function showStep(step) {
    document.querySelectorAll('.form-step').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('animate-fadeIn');
    });
    const target = document.getElementById(`step-${step}`);
    if (target) {
        target.classList.remove('hidden');
        setTimeout(() => target.classList.add('animate-fadeIn'), 10);
    }
    currentStep = step;
    updateProgress();
    updateNavButtons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        }
    }
}

function prevStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

function updateProgress() {
    const pct = (currentStep / totalSteps) * 100;
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = `Etapa ${currentStep} de ${totalSteps}`;

    // Update step indicators
    for (let i = 1; i <= totalSteps; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        if (dot) {
            if (i < currentStep) {
                dot.className = 'step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-green-500 text-white shadow-lg shadow-green-500/30 transition-all duration-300';
                setElementContent(dot, [createIcon('fas fa-check')]);
            } else if (i === currentStep) {
                dot.className = 'step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-200 transition-all duration-300';
                dot.textContent = i;
            } else {
                dot.className = 'step-dot w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 text-gray-500 transition-all duration-300';
                dot.textContent = i;
            }
        }
    }
}

function updateNavButtons() {
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const submitBtn = document.getElementById('btn-submit');

    if (prevBtn) prevBtn.classList.toggle('invisible', currentStep === 1);
    if (nextBtn) nextBtn.classList.toggle('hidden', currentStep === totalSteps);
    if (submitBtn) submitBtn.classList.toggle('hidden', currentStep !== totalSteps);
}

function validateCurrentStep() {
    const step = document.getElementById(`step-${currentStep}`);
    if (!step) return true;
    const required = step.querySelectorAll('[required]');
    let valid = true;
    required.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('!border-red-400', '!ring-red-200');
            field.classList.remove('border-gray-200');
            valid = false;

            // Remove error on input
            field.addEventListener('input', function handler() {
                field.classList.remove('!border-red-400', '!ring-red-200');
                field.classList.add('border-gray-200');
                field.removeEventListener('input', handler);
            }, { once: true });
        }
    });
    if (!valid) {
        const firstInvalid = step.querySelector('.\\!border-red-400');
        if (firstInvalid) firstInvalid.focus();
        showToast('Por favor, preencha todos os campos obrigatorios.', 'error');
    }
    return valid;
}

// ============================================
// DYNAMIC FIELDS
// ============================================
function initDynamicFields() {
    // Cursos - add/remove
    document.getElementById('add-curso')?.addEventListener('click', () => {
        const container = document.getElementById('cursos-container');
        const count = container.querySelectorAll('.curso-item').length + 1;
        const div = createDynamicItem('curso-item bg-gray-50 rounded-2xl p-5 border border-gray-100 relative group');
        const grid = createElementSafe('div', '', 'grid md:grid-cols-2 gap-4');
        appendChildren(grid, [
            createTextField('Nome do Curso/Nivel *', `curso_nome_${count}`, 'Ex: Educacao Infantil', true),
            createTextField('Faixa Etaria', `curso_idade_${count}`, 'Ex: 2-5 anos')
        ]);
        appendChildren(div, [
            grid,
            createElementSafe('div', '', 'mt-3'),
            createElementSafe('div', '', 'mt-3')
        ]);
        div.children[2].appendChild(createTextField('Descricao breve', `curso_desc_${count}`, 'Descreva brevemente este curso...'));
        div.children[3].appendChild(createSelectField('Turno', `curso_turno_${count}`, [
            { value: 'Matutino', label: 'Matutino' },
            { value: 'Vespertino', label: 'Vespertino' },
            { value: 'Matutino e Vespertino', label: 'Matutino e Vespertino' },
            { value: 'Integral', label: 'Integral' },
            { value: 'Noturno', label: 'Noturno' }
        ]));
        container.appendChild(div);
    });

    // Professores - add/remove
    document.getElementById('add-professor')?.addEventListener('click', () => {
        const container = document.getElementById('professores-container');
        const count = container.querySelectorAll('.professor-item').length + 1;
        const div = createDynamicItem('professor-item bg-gray-50 rounded-2xl p-5 border border-gray-100 relative group');
        const grid = createElementSafe('div', '', 'grid md:grid-cols-2 gap-4');
        appendChildren(grid, [
            createTextField('Nome Completo *', `prof_nome_${count}`, 'Ex: Profa. Maria Silva', true),
            createTextField('Cargo/Disciplina *', `prof_cargo_${count}`, 'Ex: Matematica', true)
        ]);
        const bio = createElementSafe('div', '', 'mt-3');
        bio.appendChild(createTextField('Mini Biografia', `prof_bio_${count}`, 'Breve descricao profissional...'));
        appendChildren(div, [grid, bio]);
        container.appendChild(div);
    });

    // Depoimentos - add/remove
    document.getElementById('add-depoimento')?.addEventListener('click', () => {
        const container = document.getElementById('depoimentos-container');
        const count = container.querySelectorAll('.depoimento-item').length + 1;
        const div = createDynamicItem('depoimento-item bg-gray-50 rounded-2xl p-5 border border-gray-100 relative group');
        const grid = createElementSafe('div', '', 'grid md:grid-cols-2 gap-4');
        appendChildren(grid, [
            createTextField('Nome', `dep_nome_${count}`, 'Nome do pai/mae/aluno'),
            createTextField('Relacao', `dep_relacao_${count}`, 'Ex: Mae de aluno - 3o ano')
        ]);
        const text = createElementSafe('div', '', 'mt-3');
        text.appendChild(createField('Depoimento', createTextarea({
            name: `dep_texto_${count}`,
            rows: 2,
            placeholder: 'O que essa pessoa diria sobre a escola...',
            className: `${inputClass} resize-none`
        })));
        appendChildren(div, [grid, text]);
        container.appendChild(div);
    });

    // Eventos - add/remove
    document.getElementById('add-evento')?.addEventListener('click', () => {
        const container = document.getElementById('eventos-container');
        const count = container.querySelectorAll('.evento-item').length + 1;
        const div = createDynamicItem('evento-item bg-gray-50 rounded-2xl p-5 border border-gray-100 relative group');
        const grid = createElementSafe('div', '', 'grid md:grid-cols-3 gap-4');
        appendChildren(grid, [
            createTextField('Titulo do Evento', `evt_titulo_${count}`, 'Nome do evento'),
            createTextField('Data', `evt_data_${count}`, 'Ex: 15 de Marco'),
            createSelectField('Tipo', `evt_tipo_${count}`, [
                { value: 'academico', label: 'Academico' },
                { value: 'cultural', label: 'Cultural' },
                { value: 'esportivo', label: 'Esportivo' },
                { value: 'institucional', label: 'Institucional' }
            ])
        ]);
        const description = createElementSafe('div', '', 'mt-3');
        description.appendChild(createTextField('Descricao', `evt_desc_${count}`, 'Breve descricao...'));
        appendChildren(div, [grid, description]);
        container.appendChild(div);
    });
}

// ============================================
// FORM SUBMISSION
// ============================================
function initFormLogic() {
    document.getElementById('school-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateCurrentStep()) return;

        const btn = document.getElementById('btn-submit');
        btn.disabled = true;
        setButtonContent(btn, 'fas fa-spinner fa-spin mr-2', 'Salvando dados...');

        // Collect all data
        const data = collectFormData();

        try {
            const response = await axios.post('/api/formulario', data);
            if (response.data.success) {
                showToast('Dados salvos com sucesso! O site sera personalizado.', 'success');
                // Show success screen
                renderSuccessScreen(document.getElementById('form-container'));
            }
        } catch (error) {
            showToast('Erro ao salvar. Tente novamente.', 'error');
            btn.disabled = false;
            setButtonContent(btn, 'fas fa-rocket mr-2', 'Finalizar e Personalizar o Site');
        }
    });
}

function renderSuccessScreen(container) {
    if (!container) return;

    clearChildren(container);

    const wrapper = createElementSafe('div', '', 'text-center py-20');
    const iconWrapper = createElementSafe('div', '', 'w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6');
    iconWrapper.appendChild(createIcon('fas fa-check-circle text-5xl text-green-500'));

    const title = createElementSafe('h2', 'Dados Enviados com Sucesso!', 'text-3xl font-bold text-gray-800 mb-4');
    const message = createElementSafe(
        'p',
        'Suas informacoes foram salvas. Agora o site sera personalizado com os dados da sua escola.',
        'text-gray-500 text-lg max-w-lg mx-auto mb-8'
    );

    const info = createElementSafe('div', '', 'bg-blue-50 rounded-2xl p-6 max-w-md mx-auto');
    info.appendChild(createIcon('fas fa-info-circle text-blue-500 text-xl mb-2'));
    info.appendChild(createElementSafe(
        'p',
        'Volte para o chat e me avise que preencheu o formulario. Vou aplicar todas as personalizacoes!',
        'text-blue-700 text-sm'
    ));

    appendChildren(wrapper, [iconWrapper, title, message, info]);
    container.appendChild(wrapper);
}

function collectFormData() {
    const form = document.getElementById('school-form');
    const data = {};

    // Basic info
    const basicFields = ['nome_escola', 'slogan', 'ano_fundacao', 'descricao_escola', 'missao', 'visao', 'valores',
        'endereco', 'bairro', 'cidade', 'estado', 'cep', 'telefone', 'telefone2', 'whatsapp', 'email', 'email_matriculas',
        'horario_atendimento', 'facebook', 'instagram', 'youtube', 'linkedin', 'site',
        'num_alunos', 'num_professores', 'taxa_aprovacao', 'nota_enem', 'area_escola',
        'cor_primaria', 'cor_secundaria', 'diferenciais', 'infraestrutura'];

    basicFields.forEach(field => {
        const el = form.querySelector(`[name="${field}"]`);
        if (el) data[field] = el.value;
    });

    // Checkboxes
    data.niveis_ensino = [];
    form.querySelectorAll('[name="niveis_ensino"]:checked').forEach(cb => {
        data.niveis_ensino.push(cb.value);
    });

    // Cursos
    data.cursos = [];
    form.querySelectorAll('.curso-item').forEach((item, i) => {
        const nome = item.querySelector(`[name^="curso_nome"]`)?.value;
        if (nome) {
            data.cursos.push({
                nome,
                idade: item.querySelector(`[name^="curso_idade"]`)?.value || '',
                descricao: item.querySelector(`[name^="curso_desc"]`)?.value || '',
                turno: item.querySelector(`[name^="curso_turno"]`)?.value || 'Matutino'
            });
        }
    });

    // Professores
    data.professores = [];
    form.querySelectorAll('.professor-item').forEach((item, i) => {
        const nome = item.querySelector(`[name^="prof_nome"]`)?.value;
        if (nome) {
            data.professores.push({
                nome,
                cargo: item.querySelector(`[name^="prof_cargo"]`)?.value || '',
                bio: item.querySelector(`[name^="prof_bio"]`)?.value || ''
            });
        }
    });

    // Depoimentos
    data.depoimentos = [];
    form.querySelectorAll('.depoimento-item').forEach((item, i) => {
        const nome = item.querySelector(`[name^="dep_nome"]`)?.value;
        if (nome) {
            data.depoimentos.push({
                nome,
                relacao: item.querySelector(`[name^="dep_relacao"]`)?.value || '',
                texto: item.querySelector(`[name^="dep_texto"]`)?.value || ''
            });
        }
    });

    // Eventos
    data.eventos = [];
    form.querySelectorAll('.evento-item').forEach((item, i) => {
        const titulo = item.querySelector(`[name^="evt_titulo"]`)?.value;
        if (titulo) {
            data.eventos.push({
                titulo,
                data: item.querySelector(`[name^="evt_data"]`)?.value || '',
                tipo: item.querySelector(`[name^="evt_tipo"]`)?.value || 'institucional',
                descricao: item.querySelector(`[name^="evt_desc"]`)?.value || ''
            });
        }
    });

    return data;
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast-notification fixed top-6 right-6 z-[9999] ${colors[type]} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 transform translate-x-full transition-transform duration-500`;
    appendChildren(toast, [
        createIcon(`fas ${icons[type]} text-xl`),
        createElementSafe('span', message, 'font-medium')
    ]);
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-x-full'), 50);
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
