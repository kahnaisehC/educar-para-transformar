import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import type { PoolClient } from "pg";

interface StudentRow {
  id: number;
  record_number: string;
  dni: string;
  full_name: string;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  level: string;
  course: string;
  status: "active" | "inactive";
}

interface GroupRow {
  group_id: number;
  sport_id: number;
  sport_name: string;
  level: string;
  weekday: number;
  weekday_name: string;
  start_time: string;
  end_time: string;
  teacher_name: string;
}

export interface StudentDashboard {
  student: StudentRow;
  subjects: Array<{ subject: string; teacher: string }>;
  catalog: SportGroupView[];
  enrollments: EnrollmentView[];
  transportRoutes: TransportRouteView[];
  transportEnrollment: TransportEnrollmentView | null;
  cafeteriaEnrollment: CafeteriaEnrollmentView | null;
}

export interface TransportRouteView {
  id: number;
  name: string;
  description: string;
}

export interface TransportEnrollmentView extends TransportRouteView {
  enrolledAt: string;
}

export interface CafeteriaEnrollmentView {
  active: boolean;
  enrolledAt: string;
}

export interface SportGroupView {
  groupId: number;
  sportId: number;
  sport: string;
  level: string;
  weekday: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  teacher: string;
}

export interface EnrollmentView extends SportGroupView {
  enrolledAt?: string;
}

const GROUP_SELECT = `
  SELECT
    sg.id AS group_id,
    s.id AS sport_id,
    s.name AS sport_name,
    sg.level,
    sg.weekday,
    CASE sg.weekday
      WHEN 1 THEN 'Lunes'
      WHEN 2 THEN 'Martes'
      WHEN 3 THEN 'Miercoles'
      WHEN 4 THEN 'Jueves'
      WHEN 5 THEN 'Viernes'
      WHEN 6 THEN 'Sabado'
      ELSE 'Domingo'
    END AS weekday_name,
    sg.start_time,
    sg.end_time,
    t.full_name AS teacher_name
  FROM sport_groups sg
  JOIN sports s ON s.id = sg.sport_id
  JOIN teachers t ON t.id = sg.teacher_id
`;

function mapGroup(row: GroupRow & { enrolled_at?: string }): SportGroupView & { enrolledAt?: string } {
  return {
    groupId: row.group_id,
    sportId: row.sport_id,
    sport: row.sport_name,
    level: row.level,
    weekday: row.weekday,
    weekdayName: row.weekday_name,
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    teacher: row.teacher_name,
    ...(row.enrolled_at ? { enrolledAt: row.enrolled_at } : {}),
  };
}

async function findStudent(pool: DatabasePool, userId: number): Promise<StudentRow> {
  const result = await pool.query<StudentRow>(
    `SELECT id, record_number, dni, full_name, birth_date, address, phone, email,
             level, course, status
     FROM students
     WHERE user_id = $1`,
    [userId],
  );
  const student = result.rows[0];
  if (!student) {
    throw new AppError(404, "No existe un alumno asociado a este usuario", "STUDENT_NOT_FOUND");
  }
  return student;
}

export async function getStudentDashboard(
  pool: DatabasePool,
  userId: number,
): Promise<StudentDashboard> {
  const student = await findStudent(pool, userId);
  const [subjectsResult, catalogResult, enrollmentResult, routeResult, transportResult, cafeteriaResult] = await Promise.all([
    pool.query<{ subject: string; teacher: string }>(
      `SELECT sub.name AS subject, t.full_name AS teacher
       FROM student_subjects ss
       JOIN subjects sub ON sub.id = ss.subject_id
       JOIN teachers t ON t.id = ss.teacher_id
       WHERE ss.student_id = $1
       ORDER BY sub.name`,
      [student.id],
    ),
    pool.query<GroupRow>(`${GROUP_SELECT} WHERE sg.active = TRUE ORDER BY sg.weekday, sg.start_time, s.name`),
    pool.query<GroupRow & { enrolled_at: string }>(
      `${GROUP_SELECT}
       JOIN sport_enrollments se ON se.group_id = sg.id
       WHERE se.student_id = $1
       ORDER BY sg.weekday, sg.start_time, s.name`,
       [student.id],
     ),
    pool.query<TransportRouteView>(
      `SELECT id, name, description
       FROM transport_routes
       WHERE active = TRUE
       ORDER BY id`,
    ),
    pool.query<TransportRouteView & { enrolled_at: string }>(
      `SELECT tr.id, tr.name, tr.description, te.created_at AS enrolled_at
       FROM transport_enrollments te
       JOIN transport_routes tr ON tr.id = te.route_id
       WHERE te.student_id = $1`,
      [student.id],
    ),
    pool.query<{ active: boolean; enrolled_at: string }>(
      `SELECT active, created_at AS enrolled_at
       FROM cafeteria_enrollments
       WHERE student_id = $1 AND active = TRUE`,
      [student.id],
    ),
  ]);

  return {
    student,
    subjects: subjectsResult.rows,
    catalog: catalogResult.rows.map(mapGroup),
    enrollments: enrollmentResult.rows.map(mapGroup),
    transportRoutes: routeResult.rows,
    transportEnrollment: transportResult.rows[0]
      ? {
          id: transportResult.rows[0].id,
          name: transportResult.rows[0].name,
          description: transportResult.rows[0].description,
          enrolledAt: transportResult.rows[0].enrolled_at,
        }
      : null,
    cafeteriaEnrollment: cafeteriaResult.rows[0]
      ? {
          active: cafeteriaResult.rows[0].active,
          enrolledAt: cafeteriaResult.rows[0].enrolled_at,
        }
      : null,
  };
}

