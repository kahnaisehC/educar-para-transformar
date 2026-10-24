import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import { useChildren } from "../../src/useChildren";
import type { BillingSummary } from "../../src/types";
import { money, periodLabel } from "../../src/format";
import {
  Badge,
  Button,
  Card,
  Choice,
  EmptyState,
  ErrorMessage,
  Loading,
  Row,
  Screen,
  SectionTitle,
} from "../../src/ui";
import { colors, spacing } from "../../src/theme";

export default function ParentHomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const { children, selectedId, setSelectedId, loading, error } = useChildren(token);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || selectedId === null) {
      setSummary(null);
      return;
    }
    let active = true;
    setLoadingSummary(true);
    setSummaryError(null);
    apiRequest<{ summary: BillingSummary }>(`/parent/billing/children/${selectedId}/summary`, {
      token,
    })
      .then((result) => {
        if (active) setSummary(result.summary);
      })
      .catch((requestError) => {
        if (active) setSummaryError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoadingSummary(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, token]);

  if (loading) {
    return (
      <Screen title="Resumen">
        <Loading label="Cargando hijos..." />
      </Screen>
    );
  }

  return (
    <Screen title="Resumen" subtitle="Cuotas, vencimientos y pagos de tus hijos.">
      <ErrorMessage>{error}</ErrorMessage>
      {children.length === 0 ? (
        <EmptyState title="Sin hijos asociados" detail="Administración debe revisar los vínculos de tu cuenta." />
      ) : (
        <>
          {children.length > 1 ? (
            <View style={styles.choices}>
              {children.map((child) => (
                <Choice
                  key={child.id}
                  label={child.fullName}
                  selected={selectedId === child.id}
                  onPress={() => setSelectedId(child.id)}
                />
              ))}
            </View>
          ) : null}

          {loadingSummary ? <Loading label="Cargando estado de cuenta..." /> : null}
          <ErrorMessage>{summaryError}</ErrorMessage>

          {summary ? (
            <>
              <Card title={summary.studentName}>
                <Row label="Pendiente total" value={money(summary.totalPending)} />
                <Row label="Vencido" value={money(summary.totalOverdue)} />
                <Row label="Pagado" value={money(summary.totalPaid)} />
              </Card>

              {summary.currentInvoice ? (
                <Card title={`Factura ${periodLabel(summary.currentInvoice.periodYear, summary.currentInvoice.periodMonth)}`}>
                  <View style={styles.invoiceHeader}>
                    <Text style={styles.invoiceTotal}>{money(summary.currentInvoice.totalAmount)}</Text>
                    <Badge status={summary.currentInvoice.displayStatus} />
                  </View>
                  <Row label="Saldo" value={money(summary.currentInvoice.balance)} />
                  <Row label="Vence" value={summary.currentInvoice.dueDate} />
                  <SectionTitle>Composición</SectionTitle>
                  {summary.currentInvoice.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      <Text style={styles.itemAmount}>{money(item.amount)}</Text>
                    </View>
                  ))}
                  <Button label="Pagar cuotas" onPress={() => router.push("/parent/pagos")} />
                </Card>
              ) : (
                <EmptyState title="Sin facturas" detail="Todavía no hay facturas emitidas para este alumno." />
              )}

              <Button
                label="Ver todas las cuotas"
                variant="secondary"
                onPress={() => router.push("/parent/cuotas")}
              />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  invoiceTotal: { color: colors.deep, fontSize: 24, fontWeight: "900" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eef2f4" },
  itemDescription: { flex: 1, color: colors.ink, fontSize: 13 },
  itemAmount: { color: colors.muted, fontSize: 13, fontWeight: "700" },
});
