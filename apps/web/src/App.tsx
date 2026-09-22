import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiRequest, getMe, login } from "./api";
import type {
  AdminUser,
  Child,
  ChildSummary,
  CourseStudent,
  GeneratedReport,
  ReportEntity,
  ReportTemplate,
  StudentReport,
  StudentDashboardData,
  TeacherCourse,
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
          {user.role === "teacher" && <TeacherDashboard token={token} />}
          {user.role === "director" && <DirectorDashboard token={token} />}
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
      <StudentAccountPanel token={token} data={data} onRefresh={loadDashboard} />
    </>
  );
}

function StudentAccountPanel({
  token,
  data,
  onRefresh,
}: {
  token: string;
  data: StudentDashboardData;
  onRefresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState(data.student.email ?? "");
  const [phone, setPhone] = useState(data.student.phone ?? "");
  const [transportRouteId, setTransportRouteId] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [busyService, setBusyService] = useState(false);
  const [report, setReport] = useState<StudentReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setEmail(data.student.email ?? "");
    setPhone(data.student.phone ?? "");
  }, [data.student.email, data.student.phone]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingContact(true);
    setNotice(null);
    try {
      await apiRequest("/me/contact", {
        method: "PATCH",
        token,
        body: JSON.stringify({ email, phone }),
      });
      setNotice({ tone: "success", text: "Tus datos de contacto fueron actualizados." });
      await onRefresh();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSavingContact(false);
    }
  }

  async function changeTransport(action: "enroll" | "cancel", routeId?: number) {
    setBusyService(true);
    setNotice(null);
    try {
      if (action === "enroll") {
        await apiRequest("/student/transport", {
          method: "POST",
          token,
          body: JSON.stringify({ routeId }),
        });
        setNotice({ tone: "success", text: "El recorrido de transporte fue registrado." });
      } else {
        await apiRequest("/student/transport", { method: "DELETE", token });
        setNotice({ tone: "success", text: "El recorrido de transporte fue cancelado." });
      }
      await onRefresh();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setBusyService(false);
    }
  }

  async function changeCafeteria(action: "enroll" | "cancel") {
    setBusyService(true);
    setNotice(null);
    try {
      await apiRequest("/student/cafeteria", { method: action === "enroll" ? "POST" : "DELETE", token });
      setNotice({
        tone: "success",
        text: action === "enroll" ? "La inscripción al comedor fue registrada." : "La inscripción al comedor fue cancelada.",
      });
      await onRefresh();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setBusyService(false);
    }
  }

  async function loadReport() {
    setLoadingReport(true);
    setNotice(null);
    try {
      const result = await apiRequest<{ report: StudentReport }>("/student/report", { token });
      setReport(result.report);
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setLoadingReport(false);
    }
  }

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <div className="student-tools-grid">
        <section className="surface-panel">
          <PanelHeading eyebrow="Mi perfil" title="Datos personales" detail="La información académica es de solo lectura." />
          <div className="profile-facts">
            <div><span>Nombre</span><strong>{data.student.full_name}</strong></div>
            <div><span>DNI</span><strong>{data.student.dni}</strong></div>
            <div><span>Fecha de nacimiento</span><strong>{formatDate(data.student.birth_date)}</strong></div>
            <div><span>Domicilio</span><strong>{data.student.address ?? "Pendiente"}</strong></div>
            <div><span>Nivel y curso</span><strong>{data.student.level} · {data.student.course}</strong></div>
            <div><span>Estado</span><strong>{data.student.status === "active" ? "Activo" : "Inactivo"}</strong></div>
          </div>
          <div className="student-subjects">
            <h4>Materias y docentes</h4>
            {data.subjects.length === 0 ? <p className="muted-note">No hay materias asociadas todavía.</p> : data.subjects.map((item) => <div className="fact-row" key={item.subject}><span>{item.subject}</span><small>{item.teacher}</small></div>)}
          </div>
        </section>
        <section className="surface-panel">
          <PanelHeading eyebrow="Autogestión" title="Datos de contacto" detail="Mantené actualizados tus medios de contacto." />
          <form onSubmit={saveContact} className="form-stack compact-form">
            <label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="field"><span>Teléfono</span><input value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>
            <button className="primary-button" type="submit" disabled={savingContact}>{savingContact ? "Guardando..." : "Guardar contacto"}</button>
          </form>
        </section>
      </div>
      <div className="student-tools-grid">
        <section className="surface-panel">
          <PanelHeading eyebrow="Servicios" title="Transporte escolar" detail="Podés tener un único recorrido activo." />
          {data.transportEnrollment ? (
            <div className="service-active">
              <strong>{data.transportEnrollment.name}</strong>
              <span>{data.transportEnrollment.description}</span>
              <button className="text-button danger-text" disabled={busyService} onClick={() => void changeTransport("cancel")}>Cancelar recorrido</button>
            </div>
          ) : (
            <div className="service-form">
              <select id="transport-route" value={transportRouteId} onChange={(event) => setTransportRouteId(event.target.value)}>
                <option value="" disabled>Seleccionar recorrido</option>
                {data.transportRoutes.map((route) => <option key={route.id} value={route.id}>{route.name} · {route.description}</option>)}
              </select>
              <button className="secondary-button" disabled={busyService} onClick={() => {
                if (transportRouteId) void changeTransport("enroll", Number(transportRouteId));
              }}>Inscribirme al transporte</button>
            </div>
          )}
        </section>
        <section className="surface-panel">
          <PanelHeading eyebrow="Servicios" title="Comedor" detail="Gestioná tu inscripción al servicio de comedor." />
          <div className="service-active cafeteria-service">
            <div><strong>{data.cafeteriaEnrollment ? "Inscripción activa" : "Sin inscripción"}</strong><span>Servicio de comedor institucional</span></div>
            <button className={data.cafeteriaEnrollment ? "text-button danger-text" : "secondary-button"} disabled={busyService} onClick={() => void changeCafeteria(data.cafeteriaEnrollment ? "cancel" : "enroll")}>
              {data.cafeteriaEnrollment ? "Cancelar" : "Inscribirme"}
            </button>
          </div>
        </section>
      </div>
      <section className="surface-panel report-panel">
        <div className="panel-heading report-heading">
          <div><PanelHeading eyebrow="Documento personal" title="Reporte de Alumno" detail="Curso, materias, docentes, deportes y servicios." /></div>
          <button className="secondary-button" disabled={loadingReport} onClick={() => void loadReport()}>{loadingReport ? "Generando..." : "Generar reporte"}</button>
        </div>
        {report && <StudentReportView report={report} />}
      </section>
    </>
  );
}

