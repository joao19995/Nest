ALTER TABLE person
    ADD COLUMN IF NOT EXISTS individual_fixed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (individual_fixed_amount >= 0);
