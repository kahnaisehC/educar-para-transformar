import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../api";

import type { Child, ChildEnrollmentView, ChildSummary } from "../types";

import { DashboardSkeleton, EmptyState, ErrorState, InlineMessage, PanelHeading, getErrorMessage, getSportInitial } from "../ui";

export function ParentDashboard({ token }: { token: string }) {
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
    setSummary(null);
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
            <ChildDetail summary={summary} token={token} />
          )}
        </section>
      </div>
    </>
  );
}


export function ChildDetail({ summary, token }: { summary: ChildSummary; token: string }) {
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
      <ChildEnrollmentPanel studentId={summary.id} token={token} />
    </>
  );
}


export function ChildEnrollmentPanel({ studentId, token }: { studentId: number; token: string }) {
  const [enrollment, setEnrollment] = useState<ChildEnrollmentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setNotice(null);
    try {
      const result = await apiRequest<{ enrollment: ChildEnrollmentView }>(
        `/parent/children/${studentId}/enrollment`,
        { token },
      );
      setEnrollment(result.enrollment);
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [studentId, token]);

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId) return;
    setSaving(true);
    setNotice(null);
    try {
      await apiRequest(`/parent/children/${studentId}/enrollment`, {
        method: "POST",
        token,
        body: JSON.stringify({ courseId: Number(courseId) }),
      });
      setCourseId("");
      setNotice({ tone: "success", text: "La matrícula fue registrada correctamente." });
      await load();
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="student-subjects"><div className="detail-loading"><span className="loading-dot" /> Cargando cursado...</div></div>;
  }

  return (
    <div className="student-subjects">
      <div className="section-title"><span className="section-icon">03</span><h3>Cursado {enrollment?.schoolYear ? `· año lectivo ${enrollment.schoolYear.year}` : ""}</h3></div>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      {!enrollment?.schoolYear ? (
        <p className="muted-note">La institución todavía no habilitó el año lectivo.</p>
      ) : enrollment.matricula?.status === "enrolled" ? (
        <>
          <div className="fact-row">
            <span>Matrícula confirmada</span>
            <small>{enrollment.matricula.level} · {enrollment.matricula.course}</small>
          </div>
          {enrollment.subjects.length === 0 ? (
            <p className="muted-note">El curso todavía no tiene materias con horario asignado.</p>
          ) : (
            <div className="fact-list">
              {enrollment.subjects.map((subject) => (
                <div className="fact-row" key={`${subject.subject}-${subject.weekdayName}-${subject.startTime}`}>
                  <span>{subject.subject}</span>
                  <small>{subject.weekdayName} {subject.startTime}-{subject.endTime} · {subject.teacher}</small>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <form className="inline-form inline-form-wrap" onSubmit={enroll}>
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} required>
            <option value="">Seleccionar curso</option>
            {enrollment.courses.map((course) => (
              <option key={course.id} value={course.id}>{course.level} · {course.name}</option>
            ))}
          </select>
          <button className="primary-button" type="submit" disabled={saving || !courseId}>
            {saving ? "Matriculando..." : `Inscribir al año lectivo ${enrollment.schoolYear.year}`}
          </button>
        </form>
      )}
    </div>
  );
}
