import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth";
import { apiRequest, getErrorMessage } from "../../src/api";
import type { ServicesCatalog, Tariff } from "../../src/types";
import { dateLabel, money, statusLabel } from "../../src/format";
import {
  Button,
  Card,
  Choice,
  EmptyState,
  ErrorMessage,
  Input,
  Loading,
  Row,
  Screen,
} from "../../src/ui";
import { colors, spacing } from "../../src/theme";

type Kind = "monthly" | "sport" | "transport" | "cafeteria";

const KINDS: Array<{ value: Kind; label: string }> = [
  { value: "monthly", label: "Cuota mensual" },
  { value: "sport", label: "Deporte" },
  { value: "transport", label: "Transporte" },
  { value: "cafeteria", label: "Comedor" },
];

export default function AdminTariffsScreen() {
  const { token } = useAuth();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [services, setServices] = useState<ServicesCatalog | null>(null);
  const [kind, setKind] = useState<Kind>("monthly");
  const [sportId, setSportId] = useState<number | null>(null);
  const [routeId, setRouteId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [tariffsResult, servicesResult] = await Promise.all([
        apiRequest<{ tariffs: Tariff[] }>("/admin/billing/tariffs", { token }),
        apiRequest<ServicesCatalog>("/admin/services", { token }),
      ]);
      setTariffs(tariffsResult.tariffs);
      setServices(servicesResult);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function create() {
    if (!token) return;
    const numericAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setError("El importe no es válido");
      return;
    }
    if (kind === "sport" && !sportId) {
      setError("Seleccioná un deporte");
      return;
    }
    if (kind === "transport" && !routeId) {
      setError("Seleccioná un recorrido");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest("/admin/billing/tariffs", {
        method: "POST",
        token,
        body: {
          kind,
          amount: numericAmount,
          ...(kind === "sport" ? { sportId } : {}),
          ...(kind === "transport" ? { transportRouteId: routeId } : {}),
          ...(validFrom ? { validFrom } : {}),
        },
      });
      setMessage("Tarifa registrada.");
      setAmount("");
      setValidFrom("");
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen title="Tarifas">
        <Loading label="Cargando tarifas..." />
      </Screen>
    );
  }

  return (
    <Screen title="Tarifas" subtitle="Valores de cuota, deportes, transporte y comedor.">
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <ErrorMessage>{error}</ErrorMessage>

      <Card title="Nueva tarifa">
        <View style={styles.choices}>
          {KINDS.map((entry) => (
            <Choice
              key={entry.value}
              label={entry.label}
              selected={kind === entry.value}
              onPress={() => {
                setKind(entry.value);
                setSportId(null);
                setRouteId(null);
              }}
            />
          ))}
        </View>

        {kind === "sport" && services ? (
          <View style={styles.choices}>
            {services.sports.map((sport) => (
              <Choice
                key={sport.id}
                label={sport.name}
                selected={sportId === sport.id}
                onPress={() => setSportId(sport.id)}
              />
            ))}
          </View>
        ) : null}

        {kind === "transport" && services ? (
          <View style={styles.choices}>
            {services.transportRoutes.map((route) => (
              <Choice
                key={route.id}
                label={route.name}
                selected={routeId === route.id}
                onPress={() => setRouteId(route.id)}
              />
            ))}
          </View>
        ) : null}

        <Input label="Importe" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Input
          label="Vigente desde (opcional, AAAA-MM-DD)"
          value={validFrom}
          onChangeText={setValidFrom}
          placeholder="2026-11-01"
        />
        <Button
          label={saving ? "Guardando..." : "Registrar tarifa"}
          onPress={() => void create()}
          loading={saving}
          disabled={!amount}
        />
      </Card>

      <Card title="Historial de tarifas">
        {tariffs.length === 0 ? (
          <EmptyState title="Sin tarifas" detail="Creá la primera tarifa para poder facturar." />
        ) : (
          tariffs.map((tariff) => (
            <Row
              key={tariff.id}
              label={`${statusLabel(tariff.kind)}${tariff.sport ? ` · ${tariff.sport}` : ""}${tariff.route ? ` · ${tariff.route}` : ""}`}
              value={`${money(tariff.amount)} · desde ${dateLabel(tariff.validFrom)}`}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13 },
  choices: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing.sm },
});
