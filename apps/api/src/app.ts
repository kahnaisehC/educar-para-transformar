import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
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
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service.js";
import {
  approveReceipt,
  createPaymentReceipt,
  createTariff,
  generateInvoices,
  getChildBillingSummary,
  getInvoice,
  getInvoiceForParent,
  getReceiptFileInfo,
  listChildInvoices,
  listInvoices,
  listReceipts,
  listTariffs,
  rejectReceipt,
  updateTariff,
  type TariffInput,
} from "./billing.service.js";
import {
  getDelinquencyReport,
  getIncomeReport,
  getPaymentsReport,
  getServicesReport,
} from "./billingReports.service.js";
import { sendDebtNotices, sendMonthlyReminders } from "./billingNotifications.service.js";
import { buildInvoicePdf } from "./invoicePdf.service.js";
import { configureMail } from "./mail.service.js";
import { changePassword, requestPasswordReset, resetPassword } from "./password.service.js";
import type { BankDetails, SmtpConfig } from "./config.js";
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
  deleteReportTemplate,
  generateReport,
  getReportFilterOptions,
  listReportTemplates,
  updateReportTemplate,
  type ReportFilters,
} from "./report.service.js";

export interface CreateAppOptions {
  pool: DatabasePool;
  jwtSecret: string;
  corsOrigin?: string;
  uploadsDir?: string;
  appUrl?: string;
  bank?: BankDetails;
  smtp?: SmtpConfig;
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

const DEFAULT_BANK: BankDetails = {
  alias: "EDUCAR.CUOTAS",
  cbu: "0000003100010000000001",
  holder: "Centro Educativo Educar para Transformar",
};

const DEFAULT_SMTP: SmtpConfig = {
  host: null,
  port: 587,
  secure: false,
  user: null,
  password: null,
  from: "EDUCAR PARA TRANSFORMAR <no-reply@educar.local>",
};

const ALLOWED_RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

export function createApp(options: CreateAppOptions) {
  const app = express();
  const auth = requireAuth(options.pool, options.jwtSecret);
  const uploadsDir = options.uploadsDir ?? "uploads";
  const bank = options.bank ?? DEFAULT_BANK;
  const appUrl = options.appUrl ?? "http://localhost:5173";
  const receiptsDir = resolve(uploadsDir, "receipts");
  mkdirSync(receiptsDir, { recursive: true });
  configureMail(options.smtp ?? DEFAULT_SMTP);

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => callback(null, receiptsDir),
      filename: (_request, file, callback) =>
        callback(
          null,
          `${Date.now()}-${randomBytes(8).toString("hex")}${extname(file.originalname).toLowerCase()}`,
        ),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
      if (!ALLOWED_RECEIPT_TYPES.has(file.mimetype)) {
        callback(new AppError(400, "El comprobante debe ser JPG, PNG o PDF", "INVALID_FILE_TYPE"));
        return;
      }
      callback(null, true);
    },
  });

  const uploadReceipt = (request: Request, response: Response, next: NextFunction) => {
    upload.single("file")(request, response, (error: unknown) => {
      if (error) {
        next(error instanceof AppError ? error : new AppError(400, "No se pudo subir el archivo", "UPLOAD_ERROR"));
        return;
      }
      next();
    });
  };

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

  app.post("/api/auth/forgot-password", asyncRoute(async (request, response) => {
    const identifier = requiredString(request.body?.username, "username");
    await requestPasswordReset(options.pool, identifier, appUrl);
    response.json({
      message: "Si la cuenta existe, enviamos un correo con las instrucciones.",
    });
  }));

  app.post("/api/auth/reset-password", asyncRoute(async (request, response) => {
    const token = requiredString(request.body?.token, "token");
    const newPassword = requiredPassword(request.body?.newPassword);
    await resetPassword(options.pool, token, newPassword);
    response.json({ message: "La contraseña fue actualizada correctamente" });
  }));

  app.use("/api", auth);

  app.get("/api/me", (request, response) => {
    response.json({ user: request.user });
  });

  app.patch(
    "/api/me/password",
    asyncRoute(async (request, response) => {
      await changePassword(
        options.pool,
        request.user!.id,
        requiredString(request.body?.currentPassword, "currentPassword"),
        requiredPassword(request.body?.newPassword),
      );
      response.json({ message: "La contraseña fue actualizada correctamente" });
    }),
  );

  app.get(
    "/api/notifications",
    asyncRoute(async (request, response) => {
      response.json(await listNotifications(options.pool, request.user!.id));
    }),
  );

  app.patch(
    "/api/notifications/:notificationId/read",
    asyncRoute(async (request, response) => {
      const notificationId = positiveInteger(request.params.notificationId, "notificationId");
      await markNotificationRead(options.pool, request.user!.id, notificationId);
      response.json({ message: "Notificación marcada como leída" });
    }),
  );

  app.patch(
    "/api/notifications/read-all",
    asyncRoute(async (request, response) => {
      await markAllNotificationsRead(options.pool, request.user!.id);
      response.json({ message: "Notificaciones marcadas como leídas" });
    }),
  );

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
    "/api/parent/billing/children/:studentId/summary",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const summary = await getChildBillingSummary(options.pool, request.user!.id, studentId);
      response.json({ summary });
    }),
  );

  app.get(
    "/api/parent/billing/children/:studentId/invoices",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const studentId = positiveInteger(request.params.studentId, "studentId");
      const from = optionalDate(request.query.from, "from");
      const to = optionalDate(request.query.to, "to");
      const invoices = await listChildInvoices(
        options.pool,
        request.user!.id,
        studentId,
        from,
        to,
      );
      response.json({ invoices });
    }),
  );

  app.get(
    "/api/parent/billing/invoices/:invoiceId",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const invoiceId = positiveInteger(request.params.invoiceId, "invoiceId");
      const invoice = await getInvoiceForParent(options.pool, request.user!.id, invoiceId);
      response.json({ invoice });
    }),
  );

  app.get(
    "/api/parent/billing/invoices/:invoiceId/pdf",
    requireRoles("parent"),
    asyncRoute(async (request, response) => {
      const invoiceId = positiveInteger(request.params.invoiceId, "invoiceId");
      const invoice = await getInvoiceForParent(options.pool, request.user!.id, invoiceId);
      const pdf = await buildInvoicePdf(invoice, bank);
      response
        .type("application/pdf")
        .set("Content-Disposition", `inline; filename="factura-${invoice.id}.pdf"`)
        .send(pdf);
    }),
  );

  app.post(
    "/api/parent/billing/invoices/:invoiceId/receipts",
    requireRoles("parent"),
    uploadReceipt,
    asyncRoute(async (request, response) => {
      const invoiceId = positiveInteger(request.params.invoiceId, "invoiceId");
      if (!request.file) {
        throw new AppError(400, "Debe adjuntar un comprobante", "FILE_REQUIRED");
      }
      const itemIds = parseItemIds(request.body?.itemIds);
      const receipt = await createPaymentReceipt(
        options.pool,
        actor(request),
        invoiceId,
        itemIds,
        {
          fileName: request.file.originalname,
          filePath: `receipts/${request.file.filename}`,
          mimeType: request.file.mimetype,
          sizeBytes: request.file.size,
        },
      );
      response.status(201).json({ receipt });
    }),
  );

  app.get(
    "/api/parent/billing/bank-details",
    requireRoles("parent"),
    asyncRoute(async (_request, response) => {
      response.json({ bank });
    }),
  );

  app.get(
    "/api/billing/receipts/:receiptId/file",
    requireRoles("parent", "admin", "director"),
    asyncRoute(async (request, response) => {
      const receiptId = positiveInteger(request.params.receiptId, "receiptId");
      const info = await getReceiptFileInfo(options.pool, receiptId);
      if (request.user!.role === "parent" && info.uploadedBy !== request.user!.id) {
        throw new AppError(403, "No puede acceder a ese comprobante", "FORBIDDEN");
      }
      response
        .type(info.mimeType)
        .set("Content-Disposition", `inline; filename="${info.fileName}"`)
        .sendFile(resolve(uploadsDir, info.filePath));
    }),
  );

  app.get(
    "/api/admin/billing/tariffs",
    admin,
    asyncRoute(async (_request, response) => {
      response.json({ tariffs: await listTariffs(options.pool) });
    }),
  );

  app.post(
    "/api/admin/billing/tariffs",
    admin,
    asyncRoute(async (request, response) => {
      const tariff = await createTariff(options.pool, actor(request), {
        kind: requiredTariffKind(request.body?.kind),
        sportId: nullableId(request.body?.sportId, "sportId") ?? null,
        transportRouteId: nullableId(request.body?.transportRouteId, "transportRouteId") ?? null,
        amount: requiredAmount(request.body?.amount),
        validFrom: optionalDate(request.body?.validFrom, "validFrom"),
      });
      response.status(201).json({ tariff });
    }),
  );

  app.patch(
    "/api/admin/billing/tariffs/:tariffId",
    admin,
    asyncRoute(async (request, response) => {
      const tariffId = positiveInteger(request.params.tariffId, "tariffId");
      const tariff = await updateTariff(options.pool, actor(request), tariffId, {
        amount: request.body?.amount === undefined ? undefined : requiredAmount(request.body.amount),
        validTo:
          request.body?.validTo === undefined
            ? undefined
            : request.body.validTo === null
              ? null
              : requiredDate(request.body.validTo, "validTo"),
      });
      response.json({ tariff });
    }),
  );

  app.post(
    "/api/admin/billing/invoices/generate",
    admin,
    asyncRoute(async (request, response) => {
      const { year, month } = requiredYearMonth(request.body);
      const result = await generateInvoices(options.pool, actor(request), {
        year,
        month,
        dueDate: optionalDate(request.body?.dueDate, "dueDate"),
      });
      response.status(201).json(result);
    }),
  );

  app.get(
    "/api/admin/billing/invoices",
    admin,
    asyncRoute(async (request, response) => {
      const invoices = await listInvoices(options.pool, {
        year: request.query.year === undefined ? undefined : positiveInteger(request.query.year, "year"),
        month: request.query.month === undefined ? undefined : positiveInteger(request.query.month, "month"),
        studentId:
          request.query.studentId === undefined
            ? undefined
            : positiveInteger(request.query.studentId, "studentId"),
      });
      response.json({ invoices });
    }),
  );

  app.get(
    "/api/admin/billing/invoices/:invoiceId",
    admin,
    asyncRoute(async (request, response) => {
      const invoiceId = positiveInteger(request.params.invoiceId, "invoiceId");
      response.json({ invoice: await getInvoice(options.pool, invoiceId) });
    }),
  );

  app.get(
    "/api/admin/billing/invoices/:invoiceId/pdf",
    admin,
    asyncRoute(async (request, response) => {
      const invoiceId = positiveInteger(request.params.invoiceId, "invoiceId");
      const invoice = await getInvoice(options.pool, invoiceId);
      const pdf = await buildInvoicePdf(invoice, bank);
      response
        .type("application/pdf")
        .set("Content-Disposition", `inline; filename="factura-${invoice.id}.pdf"`)
        .send(pdf);
    }),
  );

  app.get(
    "/api/admin/billing/receipts",
    admin,
    asyncRoute(async (request, response) => {
      const status = request.query.status;
      if (status !== undefined && status !== "pending" && status !== "approved" && status !== "rejected") {
        throw new AppError(400, "El estado del comprobante no es válido", "VALIDATION_ERROR");
      }
      response.json({ receipts: await listReceipts(options.pool, { status }) });
    }),
  );

  app.post(
    "/api/admin/billing/receipts/:receiptId/approve",
    admin,
    asyncRoute(async (request, response) => {
      const receiptId = positiveInteger(request.params.receiptId, "receiptId");
      response.json(await approveReceipt(options.pool, actor(request), receiptId));
    }),
  );

  app.post(
    "/api/admin/billing/receipts/:receiptId/reject",
    admin,
    asyncRoute(async (request, response) => {
      const receiptId = positiveInteger(request.params.receiptId, "receiptId");
      const reason = requiredString(request.body?.reason, "reason");
      response.json({ receipt: await rejectReceipt(options.pool, actor(request), receiptId, reason) });
    }),
  );

  app.get(
    "/api/admin/billing/reports/income",
    requireRoles("admin", "director"),
    asyncRoute(async (request, response) => {
      const from = requiredDate(request.query.from, "from");
      const to = requiredDate(request.query.to, "to");
      response.json({ report: await getIncomeReport(options.pool, from, to) });
    }),
  );

  app.get(
    "/api/admin/billing/reports/payments",
    requireRoles("admin", "director"),
    asyncRoute(async (request, response) => {
      const from = requiredDate(request.query.from, "from");
      const to = requiredDate(request.query.to, "to");
      response.json({ report: await getPaymentsReport(options.pool, from, to) });
    }),
  );

  app.get(
    "/api/admin/billing/reports/services",
    requireRoles("admin", "director"),
    asyncRoute(async (request, response) => {
      const from = requiredDate(request.query.from, "from");
      const to = requiredDate(request.query.to, "to");
      response.json({ report: await getServicesReport(options.pool, from, to) });
    }),
  );

  app.get(
    "/api/admin/billing/delinquency",
    requireRoles("admin", "director"),
    asyncRoute(async (request, response) => {
      const { year, month } = requiredYearMonth(request.query);
      response.json({ report: await getDelinquencyReport(options.pool, year, month) });
    }),
  );

  app.post(
    "/api/admin/billing/notifications/reminders",
    admin,
    asyncRoute(async (request, response) => {
      const { year, month } = requiredYearMonth(request.body);
      response.json({ result: await sendMonthlyReminders(options.pool, bank, year, month) });
    }),
  );

  app.post(
    "/api/admin/billing/notifications/debt",
    admin,
    asyncRoute(async (request, response) => {
      const { year, month } = requiredYearMonth(request.body);
      response.json({ result: await sendDebtNotices(options.pool, bank, year, month) });
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
    requireRoles("director", "admin"),
    asyncRoute(async (_request, response) => {
      response.json({ entities: REPORT_ENTITIES });
    }),
  );

  app.get(
    "/api/director/report-filters",
    requireRoles("director", "admin"),
    asyncRoute(async (_request, response) => {
      response.json({ filters: await getReportFilterOptions(options.pool) });
    }),
  );

  app.get(
    "/api/director/report-templates",
    requireRoles("director", "admin"),
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
    requireRoles("director", "admin"),
    asyncRoute(async (request, response) => {
      const templateId = positiveInteger(request.params.templateId, "templateId");
      const filters = parseReportFilters(request.body?.filters);
      response.json({
        report: await generateReport(
          options.pool,
          request.user!.id,
          request.user!.role,
          templateId,
          filters,
        ),
      });
    }),
  );

  app.delete(
    "/api/director/report-templates/:templateId",
    requireRoles("director"),
    asyncRoute(async (request, response) => {
      const templateId = positiveInteger(request.params.templateId, "templateId");
      await deleteReportTemplate(options.pool, request.user!.id, request.user!.role, templateId);
      response.json({ message: "Plantilla eliminada correctamente" });
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
    uploadsDir: config.uploadsDir,
    appUrl: config.appUrl,
    bank: config.bank,
    smtp: config.smtp,
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

function requiredTariffKind(value: unknown): TariffInput["kind"] {
  if (value !== "monthly" && value !== "sport" && value !== "transport" && value !== "cafeteria") {
    throw new AppError(400, "El tipo de tarifa no es válido", "VALIDATION_ERROR");
  }
  return value;
}

function requiredAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(400, "El importe debe ser un número mayor o igual a cero", "VALIDATION_ERROR");
  }
  return Math.round(amount * 100) / 100;
}

function requiredDate(value: unknown, field: string): string {
  const date = requiredString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, `El campo ${field} debe tener el formato AAAA-MM-DD`, "VALIDATION_ERROR");
  }
  return date;
}

function optionalDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return requiredDate(value, field);
}

