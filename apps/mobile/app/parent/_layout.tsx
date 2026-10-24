import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function ParentLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "parent") return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: "#ffffff",
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Resumen" }} />
      <Tabs.Screen name="cuotas" options={{ title: "Cuotas" }} />
      <Tabs.Screen name="pagos" options={{ title: "Pagos" }} />
      <Tabs.Screen name="historial" options={{ title: "Historial" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
