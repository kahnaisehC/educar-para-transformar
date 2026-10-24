BEGIN;

-- Módulo económico de la Parte 3: tarifas, facturas, comprobantes y pagos.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(160);
UPDATE users SET email = username || '@educar.local' WHERE email IS NULL;

CREATE TABLE IF NOT EXISTS billing_tariffs (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('monthly', 'sport', 'transport', 'cafeteria')),
    sport_id INTEGER REFERENCES sports (id) ON DELETE RESTRICT,
    transport_route_id INTEGER REFERENCES transport_routes (id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_tariffs_kind ON billing_tariffs (kind, valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_billing_tariffs_sport ON billing_tariffs (sport_id);
CREATE INDEX IF NOT EXISTS idx_billing_tariffs_route ON billing_tariffs (transport_route_id);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students (id) ON DELETE CASCADE,
    period_year INTEGER NOT NULL,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'cancelled')),
    created_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices (student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);

CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('monthly', 'sport', 'transport', 'cafeteria')),
    description VARCHAR(160) NOT NULL,
    sport_id INTEGER REFERENCES sports (id) ON DELETE SET NULL,
    transport_route_id INTEGER REFERENCES transport_routes (id) ON DELETE SET NULL,
    tariff_id INTEGER REFERENCES billing_tariffs (id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    UNIQUE (invoice_id, kind, description)
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS payment_receipts (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    file_name VARCHAR(200) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(80) NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    claimed_amount NUMERIC(12, 2) NOT NULL CHECK (claimed_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by INTEGER REFERENCES users (id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice ON payment_receipts (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_status ON payment_receipts (status);

CREATE TABLE IF NOT EXISTS payment_receipt_items (
    receipt_id INTEGER NOT NULL REFERENCES payment_receipts (id) ON DELETE CASCADE,
    invoice_item_id INTEGER NOT NULL REFERENCES invoice_items (id) ON DELETE CASCADE,
    PRIMARY KEY (receipt_id, invoice_item_id)
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL UNIQUE REFERENCES payment_receipts (id) ON DELETE RESTRICT,
    invoice_id INTEGER NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    approved_by INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
    invoice_item_id INTEGER NOT NULL REFERENCES invoice_items (id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    UNIQUE (payment_id, invoice_item_id)
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind VARCHAR(40) NOT NULL,
    period_year INTEGER NOT NULL,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    idempotency_key VARCHAR(200) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens (user_id);

COMMIT;
