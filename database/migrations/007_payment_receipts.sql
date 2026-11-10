BEGIN;

-- Número identificatorio del comprobante de pago definitivo.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_number VARCHAR(30);

UPDATE payments
SET payment_number = 'PAGO-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' || LPAD(id::TEXT, 6, '0')
WHERE payment_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_number ON payments (payment_number);

COMMIT;
