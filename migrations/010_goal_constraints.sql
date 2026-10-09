-- Indices e protecoes para o planeamento anual de objetivos.
-- Idempotente: seguro executar varias vezes. Nenhuma instrucao apaga dados.

-- Garantir a coluna active caso a migracao 009 ainda nao tenha corrido.
ALTER TABLE goal ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Um plano mensal por mes (o UNIQUE ja existe desde 006, o indice abaixo
-- acelera a pesquisa por ano e mes).
CREATE INDEX IF NOT EXISTS idx_goal_plan_month_month ON goal_plan_month (month);

-- Uma alocacao por objetivo e por mes (o UNIQUE ja existe desde 006).
CREATE INDEX IF NOT EXISTS idx_goal_allocation_plan_month ON goal_allocation (plan_month_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocation_goal ON goal_allocation (goal_id);

-- Pesquisa da versao de template aplicavel a cada mes (valid_from <= mes).
CREATE INDEX IF NOT EXISTS idx_goal_template_valid_from ON goal_template (valid_from);
CREATE INDEX IF NOT EXISTS idx_goal_template_entry_template ON goal_template_entry (template_id);

-- As chaves estrangeiras de goal_allocation e goal_template_entry usam o
-- comportamento predefinido (NO ACTION): um objetivo com historico nao pode
-- ser removido fisicamente enquanto existirem alocacoes ou entradas de
-- template a referencia-lo. A remocao logica faz-se com goal.active = FALSE.
