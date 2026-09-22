import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import { AppError, isAppError } from "./errors.js";
import { getStudentDashboard, type StudentDashboard } from "./enrollment.service.js";

export interface ContactInput {
  email: string;
  phone: string;
}

export interface StudentReport {
  generatedAt: string;
  profile: StudentDashboard["student"];
  subjects: Array<{ subject: string; teacher: string }>;
  sports: StudentDashboard["enrollments"];
  transport: StudentDashboard["transportEnrollment"];
  cafeteria: StudentDashboard["cafeteriaEnrollment"];
}

export async function updateStudentContact(
  pool: DatabasePool,
  actorUserId: number,
  input: ContactInput,
): Promise<ContactInput> {
  try {
    return await withTransaction(pool, async (client) => {
      const result = await client.query<{ id: number }>(
        "SELECT id FROM students WHERE user_id = $1 AND status = 'active' FOR UPDATE",
        [actorUserId],
      );
      if (!result.rows[0]) {
        throw new AppError(404, "No existe un perfil de alumno activo", "STUDENT_NOT_FOUND");
      }
      await client.query(
        "UPDATE students SET email = $1, phone = $2 WHERE id = $3",
        [input.email, input.phone, result.rows[0].id],
      );
      await writeAudit(client, actorUserId, "update_student_contact", "success", {
        email: input.email,
        phone: input.phone,
      });
      return input;
    });
  } catch (error) {
    const normalized = isAppError(error) ? error : new Error("No se pudieron actualizar los datos de contacto");
    await tryWriteAudit(pool, actorUserId, "update_student_contact", "rejected", {
      reason: normalized.message,
    });
    throw normalized;
  }
}

export async function enrollTransport(
  pool: DatabasePool,
  actorUserId: number,
  routeId: number,
): Promise<{ id: number; name: string; description: string; enrolledAt: string }> {
  try {
    return await withTransaction(pool, async (client) => {
      const student = await client.query<{ id: number }>(
        "SELECT id FROM students WHERE user_id = $1 AND status = 'active' FOR UPDATE",
        [actorUserId],
      );
      if (!student.rows[0]) {
        throw new AppError(404, "No existe un perfil de alumno activo", "STUDENT_NOT_FOUND");
      }
      const route = await client.query<{ id: number; name: string; description: string }>(
        "SELECT id, name, description FROM transport_routes WHERE id = $1 AND active = TRUE",
        [routeId],
      );
      if (!route.rows[0]) {
        throw new AppError(404, "El recorrido no existe o no está disponible", "ROUTE_NOT_FOUND");
      }
      const current = await client.query(
        "SELECT 1 FROM transport_enrollments WHERE student_id = $1",
        [student.rows[0].id],
      );
      if (current.rowCount) {
        throw new AppError(409, "El alumno ya tiene un recorrido de transporte", "TRANSPORT_ALREADY_ENROLLED");
      }
      const inserted = await client.query<{ enrolled_at: string }>(
        `INSERT INTO transport_enrollments (student_id, route_id)
         VALUES ($1, $2)
         RETURNING created_at AS enrolled_at`,
        [student.rows[0].id, routeId],
      );
      await writeAudit(client, actorUserId, "enroll_transport", "success", { routeId });
      return { ...route.rows[0], enrolledAt: inserted.rows[0].enrolled_at };
    });
  } catch (error) {
    const normalized = normalizeServiceError(error, "No se pudo registrar el recorrido");
    await tryWriteAudit(pool, actorUserId, "enroll_transport", "rejected", { routeId, reason: normalized.message });
    throw normalized;
  }
}

export async function cancelTransport(pool: DatabasePool, actorUserId: number): Promise<void> {
  try {
    await withTransaction(pool, async (client) => {
      const result = await client.query(
        `DELETE FROM transport_enrollments
         WHERE student_id = (SELECT id FROM students WHERE user_id = $1)`,
        [actorUserId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "El alumno no tiene un recorrido activo", "TRANSPORT_NOT_ENROLLED");
      }
      await writeAudit(client, actorUserId, "cancel_transport", "success", {});
    });
  } catch (error) {
    const normalized = normalizeServiceError(error, "No se pudo cancelar el recorrido");
    await tryWriteAudit(pool, actorUserId, "cancel_transport", "rejected", { reason: normalized.message });
    throw normalized;
  }
}

export async function enrollCafeteria(pool: DatabasePool, actorUserId: number): Promise<void> {
  try {
    await withTransaction(pool, async (client) => {
      const student = await client.query<{ id: number }>(
        "SELECT id FROM students WHERE user_id = $1 AND status = 'active' FOR UPDATE",
        [actorUserId],
      );
      if (!student.rows[0]) {
        throw new AppError(404, "No existe un perfil de alumno activo", "STUDENT_NOT_FOUND");
      }
      const result = await client.query(
        `INSERT INTO cafeteria_enrollments (student_id, active)
         VALUES ($1, TRUE)
         ON CONFLICT (student_id) DO UPDATE SET active = TRUE
         WHERE cafeteria_enrollments.active = FALSE`,
        [student.rows[0].id],
      );
      if (!result.rowCount) {
        throw new AppError(409, "El alumno ya está inscripto al comedor", "CAFETERIA_ALREADY_ENROLLED");
      }
      await writeAudit(client, actorUserId, "enroll_cafeteria", "success", {});
    });
  } catch (error) {
    const normalized = normalizeServiceError(error, "No se pudo registrar el comedor");
    await tryWriteAudit(pool, actorUserId, "enroll_cafeteria", "rejected", { reason: normalized.message });
    throw normalized;
  }
}

export async function cancelCafeteria(pool: DatabasePool, actorUserId: number): Promise<void> {
  try {
    await withTransaction(pool, async (client) => {
      const result = await client.query(
        `UPDATE cafeteria_enrollments
         SET active = FALSE
         WHERE student_id = (SELECT id FROM students WHERE user_id = $1)
           AND active = TRUE`,
        [actorUserId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "El alumno no tiene una inscripción activa al comedor", "CAFETERIA_NOT_ENROLLED");
      }
      await writeAudit(client, actorUserId, "cancel_cafeteria", "success", {});
    });
  } catch (error) {
    const normalized = normalizeServiceError(error, "No se pudo cancelar el comedor");
    await tryWriteAudit(pool, actorUserId, "cancel_cafeteria", "rejected", { reason: normalized.message });
    throw normalized;
  }
}

export async function getStudentReport(pool: DatabasePool, userId: number): Promise<StudentReport> {
  const dashboard = await getStudentDashboard(pool, userId);
  const subjects = await pool.query<{ subject: string; teacher: string }>(
    `SELECT sub.name AS subject, t.full_name AS teacher
     FROM student_subjects ss
     JOIN subjects sub ON sub.id = ss.subject_id
     JOIN teachers t ON t.id = ss.teacher_id
     WHERE ss.student_id = $1
     ORDER BY sub.name`,
    [dashboard.student.id],
  );
  return {
    generatedAt: new Date().toISOString(),
    profile: dashboard.student,
    subjects: subjects.rows,
    sports: dashboard.enrollments,
    transport: dashboard.transportEnrollment,
    cafeteria: dashboard.cafeteriaEnrollment,
  };
}

function normalizeServiceError(error: unknown, fallback: string): Error {
  if (isAppError(error)) return error;
  return error instanceof Error ? error : new Error(fallback);
}
