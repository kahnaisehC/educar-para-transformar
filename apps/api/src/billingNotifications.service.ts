import type { DatabasePool } from "./db.js";
import { getInvoice, type InvoiceView } from "./billing.service.js";
import { buildInvoicePdf } from "./invoicePdf.service.js";
import { sendMail, type MailAttachment } from "./mail.service.js";
import type { BankDetails } from "./config.js";

export interface NotificationRunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

type Kind = "monthly_reminder" | "debt_notice";

interface ParentGroup {
  userId: number;
  username: string;
  email: string | null;
  displayName: string;
  invoices: InvoiceView[];
}

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function money(value: number): string {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadParentGroups(
  pool: DatabasePool,
  year: number,
  month: number,
): Promise<ParentGroup[]> {
  const result = await pool.query<{
    user_id: number;
    username: string;
    email: string | null;
    display_name: string;
    invoice_id: number;
  }>(
    `SELECT DISTINCT p.user_id, u.username, u.email, u.display_name, i.id AS invoice_id
     FROM parent_students ps
     JOIN parents p ON p.id = ps.parent_id
     JOIN users u ON u.id = p.user_id
     JOIN invoices i ON i.student_id = ps.student_id
     WHERE i.period_year = $1 AND i.period_month = $2
       AND i.status IN ('pending', 'partial')
       AND u.status = 'active'
     ORDER BY p.user_id, i.id`,
    [year, month],
  );

  const groups = new Map<number, ParentGroup>();
  for (const row of result.rows) {
    let group = groups.get(row.user_id);
    if (!group) {
      group = {
        userId: row.user_id,
        username: row.username,
        email: row.email,
        displayName: row.display_name,
        invoices: [],
      };
      groups.set(row.user_id, group);
    }
    if (!group.invoices.some((invoice) => invoice.id === row.invoice_id)) {
      group.invoices.push(await getInvoice(pool, row.invoice_id));
    }
  }
  return [...groups.values()];
}

async function alreadyDelivered(
  pool: DatabasePool,
  kind: Kind,
  key: string,
): Promise<boolean> {
  const result = await pool.query<{ status: string }>(
    "SELECT status FROM notification_deliveries WHERE idempotency_key = $1",
    [key],
  );
  const row = result.rows[0];
  if (!row) {
    return false;
  }
  if (row.status === "failed") {
    await pool.query("DELETE FROM notification_deliveries WHERE idempotency_key = $1", [key]);
    return false;
  }
  return true;
}

async function recordDelivery(
  pool: DatabasePool,
  input: {
    userId: number;
    kind: Kind;
    year: number;
    month: number;
    key: string;
    status: "sent" | "failed" | "skipped";
    error?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO notification_deliveries
       (user_id, kind, period_year, period_month, idempotency_key, status, error, metadata, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
    [
      input.userId,
      input.kind,
      input.year,
      input.month,
      input.key,
      input.status,
      input.error ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.status === "sent" ? new Date().toISOString() : null,
    ],
  );
}

export async function sendMonthlyReminders(
  pool: DatabasePool,
  bank: BankDetails,
  year: number,
  month: number,
): Promise<NotificationRunResult> {
  return runNotifications(pool, bank, year, month, "monthly_reminder");
}

export async function sendDebtNotices(
  pool: DatabasePool,
  bank: BankDetails,
  year: number,
  month: number,
): Promise<NotificationRunResult> {
  return runNotifications(pool, bank, year, month, "debt_notice");
}

async function runNotifications(
  pool: DatabasePool,
  bank: BankDetails,
  year: number,
  month: number,
  kind: Kind,
): Promise<NotificationRunResult> {
  const groups = await loadParentGroups(pool, year, month);
  const result: NotificationRunResult = { processed: groups.length, sent: 0, skipped: 0, failed: 0 };
  const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  for (const group of groups) {
    const key = `${kind}:${year}-${month}:${group.userId}`;
    if (await alreadyDelivered(pool, kind, key)) {
      result.skipped += 1;
      continue;
    }

    const pendingInvoices = group.invoices.filter(
      (invoice) => invoice.balance > 0 && invoice.status !== "cancelled",
    );
    const total = pendingInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    if (pendingInvoices.length === 0) {
      result.skipped += 1;
      continue;
    }
    if (!group.email) {
      await recordDelivery(pool, {
        userId: group.userId,
        kind,
        year,
        month,
        key,
        status: "skipped",
        error: "El usuario no tiene correo configurado",
      });
      result.skipped += 1;
      continue;
    }

    const lines = pendingInvoices.map(
      (invoice) =>
        `${invoice.studentName} · ${MONTH_NAMES[invoice.periodMonth - 1]} ${invoice.periodYear}: $${money(invoice.balance)} (vence ${invoice.dueDate})`,
    );
    const attachments: MailAttachment[] = [];
    for (const invoice of pendingInvoices) {
      try {
        attachments.push({
          filename: `factura-${invoice.id}.pdf`,
          content: await buildInvoicePdf(invoice, bank),
          contentType: "application/pdf",
        });
      } catch (error) {
        console.error(`No se pudo generar el PDF de la factura ${invoice.id}`, error);
      }
    }

    const title =
      kind === "monthly_reminder"
        ? `Recordatorio de pago · ${periodLabel}`
        : `Aviso de deuda · ${periodLabel}`;
    try {
      await sendMail({
        to: group.email,
        subject: `${title} · EDUCAR`,
        text: [
          `Hola ${group.displayName},`,
          kind === "monthly_reminder"
            ? `Te recordamos el total a abonar del período ${periodLabel}: $${money(total)}.`
            : `Registramos un saldo pendiente del período ${periodLabel}: $${money(total)}.`,
          "",
          ...lines,
          "",
          `Alias para transferencias: ${bank.alias}`,
          `CBU: ${bank.cbu}`,
          `Titular: ${bank.holder}`,
          "",
          "No se aceptan pagos en efectivo. Cargá el comprobante desde la aplicación móvil.",
        ].join("\n"),
        attachments,
      });
      await recordDelivery(pool, {
        userId: group.userId,
        kind,
        year,
        month,
        key,
        status: "sent",
        metadata: {
          invoices: pendingInvoices.map((invoice) => invoice.id),
          total,
        },
      });
      result.sent += 1;
    } catch (error) {
      await recordDelivery(pool, {
        userId: group.userId,
        kind,
        year,
        month,
        key,
        status: "failed",
        error: error instanceof Error ? error.message : "Error desconocido",
        metadata: { invoices: pendingInvoices.map((invoice) => invoice.id) },
      });
      result.failed += 1;
    }
  }

  return result;
}
