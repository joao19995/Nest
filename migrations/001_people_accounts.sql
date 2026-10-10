-- 001: pessoas, contas e rendimentos (schema limpo).
--
-- Base nova sem dados: esta cadeia comeca aqui. Contem apenas as colunas que
-- o codigo usa hoje (ver person/account/person-income repositories e
-- person-validation.ts). Sem colunas legadas (contribution_minimum,
-- bonus_months), sem tabela item e sem arquivo de goals.
-- Nao correr migracoes contra producao como parte de tarefas de codigo.

CREATE TABLE IF NOT EXISTS person (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    daily_spending_percentage NUMERIC(5, 2) NOT NULL DEFAULT 25,
    emergency_fund_months INTEGER NOT NULL DEFAULT 6 CHECK (emergency_fund_months >= 0)
);

CREATE TABLE IF NOT EXISTS account (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    owner_person_id UUID NULL REFERENCES person(id),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS person_income (
    id UUID PRIMARY KEY,
    person_id UUID NOT NULL REFERENCES person(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    valid_from DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_person_income_person ON person_income (person_id);
