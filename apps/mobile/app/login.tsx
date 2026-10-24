import { useState } from "react";
import { Link, Redirect, useRouter } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { useAuth } from "../src/auth";
import { getErrorMessage } from "../src/api";
import { homePath } from "../src/navigation";
import { Button, Card, ErrorMessage, Input, Screen } from "../src/ui";
import { colors, spacing } from "../src/theme";

export default function LoginScreen() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Redirect href={homePath(user.role)} />;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const nextUser = await login(username.trim(), password);
      router.replace(homePath(nextUser.role));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CENTRO EDUCATIVO</Text>
        <Text style={styles.title}>Educar para transformar</Text>
        <Text style={styles.subtitle}>Cuotas, pagos y comprobantes en tu teléfono.</Text>
      </View>
      <Card title="Ingresar">
        <Input
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          placeholder="usuario.apellido"
        />
        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Tu contraseña"
        />
        <ErrorMessage>{error}</ErrorMessage>
        <Button
          label={submitting ? "Ingresando..." : "Iniciar sesión"}
          onPress={() => void submit()}
          loading={submitting}
          disabled={!username || !password}
        />
        <Link href="/forgot-password" style={styles.link}>
          Olvidé mi contraseña
        </Link>
      </Card>
      <Text style={styles.note}>
        Usá la misma cuenta del sistema de gestión. La sesión se guarda de forma segura en el
        dispositivo.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: spacing.xl, marginBottom: spacing.lg },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  title: { marginTop: spacing.sm, color: colors.deep, fontSize: 32, fontWeight: "900" },
  subtitle: { marginTop: spacing.sm, color: colors.muted, fontSize: 14, lineHeight: 21 },
  link: { marginTop: spacing.md, color: colors.blue, fontSize: 13, fontWeight: "700", textAlign: "center" },
  note: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" },
});
