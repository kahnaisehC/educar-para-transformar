import type { DatabasePool, Queryable } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import { withAuditProxy } from "./auditProxy.js";
import { safeNotify } from "./notifications.service.js";
import type { UserRole } from "./auth.js";

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
    `SELECT st.id, st.full_name, st.record_number,
            COALESCE(l.name, 'Pendiente') AS level,
            COALESCE(c.name, 'Pendiente') AS course,
            st.status
     FROM parent_students ps
     JOIN students st ON st.id = ps.student_id
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     WHERE ps.parent_id = $1
     ORDER BY st.full_name`,
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

export async function assertChildAssociation(
  pool: Queryable,
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
    `SELECT st.id, st.record_number, st.dni, st.full_name,
            COALESCE(l.name, 'Pendiente') AS level,
            COALESCE(c.name, 'Pendiente') AS course,
            st.status
     FROM students st
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     WHERE st.id = $1`,
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

export interface ChildEnrollmentView {
  studentId: number;
  schoolYear: { id: number; year: number } | null;
  matricula: {
    id: number;
    courseId: number;
    level: string;
    course: string;
    status: "enrolled" | "cancelled";
    createdAt: string;
  } | null;
  courses: Array<{ id: number; level: string; name: string }>;
  subjects: Array<{
    subject: string;
    teacher: string;
    weekdayName: string;
    startTime: string;
    endTime: string;
  }>;
}

export async function getChildEnrollment(
  pool: DatabasePool,
  userId: number,
  studentId: number,
): Promise<ChildEnrollmentView> {
  await assertChildAssociation(pool, userId, studentId);

  const [yearResult, matriculaResult, coursesResult, studentResult] = await Promise.all([
    pool.query<{ id: number; year: number }>(
      "SELECT id, year FROM school_years WHERE active = TRUE ORDER BY year DESC LIMIT 1",
    ),
    pool.query<{
      id: number;
      course_id: number;
      level: string;
      course: string;
      status: "enrolled" | "cancelled";
      created_at: string;
    }>(
      `SELECT sye.id, sye.course_id, l.name AS level, c.name AS course, sye.status, sye.created_at
       FROM school_year_enrollments sye
       JOIN courses c ON c.id = sye.course_id
       JOIN levels l ON l.id = c.level_id
       JOIN school_years sy ON sy.id = sye.school_year_id
       WHERE sye.student_id = $1 AND sy.active = TRUE
       ORDER BY sye.created_at DESC
       LIMIT 1`,
      [studentId],
    ),
    pool.query<{ id: number; level: string; name: string }>(
      `SELECT c.id, l.name AS level, c.name
       FROM courses c
       JOIN levels l ON l.id = c.level_id
       ORDER BY l.name, c.name`,
    ),
    pool.query<{ course_id: number | null }>(
      "SELECT course_id FROM students WHERE id = $1",
      [studentId],
    ),
  ]);

  const matricula = matriculaResult.rows[0]
    ? {
        id: matriculaResult.rows[0].id,
        courseId: matriculaResult.rows[0].course_id,
        level: matriculaResult.rows[0].level,
        course: matriculaResult.rows[0].course,
        status: matriculaResult.rows[0].status,
        createdAt: matriculaResult.rows[0].created_at,
      }
    : null;

  const subjectsCourseId = matricula?.courseId ?? studentResult.rows[0]?.course_id ?? null;
  const subjects = subjectsCourseId
    ? await pool.query<{
        subject: string;
        teacher: string;
        weekday_name: string;
        start_time: string;
        end_time: string;
      }>(
        `SELECT sub.name AS subject, t.full_name AS teacher,
                CASE cs.weekday
                  WHEN 1 THEN 'Lunes'
                  WHEN 2 THEN 'Martes'
                  WHEN 3 THEN 'Miercoles'
                  WHEN 4 THEN 'Jueves'
                  WHEN 5 THEN 'Viernes'
                  WHEN 6 THEN 'Sabado'
                  ELSE 'Domingo'
                END AS weekday_name,
                cs.start_time, cs.end_time
         FROM course_subjects cs
         JOIN subjects sub ON sub.id = cs.subject_id
         JOIN teachers t ON t.id = cs.teacher_id
         WHERE cs.course_id = $1 AND cs.active = TRUE
         ORDER BY sub.name, cs.weekday, cs.start_time`,
        [subjectsCourseId],
      )
    : { rows: [] };

  return {
    studentId,
    schoolYear: yearResult.rows[0] ?? null,
    matricula,
    courses: coursesResult.rows,
    subjects: subjects.rows.map((row) => ({
      subject: row.subject,
      teacher: row.teacher,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
    })),
  };
}

export async function enrollChild(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  studentId: number,
  courseId: number,
): Promise<ChildEnrollmentView> {
  try {
    const view = await enrollChildWithAudit(pool, actorUserId, actorRole, studentId, courseId);
    await safeNotify(pool, actorUserId, {
      type: "matricula_confirmed",
      title: "Matrícula registrada",
      body: `${view.matricula?.level ?? ""} · ${view.matricula?.course ?? ""} · año lectivo ${view.schoolYear?.year ?? ""}`.trim(),
      metadata: { studentId, courseId },
    });
    return view;
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      await safeNotify(pool, actorUserId, {
        type: "matricula_rejected",
        title: "Matrícula rechazada",
        body: error.message,
        metadata: { studentId, courseId, code: error.code },
      });
    }
    throw error;
  }
}

