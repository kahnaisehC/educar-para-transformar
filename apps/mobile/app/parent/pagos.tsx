import { useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, apiUpload, getErrorMessage } from "../../src/api";
import { useChildren } from "../../src/useChildren";
import type { BankDetails, BillingSummary, Invoice } from "../../src/types";
import { money, periodLabel } from "../../src/format";
import {
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

interface PickedFile {
  uri: string;
  name: string;
  type: string;
  file?: unknown;
}

export default function ParentPaymentScreen() {
  const { token } = useAuth();
  const { children, selectedId, setSelectedId, loading } = useChildren(token);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ bank: BankDetails }>("/parent/billing/bank-details", { token })
      .then((result) => setBank(result.bank))
      .catch((requestError) => setError(getErrorMessage(requestError)));
  }, [token]);

  useEffect(() => {
    if (!token || selectedId === null) return;
    let active = true;
    setInvoice(null);
    setSelectedItems([]);
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

  async function chooseInvoice(invoiceId: number) {
    if (!token) return;
    setLoadingInvoice(true);
    setError(null);
    setMessage(null);
    setFile(null);
    setSelectedItems([]);
    try {
      const result = await apiRequest<{ invoice: Invoice }>(
        `/parent/billing/invoices/${invoiceId}`,
        { token },
      );
      setInvoice(result.invoice);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingInvoice(false);
    }
  }

  function toggleItem(itemId: number) {
    setSelectedItems((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  const payableItems = invoice?.items.filter((item) => item.status !== "paid") ?? [];
  const total = payableItems
    .filter((item) => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + (item.amount - item.paidAmount), 0);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? "application/pdf",
      file: (asset as { file?: unknown }).file,
    });
  }

  async function upload() {
    if (!token || !invoice || !file || selectedItems.length === 0) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("itemIds", JSON.stringify(selectedItems));
      if (file.file) {
        formData.append("file", file.file as Blob);
      } else {
        formData.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as unknown as Blob);
      }
      await apiUpload(`/parent/billing/invoices/${invoice.id}/receipts`, token, formData);
      setFile(null);
      setSelectedItems([]);
      await chooseInvoice(invoice.id);
      setMessage("Comprobante enviado. Queda pendiente de validación administrativa.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <Screen title="Pagos">
        <Loading label="Cargando cuotas..." />
      </Screen>
    );
  }

  return (
    <Screen title="Pagos" subtitle="Seleccioná los ítems y subí el comprobante de la transferencia.">
      <ErrorMessage>{error}</ErrorMessage>
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {children.length === 0 ? (
        <EmptyState title="Sin hijos asociados" detail="No hay cuotas para pagar." />
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

          {summary ? (
            summary.invoices.filter((entry) => entry.balance > 0 && entry.status !== "cancelled").length === 0 ? (
              <EmptyState title="Todo al día" detail="No hay facturas con saldo pendiente." />
            ) : (
              <Card title="Factura a pagar">
                <View style={styles.choices}>
                  {summary.invoices
                    .filter((entry) => entry.balance > 0 && entry.status !== "cancelled")
                    .map((entry) => (
                      <Choice
                        key={entry.id}
                        label={`${periodLabel(entry.periodYear, entry.periodMonth)} · ${money(entry.balance)}`}
                        selected={invoice?.id === entry.id}
                        onPress={() => void chooseInvoice(entry.id)}
                      />
                    ))}
                </View>
              </Card>
            )
          ) : (
            <Loading label="Cargando facturas..." />
          )}

          {loadingInvoice ? <Loading label="Cargando detalle..." /> : null}

          {invoice ? (
            <>
              <Card title={`Ítems · ${periodLabel(invoice.periodYear, invoice.periodMonth)}`}>
                {payableItems.length === 0 ? (
                  <Text style={styles.note}>Esta factura ya está paga.</Text>
                ) : (
                  payableItems.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemDescription}>{item.description}</Text>
                        <Text style={styles.itemMeta}>
                          Saldo {money(item.amount - item.paidAmount)}
                        </Text>
                      </View>
                      <Choice
                        label={selectedItems.includes(item.id) ? "Seleccionado" : "Seleccionar"}
                        selected={selectedItems.includes(item.id)}
                        onPress={() => toggleItem(item.id)}
                      />
                    </View>
                  ))
                )}
                <SectionTitle>Total seleccionado</SectionTitle>
                <Text style={styles.total}>{money(total)}</Text>
              </Card>

              {bank ? (
                <Card title="Datos para la transferencia">
                  <Row label="Alias" value={bank.alias} />
                  <Row label="CBU" value={bank.cbu} />
                  <Row label="Titular" value={bank.holder} />
                  <Text style={styles.note}>No se aceptan pagos en efectivo.</Text>
                </Card>
              ) : null}

              <Card title="Comprobante">
                <Button
                  label={file ? `Archivo: ${file.name}` : "Adjuntar imagen o PDF"}
                  variant="secondary"
                  onPress={() => void pickFile()}
                />
                <Button
                  label={uploading ? "Enviando..." : "Enviar comprobante"}
                  onPress={() => void upload()}
                  loading={uploading}
                  disabled={selectedItems.length === 0 || !file}
                />
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#eef2f4" },
  itemCopy: { flex: 1, paddingRight: spacing.sm },
  itemDescription: { color: colors.ink, fontSize: 13 },
  itemMeta: { marginTop: 2, color: colors.muted, fontSize: 11 },
  total: { color: colors.deep, fontSize: 26, fontWeight: "900", marginBottom: spacing.sm },
  note: { marginTop: spacing.sm, color: colors.muted, fontSize: 12, lineHeight: 18 },
});
