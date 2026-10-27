import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../api";

import type { StudentDashboardData, StudentReport } from "../types";

import { DashboardSkeleton, EmptyState, ErrorState, InlineMessage, PanelHeading, formatDate, getErrorMessage, getSportInitial } from "../ui";

export function StudentDashboard({ token }: { token: string }) {
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


export function StudentAccountPanel({
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


export function StudentReportView({ report }: { report: StudentReport }) {
  return (
    <div className="report-preview">
      <div className="report-header"><div><span className="overline">Reporte generado</span><h3>{report.profile.full_name}</h3><p>{report.profile.level} · {report.profile.course} · Legajo {report.profile.record_number}</p></div><button className="text-button" onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div className="report-columns"><div><h4>Materias</h4>{report.subjects.map((item) => <div className="fact-row" key={item.subject}><span>{item.subject}</span><small>{item.teacher}</small></div>)}</div><div><h4>Servicios y actividades</h4>{report.sports.map((item, index) => <div className="fact-row" key={`${item.sport}-${index}`}><span>{item.sport}</span><small>{item.weekdayName} · {item.startTime}-{item.endTime}</small></div>)}<div className="fact-row"><span>Transporte</span><small>{report.transport?.name ?? "No inscripto"}</small></div><div className="fact-row"><span>Comedor</span><small>{report.cafeteria ? "Inscripto" : "No inscripto"}</small></div></div></div>
      <small className="report-generated-at">Generado: {new Date(report.generatedAt).toLocaleString("es-AR")}</small>
    </div>
  );
}
