-- A tabela goal passa a ter so o nome. Orcamento prioridade e prazo vivem na tabela anual.
-- Coisa nova: limpa dados de teste existentes em vez de migrar silenciosamente.
DELETE FROM goal_allocation;
DELETE FROM goal_template_entry;
DELETE FROM goal_plan_month;
DELETE FROM goal_template;
DELETE FROM goal;

ALTER TABLE goal DROP COLUMN IF EXISTS target_amount;
ALTER TABLE goal DROP COLUMN IF EXISTS priority;
ALTER TABLE goal DROP COLUMN IF EXISTS deadline_month;
ALTER TABLE goal DROP COLUMN IF EXISTS status;
ALTER TABLE goal ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
