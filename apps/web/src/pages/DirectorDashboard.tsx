import { type FormEvent, useEffect, useState } from "react";

import { apiRequest } from "../api";

import type { GeneratedReport, ReportEntity, ReportFilterOptions, ReportTemplate } from "../types";

import { DashboardSkeleton, EmptyState, ErrorState, InlineMessage, PanelHeading, WEEKDAY_OPTIONS, downloadCsv, getErrorMessage } from "../ui";

export function DirectorDashboard({ token }: { token: string }) {
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
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(null);
  const [filters, setFilters] = useState({
    levelId: "",
    courseId: "",
    subjectId: "",
    sportId: "",
    teacherId: "",
    routeId: "",
    weekday: "",
    schoolYear: "",
  });

  const selectedEntity = entities.find((entity) => entity.key === form.entity);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [entitiesResult, templatesResult, filtersResult] = await Promise.all([
        apiRequest<{ entities: ReportEntity[] }>("/director/report-entities", { token }),
        apiRequest<{ templates: ReportTemplate[] }>("/director/report-templates", { token }),
        apiRequest<{ filters: ReportFilterOptions }>("/director/report-filters", { token }),
      ]);
      setEntities(entitiesResult.entities);
      setTemplates(templatesResult.templates);
      setFilterOptions(filtersResult.filters);
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

  function activeFilters() {
    const entries = Object.entries(filters).filter(([, value]) => value !== "");
    return Object.fromEntries(entries.map(([key, value]) => [key, Number(value)]));
  }

  async function generate(template: ReportTemplate) {
    setGeneratingId(template.id);
    setNotice(null);
    try {
      const result = await apiRequest<{ report: GeneratedReport }>(
        `/director/report-templates/${template.id}/generate`,
        { method: "POST", token, body: JSON.stringify({ filters: activeFilters() }) },
      );
      setReport(result.report);
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
    } finally {
      setGeneratingId(null);
    }
  }

  async function removeTemplate(template: ReportTemplate) {
    if (!window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    setNotice(null);
    try {
      await apiRequest(`/director/report-templates/${template.id}`, { method: "DELETE", token });
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      if (report && editingId === template.id) setReport(null);
      setNotice({ tone: "success", text: "La plantilla fue eliminada." });
    } catch (requestError) {
      setNotice({ tone: "error", text: getErrorMessage(requestError) });
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
          {templates.length === 0 ? <EmptyState title="Sin plantillas todavía" detail="Creá la primera plantilla con los campos que necesites." compact /> : <div className="user-table-wrap"><table className="user-table"><thead><tr><th>Plantilla</th><th>Entidad</th><th>Campos</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{templates.map((template) => <tr key={template.id}><td><div className="table-person"><span className="table-avatar">{template.name.slice(0, 1)}</span><span><strong>{template.name}</strong></span></div></td><td>{entities.find((entity) => entity.key === template.entity)?.label ?? template.entity}</td><td>{template.fields.length}</td><td><span className={`status-chip ${template.active ? "success-chip" : "inactive-chip"}`}>{template.active ? "Activa" : "Desactivada"}</span></td><td><div className="row-actions"><button className="text-button" disabled={generatingId === template.id} onClick={() => void generate(template)}>{generatingId === template.id ? "Generando..." : "Generar"}</button><button className="text-button" onClick={() => startEdit(template)}>Editar</button><button className="text-button" onClick={() => void toggleTemplate(template)}>{template.active ? "Desactivar" : "Activar"}</button><button className="text-button danger-text" onClick={() => void removeTemplate(template)}>Eliminar</button></div></td></tr>)}</tbody>              </table></div>}
        </section>
      </div>
      <section className="surface-panel filter-panel">
        <PanelHeading eyebrow="RF-DI-02/03 · Parámetros de consulta" title="Filtros del reporte" detail="Se aplican al generar cada plantilla según la entidad consultada." />
        {filterOptions && (
          <div className="filter-grid">
            <label className="field"><span>Nivel</span><select value={filters.levelId} onChange={(event) => setFilters({ ...filters, levelId: event.target.value, courseId: "" })}><option value="">Todos</option>{filterOptions.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
            <label className="field"><span>Curso</span><select value={filters.courseId} onChange={(event) => setFilters({ ...filters, courseId: event.target.value })}><option value="">Todos</option>{filterOptions.courses.filter((course) => !filters.levelId || String(course.levelId) === filters.levelId).map((course) => <option key={course.id} value={course.id}>{course.level} · {course.name}</option>)}</select></label>
            <label className="field"><span>Materia</span><select value={filters.subjectId} onChange={(event) => setFilters({ ...filters, subjectId: event.target.value })}><option value="">Todas</option>{filterOptions.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="field"><span>Deporte</span><select value={filters.sportId} onChange={(event) => setFilters({ ...filters, sportId: event.target.value })}><option value="">Todos</option>{filterOptions.sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
            <label className="field"><span>Docente</span><select value={filters.teacherId} onChange={(event) => setFilters({ ...filters, teacherId: event.target.value })}><option value="">Todos</option>{filterOptions.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
            <label className="field"><span>Recorrido</span><select value={filters.routeId} onChange={(event) => setFilters({ ...filters, routeId: event.target.value })}><option value="">Todos</option>{filterOptions.transportRoutes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
            <label className="field"><span>Día</span><select value={filters.weekday} onChange={(event) => setFilters({ ...filters, weekday: event.target.value })}><option value="">Todos</option>{WEEKDAY_OPTIONS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
            <label className="field"><span>Año lectivo</span><select value={filters.schoolYear} onChange={(event) => setFilters({ ...filters, schoolYear: event.target.value })}><option value="">Todos</option>{filterOptions.schoolYears.map((year) => <option key={year.id} value={year.year}>{year.year}</option>)}</select></label>
          </div>
        )}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={() => setFilters({ levelId: "", courseId: "", subjectId: "", sportId: "", teacherId: "", routeId: "", weekday: "", schoolYear: "" })}>Limpiar filtros</button>
        </div>
      </section>
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
