import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { getMe, login } from "./api";
import { AppShell } from "./AppShell";
import { FullPageState } from "./ui";
import { LoginPage } from "./pages/LoginPage";
import type { User } from "./types";

const TOKEN_KEY = "educar.access_token";

export default function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setCheckingSession(false);
      setUser(null);
      return;
    }

    let active = true;
    setCheckingSession(true);
    getMe(token)
      .then(({ user: currentUser }) => {
        if (active) {
          setUser(currentUser);
        }
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  function handleLoggedIn(nextToken: string, nextUser: User) {
    window.localStorage.setItem(TOKEN_KEY, nextToken);
    setUser(nextUser);
    setToken(nextToken);
  }

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  if (checkingSession) {
    return <FullPageState label="Verificando la sesión" />;
  }
  if (!token || !user) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return (
    <BrowserRouter>
      <AppShell user={user} token={token} onLogout={handleLogout} />
    </BrowserRouter>
  );
}