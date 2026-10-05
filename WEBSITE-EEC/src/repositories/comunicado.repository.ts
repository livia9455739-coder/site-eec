





































































































    const db = getDatabase()
    const row = db.prepare('SELECT * FROM comunicados WHERE id = ?').get(id)
    return ((row as unknown) as ComunicadoRecord) || null
}

export async function createComunicado(
    data: CreateComunicadoDTO,
    client?: SupabaseClient | null
): Promise<ComunicadoRecord> {
    if (client) {
        const { data: created, error } = await client
            .from('comunicados')
            .insert({
                titulo: data.titulo,
                conteudo: data.conteudo,
                status: data.status,
                audiencia: data.audiencia,
                criado_por: data.criado_por,
                publicado_em: data.publicado_em || null
            })
            .select()
            .single()
        
        if (error) {
            throw new Error(`Erro ao criar comunicado no Supabase: ${error.message}`)
        }

        return created as ComunicadoRecord
    }

    const db = getDatabase()
    const stmt = db.prepare(`
        INSERT INTO comunicados (titulo, conteudo, status, audiencia, criado_por, publicado_em)
        VALUES (?, ?, ?, ?, ?, ?)
    `)
    const info = stmt.run(
        data.titulo,
        data.conteudo, 
        data.status,
        data.audiencia,
        data.criado_por,
        data.publicado_em || null
    )

    const selectStmt = db.prepare('SELECT * FROM comunicados WHERE id = ?')
    return (selectStmt.get(info.lastInsertRowid) as unknown) as ComunicadoRecord
}

export async function updateComunicadoStatus(
    id: number,
    newStatus: 'publicado' | 'arquivado',
    client?: SupabaseClient | null
): Promise<void> {
    const nowIso = new Date().toISOString()
    const updatePayload: Record<string, string> = {
        status: newStatus,
        updated_at: nowIso
    }

    if (newStatus === 'publicado') {
        updatePayload.publicado_em = nowIso
    } else if (newStatus === 'arquivado') {
        updatePayload.arquivado_em = nowIso
    }

    if (client){
        const { error } = await client
            .from('comunicados')
            .update(updateayload)
            .eq('id', id)

        if (error) {
            throw new Error(`Erro ao atualizar status do comunicado: ${error.message}`)
        }
        return
    }

    const db = getDatabase()
    if (newStatus === 'publicado') {
        db.prepare('UPDATE comunicado SET status = ?, publicado_em = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?')
            .run(newStatus, id)
    } else {
        db.prepare('UPDATE comunicado SET status = ?, arquivado_em = datetime(\'now\'), update_at = datetime(\'now\') WHERE id = ?')
            .run(newStatus, id)
    }
}