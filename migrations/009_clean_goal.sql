-- A tabela goal passa a ter so o nome e o estado ativo. O orcamento, a
-- prioridade e o prazo vivem na tabela anual (goal_template_entry).
--
-- Regra de seguranca: esta migracao nunca apaga linhas. Apenas ajusta o
-- esquema de forma idempotente, por isso pode ser aplicada varias vezes
-- (o script scripts/migrate.mjs executa todos os ficheiros em cada deploy).
-- As linhas de goal, goal_template, goal_plan_month e goal_allocation sao
-- sempre preservadas e os meses fechados mantem o historico.

ALTER TABLE goal DROP COLUMN IF EXISTS target_amount;
ALTER TABLE goal DROP COLUMN IF EXISTS priority;
ALTER TABLE goal DROP COLUMN IF EXISTS deadline_month;
ALTER TABLE goal DROP COLUMN IF EXISTS status;
ALTER TABLE goal ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
