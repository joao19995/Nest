-- 011: arquivo de segurança das colunas legadas de goal (ver 009).
--
-- CONCLUSAO DOCUMENTADA: as colunas target_amount, priority, deadline_month
-- e status da tabela goal sao intencionalmente obsoletas e os seus valores
-- sao genuinamente desnecessarios para a aplicacao atual:
-- - O orcamento por objetivo vive na tabela anual (goal_template_entry com
--   percentage); a alocacao mensal deriva das percentagens aplicadas ao
--   disponivel de cada mes (ver features/goals/domain/allocate-month.ts).
-- - A prioridade e o prazo por objetivo foram removidos da configuracao no
--   refactor anual: as escritas usam valores neutros ('MEDIUM'/NULL) e a
--   leitura ignora essas colunas (ver goal-template-repository.ts).
-- - O estado do objetivo e apenas ativo/inativo (goal.active); o historico
--   financeiro vive em goal_plan_month + goal_allocation, que nenhuma
--   migracao apaga.
-- Por isso a 009 remove as colunas sem migrar valores para a nova
-- representacao: nao ha representacao nova para elas.
--
-- SEGURANCA DE DEPLOY (ordem importante):
-- - Bases novas: 006 cria as colunas, 009 remove-as, esta migracao cria o
--   arquivo vazio. Sem dados em risco.
-- - Bases existentes onde a 009 (versao antiga ou nova) JA correu: as
--   colunas ja nao existem; esta migracao e um no-op seguro (apenas cria a
--   tabela de arquivo vazia para documentar a decisao).
-- - Bases existentes onde a 009 NUNCA correu (colunas ainda com valores):
--   correr ANTES do migrate:
--     node scripts/validate-goal-migrations.mjs --archive
--   que copia os valores para goal_legacy_backup. Depois o migrate normal
--   aplica 009 (remove as colunas) e esta migracao.
-- Esta migracao NUNCA apaga linhas e e idempotente.
-- Nao correr migracoes contra producao como parte de tarefas de codigo.

CREATE TABLE IF NOT EXISTS goal_legacy_backup (
    goal_id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NULL,
    priority VARCHAR(20) NULL,
    deadline_month VARCHAR(7) NULL,
    status VARCHAR(20) NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
