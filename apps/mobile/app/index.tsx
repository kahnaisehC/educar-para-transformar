import { Redirect } from "expo-router";
import { useAuth } from "../src/auth";
import { homePath } from "../src/navigation";
import { Loading, Screen } from "../src/ui";

export default function IndexScreen() {
  const { token, user, loading } = useAuth();

  if (loading) {
    return (
      <Screen>
        <Loading label="Verificando la sesión..." />
      </Screen>
    );
  }
  if (!token || !user) {
    return <Redirect href="/login" />;
  }
  return <Redirect href={homePath(user.role)} />;
}
