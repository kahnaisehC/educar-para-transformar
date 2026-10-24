import { type FormEvent, useEffect, useState } from "react";

import { NavLink, useLocation } from "react-router-dom";

import { apiRequest } from "../api";
import { BillingReports } from "./BillingReports";

import type { AcademicLevel, AcademicOverview, AdminUser, EnrollmentsOverview, GeneratedReport, ReportEntity, ReportTemplate, ServicesOverview, TeacherProfile, User, UserRole } from "../types";

import {
  DashboardSkeleton,
  EmptyState,
  ErrorState,
  InlineMessage,
  PanelHeading,
  ROLE_LABELS,
  WEEKDAY_OPTIONS,
  downloadCsv,
  getErrorMessage,
} from "../ui";

type AdminTab = "users" | "academic" | "services" | "enrollments" | "reports" | "billing";

const ADMIN_TABS: Array<{ key: AdminTab; path: string; label: string }> = [
  { key: "users", path: "usuarios", label: "Usuarios" },
  { key: "academic", path: "academico", label: "Académico" },
  { key: "services", path: "servicios", label: "Deportes y servicios" },
  { key: "enrollments", path: "inscripciones", label: "Inscripciones" },
  { key: "reports", path: "reportes", label: "Reportes" },
  { key: "billing", path: "cobranza", label: "Cobranza" },
];


export function AdminDashboard({ token, currentUser }: { token: string; currentUser: User }) {
  const location = useLocation();
  const section = location.pathname.split("/").pop() ?? "";
  const activeTab = ADMIN_TABS.find((entry) => entry.path === section)?.key ?? "users";

  return (
    <>
      <section className="admin-summary-strip">
        <div><span className="overline">Control institucional</span><h2>Administración general.</h2><p>Usuarios, estructura académica, servicios e inscripciones del centro.</p></div>
      </section>
      <div className="admin-tabs" role="tablist">
        {ADMIN_TABS.map((entry) => (
          <NavLink
            key={entry.key}
            to={`/admin/${entry.path}`}
            className={({ isActive }) => `admin-tab ${isActive ? "admin-tab-active" : ""}`}
          >
            {entry.label}
          </NavLink>
        ))}
      </div>
      {activeTab === "users" && <AdminUsersTab token={token} currentUser={currentUser} />}
      {activeTab === "academic" && <AdminAcademicTab token={token} />}
      {activeTab === "services" && <AdminServicesTab token={token} />}
      {activeTab === "enrollments" && <AdminEnrollmentsTab token={token} />}
      {activeTab === "reports" && <AdminReportsTab token={token} />}
      {activeTab === "billing" && <BillingReports token={token} />}
    </>
  );
}


