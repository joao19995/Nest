CREATE TABLE IF NOT EXISTS goal_template (
    id UUID PRIMARY KEY,
    valid_from VARCHAR(7) NOT NULL UNIQUE
        CHECK (valid_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    annual_total NUMERIC(12, 2) NOT NULL CHECK (annual_total >= 0)
);

CREATE TABLE IF NOT EXISTS goal_template_entry (
    id UUID PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES goal_template(id),
    goal_id UUID NOT NULL REFERENCES goal(id),
    percentage NUMERIC(5, 2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    UNIQUE (template_id, goal_id)
);
