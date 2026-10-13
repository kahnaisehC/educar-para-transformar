import type { PoolClient } from "pg";
import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import { withAuditProxy } from "./auditProxy.js";
import type { UserRole } from "./auth.js";
import { formatTime, type MatriculaView } from "./academic.service.js";

export interface SportView {
  id: number;
  name: string;
  groupCount: number;
}

export interface SportGroupView {
  id: number;
  sportId: number;
  sport: string;
  teacherId: number;
  teacher: string;
  levelId: number | null;
  level: string;
  weekday: number;
  weekdayName: string;
  startTime: string;
  endTime: string;
  active: boolean;
  enrollmentCount: number;
}

export interface TransportRouteView {
  id: number;
  name: string;
  description: string;
  active: boolean;
  enrolledCount: number;
}

export interface CafeteriaEnrollmentView {
  studentId: number;
  student: string;
  level: string;
  course: string;
  active: boolean;
  createdAt: string | null;
}

export interface SportEnrollmentView {
  id: number;
  studentId: number;
  student: string;
  sport: string;
  level: string;
  weekdayName: string;
  startTime: string;
  endTime: string;
}

export interface TransportEnrollmentView {
  studentId: number;
  student: string;
  route: string;
  createdAt: string;
}

export interface ServicesOverview {
  sports: SportView[];
  sportGroups: SportGroupView[];
  transportRoutes: TransportRouteView[];
}

export interface EnrollmentsOverview {
  sportEnrollments: SportEnrollmentView[];
  transportEnrollments: TransportEnrollmentView[];
  cafeteria: CafeteriaEnrollmentView[];
  matriculas: MatriculaView[];
}

interface Actor {
  userId: number;
  role: UserRole;
}

function weekdayCase(alias: string): string {
  return `
  CASE ${alias}.weekday
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miercoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sabado'
    ELSE 'Domingo'
  END AS weekday_name
`;
}

const WEEKDAY_SQL = weekdayCase("slot");

function normalizeServiceError(error: unknown): Error {
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
    normalizeError: normalizeServiceError,
    onSuccess,
    onError: (error) => ({ reason: error instanceof Error ? error.message : "Unknown error" }),
    handler,
  });
}

export async function getServicesOverview(pool: DatabasePool): Promise<ServicesOverview> {
  const [sports, groups, routes] = await Promise.all([
    pool.query<{ id: number; name: string; group_count: string }>(
      `SELECT s.id, s.name, COUNT(sg.id)::TEXT AS group_count
       FROM sports s
       LEFT JOIN sport_groups sg ON sg.sport_id = s.id
       GROUP BY s.id, s.name
       ORDER BY s.name`,
    ),
    pool.query<{
      id: number;
      sport_id: number;
      sport: string;
      teacher_id: number;
      teacher: string;
      level_id: number | null;
      level: string;
      weekday: number;
      weekday_name: string;
      start_time: string;
      end_time: string;
      active: boolean;
      enrollment_count: string;
    }>(
      `SELECT slot.id, slot.sport_id, sp.name AS sport, slot.teacher_id, t.full_name AS teacher,
              slot.level_id, COALESCE(l.name, 'Todos') AS level,
              slot.weekday, ${WEEKDAY_SQL}, slot.start_time, slot.end_time, slot.active,
              COUNT(se.id)::TEXT AS enrollment_count
       FROM sport_groups slot
       JOIN sports sp ON sp.id = slot.sport_id
       JOIN teachers t ON t.id = slot.teacher_id
       LEFT JOIN levels l ON l.id = slot.level_id
       LEFT JOIN sport_enrollments se ON se.group_id = slot.id
       GROUP BY slot.id, slot.sport_id, sp.name, slot.teacher_id, t.full_name,
                slot.level_id, l.name, slot.weekday, slot.start_time, slot.end_time, slot.active
       ORDER BY sp.name, slot.weekday, slot.start_time`,
    ),
    pool.query<{
      id: number;
      name: string;
      description: string;
      active: boolean;
      enrolled_count: string;
    }>(
      `SELECT tr.id, tr.name, tr.description, tr.active, COUNT(te.student_id)::TEXT AS enrolled_count
       FROM transport_routes tr
       LEFT JOIN transport_enrollments te ON te.route_id = tr.id
       GROUP BY tr.id, tr.name, tr.description, tr.active
       ORDER BY tr.name`,
    ),
  ]);

  return {
    sports: sports.rows.map((row) => ({
      id: row.id,
      name: row.name,
      groupCount: Number(row.group_count),
    })),
    sportGroups: groups.rows.map((row) => ({
      id: row.id,
      sportId: row.sport_id,
      sport: row.sport,
      teacherId: row.teacher_id,
      teacher: row.teacher,
      levelId: row.level_id,
      level: row.level,
      weekday: row.weekday,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
      active: row.active,
      enrollmentCount: Number(row.enrollment_count),
    })),
    transportRoutes: routes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      active: row.active,
      enrolledCount: Number(row.enrolled_count),
    })),
  };
}