export function AdminReportsTab({ token }: { token: string }) {
  const [entities, setEntities] = useState<ReportEntity[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);

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

  async function generate() {
    if (!selectedId) return;
    setGenerating(true);
    setNotice(null);
    try {
      const result = await apiRequest<{ report: GeneratedReport }>(
        `/director/report-templates/${selectedId}/generate`,
        { method: "POST", token, body: JSON.stringify({}) },
      );
      setReport(result.report);
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setGenerating(false);
    }
  }

  function exportCsv() {
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
      <div className="admin-grid">
        <section className="surface-panel">
          <PanelHeading eyebrow="RF-AD-04" title="Reportes institucionales" detail="Plantillas autorizadas por Dirección para consulta y generación." />
          {templates.length === 0 ? (
            <EmptyState title="Sin plantillas disponibles" detail="Dirección todavía no configuró plantillas de reportes." compact />
          ) : (
            <>
              <div className="inline-form">
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  <option value="">Seleccionar plantilla</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {entities.find((entity) => entity.key === template.entity)?.label ?? template.entity}
                      {template.active ? "" : " (desactivada)"}
                    </option>
                  ))}
                </select>
                <button className="primary-button" disabled={!selectedId || generating} onClick={() => void generate()}>
                  {generating ? "Generando..." : "Generar"}
                </button>
              </div>
            </>
          )}
        </section>
        <section className="surface-panel">
          <PanelHeading eyebrow="Plantillas" title="Catálogo autorizado" detail="Solo lectura para el rol administrador." />
          <ul className="admin-list">
            {templates.map((template) => (
              <li key={template.id}>
                <span>{template.name} · {template.fields.length} campos</span>
                <span className={`status-chip ${template.active ? "success-chip" : "inactive-chip"}`}>{template.active ? "Activa" : "Desactivada"}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {report && (
        <section className="surface-panel report-panel">
          <div className="panel-heading report-heading">
            <div><PanelHeading eyebrow="Reporte generado" title={report.columns.map((column) => column.label).join(" · ")} detail={`${report.rows.length} registros · ${new Date(report.generatedAt).toLocaleString("es-AR")}`} /></div>
            <button className="secondary-button" onClick={exportCsv}>Exportar CSV</button>
          </div>
          {report.rows.length === 0 ? <EmptyState title="Sin datos para esta plantilla" detail="La entidad elegida todavía no tiene registros cargados." compact /> : <div className="user-table-wrap"><table className="user-table"><thead><tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{report.rows.map((row, index) => <tr key={index}>{report.columns.map((column) => <td key={column.key}>{row[column.key]}</td>)}</tr>)}</tbody></table></div>}
        </section>
      )}
    </>
  );
}


export function AdminUsersTab({ token, currentUser }: { token: string; currentUser: User }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "student" as UserRole });
  const [editing, setEditing] = useState<{ id: number; displayName: string; password: string } | null>(null);

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
      setNotice({
        tone: "success",
        text: change.role
          ? `El rol de ${result.user.displayName} fue actualizado.`
          : `El estado de ${result.user.displayName} fue actualizado.`,
      });
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setNotice(null);
    try {
      const body: { displayName: string; password?: string } = { displayName: editing.displayName };
      if (editing.password) body.password = editing.password;
      const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${editing.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      setUsers((current) => current.map((item) => item.id === result.user.id ? result.user : item));
      setEditing(null);
      setNotice({ tone: "success", text: "Los datos del usuario fueron actualizados." });
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton />;
  if (error && users.length === 0) return <ErrorState message={error} onRetry={() => void loadUsers()} />;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
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
          <div className="admin-panel-stats">
            <PanelHeading eyebrow="Directorio" title="Usuarios del sistema" detail="El estado y el rol se aplican desde el servidor." />
            <div className="admin-stat"><strong>{users.length}</strong><span>cuentas</span></div>
            <div className="admin-stat"><strong>{users.filter((item) => item.status === "active").length}</strong><span>activas</span></div>
          </div>
          {editing && (
            <form onSubmit={saveUser} className="form-stack inline-edit-form">
              <div className="inline-edit-grid">
                <label className="field"><span>Nombre visible</span><input value={editing.displayName} onChange={(event) => setEditing({ ...editing, displayName: event.target.value })} required /></label>
                <label className="field"><span>Nueva contraseña (opcional)</span><input type="password" minLength={8} value={editing.password} onChange={(event) => setEditing({ ...editing, password: event.target.value })} placeholder="Dejar vacío para conservarla" /></label>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
                <button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </form>
          )}
          {users.length === 0 ? <EmptyState title="No hay usuarios registrados" detail="Creá la primera cuenta desde el formulario." compact /> : <div className="user-table-wrap"><table className="user-table"><thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{users.map((item) => <tr key={item.id}><td><div className="table-person"><span className="table-avatar">{item.displayName.slice(0, 1)}</span><span><strong>{item.displayName}</strong><small>@{item.username}</small></span></div></td><td><select className="table-select" value={item.role} disabled={item.id === currentUser.id} onChange={(event) => void changeUser(item, { role: event.target.value as UserRole })}>{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><span className={`status-chip ${item.status === "active" ? "success-chip" : "inactive-chip"}`}>{item.status === "active" ? "Activo" : "Inactivo"}</span></td><td><div className="row-actions"><button className="text-button" onClick={() => setEditing({ id: item.id, displayName: item.displayName, password: "" })}>Editar</button><button className="text-button" disabled={item.id === currentUser.id} onClick={() => void changeUser(item, { status: item.status === "active" ? "inactive" : "active" })}>{item.status === "active" ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </>
  );
}


export function AdminAcademicTab({ token }: { token: string }) {
  const [data, setData] = useState<AcademicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [levelName, setLevelName] = useState("");
  const [courseForm, setCourseForm] = useState({ levelId: "", name: "" });
  const [subjectName, setSubjectName] = useState("");
  const [offeringForm, setOfferingForm] = useState({ courseId: "", subjectId: "", teacherId: "", weekday: "1", startTime: "08:00", endTime: "09:00" });
  const [yearValue, setYearValue] = useState("");
  const [editingTeacher, setEditingTeacher] = useState<{ id: number; specialty: string; phone: string } | null>(null);
  const [editingParent, setEditingParent] = useState<{ id: number; fullName: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await apiRequest<AcademicOverview>("/admin/academic", { token }));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function run(action: () => Promise<unknown>, successText: string) {
    setSaving(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: successText });
      await load();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <div className="admin-grid">
        <section className="surface-panel">
          <PanelHeading eyebrow="Estructura" title="Niveles y cursos" detail="Cada curso pertenece a un único nivel (RN-03)." />
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/admin/levels", { method: "POST", token, body: JSON.stringify({ name: levelName }) }), "Nivel creado correctamente.").then(() => setLevelName("")); }}>
            <input value={levelName} onChange={(event) => setLevelName(event.target.value)} placeholder="Nuevo nivel" required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar nivel</button>
          </form>
          <ul className="admin-list">
            {data.levels.map((level) => (
              <li key={level.id}>
                <span>{level.name}</span>
                <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/levels/${level.id}`, { method: "DELETE", token }), "Nivel eliminado correctamente.")}>Eliminar</button>
              </li>
            ))}
          </ul>
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/admin/courses", { method: "POST", token, body: JSON.stringify({ levelId: Number(courseForm.levelId), name: courseForm.name }) }), "Curso creado correctamente.").then(() => setCourseForm({ levelId: "", name: "" })); }}>
            <select value={courseForm.levelId} onChange={(event) => setCourseForm({ ...courseForm, levelId: event.target.value })} required>
              <option value="">Nivel</option>
              {data.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
            </select>
            <input value={courseForm.name} onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })} placeholder="Curso (ej. 5to A)" required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar curso</button>
          </form>
          <ul className="admin-list">
            {data.courses.map((course) => (
              <li key={course.id}>
                <span>{course.level} · {course.name}</span>
                <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/courses/${course.id}`, { method: "DELETE", token }), "Curso eliminado correctamente.")}>Eliminar</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Plan de estudios" title="Materias y asignaciones" detail="Materia, curso, docente y horario del cursado." />
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/admin/subjects", { method: "POST", token, body: JSON.stringify({ name: subjectName }) }), "Materia creada correctamente.").then(() => setSubjectName("")); }}>
            <input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Nueva materia" required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar materia</button>
          </form>
          <ul className="admin-list">
            {data.subjects.map((subject) => (
              <li key={subject.id}>
                <span>{subject.name}</span>
                <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/subjects/${subject.id}`, { method: "DELETE", token }), "Materia eliminada correctamente.")}>Eliminar</button>
              </li>
            ))}
          </ul>
          <form
            className="inline-form inline-form-wrap"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => apiRequest("/admin/course-subjects", {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    courseId: Number(offeringForm.courseId),
                    subjectId: Number(offeringForm.subjectId),
                    teacherId: Number(offeringForm.teacherId),
                    weekday: Number(offeringForm.weekday),
                    startTime: offeringForm.startTime,
                    endTime: offeringForm.endTime,
                  }),
                }),
                "Asignación creada correctamente.",
              );
            }}
          >
            <select value={offeringForm.courseId} onChange={(event) => setOfferingForm({ ...offeringForm, courseId: event.target.value })} required>
              <option value="">Curso</option>
              {data.courses.map((course) => <option key={course.id} value={course.id}>{course.level} · {course.name}</option>)}
            </select>
            <select value={offeringForm.subjectId} onChange={(event) => setOfferingForm({ ...offeringForm, subjectId: event.target.value })} required>
              <option value="">Materia</option>
              {data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <select value={offeringForm.teacherId} onChange={(event) => setOfferingForm({ ...offeringForm, teacherId: event.target.value })} required>
              <option value="">Docente</option>
              {data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </select>
            <select value={offeringForm.weekday} onChange={(event) => setOfferingForm({ ...offeringForm, weekday: event.target.value })}>
              {WEEKDAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
            <input type="time" value={offeringForm.startTime} onChange={(event) => setOfferingForm({ ...offeringForm, startTime: event.target.value })} required />
            <input type="time" value={offeringForm.endTime} onChange={(event) => setOfferingForm({ ...offeringForm, endTime: event.target.value })} required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar asignación</button>
          </form>
          <ul className="admin-list">
            {data.courseSubjects.map((offering) => (
              <li key={offering.id}>
                <span>{offering.subject} · {offering.level} {offering.course} · {offering.weekdayName} {offering.startTime}-{offering.endTime} · {offering.teacher}</span>
                <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/course-subjects/${offering.id}`, { method: "DELETE", token }), "Asignación eliminada correctamente.")}>Eliminar</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Ciclo lectivo" title="Años lectivos" detail="Solo un año puede quedar activo para matricular." />
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/admin/school-years", { method: "POST", token, body: JSON.stringify({ year: Number(yearValue) }) }), "Año lectivo creado correctamente.").then(() => setYearValue("")); }}>
            <input type="number" min={2000} max={2100} value={yearValue} onChange={(event) => setYearValue(event.target.value)} placeholder="Año (ej. 2027)" required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar año</button>
          </form>
          <ul className="admin-list">
            {data.schoolYears.map((year) => (
              <li key={year.id}>
                <span>{year.year} · {year.enrollmentCount} matrículas {year.active ? "· activo" : ""}</span>
                {!year.active && <button className="text-button" onClick={() => void run(() => apiRequest(`/admin/school-years/${year.id}`, { method: "PATCH", token, body: JSON.stringify({ active: true }) }), "Año lectivo activado.")}>Activar</button>}
                {year.active && <span className="status-chip success-chip">Activo</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Personas" title="Docentes" detail="Legajo, especialidad y contacto." />
          {editingTeacher && (
            <form
              className="form-stack inline-edit-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => apiRequest(`/admin/teachers/${editingTeacher.id}`, { method: "PATCH", token, body: JSON.stringify({ specialty: editingTeacher.specialty, phone: editingTeacher.phone }) }),
                  "Docente actualizado correctamente.",
                ).then(() => setEditingTeacher(null));
              }}
            >
              <div className="inline-edit-grid">
                <label className="field"><span>Especialidad</span><input value={editingTeacher.specialty} onChange={(event) => setEditingTeacher({ ...editingTeacher, specialty: event.target.value })} required /></label>
                <label className="field"><span>Teléfono</span><input value={editingTeacher.phone} onChange={(event) => setEditingTeacher({ ...editingTeacher, phone: event.target.value })} /></label>
              </div>
              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={saving}>Guardar</button>
                <button className="secondary-button" type="button" onClick={() => setEditingTeacher(null)}>Cancelar</button>
              </div>
            </form>
          )}
          <ul className="admin-list">
            {data.teachers.map((teacher) => (
              <li key={teacher.id}>
                <span>{teacher.fullName} · {teacher.specialty} {teacher.phone ? `· ${teacher.phone}` : ""}</span>
                <button className="text-button" onClick={() => setEditingTeacher({ id: teacher.id, specialty: teacher.specialty, phone: teacher.phone ?? "" })}>Editar</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Personas" title="Padres y madres" detail="Vínculos con sus hijos asociados." />
          {editingParent && (
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void run(
                  () => apiRequest(`/admin/parents/${editingParent.id}`, { method: "PATCH", token, body: JSON.stringify({ fullName: editingParent.fullName }) }),
                  "Padre/madre actualizado correctamente.",
                ).then(() => setEditingParent(null));
              }}
            >
              <input value={editingParent.fullName} onChange={(event) => setEditingParent({ ...editingParent, fullName: event.target.value })} required />
              <button className="primary-button" type="submit" disabled={saving}>Guardar</button>
              <button className="secondary-button" type="button" onClick={() => setEditingParent(null)}>Cancelar</button>
            </form>
          )}
          <ul className="admin-list">
            {data.parents.map((parent) => (
              <li key={parent.id}>
                <span>{parent.fullName} · hijos: {parent.children.length > 0 ? parent.children.map((child) => child.fullName).join(", ") : "sin asociar"}</span>
                <button className="text-button" onClick={() => setEditingParent({ id: parent.id, fullName: parent.fullName })}>Editar</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel admin-wide-panel">
          <PanelHeading eyebrow="Matrícula" title="Alumnos" detail="Curso, estado y vínculos familiares." />
          <div className="user-table-wrap">
            <table className="user-table">
              <thead><tr><th>Alumno</th><th>Curso</th><th>Estado</th><th>Familiares</th></tr></thead>
              <tbody>
                {data.students.map((student) => (
                  <tr key={student.id}>
                    <td><div className="table-person"><span className="table-avatar">{student.fullName.slice(0, 1)}</span><span><strong>{student.fullName}</strong><small>{student.recordNumber} · DNI {student.dni}</small></span></div></td>
                    <td>
                      <select
                        className="table-select"
                        value={student.courseId ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          void run(
                            () => apiRequest(`/admin/students/${student.id}`, { method: "PATCH", token, body: JSON.stringify({ courseId: value ? Number(value) : null }) }),
                            "Curso del alumno actualizado.",
                          );
                        }}
                      >
                        <option value="">Pendiente</option>
                        {data.courses.map((course) => <option key={course.id} value={course.id}>{course.level} · {course.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <button
                        className={`status-chip ${student.status === "active" ? "success-chip" : "inactive-chip"}`}
                        onClick={() => void run(() => apiRequest(`/admin/students/${student.id}`, { method: "PATCH", token, body: JSON.stringify({ status: student.status === "active" ? "inactive" : "active" }) }), "Estado del alumno actualizado.")}
                      >
                        {student.status === "active" ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td>
                      <div className="chip-list">
                        {data.parents.filter((parent) => parent.children.some((child) => child.id === student.id)).map((parent) => (
                          <span key={parent.id} className="chip">
                            {parent.fullName}
                            <button className="chip-remove" title="Quitar vínculo" onClick={() => void run(() => apiRequest(`/admin/students/${student.id}/parents/${parent.id}`, { method: "DELETE", token }), "Vínculo eliminado.")}>×</button>
                          </span>
                        ))}
                        <select
                          className="table-select"
                          value=""
                          onChange={(event) => {
                            const parentId = event.target.value;
                            if (!parentId) return;
                            void run(() => apiRequest(`/admin/students/${student.id}/parents`, { method: "POST", token, body: JSON.stringify({ parentId: Number(parentId) }) }), "Vínculo registrado.");
                          }}
                        >
                          <option value="">Asociar familiar</option>
                          {data.parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.fullName}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}


export function AdminServicesTab({ token }: { token: string }) {
  const [data, setData] = useState<ServicesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sportName, setSportName] = useState("");
  const [groupForm, setGroupForm] = useState({ sportId: "", teacherId: "", levelId: "", weekday: "1", startTime: "16:00", endTime: "17:00" });
  const [routeForm, setRouteForm] = useState({ name: "", description: "" });
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [levels, setLevels] = useState<AcademicLevel[]>([]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [services, academic] = await Promise.all([
        apiRequest<ServicesOverview>("/admin/services", { token }),
        apiRequest<AcademicOverview>("/admin/academic", { token }),
      ]);
      setData(services);
      setTeachers(academic.teachers);
      setLevels(academic.levels);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function run(action: () => Promise<unknown>, successText: string) {
    setSaving(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: successText });
      await load();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <div className="admin-grid">
        <section className="surface-panel">
          <PanelHeading eyebrow="Extracurricular" title="Deportes" detail="Cada deporte se divide en grupos por nivel y horario (RN-09)." />
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/admin/sports", { method: "POST", token, body: JSON.stringify({ name: sportName }) }), "Deporte creado correctamente.").then(() => setSportName("")); }}>
            <input value={sportName} onChange={(event) => setSportName(event.target.value)} placeholder="Nuevo deporte" required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar</button>
          </form>
          <ul className="admin-list">
            {data.sports.map((sport) => (
              <li key={sport.id}>
                <span>{sport.name} · {sport.groupCount} grupos</span>
                <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/sports/${sport.id}`, { method: "DELETE", token }), "Deporte eliminado correctamente.")}>Eliminar</button>
              </li>
            ))}
          </ul>
          <form
            className="inline-form inline-form-wrap"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () => apiRequest("/admin/sport-groups", {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    sportId: Number(groupForm.sportId),
                    teacherId: Number(groupForm.teacherId),
                    levelId: groupForm.levelId ? Number(groupForm.levelId) : null,
                    weekday: Number(groupForm.weekday),
                    startTime: groupForm.startTime,
                    endTime: groupForm.endTime,
                  }),
                }),
                "Grupo deportivo creado correctamente.",
              );
            }}
          >
            <select value={groupForm.sportId} onChange={(event) => setGroupForm({ ...groupForm, sportId: event.target.value })} required>
              <option value="">Deporte</option>
              {data.sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
            </select>
            <select value={groupForm.teacherId} onChange={(event) => setGroupForm({ ...groupForm, teacherId: event.target.value })} required>
              <option value="">Docente</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
            </select>
            <select value={groupForm.levelId} onChange={(event) => setGroupForm({ ...groupForm, levelId: event.target.value })}>
              <option value="">Todos los niveles</option>
              {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
            </select>
            <select value={groupForm.weekday} onChange={(event) => setGroupForm({ ...groupForm, weekday: event.target.value })}>
              {WEEKDAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
            <input type="time" value={groupForm.startTime} onChange={(event) => setGroupForm({ ...groupForm, startTime: event.target.value })} required />
            <input type="time" value={groupForm.endTime} onChange={(event) => setGroupForm({ ...groupForm, endTime: event.target.value })} required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar grupo</button>
          </form>
          <ul className="admin-list">
            {data.sportGroups.map((group) => (
              <li key={group.id}>
                <span>{group.sport} · {group.level} · {group.weekdayName} {group.startTime}-{group.endTime} · {group.enrollmentCount} inscriptos</span>
                <div className="row-actions">
                  <button className="text-button" onClick={() => void run(() => apiRequest(`/admin/sport-groups/${group.id}`, { method: "PATCH", token, body: JSON.stringify({ active: !group.active }) }), "Estado del grupo actualizado.")}>{group.active ? "Desactivar" : "Activar"}</button>
                  <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/sport-groups/${group.id}`, { method: "DELETE", token }), "Grupo eliminado correctamente.")}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Servicios" title="Transporte" detail="El servicio mantiene exactamente cuatro recorridos (RN-05)." />
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => apiRequest("/admin/transport-routes", { method: "POST", token, body: JSON.stringify(routeForm) }), "Recorrido creado correctamente.").then(() => setRouteForm({ name: "", description: "" })); }}>
            <input value={routeForm.name} onChange={(event) => setRouteForm({ ...routeForm, name: event.target.value })} placeholder="Nombre del recorrido" required />
            <input value={routeForm.description} onChange={(event) => setRouteForm({ ...routeForm, description: event.target.value })} placeholder="Descripción" required />
            <button className="secondary-button" type="submit" disabled={saving}>Agregar</button>
          </form>
          <ul className="admin-list">
            {data.transportRoutes.map((route) => (
              <li key={route.id}>
                <span>{route.name} · {route.description} · {route.enrolledCount} alumnos {route.active ? "" : "· inactivo"}</span>
                <div className="row-actions">
                  <button className="text-button" onClick={() => void run(() => apiRequest(`/admin/transport-routes/${route.id}`, { method: "PATCH", token, body: JSON.stringify({ active: !route.active }) }), "Estado del recorrido actualizado.")}>{route.active ? "Desactivar" : "Activar"}</button>
                  <button className="text-button danger-text" onClick={() => void run(() => apiRequest(`/admin/transport-routes/${route.id}`, { method: "DELETE", token }), "Recorrido eliminado correctamente.")}>Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}


export function AdminEnrollmentsTab({ token }: { token: string }) {
  const [data, setData] = useState<EnrollmentsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await apiRequest<EnrollmentsOverview>("/admin/enrollments", { token }));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function run(action: () => Promise<unknown>, successText: string) {
    setSaving(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: successText });
      await load();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      <div className="admin-grid">
        <section className="surface-panel">
          <PanelHeading eyebrow="Deportes" title="Inscripciones deportivas" detail="Bajas administrativas con registro de auditoría." />
          {data.sportEnrollments.length === 0 ? <EmptyState title="Sin inscripciones" detail="Los alumnos todavía no se inscribieron a deportes." compact /> : (
            <ul className="admin-list">
              {data.sportEnrollments.map((enrollment) => (
                <li key={enrollment.id}>
                  <span>{enrollment.student} · {enrollment.sport} · {enrollment.weekdayName} {enrollment.startTime}-{enrollment.endTime}</span>
                  <button className="text-button danger-text" disabled={saving} onClick={() => void run(() => apiRequest(`/admin/enrollments/sports/${enrollment.id}`, { method: "DELETE", token }), "Inscripción deportiva cancelada.")}>Cancelar</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Transporte" title="Recorridos asignados" detail="Un único recorrido por alumno (RN-06)." />
          {data.transportEnrollments.length === 0 ? <EmptyState title="Sin recorridos asignados" detail="Ningún alumno tiene transporte activo." compact /> : (
            <ul className="admin-list">
              {data.transportEnrollments.map((enrollment) => (
                <li key={enrollment.studentId}>
                  <span>{enrollment.student} · {enrollment.route}</span>
                  <button className="text-button danger-text" disabled={saving} onClick={() => void run(() => apiRequest(`/admin/enrollments/transport/${enrollment.studentId}`, { method: "DELETE", token }), "Recorrido cancelado.")}>Cancelar</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Comedor" title="Inscripciones al comedor" detail="Activar o dar de baja el servicio." />
          {data.cafeteria.length === 0 ? <EmptyState title="Sin inscripciones" detail="Ningún alumno usa el comedor." compact /> : (
            <ul className="admin-list">
              {data.cafeteria.map((enrollment) => (
                <li key={enrollment.studentId}>
                  <span>{enrollment.student} · {enrollment.course} · <span className={`status-chip ${enrollment.active ? "success-chip" : "inactive-chip"}`}>{enrollment.active ? "Activo" : "Inactivo"}</span></span>
                  <button className="text-button" disabled={saving} onClick={() => void run(() => apiRequest(`/admin/enrollments/cafeteria/${enrollment.studentId}`, { method: "PATCH", token, body: JSON.stringify({ active: !enrollment.active }) }), "Estado del comedor actualizado.")}>{enrollment.active ? "Dar de baja" : "Activar"}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-panel">
          <PanelHeading eyebrow="Cursado" title="Matrículas" detail="Matrícula anual por alumno y curso." />
          {data.matriculas.length === 0 ? <EmptyState title="Sin matrículas" detail="Todavía no se registraron matrículas." compact /> : (
            <ul className="admin-list">
              {data.matriculas.map((matricula) => (
                <li key={matricula.id}>
                  <span>{matricula.student} · {matricula.year} · {matricula.level} {matricula.course}</span>
                  <select
                    className="table-select"
                    value={matricula.status}
                    disabled={saving}
                    onChange={(event) => void run(() => apiRequest(`/admin/enrollments/matriculas/${matricula.id}`, { method: "PATCH", token, body: JSON.stringify({ status: event.target.value }) }), "Estado de la matrícula actualizado.")}
                  >
                    <option value="enrolled">Matriculado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
