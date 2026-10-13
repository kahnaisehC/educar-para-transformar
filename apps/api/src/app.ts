import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import jwt from "jsonwebtoken";
import {
  authenticate,
  isUserRole,
  isUserStatus,
  requireAuth,
  requireRoles,
  type UserRole,
} from "./auth.js";
import {
  createUser,
  listUsers,
  updateUser,
  type UpdateUserInput,
} from "./admin.service.js";
import {
  createCourse,
  createCourseSubject,
  createLevel,
  createSchoolYear,
  createSubject,
  deleteCourse,
  deleteCourseSubject,
  deleteLevel,
  deleteSubject,
  getAcademicOverview,
  linkParent,
  unlinkParent,
  updateCourse,
  updateCourseSubject,
  updateLevel,
  updateMatricula,
  updateParent,
  updateSchoolYear,
  updateStudent,
  updateSubject,
  updateTeacher,
} from "./academic.service.js";
import {
  cancelSportEnrollmentAdmin,
  cancelTransportEnrollmentAdmin,
  createSport,
  createSportGroup,
  createTransportRoute,
  deleteSport,
  deleteSportGroup,
  deleteTransportRoute,
  getEnrollmentsOverview,
  getServicesOverview,
  updateCafeteriaEnrollment,
  updateSport,
  updateSportGroup,
  updateTransportRoute,
} from "./adminServices.service.js";
import type { DatabasePool } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import {
  cancelEnrollment,
  enrollStudent,
  getStudentDashboard,
} from "./enrollment.service.js";
import {
  enrollChild,
  getChildEnrollment,
  getChildSummary,
  listChildren,
} from "./parent.service.js";
import type { AppConfig } from "./config.js";
import {
  cancelCafeteria,
  cancelTransport,
  enrollCafeteria,
  enrollTransport,
  getStudentReport,
  updateStudentContact,
} from "./student.service.js";
import {
  getTeacherProfile,
  getTeacherReport,
  listCourseStudents,
  listTeacherCourses,
  updateTeacherContact,
} from "./teacher.service.js";
import {
  REPORT_ENTITIES,
  createReportTemplate,
  generateReport,
  getReportTemplate,
  listReportTemplates,
  updateReportTemplate,
} from "./report.service.js";

export interface CreateAppOptions {
  pool: DatabasePool;
  jwtSecret: string;
  corsOrigin?: string;
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function createApp(options: CreateAppOptions) {
  const app = express();
  const auth = requireAuth(options.pool, options.jwtSecret);

  app.disable("x-powered-by");
  app.use(cors({ origin: options.corsOrigin ?? "http://localhost:5173" }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", asyncRoute(async (_request, response) => {
    await options.pool.query("SELECT 1");
    response.json({ status: "ok" });
  }));

  app.post("/api/auth/login", asyncRoute(async (request, response) => {
    const username = requiredString(request.body?.username, "username");
    const password = requiredString(request.body?.password, "password");
    const result = await authenticate(options.pool, username, password, options.jwtSecret);
    response.json(result);
  }));

  app.use("/api", auth);

  app.get("/api/me", (request, response) => {
    response.json({ user: request.user });
  });

