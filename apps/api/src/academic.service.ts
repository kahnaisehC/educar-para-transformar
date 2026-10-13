import type { PoolClient } from "pg";
import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import { withAuditProxy } from "./auditProxy.js";
import type { UserRole } from "./auth.js";

export interface LevelView {
  id: number;
  name: string;
}

export interface CourseView {
  id: number;
  levelId: number;
  level: string;
  name: string;
}

export interface SubjectView {
  id: number;
  name: string;
}

export interface TeacherProfileView {
  id: number;
  userId: number | null;
  username: string | null;
  recordNumber: string | null;
  dni: string | null;
  fullName: string;
  specialty: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive";
}

export interface StudentProfileView {
  id: number;
  userId: number;
  recordNumber: string;
  dni: string;
  fullName: string;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  courseId: number | null;
  level: string;
  course: string;
  status: "active" | "inactive";
}

export interface ParentProfileView {
  id: number;
  userId: number;
  username: string;
  fullName: string;
  children: Array<{ id: number; fullName: string }>;
}

export interface CourseSubjectView {
  id: number;
  courseId: number;
  course: string;
  level: string;
  subjectId: number;
  subject: string;
  teacherId: number;
  teacher: string;
  weekday: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface SchoolYearView {
  id: number;
  year: number;
  active: boolean;
  enrollmentCount: number;
}

export interface AcademicOverview {
  levels: LevelView[];
  courses: CourseView[];
  subjects: SubjectView[];
  teachers: TeacherProfileView[];
  students: StudentProfileView[];
  parents: ParentProfileView[];
  courseSubjects: CourseSubjectView[];
  schoolYears: SchoolYearView[];
}

interface Actor {
  userId: number;
  role: UserRole;
}

const WEEKDAY_SQL = `
  CASE weekday
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miercoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sabado'
    ELSE 'Domingo'
  END AS weekday_name
`;

function normalizeCatalogError(error: unknown): Error {
  if (isAppError(error)) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") {
      return new AppError(409, "Ya existe un registro con esos datos", "DUPLICATE_RECORD");
    }
    if (error.code === "23503") {
      return new AppError(409, "El registro está en uso y no se puede eliminar", "RECORD_IN_USE");
    }
  }
  return error instanceof Error ? error : new Error("No se pudo completar la operación");
}

function audited<T>(
  pool: DatabasePool,
  actor: Actor,
  operation: string,
  handler: () => Promise<T>,
  onSuccess: (result: T) => Record<string, unknown>,
): Promise<T> {
  return withAuditProxy(pool, {
    operation,
    actorUserId: actor.userId,
    actorRole: actor.role,
    allowedRoles: ["admin"],
    normalizeError: normalizeCatalogError,
    onSuccess,
    onError: (error) => ({ reason: error instanceof Error ? error.message : "Unknown error" }),
    handler,
  });
}

