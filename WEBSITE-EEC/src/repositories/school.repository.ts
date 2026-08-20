export function getCursos() {
    return [
        {
            id: 1,
            nome: 'Fundamental II Integral',
            descricao: 'Formação sólida do 6º ao 9º ano com foco no desenvolvimento integral e atividades práticas.',
            icone: 'fa-book-open-reader',
            cor: '#4ECDC4',
            idade: '11-14 anos',
            turno: 'Integral'
        },
        {
            id: 2,
            nome: 'Médio Técnico Integral',
            descricao: 'Ensino médio integrado à formação técnica profissionalizante de alta qualidade.',
            icone: 'fa-microchip',
            cor: '#45B7D1',
            idade: '15-17 anos',
            turno: 'Integral'
        },
        {
            id: 3,
            nome: 'Técnico Noturno',
            descricao: 'Qualificação profissional para quem busca inserção rápida no mercado de trabalho.',
            icone: 'fa-briefcase',
            cor: '#96CEB4',
            idade: '+18 anos',
            turno: 'Noturno'
        }
    ]
}

export function getProfessores() {
    return [
        {
            id: 1,
            nome: 'Profa. Maria Silva',
            cargo: 'Coordenadora Pedagógica',
            bio: 'Mestre em Educação pela USP com 15 anos de experiência em gestão escolar.',
            avatar: 'MS',
            cor: '#FF6B6B'
        },
        {
            id: 2,
            nome: 'Prof. Carlos Oliveira',
            cargo: 'Matemática e Ciências',
            bio: 'Doutor em Matemática Aplicada, apaixonado por tornar números divertidos.',
            avatar: 'CO',
            cor: '#4ECDC4'
        },
        {
            id: 3,
            nome: 'Profa. Ana Santos',
            cargo: 'Língua Portuguesa e Literatura',
            bio: 'Especialista em Linguística com foco em metodologias ativas de ensino.',
            avatar: 'AS',
            cor: '#45B7D1'
        },
        {
            id: 4,
            nome: 'Prof. Ricardo Lima',
            cargo: 'Tecnologia e Robótica',
            bio: 'Engenheiro de Software que encontrou sua paixão na educação tecnológica.',
            avatar: 'RL',
            cor: '#96CEB4'
        }
    ]
}

export function getDiferenciais() {
    return [
        {
            id: 1,
            titulo: 'Laboratórios Maker',
            descricao: 'Espaços equipados com impressoras 3D e kits de robótica para aprendizagem prática.',
            icone: 'fa-microchip',
            cor: '#FF6B6B'
        },
        {
            id: 2,
            titulo: 'Estágios Garantidos',
            descricao: 'Parcerias com as maiores empresas da região para inserção no mercado.',
            icone: 'fa-handshake',
            cor: '#4ECDC4'
        },
        {
            id: 3,
            titulo: 'Certificação Técnica',
            descricao: 'Diplomas reconhecidos pelo MEC e valorizados pelo setor produtivo.',
            icone: 'fa-certificate',
            cor: '#45B7D1'
        },
        {
            id: 4,
            titulo: 'Projetos Inovadores',
            descricao: 'Fomento ao empreendedorismo e desenvolvimento de soluções reais.',
            icone: 'fa-lightbulb',
            cor: '#96CEB4'
        }
    ]
}

export function getEstatisticas() {
    return {
        alunos: 1250,
        professores: 85,
        aprovacaoVestibular: 97,
        anosExperiencia: 28,
        notaEnem: 780,
        areaVerde: 5000
    }
}

export function getEventos() {
    return [
        {
            id: 1,
            titulo: 'Feira de Ciências 2026',
            data: '15 de Março',
            descricao: 'Projetos inovadores dos alunos do Fundamental e Médio.',
            tipo: 'acadêmico'
        },
        {
            id: 2,
            titulo: 'Festival de Artes',
            data: '22 de Abril',
            descricao: 'Apresentações de música, dança e teatro.',
            tipo: 'cultural'
        },
        {
            id: 3,
            titulo: 'Olimpíada Esportiva',
            data: '10 de Maio',
            descricao: 'Competições entre turmas em diversas modalidades.',
            tipo: 'esportivo'
        },
        {
            id: 4,
            titulo: 'Reunião de Pais',
            data: '05 de Março',
            descricao: 'Encontro com a equipe pedagógica para alinhamento do semestre.',
            tipo: 'institucional'
        }
    ]
}
