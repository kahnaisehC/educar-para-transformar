import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import { useChildren } from "../../src/useChildren";
import type { BillingSummary } from "../../src/types";
import { dateLabel, money, periodLabel } from "../../src/format";
import { Badge, Button, Card, Choice, EmptyState, ErrorMessage, Loading, Screen } from "../../src/ui";
import { sharePaymentReceipt } from "../../src/downloads";
import { colors, spacing } from "../../src/theme";

export default function ParentHistoryScreen() {
  const { token } = useAuth();
  const { children, selectedId, setSelectedId, loading } = useChildren(token);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<number | null>(null);

  useEffect(() => {
    if (!token || selectedId === null) return;
    let active = true;
    setError(null);
    apiRequest<{ summary: BillingSummary }>(`/parent/billing/children/${selectedId}/summary`, { token })
      .then((result) => {
        if (active) setSummary(result.summary);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, [selectedId, token]);

  async function downloadReceipt(receiptId: number, paymentId: number, number: string | null) {
    if (!token) return;
    setSharingId(receiptId);
    setNotice(null);
    try {
      await sharePaymentReceipt(paymentId, token, number);
    } catch (requestError) {
      setNotice(getErrorMessage(requestError));
    } finally {
      setSharingId(null);
    }
  }

  if (loading) {
    return (
      <Screen title="Historial">
        <Loading label="Cargando historial..." />
      </Screen>
    );
  }

  return (
    <Screen title="Historial" subtitle="Comprobantes cargados y facturas por período.">
      <ErrorMessage>{error}</ErrorMessage>
      {notice ? <Text style={styles.error}>{notice}</Text> : null}
      {children.length === 0 ? (
        <EmptyState title="Sin hijos asociados" detail="No hay historial para mostrar." />
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
          {summary?.invoices.map((invoice) => (
            <Card key={invoice.id} title={periodLabel(invoice.periodYear, invoice.periodMonth)}>
              <View style={styles.header}>
                <Text style={styles.amount}>{money(invoice.totalAmount)}</Text>
                <Badge status={invoice.displayStatus} />
              </View>
              {invoice.receipts.length === 0 ? (
                <Text style={styles.note}>Sin comprobantes cargados.</Text>
              ) : (
                invoice.receipts.map((receipt) => (
                  <View key={receipt.id} style={styles.receiptBlock}>
                    <View style={styles.receiptRow}>
                      <View style={styles.copy}>
                        <Text style={styles.description}>
                          {money(receipt.claimedAmount)} · {dateLabel(receipt.createdAt)}
                        </Text>
                        <Text style={styles.meta}>{receipt.fileName}</Text>
                        {receipt.rejectionReason ? (
                          <Text style={styles.rejection}>{receipt.rejectionReason}</Text>
                        ) : null}
                      </View>
                      <Badge status={receipt.status} />
                    </View>
                    {receipt.payment ? (
                      <Button
                        label={
                          sharingId === receipt.id
                            ? "Generando comprobante..."
                            : `Comprobante ${receipt.payment.number ?? ""}`
                        }
                        variant="secondary"
                        onPress={() =>
                          void downloadReceipt(
                            receipt.id,
                            receipt.payment!.id,
                            receipt.payment!.number,
                          )
                        }
                        loading={sharingId === receipt.id}
                      />
                    ) : null}
                  </View>
                ))
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  amount: { color: colors.deep, fontSize: 20, fontWeight: "900" },
  receiptBlock: { paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: "#eef2f4" },
  receiptRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  copy: { flex: 1, paddingRight: spacing.sm },
  description: { color: colors.ink, fontSize: 13 },
  meta: { marginTop: 2, color: colors.muted, fontSize: 11 },
  rejection: { marginTop: 2, color: colors.danger, fontSize: 11 },
  note: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
});
