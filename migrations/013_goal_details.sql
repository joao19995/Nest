-- 013: detalhes do objetivo no modelo do Excel (informacao e acompanhamento).
--
-- O orcamento (target_amount) e apenas informacao e acompanhamento: NAO
-- calcula percentagens. A alocacao mensal continua a derivar das
-- percentagens da tabela anual aplicadas ao disponivel de cada mes (ver
-- features/goals/domain/allocate-month.ts). A 009 tinha removido estas
-- colunas; o dono do produto decidiu repô-las com a semantica do Excel
-- (ver tarefa D), por isso esta migracao volta a adiciona-las — sem tocar
-- na 009/011 nem no arquivo goal_legacy_backup.
--
-- Idempotente e nunca apaga dados: so ADD COLUMN IF NOT EXISTS e CREATE
-- TABLE IF NOT EXISTS. Pressupoe a ordem do migrate (009 corre antes).
-- Nao correr migracoes contra producao como parte de tarefas de codigo.

ALTER TABLE goal ADD COLUMN IF NOT EXISTS target_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0);
ALTER TABLE goal ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'NICE_TO_HAVE' CHECK (priority IN ('GRANDE', 'PEQUENO', 'NICE_TO_HAVE'));
ALTER TABLE goal ADD COLUMN IF NOT EXISTS timeline VARCHAR(10) NOT NULL DEFAULT 'ANUAL' CHECK (timeline IN ('T1', 'T2', 'T3', 'T4', 'ANUAL'));
ALTER TABLE goal ADD COLUMN IF NOT EXISTS realism VARCHAR(50) NOT NULL DEFAULT 'OK';
ALTER TABLE goal ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS goal_year_review (
    goal_id UUID NOT NULL REFERENCES goal(id),
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    happiness SMALLINT NULL CHECK (happiness >= 1 AND happiness <= 5),
    reflection TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (goal_id, year)
);
