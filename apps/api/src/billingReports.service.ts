import type { Queryable } from "./db.js";

export interface IncomeReportRow {
  paymentId: number;
  amount: number;
  paidAt: string;
  student: string;
  periodYear: number;
  periodMonth: number;
}

export interface IncomeReport {
  from: string;
  to: string;
  total: number;
  count: number;
  rows: IncomeReportRow[];
}

export interface PaymentsReportRow {
  invoiceId: number;
  student: string;
  periodYear: number;
  periodMonth: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: "paid" | "pending" | "partial" | "cancelled";
  complete: boolean;
}

export interface PaymentsReport {
  from: string;
  to: string;
  rows: PaymentsReportRow[];
  complete: PaymentsReportRow[];
  incomplete: PaymentsReportRow[];
}

export interface ServiceReportRow {
  kind: "sport" | "transport";
  student: string;
  level: string;
  course: string;
  service: string;
  weekday: string | null;
  schedule: string | null;
  teacher: string | null;
  paidAmount: number;
}

export interface ServicesReport {
  from: string;
  to: string;
  rows: ServiceReportRow[];
}

export interface DelinquencyInvoice {
  invoiceId: number;
  student: string;
  periodYear: number;
  periodMonth: number;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  daysLate: number;
}

export interface DelinquencyMonth {
  periodYear: number;
  periodMonth: number;
  billed: number;
  collected: number;
  collectionRate: number;
}

export interface DelinquencyReport {
  year: number;
  month: number;
  billed: number;
  collected: number;
  pending: number;
  collectionRate: number;
  projectedClosingDebt: number;
  assumption: string;
  evolution: DelinquencyMonth[];
  students: DelinquencyInvoice[];
}