  app.get(
    "/api/student/dashboard",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      const dashboard = await getStudentDashboard(options.pool, request.user!.id);
      response.json(dashboard);
    }),
  );

  app.get(
    "/api/student/report",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      response.json({ report: await getStudentReport(options.pool, request.user!.id) });
    }),
  );

  app.patch(
    "/api/me/contact",
    requireRoles("student", "teacher"),
    asyncRoute(async (request, response) => {
      const input = {
        email: requiredEmail(request.body?.email),
        phone: requiredPhone(request.body?.phone),
      };
      const contact = request.user!.role === "student"
        ? await updateStudentContact(options.pool, request.user!.id, request.user!.role, input)
        : await updateTeacherContact(options.pool, request.user!.id, request.user!.role, input);
      response.json({ contact });
    }),
  );

  app.post(
    "/api/student/enrollments",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      const groupId = positiveInteger(request.body?.groupId, "groupId");
      const dashboard = await getStudentDashboard(options.pool, request.user!.id);
      const enrollment = await enrollStudent(
        options.pool,
        request.user!.id,
        request.user!.role,
        dashboard.student.id,
        groupId,
      );
      response.status(201).json({ enrollment });
    }),
  );

  app.delete(
    "/api/student/enrollments/:groupId",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      const groupId = positiveInteger(request.params.groupId, "groupId");
      const dashboard = await getStudentDashboard(options.pool, request.user!.id);
      await cancelEnrollment(options.pool, request.user!.id, request.user!.role, dashboard.student.id, groupId);
      response.json({ message: "Inscripción cancelada correctamente" });
    }),
  );

  app.post(
    "/api/student/transport",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      const routeId = positiveInteger(request.body?.routeId, "routeId");
      const enrollment = await enrollTransport(options.pool, request.user!.id, request.user!.role, routeId);
      response.status(201).json({ enrollment });
    }),
  );

  app.delete(
    "/api/student/transport",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      await cancelTransport(options.pool, request.user!.id, request.user!.role);
      response.json({ message: "Recorrido cancelado correctamente" });
    }),
  );

  app.post(
    "/api/student/cafeteria",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      await enrollCafeteria(options.pool, request.user!.id, request.user!.role);
      response.status(201).json({ message: "Inscripción al comedor registrada correctamente" });
    }),
  );

  app.delete(
    "/api/student/cafeteria",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      await cancelCafeteria(options.pool, request.user!.id, request.user!.role);
      response.json({ message: "Inscripción al comedor cancelada correctamente" });
    }),
  );

  app.get(
    "/api/parent/children",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      response.json({ children: await listChildren(options.pool, request.user!.id) });
    }),
  );

  app.get(
    "/api/parent/children/:studentId/summary",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const student = await getChildSummary(options.pool, request.user!.id, studentId);
      response.json({ student });
    }),
  );

  app.get(
    "/api/parent/children/:studentId/enrollment",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const enrollment = await getChildEnrollment(options.pool, request.user!.id, studentId);
      response.json({ enrollment });
    }),
  );

  app.post(
    "/api/parent/children/:studentId/enrollment",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const courseId = positiveInteger(request.body?.courseId, "courseId");
      const enrollment = await enrollChild(
        options.pool,
        request.user!.id,
        request.user!.role,
        studentId,
        courseId,
      );
      response.status(201).json({ enrollment });
    }),
  );

  app.get(
    "/api/admin/users",
    requireRoles("admin"),
    asyncRoute(async (_request, response) => {
      response.json({ users: await listUsers(options.pool) });
    }),
  );

  app.post(
    "/api/admin/users",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const input = {
        username: requiredString(request.body?.username, "username").toLowerCase(),
        displayName: requiredString(request.body?.displayName, "displayName"),
        password: requiredPassword(request.body?.password),
        role: requiredRole(request.body?.role),
        status: optionalStatus(request.body?.status),
      };
      const user = await createUser(options.pool, request.user!.id, request.user!.role, input);
      response.status(201).json({ user });
    }),
  );

  app.patch(
    "/api/admin/users/:userId",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const userId = positiveInteger(request.params.userId, "userId");
      const input: UpdateUserInput = {};
      if (request.body?.displayName !== undefined) {
        input.displayName = requiredString(request.body.displayName, "displayName");
      }
      if (request.body?.password !== undefined) {
        input.password = requiredPassword(request.body.password);
      }
      if (request.body?.role !== undefined) {
        input.role = requiredRole(request.body.role);
      }
      if (request.body?.status !== undefined) {
        input.status = requiredStatus(request.body.status);
      }
      const user = await updateUser(options.pool, request.user!.id, request.user!.role, userId, input);
      response.json({ user });
    }),
  );

  const admin = requireRoles("admin");

  app.get(
    "/api/admin/academic",
    admin,
    asyncRoute(async (_request, response) => {
      response.json(await getAcademicOverview(options.pool));
    }),
  );

  app.post(
    "/api/admin/levels",
    admin,
    asyncRoute(async (request, response) => {
      const level = await createLevel(options.pool, actor(request), requiredString(request.body?.name, "name"));
      response.status(201).json({ level });
    }),
  );

  app.patch(
    "/api/admin/levels/:levelId",
    admin,
    asyncRoute(async (request, response) => {
      const levelId = positiveInteger(request.params.levelId, "levelId");
      const level = await updateLevel(options.pool, actor(request), levelId, requiredString(request.body?.name, "name"));
      response.json({ level });
    }),
  );

  app.delete(
    "/api/admin/levels/:levelId",
    admin,
    asyncRoute(async (request, response) => {
      const levelId = positiveInteger(request.params.levelId, "levelId");
      await deleteLevel(options.pool, actor(request), levelId);
      response.json({ message: "Nivel eliminado correctamente" });
    }),
  );

  app.post(
    "/api/admin/courses",
    admin,
    asyncRoute(async (request, response) => {
      const levelId = positiveInteger(request.body?.levelId, "levelId");
      const name = requiredString(request.body?.name, "name");
      const course = await createCourse(options.pool, actor(request), levelId, name);
      response.status(201).json({ course });
    }),
  );

  app.patch(
    "/api/admin/courses/:courseId",
    admin,
    asyncRoute(async (request, response) => {
      const courseId = positiveInteger(request.params.courseId, "courseId");
      const input: { levelId?: number; name?: string } = {};
      if (request.body?.levelId !== undefined) {
        input.levelId = positiveInteger(request.body.levelId, "levelId");
      }
      if (request.body?.name !== undefined) {
        input.name = requiredString(request.body.name, "name");
      }
      const course = await updateCourse(options.pool, actor(request), courseId, input);
      response.json({ course });
    }),
  );

  app.delete(
    "/api/admin/courses/:courseId",
    admin,
    asyncRoute(async (request, response) => {
      const courseId = positiveInteger(request.params.courseId, "courseId");
      await deleteCourse(options.pool, actor(request), courseId);
      response.json({ message: "Curso eliminado correctamente" });
    }),
  );

  app.post(
    "/api/admin/subjects",
    admin,
    asyncRoute(async (request, response) => {
      const subject = await createSubject(options.pool, actor(request), requiredString(request.body?.name, "name"));
      response.status(201).json({ subject });
    }),
  );

  app.patch(
    "/api/admin/subjects/:subjectId",
    admin,
    asyncRoute(async (request, response) => {
      const subjectId = positiveInteger(request.params.subjectId, "subjectId");
      const subject = await updateSubject(options.pool, actor(request), subjectId, requiredString(request.body?.name, "name"));
      response.json({ subject });
    }),
  );

  app.delete(
    "/api/admin/subjects/:subjectId",
    admin,
    asyncRoute(async (request, response) => {
      const subjectId = positiveInteger(request.params.subjectId, "subjectId");
      await deleteSubject(options.pool, actor(request), subjectId);
      response.json({ message: "Materia eliminada correctamente" });
    }),
  );

  app.post(
    "/api/admin/course-subjects",
    admin,
    asyncRoute(async (request, response) => {
      const courseSubject = await createCourseSubject(options.pool, actor(request), {
        courseId: positiveInteger(request.body?.courseId, "courseId"),
        subjectId: positiveInteger(request.body?.subjectId, "subjectId"),
        teacherId: positiveInteger(request.body?.teacherId, "teacherId"),
        weekday: requiredWeekday(request.body?.weekday),
        startTime: requiredTime(request.body?.startTime, "startTime"),
        endTime: requiredTime(request.body?.endTime, "endTime"),
      });
      response.status(201).json({ courseSubject });
    }),
  );

  app.patch(
    "/api/admin/course-subjects/:courseSubjectId",
    admin,
    asyncRoute(async (request, response) => {
      const courseSubjectId = positiveInteger(request.params.courseSubjectId, "courseSubjectId");
      const input: Parameters<typeof updateCourseSubject>[3] = {};
      if (request.body?.courseId !== undefined) {
        input.courseId = positiveInteger(request.body.courseId, "courseId");
      }
      if (request.body?.subjectId !== undefined) {
        input.subjectId = positiveInteger(request.body.subjectId, "subjectId");
      }
      if (request.body?.teacherId !== undefined) {
        input.teacherId = positiveInteger(request.body.teacherId, "teacherId");
      }
      if (request.body?.weekday !== undefined) {
        input.weekday = requiredWeekday(request.body.weekday);
      }
      if (request.body?.startTime !== undefined) {
        input.startTime = requiredTime(request.body.startTime, "startTime");
      }
      if (request.body?.endTime !== undefined) {
        input.endTime = requiredTime(request.body.endTime, "endTime");
      }
      if (request.body?.active !== undefined) {
        input.active = requiredBoolean(request.body.active);
      }
      const courseSubject = await updateCourseSubject(options.pool, actor(request), courseSubjectId, input);
      response.json({ courseSubject });
    }),
  );

  app.delete(
    "/api/admin/course-subjects/:courseSubjectId",
    admin,
    asyncRoute(async (request, response) => {
      const courseSubjectId = positiveInteger(request.params.courseSubjectId, "courseSubjectId");
      await deleteCourseSubject(options.pool, actor(request), courseSubjectId);
      response.json({ message: "Asignación eliminada correctamente" });
    }),
  );

  app.post(
    "/api/admin/school-years",
    admin,
    asyncRoute(async (request, response) => {
      const year = positiveInteger(request.body?.year, "year");
      const schoolYear = await createSchoolYear(options.pool, actor(request), year);
      response.status(201).json({ schoolYear });
    }),
  );

  app.patch(
    "/api/admin/school-years/:schoolYearId",
    admin,
    asyncRoute(async (request, response) => {
      const schoolYearId = positiveInteger(request.params.schoolYearId, "schoolYearId");
      const active = requiredBoolean(request.body?.active);
      const schoolYear = await updateSchoolYear(options.pool, actor(request), schoolYearId, { active });
      response.json({ schoolYear });
    }),
  );

  app.patch(
    "/api/admin/students/:studentId",
    admin,
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const student = await updateStudent(options.pool, actor(request), studentId, {
        recordNumber: optionalString(request.body?.recordNumber, "recordNumber"),
        dni: optionalString(request.body?.dni, "dni"),
        fullName: optionalString(request.body?.fullName, "fullName"),
        birthDate: nullableDate(request.body?.birthDate, "birthDate"),
        address: optionalNullableString(request.body?.address, "address"),
        phone: nullablePhone(request.body?.phone),
        email: nullableEmail(request.body?.email),
        courseId: nullableId(request.body?.courseId, "courseId"),
        status: optionalUserStatus(request.body?.status),
      });
      response.json({ student });
    }),
  );

  app.post(
    "/api/admin/students/:studentId/parents",
    admin,
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const parentId = positiveInteger(request.body?.parentId, "parentId");
      await linkParent(options.pool, actor(request), studentId, parentId);
      response.status(201).json({ message: "Vínculo registrado correctamente" });
    }),
  );

  app.delete(
    "/api/admin/students/:studentId/parents/:parentId",
    admin,
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const parentId = positiveInteger(request.params.parentId, "parentId");
      await unlinkParent(options.pool, actor(request), studentId, parentId);
      response.json({ message: "Vínculo eliminado correctamente" });
    }),
  );

  app.patch(
    "/api/admin/teachers/:teacherId",
    admin,
    asyncRoute(async (request, response) => {
      const teacherId = positiveInteger(request.params.teacherId, "teacherId");
      const teacher = await updateTeacher(options.pool, actor(request), teacherId, {
        recordNumber: optionalNullableString(request.body?.recordNumber, "recordNumber"),
        dni: optionalNullableString(request.body?.dni, "dni"),
        fullName: optionalString(request.body?.fullName, "fullName"),
        specialty: optionalString(request.body?.specialty, "specialty"),
        email: nullableEmail(request.body?.email),
        phone: nullablePhone(request.body?.phone),
        status: optionalUserStatus(request.body?.status),
      });
      response.json({ teacher });
    }),
  );

  app.patch(
    "/api/admin/parents/:parentId",
    admin,
    asyncRoute(async (request, response) => {
      const parentId = positiveInteger(request.params.parentId, "parentId");
      const parent = await updateParent(
        options.pool,
        actor(request),
        parentId,
        requiredString(request.body?.fullName, "fullName"),
      );
      response.json({ parent });
    }),
  );

  app.get(
    "/api/admin/services",
    admin,
    asyncRoute(async (_request, response) => {
      response.json(await getServicesOverview(options.pool));
    }),
  );

  app.post(
    "/api/admin/sports",
    admin,
    asyncRoute(async (request, response) => {
      const sport = await createSport(options.pool, actor(request), requiredString(request.body?.name, "name"));
      response.status(201).json({ sport });
    }),
  );

  app.patch(
    "/api/admin/sports/:sportId",
    admin,
    asyncRoute(async (request, response) => {
      const sportId = positiveInteger(request.params.sportId, "sportId");
      const sport = await updateSport(options.pool, actor(request), sportId, requiredString(request.body?.name, "name"));
      response.json({ sport });
    }),
  );

  app.delete(
    "/api/admin/sports/:sportId",
    admin,
    asyncRoute(async (request, response) => {
      const sportId = positiveInteger(request.params.sportId, "sportId");
      await deleteSport(options.pool, actor(request), sportId);
      response.json({ message: "Deporte eliminado correctamente" });
    }),
  );

  app.post(
    "/api/admin/sport-groups",
    admin,
    asyncRoute(async (request, response) => {
      const sportGroup = await createSportGroup(options.pool, actor(request), {
        sportId: positiveInteger(request.body?.sportId, "sportId"),
        teacherId: positiveInteger(request.body?.teacherId, "teacherId"),
        levelId: nullableId(request.body?.levelId, "levelId") ?? null,
        weekday: requiredWeekday(request.body?.weekday),
        startTime: requiredTime(request.body?.startTime, "startTime"),
        endTime: requiredTime(request.body?.endTime, "endTime"),
      });
      response.status(201).json({ sportGroup });
    }),
  );

  app.patch(
    "/api/admin/sport-groups/:groupId",
    admin,
    asyncRoute(async (request, response) => {
      const groupId = positiveInteger(request.params.groupId, "groupId");
      const input: Parameters<typeof updateSportGroup>[3] = {};
      if (request.body?.sportId !== undefined) {
        input.sportId = positiveInteger(request.body.sportId, "sportId");
      }
      if (request.body?.teacherId !== undefined) {
        input.teacherId = positiveInteger(request.body.teacherId, "teacherId");
      }
      if (request.body?.levelId !== undefined) {
        input.levelId = nullableId(request.body.levelId, "levelId") ?? null;
      }
      if (request.body?.weekday !== undefined) {
        input.weekday = requiredWeekday(request.body.weekday);
      }
      if (request.body?.startTime !== undefined) {
        input.startTime = requiredTime(request.body.startTime, "startTime");
      }
      if (request.body?.endTime !== undefined) {
        input.endTime = requiredTime(request.body.endTime, "endTime");
      }
      if (request.body?.active !== undefined) {
        input.active = requiredBoolean(request.body.active);
      }
      const sportGroup = await updateSportGroup(options.pool, actor(request), groupId, input);
      response.json({ sportGroup });
    }),
  );

  app.delete(
    "/api/admin/sport-groups/:groupId",
    admin,
    asyncRoute(async (request, response) => {
      const groupId = positiveInteger(request.params.groupId, "groupId");
      await deleteSportGroup(options.pool, actor(request), groupId);
      response.json({ message: "Grupo deportivo eliminado correctamente" });
    }),
  );

  app.post(
    "/api/admin/transport-routes",
    admin,
    asyncRoute(async (request, response) => {
      const route = await createTransportRoute(
        options.pool,
        actor(request),
        requiredString(request.body?.name, "name"),
        requiredString(request.body?.description, "description"),
      );
      response.status(201).json({ route });
    }),
  );

  app.patch(
    "/api/admin/transport-routes/:routeId",
    admin,
    asyncRoute(async (request, response) => {
      const routeId = positiveInteger(request.params.routeId, "routeId");
      const input: { name?: string; description?: string; active?: boolean } = {};
      if (request.body?.name !== undefined) {
        input.name = requiredString(request.body.name, "name");
      }
      if (request.body?.description !== undefined) {
        input.description = requiredString(request.body.description, "description");
      }
      if (request.body?.active !== undefined) {
        input.active = requiredBoolean(request.body.active);
      }
      const route = await updateTransportRoute(options.pool, actor(request), routeId, input);
      response.json({ route });
    }),
  );

  app.delete(
    "/api/admin/transport-routes/:routeId",
    admin,
    asyncRoute(async (request, response) => {
      const routeId = positiveInteger(request.params.routeId, "routeId");
      await deleteTransportRoute(options.pool, actor(request), routeId);
      response.json({ message: "Recorrido eliminado correctamente" });
    }),
  );

  app.get(
    "/api/admin/enrollments",
    admin,
    asyncRoute(async (_request, response) => {
      response.json(await getEnrollmentsOverview(options.pool));
    }),
  );

  app.delete(
    "/api/admin/enrollments/sports/:enrollmentId",
    admin,
    asyncRoute(async (request, response) => {
      const enrollmentId = positiveInteger(request.params.enrollmentId, "enrollmentId");
      await cancelSportEnrollmentAdmin(options.pool, actor(request), enrollmentId);
      response.json({ message: "Inscripción deportiva cancelada correctamente" });
    }),
  );

  app.delete(
    "/api/admin/enrollments/transport/:studentId",
    admin,
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      await cancelTransportEnrollmentAdmin(options.pool, actor(request), studentId);
      response.json({ message: "Recorrido cancelado correctamente" });
    }),
  );

  app.patch(
    "/api/admin/enrollments/cafeteria/:studentId",
    admin,
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const active = requiredBoolean(request.body?.active);
      const enrollment = await updateCafeteriaEnrollment(options.pool, actor(request), studentId, active);
      response.json({ enrollment });
    }),
  );

  app.patch(
    "/api/admin/enrollments/matriculas/:matriculaId",
    admin,
    asyncRoute(async (request, response) => {
      const matriculaId = positiveInteger(request.params.matriculaId, "matriculaId");
      const status = requiredMatriculaStatus(request.body?.status);
      const matricula = await updateMatricula(options.pool, actor(request), matriculaId, status);
      response.json({ matricula });
    }),
  );

  app.get(
    "/api/teacher/profile",
    requireRoles("teacher"),
    asyncRoute(async (request, response) => {
      response.json({ profile: await getTeacherProfile(options.pool, request.user!.id) });
    }),
  );

  app.get(
    "/api/teacher/report",
    requireRoles("teacher"),
    asyncRoute(async (request, response) => {
      response.json({ report: await getTeacherReport(options.pool, request.user!.id) });
    }),
  );

  app.get(
    "/api/teacher/courses",
    requireRoles("teacher"),
    asyncRoute(async (request, response) => {
      response.json({ courses: await listTeacherCourses(options.pool, request.user!.id) });
    }),
  );

  app.get(
    "/api/teacher/courses/students",
    requireRoles("teacher"),
    asyncRoute(async (request, response) => {
      const subjectId = positiveInteger(request.query.subjectId, "subjectId");
      const level = requiredString(request.query.level, "level");
      const course = requiredString(request.query.course, "course");
      response.json({
        students: await listCourseStudents(options.pool, request.user!.id, subjectId, level, course),
      });
    }),
  );

  app.get(
    "/api/director/report-entities",
    requireRoles("director"),
    asyncRoute(async (_request, response) => {
      response.json({ entities: REPORT_ENTITIES });
    }),
  );

  app.get(
    "/api/director/report-templates",
    requireRoles("director"),
    asyncRoute(async (_request, response) => {
      response.json({ templates: await listReportTemplates(options.pool) });
    }),
  );

  app.post(
    "/api/director/report-templates",
    requireRoles("director"),
    asyncRoute(async (request, response) => {
      const input = {
        name: requiredString(request.body?.name, "name"),
        entity: requiredReportEntity(request.body?.entity),
        fields: request.body?.fields,
      };
      const template = await createReportTemplate(options.pool, request.user!.id, request.user!.role, input);
      response.status(201).json({ template });
    }),
  );

  app.patch(
    "/api/director/report-templates/:templateId",
    requireRoles("director"),
    asyncRoute(async (request, response) => {
      const templateId = positiveInteger(request.params.templateId, "templateId");
      const input: Record<string, unknown> = {};
      if (request.body?.name !== undefined) {
        input.name = requiredString(request.body.name, "name");
      }
      if (request.body?.entity !== undefined) {
        input.entity = requiredReportEntity(request.body.entity);
      }
      if (request.body?.fields !== undefined) {
        input.fields = request.body.fields;
      }
      if (request.body?.active !== undefined) {
        input.active = requiredBoolean(request.body.active);
      }
      const template = await updateReportTemplate(options.pool, request.user!.id, request.user!.role, templateId, input);
      response.json({ template });
    }),
  );

  app.post(
    "/api/director/report-templates/:templateId/generate",
    requireRoles("director"),
    asyncRoute(async (request, response) => {
      const templateId = positiveInteger(request.params.templateId, "templateId");
      response.json({
        report: await generateReport(options.pool, request.user!.id, request.user!.role, templateId),
      });
    }),
  );

  app.use((_request, _response, next) => {
    next(new AppError(404, "Ruta inexistente", "NOT_FOUND"));
  });
  app.use(errorHandler);

  return app;
}

