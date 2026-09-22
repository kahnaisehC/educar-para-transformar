import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import { AppError, isAppError } from "./errors.js";

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
  input: ReportInput,
): Promise<ReportTemplate> {
  validateInput(input);
  try {
    return await withTransaction(pool, async (client) => {
      const result = await client.query<ReportTemplateRow>(
        `INSERT INTO report_templates (name, entity, fields, active, created_by)
         VALUES ($1, $2, $3::jsonb, TRUE, $4)
         RETURNING id, name, entity, fields, active, created_at, updated_at`,
        [input.name, input.entity, JSON.stringify(input.fields), actorUserId],
      );
      await writeAudit(client, actorUserId, "create_report_template", "success", {
        templateId: result.rows[0].id,
        entity: input.entity,
      });
      return mapTemplate(result.rows[0]);
    });
  } catch (error) {
    const normalized = normalizeReportError(error);
    await tryWriteAudit(pool, actorUserId, "create_report_template", "rejected", {
      reason: normalized.message,
    });
    throw normalized;
  }
}

export async function updateReportTemplate(
  pool: DatabasePool,
  actorUserId: number,
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
  try {
    return await withTransaction(pool, async (client) => {
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
      await writeAudit(client, actorUserId, "update_report_template", "success", {
        templateId,
        changes: input,
      });
      return mapTemplate(template);
    });
  } catch (error) {
    const normalized = normalizeReportError(error);
    await tryWriteAudit(pool, actorUserId, "update_report_template", "rejected", {
      templateId,
      reason: normalized.message,
    });
    throw normalized;
  }
}

export interface GeneratedReport {
  entity: ReportEntityKey;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
  generatedAt: string;
}

export async function generateReport(
  pool: DatabasePool,
  actorUserId: number,
  templateId: number,
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

  let rows: Array<Record<string, string>>;
  try {
    rows = await runEntityQuery(pool, template.entity);
    rows = rows.map((row) => {
      const projected: Record<string, string> = {};
      for (const column of columns) {
        projected[column.key] = row[column.key] ?? "";
      }
      return projected;
    });
  } catch (error) {
    const normalized = isAppError(error) ? error : new Error("No se pudo generar el reporte");
    await tryWriteAudit(pool, actorUserId, "generate_report", "rejected", {
      templateId,
      reason: normalized.message,
    });
    throw normalized;
  }

  await tryWriteAudit(pool, actorUserId, "generate_report", "success", {
    templateId,
    entity: template.entity,
    rows: rows.length,
  });

  return {
    entity: template.entity,
    columns,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

async function runEntityQuery(
  pool: DatabasePool,
  entity: ReportEntityKey,
): Promise<Array<Record<string, string>>> {
  type Row = Record<string, unknown>;
  interface QuerySpec {
    sql: string;
    stringify: (row: Row) => Record<string, string>;
  }
  const queries: Record<ReportEntityKey, QuerySpec> = {
    students: {
      sql: `SELECT st.record_number, st.dni, st.full_name, st.level, st.course, st.status
            FROM students st
            ORDER BY st.level, st.course, st.full_name`,
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
      sql: `SELECT t.record_number, t.dni, t.full_name, t.specialty, t.status
            FROM teachers t
            ORDER BY t.full_name`,
      stringify: (row) => ({
        record_number: String(row.record_number ?? ""),
        dni: String(row.dni ?? ""),
        full_name: String(row.full_name ?? ""),
        specialty: String(row.specialty ?? ""),
        status: String(row.status ?? ""),
      }),
    },
    sports: {
      sql: `SELECT st.full_name AS student_name, s.name AS sport, sg.level,
                   CASE sg.weekday
                     WHEN 1 THEN 'Lunes'
                     WHEN 2 THEN 'Martes'
                     WHEN 3 THEN 'Miercoles'
                     WHEN 4 THEN 'Jueves'
                     WHEN 5 THEN 'Viernes'
                     WHEN 6 THEN 'Sabado'
                     ELSE 'Domingo'
                   END AS weekday,
                   sg.start_time || '-' || sg.end_time AS schedule,
                   t.full_name AS teacher
            FROM sport_enrollments se
            JOIN students st ON st.id = se.student_id
            JOIN sport_groups sg ON sg.id = se.group_id
            JOIN sports s ON s.id = sg.sport_id
            JOIN teachers t ON t.id = sg.teacher_id
            ORDER BY s.name, st.full_name`,
      stringify: (row) => ({
        student_name: String(row.student_name ?? ""),
        sport: String(row.sport ?? ""),
        level: String(row.level ?? ""),
        weekday: String(row.weekday ?? ""),
        schedule: String(row.schedule ?? "").replace(/:\d\d(?=-\d\d:\d\d)/g, ""),
        teacher: String(row.teacher ?? ""),
      }),
    },
    transport: {
      sql: `SELECT st.full_name AS student_name, tr.name AS route, te.created_at
            FROM transport_enrollments te
            JOIN students st ON st.id = te.student_id
            JOIN transport_routes tr ON tr.id = te.route_id
            ORDER BY tr.name, st.full_name`,
      stringify: (row) => ({
        student_name: String(row.student_name ?? ""),
        route: String(row.route ?? ""),
        enrolled_at: String(row.created_at ?? ""),
      }),
    },
    cafeteria: {
      sql: `SELECT st.full_name AS student_name,
                   CASE WHEN ce.active THEN 'Inscripto' ELSE 'No inscripto' END AS status,
                   ce.created_at AS enrolled_at
            FROM cafeteria_enrollments ce
            JOIN students st ON st.id = ce.student_id
            ORDER BY st.full_name`,
      stringify: (row) => ({
        student_name: String(row.student_name ?? ""),
        status: String(row.status ?? ""),
        enrolled_at: String(row.enrolled_at ?? ""),
      }),
    },
  };

  const spec = queries[entity];
  const result = await pool.query<Row>(spec.sql);
  return result.rows.map(spec.stringify);
}

function normalizeReportError(error: unknown): Error {
  if (isAppError(error)) return error;
  return error instanceof Error ? error : new Error("No se pudo completar la operación");
}