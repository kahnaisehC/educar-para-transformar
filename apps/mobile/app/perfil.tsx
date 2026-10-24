import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/auth";
import { apiRequest, getErrorMessage } from "../src/api";
import { homePath } from "../src/navigation";
import { Button, Card, ErrorMessage, Input, Row, Screen } from "../src/ui";
import { colors, spacing } from "../src/theme";

export default function ProfileScreen() {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user || !token) {
    return null;
  }

  async function changePassword() {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest("/me/password", {
        method: "PATCH",
        token,
        body: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("La contraseña fue actualizada.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function closeSession() {
    await logout();
    router.replace("/login");
  }

  return (
    <Screen title="Mi perfil" subtitle={user.displayName}>
      <Card title="Cuenta">
        <Row label="Usuario" value={`@${user.username}`} />
        <Row label="Rol" value={user.role} />
        <Row label="Estado" value={user.status === "active" ? "Activo" : "Inactivo"} />
      </Card>
      {user.role === "student" || user.role === "teacher" ? (
        <Card title="Portal móvil">
          <Text style={styles.note}>
            Este perfil está pensado para padres y administración. Para las funciones completas de
            alumno o docente usá el portal web.
          </Text>
          <Link href={homePath(user.role)} style={styles.link}>
            Volver al inicio
          </Link>
        </Card>
      ) : null}
      <Card title="Cambiar contraseña">
        <Input
          label="Contraseña actual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Input
          label="Nueva contraseña"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Mínimo 8 caracteres"
        />
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <ErrorMessage>{error}</ErrorMessage>
        <Button
          label={submitting ? "Guardando..." : "Actualizar contraseña"}
          onPress={() => void changePassword()}
          loading={submitting}
          disabled={!currentPassword || newPassword.length < 8}
        />
      </Card>
      <View style={styles.logout}>
        <Button label="Cerrar sesión" variant="danger" onPress={() => void closeSession()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  success: { marginBottom: spacing.md, color: colors.success, fontSize: 13 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: spacing.md },
  link: { color: colors.blue, fontSize: 13, fontWeight: "700" },
  logout: { marginTop: spacing.lg },
});
