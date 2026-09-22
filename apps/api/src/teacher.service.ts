import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import { AppError, isAppError } from "./errors.js";
import type { ContactInput } from "./student.service.js";

export interface TeacherCourseView {
  subjectId: number;
  subject: string;
  level: string;
  course: string;
}

export interface CourseStudentView {
  recordNumber: string;
  dni: string;
  fullName: string;
  level: string;
  course: string;
  subject: string;
  teacher: string;
}

async function findTeacherId(pool: DatabasePool, userId: number): Promise<number> {
  const result = await pool.query<{ id: number }>(
    "SELECT id FROM teachers WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  const teacher = result.rows[0];
  if (!teacher) {
    throw new AppError(404, "No existe un perfil docente activo", "TEACHER_NOT_FOUND");
  }
  return teacher.id;
}

export async function listTeacherCourses(
  pool: DatabasePool,
  userId: number,
): Promise<TeacherCourseView[]> {
  const teacherId = await findTeacherId(pool, userId);
  const result = await pool.query<{
    subject_id: number;
    subject: string;
    level: string;
    course: string;
  }>(
    `SELECT DISTINCT sub.id AS subject_id, sub.name AS subject, st.level, st.course
     FROM student_subjects ss
     JOIN subjects sub ON sub.id = ss.subject_id
     JOIN students st ON st.id = ss.student_id
     WHERE ss.teacher_id = $1
     ORDER BY sub.name, st.level, st.course`,
    [teacherId],
  );
  return result.rows.map((row) => ({
    subjectId: row.subject_id,
    subject: row.subject,
    level: row.level,
    course: row.course,
  }));
}

export async function listCourseStudents(
  pool: DatabasePool,
  userId: number,
  subjectId: number,
  level: string,
  course: string,
): Promise<CourseStudentView[]> {
  const teacherId = await findTeacherId(pool, userId);
  const result = await pool.query<{
    record_number: string;
    dni: string;
    full_name: string;
    level: string;
    course: string;
    subject: string;
    teacher: string;
  }>(
    `SELECT st.record_number, st.dni, st.full_name, st.level, st.course,
            sub.name AS subject, t.full_name AS teacher
     FROM student_subjects ss
     JOIN students st ON st.id = ss.student_id
     JOIN subjects sub ON sub.id = ss.subject_id
     JOIN teachers t ON t.id = ss.teacher_id
     WHERE ss.teacher_id = $1 AND ss.subject_id = $2
       AND st.level = $3 AND st.course = $4
     ORDER BY st.full_name`,
    [teacherId, subjectId, level, course],
  );
  return result.rows.map((row) => ({
    recordNumber: row.record_number,
    dni: row.dni,
    fullName: row.full_name,
    level: row.level,
    course: row.course,
    subject: row.subject,
    teacher: row.teacher,
  }));
}

export async function updateTeacherContact(
  pool: DatabasePool,
  actorUserId: number,
  input: ContactInput,
): Promise<ContactInput> {
  try {
    return await withTransaction(pool, async (client) => {
      const result = await client.query<{ id: number }>(
        "SELECT id FROM teachers WHERE user_id = $1 AND status = 'active' FOR UPDATE",
        [actorUserId],
      );
      if (!result.rows[0]) {
        throw new AppError(404, "No existe un perfil docente activo", "TEACHER_NOT_FOUND");
      }
      await client.query(
        "UPDATE teachers SET email = $1, phone = $2 WHERE id = $3",
        [input.email, input.phone, result.rows[0].id],
      );
      await writeAudit(client, actorUserId, "update_teacher_contact", "success", {
        email: input.email,
        phone: input.phone,
      });
      return input;
    });
  } catch (error) {
    const normalized = isAppError(error) ? error : new Error("No se pudieron actualizar los datos de contacto");
    await tryWriteAudit(pool, actorUserId, "update_teacher_contact", "rejected", { reason: normalized.message });
    throw normalized;
  }
}