export async function getAcademicOverview(pool: DatabasePool): Promise<AcademicOverview> {
  const [levels, courses, subjects, teachers, students, parents, parentLinks, courseSubjects, schoolYears] =
    await Promise.all([
      pool.query<LevelView>("SELECT id, name FROM levels ORDER BY name"),
      pool.query<{ id: number; level_id: number; level: string; name: string }>(
        `SELECT c.id, c.level_id, l.name AS level, c.name
         FROM courses c
         JOIN levels l ON l.id = c.level_id
         ORDER BY l.name, c.name`,
      ),
      pool.query<SubjectView>("SELECT id, name FROM subjects ORDER BY name"),
      pool.query<{
        id: number;
        user_id: number | null;
        username: string | null;
        record_number: string | null;
        dni: string | null;
        full_name: string;
        specialty: string;
        email: string | null;
        phone: string | null;
        status: "active" | "inactive";
      }>(
        `SELECT t.id, t.user_id, u.username, t.record_number, t.dni, t.full_name,
                t.specialty, t.email, t.phone, t.status
         FROM teachers t
         LEFT JOIN users u ON u.id = t.user_id
         ORDER BY t.full_name`,
      ),
      pool.query<{
        id: number;
        user_id: number;
        record_number: string;
        dni: string;
        full_name: string;
        birth_date: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        course_id: number | null;
        level: string;
        course: string;
        status: "active" | "inactive";
      }>(
        `SELECT st.id, st.user_id, st.record_number, st.dni, st.full_name, st.birth_date,
                st.address, st.phone, st.email, st.course_id,
                COALESCE(l.name, 'Pendiente') AS level,
                COALESCE(c.name, 'Pendiente') AS course,
                st.status
         FROM students st
         LEFT JOIN courses c ON c.id = st.course_id
         LEFT JOIN levels l ON l.id = c.level_id
         ORDER BY st.full_name`,
      ),
      pool.query<{ id: number; user_id: number; username: string; full_name: string }>(
        `SELECT p.id, p.user_id, u.username, p.full_name
         FROM parents p
         JOIN users u ON u.id = p.user_id
         ORDER BY p.full_name`,
      ),
      pool.query<{ parent_id: number; id: number; full_name: string }>(
        `SELECT ps.parent_id, st.id, st.full_name
         FROM parent_students ps
         JOIN students st ON st.id = ps.student_id
         ORDER BY st.full_name`,
      ),
      pool.query<{
        id: number;
        course_id: number;
        course: string;
        level: string;
        subject_id: number;
        subject: string;
        teacher_id: number;
        teacher: string;
        weekday: number;
        weekday_name: string;
        start_time: string;
        end_time: string;
        active: boolean;
      }>(
        `SELECT cs.id, cs.course_id, c.name AS course, l.name AS level,
                cs.subject_id, sub.name AS subject, cs.teacher_id, t.full_name AS teacher,
                cs.weekday, ${WEEKDAY_SQL}, cs.start_time, cs.end_time, cs.active
         FROM course_subjects cs
         JOIN courses c ON c.id = cs.course_id
         JOIN levels l ON l.id = c.level_id
         JOIN subjects sub ON sub.id = cs.subject_id
         JOIN teachers t ON t.id = cs.teacher_id
         ORDER BY l.name, c.name, sub.name, cs.weekday, cs.start_time`,
      ),
      pool.query<{ id: number; year: number; active: boolean; enrollment_count: string }>(
        `SELECT sy.id, sy.year, sy.active, COUNT(sye.id)::TEXT AS enrollment_count
         FROM school_years sy
         LEFT JOIN school_year_enrollments sye ON sye.school_year_id = sy.id
         GROUP BY sy.id, sy.year, sy.active
         ORDER BY sy.year DESC`,
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
    teachers: teachers.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      recordNumber: row.record_number,
      dni: row.dni,
      fullName: row.full_name,
      specialty: row.specialty,
      email: row.email,
      phone: row.phone,
      status: row.status,
    })),
    students: students.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      recordNumber: row.record_number,
      dni: row.dni,
      fullName: row.full_name,
      birthDate: row.birth_date,
      address: row.address,
      phone: row.phone,
      email: row.email,
      courseId: row.course_id,
      level: row.level,
      course: row.course,
      status: row.status,
    })),
    parents: parents.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      children: parentLinks.rows
        .filter((link) => link.parent_id === row.id)
        .map((link) => ({ id: link.id, fullName: link.full_name })),
    })),
    courseSubjects: courseSubjects.rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      course: row.course,
      level: row.level,
      subjectId: row.subject_id,
      subject: row.subject,
      teacherId: row.teacher_id,
      teacher: row.teacher,
      weekday: row.weekday,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
      active: row.active,
    })),
    schoolYears: schoolYears.rows.map((row) => ({
      id: row.id,
      year: row.year,
      active: row.active,
      enrollmentCount: Number(row.enrollment_count),
    })),
  };
}

export async function createLevel(
  pool: DatabasePool,
  actor: Actor,
  name: string,
): Promise<LevelView> {
  return audited(
    pool,
    actor,
    "create_level",
    async () => {
      const result = await pool.query<LevelView>(
        "INSERT INTO levels (name) VALUES ($1) RETURNING id, name",
        [name],
      );
      return result.rows[0];
    },
    (level) => ({ levelId: level.id, name: level.name }),
  );
}

