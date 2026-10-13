import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError } from "./errors.js";
import { withAuditProxy } from "./auditProxy.js";
import { RowIterator } from "./rowIterator.js";
import type { UserRole } from "./auth.js";
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
    `SELECT DISTINCT sub.id AS subject_id, sub.name AS subject,
            COALESCE(l.name, 'Pendiente') AS level, COALESCE(c.name, 'Pendiente') AS course
     FROM student_subjects ss
     JOIN subjects sub ON sub.id = ss.subject_id
     JOIN students st ON st.id = ss.student_id
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     WHERE ss.teacher_id = $1
     ORDER BY sub.name, l.name, c.name`,
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
    `SELECT st.record_number, st.dni, st.full_name,
            COALESCE(l.name, 'Pendiente') AS level, COALESCE(c.name, 'Pendiente') AS course,
            sub.name AS subject, t.full_name AS teacher
     FROM student_subjects ss
     JOIN students st ON st.id = ss.student_id
     JOIN subjects sub ON sub.id = ss.subject_id
     JOIN teachers t ON t.id = ss.teacher_id
     LEFT JOIN courses c ON c.id = st.course_id
     LEFT JOIN levels l ON l.id = c.level_id
     WHERE ss.teacher_id = $1 AND ss.subject_id = $2
       AND l.name = $3 AND c.name = $4
     ORDER BY st.full_name`,
    [teacherId, subjectId, level, course],
  );
  return new RowIterator(
    result.rows,
    (row) => ({
      recordNumber: row.record_number,
      dni: row.dni,
      fullName: row.full_name,
      level: row.level,
      course: row.course,
      subject: row.subject,
      teacher: row.teacher,
    }),
  ).toArray();
}

export interface TeacherProfileView {
  id: number;
  recordNumber: string | null;
  dni: string | null;
  fullName: string;
  specialty: string;
  email: string | null;
  phone: string | null;
  status: string;
  subjects: Array<{
    subjectId: number;
    subject: string;
    level: string;
    course: string;
    weekday: number;
    weekdayName: string;
    startTime: string;
    endTime: string;
  }>;
  sportGroups: Array<{
    groupId: number;
    sport: string;
    level: string;
    weekday: number;
    weekdayName: string;
    startTime: string;
    endTime: string;
  }>;
}

