import type { DatabasePool } from "./db.js";
import { AppError } from "./errors.js";

export interface ChildListItem {
  id: number;
  fullName: string;
  recordNumber: string;
  level: string;
  course: string;
  status: string;
}

export interface ChildSummary {
  id: number;
  recordNumber: string;
  dni: string;
  fullName: string;
  level: string;
  course: string;
  status: string;
  subjects: Array<{ subject: string; teacher: string }>;
  sports: Array<{
    sport: string;
    weekdayName: string;
    startTime: string;
    endTime: string;
    teacher: string;
  }>;
}

async function findParentId(pool: DatabasePool, userId: number): Promise<number> {
  const result = await pool.query<{ id: number }>(
    "SELECT id FROM parents WHERE user_id = $1",
    [userId],
  );
  const parent = result.rows[0];
  if (!parent) {
    throw new AppError(404, "No existe un perfil de padre asociado", "PARENT_NOT_FOUND");
  }
  return parent.id;
}

export async function listChildren(pool: DatabasePool, userId: number): Promise<ChildListItem[]> {
  const parentId = await findParentId(pool, userId);
  const result = await pool.query<{
    id: number;
    full_name: string;
    record_number: string;
    level: string;
    course: string;
    status: string;
  }>(
    `SELECT s.id, s.full_name, s.record_number, s.level, s.course, s.status
     FROM parent_students ps
     JOIN students s ON s.id = ps.student_id
     WHERE ps.parent_id = $1
     ORDER BY s.full_name`,
    [parentId],
  );

  return result.rows.map((child) => ({
    id: child.id,
    fullName: child.full_name,
    recordNumber: child.record_number,
    level: child.level,
    course: child.course,
    status: child.status,
  }));
}

async function assertChildAssociation(
  pool: DatabasePool,
  userId: number,
  studentId: number,
): Promise<void> {
  const result = await pool.query(
    `SELECT 1
     FROM parent_students ps
     JOIN parents p ON p.id = ps.parent_id
     WHERE p.user_id = $1 AND ps.student_id = $2`,
    [userId, studentId],
  );
  if (!result.rowCount) {
    throw new AppError(403, "El alumno no está asociado a su cuenta", "CHILD_NOT_ASSOCIATED");
  }
}

export async function getChildSummary(
  pool: DatabasePool,
  userId: number,
  studentId: number,
): Promise<ChildSummary> {
  // Check the relationship before loading any student data to avoid an ID-oracle across families.
  await assertChildAssociation(pool, userId, studentId);

  const studentResult = await pool.query<{
    id: number;
    record_number: string;
    dni: string;
    full_name: string;
    level: string;
    course: string;
    status: string;
  }>(
    `SELECT id, record_number, dni, full_name, level, course, status
     FROM students
     WHERE id = $1`,
    [studentId],
  );
  const student = studentResult.rows[0];
  if (!student) {
    throw new AppError(404, "El alumno no existe", "STUDENT_NOT_FOUND");
  }

  const [subjectsResult, sportsResult] = await Promise.all([
    pool.query<{ subject: string; teacher: string }>(
      `SELECT sub.name AS subject, t.full_name AS teacher
       FROM student_subjects ss
       JOIN subjects sub ON sub.id = ss.subject_id
       JOIN teachers t ON t.id = ss.teacher_id
       WHERE ss.student_id = $1
       ORDER BY sub.name`,
      [studentId],
    ),
    pool.query<{
      sport: string;
      weekday_name: string;
      start_time: string;
      end_time: string;
      teacher: string;
    }>(
      `SELECT sp.name AS sport,
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
              t.full_name AS teacher
       FROM sport_enrollments se
       JOIN sport_groups sg ON sg.id = se.group_id
       JOIN sports sp ON sp.id = sg.sport_id
       JOIN teachers t ON t.id = sg.teacher_id
       WHERE se.student_id = $1
       ORDER BY sg.weekday, sg.start_time`,
      [studentId],
    ),
  ]);

  return {
    id: student.id,
    recordNumber: student.record_number,
    dni: student.dni,
    fullName: student.full_name,
    level: student.level,
    course: student.course,
    status: student.status,
    subjects: subjectsResult.rows,
    sports: sportsResult.rows.map((sport) => ({
      sport: sport.sport,
      weekdayName: sport.weekday_name,
      startTime: formatTime(sport.start_time),
      endTime: formatTime(sport.end_time),
      teacher: sport.teacher,
    })),
  };
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}
