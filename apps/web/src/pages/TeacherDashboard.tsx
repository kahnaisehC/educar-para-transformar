import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../api";

import type { CourseStudent, TeacherCourse, TeacherProfileView, TeacherReportView } from "../types";

import { DashboardSkeleton, EmptyState, ErrorState, InlineMessage, PanelHeading, downloadCsv, formatDateTime, getErrorMessage } from "../ui";

export function TeacherDashboard({ token, view = "overview" }: { token: string; view?: "overview" | "courses" }) {
  const [profile, setProfile] = useState<TeacherProfileView | null>(null);
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
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [report, setReport] = useState<TeacherReportView | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  async function loadProfile() {
    try {
      const result = await apiRequest<{ profile: TeacherProfileView }>("/teacher/profile", { token });
      setProfile(result.profile);
      setEmail(result.profile.email ?? "");
      setPhone(result.profile.phone ?? "");
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    }
  }

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
    void loadProfile();
    void loadCourses();
  }, [token]);

  useEffect(() => {
    if (!selectedCourse) {
      setStudents([]);
      return;
    }
    let active = true;
    setLoadingStudents(true);
    setStudentsError(null);
    apiRequest<{ students: CourseStudent[] }>(
      `/teacher/courses/students?subjectId=${selectedCourse.subjectId}&level=${encodeURIComponent(selectedCourse.level)}&course=${encodeURIComponent(selectedCourse.course)}`,
      { token },
    )
      .then((result) => {
        if (active) setStudents(result.students);
      })
      .catch((requestError) => {
        if (active) setStudentsError(getErrorMessage(requestError));
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

  async function generateReport() {
    setLoadingReport(true);
    setReportError(null);
    try {
      const result = await apiRequest<{ report: TeacherReportView }>("/teacher/report", { token });
      setReport(result.report);
    } catch (requestError) {
      setReportError(getErrorMessage(requestError));
    } finally {
      setLoadingReport(false);
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

  function exportReportCsv() {
    if (!report) return;
    const header = ["Nivel", "Curso", "Materia", "Día", "Inicio", "Fin", "Alumnos"];
    const lines = report.courses.flatMap((course) =>
      course.subjects.map((subject) => [
        course.level,
        course.course,
        subject.subject,
        subject.weekdayName,
        subject.startTime,
        subject.endTime,
        String(course.studentCount),
      ]),
    );
    downloadCsv("reporte-docente.csv", header, lines);
  }

  return (
    <>
      {notice && <InlineMessage tone={notice.tone}>{notice.text}</InlineMessage>}
      {error && !courses.length && !profile && <ErrorState message={error} onRetry={() => void loadCourses()} />}
      {view === "overview" && (
      <div className="dashboard-columns student-columns">
        <section className="surface-panel teacher-contact-panel">
          <PanelHeading eyebrow="RF-PR-01 · Mi perfil" title={profile?.fullName ?? "Mi perfil docente"} detail="Legajo, especialidad y carga horaria a cargo." />
          {profile ? (
            <>
              <div className="profile-facts">
                <div><span>Legajo</span><strong>{profile.recordNumber ?? "Pendiente"}</strong></div>
                <div><span>DNI</span><strong>{profile.dni ?? "Pendiente"}</strong></div>
                <div><span>Especialidad</span><strong>{profile.specialty}</strong></div>
                <div><span>Estado</span><strong>{profile.status === "active" ? "Activo" : "Inactivo"}</strong></div>
              </div>
              <div className="student-subjects">
                <h4>Carga horaria</h4>
                {profile.subjects.length === 0 && profile.sportGroups.length === 0 ? (
                  <p className="muted-note">Todavía no tenés materias ni grupos asignados.</p>
                ) : (
                  <>
                    {profile.subjects.map((subject) => (
                      <div className="fact-row" key={`${subject.subjectId}-${subject.level}-${subject.course}-${subject.weekday}`}>
                        <span>{subject.subject} · {subject.level} {subject.course}</span>
                        <small>{subject.weekdayName} {subject.startTime}-{subject.endTime}</small>
                      </div>
                    ))}
                    {profile.sportGroups.map((group) => (
                      <div className="fact-row" key={`sport-${group.groupId}`}>
                        <span>{group.sport} · {group.level}</span>
                        <small>{group.weekdayName} {group.startTime}-{group.endTime}</small>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <form onSubmit={saveContact} className="teacher-contact-form form-stack">
                <label className="field"><span>Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="docente@educar.local" required /></label>
                <label className="field"><span>Teléfono</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="3624-000000" required /></label>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
              </form>
            </>
          ) : (
            <div className="detail-loading"><span className="loading-dot" /> Cargando perfil...</div>
          )}
        </section>
        <section className="surface-panel teacher-courses-panel">
          <div className="panel-heading report-heading">
            <div><PanelHeading eyebrow="RF-PR-03 · Mi reporte" title="Reporte docente" detail="Cursos a cargo por nivel, materias y horarios." /></div>
          </div>
          <div className="form-actions report-actions">
            <button className="primary-button" onClick={() => void generateReport()} disabled={loadingReport}>{loadingReport ? "Generando..." : "Generar reporte"}</button>
            {report && <button className="secondary-button" onClick={exportReportCsv}>Exportar CSV</button>}
            {report && <button className="secondary-button" onClick={() => window.print()}>Imprimir</button>}
          </div>
          {reportError && <InlineMessage tone="error">{reportError}</InlineMessage>}
          {report && (
            <div className="report-preview">
              <div className="report-header">
                <div>
                  <h3>{report.teacher.fullName} · {report.teacher.specialty}</h3>
                  <p>Reporte generado el {formatDateTime(report.generatedAt)}</p>
                </div>
              </div>
              {report.courses.length === 0 ? (
                <EmptyState title="Sin cursos asignados" detail="El reporte se completará cuando tengas materias a cargo." compact />
              ) : report.courses.map((course) => (
                <div key={`${course.level}-${course.course}`} className="report-course">
                  <h4>{course.level} · {course.course} <small>{course.studentCount} alumnos</small></h4>
                  <ul className="admin-list">
                    {course.subjects.map((subject) => (
                      <li key={`${subject.subject}-${subject.weekdayName}-${subject.startTime}`}>
                        <span>{subject.subject}</span>
                        <small>{subject.weekdayName} {subject.startTime}-{subject.endTime}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      )}
      {view === "courses" && (
      <section className="surface-panel teacher-courses-panel">
        <PanelHeading eyebrow="Sprint 3 · HU-05" title="Mis cursos" detail="Seleccioná una materia y curso para consultar los alumnos asignados." />
        {loadingCourses ? (
          <div className="detail-loading"><span className="loading-dot" /> Cargando cursos...</div>
        ) : courses.length === 0 ? (
          <EmptyState title="No tenés cursos asignados" detail="Los cursos aparecerán cuando se cargue tu asignación académica." compact />
        ) : (
          <>
            {studentsError && <InlineMessage tone="error">{studentsError}</InlineMessage>}
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
              <button className="secondary-button" disabled={loadingStudents || students.length === 0} onClick={exportStudentsCsv}>
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
      )}
    </>
  );
}
