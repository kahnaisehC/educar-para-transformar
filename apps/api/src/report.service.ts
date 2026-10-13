import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { withAuditProxy } from "./auditProxy.js";
import { RowIterator } from "./rowIterator.js";
import { AppError, isAppError } from "./errors.js";
import type { UserRole } from "./auth.js";

export const REPORT_ENTITIES = [
  {
    key: "students",
    label: "Alumnos",
    description: "Legajos académicos de los estudiantes",
    fields: [
      { key: "record_number", label: "Legajo" },
      { key: "dni", label: "DNI" },
      { key: "full_name", label: "Nombre" },
      { key: "level", label: "Nivel" },
      { key: "course", label: "Curso" },
      { key: "status", label: "Estado" },
    ],
  },
  {
    key: "teachers",
    label: "Docentes",
    description: "Plantel docente activo",
    fields: [
      { key: "record_number", label: "Legajo" },
      { key: "dni", label: "DNI" },
      { key: "full_name", label: "Nombre" },
      { key: "specialty", label: "Especialidad" },
      { key: "status", label: "Estado" },
    ],
  },
  {
    key: "sports",
    label: "Inscripciones deportivas",
    description: "Alumnos inscriptos en deportes",
    fields: [
      { key: "student_name", label: "Alumno" },
      { key: "sport", label: "Deporte" },
      { key: "level", label: "Nivel" },
      { key: "weekday", label: "Día" },
      { key: "schedule", label: "Horario" },
      { key: "teacher", label: "Docente" },
    ],
  },
  {
    key: "transport",
    label: "Transporte",
    description: "Recorridos asignados a los alumnos",
    fields: [
      { key: "student_name", label: "Alumno" },
      { key: "route", label: "Recorrido" },
      { key: "enrolled_at", label: "Fecha de inscripción" },
    ],
  },
  {
    key: "cafeteria",
    label: "Comedor",
    description: "Inscripciones al comedor",
    fields: [
      { key: "student_name", label: "Alumno" },
      { key: "status", label: "Estado de inscripción" },
      { key: "enrolled_at", label: "Fecha de inscripción" },
    ],
  },
  {
    key: "cursado",
    label: "Cursado por materia",
    description: "Alumnos con sus materias, docentes y horarios",
    fields: [
      { key: "student_name", label: "Alumno" },
      { key: "record_number", label: "Legajo" },
      { key: "level", label: "Nivel" },
      { key: "course", label: "Curso" },
      { key: "subject", label: "Materia" },
      { key: "teacher", label: "Docente" },
      { key: "weekday", label: "Día" },
      { key: "schedule", label: "Horario" },
    ],
  },
  {
    key: "matriculas",
    label: "Matrículas",
    description: "Matrículas anuales de los alumnos",
    fields: [
      { key: "student_name", label: "Alumno" },
      { key: "record_number", label: "Legajo" },
      { key: "level", label: "Nivel" },
      { key: "course", label: "Curso" },
      { key: "year", label: "Año lectivo" },
      { key: "status", label: "Estado" },
      { key: "enrolled_at", label: "Fecha de matrícula" },
    ],
  },
] as const;

export type ReportEntityKey = (typeof REPORT_ENTITIES)[number]["key"];