export async function updateLevel(
  pool: DatabasePool,
  actor: Actor,
  levelId: number,
  name: string,
): Promise<LevelView> {
  return audited(
    pool,
    actor,
    "update_level",
    async () => {
      const result = await pool.query<LevelView>(
        "UPDATE levels SET name = $1 WHERE id = $2 RETURNING id, name",
        [name, levelId],
      );
      if (!result.rows[0]) {
        throw new AppError(404, "El nivel no existe", "LEVEL_NOT_FOUND");
      }
      return result.rows[0];
    },
    (level) => ({ levelId: level.id, name: level.name }),
  );
}

export async function deleteLevel(pool: DatabasePool, actor: Actor, levelId: number): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_level",
    () =>
      withTransaction(pool, async (client) => {
        const level = await client.query("SELECT id FROM levels WHERE id = $1", [levelId]);
        if (!level.rowCount) {
          throw new AppError(404, "El nivel no existe", "LEVEL_NOT_FOUND");
        }
        const courses = await client.query("SELECT 1 FROM courses WHERE level_id = $1", [levelId]);
        if (courses.rowCount) {
          throw new AppError(409, "El nivel tiene cursos asociados", "LEVEL_IN_USE");
        }
        const groups = await client.query("SELECT 1 FROM sport_groups WHERE level_id = $1", [levelId]);
        if (groups.rowCount) {
          throw new AppError(409, "El nivel tiene grupos deportivos asociados", "LEVEL_IN_USE");
        }
        await client.query("DELETE FROM levels WHERE id = $1", [levelId]);
      }),
    () => ({ levelId }),
  );
}

export async function createCourse(
  pool: DatabasePool,
  actor: Actor,
  levelId: number,
  name: string,
): Promise<CourseView> {
  return audited(
    pool,
    actor,
    "create_course",
    () =>
      withTransaction(pool, async (client) => {
        const level = await client.query<{ name: string }>(
          "SELECT name FROM levels WHERE id = $1",
          [levelId],
        );
        if (!level.rows[0]) {
          throw new AppError(404, "El nivel indicado no existe", "LEVEL_NOT_FOUND");
        }
        const result = await client.query<{ id: number }>(
          "INSERT INTO courses (level_id, name) VALUES ($1, $2) RETURNING id",
          [levelId, name],
        );
        return { id: result.rows[0].id, levelId, level: level.rows[0].name, name };
      }),
    (course) => ({ courseId: course.id, levelId, name }),
  );
}

export async function updateCourse(
  pool: DatabasePool,
  actor: Actor,
  courseId: number,
  input: { levelId?: number; name?: string },
): Promise<CourseView> {
  return audited(
    pool,
    actor,
    "update_course",
    () =>
      withTransaction(pool, async (client) => {
        const current = await client.query<{ level_id: number; name: string }>(
          "SELECT level_id, name FROM courses WHERE id = $1",
          [courseId],
        );
        if (!current.rows[0]) {
          throw new AppError(404, "El curso no existe", "COURSE_NOT_FOUND");
        }
        const levelId = input.levelId ?? current.rows[0].level_id;
        const level = await client.query<{ name: string }>(
          "SELECT name FROM levels WHERE id = $1",
          [levelId],
        );
        if (!level.rows[0]) {
          throw new AppError(404, "El nivel indicado no existe", "LEVEL_NOT_FOUND");
        }
        const name = input.name ?? current.rows[0].name;
        await client.query("UPDATE courses SET level_id = $1, name = $2 WHERE id = $3", [
          levelId,
          name,
          courseId,
        ]);
        return { id: courseId, levelId, level: level.rows[0].name, name };
      }),
    (course) => ({ courseId: course.id, changes: input }),
  );
}

export async function deleteCourse(pool: DatabasePool, actor: Actor, courseId: number): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_course",
    () =>
      withTransaction(pool, async (client) => {
        const course = await client.query("SELECT id FROM courses WHERE id = $1", [courseId]);
        if (!course.rowCount) {
          throw new AppError(404, "El curso no existe", "COURSE_NOT_FOUND");
        }
        const students = await client.query("SELECT 1 FROM students WHERE course_id = $1", [courseId]);
        if (students.rowCount) {
          throw new AppError(409, "El curso tiene alumnos asignados", "COURSE_IN_USE");
        }
        const enrollments = await client.query(
          "SELECT 1 FROM school_year_enrollments WHERE course_id = $1",
          [courseId],
        );
        if (enrollments.rowCount) {
          throw new AppError(409, "El curso tiene matrículas registradas", "COURSE_IN_USE");
        }
        await client.query("DELETE FROM courses WHERE id = $1", [courseId]);
      }),
    () => ({ courseId }),
  );
}

