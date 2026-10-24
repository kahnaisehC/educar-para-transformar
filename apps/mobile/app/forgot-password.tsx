import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { apiRequest, getErrorMessage } from "../src/api";
import { Button, Card, ErrorMessage, Input, Screen } from "../src/ui";
import { colors, spacing } from "../src/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: { username: identifier.trim() },
      });
      setMessage("Si la cuenta existe, enviamos un correo con las instrucciones.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Recuperar contraseña" subtitle="Ingresá tu usuario o correo institucional.">
      <Card>
        <Input
          label="Usuario o correo"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          placeholder="usuario.apellido"
        />
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <ErrorMessage>{error}</ErrorMessage>
        <Button
          label={submitting ? "Enviando..." : "Enviar instrucciones"}
          onPress={() => void submit()}
          loading={submitting}
          disabled={!identifier}
        />
        <Link href="/reset-password" style={styles.link}>
          Ya tengo un token
        </Link>
        <Link href="/login" style={styles.link}>
          Volver al ingreso
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13, lineHeight: 19 },
  link: { marginTop: spacing.sm, color: colors.blue, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
