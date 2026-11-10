import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";
import { tabIcon } from "../../src/tabIcon";

export default function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin" && user.role !== "director") return <Redirect href="/" />;
  const director = user.role === "director";

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
      <Tabs.Screen name="index" options={{ title: "Resumen", tabBarIcon: tabIcon("🏠") }} />
      <Tabs.Screen
        name="comprobantes"
        options={{
          title: "Comprobantes",
          href: director ? null : undefined,
          tabBarIcon: tabIcon("🧾"),
        }}
      />
      <Tabs.Screen
        name="facturas"
        options={{
          title: "Facturas",
          href: director ? null : undefined,
          tabBarIcon: tabIcon("📄"),
        }}
      />
      <Tabs.Screen
        name="tarifas"
        options={{
          title: "Tarifas",
          href: director ? null : undefined,
          tabBarIcon: tabIcon("🏷️"),
        }}
      />
      <Tabs.Screen name="reportes" options={{ title: "Reportes", tabBarIcon: tabIcon("📊") }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil", tabBarIcon: tabIcon("👤") }} />
    </Tabs>
  );
}