export async function createSubject(
  pool: DatabasePool,
  actor: Actor,
  name: string,
): Promise<SubjectView> {
  return audited(
    pool,
    actor,
    "create_subject",
    async () => {
      const result = await pool.query<SubjectView>(
        "INSERT INTO subjects (name) VALUES ($1) RETURNING id, name",
        [name],
      );
      return result.rows[0];
    },
    (subject) => ({ subjectId: subject.id, name: subject.name }),
  );
}

export async function updateSubject(
  pool: DatabasePool,
  actor: Actor,
  subjectId: number,
  name: string,
): Promise<SubjectView> {
  return audited(
    pool,
    actor,
    "update_subject",
    async () => {
      const result = await pool.query<SubjectView>(
        "UPDATE subjects SET name = $1 WHERE id = $2 RETURNING id, name",
        [name, subjectId],
      );
      if (!result.rows[0]) {
        throw new AppError(404, "La materia no existe", "SUBJECT_NOT_FOUND");
      }
      return result.rows[0];
    },
    (subject) => ({ subjectId: subject.id, name: subject.name }),
  );
}

export async function deleteSubject(
  pool: DatabasePool,
  actor: Actor,
  subjectId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_subject",
    () =>
      withTransaction(pool, async (client) => {
        const subject = await client.query("SELECT id FROM subjects WHERE id = $1", [subjectId]);
        if (!subject.rowCount) {
          throw new AppError(404, "La materia no existe", "SUBJECT_NOT_FOUND");
        }
        const assigned = await client.query(
          "SELECT 1 FROM student_subjects WHERE subject_id = $1",
          [subjectId],
        );
        const offered = await client.query(
          "SELECT 1 FROM course_subjects WHERE subject_id = $1",
          [subjectId],
        );
        if (assigned.rowCount || offered.rowCount) {
          throw new AppError(409, "La materia está asignada a cursos o alumnos", "SUBJECT_IN_USE");
        }
        await client.query("DELETE FROM subjects WHERE id = $1", [subjectId]);
      }),
    () => ({ subjectId }),
  );
}

export interface CourseSubjectInput {
  courseId: number;
  subjectId: number;
  teacherId: number;
  weekday: number;
  startTime: string;
  endTime: string;
}

