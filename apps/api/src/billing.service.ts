import type { PoolClient } from "pg";
import type { DatabasePool, Queryable } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import { withAuditProxy } from "./auditProxy.js";
import type { UserRole } from "./auth.js";
import { assertChildAssociation } from "./parent.service.js";
import { safeNotify } from "./notifications.service.js";

export interface Actor {
  userId: number;
  role: UserRole;
}

export interface TariffView {
  id: number;
  kind: "monthly" | "sport" | "transport" | "cafeteria";
  sportId: number | null;
  sport: string | null;
  transportRouteId: number | null;
  route: string | null;
  amount: number;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface InvoiceItemView {
  id: number;
  kind: "monthly" | "sport" | "transport" | "cafeteria";
  description: string;
  sportId: number | null;
  transportRouteId: number | null;
  amount: number;
  paidAmount: number;
  status: "pending" | "partial" | "paid";
}

export interface ReceiptItemView {
  invoiceItemId: number;
  description: string;
  amount: number;
  paidAmount: number;
}

export interface ReceiptView {
  id: number;
  invoiceId: number;
  uploadedBy: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  claimedAmount: number;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  items: ReceiptItemView[];
}

export interface InvoiceView {
  id: number;
  studentId: number;
  studentName: string;
  periodYear: number;
  periodMonth: number;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: "pending" | "partial" | "paid" | "cancelled";
  displayStatus: "pending" | "partial" | "paid" | "cancelled" | "overdue";
  items: InvoiceItemView[];
  receipts: ReceiptView[];
}

export interface BillingSummary {
  studentId: number;
  studentName: string;
  totalPending: number;
  totalOverdue: number;
  totalPaid: number;
  currentInvoice: InvoiceView | null;
  invoices: InvoiceView[];
}

export interface InvoiceGenerationResult {
  periodYear: number;
  periodMonth: number;
  created: number;
  skipped: number;
  invoices: InvoiceView[];
}

export interface ReceiptFileInput {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

interface InvoiceRow {
  id: number;
  student_id: number;
  student_name: string;
  period_year: number;
  period_month: number;
  issue_date: string;
  due_date: string;
  total_amount: string | number;
  status: "pending" | "partial" | "paid" | "cancelled";
  created_at: string;
}

interface ItemRow {
  id: number;
  invoice_id: number;
  kind: "monthly" | "sport" | "transport" | "cafeteria";
  description: string;
  sport_id: number | null;
  transport_route_id: number | null;
  amount: string | number;
  paid_amount: string | number;
  status: "pending" | "partial" | "paid";
}

interface ReceiptRow {
  id: number;
  invoice_id: number;
  uploaded_by: number;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  claimed_amount: string | number;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

const KINDS = ["monthly", "sport", "transport", "cafeteria"] as const;
type TariffKind = (typeof KINDS)[number];

function money(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function moneyString(value: number): string {
  return money(value).toFixed(2);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function defaultDueDate(year: number, month: number): string {
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}-10`;
}

function normalizeBillingError(error: unknown): Error {
  if (isAppError(error)) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") {
      return new AppError(409, "Ya existe un registro con esos datos", "DUPLICATE_RECORD");
    }
    if (error.code === "23503") {
      return new AppError(409, "El registro está en uso", "RECORD_IN_USE");
    }
  }
  return error instanceof Error ? error : new Error("No se pudo completar la operación de facturación");
}

function audited<T>(
  pool: DatabasePool,
  actor: Actor,
  operation: string,
  handler: () => Promise<T>,
  onSuccess: (result: T) => Record<string, unknown>,
): Promise<T> {
  return withAuditProxy(pool, {
    operation,
    actorUserId: actor.userId,
    actorRole: actor.role,
    allowedRoles: ["admin"],
    normalizeError: normalizeBillingError,
    onSuccess,
    onError: (error) => ({ reason: error instanceof Error ? error.message : "Unknown error" }),
    handler,
  });
}

export async function listTariffs(pool: Queryable): Promise<TariffView[]> {
  const result = await pool.query<{
    id: number;
    kind: TariffKind;
    sport_id: number | null;
    sport: string | null;
    transport_route_id: number | null;
    route: string | null;
    amount: string | number;
    valid_from: string;
    valid_to: string | null;
    created_at: string;
  }>(
    `SELECT t.id, t.kind, t.sport_id, sp.name AS sport, t.transport_route_id,
            tr.name AS route, t.amount, t.valid_from, t.valid_to, t.created_at
     FROM billing_tariffs t
     LEFT JOIN sports sp ON sp.id = t.sport_id
     LEFT JOIN transport_routes tr ON tr.id = t.transport_route_id
     ORDER BY t.kind, sp.name, tr.name, t.valid_from DESC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    sportId: row.sport_id,
    sport: row.sport,
    transportRouteId: row.transport_route_id,
    route: row.route,
    amount: money(row.amount),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
  }));
}

export interface TariffInput {
  kind: TariffKind;
  sportId?: number | null;
  transportRouteId?: number | null;
  amount: number;
  validFrom?: string;
}

export async function createTariff(
  pool: DatabasePool,
  actor: Actor,
  input: TariffInput,
): Promise<TariffView> {
  return audited(
    pool,
    actor,
    "create_billing_tariff",
    () =>
      withTransaction(pool, async (client) => {
        const scope = await validateTariffScope(client, input);
        const validFrom = input.validFrom ?? todayIso();
        const previous = new Date(`${validFrom}T00:00:00Z`);
        previous.setUTCDate(previous.getUTCDate() - 1);
        const previousDay = previous.toISOString().slice(0, 10);
        const closeParams: unknown[] = [previousDay, input.kind];
        let closeSql = `UPDATE billing_tariffs SET valid_to = $1 WHERE kind = $2 AND valid_to IS NULL`;
        if (scope.sportId !== null) {
          closeParams.push(scope.sportId);
          closeSql += ` AND sport_id = $${closeParams.length}`;
        } else {
          closeSql += " AND sport_id IS NULL";
        }
        if (scope.transportRouteId !== null) {
          closeParams.push(scope.transportRouteId);
          closeSql += ` AND transport_route_id = $${closeParams.length}`;
        } else {
          closeSql += " AND transport_route_id IS NULL";
        }
        await client.query(closeSql, closeParams);
        const result = await client.query<{ id: number }>(
          `INSERT INTO billing_tariffs (kind, sport_id, transport_route_id, amount, valid_from, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            input.kind,
            scope.sportId,
            scope.transportRouteId,
            moneyString(input.amount),
            validFrom,
            actor.userId,
          ],
        );
        return loadTariff(client, result.rows[0].id);
      }),
    (tariff) => ({ tariffId: tariff.id, kind: tariff.kind, amount: tariff.amount }),
  );
}

export async function updateTariff(
  pool: DatabasePool,
  actor: Actor,
  tariffId: number,
  input: { amount?: number; validTo?: string | null },
): Promise<TariffView> {
  return audited(
    pool,
    actor,
    "update_billing_tariff",
    () =>
      withTransaction(pool, async (client) => {
        const current = await client.query<{
          amount: string | number;
          valid_to: string | null;
        }>("SELECT amount, valid_to FROM billing_tariffs WHERE id = $1", [tariffId]);
        if (!current.rows[0]) {
          throw new AppError(404, "La tarifa no existe", "TARIFF_NOT_FOUND");
        }
        const amount = input.amount === undefined ? money(current.rows[0].amount) : input.amount;
        if (amount < 0) {
          throw new AppError(400, "El importe no puede ser negativo", "VALIDATION_ERROR");
        }
        await client.query(
          "UPDATE billing_tariffs SET amount = $1, valid_to = $2 WHERE id = $3",
          [moneyString(amount), input.validTo === undefined ? current.rows[0].valid_to : input.validTo, tariffId],
        );
        return loadTariff(client, tariffId);
      }),
    (tariff) => ({ tariffId: tariff.id, amount: tariff.amount }),
  );
}

async function validateTariffScope(
  client: PoolClient,
  input: TariffInput,
): Promise<{ sportId: number | null; transportRouteId: number | null }> {
  if (!KINDS.includes(input.kind)) {
    throw new AppError(400, "El tipo de tarifa no es válido", "VALIDATION_ERROR");
  }
  if (input.amount < 0) {
    throw new AppError(400, "El importe no puede ser negativo", "VALIDATION_ERROR");
  }
  let sportId: number | null = null;
  let transportRouteId: number | null = null;

  if (input.kind === "sport") {
    if (!input.sportId) {
      throw new AppError(400, "La tarifa de deporte requiere sportId", "VALIDATION_ERROR");
    }
    const sport = await client.query("SELECT 1 FROM sports WHERE id = $1", [input.sportId]);
    if (!sport.rowCount) {
      throw new AppError(404, "El deporte no existe", "SPORT_NOT_FOUND");
    }
    sportId = input.sportId;
  }
  if (input.kind === "transport") {
    if (!input.transportRouteId) {
      throw new AppError(400, "La tarifa de transporte requiere transportRouteId", "VALIDATION_ERROR");
    }
    const route = await client.query("SELECT 1 FROM transport_routes WHERE id = $1", [
      input.transportRouteId,
    ]);
    if (!route.rowCount) {
      throw new AppError(404, "El recorrido no existe", "ROUTE_NOT_FOUND");
    }
    transportRouteId = input.transportRouteId;
  }
  if (input.kind === "monthly" || input.kind === "cafeteria") {
    if (input.sportId || input.transportRouteId) {
      throw new AppError(400, "Esa tarifa no admite deporte ni recorrido", "VALIDATION_ERROR");
    }
  }
  return { sportId, transportRouteId };
}

async function currentTariff(
  client: PoolClient,
  kind: TariffKind,
  date: string,
  reference?: { sportId?: number; routeId?: number },
): Promise<{ id: number; amount: number }> {
  const params: unknown[] = [kind, date];
  let sql = `SELECT id, amount FROM billing_tariffs
             WHERE kind = $1 AND valid_from <= $2
               AND (valid_to IS NULL OR valid_to >= $2)`;
  if (kind === "sport") {
    params.push(reference?.sportId);
    sql += " AND sport_id = $3";
  }
  if (kind === "transport") {
    params.push(reference?.routeId);
    sql += " AND transport_route_id = $3";
  }
  sql += " ORDER BY valid_from DESC, id DESC LIMIT 1";
  const result = await client.query<{ id: number; amount: string | number }>(sql, params);
  const row = result.rows[0];
  if (!row) {
    throw new AppError(
      409,
      `Falta la tarifa ${kind}${reference?.sportId ? ` del deporte ${reference.sportId}` : ""}${
        reference?.routeId ? ` del recorrido ${reference.routeId}` : ""
      } para el período`,
      "TARIFF_MISSING",
    );
  }
  return { id: row.id, amount: money(row.amount) };
}

interface PendingItem {
  kind: TariffKind;
  description: string;
  sportId: number | null;
  transportRouteId: number | null;
  tariffId: number;
  amount: number;
}

async function buildInvoiceItems(
  client: PoolClient,
  studentId: number,
  year: number,
  month: number,
): Promise<PendingItem[]> {
  const date = periodStart(year, month);
  const items: PendingItem[] = [];

  const monthly = await currentTariff(client, "monthly", date);
  items.push({
    kind: "monthly",
    description: `Cuota mensual ${year}-${String(month).padStart(2, "0")}`,
    sportId: null,
    transportRouteId: null,
    tariffId: monthly.id,
    amount: monthly.amount,
  });

  const sports = await client.query<{ id: number; name: string }>(
    `SELECT DISTINCT sp.id, sp.name
     FROM sport_enrollments se
     JOIN sport_groups sg ON sg.id = se.group_id
     JOIN sports sp ON sp.id = sg.sport_id
     WHERE se.student_id = $1 AND sg.active = TRUE
     ORDER BY sp.name`,
    [studentId],
  );
  for (const sport of sports.rows) {
    const tariff = await currentTariff(client, "sport", date, { sportId: sport.id });
    items.push({
      kind: "sport",
      description: sport.name,
      sportId: sport.id,
      transportRouteId: null,
      tariffId: tariff.id,
      amount: tariff.amount,
    });
  }

  const transport = await client.query<{ id: number; name: string }>(
    `SELECT tr.id, tr.name
     FROM transport_enrollments te
     JOIN transport_routes tr ON tr.id = te.route_id
     WHERE te.student_id = $1`,
    [studentId],
  );
  for (const route of transport.rows) {
    const tariff = await currentTariff(client, "transport", date, { routeId: route.id });
    items.push({
      kind: "transport",
      description: `Transporte · ${route.name}`,
      sportId: null,
      transportRouteId: route.id,
      tariffId: tariff.id,
      amount: tariff.amount,
    });
  }

  const cafeteria = await client.query(
    "SELECT 1 FROM cafeteria_enrollments WHERE student_id = $1 AND active = TRUE",
    [studentId],
  );
  if (cafeteria.rowCount) {
    const tariff = await currentTariff(client, "cafeteria", date);
    items.push({
      kind: "cafeteria",
      description: "Comedor",
      sportId: null,
      transportRouteId: null,
      tariffId: tariff.id,
      amount: tariff.amount,
    });
  }

  return items;
}

export async function generateInvoices(
  pool: DatabasePool,
  actor: Actor,
  input: { year: number; month: number; dueDate?: string },
): Promise<InvoiceGenerationResult> {
  if (input.month < 1 || input.month > 12) {
    throw new AppError(400, "El mes debe estar entre 1 y 12", "VALIDATION_ERROR");
  }
  return audited(
    pool,
    actor,
    "generate_invoices",
    () =>
      withTransaction(pool, async (client) => {
        const students = await client.query<{ id: number }>(
          "SELECT id FROM students WHERE status = 'active' ORDER BY id",
        );
        const createdIds: number[] = [];
        let skipped = 0;
        const dueDate = input.dueDate ?? defaultDueDate(input.year, input.month);

        for (const student of students.rows) {
          const existing = await client.query(
            "SELECT 1 FROM invoices WHERE student_id = $1 AND period_year = $2 AND period_month = $3",
            [student.id, input.year, input.month],
          );
          if (existing.rowCount) {
            skipped += 1;
            continue;
          }
          const items = await buildInvoiceItems(client, student.id, input.year, input.month);
          const total = items.reduce((sum, item) => sum + item.amount, 0);
          const invoiceResult = await client.query<{ id: number }>(
            `INSERT INTO invoices
               (student_id, period_year, period_month, due_date, total_amount, status, created_by)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6)
             RETURNING id`,
            [student.id, input.year, input.month, dueDate, moneyString(total), actor.userId],
          );
          const invoiceId = invoiceResult.rows[0].id;
          for (const item of items) {
            await client.query(
              `INSERT INTO invoice_items
                 (invoice_id, kind, description, sport_id, transport_route_id, tariff_id, amount)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                invoiceId,
                item.kind,
                item.description,
                item.sportId,
                item.transportRouteId,
                item.tariffId,
                moneyString(item.amount),
              ],
            );
          }
          createdIds.push(invoiceId);
        }