async function groupForEnrollment(client: PoolClient, groupId: number) {
  const result = await client.query<GroupRow>(
    `${GROUP_SELECT}
     WHERE sg.id = $1 AND sg.active = TRUE`,
    [groupId],
  );
  const group = result.rows[0];
  if (!group) {
    throw new AppError(404, "El grupo deportivo no existe o no está disponible", "GROUP_NOT_FOUND");
  }
  return group;
}

export async function enrollStudent(
  pool: DatabasePool,
  actorUserId: number,
  studentId: number,
  groupId: number,
): Promise<SportGroupView> {
  try {
    return await withTransaction(pool, async (client) => {
      // Lock the student so concurrent requests cannot both pass the two-sport check.
      const student = await client.query<{ id: number }>(
        "SELECT id FROM students WHERE id = $1 AND status = 'active' FOR UPDATE",
        [studentId],
      );
      if (!student.rows[0]) {
        throw new AppError(404, "El alumno no existe o no está activo", "STUDENT_NOT_FOUND");
      }

      const group = await groupForEnrollment(client, groupId);
      const duplicate = await client.query(
        `SELECT 1 FROM sport_enrollments WHERE student_id = $1 AND group_id = $2`,
        [studentId, groupId],
      );
      if (duplicate.rowCount) {
        throw new AppError(409, "El alumno ya está inscripto en este grupo", "DUPLICATE_ENROLLMENT");
      }

      const sameSport = await client.query(
        `SELECT 1
         FROM sport_enrollments se
         JOIN sport_groups existing ON existing.id = se.group_id
         WHERE se.student_id = $1 AND existing.sport_id = $2`,
        [studentId, group.sport_id],
      );
      if (sameSport.rowCount) {
        throw new AppError(409, "El alumno ya está inscripto en este deporte", "DUPLICATE_SPORT");
      }

      const count = await client.query<{ total: string }>(
        `SELECT COUNT(DISTINCT sg.sport_id)::TEXT AS total
         FROM sport_enrollments se
         JOIN sport_groups sg ON sg.id = se.group_id
         WHERE se.student_id = $1`,
        [studentId],
      );
      if (Number(count.rows[0]?.total ?? 0) >= 2) {
        throw new AppError(409, "El límite máximo de dos deportes ya fue alcanzado", "SPORT_LIMIT_REACHED");
      }

      const conflict = await client.query(
        `SELECT 1
         FROM sport_enrollments se
         JOIN sport_groups existing ON existing.id = se.group_id
         WHERE se.student_id = $1
           AND existing.weekday = $2
           AND existing.start_time < $4
           AND $3 < existing.end_time`,
        [studentId, group.weekday, group.start_time, group.end_time],
      );
      if (conflict.rowCount) {
        throw new AppError(409, "El horario se superpone con otro deporte inscripto", "SCHEDULE_CONFLICT");
      }

      await client.query(
        "INSERT INTO sport_enrollments (student_id, group_id) VALUES ($1, $2)",
        [studentId, groupId],
      );
      await writeAudit(client, actorUserId, "enroll_sport", "success", {
        studentId,
        groupId,
        sport: group.sport_name,
        weekday: group.weekday_name,
        startTime: group.start_time,
        endTime: group.end_time,
      });

      return mapGroup(group);
    });
  } catch (error) {
    const normalizedError = normalizeEnrollmentError(error);
    await tryWriteAudit(pool, actorUserId, "enroll_sport", "rejected", {
      studentId,
      groupId,
      code: normalizedError instanceof AppError ? normalizedError.code : "INTERNAL_ERROR",
      reason: normalizedError instanceof Error ? normalizedError.message : "Unknown error",
    });
    throw normalizedError;
  }
}

export async function cancelEnrollment(
  pool: DatabasePool,
  actorUserId: number,
  studentId: number,
  groupId: number,
): Promise<void> {
  try {
    await withTransaction(pool, async (client) => {
      await client.query("SELECT id FROM students WHERE id = $1 FOR UPDATE", [studentId]);
      const result = await client.query<{ sport_name: string }>(
        `SELECT s.name AS sport_name
         FROM sport_enrollments se
         JOIN sport_groups sg ON sg.id = se.group_id
         JOIN sports s ON s.id = sg.sport_id
         WHERE se.student_id = $1 AND se.group_id = $2`,
        [studentId, groupId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "La inscripción no existe", "ENROLLMENT_NOT_FOUND");
      }

      await client.query(
        "DELETE FROM sport_enrollments WHERE student_id = $1 AND group_id = $2",
        [studentId, groupId],
      );
      await writeAudit(client, actorUserId, "cancel_sport", "success", {
        studentId,
        groupId,
        sport: result.rows[0].sport_name,
      });
    });
  } catch (error) {
    const normalizedError = normalizeEnrollmentError(error);
    await tryWriteAudit(pool, actorUserId, "cancel_sport", "rejected", {
      studentId,
      groupId,
      code: normalizedError instanceof AppError ? normalizedError.code : "INTERNAL_ERROR",
      reason: normalizedError instanceof Error ? normalizedError.message : "Unknown error",
    });
    throw normalizedError;
  }
}

function normalizeEnrollmentError(error: unknown): Error {
  if (isAppError(error)) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return new AppError(409, "La inscripción ya existe", "DUPLICATE_ENROLLMENT");
  }
  return error instanceof Error ? error : new Error("No se pudo procesar la inscripción");
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}
