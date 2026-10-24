import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import type {
  DelinquencyReport,
  IncomeReport,
  PaymentsReport,
  ServicesReport,
} from "../types";
import {
  EmptyState,
  ErrorState,
  InlineMessage,
  PanelHeading,
  downloadCsv,
  formatDate,
  getErrorMessage,
} from "../ui";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function BillingReports({ token, showDelinquency = true }: { token: string; showDelinquency?: boolean }) {
  const [range, setRange] = useState(monthBounds);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [payments, setPayments] = useState<PaymentsReport | null>(null);
  const [services, setServices] = useState<ServicesReport | null>(null);
  const [delinquency, setDelinquency] = useState<DelinquencyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const year = Number(range.from.slice(0, 4));
      const month = Number(range.from.slice(5, 7));
      const [incomeResult, paymentsResult, servicesResult, delinquencyResult] = await Promise.all([
        apiRequest<{ report: IncomeReport }>(
          `/admin/billing/reports/income?from=${range.from}&to=${range.to}`,
          { token },
        ),
        apiRequest<{ report: PaymentsReport }>(
          `/admin/billing/reports/payments?from=${range.from}&to=${range.to}`,
          { token },
        ),
        apiRequest<{ report: ServicesReport }>(
          `/admin/billing/reports/services?from=${range.from}&to=${range.to}`,
          { token },
        ),
        showDelinquency
          ? apiRequest<{ report: DelinquencyReport }>(
              `/admin/billing/delinquency?year=${year}&month=${month}`,
              { token },
            )
          : Promise.resolve(null),
      ]);
      setIncome(incomeResult.report);
      setPayments(paymentsResult.report);
      setServices(servicesResult.report);
      setDelinquency(delinquencyResult ? delinquencyResult.report : null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  function exportIncome() {
    if (!income) return;
    downloadCsv(
      "ingresos.csv",
      ["Pago", "Fecha", "Alumno", "Período", "Importe"],
      income.rows.map((row) => [
        String(row.paymentId),
        row.paidAt,
        row.student,
        `${row.periodYear}-${pad(row.periodMonth)}`,
        String(row.amount),
      ]),
    );
  }

  function exportPayments() {
    if (!payments) return;
    downloadCsv(
      "pagos.csv",
      ["Factura", "Alumno", "Período", "Total", "Pagado", "Saldo", "Estado", "Completo"],
      payments.rows.map((row) => [
        String(row.invoiceId),
        row.student,
        `${row.periodYear}-${pad(row.periodMonth)}`,
        String(row.totalAmount),
        String(row.paidAmount),
        String(row.balance),
        row.status,
        row.complete ? "Sí" : "No",
      ]),
    );
  }

  function exportServices() {
    if (!services) return;
    downloadCsv(
      "pagos-por-servicio.csv",
      ["Tipo", "Alumno", "Nivel", "Curso", "Servicio", "Día", "Horario", "Docente", "Pagado"],
      services.rows.map((row) => [
        row.kind === "sport" ? "Deporte" : "Transporte",
        row.student,
        row.level,
        row.course,
        row.service,
        row.weekday ?? "",
        row.schedule ?? "",
        row.teacher ?? "",
        String(row.paidAmount),
      ]),
    );
  }

  if (loading) {
    return <div className="detail-loading"><span className="loading-dot" /> Cargando reportes de cobranza...</div>;
  }
  if (error && !income) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <section className="surface-panel">
        <PanelHeading
          eyebrow="RF-MV-20 a RF-MV-25 · Cobranza"
          title="Reportes de cobranza"
          detail="Ingresos, pagos completos e incompletos, servicios y morosidad."
        />
        <div className="filter-grid">
          <label className="field">
            <span>Desde</span>
            <input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} />
          </label>
          <label className="field">
            <span>Hasta</span>
            <input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={() => void load()}>Actualizar reportes</button>
          <button className="secondary-button" type="button" onClick={exportIncome}>Exportar ingresos</button>
          <button className="secondary-button" type="button" onClick={exportPayments}>Exportar pagos</button>
          <button className="secondary-button" type="button" onClick={exportServices}>Exportar servicios</button>
        </div>
      </section>

      {income && (
        <section className="surface-panel report-panel">
          <div className="report-header">
            <div>
              <h3>Ingresos del período</h3>
              <p>{income.count} pagos acreditados · {formatDate(`${range.from}T00:00:00`)} a {formatDate(`${range.to}T00:00:00`)}</p>
            </div>
            <strong className="report-total">${income.total.toLocaleString("es-AR")}</strong>
          </div>
          {income.rows.length === 0 ? (
            <EmptyState title="Sin ingresos" detail="No hay pagos acreditados en el período." compact />
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead><tr><th>Fecha</th><th>Alumno</th><th>Período</th><th>Importe</th></tr></thead>
                <tbody>
                  {income.rows.map((row) => (
                    <tr key={row.paymentId}>
                      <td>{formatDate(row.paidAt)}</td>
                      <td>{row.student}</td>
                      <td>{row.periodYear}-{pad(row.periodMonth)}</td>
                      <td>${row.amount.toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {payments && (
        <section className="surface-panel report-panel">
          <div className="report-header">
            <div>
              <h3>Pagos completos e incompletos</h3>
              <p>{payments.complete.length} completos · {payments.incomplete.length} incompletos</p>
            </div>
          </div>
          {payments.rows.length === 0 ? (
            <EmptyState title="Sin facturas" detail="No hay facturas emitidas en el período." compact />
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead><tr><th>Alumno</th><th>Período</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead>
                <tbody>
                  {payments.rows.map((row) => (
                    <tr key={row.invoiceId}>
                      <td>{row.student}</td>
                      <td>{row.periodYear}-{pad(row.periodMonth)}</td>
                      <td>${row.totalAmount.toLocaleString("es-AR")}</td>
                      <td>${row.paidAmount.toLocaleString("es-AR")}</td>
                      <td>${row.balance.toLocaleString("es-AR")}</td>
                      <td>
                        <span className={`status-chip ${row.complete ? "success-chip" : "inactive-chip"}`}>
                          {row.complete ? "Completo" : "Incompleto"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {services && (
        <section className="surface-panel report-panel">
          <div className="report-header">
            <div>
              <h3>Pagos por servicio</h3>
              <p>Deportes y recorridos de transporte con pagos acreditados.</p>
            </div>
          </div>
          {services.rows.length === 0 ? (
            <EmptyState title="Sin pagos por servicio" detail="No hay imputaciones a deportes o transporte en el período." compact />
          ) : (
            <div className="user-table-wrap">
              <table className="user-table">
                <thead><tr><th>Tipo</th><th>Servicio</th><th>Alumno</th><th>Nivel / curso</th><th>Horario</th><th>Docente</th><th>Pagado</th></tr></thead>
                <tbody>
                  {services.rows.map((row, index) => (
                    <tr key={`${row.kind}-${row.service}-${row.student}-${index}`}>
                      <td>{row.kind === "sport" ? "Deporte" : "Transporte"}</td>
                      <td>{row.service}</td>
                      <td>{row.student}</td>
                      <td>{row.level} · {row.course}</td>
                      <td>{row.weekday ? `${row.weekday} ${row.schedule ?? ""}` : "—"}</td>
                      <td>{row.teacher ?? "—"}</td>
                      <td>${row.paidAmount.toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {delinquency && (
        <section className="surface-panel report-panel">
          <div className="report-header">
            <div>
              <h3>Panel de morosidad · {delinquency.month}/{delinquency.year}</h3>
              <p>{delinquency.assumption}</p>
            </div>
          </div>
          <div className="admin-summary-strip">
            <div className="admin-stat"><strong>${delinquency.billed.toLocaleString("es-AR")}</strong><span>facturado</span></div>
            <div className="admin-stat"><strong>${delinquency.collected.toLocaleString("es-AR")}</strong><span>cobrado</span></div>
            <div className="admin-stat"><strong>{Math.round(delinquency.collectionRate * 100)}%</strong><span>cobranza</span></div>
            <div className="admin-stat"><strong>${delinquency.projectedClosingDebt.toLocaleString("es-AR")}</strong><span>proyección de deuda</span></div>
          </div>
          <div className="report-columns">
            <div>
              <h4>Evolución mensual</h4>
              <div className="user-table-wrap">
                <table className="user-table">
                  <thead><tr><th>Período</th><th>Facturado</th><th>Cobrado</th><th>Cobranza</th></tr></thead>
                  <tbody>
                    {delinquency.evolution.map((row) => (
                      <tr key={`${row.periodYear}-${row.periodMonth}`}>
                        <td>{row.periodYear}-{pad(row.periodMonth)}</td>
                        <td>${row.billed.toLocaleString("es-AR")}</td>
                        <td>${row.collected.toLocaleString("es-AR")}</td>
                        <td>{Math.round(row.collectionRate * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4>Alumnos con mayor deuda</h4>
              {delinquency.students.length === 0 ? (
                <EmptyState title="Sin deudas" detail="No hay saldos pendientes en el período." compact />
              ) : (
                <div className="user-table-wrap">
                  <table className="user-table">
                    <thead><tr><th>Alumno</th><th>Saldo</th><th>Vencimiento</th><th>Atraso</th></tr></thead>
                    <tbody>
                      {delinquency.students.slice(0, 10).map((row) => (
                        <tr key={row.invoiceId}>
                          <td>{row.student}</td>
                          <td>${row.balance.toLocaleString("es-AR")}</td>
                          <td>{formatDate(`${row.dueDate}T00:00:00`)}</td>
                          <td>{row.daysLate > 0 ? `${row.daysLate} días` : "En término"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