        const invoices: InvoiceView[] = [];
        for (const id of createdIds) {
          invoices.push(await loadInvoice(client, id));
        }
        return {
          periodYear: input.year,
          periodMonth: input.month,
          created: createdIds.length,
          skipped,
          invoices,
        };
      }),
    (result) => ({
      periodYear: result.periodYear,
      periodMonth: result.periodMonth,
      created: result.created,
      skipped: result.skipped,
    }),
  );
}

export async function listInvoices(
  pool: Queryable,
  filters: { year?: number; month?: number; studentId?: number } = {},
): Promise<InvoiceView[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.year !== undefined) {
    params.push(filters.year);
    conditions.push(`period_year = $${params.length}`);
  }
  if (filters.month !== undefined) {
    params.push(filters.month);
    conditions.push(`period_month = $${params.length}`);
  }
  if (filters.studentId !== undefined) {
    params.push(filters.studentId);
    conditions.push(`student_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM invoices ${where} ORDER BY period_year DESC, period_month DESC, id DESC`,
    params,
  );
  const invoices: InvoiceView[] = [];
  for (const row of result.rows) {
    invoices.push(await loadInvoice(pool, row.id));
  }
  return invoices;
}

export async function getInvoice(pool: Queryable, invoiceId: number): Promise<InvoiceView> {
  return loadInvoice(pool, invoiceId);
}

