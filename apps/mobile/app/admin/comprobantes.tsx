import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import type { AdminReceipt } from "../../src/types";
import { dateTimeLabel, money, periodLabel } from "../../src/format";
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
} from "../../src/ui";
import { colors, spacing } from "../../src/theme";

export default function AdminReceiptsScreen() {
  const { token } = useAuth();
  const [receipts, setReceipts] = useState<AdminReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ receipts: AdminReceipt[] }>(
        "/admin/billing/receipts?status=pending",
        { token },
      );
      setReceipts(result.receipts);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function approve(receiptId: number) {
    if (!token) return;
    setBusyId(receiptId);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/admin/billing/receipts/${receiptId}/approve`, { method: "POST", token });
      setMessage("Comprobante aprobado y pago imputado.");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(receiptId: number) {
    if (!token || !reason.trim()) return;
    setBusyId(receiptId);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/admin/billing/receipts/${receiptId}/reject`, {
        method: "POST",
        token,
        body: { reason: reason.trim() },
      });
      setMessage("Comprobante rechazado.");
      setRejectingId(null);
      setReason("");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Screen title="Comprobantes">
        <Loading label="Cargando comprobantes..." />
      </Screen>
    );
  }

  return (
    <Screen title="Comprobantes" subtitle="Validación de transferencias cargadas por las familias.">
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <ErrorMessage>{error}</ErrorMessage>
      {receipts.length === 0 ? (
        <EmptyState title="Sin comprobantes pendientes" detail="Todas las transferencias fueron revisadas." />
      ) : (
        receipts.map((receipt) => (
          <Card key={receipt.id} title={receipt.studentName}>
            <View style={styles.header}>
              <Text style={styles.amount}>{money(receipt.claimedAmount)}</Text>
              <Badge status={receipt.status} />
            </View>
            <Row label="Período" value={periodLabel(receipt.periodYear, receipt.periodMonth)} />
            <Row label="Archivo" value={receipt.fileName} />
            <Row label="Cargado" value={dateTimeLabel(receipt.createdAt)} />
            <Text style={styles.itemsTitle}>Ítems reclamados</Text>
            {receipt.items.map((item) => (
              <Row key={item.invoiceItemId} label={item.description} value={money(item.amount)} />
            ))}

            {rejectingId === receipt.id ? (
              <>
                <Input label="Motivo del rechazo" value={reason} onChangeText={setReason} />
                <Button
                  label="Confirmar rechazo"
                  variant="danger"
                  onPress={() => void reject(receipt.id)}
                  loading={busyId === receipt.id}
                  disabled={!reason.trim()}
                />
                <Button
                  label="Cancelar"
                  variant="secondary"
                  onPress={() => {
                    setRejectingId(null);
                    setReason("");
                  }}
                />
              </>
            ) : (
              <>
                <Button
                  label="Aprobar comprobante"
                  onPress={() => void approve(receipt.id)}
                  loading={busyId === receipt.id}
                />
                <Button
                  label="Rechazar"
                  variant="secondary"
                  onPress={() => {
                    setRejectingId(receipt.id);
                    setReason("");
                  }}
                />
              </>
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  amount: { color: colors.deep, fontSize: 22, fontWeight: "900" },
  itemsTitle: { marginTop: spacing.md, marginBottom: spacing.xs, color: colors.deep, fontSize: 13, fontWeight: "800" },
});