function StudentReportView({ report }: { report: StudentReport }) {
  return (
    <div className="report-preview">
      <div className="report-header"><div><span className="overline">Reporte generado</span><h3>{report.profile.full_name}</h3><p>{report.profile.level} · {report.profile.course} · Legajo {report.profile.record_number}</p></div><button className="text-button" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div className="report-columns"><div><h4>Materias</h4>{report.subjects.map((item) => <div className="fact-row" key={item.subject}><span>{item.subject}</span><small>{item.teacher}</small></div>)}</div><div><h4>Servicios y actividades</h4>{report.sports.map((item, index) => <div className="fact-row" key={`${item.sport}-${index}`}><span>{item.sport}</span><small>{item.weekdayName} · {item.startTime}-{item.endTime}</small></div>)}<div className="fact-row"><span>Transporte</span><small>{report.transport?.name ?? "No inscripto"}</small></div><div className="fact-row"><span>Comedor</span><small>{report.cafeteria ? "Inscripto" : "No inscripto"}</small></div></div></div>
      <small className="report-generated-at">Generado: {new Date(report.generatedAt).toLocaleString("es-AR")}</small>
    </div>
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

function TeacherDashboard({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<TeacherCourse | null>(null);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCourses() {
    setLoadingCourses(true);
    setError(null);
    try {
      const result = await apiRequest<{ courses: TeacherCourse[] }>("/teacher/courses", { token });
      setCourses(result.courses);
      setSelectedCourse((current) => current ?? result.courses[0] ?? null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingCourses(false);
    }
  }

  useEffect(() => {
    void loadCourses();
  }, [token]);

  useEffect(() => {
    if (!selectedCourse) {
      setStudents([]);
      return;
    }
    let active = true;
    setLoadingStudents(true);
    setError(null);
    apiRequest<{ students: CourseStudent[] }>(
      `/teacher/courses/students?subjectId=${selectedCourse.subjectId}&level=${encodeURIComponent(selectedCourse.level)}&course=${encodeURIComponent(selectedCourse.course)}`,
      { token },
    )
      .then((result) => {
        if (active) setStudents(result.students);
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoadingStudents(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCourse, token]);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await apiRequest("/me/contact", { method: "PATCH", token, body: JSON.stringify({ email, phone }) });
      setNotice({ tone: "success", text: "Tus datos de contacto fueron actualizados." });
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  function exportStudentsCsv() {
    const header = ["Nivel", "Curso", "Materia", "Profesor", "Alumno", "Legajo", "DNI"];
    const lines = students.map((student) => [
      student.level,
      student.course,
      student.subject,
      student.teacher,
      student.fullName,
      student.recordNumber,
      student.dni,
    ]);
    downloadCsv(`alumnos-${selectedCourse?.subject ?? "materia"}.csv`, header, lines);
  }

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      {error && !students.length && !courses.length && <ErrorState message={error} onRetry={() => void loadCourses()} />}
      <section className="surface-panel teacher-contact-panel">
        <PanelHeading eyebrow="Sprint 2 · HU-03" title="Actualizá tus datos de contacto" detail="Mantené actualizados tus medios de comunicación con la institución." />
        <form onSubmit={saveContact} className="teacher-contact-form form-stack">
          <label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="docente@educar.local" required /></label>
          <label className="field"><span>Teléfono</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="3624-000000" required /></label>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
        </form>
      </section>
      <section className="surface-panel teacher-courses-panel">
        <div className="panel-heading report-heading">
          <div><PanelHeading eyebrow="Sprint 3 · HU-05" title="Mis cursos" detail="Seleccioná una materia y curso para consultar los alumnos asignados." /></div>
        </div>
        {loadingCourses ? (
          <div className="detail-loading"><span className="loading-dot" /> Cargando cursos...</div>
        ) : courses.length === 0 ? (
          <EmptyState title="No tenés cursos asignados" detail="Los cursos aparecerán cuando se cargue tu asignación académica." compact />
        ) : (
          <>
            <div className="course-selector">
              <label className="field">
                <span>Materia y curso</span>
                <select
                  value={selectedCourse ? `${selectedCourse.subjectId}|${selectedCourse.level}|${selectedCourse.course}` : ""}
                  onChange={(event) => {
                    const [subjectId, level, course] = event.target.value.split("|");
                    const next = courses.find((item) => String(item.subjectId) === subjectId && item.level === level && item.course === course) ?? null;
                    setSelectedCourse(next);
                  }}
                >
                  {courses.map((course) => (
                    <option key={`${course.subjectId}-${course.level}-${course.course}`} value={`${course.subjectId}|${course.level}|${course.course}`}>
                      {course.subject} · {course.level} · {course.course}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary-button" disabled={loadingStudents} onClick={exportStudentsCsv}>
                Exportar CSV
              </button>
            </div>
            <div className="user-table-wrap">
              <table className="user-table">
                <thead><tr><th>Alumno</th><th>Legajo</th><th>DNI</th><th>Nivel</th><th>Curso</th><th>Materia</th><th>Profesor</th></tr></thead>
                <tbody>
                  {loadingStudents ? (
                    <tr><td colSpan={7}><div className="detail-loading"><span className="loading-dot" /> Cargando alumnos...</div></td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState title="Sin alumnos en este curso" detail="No hay alumnos cargados para esta materia y curso." compact /></td></tr>
                  ) : students.map((student) => (
                    <tr key={student.recordNumber}>
                      <td><div className="table-person"><span className="table-avatar">{student.fullName.slice(0, 1)}</span><span><strong>{student.fullName}</strong></span></div></td>
                      <td>{student.recordNumber}</td>
                      <td>{student.dni}</td>
                      <td>{student.level}</td>
                      <td>{student.course}</td>
                      <td>{student.subject}</td>
                      <td>{student.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function DirectorDashboard({ token }: { token: string }) {
  const [entities, setEntities] = useState<ReportEntity[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    entity: "",
    fields: [] as string[],
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);

  const selectedEntity = entities.find((entity) => entity.key === form.entity);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [entitiesResult, templatesResult] = await Promise.all([
        apiRequest<{ entities: ReportEntity[] }>("/director/report-entities", { token }),
        apiRequest<{ templates: ReportTemplate[] }>("/director/report-templates", { token }),
      ]);
      setEntities(entitiesResult.entities);
      setTemplates(templatesResult.templates);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [token]);

  function toggleField(field: string) {
    setForm((current) => ({
      ...current,
      fields: current.fields.includes(field)
        ? current.fields.filter((item) => item !== field)
        : [...current.fields, field],
    }));
  }

  function selectEntity(entity: string) {
    setForm((current) => ({ ...current, entity, fields: [] }));
  }

  function startEdit(template: ReportTemplate) {
    setEditingId(template.id);
    setForm({ name: template.name, entity: template.entity, fields: template.fields });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ name: "", entity: "", fields: [] });
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      if (editingId !== null) {
        const result = await apiRequest<{ template: ReportTemplate }>(`/director/report-templates/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(form),
        });
        setTemplates((current) => current.map((item) => item.id === result.template.id ? result.template : item));
        setNotice({ tone: "success", text: "La plantilla fue actualizada." });
      } else {
        const result = await apiRequest<{ template: ReportTemplate }>("/director/report-templates", {
          method: "POST",
          token,
          body: JSON.stringify(form),
        });
        setTemplates((current) => [result.template, ...current]);
        setNotice({ tone: "success", text: "La plantilla fue creada y quedó disponible para generar reportes." });
      }
      cancelEdit();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(template: ReportTemplate) {
    setNotice(null);
    try {
      const result = await apiRequest<{ template: ReportTemplate }>(`/director/report-templates/${template.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ active: !template.active }),
      });
      setTemplates((current) => current.map((item) => item.id === result.template.id ? result.template : item));
      setNotice({ tone: "success", text: result.template.active ? "La plantilla fue activada." : "La plantilla fue desactivada." });
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    }
  }

  async function generate(template: ReportTemplate) {
    setGeneratingId(template.id);
    setNotice(null);
    try {
      const result = await apiRequest<{ report: GeneratedReport }>(
        `/director/report-templates/${template.id}/generate`,
        { method: "POST", token },
      );
      setReport(result.report);
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setGeneratingId(null);
    }
  }

  function exportReportCsv() {
    if (!report) return;
    const header = report.columns.map((column) => column.label);
    const lines = report.rows.map((row) => report.columns.map((column) => row[column.key] ?? ""));
    downloadCsv("reporte-institucional.csv", header, lines);
  }

  if (loading) return <DashboardSkeleton />;
  if (error && templates.length === 0) return <ErrorState message={error} onRetry={() => void loadAll()} />;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <section className="admin-summary-strip">
        <div><span className="overline">Sprint 3 · HU-07</span><h2>Reportes institucionales.</h2><p>Definí plantillas y generá información para la toma de decisiones.</p></div>
        <div className="admin-stat"><strong>{templates.length}</strong><span>plantillas creadas</span></div>
        <div className="admin-stat"><strong>{templates.filter((item) => item.active).length}</strong><span>plantillas activas</span></div>
      </section>
      <div className="admin-layout">
        <section className="surface-panel create-user-panel">
          <PanelHeading eyebrow={editingId !== null ? "Edición" : "Nueva plantilla"} title={editingId !== null ? "Editar plantilla" : "Crear plantilla"} detail="El nombre y al menos un campo son obligatorios." />
          <form onSubmit={saveTemplate} className="form-stack">
            <label className="field"><span>Nombre de la plantilla</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej.: Listado de alumnos por curso" required /></label>
            <label className="field"><span>Entidad base</span><select value={form.entity} onChange={(event) => selectEntity(event.target.value)} required>
              <option value="" disabled>Seleccionar entidad</option>
              {entities.map((entity) => <option key={entity.key} value={entity.key}>{entity.label}</option>)}
            </select></label>
            {selectedEntity && (
              <fieldset className="fieldset-group">
                <legend>Campos del reporte</legend>
                <div className="checkbox-grid">
                  {selectedEntity.fields.map((field) => (
                    <label className="check-field" key={field.key}>
                      <input type="checkbox" checked={form.fields.includes(field.key)} onChange={() => toggleField(field.key)} />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={saving || !form.name || form.fields.length === 0}>{saving ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Crear plantilla"}</button>
              {editingId !== null && <button className="text-button" type="button" onClick={cancelEdit}>Cancelar edición</button>}
            </div>
          </form>
        </section>
        <section className="surface-panel users-panel">
          <PanelHeading eyebrow="Directorio de plantillas" title="Plantillas de reportes" detail="Activá, editá o generá reportes desde cada plantilla." />
          {templates.length === 0 ? <EmptyState title="Sin plantillas todavía" detail="Creá la primera plantilla con los campos que necesites." compact /> : <div className="user-table-wrap"><table className="user-table"><thead><tr><th>Plantilla</th><th>Entidad</th><th>Campos</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{templates.map((template) => <tr key={template.id}><td><div className="table-person"><span className="table-avatar">{template.name.slice(0, 1)}</span><span><strong>{template.name}</strong></span></div></td><td>{entities.find((entity) => entity.key === template.entity)?.label ?? template.entity}</td><td>{template.fields.length}</td><td><span className={`status-chip ${template.active ? "success-chip" : "inactive-chip"}`}>{template.active ? "Activa" : "Desactivada"}</span></td><td><div className="row-actions"><button className="text-button" disabled={generatingId === template.id} onClick={() => void generate(template)}>{generatingId === template.id ? "Generando..." : "Generar"}</button><button className="text-button" onClick={() => startEdit(template)}>Editar</button><button className="text-button" onClick={() => void toggleTemplate(template)}>{template.active ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table></div>}
        </section>
      </div>
      {report && (
        <section className="surface-panel report-panel">
          <div className="panel-heading report-heading">
            <div><PanelHeading eyebrow="Reporte generado" title={report.columns.map((column) => column.label).join(" · ")} detail={`${report.rows.length} registros · ${new Date(report.generatedAt).toLocaleString("es-AR")}`} /></div>
            <button className="secondary-button" onClick={exportReportCsv}>Exportar CSV</button>
          </div>
          {report.rows.length === 0 ? <EmptyState title="Sin datos para esta plantilla" detail="La entidad elegida todavía no tiene registros cargados." compact /> : <div className="user-table-wrap"><table className="user-table"><thead><tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}>{report.columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div>}
        </section>
      )}
    </>
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

function formatDate(value: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("es-AR");
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado. Intentá nuevamente.";
}

function downloadCsv(filename: string, header: string[], lines: string[][]) {
  const escape = (value: string) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [header, ...lines].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${rows}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
