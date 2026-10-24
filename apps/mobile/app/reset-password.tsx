import { useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { apiRequest, getErrorMessage } from "../src/api";
import { Button, Card, ErrorMessage, Input, Screen } from "../src/ui";
import { colors, spacing } from "../src/theme";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setMessage(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: { token: token.trim(), newPassword: password },
      });
      setMessage("La contraseña fue actualizada. Ya podés ingresar.");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Nueva contraseña" subtitle="Ingresá el token que recibiste por correo.">
      <Card>
        <Input label="Token" value={token} onChangeText={setToken} autoCapitalize="none" />
        <Input
          label="Nueva contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Mínimo 8 caracteres"
        />
        <Input
          label="Repetir contraseña"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <ErrorMessage>{error}</ErrorMessage>
        <Button
          label={submitting ? "Guardando..." : "Cambiar contraseña"}
          onPress={() => void submit()}
          loading={submitting}
          disabled={!token || password.length < 8}
        />
        <Link href="/login" style={styles.link}>
          Volver al ingreso
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13 },
  link: { marginTop: spacing.sm, color: colors.blue, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