export interface ReportTemplate {
  id: number;
  name: string;
  entity: ReportEntityKey;
  fields: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportInput {
  name: string;
  entity: ReportEntityKey;
  fields: string[];
}

interface ReportTemplateRow {
  id: number;
  name: string;
  entity: string;
  fields: unknown;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapTemplate(row: ReportTemplateRow): ReportTemplate {
  const fields = parseFields(row.fields);
  const entity = row.entity as ReportEntityKey;
  const entityCatalog = REPORT_ENTITIES.find((entry) => entry.key === entity);
  const validFields = entityCatalog ? entityCatalog.fields.map((field) => field.key) : [];
  return {
    id: row.id,
    name: row.name,
    entity,
    fields: fields.filter((field) => (validFields as string[]).includes(field)),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseFields(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function validateInput(input: ReportInput): void {
  const entityCatalog = REPORT_ENTITIES.find((entry) => entry.key === input.entity);
  if (!entityCatalog) {
    throw new AppError(400, "La entidad indicada no es válida", "VALIDATION_ERROR");
  }
  const validFields = entityCatalog.fields.map((field) => field.key);
  if (!Array.isArray(input.fields) || input.fields.length === 0) {
    throw new AppError(400, "Debe seleccionar al menos un campo del reporte", "VALIDATION_ERROR");
  }
  const normalized = input.fields.filter((field) => (validFields as string[]).includes(field));
  if (normalized.length === 0) {
    throw new AppError(400, "Los campos seleccionados no pertenecen a la entidad", "VALIDATION_ERROR");
  }
  input.fields = [...new Set(normalized)];
}

export async function listReportTemplates(pool: DatabasePool): Promise<ReportTemplate[]> {
  const result = await pool.query<ReportTemplateRow>(
    `SELECT id, name, entity, fields, active, created_at, updated_at
     FROM report_templates
     ORDER BY created_at DESC, id DESC`,
  );
  return result.rows.map(mapTemplate);
}

export async function getReportTemplate(
  pool: DatabasePool,
  templateId: number,
): Promise<ReportTemplate> {
  const result = await pool.query<ReportTemplateRow>(
    `SELECT id, name, entity, fields, active, created_at, updated_at
     FROM report_templates
     WHERE id = $1`,
    [templateId],
  );
  const template = result.rows[0];
  if (!template) {
    throw new AppError(404, "La plantilla de reporte no existe", "TEMPLATE_NOT_FOUND");
  }
  return mapTemplate(template);
}

export async function createReportTemplate(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  input: ReportInput,
): Promise<ReportTemplate> {
  validateInput(input);
  return withAuditProxy(pool, {
    operation: "create_report_template",
    actorUserId,
    actorRole,
    allowedRoles: ["director"],
    normalizeError: normalizeReportError,
    onSuccess: (template) => ({ templateId: template.id, entity: template.entity }),
    handler: () =>
      withTransaction(pool, async (client) => {
        const result = await client.query<ReportTemplateRow>(
          `INSERT INTO report_templates (name, entity, fields, active, created_by)
           VALUES ($1, $2, $3::jsonb, TRUE, $4)
           RETURNING id, name, entity, fields, active, created_at, updated_at`,
          [input.name, input.entity, JSON.stringify(input.fields), actorUserId],
        );
        return mapTemplate(result.rows[0]);
      }),
  });
}

export async function updateReportTemplate(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  templateId: number,
  input: Partial<ReportInput> & { active?: boolean },
): Promise<ReportTemplate> {
  const current = await getReportTemplate(pool, templateId);
  if (input.entity !== undefined || input.fields !== undefined) {
    validateInput({
      name: input.name ?? current.name,
      entity: input.entity ?? current.entity,
      fields: input.fields ?? current.fields,
    });
  }
  return withAuditProxy(pool, {
    operation: "update_report_template",
    actorUserId,
    actorRole,
    allowedRoles: ["director"],
    normalizeError: normalizeReportError,
    onSuccess: (template) => ({ templateId, changes: input }),
    onError: (error) => ({ templateId, reason: getErrorMessage(error) }),
    handler: () =>
      withTransaction(pool, async (client) => {
        const fields = input.fields ?? current.fields;
        const result = await client.query<ReportTemplateRow>(
          `UPDATE report_templates
           SET name = $1, entity = $2, fields = $3::jsonb, active = $4, updated_at = NOW()
           WHERE id = $5
           RETURNING id, name, entity, fields, active, created_at, updated_at`,
          [
            input.name ?? current.name,
            input.entity ?? current.entity,
            JSON.stringify(fields),
            input.active ?? current.active,
            templateId,
          ],
        );
        const template = result.rows[0];
        if (!template) {
          throw new AppError(404, "La plantilla de reporte no existe", "TEMPLATE_NOT_FOUND");
        }
        return mapTemplate(template);
      }),
  });
}

export interface GeneratedReport {
  entity: ReportEntityKey;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Patrón Iterator: recorrido uniforme sobre las filas de un reporte generado
// ---------------------------------------------------------------------------
// Problema:
//   El tipo `GeneratedReport` expone sus filas como un array plano. Acceder
//   directamente al array acopla al cliente con la estructura interna del
//   reporte y dificulta añadir lógica de recorrido (paginación, filtrado,
//   transformación) sin modificar el servicio.
//
// Solución — Iterator:
//   `ReportRowIterator` encapsula el estado de recorrido (_index) y expone
//   la interfaz estándar de JavaScript (`Iterator` + `Iterable`) para que
//   cualquier consumidor pueda iterar con `for...of` o llamar a `.next()`
//   sin conocer la estructura interna del reporte.
// ---------------------------------------------------------------------------

/**
 * Iterator — recorre las filas de un `GeneratedReport` una a una.
 *
 * Implementa tanto `Iterator<Row>` como `Iterable<Row>`, por lo que puede
 * usarse con `for...of`, destructuring o llamadas manuales a `.next()`.
 *
 * @example
 * ```ts
 * const iter = new ReportRowIterator(report);
 * for (const row of iter) {
 *   console.log(row.full_name);
 * }
 * ```
 */
export class ReportRowIterator
  implements Iterator<Record<string, string>>, Iterable<Record<string, string>>
{
  private _index = 0;
  private readonly _rows: Array<Record<string, string>>;

  constructor(report: GeneratedReport) {
    this._rows = report.rows;
  }

  /** Avanza al siguiente elemento y lo devuelve. */
  next(): IteratorResult<Record<string, string>> {
    if (this._index < this._rows.length) {
      return { value: this._rows[this._index++], done: false };
    }
    return { value: undefined as unknown as Record<string, string>, done: true };
  }

  /** Reinicia el iterador al primer elemento. */
  reset(): void {
    this._index = 0;
  }

  /** Número total de filas disponibles. */
  get length(): number {
    return this._rows.length;
  }

  /** Hace que la instancia sea iterable con `for...of`. */
  [Symbol.iterator](): Iterator<Record<string, string>> {
    this.reset();
    return this;
  }
}

/**
 * Conveniencia: construye un {@link ReportRowIterator} a partir de un reporte
 * ya generado, de modo que los controladores puedan recorrer las filas sin
 * depender de la implementación interna del array.
 */
export function iterateReport(report: GeneratedReport): ReportRowIterator {
  return new ReportRowIterator(report);
}

export async function generateReport(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  templateId: number,
  filters: ReportFilters = {},
): Promise<GeneratedReport> {
  const template = await getReportTemplate(pool, templateId);
  if (!template.active) {
    throw new AppError(409, "La plantilla está desactivada", "TEMPLATE_INACTIVE");
  }
  const entityCatalog = REPORT_ENTITIES.find((entry) => entry.key === template.entity);
  if (!entityCatalog) {
    throw new AppError(400, "La entidad de la plantilla no es válida", "VALIDATION_ERROR");
  }
  const columns = entityCatalog.fields.filter((field) => template.fields.includes(field.key));

  return withAuditProxy(pool, {
    operation: "generate_report",
    actorUserId,
    actorRole,
    allowedRoles: ["director", "admin"],
    normalizeError: normalizeReportError,
    onSuccess: (report) => ({
      templateId,
      entity: report.entity,
      rows: report.rows.length,
      filters,
    }),
    onError: (error) => ({ templateId, reason: getErrorMessage(error) }),
    handler: async () => {
      const rawRows = await runEntityQuery(pool, template.entity, filters);
      const rows = new RowIterator(rawRows, (row) => projectRow(row, columns)).toArray();
      return {
        entity: template.entity,
        columns,
        rows,
        generatedAt: new Date().toISOString(),
      };
    },
  });
}

export async function deleteReportTemplate(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  templateId: number,
): Promise<void> {
  await withAuditProxy(pool, {
    operation: "delete_report_template",
    actorUserId,
    actorRole,
    allowedRoles: ["director"],
    normalizeError: normalizeReportError,
    onSuccess: () => ({ templateId }),
    onError: (error) => ({ templateId, reason: getErrorMessage(error) }),
    handler: async () => {
      const result = await pool.query("DELETE FROM report_templates WHERE id = $1", [templateId]);
      if (!result.rowCount) {
        throw new AppError(404, "La plantilla de reporte no existe", "TEMPLATE_NOT_FOUND");
      }
    },
  });
}

function timeRange(start: unknown, end: unknown): string {
  if (start === null || start === undefined || end === null || end === undefined) {
    return "";
  }
  return `${String(start).slice(0, 5)}-${String(end).slice(0, 5)}`;
}

function projectRow(
  row: Record<string, string>,
  columns: Array<{ key: string; label: string }>,
): Record<string, string> {
  const projected: Record<string, string> = {};
  for (const column of columns) {
    projected[column.key] = row[column.key] ?? "";
  }
  return projected;
}

export interface ReportFilters {
  levelId?: number;
  courseId?: number;
  subjectId?: number;
  sportId?: number;
  teacherId?: number;
  routeId?: number;
  weekday?: number;
  schoolYear?: number;
}

export interface ReportFilterOptions {
  levels: Array<{ id: number; name: string }>;
  courses: Array<{ id: number; levelId: number; level: string; name: string }>;
  subjects: Array<{ id: number; name: string }>;
  sports: Array<{ id: number; name: string }>;
  teachers: Array<{ id: number; name: string }>;
  transportRoutes: Array<{ id: number; name: string }>;
  schoolYears: Array<{ id: number; year: number; active: boolean }>;
}

export async function getReportFilterOptions(pool: DatabasePool): Promise<ReportFilterOptions> {
  const [levels, courses, subjects, sports, teachers, routes, years] = await Promise.all([
    pool.query<{ id: number; name: string }>("SELECT id, name FROM levels ORDER BY name"),
    pool.query<{ id: number; level_id: number; level: string; name: string }>(
      `SELECT c.id, c.level_id, l.name AS level, c.name
       FROM courses c JOIN levels l ON l.id = c.level_id
       ORDER BY l.name, c.name`,
    ),
    pool.query<{ id: number; name: string }>("SELECT id, name FROM subjects ORDER BY name"),
    pool.query<{ id: number; name: string }>("SELECT id, name FROM sports ORDER BY name"),
    pool.query<{ id: number; name: string }>(
      "SELECT id, full_name AS name FROM teachers ORDER BY full_name",
    ),
    pool.query<{ id: number; name: string }>(
      "SELECT id, name FROM transport_routes ORDER BY name",
    ),
    pool.query<{ id: number; year: number; active: boolean }>(
      "SELECT id, year, active FROM school_years ORDER BY year DESC",
    ),
  ]);
  return {
    levels: levels.rows,
    courses: courses.rows.map((row) => ({
      id: row.id,
      levelId: row.level_id,
      level: row.level,
      name: row.name,
    })),
    subjects: subjects.rows,
    sports: sports.rows,
    teachers: teachers.rows,
    transportRoutes: routes.rows,
    schoolYears: years.rows,
  };
}

interface EntityQuery {
  select: string;
  from: string;
  orderBy: string;
  filters: Array<{ key: keyof ReportFilters; column: string }>;
  stringify: (row: Record<string, unknown>) => Record<string, string>;
}

const ENTITY_QUERIES: Record<ReportEntityKey, EntityQuery> = {
  students: {
    select: `st.record_number, st.dni, st.full_name,
             COALESCE(l.name, 'Pendiente') AS level,
             COALESCE(c.name, 'Pendiente') AS course,
             st.status`,
    from: `FROM students st
           LEFT JOIN courses c ON c.id = st.course_id
           LEFT JOIN levels l ON l.id = c.level_id`,
    orderBy: "ORDER BY l.name, c.name, st.full_name",
    filters: [
      { key: "levelId", column: "l.id" },
      { key: "courseId", column: "c.id" },
    ],
    stringify: (row) => ({
      record_number: String(row.record_number ?? ""),
      dni: String(row.dni ?? ""),
      full_name: String(row.full_name ?? ""),
      level: String(row.level ?? ""),
      course: String(row.course ?? ""),
      status: String(row.status ?? ""),
    }),
  },
  teachers: {
    select: "t.record_number, t.dni, t.full_name, t.specialty, t.status",
    from: "FROM teachers t",
    orderBy: "ORDER BY t.full_name",
    filters: [{ key: "teacherId", column: "t.id" }],
    stringify: (row) => ({
      record_number: String(row.record_number ?? ""),
      dni: String(row.dni ?? ""),
      full_name: String(row.full_name ?? ""),
      specialty: String(row.specialty ?? ""),
      status: String(row.status ?? ""),
    }),
  },
  sports: {
    select: `st.full_name AS student_name, s.name AS sport,
             COALESCE(l.name, 'Todos') AS level,
             CASE sg.weekday
               WHEN 1 THEN 'Lunes'
               WHEN 2 THEN 'Martes'
               WHEN 3 THEN 'Miercoles'
               WHEN 4 THEN 'Jueves'
               WHEN 5 THEN 'Viernes'
               WHEN 6 THEN 'Sabado'
               ELSE 'Domingo'
             END AS weekday,
             sg.start_time, sg.end_time,
             t.full_name AS teacher`,
    from: `FROM sport_enrollments se
           JOIN students st ON st.id = se.student_id
           JOIN sport_groups sg ON sg.id = se.group_id
           JOIN sports s ON s.id = sg.sport_id
           JOIN teachers t ON t.id = sg.teacher_id
           LEFT JOIN levels l ON l.id = sg.level_id`,
    orderBy: "ORDER BY s.name, st.full_name",
    filters: [
      { key: "sportId", column: "s.id" },
      { key: "levelId", column: "l.id" },
      { key: "teacherId", column: "t.id" },
      { key: "weekday", column: "sg.weekday" },
    ],
    stringify: (row) => ({
      student_name: String(row.student_name ?? ""),
      sport: String(row.sport ?? ""),
      level: String(row.level ?? ""),
      weekday: String(row.weekday ?? ""),
      schedule: timeRange(row.start_time, row.end_time),
      teacher: String(row.teacher ?? ""),
    }),
  },
  transport: {
    select: "st.full_name AS student_name, tr.name AS route, te.created_at",
    from: `FROM transport_enrollments te
           JOIN students st ON st.id = te.student_id
           JOIN transport_routes tr ON tr.id = te.route_id
           LEFT JOIN courses c ON c.id = st.course_id
           LEFT JOIN levels l ON l.id = c.level_id`,
    orderBy: "ORDER BY tr.name, st.full_name",
    filters: [
      { key: "routeId", column: "tr.id" },
      { key: "levelId", column: "l.id" },
      { key: "courseId", column: "c.id" },
    ],
    stringify: (row) => ({
      student_name: String(row.student_name ?? ""),
      route: String(row.route ?? ""),
      enrolled_at: String(row.created_at ?? ""),
    }),
  },
  cafeteria: {
    select: `st.full_name AS student_name,
             CASE WHEN ce.active THEN 'Inscripto' ELSE 'No inscripto' END AS status,
             ce.created_at AS enrolled_at`,
    from: `FROM cafeteria_enrollments ce
           JOIN students st ON st.id = ce.student_id
           LEFT JOIN courses c ON c.id = st.course_id
           LEFT JOIN levels l ON l.id = c.level_id`,
    orderBy: "ORDER BY st.full_name",
    filters: [
      { key: "levelId", column: "l.id" },
      { key: "courseId", column: "c.id" },
    ],
    stringify: (row) => ({
      student_name: String(row.student_name ?? ""),
      status: String(row.status ?? ""),
      enrolled_at: String(row.enrolled_at ?? ""),
    }),
  },
  cursado: {
    select: `st.full_name AS student_name, st.record_number,
             COALESCE(l.name, 'Pendiente') AS level,
             COALESCE(c.name, 'Pendiente') AS course,
             sub.name AS subject, t.full_name AS teacher,
             CASE cs.weekday
               WHEN 1 THEN 'Lunes'
               WHEN 2 THEN 'Martes'
               WHEN 3 THEN 'Miercoles'
               WHEN 4 THEN 'Jueves'
               WHEN 5 THEN 'Viernes'
               WHEN 6 THEN 'Sabado'
               WHEN 7 THEN 'Domingo'
             END AS weekday,
             cs.start_time, cs.end_time`,
    from: `FROM student_subjects ss
           JOIN students st ON st.id = ss.student_id
           JOIN subjects sub ON sub.id = ss.subject_id
           JOIN teachers t ON t.id = ss.teacher_id
           LEFT JOIN courses c ON c.id = st.course_id
           LEFT JOIN levels l ON l.id = c.level_id
           LEFT JOIN course_subjects cs
             ON cs.course_id = st.course_id
            AND cs.subject_id = ss.subject_id
            AND cs.teacher_id = ss.teacher_id`,
    orderBy: "ORDER BY l.name, c.name, sub.name, st.full_name",
    filters: [
      { key: "levelId", column: "l.id" },
      { key: "courseId", column: "c.id" },
      { key: "subjectId", column: "sub.id" },
      { key: "teacherId", column: "t.id" },
      { key: "weekday", column: "cs.weekday" },
    ],
    stringify: (row) => ({
      student_name: String(row.student_name ?? ""),
      record_number: String(row.record_number ?? ""),
      level: String(row.level ?? ""),
      course: String(row.course ?? ""),
      subject: String(row.subject ?? ""),
      teacher: String(row.teacher ?? ""),
      weekday: String(row.weekday ?? ""),
      schedule: timeRange(row.start_time, row.end_time),
    }),
  },
  matriculas: {
    select: `st.full_name AS student_name, st.record_number,
             l.name AS level, c.name AS course,
             sy.year, sye.status, sye.created_at`,
    from: `FROM school_year_enrollments sye
           JOIN students st ON st.id = sye.student_id
           JOIN courses c ON c.id = sye.course_id
           JOIN levels l ON l.id = c.level_id
           JOIN school_years sy ON sy.id = sye.school_year_id`,
    orderBy: "ORDER BY sy.year DESC, l.name, c.name, st.full_name",
    filters: [
      { key: "levelId", column: "l.id" },
      { key: "courseId", column: "c.id" },
      { key: "schoolYear", column: "sy.year" },
    ],
    stringify: (row) => ({
      student_name: String(row.student_name ?? ""),
      record_number: String(row.record_number ?? ""),
      level: String(row.level ?? ""),
      course: String(row.course ?? ""),
      year: String(row.year ?? ""),
      status: String(row.status ?? ""),
      enrolled_at: String(row.created_at ?? ""),
    }),
  },
};

async function runEntityQuery(
  pool: DatabasePool,
  entity: ReportEntityKey,
  filters: ReportFilters = {},
): Promise<Array<Record<string, string>>> {
  const spec = ENTITY_QUERIES[entity];
  const conditions: string[] = [];
  const params: unknown[] = [];
  for (const filter of spec.filters) {
    const value = filters[filter.key];
    if (value === undefined || value === null) {
      continue;
    }
    params.push(value);
    conditions.push(`${filter.column} = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT ${spec.select} ${spec.from} ${where} ${spec.orderBy}`;
  const result = await pool.query(sql, params);
  return new RowIterator(result.rows, (row) => spec.stringify(row)).toArray();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación";
}

function normalizeReportError(error: unknown): Error {
  if (isAppError(error)) return error;
  return error instanceof Error ? error : new Error("No se pudo completar la operación");
}