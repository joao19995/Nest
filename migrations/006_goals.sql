CREATE TABLE IF NOT EXISTS goal (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount >= 0),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    deadline_month VARCHAR(7) NULL CHECK (deadline_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'DONE', 'ARCHIVED'))
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