export async function getEnrollmentsOverview(pool: DatabasePool): Promise<EnrollmentsOverview> {
  const [sportEnrollments, transportEnrollments, cafeteria, matriculas] = await Promise.all([
    pool.query<{
      id: number;
      student_id: number;
      student: string;
      sport: string;
      level: string;
      weekday: number;
      weekday_name: string;
      start_time: string;
      end_time: string;
    }>(
      `SELECT se.id, st.id AS student_id, st.full_name AS student, sp.name AS sport,
              COALESCE(l.name, 'Todos') AS level, sg.weekday, ${weekdayCase("sg")},
              sg.start_time, sg.end_time
       FROM sport_enrollments se
       JOIN students st ON st.id = se.student_id
       JOIN sport_groups sg ON sg.id = se.group_id
       JOIN sports sp ON sp.id = sg.sport_id
       LEFT JOIN levels l ON l.id = sg.level_id
       ORDER BY st.full_name, sp.name`,
    ),
    pool.query<{
      student_id: number;
      student: string;
      route: string;
      created_at: string;
    }>(
      `SELECT st.id AS student_id, st.full_name AS student, tr.name AS route, te.created_at
       FROM transport_enrollments te
       JOIN students st ON st.id = te.student_id
       JOIN transport_routes tr ON tr.id = te.route_id
       ORDER BY st.full_name`,
    ),
    pool.query<{
      student_id: number;
      student: string;
      level: string;
      course: string;
      active: boolean;
      created_at: string;
    }>(
      `SELECT st.id AS student_id, st.full_name AS student,
              COALESCE(l.name, 'Pendiente') AS level, COALESCE(c.name, 'Pendiente') AS course,
              ce.active, ce.created_at
       FROM cafeteria_enrollments ce
       JOIN students st ON st.id = ce.student_id
       LEFT JOIN courses c ON c.id = st.course_id
       LEFT JOIN levels l ON l.id = c.level_id
       ORDER BY st.full_name`,
    ),
    pool.query<{
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
    ),
  ]);

  return {
    sportEnrollments: sportEnrollments.rows.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      student: row.student,
      sport: row.sport,
      level: row.level,
      weekdayName: row.weekday_name,
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
    })),
    transportEnrollments: transportEnrollments.rows.map((row) => ({
      studentId: row.student_id,
      student: row.student,
      route: row.route,
      createdAt: row.created_at,
    })),
    cafeteria: cafeteria.rows.map((row) => ({
      studentId: row.student_id,
      student: row.student,
      level: row.level,
      course: row.course,
      active: row.active,
      createdAt: row.active ? row.created_at : null,
    })),
    matriculas: matriculas.rows.map((row) => ({
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
    })),
  };
}

export async function createSport(
  pool: DatabasePool,
  actor: Actor,
  name: string,
): Promise<SportView> {
  return audited(
    pool,
    actor,
    "create_sport",
    async () => {
      const result = await pool.query<{ id: number }>(
        "INSERT INTO sports (name) VALUES ($1) RETURNING id",
        [name],
      );
      return { id: result.rows[0].id, name, groupCount: 0 };
    },
    (sport) => ({ sportId: sport.id, name }),
  );
}

export async function updateSport(
  pool: DatabasePool,
  actor: Actor,
  sportId: number,
  name: string,
): Promise<SportView> {
  return audited(
    pool,
    actor,
    "update_sport",
    async () => {
      const result = await pool.query(
        "UPDATE sports SET name = $1 WHERE id = $2 RETURNING id",
        [name, sportId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "El deporte no existe", "SPORT_NOT_FOUND");
      }
      const count = await pool.query<{ total: string }>(
        "SELECT COUNT(*)::TEXT AS total FROM sport_groups WHERE sport_id = $1",
        [sportId],
      );
      return { id: sportId, name, groupCount: Number(count.rows[0].total) };
    },
    (sport) => ({ sportId: sport.id, name }),
  );
}

