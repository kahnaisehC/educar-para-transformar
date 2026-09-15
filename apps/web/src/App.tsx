import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiRequest, getMe, login } from "./api";
import type {
  AdminUser,
  Child,
  ChildSummary,
  StudentDashboardData,
  User,
  UserRole,
} from "./types";

const TOKEN_KEY = "educar.access_token";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Alumno",
  parent: "Padre / madre",
  teacher: "Docente",
  admin: "Administrador",
  director: "Dirección",
};

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

  return <AppShell user={user} token={token} onLogout={handleLogout} />;
}

function LoginPage({ onLoggedIn }: { onLoggedIn: (token: string, user: User) => void }) {
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
          <span>Sprint 1 · Portal institucional</span>
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

function AppShell({ user, token, onLogout }: { user: User; token: string; onLogout: () => void }) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/assets/logo-educar-para-transformar.png" alt="" className="sidebar-logo" />
          <div>
            <strong>EDUCAR</strong>
            <span>para transformar</span>
          </div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-context">
          <span className="context-dot" />
          <span>Portal {ROLE_LABELS[user.role]}</span>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          <span className="nav-label">Espacio de trabajo</span>
          <div className="nav-item nav-item-active">
            <span className="nav-symbol">⌂</span>
            <span>Resumen</span>
          </div>
          <div className="nav-item nav-item-muted">
            <span className="nav-symbol">◌</span>
            <span>Próximamente</span>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <img src="/assets/logo-tecnicatura-univ-en-prog.png" alt="Tecnicatura Universitaria en Programación" className="career-logo" />
          <p>Una comunidad que aprende, participa y crece.</p>
        </div>
      </aside>
      <div className="content-frame">
        <header className="topbar">
          <div className="mobile-brand">
            <img src="/assets/logo-educar-para-transformar.png" alt="" />
            <strong>EDUCAR</strong>
          </div>
          <div className="topbar-spacer" />
          <div className="user-menu">
            <div className="user-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user.displayName}</strong>
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
            <button className="logout-button" onClick={onLogout} title="Cerrar sesión">
              Salir
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="page-intro">
            <div>
              <p className="overline">{ROLE_LABELS[user.role]}</p>
              <h1>{getPageTitle(user.role)}</h1>
            </div>
            <span className="sprint-mark">SPRINT 01 <i /> EN CURSO</span>
          </div>
          {user.role === "student" && <StudentDashboard token={token} />}
          {user.role === "parent" && <ParentDashboard token={token} />}
          {user.role === "admin" && <AdminDashboard token={token} currentUser={user} />}
          {(user.role === "teacher" || user.role === "director") && <RoleComingSoon role={user.role} />}
        </main>
        <footer className="app-footer">
          <span>EDUCAR PARA TRANSFORMAR</span>
          <span>Información protegida · Sprint 1</span>
        </footer>
      </div>
    </div>
  );
}

