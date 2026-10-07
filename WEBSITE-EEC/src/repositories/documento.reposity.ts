import type { SupabaseClient } from '@supabase/supabase-js'
import { getDatabase } from '../database/connection'

export interface DocumentoRecord {
    id: number
    nome_original: string
    nome_armazenado: string
    storage_path: string
    mime_type: string
    tamanho_bytes: number
    categoria: string
    status: 'pendente' | 'aprovado' | 'rejeitado' | 'arquivado'
    enviado_por: string
    aprovado_por: string | null
    motivo_rejeicao: string | null
    created_at: string
    updated_at: string
}

export interface DocumentoCompartilhamentoRecord {
    id: number
    documento_id: number
    tipo_destino: 'perfil' | 'usuario' | 'grupo'
    destino_id: string
    criado_por: string
    created_at: string
}

export interface CreateDocumentoDTO {
    nome_original: string
    nome_armazenado: string
    storage_path: string
    mime_type: string
    tamanho_bytes: number
    categoria: string
    status: 'pendente' | 'aprovado' | 'rejeitado' | 'arquivado'
    enviado_por: string
    aprovado_por?: string | null
}

export async function listDocumentos(
    client?: SupabaseClient | null,
    userRole?: string, 
    userId?: string,
): Promise<DocumentoRecord[]> {
    // 1. Em ambiente Cloud / Produção: consulta via cliente Supabase (RLS ativo)
    if (client) {
        const { data, error } = await client
            .from('documentos')
            .select('*')
            .order('id', { ascending: false })

        if (error) {
            throw new Error(`Erro ao consultar documentos no Supabase: ${error.message}`)
        }

        return (data || []) as DocumentoRecord[]
    }

    // 2. Em ambiente local / testes isolados (SQLite): aplica as mesmas regras de isolamento
    if (userRole === 'admin_tecnico') {
        // admin_tecnico não possui acesso a documentos institucionais conforme matriz
        return []
    }

    
}