export function createAppFromConfig(pool: DatabasePool, config: AppConfig) {
  return createApp({
    pool,
    jwtSecret: config.jwtSecret,
    corsOrigin: config.corsOrigin,
  });
}

function asyncRoute(handler: AsyncHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (isAppError(error)) {
    response.status(error.statusCode).json({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
    response.status(401).json({ error: "La sesión no es válida", code: "INVALID_TOKEN" });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "Ocurrió un error interno", code: "INTERNAL_ERROR" });
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, `El campo ${field} es obligatorio`, "VALIDATION_ERROR");
  }
  return value.trim();
}

function requiredPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new AppError(400, "La contraseña debe tener al menos 8 caracteres", "VALIDATION_ERROR");
  }
  return value;
}

function requiredEmail(value: unknown): string {
  const email = requiredString(value, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "El correo electrónico no tiene un formato válido", "INVALID_EMAIL");
  }
  return email;
}

function requiredPhone(value: unknown): string {
  const phone = requiredString(value, "phone");
  if (!/^[0-9+()\s-]{7,40}$/.test(phone)) {
    throw new AppError(400, "El teléfono no tiene un formato válido", "INVALID_PHONE");
  }
  return phone;
}

function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `El campo ${field} debe ser un entero positivo`, "VALIDATION_ERROR");
  }
  return parsed;
}