export async function deleteSport(pool: DatabasePool, actor: Actor, sportId: number): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_sport",
    () =>
      withTransaction(pool, async (client) => {
        const sport = await client.query("SELECT 1 FROM sports WHERE id = $1", [sportId]);
        if (!sport.rowCount) {
          throw new AppError(404, "El deporte no existe", "SPORT_NOT_FOUND");
        }
        const groups = await client.query("SELECT 1 FROM sport_groups WHERE sport_id = $1", [sportId]);
        if (groups.rowCount) {
          throw new AppError(409, "El deporte tiene grupos asociados", "SPORT_IN_USE");
        }
        await client.query("DELETE FROM sports WHERE id = $1", [sportId]);
      }),
    () => ({ sportId }),
  );
}

export interface SportGroupInput {
  sportId: number;
  teacherId: number;
  levelId: number | null;
  weekday: number;
  startTime: string;
  endTime: string;
}

export async function createSportGroup(
  pool: DatabasePool,
  actor: Actor,
  input: SportGroupInput,
): Promise<SportGroupView> {
  return audited(
    pool,
    actor,
    "create_sport_group",
    () =>
      withTransaction(pool, async (client) => {
        await assertGroupReferences(client, input);
        const result = await client.query<{ id: number }>(
          `INSERT INTO sport_groups (sport_id, teacher_id, level_id, weekday, start_time, end_time)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [input.sportId, input.teacherId, input.levelId, input.weekday, input.startTime, input.endTime],
        );
        return loadSportGroup(client, result.rows[0].id);
      }),
    (group) => ({ groupId: group.id, sportId: group.sportId }),
  );
}

export async function updateSportGroup(
  pool: DatabasePool,
  actor: Actor,
  groupId: number,
  input: Partial<SportGroupInput> & { active?: boolean },
): Promise<SportGroupView> {
  return audited(
    pool,
    actor,
    "update_sport_group",
    () =>
      withTransaction(pool, async (client) => {
        const current = await loadSportGroup(client, groupId);
        const merged: SportGroupInput = {
          sportId: input.sportId ?? current.sportId,
          teacherId: input.teacherId ?? current.teacherId,
          levelId: input.levelId !== undefined ? input.levelId : current.levelId,
          weekday: input.weekday ?? current.weekday,
          startTime: input.startTime ?? current.startTime,
          endTime: input.endTime ?? current.endTime,
        };
        await assertGroupReferences(client, merged);
        await client.query(
          `UPDATE sport_groups
           SET sport_id = $1, teacher_id = $2, level_id = $3,
               weekday = $4, start_time = $5, end_time = $6, active = $7
           WHERE id = $8`,
          [
            merged.sportId,
            merged.teacherId,
            merged.levelId,
            merged.weekday,
            merged.startTime,
            merged.endTime,
            input.active ?? current.active,
            groupId,
          ],
        );
        return loadSportGroup(client, groupId);
      }),
    (group) => ({ groupId: group.id, changes: input }),
  );
}

export async function deleteSportGroup(
  pool: DatabasePool,
  actor: Actor,
  groupId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_sport_group",
    () =>
      withTransaction(pool, async (client) => {
        const group = await client.query("SELECT 1 FROM sport_groups WHERE id = $1", [groupId]);
        if (!group.rowCount) {
          throw new AppError(404, "El grupo deportivo no existe", "GROUP_NOT_FOUND");
        }
        const enrollments = await client.query(
          "SELECT 1 FROM sport_enrollments WHERE group_id = $1",
          [groupId],
        );
        if (enrollments.rowCount) {
          throw new AppError(409, "El grupo tiene inscripciones activas", "GROUP_IN_USE");
        }
        await client.query("DELETE FROM sport_groups WHERE id = $1", [groupId]);
      }),
    () => ({ groupId }),
  );
}

async function assertGroupReferences(client: PoolClient, input: SportGroupInput): Promise<void> {
  if (input.startTime >= input.endTime) {
    throw new AppError(400, "El horario de fin debe ser posterior al de inicio", "VALIDATION_ERROR");
  }
  const sport = await client.query("SELECT 1 FROM sports WHERE id = $1", [input.sportId]);
  if (!sport.rowCount) {
    throw new AppError(404, "El deporte indicado no existe", "SPORT_NOT_FOUND");
  }
  const teacher = await client.query("SELECT 1 FROM teachers WHERE id = $1", [input.teacherId]);
  if (!teacher.rowCount) {
    throw new AppError(404, "El docente indicado no existe", "TEACHER_NOT_FOUND");
  }
  if (input.levelId !== null) {
    const level = await client.query("SELECT 1 FROM levels WHERE id = $1", [input.levelId]);
    if (!level.rowCount) {
      throw new AppError(404, "El nivel indicado no existe", "LEVEL_NOT_FOUND");
    }
  }
}

async function loadSportGroup(client: PoolClient, groupId: number): Promise<SportGroupView> {
  const result = await client.query<{
    id: number;
    sport_id: number;
    sport: string;
    teacher_id: number;
    teacher: string;
    level_id: number | null;
    level: string;
    weekday: number;
    weekday_name: string;
    start_time: string;
    end_time: string;
    active: boolean;
    enrollment_count: string;
  }>(
    `SELECT slot.id, slot.sport_id, sp.name AS sport, slot.teacher_id, t.full_name AS teacher,
            slot.level_id, COALESCE(l.name, 'Todos') AS level,
            slot.weekday, ${WEEKDAY_SQL}, slot.start_time, slot.end_time, slot.active,
            COUNT(se.id)::TEXT AS enrollment_count
     FROM sport_groups slot
     JOIN sports sp ON sp.id = slot.sport_id
     JOIN teachers t ON t.id = slot.teacher_id
     LEFT JOIN levels l ON l.id = slot.level_id
     LEFT JOIN sport_enrollments se ON se.group_id = slot.id
     WHERE slot.id = $1
     GROUP BY slot.id, slot.sport_id, sp.name, slot.teacher_id, t.full_name,
              slot.level_id, l.name, slot.weekday, slot.start_time, slot.end_time, slot.active`,
    [groupId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(404, "El grupo deportivo no existe", "GROUP_NOT_FOUND");
  }
  return {
    id: row.id,
    sportId: row.sport_id,
    sport: row.sport,
    teacherId: row.teacher_id,
    teacher: row.teacher,
    levelId: row.level_id,
    level: row.level,
    weekday: row.weekday,
    weekdayName: row.weekday_name,
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    active: row.active,
    enrollmentCount: Number(row.enrollment_count),
  };
}

export async function createTransportRoute(
  pool: DatabasePool,
  actor: Actor,
  name: string,
  description: string,
): Promise<TransportRouteView> {
  return audited(
    pool,
    actor,
    "create_transport_route",
    () =>
      withTransaction(pool, async (client) => {
        const count = await client.query<{ total: string }>(
          "SELECT COUNT(*)::TEXT AS total FROM transport_routes",
        );
        if (Number(count.rows[0].total) >= 4) {
          throw new AppError(
            409,
            "El servicio de transporte admite exactamente cuatro recorridos",
            "ROUTE_LIMIT_REACHED",
          );
        }
        const result = await client.query<{ id: number }>(
          `INSERT INTO transport_routes (name, description, active)
           VALUES ($1, $2, TRUE)
           RETURNING id`,
          [name, description],
        );
        return { id: result.rows[0].id, name, description, active: true, enrolledCount: 0 };
      }),
    (route) => ({ routeId: route.id, name }),
  );
}

export async function updateTransportRoute(
  pool: DatabasePool,
  actor: Actor,
  routeId: number,
  input: { name?: string; description?: string; active?: boolean },
): Promise<TransportRouteView> {
  return audited(
    pool,
    actor,
    "update_transport_route",
    () =>
      withTransaction(pool, async (client) => {
        const current = await client.query<{
          name: string;
          description: string;
          active: boolean;
        }>("SELECT name, description, active FROM transport_routes WHERE id = $1", [routeId]);
        if (!current.rows[0]) {
          throw new AppError(404, "El recorrido no existe", "ROUTE_NOT_FOUND");
        }
        const name = input.name ?? current.rows[0].name;
        const description = input.description ?? current.rows[0].description;
        const active = input.active ?? current.rows[0].active;
        await client.query(
          "UPDATE transport_routes SET name = $1, description = $2, active = $3 WHERE id = $4",
          [name, description, active, routeId],
        );
        const count = await client.query<{ total: string }>(
          "SELECT COUNT(*)::TEXT AS total FROM transport_enrollments WHERE route_id = $1",
          [routeId],
        );
        return { id: routeId, name, description, active, enrolledCount: Number(count.rows[0].total) };
      }),
    (route) => ({ routeId: route.id, changes: input }),
  );
}

export async function deleteTransportRoute(
  pool: DatabasePool,
  actor: Actor,
  routeId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "delete_transport_route",
    () =>
      withTransaction(pool, async (client) => {
        const route = await client.query("SELECT 1 FROM transport_routes WHERE id = $1", [routeId]);
        if (!route.rowCount) {
          throw new AppError(404, "El recorrido no existe", "ROUTE_NOT_FOUND");
        }
        const enrollments = await client.query(
          "SELECT 1 FROM transport_enrollments WHERE route_id = $1",
          [routeId],
        );
        if (enrollments.rowCount) {
          throw new AppError(409, "El recorrido tiene alumnos asignados", "ROUTE_IN_USE");
        }
        const count = await client.query<{ total: string }>(
          "SELECT COUNT(*)::TEXT AS total FROM transport_routes",
        );
        if (Number(count.rows[0].total) <= 4) {
          throw new AppError(
            409,
            "El servicio de transporte debe conservar cuatro recorridos",
            "ROUTE_MINIMUM_REQUIRED",
          );
        }
        await client.query("DELETE FROM transport_routes WHERE id = $1", [routeId]);
      }),
    () => ({ routeId }),
  );
}

export async function updateCafeteriaEnrollment(
  pool: DatabasePool,
  actor: Actor,
  studentId: number,
  active: boolean,
): Promise<CafeteriaEnrollmentView> {
  return audited(
    pool,
    actor,
    "update_cafeteria_enrollment",
    () =>
      withTransaction(pool, async (client) => {
        const student = await client.query<{ full_name: string }>(
          "SELECT full_name FROM students WHERE id = $1",
          [studentId],
        );
        if (!student.rows[0]) {
          throw new AppError(404, "El alumno no existe", "STUDENT_NOT_FOUND");
        }
        const existing = await client.query<{ active: boolean }>(
          "SELECT active FROM cafeteria_enrollments WHERE student_id = $1",
          [studentId],
        );
        if (existing.rows[0]) {
          await client.query("UPDATE cafeteria_enrollments SET active = $1 WHERE student_id = $2", [
            active,
            studentId,
          ]);
        } else if (active) {
          await client.query(
            "INSERT INTO cafeteria_enrollments (student_id, active) VALUES ($1, TRUE)",
            [studentId],
          );
        } else {
          throw new AppError(404, "El alumno no tiene inscripción al comedor", "CAFETERIA_NOT_ENROLLED");
        }
        const loaded = await client.query<{
          full_name: string;
          level: string;
          course: string;
          active: boolean;
          created_at: string | null;
        }>(
          `SELECT st.full_name,
                  COALESCE(l.name, 'Pendiente') AS level,
                  COALESCE(c.name, 'Pendiente') AS course,
                  ce.active,
                  CASE WHEN ce.active THEN ce.created_at ELSE NULL END AS created_at
           FROM cafeteria_enrollments ce
           JOIN students st ON st.id = ce.student_id
           LEFT JOIN courses c ON c.id = st.course_id
           LEFT JOIN levels l ON l.id = c.level_id
           WHERE ce.student_id = $1`,
          [studentId],
        );
        const row = loaded.rows[0];
        return {
          studentId,
          student: row.full_name,
          level: row.level,
          course: row.course,
          active: row.active,
          createdAt: row.created_at,
        };
      }),
    (row) => ({ studentId: row.studentId, active: row.active }),
  );
}

export async function cancelSportEnrollmentAdmin(
  pool: DatabasePool,
  actor: Actor,
  enrollmentId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "cancel_sport_by_admin",
    async () => {
      const result = await pool.query(
        "DELETE FROM sport_enrollments WHERE id = $1",
        [enrollmentId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "La inscripción no existe", "ENROLLMENT_NOT_FOUND");
      }
    },
    () => ({ enrollmentId }),
  );
}

export async function cancelTransportEnrollmentAdmin(
  pool: DatabasePool,
  actor: Actor,
  studentId: number,
): Promise<void> {
  await audited(
    pool,
    actor,
    "cancel_transport_by_admin",
    async () => {
      const result = await pool.query(
        "DELETE FROM transport_enrollments WHERE student_id = $1",
        [studentId],
      );
      if (!result.rowCount) {
        throw new AppError(404, "El alumno no tiene recorrido asignado", "TRANSPORT_NOT_ENROLLED");
      }
    },
    () => ({ studentId }),
  );
}