export async function createCourseSubject(
  pool: DatabasePool,
  actor: Actor,
  input: CourseSubjectInput,
): Promise<CourseSubjectView> {
  return audited(
    pool,
    actor,
    "create_course_subject",
    () =>
      withTransaction(pool, async (client) => {
        await assertReferences(client, input);
        await assertNoScheduleOverlap(client, input);
        const result = await client.query<{ id: number }>(
          `INSERT INTO course_subjects (course_id, subject_id, teacher_id, weekday, start_time, end_time)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            input.courseId,
            input.subjectId,
            input.teacherId,
            input.weekday,
            input.startTime,
            input.endTime,
          ],
        );
        return loadCourseSubject(client, result.rows[0].id);
      }),
    (row) => ({ courseSubjectId: row.id, courseId: row.courseId, subjectId: row.subjectId }),
  );
}

export async function updateCourseSubject(
  pool: DatabasePool,
  actor: Actor,
  courseSubjectId: number,
  input: Partial<CourseSubjectInput> & { active?: boolean },
): Promise<CourseSubjectView> {
  return audited(
    pool,
    actor,
    "update_course_subject",
    () =>
      withTransaction(pool, async (client) => {
        const current = await loadCourseSubject(client, courseSubjectId);
        const merged: CourseSubjectInput = {
          courseId: input.courseId ?? current.courseId,
          subjectId: input.subjectId ?? current.subjectId,
          teacherId: input.teacherId ?? current.teacherId,
          weekday: input.weekday ?? current.weekday,
          startTime: input.startTime ?? current.startTime,
          endTime: input.endTime ?? current.endTime,
        };
        await assertReferences(client, merged);
        await assertNoScheduleOverlap(client, merged, courseSubjectId);
        await client.query(
          `UPDATE course_subjects
           SET course_id = $1, subject_id = $2, teacher_id = $3,
               weekday = $4, start_time = $5, end_time = $6, active = $7
           WHERE id = $8`,
          [
            merged.courseId,
            merged.subjectId,
            merged.teacherId,
            merged.weekday,
            merged.startTime,
            merged.endTime,
            input.active ?? current.active,
            courseSubjectId,
          ],
        );
        return loadCourseSubject(client, courseSubjectId);
      }),
    (row) => ({ courseSubjectId: row.id, changes: input }),
  );
}

export async function deleteCourseSubject(
  pool: DatabasePool,
  actor: Actor,
  courseSubjectId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_course_subject",
    async () => {
      const result = await pool.query("DELETE FROM course_subjects WHERE id = $1", [courseSubjectId]);
      if (!result.rowCount) {
        throw new AppError(404, "La asignación no existe", "COURSE_SUBJECT_NOT_FOUND");
      }
    },
    () => ({ courseSubjectId }),
  );
}

async function assertReferences(
  client: PoolClient,
  input: CourseSubjectInput,
): Promise<void> {
  if (input.startTime >= input.endTime) {
    throw new AppError(400, "El horario de fin debe ser posterior al de inicio", "VALIDATION_ERROR");
  }
  const course = await client.query("SELECT 1 FROM courses WHERE id = $1", [input.courseId]);
  if (!course.rowCount) {
    throw new AppError(404, "El curso indicado no existe", "COURSE_NOT_FOUND");
  }
  const subject = await client.query("SELECT 1 FROM subjects WHERE id = $1", [input.subjectId]);
  if (!subject.rowCount) {
    throw new AppError(404, "La materia indicada no existe", "SUBJECT_NOT_FOUND");
  }
  const teacher = await client.query("SELECT 1 FROM teachers WHERE id = $1", [input.teacherId]);
  if (!teacher.rowCount) {
    throw new AppError(404, "El docente indicado no existe", "TEACHER_NOT_FOUND");
  }
}

// Dentro de un curso los horarios no pueden superponerse (materias o docentes
// distintos en el mismo bloque impedirían el cursado de los alumnos).
async function assertNoScheduleOverlap(
  client: PoolClient,
  input: CourseSubjectInput,
  excludeId?: number,
): Promise<void> {
  const params: unknown[] = [input.courseId, input.weekday, input.startTime, input.endTime];
  let sql = `SELECT 1 FROM course_subjects
             WHERE course_id = $1 AND weekday = $2 AND active = TRUE
               AND start_time < $4 AND $3 < end_time`;
  if (excludeId !== undefined) {
    params.push(excludeId);
    sql += " AND id <> $5";
  }
  const result = await client.query(sql, params);
  if (result.rowCount) {
    throw new AppError(409, "En un mismo curso los horarios no pueden superponerse", "SCHEDULE_CONFLICT");
  }
}

async function loadCourseSubject(
  client: PoolClient,
  courseSubjectId: number,
): Promise<CourseSubjectView> {
  const result = await client.query<{
    id: number;
    course_id: number;
    course: string;
    level: string;
    subject_id: number;
    subject: string;
    teacher_id: number;
    teacher: string;
    weekday: number;
    weekday_name: string;
    start_time: string;
    end_time: string;
    active: boolean;
  }>(
    `SELECT cs.id, cs.course_id, c.name AS course, l.name AS level,
            cs.subject_id, sub.name AS subject, cs.teacher_id, t.full_name AS teacher,
            cs.weekday, ${WEEKDAY_SQL}, cs.start_time, cs.end_time, cs.active
     FROM course_subjects cs
     JOIN courses c ON c.id = cs.course_id
     JOIN levels l ON l.id = c.level_id
     JOIN subjects sub ON sub.id = cs.subject_id
     JOIN teachers t ON t.id = cs.teacher_id
     WHERE cs.id = $1`,
    [courseSubjectId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, "La asignación no existe", "COURSE_SUBJECT_NOT_FOUND");
  }
  return {
    id: row.id,
    courseId: row.course_id,
    course: row.course,
    level: row.level,
    subjectId: row.subject_id,
    subject: row.subject,
    teacherId: row.teacher_id,
    teacher: row.teacher,
    weekday: row.weekday,
    weekdayName: row.weekday_name,
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    active: row.active,
  };
}

export async function createSchoolYear(
  pool: DatabasePool,
  actor: Actor,
  year: number,
): Promise<SchoolYearView> {
  return audited(
    pool,
    actor,
    "create_school_year",
    async () => {
      const result = await pool.query<{ id: number }>(
        "INSERT INTO school_years (year, active) VALUES ($1, FALSE) RETURNING id",
        [year],
      );
      return { id: result.rows[0].id, year, active: false, enrollmentCount: 0 };
    },
    (row) => ({ schoolYearId: row.id, year: row.year }),
  );
}

export async function updateSchoolYear(
  pool: DatabasePool,
  actor: Actor,
  schoolYearId: number,
  input: { active?: boolean },
): Promise<SchoolYearView> {
  return audited(
    pool,
    actor,
    "update_school_year",
    () =>
      withTransaction(pool, async (client) => {
        const current = await client.query<{ year: number; active: boolean }>(
          "SELECT year, active FROM school_years WHERE id = $1",
          [schoolYearId],
        );
        if (!current.rows[0]) {
          throw new AppError(404, "El año lectivo no existe", "SCHOOL_YEAR_NOT_FOUND");
        }
        if (input.active === true) {
          await client.query("UPDATE school_years SET active = FALSE WHERE active = TRUE");
        }
        await client.query("UPDATE school_years SET active = $1 WHERE id = $2", [
          input.active ?? current.rows[0].active,
          schoolYearId,
        ]);
        const count = await client.query<{ total: string }>(
          "SELECT COUNT(*)::TEXT AS total FROM school_year_enrollments WHERE school_year_id = $1",
          [schoolYearId],
        );
        const active = await client.query<{ active: boolean }>(
          "SELECT active FROM school_years WHERE id = $1",
          [schoolYearId],
        );
        return {
          id: schoolYearId,
          year: current.rows[0].year,
          active: active.rows[0].active,
          enrollmentCount: Number(count.rows[0].total),
        };
      }),
    (row) => ({ schoolYearId: row.id, active: row.active }),
  );
}

export interface UpdateStudentInput {
  recordNumber?: string;
  dni?: string;
  fullName?: string;
  birthDate?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  courseId?: number | null;
  status?: "active" | "inactive";
}

export async function updateStudent(
  pool: DatabasePool,
  actor: Actor,
  studentId: number,
  input: UpdateStudentInput,
): Promise<StudentProfileView> {
  return audited(
    pool,
    actor,
    "update_student",
    () =>
      withTransaction(pool, async (client) => {
        if (input.courseId !== undefined && input.courseId !== null) {
          const course = await client.query("SELECT 1 FROM courses WHERE id = $1", [input.courseId]);
          if (!course.rowCount) {
            throw new AppError(404, "El curso indicado no existe", "COURSE_NOT_FOUND");
          }
        }
        const { sets, values } = buildUpdate(
          {
            record_number: input.recordNumber,
            dni: input.dni,
            full_name: input.fullName,
            birth_date: input.birthDate,
            address: input.address,
            phone: input.phone,
            email: input.email,
            course_id: input.courseId,
            status: input.status,
          },
          { allowNull: true },
        );
        if (!sets.length) {
          throw new AppError(400, "Debe indicar al menos un campo para actualizar", "EMPTY_UPDATE");
        }
        values.push(studentId);
        const result = await client.query(
          `UPDATE students SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING id`,
          values,
        );
        if (!result.rowCount) {
          throw new AppError(404, "El alumno no existe", "STUDENT_NOT_FOUND");
        }
        return loadStudent(client, studentId);
      }),
    () => ({ studentId, changes: input }),
  );
}

export interface UpdateTeacherInput {
  recordNumber?: string | null;
  dni?: string | null;
  fullName?: string;
  specialty?: string;
  email?: string | null;
  phone?: string | null;
  status?: "active" | "inactive";
}

export async function updateTeacher(
  pool: DatabasePool,
  actor: Actor,
  teacherId: number,
  input: UpdateTeacherInput,
): Promise<TeacherProfileView> {
  return audited(
    pool,
    actor,
    "update_teacher",
    () =>
      withTransaction(pool, async (client) => {
        const { sets, values } = buildUpdate(
          {
            record_number: input.recordNumber,
            dni: input.dni,
            full_name: input.fullName,
            specialty: input.specialty,
            email: input.email,
            phone: input.phone,
            status: input.status,
          },
          { allowNull: true },
        );
        if (!sets.length) {
          throw new AppError(400, "Debe indicar al menos un campo para actualizar", "EMPTY_UPDATE");
        }
        values.push(teacherId);
        const result = await client.query(
          `UPDATE teachers SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING id`,
          values,
        );
        if (!result.rowCount) {
          throw new AppError(404, "El docente no existe", "TEACHER_NOT_FOUND");
        }
        const loaded = await client.query<{
          id: number;
          user_id: number | null;
          username: string | null;
          record_number: string | null;
          dni: string | null;
          full_name: string;
          specialty: string;
          email: string | null;
          phone: string | null;
          status: "active" | "inactive";
        }>(
          `SELECT t.id, t.user_id, u.username, t.record_number, t.dni, t.full_name,
                  t.specialty, t.email, t.phone, t.status
           FROM teachers t
           LEFT JOIN users u ON u.id = t.user_id
           WHERE t.id = $1`,
          [teacherId],
        );
        const row = loaded.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          username: row.username,
          recordNumber: row.record_number,
          dni: row.dni,
          fullName: row.full_name,
          specialty: row.specialty,
          email: row.email,
          phone: row.phone,
          status: row.status,
        };
      }),
    () => ({ teacherId, changes: input }),
  );
}

export async function updateParent(
  pool: DatabasePool,
  actor: Actor,
  parentId: number,
  fullName: string,
): Promise<{ id: number; fullName: string }> {
  return audited(
    pool,
    actor,
    "update_parent",
    async () => {
      const result = await pool.query<{ id: number; full_name: string }>(
        "UPDATE parents SET full_name = $1 WHERE id = $2 RETURNING id, full_name",
        [fullName, parentId],
      );
      if (!result.rows[0]) {
        throw new AppError(404, "El padre o madre no existe", "PARENT_NOT_FOUND");
      }
      return { id: result.rows[0].id, fullName: result.rows[0].full_name };
    },
    (row) => ({ parentId: row.id, fullName: row.fullName }),
  );
}

export async function linkParent(
  pool: DatabasePool,
  actor: Actor,
  studentId: number,
  parentId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "link_parent_student",
    () =>
      withTransaction(pool, async (client) => {
        const student = await client.query("SELECT 1 FROM students WHERE id = $1", [studentId]);
        if (!student.rowCount) {
          throw new AppError(404, "El alumno no existe", "STUDENT_NOT_FOUND");
        }
        const parent = await client.query("SELECT 1 FROM parents WHERE id = $1", [parentId]);
        if (!parent.rowCount) {
          throw new AppError(404, "El padre o madre no existe", "PARENT_NOT_FOUND");
        }
        const existing = await client.query(
          "SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2",
          [parentId, studentId],
        );
        if (existing.rowCount) {
          throw new AppError(409, "El vínculo ya existe", "ALREADY_LINKED");
        }
        await client.query(
          "INSERT INTO parent_students (parent_id, student_id) VALUES ($1, $2)",
          [parentId, studentId],
        );
      }),
    () => ({ studentId, parentId }),
  );
}

export async function unlinkParent(
  pool: DatabasePool,
  actor: Actor,
  studentId: number,
  parentId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "unlink_parent_student",
    async () => {
      const result = await pool.query(
        "DELETE FROM parent_students WHERE parent_id = $1 AND student_id = $2",
        [parentId, studentId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "El vínculo no existe", "LINK_NOT_FOUND");
      }
    },
    () => ({ studentId, parentId }),
  );
}

export interface MatriculaInput {
  studentId: number;
  schoolYearId: number;
  courseId: number;
}

export interface MatriculaView {
  id: number;
  studentId: number;
  student: string;
  schoolYearId: number;
  year: number;
  courseId: number;
  level: string;
  course: string;
  status: "enrolled" | "cancelled";
  createdAt: string;
}

export async function listMatriculas(pool: DatabasePool): Promise<MatriculaView[]> {
  const result = await pool.query<{
    id: number;
    student_id: number;
    student: string;
    school_year_id: number;
    year: number;
    course_id: number;
    level: string;
    course: string;
    status: "enrolled" | "cancelled";
    created_at: string;
  }>(
    `SELECT sye.id, sye.student_id, st.full_name AS student, sye.school_year_id, sy.year,
            sye.course_id, l.name AS level, c.name AS course, sye.status, sye.created_at
     FROM school_year_enrollments sye
     JOIN students st ON st.id = sye.student_id
     JOIN school_years sy ON sy.id = sye.school_year_id
     JOIN courses c ON c.id = sye.course_id
     JOIN levels l ON l.id = c.level_id
     ORDER BY sy.year DESC, st.full_name`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    studentId: row.student_id,
    student: row.student,
    schoolYearId: row.school_year_id,
    year: row.year,
    courseId: row.course_id,
    level: row.level,
    course: row.course,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function updateMatricula(
  pool: DatabasePool,
  actor: Actor,
  matriculaId: number,
  status: "enrolled" | "cancelled",
): Promise<MatriculaView> {
  return audited(
    pool,
    actor,
    "update_matricula",
    () =>
      withTransaction(pool, async (client) => {
        const result = await client.query(
          "UPDATE school_year_enrollments SET status = $1 WHERE id = $2 RETURNING id",
          [status, matriculaId],
        );
        if (!result.rowCount) {
          throw new AppError(404, "La matrícula no existe", "MATRICULA_NOT_FOUND");
        }
        const row = await loadMatricula(client, matriculaId);
        return row;
      }),
    (row) => ({ matriculaId: row.id, status: row.status }),
  );
}

async function loadMatricula(
  client: PoolClient,
  matriculaId: number,
): Promise<MatriculaView> {
  const result = await client.query<{
    id: number;
    student_id: number;
    student: string;
    school_year_id: number;
    year: number;
    course_id: number;
    level: string;
    course: string;
    status: "enrolled" | "cancelled";
    created_at: string;
  }>(
    `SELECT sye.id, sye.student_id, st.full_name AS student, sye.school_year_id, sy.year,
            sye.course_id, l.name AS level, c.name AS course, sye.status, sye.created_at
     FROM school_year_enrollments sye
     JOIN students st ON st.id = sye.student_id
     JOIN school_years sy ON sy.id = sye.school_year_id
     JOIN courses c ON c.id = sye.course_id
     JOIN levels l ON l.id = c.level_id
     WHERE sye.id = $1`,
    [matriculaId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, "La matrícula no existe", "MATRICULA_NOT_FOUND");
  }
  return {
    id: row.id,
    studentId: row.student_id,
    student: row.student,
    schoolYearId: row.school_year_id,
    year: row.year,
    courseId: row.course_id,
    level: row.level,
    course: row.course,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function loadStudent(
  client: PoolClient,
  studentId: number,
): Promise<StudentProfileView> {
  const result = await client.query<{
    id: number;
    user_id: number;
    record_number: string;
    dni: string;
    full_name: string;
    birth_date: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    course_id: number | null;
    level: string;
    course: string;
    status: "active" | "inactive";
  }>(
    `SELECT st.id, st.user_id, st.record_number, st.dni, st.full_name, st.birth_date,
            st.address, st.phone, st.email, st.course_id,
            COALESCE(l.name, 'Pendiente') AS level,
            COALESCE(c.name, 'Pendiente') AS course,
            st.status
     FROM students st
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     WHERE st.id = $1`,
    [studentId],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    recordNumber: row.record_number,
    dni: row.dni,
    fullName: row.full_name,
    birthDate: row.birth_date,
    address: row.address,
    phone: row.phone,
    email: row.email,
    courseId: row.course_id,
    level: row.level,
    course: row.course,
    status: row.status,
  };
}

function buildUpdate(
  fields: Record<string, unknown>,
  options: { allowNull?: boolean },
): { sets: string[]; values: unknown[] } {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    if (value === null && !options.allowNull) {
      continue;
    }
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  return { sets, values };
}

export function formatTime(value: string): string {
  return value.slice(0, 5);
}
