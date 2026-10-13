import { type FormEvent, useState } from "react";

import { login } from "../api";

import type { User } from "../types";

import { InlineMessage, getErrorMessage } from "../ui";

export function LoginPage({ onLoggedIn }: { onLoggedIn: (token: string, user: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(username, password);
      onLoggedIn(result.token, result.user);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-identity">
        <div className="identity-topline">
          <img src="/assets/logo-educar-para-transformar.png" alt="Educar para Transformar" className="brand-logo" />
          <span className="identity-kicker">Sistema de gestión</span>
        </div>
        <div className="identity-copy">
          <p className="overline">Centro Educativo</p>
          <h1>Educar para transformar.</h1>
          <p>Un espacio seguro para acompañar cada trayecto escolar, dentro y fuera del aula.</p>
        </div>
        <div className="identity-footer">
          <span className="seal">EPT</span>
          <span>Sistema de gestión</span>
        </div>
      </section>
      <section className="login-card-wrap">
        <div className="login-card">
          <div className="login-heading">
            <p className="overline">Acceso privado</p>
            <h2>Ingresá a tu cuenta</h2>
            <p>Usá tu usuario institucional y contraseña para continuar.</p>
          </div>
          <form onSubmit={handleSubmit} className="form-stack">
            <label className="field">
              <span>Usuario</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="usuario.apellido"
                required
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresá tu contraseña"
                required
              />
            </label>
            {error && <InlineMessage tone="error">{error}</InlineMessage>}
            <button className="primary-button full-button" type="submit" disabled={submitting}>
              {submitting ? "Validando..." : "Iniciar sesión"}
              {!submitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <p className="login-note">Si tenés problemas para ingresar, comunicate con Administración.</p>
        </div>
      </section>
    </main>
  );
}