function requiredYearMonth(value: unknown): { year: number; month: number } {
  const input = (value ?? {}) as Record<string, unknown>;
  const year = positiveInteger(input.year, "year");
  const month = positiveInteger(input.month, "month");
  if (month < 1 || month > 12) {
    throw new AppError(400, "El mes debe estar entre 1 y 12", "VALIDATION_ERROR");
  }
  return { year, month };
}

function parseItemIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((entry) => positiveInteger(entry, "itemIds"));
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => positiveInteger(entry, "itemIds"));
      }
    } catch {
      // cae al error de validación
    }
  }
  throw new AppError(400, "Debe seleccionar al menos un ítem para pagar", "VALIDATION_ERROR");
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

const REPORT_FILTER_KEYS = [
  "levelId",
  "courseId",
  "subjectId",
  "sportId",
  "teacherId",
  "routeId",
  "weekday",
  "schoolYear",
] as const;

function parseReportFilters(value: unknown): ReportFilters {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object") {
    throw new AppError(400, "Los parámetros de consulta no son válidos", "VALIDATION_ERROR");
  }
  const input = value as Record<string, unknown>;
  const filters: ReportFilters = {};
  for (const key of REPORT_FILTER_KEYS) {
    const entry = input[key];
    if (entry === undefined || entry === null || entry === "") {
      continue;
    }
    filters[key] = key === "weekday"
      ? requiredWeekday(entry)
      : positiveInteger(entry, key);
  }
  return filters;
}
