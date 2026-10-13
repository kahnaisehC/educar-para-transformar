import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError } from "./errors.js";
import { withAuditProxy } from "./auditProxy.js";
import type { UserRole } from "./auth.js";
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
  actorRole: UserRole,
  input: ContactInput,
): Promise<ContactInput> {
  return withAuditProxy(pool, {
    operation: "update_student_contact",
    actorUserId,
    actorRole,
    allowedRoles: ["student"],
    fallbackMessage: "No se pudieron actualizar los datos de contacto",
    onSuccess: () => ({ email: input.email, phone: input.phone }),
    handler: () =>
      withTransaction(pool, async (client) => {
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
        return input;
      }),
  });
}

export async function enrollTransport(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  routeId: number,
): Promise<{ id: number; name: string; description: string; enrolledAt: string }> {
  return withAuditProxy(pool, {
    operation: "enroll_transport",
    actorUserId,
    actorRole,
    allowedRoles: ["student"],
    fallbackMessage: "No se pudo registrar el recorrido",
    onSuccess: () => ({ routeId }),
    onError: (error) => ({ routeId, reason: getErrorMessage(error) }),
    handler: () =>
      withTransaction(pool, async (client) => {
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
        return { ...route.rows[0], enrolledAt: inserted.rows[0].enrolled_at };
      }),
  });
}

export async function cancelTransport(pool: DatabasePool, actorUserId: number, actorRole: UserRole): Promise<void> {
  return withAuditProxy(pool, {
    operation: "cancel_transport",
    actorUserId,
    actorRole,
    allowedRoles: ["student"],
    fallbackMessage: "No se pudo cancelar el recorrido",
    handler: () =>
      withTransaction(pool, async (client) => {
        const result = await client.query(
          `DELETE FROM transport_enrollments
           WHERE student_id = (SELECT id FROM students WHERE user_id = $1)`,
          [actorUserId],
        );
        if (!result.rowCount) {
          throw new AppError(404, "El alumno no tiene un recorrido activo", "TRANSPORT_NOT_ENROLLED");
        }
      }),
  });
}

export async function enrollCafeteria(pool: DatabasePool, actorUserId: number, actorRole: UserRole): Promise<void> {
  return withAuditProxy(pool, {
    operation: "enroll_cafeteria",
    actorUserId,
    actorRole,
    allowedRoles: ["student"],
    fallbackMessage: "No se pudo registrar el comedor",
    handler: () =>
      withTransaction(pool, async (client) => {
        const student = await client.query<{ id: number }>(
          "SELECT id FROM students WHERE user_id = $1 AND status = 'active' FOR UPDATE",
          [actorUserId],
        );
        if (!student.rows[0]) {
          throw new AppError(404, "No existe un perfil de alumno activo", "STUDENT_NOT_FOUND");
        }
        const studentId = student.rows[0].id;
        const existing = await client.query<{ active: boolean }>(
          "SELECT active FROM cafeteria_enrollments WHERE student_id = $1 FOR UPDATE",
          [studentId],
        );
        if (existing.rows[0]?.active) {
          throw new AppError(409, "El alumno ya está inscripto al comedor", "CAFETERIA_ALREADY_ENROLLED");
        }
        if (existing.rows[0]) {
          await client.query(
            "UPDATE cafeteria_enrollments SET active = TRUE WHERE student_id = $1",
            [studentId],
          );
        } else {
          await client.query(
            "INSERT INTO cafeteria_enrollments (student_id, active) VALUES ($1, TRUE)",
            [studentId],
          );
        }
      }),
  });
}

export async function cancelCafeteria(pool: DatabasePool, actorUserId: number, actorRole: UserRole): Promise<void> {
  return withAuditProxy(pool, {
    operation: "cancel_cafeteria",
    actorUserId,
    actorRole,
    allowedRoles: ["student"],
    fallbackMessage: "No se pudo cancelar el comedor",
    handler: () =>
      withTransaction(pool, async (client) => {
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
      }),
  });
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación";
}
