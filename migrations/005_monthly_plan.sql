CREATE TABLE IF NOT EXISTS monthly_plan (
    id UUID PRIMARY KEY,
    month VARCHAR(7) NOT NULL UNIQUE
        CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    template_id UUID NOT NULL REFERENCES category_template(id),
    closed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS monthly_plan_entry (
    id UUID PRIMARY KEY,
    monthly_plan_id UUID NOT NULL REFERENCES monthly_plan(id),
    category_id UUID NOT NULL REFERENCES category(id),
    account_id UUID NOT NULL REFERENCES account(id),
    planned NUMERIC(12, 2) NOT NULL CHECK (planned >= 0),
    actual NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (actual >= 0),
    UNIQUE (monthly_plan_id, category_id)
);