export async function getChildBillingSummary(
  pool: Queryable,
  userId: number,
  studentId: number,
): Promise<BillingSummary> {
  await assertChildAssociation(pool, userId, studentId);
  const student = await pool.query<{ full_name: string }>(
    "SELECT full_name FROM students WHERE id = $1",
    [studentId],
  );
  if (!student.rows[0]) {
    throw new AppError(404, "El alumno no existe", "STUDENT_NOT_FOUND");
  }
  const invoices = await listInvoices(pool, { studentId });
  const active = invoices.filter((invoice) => invoice.status !== "cancelled");
  const totalPending = active
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + invoice.balance, 0);
  const totalOverdue = active
    .filter((invoice) => invoice.displayStatus === "overdue")
    .reduce((sum, invoice) => sum + invoice.balance, 0);
  const totalPaid = active.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  return {
    studentId,
    studentName: student.rows[0].full_name,
    totalPending: money(totalPending),
    totalOverdue: money(totalOverdue),
    totalPaid: money(totalPaid),
    currentInvoice: active[0] ?? null,
    invoices,
  };
}

export async function getInvoiceForParent(
  pool: Queryable,
  userId: number,
  invoiceId: number,
): Promise<InvoiceView> {
  const invoice = await loadInvoice(pool, invoiceId);
  await assertChildAssociation(pool, userId, invoice.studentId);
  return invoice;
}

