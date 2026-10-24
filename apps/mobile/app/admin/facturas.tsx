import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import type { Invoice } from "../../src/types";
import { dateLabel, money, periodLabel } from "../../src/format";
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

export default function AdminInvoicesScreen() {
  const { token } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [dueDate, setDueDate] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ invoices: Invoice[] }>(
        `/admin/billing/invoices?year=${Number(year)}&month=${Number(month)}`,
        { token },
      );
      setInvoices(result.invoices);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, year, month]);

  async function generate() {
    if (!token) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ created: number; skipped: number; invoices: Invoice[] }>(
        "/admin/billing/invoices/generate",
        {
          method: "POST",
          token,
          body: {
            year: Number(year),
            month: Number(month),
            ...(dueDate ? { dueDate } : {}),
          },
        },
      );
      setMessage(`Facturas creadas: ${result.created}. Omitidas: ${result.skipped}.`);
      setInvoices(result.invoices);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Screen title="Facturas" subtitle="Emisión mensual y consulta de facturas por período.">
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <ErrorMessage>{error}</ErrorMessage>

      <Card title="Emitir facturas">
        <Input label="Año" value={year} onChangeText={setYear} keyboardType="number-pad" />
        <Input label="Mes" value={month} onChangeText={setMonth} keyboardType="number-pad" />
        <Input
          label="Vencimiento (opcional, AAAA-MM-DD)"
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="2026-11-10"
        />
        <Button
          label={generating ? "Generando..." : "Generar facturas del período"}
          onPress={() => void generate()}
          loading={generating}
        />
      </Card>

      <Button label="Actualizar listado" variant="secondary" onPress={() => void load()} />

      {loading ? <Loading label="Cargando facturas..." /> : null}
      {!loading && invoices.length === 0 ? (
        <EmptyState title="Sin facturas" detail="No hay facturas emitidas para ese período." />
      ) : null}

      {invoices.map((invoice) => (
        <Card key={invoice.id} title={invoice.studentName}>
          <View style={styles.header}>
            <Text style={styles.period}>
              {periodLabel(invoice.periodYear, invoice.periodMonth)}
            </Text>
            <Badge status={invoice.displayStatus} />
          </View>
          <Row label="Total" value={money(invoice.totalAmount)} />
          <Row label="Pagado" value={money(invoice.paidAmount)} />
          <Row label="Saldo" value={money(invoice.balance)} />
          <Row label="Vencimiento" value={dateLabel(invoice.dueDate)} />
          <Button
            label={detail?.id === invoice.id ? "Ocultar detalle" : "Ver detalle"}
            variant="secondary"
            onPress={() => setDetail(detail?.id === invoice.id ? null : invoice)}
          />
          {detail?.id === invoice.id ? (
            <>
              <SectionTitle>Ítems</SectionTitle>
              {detail.items.map((item) => (
                <Row key={item.id} label={item.description} value={money(item.amount)} />
              ))}
              <SectionTitle>Comprobantes</SectionTitle>
              {detail.receipts.length === 0 ? (
                <Text style={styles.note}>Sin comprobantes.</Text>
              ) : (
                detail.receipts.map((receipt) => (
                  <Row
                    key={receipt.id}
                    label={`${money(receipt.claimedAmount)} · ${dateLabel(receipt.createdAt)}`}
                    value={receipt.status}
                  />
                ))
              )}
            </>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  period: { color: colors.deep, fontSize: 16, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 12 },
});