function StudentDashboard({ token }: { token: string }) {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyGroup, setBusyGroup] = useState<number | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<StudentDashboardData>("/student/dashboard", { token });
      setData(result);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [token]);

  async function changeEnrollment(groupId: number, action: "enroll" | "cancel") {
    setBusyGroup(groupId);
    setNotice(null);
    try {
      if (action === "enroll") {
        await apiRequest(`/student/enrollments`, {
          method: "POST",
          token,
          body: JSON.stringify({ groupId }),
        });
        setNotice({ tone: "success", text: "La inscripción fue registrada correctamente." });
      } else {
        await apiRequest(`/student/enrollments/${groupId}`, { method: "DELETE", token });
        setNotice({ tone: "success", text: "La inscripción fue cancelada." });
      }
      await loadDashboard();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setBusyGroup(null);
    }
  }

  if (loading && !data) {
    return <DashboardSkeleton />;
  }
  if (error && !data) {
    return <ErrorState message={error} onRetry={() => void loadDashboard()} />;
  }
  if (!data) {
    return <EmptyState title="No encontramos tu ficha" detail="Solicitá a Administración que revise tu perfil." />;
  }

  const enrolledSportIds = new Set(data.enrollments.map((enrollment) => enrollment.sportId));
  const reachedLimit = data.enrollments.length >= 2;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <section className="welcome-strip">
        <div>
          <span className="overline">Tu recorrido</span>
          <h2>Hola, {data.student.full_name.split(" ")[0]}.</h2>
          <p>{data.student.level} · {data.student.course} · Legajo {data.student.record_number}</p>
        </div>
        <div className="limit-meter">
          <span>Actividades deportivas</span>
          <strong>{data.enrollments.length}<small>/2</small></strong>
          <div className="meter-track"><i style={{ width: `${Math.min(data.enrollments.length * 50, 100)}%` }} /></div>
        </div>
      </section>
      <div className="dashboard-columns student-columns">
        <section className="surface-panel enrollments-panel">
          <PanelHeading eyebrow="Tu agenda" title="Mis inscripciones" detail="Hasta dos deportes activos." />
          {data.enrollments.length === 0 ? (
            <EmptyState title="Todavía no elegiste un deporte" detail="Explorá el catálogo para sumar una actividad a tu semana." compact />
          ) : (
            <div className="enrollment-list">
              {data.enrollments.map((enrollment) => (
                <article className="enrollment-row" key={enrollment.groupId}>
                  <div className="activity-badge">{getSportInitial(enrollment.sport)}</div>
                  <div className="row-copy">
                    <strong>{enrollment.sport}</strong>
                    <span>{enrollment.weekdayName} · {enrollment.startTime} a {enrollment.endTime}</span>
                    <small>Docente: {enrollment.teacher}</small>
                  </div>
                  <button
                    className="text-button danger-text"
                    disabled={busyGroup === enrollment.groupId}
                    onClick={() => void changeEnrollment(enrollment.groupId, "cancel")}
                  >
                    {busyGroup === enrollment.groupId ? "..." : "Cancelar"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="surface-panel catalog-panel">
          <PanelHeading eyebrow="Elegí tu propuesta" title="Catálogo deportivo" detail="Los horarios se validan automáticamente al confirmar." />
          {data.catalog.length === 0 ? (
            <EmptyState title="No hay grupos disponibles" detail="El catálogo se actualizará cuando se habiliten nuevas propuestas." compact />
          ) : (
            <div className="activity-grid">
              {data.catalog.map((group) => {
                const enrolled = enrolledSportIds.has(group.sportId);
                const disabled = enrolled || reachedLimit;
                return (
                  <article className={`activity-card ${enrolled ? "activity-card-selected" : ""}`} key={group.groupId}>
                    <div className="activity-card-top">
                      <span className="activity-badge large">{getSportInitial(group.sport)}</span>
                      {enrolled && <span className="status-chip success-chip">Inscripto</span>}
                    </div>
                    <h3>{group.sport}</h3>
                    <p className="activity-level">Nivel {group.level}</p>
                    <div className="schedule-line"><span>◷</span>{group.weekdayName} · {group.startTime} a {group.endTime}</div>
                    <div className="teacher-line"><span>Responsable</span>{group.teacher}</div>
                    <button
                      className="secondary-button"
                      disabled={disabled || busyGroup === group.groupId}
                      onClick={() => void changeEnrollment(group.groupId, "enroll")}
                    >
                      {enrolled ? "Ya estás inscripto" : busyGroup === group.groupId ? "Guardando..." : reachedLimit ? "Límite alcanzado" : "Inscribirme"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function ParentDashboard({ token }: { token: string }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [summary, setSummary] = useState<ChildSummary | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadChildren() {
    setLoadingChildren(true);
    setError(null);
    try {
      const result = await apiRequest<{ children: Child[] }>("/parent/children", { token });
      setChildren(result.children);
      setSelectedId((current) => current ?? result.children[0]?.id ?? null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingChildren(false);
    }
  }

  useEffect(() => {
    void loadChildren();
  }, [token]);

  useEffect(() => {
    if (selectedId === null) {
      setSummary(null);
      return;
    }
    let active = true;
    setLoadingSummary(true);
    setError(null);
    apiRequest<{ student: ChildSummary }>(`/parent/children/${selectedId}/summary`, { token })
      .then((result) => {
        if (active) setSummary(result.student);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoadingSummary(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, token]);

  if (loadingChildren) {
    return <DashboardSkeleton />;
  }
  if (error && children.length === 0) {
    return <ErrorState message={error} onRetry={() => void loadChildren()} />;
  }

  return (
    <>
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <section className="parent-intro">
        <div>
          <span className="overline">Acompañamiento familiar</span>
          <h2>La información de tus hijos, en un solo lugar.</h2>
          <p>Seleccioná un perfil para consultar materias, docentes y actividades deportivas.</p>
        </div>
        <div className="privacy-badge"><span>✓</span> Acceso familiar protegido</div>
      </section>
      <div className="dashboard-columns parent-columns">
        <section className="surface-panel children-panel">
          <PanelHeading eyebrow="Vínculos autorizados" title="Mis hijos" detail="Solo se muestran alumnos asociados a tu cuenta." />
          {children.length === 0 ? (
            <EmptyState title="No hay alumnos asociados" detail="Administración puede revisar los vínculos de tu cuenta." compact />
          ) : (
            <div className="children-list">
              {children.map((child) => (
                <button
                  key={child.id}
                  className={`child-card ${selectedId === child.id ? "child-card-selected" : ""}`}
                  onClick={() => setSelectedId(child.id)}
                >
                  <span className="child-avatar">{child.fullName.slice(0, 1)}</span>
                  <span className="child-copy"><strong>{child.fullName}</strong><small>{child.level} · {child.course}</small><small>Legajo {child.recordNumber}</small></span>
                  <span className="child-arrow">→</span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="surface-panel child-detail-panel">
          {loadingSummary ? (
            <div className="detail-loading"><span className="loading-dot" /> Cargando ficha académica...</div>
          ) : !summary ? (
            <EmptyState title="Seleccioná un hijo" detail="La ficha académica aparecerá aquí." />
          ) : (
            <ChildDetail summary={summary} />
          )}
        </section>
      </div>
    </>
  );
}

function ChildDetail({ summary }: { summary: ChildSummary }) {
  return (
    <>
      <div className="detail-heading">
        <div className="child-avatar large-avatar">{summary.fullName.slice(0, 1)}</div>
        <div><span className="overline">Ficha del alumno</span><h2>{summary.fullName}</h2><p>{summary.level} · {summary.course} · Legajo {summary.recordNumber}</p></div>
        <span className={`status-chip ${summary.status === "active" ? "success-chip" : "inactive-chip"}`}>
          {summary.status === "active" ? "Activo" : "Inactivo"}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail-section">
          <div className="section-title"><span className="section-icon">01</span><h3>Materias y docentes</h3></div>
          {summary.subjects.length === 0 ? <EmptyState title="Sin materias cargadas" detail="Todavía no hay materias asociadas." compact /> : <div className="fact-list">{summary.subjects.map((item) => <div className="fact-row" key={item.subject}><span>{item.subject}</span><small>{item.teacher}</small></div>)}</div>}
        </div>
        <div className="detail-section">
          <div className="section-title"><span className="section-icon">02</span><h3>Actividades deportivas</h3></div>
          {summary.sports.length === 0 ? <EmptyState title="Sin deportes inscriptos" detail="Este alumno todavía no tiene actividades activas." compact /> : <div className="fact-list">{summary.sports.map((item, index) => <div className="fact-row sport-fact" key={`${item.sport}-${index}`}><span><b>{getSportInitial(item.sport)}</b>{item.sport}</span><small>{item.weekdayName} · {item.startTime}-{item.endTime}<br />{item.teacher}</small></div>)}</div>}
        </div>
      </div>
    </>
  );
}

function AdminDashboard({ token, currentUser }: { token: string; currentUser: User }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "student" as UserRole });

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ users: AdminUser[] }>("/admin/users", { token });
      setUsers(result.users);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, [token]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await apiRequest("/admin/users", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ username: "", displayName: "", password: "", role: "student" });
      setNotice({ tone: "success", text: "El usuario fue creado y quedó registrado en auditoría." });
      await loadUsers();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  async function changeUser(user: AdminUser, change: { role?: UserRole; status?: "active" | "inactive" }) {
    setNotice(null);
    try {
      const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${user.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(change),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? result.user : item));
      setNotice({ tone: "success", text: "Los permisos del usuario fueron actualizados." });
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    }
  }

  if (loading) return <DashboardSkeleton />;
  if (error && users.length === 0) return <ErrorState message={error} onRetry={() => void loadUsers()} />;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <section className="admin-summary-strip">
        <div><span className="overline">Control institucional</span><h2>Personas y permisos.</h2><p>Alta y mantenimiento de las cuentas que acceden al sistema.</p></div>
        <div className="admin-stat"><strong>{users.length}</strong><span>cuentas registradas</span></div>
        <div className="admin-stat"><strong>{users.filter((item) => item.status === "active").length}</strong><span>cuentas activas</span></div>
      </section>
      <div className="admin-layout">
        <section className="surface-panel create-user-panel">
          <PanelHeading eyebrow="Nueva cuenta" title="Crear usuario" detail="Asigná el rol desde el primer acceso." />
          <form onSubmit={createAccount} className="form-stack">
            <label className="field"><span>Nombre visible</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Nombre y apellido" required /></label>
            <label className="field"><span>Usuario</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="nombre.apellido" required /></label>
            <label className="field"><span>Contraseña inicial</span><input type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Mínimo 8 caracteres" required /></label>
            <label className="field"><span>Rol</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button className="primary-button full-button" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear usuario"}</button>
          </form>
        </section>
        <section className="surface-panel users-panel">
          <PanelHeading eyebrow="Directorio" title="Usuarios del sistema" detail="El estado y el rol se aplican desde el servidor." />
          {users.length === 0 ? <EmptyState title="No hay usuarios registrados" detail="Creá la primera cuenta desde el formulario." compact /> : <div className="user-table-wrap"><table className="user-table"><thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td><div className="table-person"><span className="table-avatar">{item.displayName.slice(0, 1)}</span><span><strong>{item.displayName}</strong><small>@{item.username}</small></span></div></td><td><select className="table-select" value={item.role} disabled={item.id === currentUser.id} onChange={(event) => void changeUser(item, { role: event.target.value as UserRole })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><span className={`status-chip ${item.status === "active" ? "success-chip" : "inactive-chip"}`}>{item.status === "active" ? "Activo" : "Inactivo"}</span></td><td><button className="text-button" disabled={item.id === currentUser.id} onClick={() => void changeUser(item, { status: item.status === "active" ? "inactive" : "active" })}>{item.status === "active" ? "Desactivar" : "Activar"}</button></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </>
  );
}

function RoleComingSoon({ role }: { role: "teacher" | "director" }) {
  const isTeacher = role === "teacher";
  return (
    <section className="coming-soon surface-panel">
      <div className="coming-icon">{isTeacher ? "D" : "R"}</div>
      <span className="overline">Próximo sprint</span>
      <h2>{isTeacher ? "Portal docente en preparación" : "Módulo de Dirección en preparación"}</h2>
      <p>{isTeacher ? "Tu cuenta está autenticada correctamente. La consulta de carga horaria, alumnos y reportes se habilitará en los próximos incrementos." : "Tu cuenta está autenticada correctamente. Las plantillas y reportes institucionales se habilitarán en los próximos incrementos."}</p>
      <span className="status-chip neutral-chip">Acceso autenticado · Sprint 1</span>
    </section>
  );
}

function PanelHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="panel-heading"><div><span className="overline">{eyebrow}</span><h2>{title}</h2><p>{detail}</p></div></div>;
}

function InlineMessage({ tone, children }: { tone: "success" | "error"; children: string }) {
  return <div className={`inline-message ${tone}`} role="status"><span>{tone === "success" ? "✓" : "!"}</span>{children}</div>;
}

function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "empty-state-compact" : ""}`}><span className="empty-mark">—</span><strong>{title}</strong><p>{detail}</p></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-state"><span className="error-mark">!</span><h2>No pudimos cargar esta vista</h2><p>{message}</p><button className="secondary-button" onClick={onRetry}>Intentar de nuevo</button></div>;
}

function DashboardSkeleton() {
  return <div className="skeleton-layout" aria-label="Cargando"><div className="skeleton skeleton-wide" /><div className="skeleton-grid"><div className="skeleton skeleton-panel" /><div className="skeleton skeleton-panel" /></div></div>;
}

function FullPageState({ label }: { label: string }) {
  return <main className="full-page-state"><span className="loading-dot" /><span>{label}...</span></main>;
}

function getPageTitle(role: UserRole) {
  if (role === "student") return "Mi actividad escolar";
  if (role === "parent") return "Seguimiento familiar";
  if (role === "admin") return "Administración";
  return ROLE_LABELS[role];
}

function getSportInitial(sport: string) {
  return sport.trim().slice(0, 1).toUpperCase();
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado. Intentá nuevamente.";
}
