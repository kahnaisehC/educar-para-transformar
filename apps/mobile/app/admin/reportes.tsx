import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import type {
  DelinquencyReport,
  IncomeReport,
  PaymentsReport,
  ServicesReport,
} from "../../src/types";
import { money, periodLabel } from "../../src/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  Row,
  Screen,
  SectionTitle,
} from "../../src/ui";
import { colors, spacing } from "../../src/theme";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function monthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
}

export default function AdminReportsScreen() {
  const { token } = useAuth();
  const range = monthRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [income, setIncome] = useState<IncomeReport | null>(null);
  const [payments, setPayments] = useState<PaymentsReport | null>(null);
  const [services, setServices] = useState<ServicesReport | null>(null);
  const [delinquency, setDelinquency] = useState<DelinquencyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const year = from.slice(0, 4);
      const month = from.slice(5, 7);
      const [incomeResult, paymentsResult, servicesResult, delinquencyResult] = await Promise.all([
        apiRequest<{ report: IncomeReport }>(
          `/admin/billing/reports/income?from=${from}&to=${to}`,
          { token },
        ),
        apiRequest<{ report: PaymentsReport }>(
          `/admin/billing/reports/payments?from=${from}&to=${to}`,
          { token },
        ),
        apiRequest<{ report: ServicesReport }>(
          `/admin/billing/reports/services?from=${from}&to=${to}`,
          { token },
        ),
        apiRequest<{ report: DelinquencyReport }>(
          `/admin/billing/delinquency?year=${Number(year)}&month=${Number(month)}`,
          { token },
        ),
      ]);
      setIncome(incomeResult.report);
      setPayments(paymentsResult.report);
      setServices(servicesResult.report);
      setDelinquency(delinquencyResult.report);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <Screen title="Reportes" subtitle="Cobranza, pagos y morosidad del período.">
      <ErrorMessage>{error}</ErrorMessage>
      <Card title="Período">
        <Input label="Desde (AAAA-MM-DD)" value={from} onChangeText={setFrom} />
        <Input label="Hasta (AAAA-MM-DD)" value={to} onChangeText={setTo} />
        <Button label="Generar reportes" onPress={() => void load()} loading={loading} />
      </Card>

      {loading ? <Loading label="Calculando reportes..." /> : null}

      {income ? (
        <Card title="Ingresos">
          <Text style={styles.amount}>{money(income.total)}</Text>
          <Row label="Pagos acreditados" value={String(income.count)} />
          {income.rows.slice(0, 10).map((row) => (
            <Row
              key={row.paymentId}
              label={row.student}
              value={`${money(row.amount)} · ${periodLabel(row.periodYear, row.periodMonth)}`}
            />
          ))}
        </Card>
      ) : null}

      {payments ? (
        <Card title="Pagos completos e incompletos">
          <Row label="Completos" value={String(payments.complete.length)} />
          <Row label="Incompletos" value={String(payments.incomplete.length)} />
          {payments.rows.slice(0, 10).map((row) => (
            <View key={row.invoiceId} style={styles.row}>
              <Text style={styles.rowLabel}>{row.student}</Text>
              <Badge status={row.complete ? "paid" : "pending"} />
            </View>
          ))}
        </Card>
      ) : null}

      {services ? (
        <Card title="Pagos por servicio">
          {services.rows.length === 0 ? (
            <EmptyState title="Sin pagos por servicio" detail="No hay imputaciones en el período." />
          ) : (
            services.rows.slice(0, 15).map((row, index) => (
              <Row
                key={`${row.kind}-${row.service}-${row.student}-${index}`}
                label={`${row.service} · ${row.student}`}
                value={money(row.paidAmount)}
              />
            ))
          )}
        </Card>
      ) : null}

      {delinquency ? (
        <Card title={`Morosidad · ${periodLabel(delinquency.year, delinquency.month)}`}>
          <Row label="Facturado" value={money(delinquency.billed)} />
          <Row label="Cobrado" value={money(delinquency.collected)} />
          <Row label="Pendiente" value={money(delinquency.pending)} />
          <Row label="Cobranza" value={`${Math.round(delinquency.collectionRate * 100)}%`} />
          <Row label="Proyección de deuda" value={money(delinquency.projectedClosingDebt)} />
          <Text style={styles.note}>{delinquency.assumption}</Text>
          <SectionTitle>Evolución</SectionTitle>
          {delinquency.evolution.map((month) => (
            <Row
              key={`${month.periodYear}-${month.periodMonth}`}
              label={periodLabel(month.periodYear, month.periodMonth)}
              value={`${money(month.collected)} / ${money(month.billed)}`}
            />
          ))}
          <SectionTitle>Alumnos con mayor deuda</SectionTitle>
          {delinquency.students.slice(0, 10).map((student) => (
            <Row
              key={student.invoiceId}
              label={student.student}
              value={`${money(student.balance)} · ${student.daysLate} días`}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  amount: { color: colors.deep, fontSize: 26, fontWeight: "900", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eef2f4" },
  rowLabel: { color: colors.ink, fontSize: 13 },
  note: { marginTop: spacing.sm, color: colors.muted, fontSize: 11, lineHeight: 17 },
});