function requiredRole(value: unknown) {
  if (!isUserRole(value)) {
    throw new AppError(400, "El rol indicado no es válido", "VALIDATION_ERROR");
  }
  return value;
}

function requiredStatus(value: unknown): "active" | "inactive" {
  if (!isUserStatus(value)) {
    throw new AppError(400, "El estado indicado no es válido", "VALIDATION_ERROR");
  }
  return value;
}

function optionalStatus(value: unknown): "active" | "inactive" {
  return value === undefined ? "active" : requiredStatus(value);
}

const REPORT_ENTITY_KEYS = new Set(REPORT_ENTITIES.map((entity) => entity.key));

function requiredReportEntity(value: unknown) {
  if (typeof value !== "string" || !REPORT_ENTITY_KEYS.has(value as never)) {
    throw new AppError(400, "La entidad indicada no es válida", "VALIDATION_ERROR");
  }
  return value as (typeof REPORT_ENTITIES)[number]["key"];
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new AppError(400, "El campo activo debe ser un valor booleano", "VALIDATION_ERROR");
  }
  return value;
}

function actor(request: Request): { userId: number; role: UserRole } {
  return { userId: request.user!.id, role: request.user!.role };
}

function optionalString(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, field);
}

function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : requiredString(value, field);
}

function optionalUserStatus(value: unknown): "active" | "inactive" | undefined {
  return value === undefined ? undefined : requiredStatus(value);
}

function nullableEmail(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : requiredEmail(value);
}

function nullablePhone(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : requiredPhone(value);
}

function nullableId(value: unknown, field: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : positiveInteger(value, field);
}

function nullableDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const date = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, `El campo ${field} debe tener el formato AAAA-MM-DD`, "VALIDATION_ERROR");
  }
  return date;
}

function requiredWeekday(value: unknown): number {
  const weekday = positiveInteger(value, "weekday");
  if (weekday > 7) {
    throw new AppError(400, "El día debe estar entre 1 y 7", "VALIDATION_ERROR");
  }
  return weekday;
}

function requiredTime(value: unknown, field: string): string {
  const time = requiredString(value, field);
  const match = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(time);
  if (!match) {
    throw new AppError(400, `El campo ${field} debe tener el formato HH:MM`, "VALIDATION_ERROR");
  }
  return time.slice(0, 5);
}

function requiredMatriculaStatus(value: unknown): "enrolled" | "cancelled" {
  if (value !== "enrolled" && value !== "cancelled") {
    throw new AppError(400, "El estado de la matrícula no es válido", "VALIDATION_ERROR");
  }
  return value;
}
