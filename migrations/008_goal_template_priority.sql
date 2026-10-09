ALTER TABLE goal_template_entry
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    ADD COLUMN IF NOT EXISTS deadline_month VARCHAR(7) NULL
        CHECK (deadline_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
