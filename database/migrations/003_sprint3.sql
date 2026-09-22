BEGIN;

CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    entity VARCHAR(80) NOT NULL,
    fields JSONB NOT NULL DEFAULT '[]'::JSONB,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_entity ON report_templates (entity);
CREATE INDEX IF NOT EXISTS idx_report_templates_active ON report_templates (active);
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates (created_by);

COMMIT;