function money(value: unknown): number {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function weekdayName(value: number | null): string | null {
  if (value === null || value === undefined) return null;
  const names = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
  return names[value - 1] ?? null;
}

function formatTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export async function getIncomeReport(
  pool: Queryable,
  from: string,
  to: string,
): Promise<IncomeReport> {
  const result = await pool.query<{
    id: number;
    amount: string | number;
    created_at: string;
    student: string;
    period_year: number;
    period_month: number;
  }>(
    `SELECT p.id, p.amount, p.created_at, st.full_name AS student,
            i.period_year, i.period_month
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     JOIN students st ON st.id = i.student_id
     WHERE p.created_at >= $1 AND p.created_at < $2
     ORDER BY p.created_at, p.id`,
    [from, nextDay(to)],
  );
  const rows = result.rows.map((row) => ({
    paymentId: row.id,
    amount: money(row.amount),
    paidAt: row.created_at,
    student: row.student,
    periodYear: row.period_year,
    periodMonth: row.period_month,
  }));
  return {
    from,
    to,
    total: money(rows.reduce((sum, row) => sum + row.amount, 0)),
    count: rows.length,
    rows,
  };
}

export async function getPaymentsReport(
  pool: Queryable,
  from: string,
  to: string,
): Promise<PaymentsReport> {
  const result = await pool.query<{
    id: number;
    student: string;
    period_year: number;
    period_month: number;
    total_amount: string | number;
    paid_amount: string | number;
    status: "paid" | "pending" | "partial" | "cancelled";
  }>(
    `SELECT i.id, st.full_name AS student, i.period_year, i.period_month,
            i.total_amount, COALESCE(SUM(ii.paid_amount), 0) AS paid_amount, i.status
     FROM invoices i
     JOIN students st ON st.id = i.student_id
     LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.issue_date >= $1 AND i.issue_date <= $2
     GROUP BY i.id, st.full_name, i.period_year, i.period_month, i.total_amount, i.status
     ORDER BY i.period_year, i.period_month, st.full_name`,
    [from, to],
  );
  const rows: PaymentsReportRow[] = result.rows.map((row) => {
    const totalAmount = money(row.total_amount);
    const paidAmount = money(row.paid_amount);
    const balance = money(totalAmount - paidAmount);
    return {
      invoiceId: row.id,
      student: row.student,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      totalAmount,
      paidAmount,
      balance,
      status: row.status,
      complete: row.status === "paid" || balance <= 0,
    };
  });
  return {
    from,
    to,
    rows,
    complete: rows.filter((row) => row.complete),
    incomplete: rows.filter((row) => !row.complete),
  };
}

export async function getServicesReport(
  pool: Queryable,
  from: string,
  to: string,
): Promise<ServicesReport> {
  const sportRows = await pool.query<{
    student_id: number;
    student: string;
    level: string;
    course: string;
    service: string;
    paid_amount: string | number;
  }>(
    `SELECT st.id AS student_id, st.full_name AS student,
            COALESCE(l.name, 'Pendiente') AS level,
            COALESCE(c.name, 'Pendiente') AS course,
            sp.name AS service, SUM(pa.amount) AS paid_amount
     FROM payment_allocations pa
     JOIN invoice_items ii ON ii.id = pa.invoice_item_id
     JOIN payments p ON p.id = pa.payment_id
     JOIN invoices i ON i.id = p.invoice_id
     JOIN students st ON st.id = i.student_id
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     JOIN sports sp ON sp.id = ii.sport_id
     WHERE ii.kind = 'sport' AND p.created_at >= $1 AND p.created_at < $2
     GROUP BY st.id, st.full_name, l.name, c.name, sp.name
     ORDER BY sp.name, st.full_name`,
    [from, nextDay(to)],
  );

  const transportRows = await pool.query<{
    student_id: number;
    student: string;
    level: string;
    course: string;
    service: string;
    paid_amount: string | number;
  }>(
    `SELECT st.id AS student_id, st.full_name AS student,
            COALESCE(l.name, 'Pendiente') AS level,
            COALESCE(c.name, 'Pendiente') AS course,
            tr.name AS service, SUM(pa.amount) AS paid_amount
     FROM payment_allocations pa
     JOIN invoice_items ii ON ii.id = pa.invoice_item_id
     JOIN payments p ON p.id = pa.payment_id
     JOIN invoices i ON i.id = p.invoice_id
     JOIN students st ON st.id = i.student_id
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     JOIN transport_routes tr ON tr.id = ii.transport_route_id
     WHERE ii.kind = 'transport' AND p.created_at >= $1 AND p.created_at < $2
     GROUP BY st.id, st.full_name, l.name, c.name, tr.name
     ORDER BY tr.name, st.full_name`,
    [from, nextDay(to)],
  );

  const rows: ServiceReportRow[] = [];
  for (const row of sportRows.rows) {
    const group = await pool.query<{
      weekday: number;
      start_time: string;
      end_time: string;
      teacher: string | null;
    }>(
      `SELECT sg.weekday, sg.start_time, sg.end_time, t.full_name AS teacher
       FROM sport_enrollments se
       JOIN sport_groups sg ON sg.id = se.group_id
       JOIN sports sp ON sp.id = sg.sport_id
       LEFT JOIN teachers t ON t.id = sg.teacher_id
       WHERE se.student_id = $1 AND sp.name = $2
       ORDER BY sg.weekday, sg.start_time
       LIMIT 1`,
      [row.student_id, row.service],
    );
    const slot = group.rows[0];
    rows.push({
      kind: "sport",
      student: row.student,
      level: row.level,
      course: row.course,
      service: row.service,
      weekday: weekdayName(slot?.weekday ?? null),
      schedule: slot ? `${formatTime(slot.start_time)}-${formatTime(slot.end_time)}` : null,
      teacher: slot?.teacher ?? null,
      paidAmount: money(row.paid_amount),
    });
  }
  for (const row of transportRows.rows) {
    rows.push({
      kind: "transport",
      student: row.student,
      level: row.level,
      course: row.course,
      service: row.service,
      weekday: null,
      schedule: null,
      teacher: null,
      paidAmount: money(row.paid_amount),
    });
  }
  return { from, to, rows };
}

export async function getDelinquencyReport(
  pool: Queryable,
  year: number,
  month: number,
): Promise<DelinquencyReport> {
  const current = await loadPeriodInvoices(pool, year, month);
  const billed = money(current.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
  const collected = money(current.reduce((sum, invoice) => sum + invoice.paidAmount, 0));
  const pending = money(billed - collected);
  const collectionRate = billed > 0 ? Math.round((collected / billed) * 10000) / 10000 : 0;

  const evolution: DelinquencyMonth[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - offset, 1));
    const periodYear = date.getUTCFullYear();
    const periodMonth = date.getUTCMonth() + 1;
    const invoices = await loadPeriodInvoices(pool, periodYear, periodMonth);
    const periodBilled = money(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
    const periodCollected = money(invoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0));
    evolution.push({
      periodYear,
      periodMonth,
      billed: periodBilled,
      collected: periodCollected,
      collectionRate:
        periodBilled > 0 ? Math.round((periodCollected / periodBilled) * 10000) / 10000 : 0,
    });
  }

  const today = new Date();
  const students: DelinquencyInvoice[] = current
    .filter((invoice) => invoice.balance > 0 && invoice.status !== "cancelled")
    .map((invoice) => {
      const due = new Date(`${invoice.dueDate}T00:00:00Z`);
      const daysLate = Math.max(
        0,
        Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - due.getTime()) / 86400000),
      );
      return {
        invoiceId: invoice.invoiceId,
        student: invoice.student,
        periodYear: invoice.periodYear,
        periodMonth: invoice.periodMonth,
        dueDate: invoice.dueDate,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        balance: invoice.balance,
        status: invoice.status,
        daysLate,
      };
    })
    .sort((a, b) => b.balance - a.balance);

  return {
    year,
    month,
    billed,
    collected,
    pending,
    collectionRate,
    projectedClosingDebt: money(pending * (1 - collectionRate)),
    assumption:
      "Se proyecta que al cierre del mes se cobrará el mismo porcentaje observado hasta la fecha.",
    evolution,
    students,
  };
}

async function loadPeriodInvoices(
  pool: Queryable,
  year: number,
  month: number,
): Promise<
  Array<{
    invoiceId: number;
    student: string;
    periodYear: number;
    periodMonth: number;
    dueDate: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    status: string;
  }>
> {
  const result = await pool.query<{
    id: number;
    student: string;
    period_year: number;
    period_month: number;
    due_date: string;
    total_amount: string | number;
    paid_amount: string | number;
    status: string;
  }>(
    `SELECT i.id, st.full_name AS student, i.period_year, i.period_month, i.due_date,
            i.total_amount, COALESCE(SUM(ii.paid_amount), 0) AS paid_amount, i.status
     FROM invoices i
     JOIN students st ON st.id = i.student_id
     LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.period_year = $1 AND i.period_month = $2
     GROUP BY i.id, st.full_name, i.period_year, i.period_month, i.due_date, i.total_amount, i.status
     ORDER BY st.full_name`,
    [year, month],
  );
  return result.rows.map((row) => {
    const totalAmount = money(row.total_amount);
    const paidAmount = money(row.paid_amount);
    return {
      invoiceId: row.id,
      student: row.student,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      dueDate: row.due_date,
      totalAmount,
      paidAmount,
      balance: money(totalAmount - paidAmount),
      status: row.status,
    };
  });
}