export async function listChildInvoices(
  pool: Queryable,
  userId: number,
  studentId: number,
  from?: string,
  to?: string,
): Promise<InvoiceView[]> {
  await assertChildAssociation(pool, userId, studentId);
  const invoices = await listInvoices(pool, { studentId });
  return invoices.filter((invoice) => {
    if (from && invoice.issueDate < from) return false;
    if (to && invoice.issueDate > to) return false;
    return true;
  });
}

export async function getReceiptFileInfo(
  pool: Queryable,
  receiptId: number,
): Promise<{
  filePath: string;
  fileName: string;
  mimeType: string;
  uploadedBy: number;
  invoiceId: number;
}> {
  const result = await pool.query<{
    file_path: string;
    file_name: string;
    mime_type: string;
    uploaded_by: number;
    invoice_id: number;
  }>(
    "SELECT file_path, file_name, mime_type, uploaded_by, invoice_id FROM payment_receipts WHERE id = $1",
    [receiptId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, "El comprobante no existe", "RECEIPT_NOT_FOUND");
  }
  return {
    filePath: row.file_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    uploadedBy: row.uploaded_by,
    invoiceId: row.invoice_id,
  };
}

export async function createPaymentReceipt(
  pool: DatabasePool,
  actor: Actor,
  invoiceId: number,
  itemIds: number[],
  file: ReceiptFileInput,
): Promise<ReceiptView> {
  if (itemIds.length === 0) {
    throw new AppError(400, "Debe seleccionar al menos un ítem", "VALIDATION_ERROR");
  }
  return withAuditProxy(pool, {
    operation: "upload_payment_receipt",
    actorUserId: actor.userId,
    actorRole: actor.role,
    allowedRoles: ["parent"],
    normalizeError: normalizeBillingError,
    onSuccess: (receipt) => ({
      receiptId: receipt.id,
      invoiceId,
      claimedAmount: receipt.claimedAmount,
    }),
    onError: (error) => ({ invoiceId, reason: error instanceof Error ? error.message : "Unknown error" }),
    handler: () =>
      withTransaction(pool, async (client) => {
        const invoice = await loadInvoice(client, invoiceId);
        await assertChildAssociation(client, actor.userId, invoice.studentId);
        if (invoice.status === "paid" || invoice.status === "cancelled") {
          throw new AppError(409, "La factura ya está paga o cancelada", "INVOICE_NOT_PAYABLE");
        }

        const uniqueItems = [...new Set(itemIds)];
        let claimed = 0;
        for (const itemId of uniqueItems) {
          const item = await client.query<{
            id: number;
            invoice_id: number;
            amount: string | number;
            paid_amount: string | number;
            status: string;
          }>(
            "SELECT id, invoice_id, amount, paid_amount, status FROM invoice_items WHERE id = $1",
            [itemId],
          );
          const row = item.rows[0];
          if (!row || row.invoice_id !== invoiceId) {
            throw new AppError(404, "El ítem no pertenece a la factura", "INVOICE_ITEM_NOT_FOUND");
          }
          if (row.status === "paid") {
            throw new AppError(409, "El ítem ya está pago", "ITEM_ALREADY_PAID");
          }
          claimed += money(row.amount) - money(row.paid_amount);
        }

        const receiptResult = await client.query<{ id: number }>(
          `INSERT INTO payment_receipts
             (invoice_id, uploaded_by, file_name, file_path, mime_type, size_bytes, claimed_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
           RETURNING id`,
          [
            invoiceId,
            actor.userId,
            file.fileName,
            file.filePath,
            file.mimeType,
            file.sizeBytes,
            moneyString(claimed),
          ],
        );
        const receiptId = receiptResult.rows[0].id;
        for (const itemId of uniqueItems) {
          await client.query(
            "INSERT INTO payment_receipt_items (receipt_id, invoice_item_id) VALUES ($1, $2)",
            [receiptId, itemId],
          );
        }

        await safeNotify(client, actor.userId, {
          type: "receipt_pending",
          title: "Comprobante recibido",
          body: "Tu comprobante quedó pendiente de validación administrativa.",
          metadata: { receiptId, invoiceId, claimedAmount: money(claimed) },
        });
        const admins = await client.query<{ id: number }>(
          "SELECT id FROM users WHERE role = 'admin' AND status = 'active'",
        );
        for (const admin of admins.rows) {
          await safeNotify(client, admin.id, {
            type: "receipt_review",
            title: "Comprobante pendiente de validación",
            body: `${invoice.studentName} subió un comprobante por $${money(claimed).toFixed(2)}.`,
            metadata: { receiptId, invoiceId },
          });
        }

        return loadReceipt(client, receiptId);
      }),
  });
}

