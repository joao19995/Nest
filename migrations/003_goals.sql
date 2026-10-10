-- 003: objetivos, tabela anual, planos mensais e revisões anuais.
--
-- Usado pela aba Objetivos: gestao de objetivos, tabela anual de
-- distribuicao (goalId + percentagem), meses do plano anual com alocacoes
-- (planeado + reservado) e revisoes de fim de ano. Apagar = desativar
-- (os meses fechados nunca mudam).
-- Nao correr migracoes contra producao como parte de tarefas de codigo.

CREATE TABLE IF NOT EXISTS goal (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
    priority VARCHAR(20) NOT NULL DEFAULT 'NICE_TO_HAVE'
        CHECK (priority IN ('GRANDE', 'PEQUENO', 'NICE_TO_HAVE')),
    timeline VARCHAR(10) NOT NULL DEFAULT 'ANUAL'
        CHECK (timeline IN ('T1', 'T2', 'T3', 'T4', 'ANUAL')),
    realism VARCHAR(50) NOT NULL DEFAULT 'OK',
    notes TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS goal_year_review (
    goal_id UUID NOT NULL REFERENCES goal(id),
    year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    happiness INTEGER NULL CHECK (happiness IS NULL OR (happiness BETWEEN 1 AND 5)),
    reflection TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (goal_id, year)
);

CREATE TABLE IF NOT EXISTS goal_template (
    id UUID PRIMARY KEY,
    valid_from VARCHAR(7) NOT NULL UNIQUE
        CHECK (valid_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    annual_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (annual_total >= 0)
);

CREATE TABLE IF NOT EXISTS goal_template_entry (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES goal_template(id),
    goal_id UUID NOT NULL REFERENCES goal(id),
    percentage NUMERIC(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    UNIQUE (template_id, goal_id)
);

CREATE TABLE IF NOT EXISTS goal_plan_month (
    id UUID PRIMARY KEY,
    month VARCHAR(7) NOT NULL UNIQUE
        CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    available_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (available_amount >= 0),
    closed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS goal_allocation (
    id UUID PRIMARY KEY,
    plan_month_id UUID NOT NULL REFERENCES goal_plan_month(id),
    goal_id UUID NOT NULL REFERENCES goal(id),
    planned NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (planned >= 0),
    actual NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (actual >= 0),
    UNIQUE (plan_month_id, goal_id)
);
