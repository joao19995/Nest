-- 002: categorias e templates mensais (uma conta por categoria).
--
-- Usado pela aba Categorias: gestao de categorias e versoes do template
-- mensal (linhas com categoria, conta e valor esperado). A conta de cada
-- linha pertence ao template, nao a categoria (tabela account ja existe).
-- Nao correr migracoes contra producao como parte de tarefas de codigo.

CREATE TABLE IF NOT EXISTS category (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('FIXED', 'VARIABLE')),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS category_template (
    id UUID PRIMARY KEY,
    valid_from VARCHAR(7) NOT NULL UNIQUE
        CHECK (valid_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE TABLE IF NOT EXISTS category_template_entry (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES category_template(id),
    category_id UUID NOT NULL REFERENCES category(id),
    account_id UUID NOT NULL REFERENCES account(id),
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (template_id, category_id)
);
