import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import { useChildren } from "../../src/useChildren";
import type { BillingSummary, Invoice } from "../../src/types";
import { dateLabel, money, periodLabel } from "../../src/format";
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

export default function ParentInvoicesScreen() {
  const { token } = useAuth();
  const { children, selectedId, setSelectedId, loading } = useChildren(token);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!token || selectedId === null) return;
    let active = true;
    setError(null);
    apiRequest<{ summary: BillingSummary }>(`/parent/billing/children/${selectedId}/summary`, { token })
      .then((result) => {
        if (active) {
          setSummary(result.summary);
          setDetail(null);
        }
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, [selectedId, token]);

  async function openInvoice(invoiceId: number) {
    if (!token) return;
    setLoadingDetail(true);
    setError(null);
    try {
      const result = await apiRequest<{ invoice: Invoice }>(`/parent/billing/invoices/${invoiceId}`, { token });
      setDetail(result.invoice);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loading) {
    return (
      <Screen title="Cuotas">
        <Loading label="Cargando cuotas..." />
      </Screen>
    );
  }

  return (
    <Screen title="Cuotas" subtitle="Facturas pendientes, pagadas y vencidas.">
      <ErrorMessage>{error}</ErrorMessage>
      {children.length === 0 ? (
        <EmptyState title="Sin hijos asociados" detail="No hay cuotas para mostrar." />
      ) : (
        <>
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

          {!summary ? <Loading label="Cargando facturas..." /> : null}
          {summary?.invoices.length === 0 ? (
            <EmptyState title="Sin facturas" detail="No hay facturas emitidas para este alumno." />
          ) : null}

          {summary?.invoices.map((invoice) => (
            <Card key={invoice.id} title={periodLabel(invoice.periodYear, invoice.periodMonth)}>
              <View style={styles.header}>
                <Text style={styles.amount}>{money(invoice.totalAmount)}</Text>
                <Badge status={invoice.displayStatus} />
              </View>
              <Row label="Saldo" value={money(invoice.balance)} />
              <Row label="Vencimiento" value={dateLabel(invoice.dueDate)} />
              <Button
                label={detail?.id === invoice.id ? "Ocultar detalle" : "Ver detalle"}
                variant="secondary"
                onPress={() =>
                  detail?.id === invoice.id ? setDetail(null) : void openInvoice(invoice.id)
                }
              />
              {detail?.id === invoice.id ? (
                <View style={styles.detail}>
                  <SectionTitle>Ítems</SectionTitle>
                  {detail.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemDescription}>{item.description}</Text>
                        <Text style={styles.itemMeta}>
                          Pagado {money(item.paidAmount)} de {money(item.amount)}
                        </Text>
                      </View>
                      <Badge status={item.status} />
                    </View>
                  ))}
                  <SectionTitle>Comprobantes</SectionTitle>
                  {detail.receipts.length === 0 ? (
                    <Text style={styles.note}>No hay comprobantes cargados.</Text>
                  ) : (
                    detail.receipts.map((receipt) => (
                      <View key={receipt.id} style={styles.receiptRow}>
                        <View style={styles.itemCopy}>
                          <Text style={styles.itemDescription}>
                            {money(receipt.claimedAmount)} · {dateLabel(receipt.createdAt)}
                          </Text>
                          {receipt.rejectionReason ? (
                            <Text style={styles.rejection}>{receipt.rejectionReason}</Text>
                          ) : null}
                        </View>
                        <Badge status={receipt.status} />
                      </View>
                    ))
                  )}
                </View>
              ) : null}
            </Card>
          ))}
          {loadingDetail ? <Loading label="Cargando detalle..." /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  amount: { color: colors.deep, fontSize: 22, fontWeight: "900" },
  detail: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "#eef2f4" },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eef2f4" },
  itemCopy: { flex: 1, paddingRight: spacing.sm },
  itemDescription: { color: colors.ink, fontSize: 13 },
  itemMeta: { marginTop: 2, color: colors.muted, fontSize: 11 },
  receiptRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  rejection: { marginTop: 2, color: colors.danger, fontSize: 11 },
  note: { color: colors.muted, fontSize: 12 },
});