export interface TeacherReportView {
  generatedAt: string;
  teacher: { fullName: string; specialty: string };
  courses: Array<{
    level: string;
    course: string;
    studentCount: number;
    subjects: Array<{
      subject: string;
      weekdayName: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  sports: Array<{
    sport: string;
    level: string;
    weekdayName: string;
    startTime: string;
    endTime: string;
    studentCount: number;
  }>;
}

export async function getTeacherProfile(
  pool: DatabasePool,
  userId: number,
): Promise<TeacherProfileView> {
  const teacherId = await findTeacherId(pool, userId);
  const [profile, subjects, sports] = await Promise.all([
    pool.query<{
      id: number;
      record_number: string | null;
      dni: string | null;
      full_name: string;
      specialty: string;
      email: string | null;
      phone: string | null;
      status: string;
    }>(
      `SELECT id, record_number, dni, full_name, specialty, email, phone, status
       FROM teachers WHERE id = $1`,
      [teacherId],
    ),
    pool.query<{
      subject_id: number;
      subject: string;
      level: string;
      course: string;
      weekday: number;
      weekday_name: string;
      start_time: string;
      end_time: string;
    }>(
      `SELECT cs.subject_id, sub.name AS subject, l.name AS level, c.name AS course,
              cs.weekday, ${WEEKDAY_CASE.replace("slot", "cs")},
              cs.start_time, cs.end_time
       FROM course_subjects cs
       JOIN courses c ON c.id = cs.course_id
       JOIN levels l ON l.id = c.level_id
       JOIN subjects sub ON sub.id = cs.subject_id
       WHERE cs.teacher_id = $1 AND cs.active = TRUE
       ORDER BY l.name, c.name, sub.name, cs.weekday, cs.start_time`,
      [teacherId],
    ),
    pool.query<{
      group_id: number;
      sport: string;
      level: string;
      weekday: number;
      weekday_name: string;
      start_time: string;
      end_time: string;
    }>(
      `SELECT sg.id AS group_id, sp.name AS sport, COALESCE(l.name, 'Todos') AS level,
              sg.weekday, ${WEEKDAY_CASE.replace("slot", "sg")},
              sg.start_time, sg.end_time
       FROM sport_groups sg
       JOIN sports sp ON sp.id = sg.sport_id
       LEFT JOIN levels l ON l.id = sg.level_id
       WHERE sg.teacher_id = $1 AND sg.active = TRUE
       ORDER BY sp.name, sg.weekday, sg.start_time`,
      [teacherId],
    ),
  ]);

  return {
    id: profile.rows[0].id,
    recordNumber: profile.rows[0].record_number,
    dni: profile.rows[0].dni,
    fullName: profile.rows[0].full_name,
    specialty: profile.rows[0].specialty,
    email: profile.rows[0].email,
    phone: profile.rows[0].phone,
    status: profile.rows[0].status,
    subjects: subjects.rows.map((row) => ({
      subjectId: row.subject_id,
      subject: row.subject,
      level: row.level,
      course: row.course,
      weekday: row.weekday,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
    })),
    sportGroups: sports.rows.map((row) => ({
      groupId: row.group_id,
      sport: row.sport,
      level: row.level,
      weekday: row.weekday,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
    })),
  };
}

export async function getTeacherReport(
  pool: DatabasePool,
  userId: number,
): Promise<TeacherReportView> {
  const teacherId = await findTeacherId(pool, userId);
  const [profile, subjects, courseCounts, sports] = await Promise.all([
    pool.query<{ full_name: string; specialty: string }>(
      "SELECT full_name, specialty FROM teachers WHERE id = $1",
      [teacherId],
    ),
    pool.query<{
      course_id: number;
      subject_id: number;
      level: string;
      course: string;
      subject: string;
      weekday: number;
      weekday_name: string;
      start_time: string;
      end_time: string;
    }>(
      `SELECT cs.course_id, cs.subject_id, l.name AS level, c.name AS course, sub.name AS subject,
              cs.weekday, ${WEEKDAY_CASE.replace("slot", "cs")},
              cs.start_time, cs.end_time
       FROM course_subjects cs
       JOIN courses c ON c.id = cs.course_id
       JOIN levels l ON l.id = c.level_id
       JOIN subjects sub ON sub.id = cs.subject_id
       WHERE cs.teacher_id = $1 AND cs.active = TRUE
       ORDER BY l.name, c.name, sub.name, cs.weekday, cs.start_time`,
      [teacherId],
    ),
    pool.query<{ course_id: number; total: string }>(
      `SELECT st.course_id, COUNT(DISTINCT st.id)::TEXT AS total
       FROM student_subjects ss
       JOIN students st ON st.id = ss.student_id
       WHERE ss.teacher_id = $1 AND st.course_id IS NOT NULL
       GROUP BY st.course_id`,
      [teacherId],
    ),
    pool.query<{
      sport: string;
      level: string;
      weekday: number;
      weekday_name: string;
      start_time: string;
      end_time: string;
      student_count: string;
    }>(
      `SELECT sp.name AS sport, COALESCE(l.name, 'Todos') AS level,
              sg.weekday, ${WEEKDAY_CASE.replace("slot", "sg")},
              sg.start_time, sg.end_time,
              COUNT(se.id)::TEXT AS student_count
       FROM sport_groups sg
       JOIN sports sp ON sp.id = sg.sport_id
       LEFT JOIN levels l ON l.id = sg.level_id
       LEFT JOIN sport_enrollments se ON se.group_id = sg.id
       WHERE sg.teacher_id = $1 AND sg.active = TRUE
       GROUP BY sg.id, sp.name, l.name, sg.weekday, sg.start_time, sg.end_time
       ORDER BY sp.name, sg.weekday, sg.start_time`,
      [teacherId],
    ),
  ]);

  const courseCountById = new Map(
    courseCounts.rows.map((row) => [row.course_id, Number(row.total)]),
  );
  const courseById = new Map<number, TeacherReportView["courses"][number]>();
  const courses: TeacherReportView["courses"] = [];
  for (const row of subjects.rows) {
    let course = courseById.get(row.course_id);
    if (!course) {
      course = {
        level: row.level,
        course: row.course,
        studentCount: courseCountById.get(row.course_id) ?? 0,
        subjects: [],
      };
      courseById.set(row.course_id, course);
      courses.push(course);
    }
    course.subjects.push({
      subject: row.subject,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    teacher: {
      fullName: profile.rows[0].full_name,
      specialty: profile.rows[0].specialty,
    },
    courses,
    sports: sports.rows.map((row) => ({
      sport: row.sport,
      level: row.level,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
      studentCount: Number(row.student_count),
    })),
  };
}

const WEEKDAY_CASE = `
  CASE slot.weekday
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miercoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sabado'
    ELSE 'Domingo'
  END AS weekday_name
`;

export async function updateTeacherContact(
  pool: DatabasePool,
  actorUserId: number,
  actorRole: UserRole,
  input: ContactInput,
): Promise<ContactInput> {
  return withAuditProxy(pool, {
    operation: "update_teacher_contact",
    actorUserId,
    actorRole,
    allowedRoles: ["teacher"],
    fallbackMessage: "No se pudieron actualizar los datos de contacto",
    onSuccess: () => ({ email: input.email, phone: input.phone }),
    handler: () =>
      withTransaction(pool, async (client) => {
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
        return input;
      }),
  });
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}