export async function listReceipts(
  pool: Queryable,
  filters: { status?: "pending" | "approved" | "rejected" } = {},
): Promise<Array<ReceiptView & { studentName: string; periodYear: number; periodMonth: number }>> {
  const params: unknown[] = [];
  let where = "";
  if (filters.status) {
    params.push(filters.status);
    where = "WHERE r.status = $1";
  }
  const result = await pool.query<ReceiptRow & { student_name: string; period_year: number; period_month: number }>(
    `SELECT r.*, st.full_name AS student_name, i.period_year, i.period_month
     FROM payment_receipts r
     JOIN invoices i ON i.id = r.invoice_id
     JOIN students st ON st.id = i.student_id
     ${where}
     ORDER BY r.created_at DESC, r.id DESC`,
    params,
  );
  const receipts: Array<ReceiptView & { studentName: string; periodYear: number; periodMonth: number }> = [];
  for (const row of result.rows) {
    const receipt = await loadReceipt(pool, row.id);
    receipts.push({
      ...receipt,
      studentName: row.student_name,
      periodYear: row.period_year,
      periodMonth: row.period_month,
    });
  }
  return receipts;
}

export async function approveReceipt(
  pool: DatabasePool,
  actor: Actor,
  receiptId: number,
): Promise<{ receipt: ReceiptView; invoice: InvoiceView }> {
  return audited(
    pool,
    actor,
    "approve_payment_receipt",
    () =>
      withTransaction(pool, async (client) => {
        const receiptResult = await client.query<ReceiptRow>(
          "SELECT * FROM payment_receipts WHERE id = $1 FOR UPDATE",
          [receiptId],
        );
        const receipt = receiptResult.rows[0];
        if (!receipt) {
          throw new AppError(404, "El comprobante no existe", "RECEIPT_NOT_FOUND");
        }
        if (receipt.status !== "pending") {
          throw new AppError(409, "El comprobante ya fue revisado", "RECEIPT_NOT_PENDING");
        }

        const itemsResult = await client.query<{
          id: number;
          amount: string | number;
          paid_amount: string | number;
          status: string;
        }>(
          `SELECT ii.id, ii.amount, ii.paid_amount, ii.status
           FROM payment_receipt_items pri
           JOIN invoice_items ii ON ii.id = pri.invoice_item_id
           WHERE pri.receipt_id = $1
           ORDER BY ii.id`,
          [receiptId],
        );
        if (itemsResult.rows.length === 0) {
          throw new AppError(409, "El comprobante no tiene ítems asociados", "RECEIPT_WITHOUT_ITEMS");
        }

        let paymentAmount = 0;
        const allocations: Array<{ itemId: number; amount: number }> = [];
        for (const item of itemsResult.rows) {
          const pending = money(item.amount) - money(item.paid_amount);
          if (pending <= 0) {
            continue;
          }
          paymentAmount += pending;
          allocations.push({ itemId: item.id, amount: pending });
        }
        if (allocations.length === 0) {
          throw new AppError(409, "Los ítems ya están pagos", "ITEMS_ALREADY_PAID");
        }

        const paymentResult = await client.query<{ id: number }>(
          `INSERT INTO payments (receipt_id, invoice_id, amount, approved_by)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [receiptId, receipt.invoice_id, moneyString(paymentAmount), actor.userId],
        );
        const paymentId = paymentResult.rows[0].id;

        for (const allocation of allocations) {
          await client.query(
            `INSERT INTO payment_allocations (payment_id, invoice_item_id, amount)
             VALUES ($1, $2, $3)`,
            [paymentId, allocation.itemId, moneyString(allocation.amount)],
          );
          await client.query(
            `UPDATE invoice_items
             SET paid_amount = amount, status = 'paid'
             WHERE id = $1`,
            [allocation.itemId],
          );
        }

        await client.query(
          `UPDATE payment_receipts
           SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
           WHERE id = $2`,
          [actor.userId, receiptId],
        );

        await recalculateInvoice(client, receipt.invoice_id);
        await safeNotify(client, receipt.uploaded_by, {
          type: "receipt_approved",
          title: "Pago acreditado",
          body: `Se aprobó tu comprobante por $${money(paymentAmount).toFixed(2)}.`,
          metadata: { receiptId, paymentId },
        });

        return {
          receipt: await loadReceipt(client, receiptId),
          invoice: await loadInvoice(client, receipt.invoice_id),
        };
      }),
    (result) => ({
      receiptId: result.receipt.id,
      invoiceId: result.invoice.id,
      amount: result.receipt.claimedAmount,
    }),
  );
}

export async function rejectReceipt(
  pool: DatabasePool,
  actor: Actor,
  receiptId: number,
  reason: string,
): Promise<ReceiptView> {
  return audited(
    pool,
    actor,
    "reject_payment_receipt",
    () =>
      withTransaction(pool, async (client) => {
        const receiptResult = await client.query<ReceiptRow>(
          "SELECT * FROM payment_receipts WHERE id = $1 FOR UPDATE",
          [receiptId],
        );
        const receipt = receiptResult.rows[0];
        if (!receipt) {
          throw new AppError(404, "El comprobante no existe", "RECEIPT_NOT_FOUND");
        }
        if (receipt.status !== "pending") {
          throw new AppError(409, "El comprobante ya fue revisado", "RECEIPT_NOT_PENDING");
        }
        await client.query(
          `UPDATE payment_receipts
           SET status = 'rejected', rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
           WHERE id = $3`,
          [reason, actor.userId, receiptId],
        );
        await safeNotify(client, receipt.uploaded_by, {
          type: "receipt_rejected",
          title: "Comprobante rechazado",
          body: reason,
          metadata: { receiptId },
        });
        return loadReceipt(client, receiptId);
      }),
    (receipt) => ({ receiptId: receipt.id, status: receipt.status }),
  );
}

async function recalculateInvoice(client: PoolClient, invoiceId: number): Promise<void> {
  const items = await client.query<{ amount: string | number; paid_amount: string | number }>(
    "SELECT amount, paid_amount FROM invoice_items WHERE invoice_id = $1",
    [invoiceId],
  );
  const total = items.rows.reduce((sum, item) => sum + money(item.amount), 0);
  const paid = items.rows.reduce((sum, item) => sum + money(item.paid_amount), 0);
  const status = paid <= 0 ? "pending" : paid + 0.01 >= total ? "paid" : "partial";
  await client.query(
    "UPDATE invoices SET total_amount = $1, status = $2 WHERE id = $3",
    [moneyString(total), status, invoiceId],
  );
}

async function loadTariff(executor: Queryable, tariffId: number): Promise<TariffView> {
  const result = await executor.query<{
    id: number;
    kind: TariffKind;
    sport_id: number | null;
    sport: string | null;
    transport_route_id: number | null;
    route: string | null;
    amount: string | number;
    valid_from: string;
    valid_to: string | null;
    created_at: string;
  }>(
    `SELECT t.id, t.kind, t.sport_id, sp.name AS sport, t.transport_route_id,
            tr.name AS route, t.amount, t.valid_from, t.valid_to, t.created_at
     FROM billing_tariffs t
     LEFT JOIN sports sp ON sp.id = t.sport_id
     LEFT JOIN transport_routes tr ON tr.id = t.transport_route_id
     WHERE t.id = $1`,
    [tariffId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, "La tarifa no existe", "TARIFF_NOT_FOUND");
  }
  return {
    id: row.id,
    kind: row.kind,
    sportId: row.sport_id,
    sport: row.sport,
    transportRouteId: row.transport_route_id,
    route: row.route,
    amount: money(row.amount),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    createdAt: row.created_at,
  };
}

async function loadReceipt(executor: Queryable, receiptId: number): Promise<ReceiptView> {
  const result = await executor.query<ReceiptRow>(
    "SELECT * FROM payment_receipts WHERE id = $1",
    [receiptId],
  );
  const receipt = result.rows[0];
  if (!receipt) {
    throw new AppError(404, "El comprobante no existe", "RECEIPT_NOT_FOUND");
  }
  const items = await executor.query<{
    invoice_item_id: number;
    description: string;
    amount: string | number;
    paid_amount: string | number;
  }>(
    `SELECT pri.invoice_item_id, ii.description, ii.amount, ii.paid_amount
     FROM payment_receipt_items pri
     JOIN invoice_items ii ON ii.id = pri.invoice_item_id
     WHERE pri.receipt_id = $1
     ORDER BY ii.id`,
    [receiptId],
  );
  return {
    id: receipt.id,
    invoiceId: receipt.invoice_id,
    uploadedBy: receipt.uploaded_by,
    fileName: receipt.file_name,
    mimeType: receipt.mime_type,
    sizeBytes: receipt.size_bytes,
    claimedAmount: money(receipt.claimed_amount),
    status: receipt.status,
    rejectionReason: receipt.rejection_reason,
    reviewedBy: receipt.reviewed_by,
    reviewedAt: receipt.reviewed_at,
    createdAt: receipt.created_at,
    items: items.rows.map((row) => ({
      invoiceItemId: row.invoice_item_id,
      description: row.description,
      amount: money(row.amount),
      paidAmount: money(row.paid_amount),
    })),
  };
}

async function loadInvoice(executor: Queryable, invoiceId: number): Promise<InvoiceView> {
  const result = await executor.query<InvoiceRow>(
    `SELECT i.id, i.student_id, st.full_name AS student_name, i.period_year, i.period_month,
            i.issue_date, i.due_date, i.total_amount, i.status, i.created_at
     FROM invoices i
     JOIN students st ON st.id = i.student_id
     WHERE i.id = $1`,
    [invoiceId],
  );
  const invoice = result.rows[0];
  if (!invoice) {
    throw new AppError(404, "La factura no existe", "INVOICE_NOT_FOUND");
  }

  const itemsResult = await executor.query<ItemRow>(
    `SELECT id, invoice_id, kind, description, sport_id, transport_route_id,
            amount, paid_amount, status
     FROM invoice_items
     WHERE invoice_id = $1
     ORDER BY id`,
    [invoiceId],
  );
  const items: InvoiceItemView[] = itemsResult.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    description: row.description,
    sportId: row.sport_id,
    transportRouteId: row.transport_route_id,
    amount: money(row.amount),
    paidAmount: money(row.paid_amount),
    status: row.status,
  }));
  const paidAmount = items.reduce((sum, item) => sum + item.paidAmount, 0);
  const totalAmount = money(invoice.total_amount);
  const balance = money(totalAmount - paidAmount);

  const receiptsResult = await executor.query<ReceiptRow>(
    `SELECT * FROM payment_receipts WHERE invoice_id = $1 ORDER BY created_at DESC, id DESC`,
    [invoiceId],
  );
  const receipts: ReceiptView[] = [];
  for (const receipt of receiptsResult.rows) {
    receipts.push(await loadReceipt(executor, receipt.id));
  }

  const today = todayIso();
  const displayStatus =
    invoice.status === "paid" || invoice.status === "cancelled"
      ? invoice.status
      : invoice.due_date < today
        ? "overdue"
        : invoice.status;

  return {
    id: invoice.id,
    studentId: invoice.student_id,
    studentName: invoice.student_name,
    periodYear: invoice.period_year,
    periodMonth: invoice.period_month,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    totalAmount,
    paidAmount: money(paidAmount),
    balance,
    status: invoice.status,
    displayStatus,
    items,
    receipts,
  };
}
