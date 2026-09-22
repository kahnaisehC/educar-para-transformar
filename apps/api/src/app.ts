import cors from "cors";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import jwt from "jsonwebtoken";
import {
  authenticate,
  isUserRole,
  isUserStatus,
  requireAuth,
  requireRoles,
} from "./auth.js";
import { createUser, listUsers, updateUser } from "./admin.service.js";
import type { DatabasePool } from "./db.js";
import { AppError, isAppError } from "./errors.js";
import {
  cancelEnrollment,
  enrollStudent,
  getStudentDashboard,
} from "./enrollment.service.js";
import { getChildSummary, listChildren } from "./parent.service.js";
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
        ? await updateStudentContact(options.pool, request.user!.id, input)
        : await updateTeacherContact(options.pool, request.user!.id, input);
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
      await cancelEnrollment(options.pool, request.user!.id, dashboard.student.id, groupId);
      response.json({ message: "Inscripción cancelada correctamente" });
    }),
  );

  app.post(
    "/api/student/transport",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      const routeId = positiveInteger(request.body?.routeId, "routeId");
      const enrollment = await enrollTransport(options.pool, request.user!.id, routeId);
      response.status(201).json({ enrollment });
    }),
  );

  app.delete(
    "/api/student/transport",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      await cancelTransport(options.pool, request.user!.id);
      response.json({ message: "Recorrido cancelado correctamente" });
    }),
  );

  app.post(
    "/api/student/cafeteria",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      await enrollCafeteria(options.pool, request.user!.id);
      response.status(201).json({ message: "Inscripción al comedor registrada correctamente" });
    }),
  );

  app.delete(
    "/api/student/cafeteria",
    requireRoles("student"),
    asyncRoute(async (request, response) => {
      await cancelCafeteria(options.pool, request.user!.id);
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
      const user = await createUser(options.pool, request.user!.id, input);
      response.status(201).json({ user });
    }),
  );

  app.patch(
    "/api/admin/users/:userId",
    requireRoles("admin"),
    asyncRoute(async (request, response) => {
      const userId = positiveInteger(request.params.userId, "userId");
      const input: { role?: ReturnType<typeof requiredRole>; status?: "active" | "inactive" } = {};
      if (request.body?.role !== undefined) {
        input.role = requiredRole(request.body.role);
      }
      if (request.body?.status !== undefined) {
        input.status = requiredStatus(request.body.status);
      }
      const user = await updateUser(options.pool, request.user!.id, userId, input);
      response.json({ user });
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
      const template = await createReportTemplate(options.pool, request.user!.id, input);
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
      const template = await updateReportTemplate(options.pool, request.user!.id, templateId, input);
      response.json({ template });
    }),
  );

  app.post(
    "/api/director/report-templates/:templateId/generate",
    requireRoles("director"),
    asyncRoute(async (request, response) => {
      const templateId = positiveInteger(request.params.templateId, "templateId");
      response.json({
        report: await generateReport(options.pool, request.user!.id, templateId),
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