function enrollChildWithAudit(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  studentId: number,
  courseId: number,
): Promise<ChildEnrollmentView> {
  return withAuditProxy(pool, {
    operation: "enroll_child",
    actorUserId,
    actorRole,
    allowedRoles: ["parent"],
    normalizeError: (error) => (isAppError(error) ? error : new Error("No se pudo registrar la matrícula")),
    onSuccess: (view) => ({
      studentId,
      courseId,
      year: view.schoolYear?.year,
      status: view.matricula?.status,
    }),
    onError: (error) => ({
      studentId,
      courseId,
      code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      reason: error instanceof Error ? error.message : "Unknown error",
    }),
    handler: () =>
      withTransaction(pool, async (client) => {
        const association = await client.query(
          `SELECT 1
           FROM parent_students ps
           JOIN parents p ON p.id = ps.parent_id
           WHERE p.user_id = $1 AND ps.student_id = $2`,
          [actorUserId, studentId],
        );
        if (!association.rowCount) {
          throw new AppError(403, "El alumno no está asociado a su cuenta", "CHILD_NOT_ASSOCIATED");
        }

        const student = await client.query(
          "SELECT id FROM students WHERE id = $1 AND status = 'active'",
          [studentId],
        );
        if (!student.rowCount) {
          throw new AppError(404, "El alumno no existe o no está activo", "STUDENT_NOT_FOUND");
        }

        const course = await client.query(
          "SELECT 1 FROM courses WHERE id = $1",
          [courseId],
        );
        if (!course.rowCount) {
          throw new AppError(404, "El curso indicado no existe", "COURSE_NOT_FOUND");
        }

        const year = await client.query<{ id: number }>(
          "SELECT id FROM school_years WHERE active = TRUE ORDER BY year DESC LIMIT 1",
        );
        if (!year.rows[0]) {
          throw new AppError(
            409,
            "La institución todavía no habilitó el año lectivo",
            "SCHOOL_YEAR_NOT_ACTIVE",
          );
        }

        const existing = await client.query<{ id: number; status: string }>(
          "SELECT id, status FROM school_year_enrollments WHERE student_id = $1 AND school_year_id = $2",
          [studentId, year.rows[0].id],
        );
        if (existing.rows[0]?.status === "enrolled") {
          throw new AppError(409, "El alumno ya está matriculado en este año lectivo", "ALREADY_ENROLLED");
        }
        if (existing.rows[0]) {
          await client.query(
            `UPDATE school_year_enrollments
             SET course_id = $1, status = 'enrolled', created_by = $2, created_at = NOW()
             WHERE id = $3`,
            [courseId, actorUserId, existing.rows[0].id],
          );
        } else {
          await client.query(
            `INSERT INTO school_year_enrollments (student_id, school_year_id, course_id, status, created_by)
             VALUES ($1, $2, $3, 'enrolled', $4)`,
            [studentId, year.rows[0].id, courseId, actorUserId],
          );
        }

        await client.query("UPDATE students SET course_id = $1 WHERE id = $2", [courseId, studentId]);

        await client.query(
          `INSERT INTO student_subjects (student_id, subject_id, teacher_id)
           SELECT $1::int, cs.subject_id, cs.teacher_id
           FROM course_subjects cs
           WHERE cs.course_id = $2::int AND cs.active = TRUE
           ON CONFLICT (student_id, subject_id) DO NOTHING`,
          [studentId, courseId],
        );

        return getChildEnrollment(client as unknown as DatabasePool, actorUserId, studentId);
      }),
  });
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}
