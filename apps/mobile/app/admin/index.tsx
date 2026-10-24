import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import type { AdminReceipt, DelinquencyReport } from "../../src/types";
import { money, periodLabel } from "../../src/format";
import { Button, Card, ErrorMessage, Loading, Row, Screen, SectionTitle } from "../../src/ui";
import { colors, spacing } from "../../src/theme";

export default function AdminHomeScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [receipts, setReceipts] = useState<AdminReceipt[]>([]);
  const [delinquency, setDelinquency] = useState<DelinquencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const now = new Date();
    let active = true;
    Promise.all([
      apiRequest<{ receipts: AdminReceipt[] }>("/admin/billing/receipts?status=pending", { token }),
      apiRequest<{ report: DelinquencyReport }>(
        `/admin/billing/delinquency?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
        { token },
      ),
    ])
      .then(([receiptsResult, delinquencyResult]) => {
        if (!active) return;
        setReceipts(receiptsResult.receipts);
        setDelinquency(delinquencyResult.report);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <Screen title="Administración">
        <Loading label="Cargando panel..." />
      </Screen>
    );
  }

  const claimed = receipts.reduce((sum, receipt) => sum + receipt.claimedAmount, 0);

  return (
    <Screen
      title="Administración"
      subtitle={`Hola ${user?.displayName ?? ""}. Cobranza y comprobantes del centro.`}
    >
      <ErrorMessage>{error}</ErrorMessage>
      <Card title="Comprobantes pendientes">
        <View style={styles.bigStat}>
          <Text style={styles.bigNumber}>{receipts.length}</Text>
          <Text style={styles.bigLabel}>por validar</Text>
        </View>
        <Row label="Importe reclamado" value={money(claimed)} />
        <Button
          label="Revisar comprobantes"
          onPress={() => router.push("/admin/comprobantes")}
          disabled={user?.role === "director"}
        />
      </Card>

      <Card title={`Cobranza · ${periodLabel(new Date().getFullYear(), new Date().getMonth() + 1)}`}>
        {delinquency ? (
          <>
            <Row label="Facturado" value={money(delinquency.billed)} />
            <Row label="Cobrado" value={money(delinquency.collected)} />
            <Row label="Pendiente" value={money(delinquency.pending)} />
            <Row label="Cobranza" value={`${Math.round(delinquency.collectionRate * 100)}%`} />
            <SectionTitle>Proyección de deuda</SectionTitle>
            <Text style={styles.projection}>{money(delinquency.projectedClosingDebt)}</Text>
          </>
        ) : (
          <Text style={styles.note}>Sin datos de cobranza.</Text>
        )}
        <Button
          label="Ver reportes"
          variant="secondary"
          onPress={() => router.push("/admin/reportes")}
        />
      </Card>

      {user?.role === "admin" ? (
        <>
          <Button label="Emitir facturas" onPress={() => router.push("/admin/facturas")} />
          <Button
            label="Configurar tarifas"
            variant="secondary"
            onPress={() => router.push("/admin/tarifas")}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bigStat: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginBottom: spacing.sm },
  bigNumber: { color: colors.deep, fontSize: 34, fontWeight: "900" },
  bigLabel: { color: colors.muted, fontSize: 13 },
  projection: { color: colors.deep, fontSize: 22, fontWeight: "900", marginBottom: spacing.sm },
  note: { color: colors.muted, fontSize: 12 },
});
