import bcrypt from "bcryptjs";
import { newDb } from "pg-mem";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import type { DatabasePool } from "../db.js";
import { closeDatabasePool, getDatabasePool } from "../database.js";
import { RowIterator } from "../rowIterator.js";
import { withAuditProxy } from "../auditProxy.js";
import { AppError } from "../errors.js";

const schema = readFileSync(
  fileURLToPath(new URL("../../../../database/schema.sql", import.meta.url)),
  "utf8",
);
const JWT_SECRET = "test-secret-that-is-long-enough-for-the-suite";
const PASSWORD = "Educar2027!";

let pool: DatabasePool;
let app: ReturnType<typeof createApp>;
let uploadsDir: string;

beforeEach(async () => {
  const database = newDb({ autoCreateForeignKeyIndices: true });
  database.public.none(schema.replace(/^BEGIN;\s*/, "").replace(/\s*COMMIT;\s*$/, ""));
  const pg = database.adapters.createPg();
  pool = new pg.Pool() as unknown as DatabasePool;
  await insertFixtures(pool);
  uploadsDir = mkdtempSync(join(tmpdir(), "educar-uploads-"));
  app = createApp({
    pool,
    jwtSecret: JWT_SECRET,
    corsOrigin: "http://localhost:5173",
    uploadsDir,
    appUrl: "http://localhost:5173",
    bank: { alias: "EDUCAR.TEST", cbu: "0000003100010000000001", holder: "Centro Educativo" },
    smtp: {
      host: null,
      port: 587,
      secure: false,
      user: null,
      password: null,
      from: "EDUCAR <no-reply@educar.local>",
    },
  });
});

afterEach(async () => {
  if (pool) {
    await pool.end();
  }
  if (uploadsDir) {
    rmSync(uploadsDir, { recursive: true, force: true });
  }
});

describe("authentication and role access", () => {
  it("requires a token and denies a student the administrator API", async () => {
    const unauthenticated = await request(app).get("/api/admin/users");
    expect(unauthenticated.status).toBe(401);

    const studentToken = await loginAs("ana.alumna");
    const forbidden = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(forbidden.status).toBe(403);
  });

  it("authenticates active users with a password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "ana.alumna", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("student");
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("allows an administrator to create and deactivate a user", async () => {
    const adminToken = await loginAs("admin.demo");
    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        username: "nuevo.docente",
        displayName: "Nuevo Docente",
        password: PASSWORD,
        role: "teacher",
      });

    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe("teacher");

    const updated = await request(app)
      .patch(`/api/admin/users/${created.body.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "inactive" });
    expect(updated.status).toBe(200);
    expect(updated.body.user.status).toBe("inactive");
  });

  it("creates the initial profile required by a new student account", async () => {
    const adminToken = await loginAs("admin.demo");
    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        username: "nuevo.alumno",
        displayName: "Nuevo Alumno",
        password: PASSWORD,
        role: "student",
      });

    expect(created.status).toBe(201);
    const profile = await pool.query<{ full_name: string; course_id: number | null }>(
      "SELECT full_name, course_id FROM students WHERE user_id = $1",
      [created.body.user.id],
    );
    expect(profile.rows[0]).toMatchObject({
      full_name: "Nuevo Alumno",
      course_id: null,
    });
  });
});

describe("parent isolation", () => {
  it("lists only associated children and rejects another student's ID", async () => {
    const token = await loginAs("marta.madre");
    const children = await request(app)
      .get("/api/parent/children")
      .set("Authorization", `Bearer ${token}`);

    expect(children.status).toBe(200);
    expect(children.body.children.map((child: { id: number }) => child.id)).toEqual([1]);

    const unauthorizedSummary = await request(app)
      .get("/api/parent/children/2/summary")
      .set("Authorization", `Bearer ${token}`);
    expect(unauthorizedSummary.status).toBe(403);
    expect(unauthorizedSummary.body.code).toBe("CHILD_NOT_ASSOCIATED");
  });
});

describe("student enrollment rules", () => {
  it("rejects a third sport", async () => {
    const token = await loginAs("ana.alumna");
    expect((await enroll(token, 1)).status).toBe(201);
    expect((await enroll(token, 3)).status).toBe(201);

    const third = await enroll(token, 4);
    expect(third.status).toBe(409);
    expect(third.body.code).toBe("SPORT_LIMIT_REACHED");
  });

  it("rejects overlapping schedules", async () => {
    const token = await loginAs("ana.alumna");
    expect((await enroll(token, 1)).status).toBe(201);

    const overlap = await enroll(token, 2);
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe("SCHEDULE_CONFLICT");
  });

  it("rejects duplicate enrollment in the same group", async () => {
    const token = await loginAs("ana.alumna");
    expect((await enroll(token, 1)).status).toBe(201);

    const duplicate = await enroll(token, 1);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_ENROLLMENT");

    const audit = await pool.query<{ total: string }>(
      "SELECT COUNT(*)::TEXT AS total FROM audit_logs WHERE operation = 'enroll_sport'",
    );
    expect(Number(audit.rows[0].total)).toBe(2);
  });
});

describe("complete student module and Sprint 2 contact", () => {
  it("supports profile, contact, transport, cafeteria and student report", async () => {
    const token = await loginAs("ana.alumna");
    const dashboard = await request(app)
      .get("/api/student/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.student.email).toBe("ana@educar.local");
    expect(dashboard.body.transportRoutes).toHaveLength(4);

    const contact = await request(app)
      .patch("/api/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "ana.updated@educar.local", phone: "3624-999999" });
    expect(contact.status).toBe(200);

    const transport = await request(app)
      .post("/api/student/transport")
      .set("Authorization", `Bearer ${token}`)
      .send({ routeId: 1 });
    expect(transport.status).toBe(201);

    const cafeteria = await request(app)
      .post("/api/student/cafeteria")
      .set("Authorization", `Bearer ${token}`);
    expect(cafeteria.status).toBe(201);

    const report = await request(app)
      .get("/api/student/report")
      .set("Authorization", `Bearer ${token}`);
    expect(report.status).toBe(200);
    expect(report.body.report.profile.email).toBe("ana.updated@educar.local");
    expect(report.body.report.transport.name).toBe("Recorrido Norte");
    expect(report.body.report.cafeteria.active).toBe(true);
  });

  it("allows a teacher to update contact information", async () => {
    const token = await loginAs("laura.docente");
    const response = await request(app)
      .patch("/api/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "laura.updated@educar.local", phone: "3624-111999" });

    expect(response.status).toBe(200);
    expect(response.body.contact.email).toBe("laura.updated@educar.local");
  });
});

describe("HU-05 teacher course lists", () => {
  it("lists only courses assigned to the teacher", async () => {
    const token = await loginAs("laura.docente");
    const response = await request(app)
      .get("/api/teacher/courses")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    const courses = response.body.courses as Array<{ subject: string; level: string; course: string }>;
    expect(courses.length).toBeGreaterThan(0);
    expect(courses[0]).toMatchObject({ subject: "Matematica", level: "Primario", course: "5to A" });
  });

  it("returns the students of a course with access control and exports all required fields", async () => {
    const token = await loginAs("laura.docente");
    const coursesResponse = await request(app)
      .get("/api/teacher/courses")
      .set("Authorization", `Bearer ${token}`);
    const course = coursesResponse.body.courses[0] as { subjectId: number; level: string; course: string };

    const studentsResponse = await request(app)
      .get(`/api/teacher/courses/students?subjectId=${course.subjectId}&level=${encodeURIComponent(course.level)}&course=${encodeURIComponent(course.course)}`)
      .set("Authorization", `Bearer ${token}`);
    expect(studentsResponse.status).toBe(200);
    expect(studentsResponse.body.students.length).toBeGreaterThan(0);
    expect(studentsResponse.body.students[0]).toEqual(
      expect.objectContaining({
        fullName: expect.any(String),
        recordNumber: expect.any(String),
        dni: expect.any(String),
        subject: "Matematica",
        teacher: "Laura Docente",
      }),
    );
  });

  it("does not leak other courses and restricts the module by role", async () => {
    const token = await loginAs("laura.docente");
    const forbidden = await request(app)
      .get("/api/teacher/courses/students?subjectId=999&level=Primario&course=5to%20A")
      .set("Authorization", `Bearer ${token}`);
    expect(forbidden.status).toBe(200);
    expect(forbidden.body.students).toEqual([]);

    const studentToken = await loginAs("ana.alumna");
    const roleDenied = await request(app)
      .get("/api/teacher/courses")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(roleDenied.status).toBe(403);
  });
});

describe("HU-07 institutional report templates", () => {
  it("denies the report module to non-director roles", async () => {
    const teacherToken = await loginAs("laura.docente");
    const denied = await request(app)
      .get("/api/director/report-templates")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(denied.status).toBe(403);
  });

  it("validates that the template name and at least one field are required", async () => {
    const token = await loginAs("director.demo");

    const missingName = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "", entity: "students", fields: ["full_name"] });
    expect(missingName.status).toBe(400);

    const missingFields = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Listado de alumnos", entity: "students", fields: [] });
    expect(missingFields.status).toBe(400);
    expect(missingFields.body.code).toBe("VALIDATION_ERROR");
  });

  it("creates, updates, activates and generates an institutional report", async () => {
    const token = await loginAs("director.demo");

    const created = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Listado de alumnos", entity: "students", fields: ["full_name", "course"] });
    expect(created.status).toBe(201);
    expect(created.body.template.fields).toEqual(["full_name", "course"]);
    expect(created.body.template.active).toBe(true);

    const templateId = created.body.template.id as number;

    const generated = await request(app)
      .post(`/api/director/report-templates/${templateId}/generate`)
      .set("Authorization", `Bearer ${token}`);
    expect(generated.status).toBe(200);
    expect(generated.body.report.columns.map((column: { key: string }) => column.key)).toEqual(["full_name", "course"]);
    expect(generated.body.report.rows.length).toBeGreaterThan(0);
    expect(generated.body.report.rows[0]).toEqual(expect.objectContaining({ full_name: "Ana Alumna" }));

    const updated = await request(app)
      .patch(`/api/director/report-templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.template.active).toBe(false);

    const inactive = await request(app)
      .post(`/api/director/report-templates/${templateId}/generate`)
      .set("Authorization", `Bearer ${token}`);
    expect(inactive.status).toBe(409);
    expect(inactive.body.code).toBe("TEMPLATE_INACTIVE");
  });
});

describe("session and health", () => {
  it("exposes health publicly and requires a token for the session endpoint", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");

    const anonymous = await request(app).get("/api/me");
    expect(anonymous.status).toBe(401);

    const token = await loginAs("ana.alumna");
    const session = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`);
    expect(session.status).toBe(200);
    expect(session.body.user).toMatchObject({ username: "ana.alumna", role: "student" });
  });

  it("rejects invalid credentials and inactive accounts", async () => {
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ username: "ana.alumna", password: "incorrecta" });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe("INVALID_CREDENTIALS");

    const adminId = await userId("admin.demo");
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = $1", [adminId]);
    const inactive = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin.demo", password: PASSWORD });
    expect(inactive.status).toBe(401);
  });
});

describe("student cancellations and duplicates", () => {
  it("cancels a sport enrollment and reports missing ones", async () => {
    const token = await loginAs("ana.alumna");
    expect((await enroll(token, 1)).status).toBe(201);

    const cancelled = await request(app)
      .delete("/api/student/enrollments/1")
      .set("Authorization", `Bearer ${token}`);
    expect(cancelled.status).toBe(200);

    const missing = await request(app)
      .delete("/api/student/enrollments/1")
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("ENROLLMENT_NOT_FOUND");
  });

  it("blocks duplicate transport enrollment and allows cancellation", async () => {
    const token = await loginAs("ana.alumna");
    const first = await request(app)
      .post("/api/student/transport")
      .set("Authorization", `Bearer ${token}`)
      .send({ routeId: 1 });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/student/transport")
      .set("Authorization", `Bearer ${token}`)
      .send({ routeId: 2 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("TRANSPORT_ALREADY_ENROLLED");

    const cancelled = await request(app)
      .delete("/api/student/transport")
      .set("Authorization", `Bearer ${token}`);
    expect(cancelled.status).toBe(200);

    const missing = await request(app)
      .delete("/api/student/transport")
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("TRANSPORT_NOT_ENROLLED");
  });

  it("blocks duplicate cafeteria enrollment and allows cancellation", async () => {
    const token = await loginAs("ana.alumna");
    const first = await request(app)
      .post("/api/student/cafeteria")
      .set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/student/cafeteria")
      .set("Authorization", `Bearer ${token}`);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("CAFETERIA_ALREADY_ENROLLED");

    const cancelled = await request(app)
      .delete("/api/student/cafeteria")
      .set("Authorization", `Bearer ${token}`);
    expect(cancelled.status).toBe(200);

    const missing = await request(app)
      .delete("/api/student/cafeteria")
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("CAFETERIA_NOT_ENROLLED");
  });
});

describe("parent child summary", () => {
  it("returns the academic and sport summary of an associated child", async () => {
    const token = await loginAs("marta.madre");
    const response = await request(app)
      .get("/api/parent/children/1/summary")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.student).toMatchObject({
      fullName: "Ana Alumna",
      level: "Primario",
      course: "5to A",
    });
    expect(response.body.student.subjects).toEqual([
      { subject: "Matematica", teacher: "Laura Docente" },
    ]);
    expect(response.body.student.sports).toEqual([]);
  });
});

describe("admin user safeguards", () => {
  it("prevents self-deactivation and duplicate usernames", async () => {
    const token = await loginAs("admin.demo");
    const adminId = await userId("admin.demo");

    const selfDeactivation = await request(app)
      .patch(`/api/admin/users/${adminId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });
    expect(selfDeactivation.status).toBe(400);
    expect(selfDeactivation.body.code).toBe("SELF_DEACTIVATION");

    const duplicate = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        username: "ana.alumna",
        displayName: "Duplicada",
        password: PASSWORD,
        role: "student",
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("DUPLICATE_USERNAME");
  });
});

describe("academic model", () => {
  it("resolves student level and course from the normalized model", async () => {
    const token = await loginAs("ana.alumna");
    const dashboard = await request(app)
      .get("/api/student/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.student).toMatchObject({ level: "Primario", course: "5to A" });
  });

  it("generates cursado and matriculas reports", async () => {
    const token = await loginAs("director.demo");

    const entities = await request(app)
      .get("/api/director/report-entities")
      .set("Authorization", `Bearer ${token}`);
    const entityKeys = entities.body.entities.map((entry: { key: string }) => entry.key);
    expect(entityKeys).toContain("cursado");
    expect(entityKeys).toContain("matriculas");

    const cursado = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Cursado", entity: "cursado", fields: ["student_name", "subject", "schedule"] });
    expect(cursado.status).toBe(201);

    const generatedCursado = await request(app)
      .post(`/api/director/report-templates/${cursado.body.template.id}/generate`)
      .set("Authorization", `Bearer ${token}`);
    expect(generatedCursado.status).toBe(200);
    expect(generatedCursado.body.report.rows[0]).toMatchObject({
      student_name: "Ana Alumna",
      subject: "Matematica",
    });
    expect(generatedCursado.body.report.rows[0].schedule).toBe("08:00-09:00");

    const matriculas = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Matriculas", entity: "matriculas", fields: ["student_name", "year", "status"] });
    expect(matriculas.status).toBe(201);

    const generatedMatriculas = await request(app)
      .post(`/api/director/report-templates/${matriculas.body.template.id}/generate`)
      .set("Authorization", `Bearer ${token}`);
    expect(generatedMatriculas.status).toBe(200);
    expect(generatedMatriculas.body.report.rows).toHaveLength(2);
    expect(generatedMatriculas.body.report.rows[0]).toMatchObject({
      student_name: "Ana Alumna",
      year: "2026",
      status: "enrolled",
    });
  });
});

describe("parent yearly enrollment (RF-PA-02)", () => {
  it("shows the child enrollment and allows re-enrolling after cancellation", async () => {
    const token = await loginAs("marta.madre");
    const enrollment = await request(app)
      .get("/api/parent/children/1/enrollment")
      .set("Authorization", `Bearer ${token}`);

    expect(enrollment.status).toBe(200);
    expect(enrollment.body.enrollment.schoolYear.year).toBe(2026);
    expect(enrollment.body.enrollment.matricula).toMatchObject({
      level: "Primario",
      course: "5to A",
      status: "enrolled",
    });
    expect(enrollment.body.enrollment.courses).toHaveLength(1);
    expect(enrollment.body.enrollment.subjects[0]).toMatchObject({
      subject: "Matematica",
      startTime: "08:00",
      endTime: "09:00",
    });

    const adminToken = await loginAs("admin.demo");
    const overview = await request(app)
      .get("/api/admin/enrollments")
      .set("Authorization", `Bearer ${adminToken}`);
    const matriculaId = overview.body.matriculas.find(
      (entry: { studentId: number }) => entry.studentId === 1,
    ).id as number;
    await request(app)
      .patch(`/api/admin/enrollments/matriculas/${matriculaId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" });

    const again = await request(app)
      .post("/api/parent/children/1/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1 });
    expect(again.status).toBe(201);
    expect(again.body.enrollment.matricula.status).toBe("enrolled");

    const duplicate = await request(app)
      .post("/api/parent/children/1/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("ALREADY_ENROLLED");
  });

  it("rejects unassociated children and invalid courses", async () => {
    const token = await loginAs("marta.madre");

    const forbidden = await request(app)
      .post("/api/parent/children/2/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1 });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe("CHILD_NOT_ASSOCIATED");

    const invalidCourse = await request(app)
      .post("/api/parent/children/1/enrollment")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 999 });
    expect(invalidCourse.status).toBe(404);
    expect(invalidCourse.body.code).toBe("COURSE_NOT_FOUND");
  });
});

describe("teacher profile and report (RF-PR-01/03)", () => {
  it("returns the teacher profile with workload and contact data", async () => {
    const token = await loginAs("laura.docente");
    const response = await request(app)
      .get("/api/teacher/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.profile).toMatchObject({
      recordNumber: "PR-0001",
      fullName: "Laura Docente",
      specialty: "Deportes",
      email: "laura@educar.local",
    });
    expect(response.body.profile.subjects[0]).toMatchObject({
      subject: "Matematica",
      level: "Primario",
      course: "5to A",
      weekdayName: "Lunes",
      startTime: "08:00",
      endTime: "09:00",
    });
    expect(response.body.profile.sportGroups.length).toBeGreaterThan(0);
  });

  it("generates the teacher report and restricts it by role", async () => {
    const token = await loginAs("laura.docente");
    const response = await request(app)
      .get("/api/teacher/report")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.report.teacher.fullName).toBe("Laura Docente");
    expect(response.body.report.generatedAt).toEqual(expect.any(String));
    expect(response.body.report.courses[0]).toMatchObject({ level: "Primario", course: "5to A", studentCount: 2 });
    expect(response.body.report.courses[0].subjects[0]).toMatchObject({
      subject: "Matematica",
      weekdayName: "Lunes",
      startTime: "08:00",
      endTime: "09:00",
    });
    expect(response.body.report.sports.length).toBeGreaterThan(0);

    const studentToken = await loginAs("ana.alumna");
    const denied = await request(app)
      .get("/api/teacher/report")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(denied.status).toBe(403);
  });
});

describe("admin academic and services management", () => {
  it("manages levels, courses, subjects, offerings and school years", async () => {
    const token = await loginAs("admin.demo");

    const overview = await request(app)
      .get("/api/admin/academic")
      .set("Authorization", `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.levels.length).toBeGreaterThan(0);
    expect(overview.body.courses[0]).toMatchObject({ level: "Primario", name: "5to A" });

    const level = await request(app)
      .post("/api/admin/levels")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Terciario" });
    expect(level.status).toBe(201);

    const course = await request(app)
      .post("/api/admin/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ levelId: level.body.level.id, name: "1ro" });
    expect(course.status).toBe(201);

    const subject = await request(app)
      .post("/api/admin/subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Programacion" });
    expect(subject.status).toBe(201);

    const offering = await request(app)
      .post("/api/admin/course-subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({
        courseId: course.body.course.id,
        subjectId: subject.body.subject.id,
        teacherId: 1,
        weekday: 2,
        startTime: "09:00",
        endTime: "10:00",
      });
    expect(offering.status).toBe(201);
    expect(offering.body.courseSubject).toMatchObject({
      weekdayName: "Martes",
      startTime: "09:00",
      endTime: "10:00",
    });

    const levelInUse = await request(app)
      .delete(`/api/admin/levels/${level.body.level.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(levelInUse.status).toBe(409);
    expect(levelInUse.body.code).toBe("LEVEL_IN_USE");

    const deletedOffering = await request(app)
      .delete(`/api/admin/course-subjects/${offering.body.courseSubject.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deletedOffering.status).toBe(200);

    const renamedSubject = await request(app)
      .patch(`/api/admin/subjects/${subject.body.subject.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Programacion II" });
    expect(renamedSubject.status).toBe(200);
    expect(renamedSubject.body.subject.name).toBe("Programacion II");

    const year = await request(app)
      .post("/api/admin/school-years")
      .set("Authorization", `Bearer ${token}`)
      .send({ year: 2027 });
    expect(year.status).toBe(201);

    const activated = await request(app)
      .patch(`/api/admin/school-years/${year.body.schoolYear.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: true });
    expect(activated.status).toBe(200);
    expect(activated.body.schoolYear.active).toBe(true);

    const refreshed = await request(app)
      .get("/api/admin/academic")
      .set("Authorization", `Bearer ${token}`);
    expect(
      refreshed.body.schoolYears.filter((entry: { active: boolean }) => entry.active),
    ).toHaveLength(1);

    const studentToken = await loginAs("ana.alumna");
    const forbidden = await request(app)
      .get("/api/admin/academic")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(forbidden.status).toBe(403);
  });

  it("blocks overlapping schedules inside a course and allows adjacent slots", async () => {
    const token = await loginAs("admin.demo");

    const subject = await request(app)
      .post("/api/admin/subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Lengua" });
    const subjectId = subject.body.subject.id as number;

    const first = await request(app)
      .post("/api/admin/course-subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1, subjectId: 1, teacherId: 1, weekday: 3, startTime: "08:00", endTime: "10:00" });
    expect(first.status).toBe(201);

    const conflict = await request(app)
      .post("/api/admin/course-subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1, subjectId, teacherId: 1, weekday: 3, startTime: "09:00", endTime: "11:00" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("SCHEDULE_CONFLICT");

    const adjacent = await request(app)
      .post("/api/admin/course-subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1, subjectId, teacherId: 1, weekday: 3, startTime: "10:00", endTime: "11:00" });
    expect(adjacent.status).toBe(201);

    const moved = await request(app)
      .patch(`/api/admin/course-subjects/${adjacent.body.courseSubject.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startTime: "09:30", endTime: "10:30" });
    expect(moved.status).toBe(409);
    expect(moved.body.code).toBe("SCHEDULE_CONFLICT");
  });

  it("updates student and teacher profiles and links parents", async () => {
    const token = await loginAs("admin.demo");

    const student = await request(app)
      .patch("/api/admin/students/2")
      .set("Authorization", `Bearer ${token}`)
      .send({ courseId: 1, phone: "3624-555555", birthDate: "2011-09-01" });
    expect(student.status).toBe(200);
    expect(student.body.student).toMatchObject({ courseId: 1, level: "Primario", course: "5to A" });

    const teacher = await request(app)
      .patch("/api/admin/teachers/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ specialty: "Matematica", phone: "3624-777777" });
    expect(teacher.status).toBe(200);
    expect(teacher.body.teacher.specialty).toBe("Matematica");

    const parent = await request(app)
      .patch("/api/admin/parents/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ fullName: "Marta M. Madre" });
    expect(parent.status).toBe(200);
    expect(parent.body.parent.fullName).toBe("Marta M. Madre");

    const link = await request(app)
      .post("/api/admin/students/2/parents")
      .set("Authorization", `Bearer ${token}`)
      .send({ parentId: 1 });
    expect(link.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/admin/students/2/parents")
      .set("Authorization", `Bearer ${token}`)
      .send({ parentId: 1 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("ALREADY_LINKED");

    const unlink = await request(app)
      .delete("/api/admin/students/2/parents/1")
      .set("Authorization", `Bearer ${token}`);
    expect(unlink.status).toBe(200);
  });

  it("manages sports, groups and keeps exactly four transport routes", async () => {
    const token = await loginAs("admin.demo");

    const services = await request(app)
      .get("/api/admin/services")
      .set("Authorization", `Bearer ${token}`);
    expect(services.status).toBe(200);
    expect(services.body.sports).toHaveLength(4);
    expect(services.body.transportRoutes).toHaveLength(4);

    const fifthRoute = await request(app)
      .post("/api/admin/transport-routes")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Recorrido Quinto", description: "No permitido" });
    expect(fifthRoute.status).toBe(409);
    expect(fifthRoute.body.code).toBe("ROUTE_LIMIT_REACHED");

    const routeId = services.body.transportRoutes[0].id as number;
    const deactivated = await request(app)
      .patch(`/api/admin/transport-routes/${routeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.route.active).toBe(false);

    const deleteRoute = await request(app)
      .delete(`/api/admin/transport-routes/${routeId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRoute.status).toBe(409);
    expect(deleteRoute.body.code).toBe("ROUTE_MINIMUM_REQUIRED");

    const sport = await request(app)
      .post("/api/admin/sports")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Handball" });
    expect(sport.status).toBe(201);

    const group = await request(app)
      .post("/api/admin/sport-groups")
      .set("Authorization", `Bearer ${token}`)
      .send({
        sportId: sport.body.sport.id,
        teacherId: 1,
        levelId: null,
        weekday: 5,
        startTime: "18:00",
        endTime: "19:00",
      });
    expect(group.status).toBe(201);
    expect(group.body.sportGroup).toMatchObject({ level: "Todos", weekdayName: "Viernes" });

    const sportInUse = await request(app)
      .delete(`/api/admin/sports/${sport.body.sport.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(sportInUse.status).toBe(409);

    const deleteGroup = await request(app)
      .delete(`/api/admin/sport-groups/${group.body.sportGroup.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteGroup.status).toBe(200);

    const deleteSport = await request(app)
      .delete(`/api/admin/sports/${sport.body.sport.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteSport.status).toBe(200);
  });

  it("administers enrollments across every service", async () => {
    const studentToken = await loginAs("ana.alumna");
    await request(app)
      .post("/api/student/enrollments")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ groupId: 1 });
    await request(app)
      .post("/api/student/transport")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ routeId: 1 });
    await request(app)
      .post("/api/student/cafeteria")
      .set("Authorization", `Bearer ${studentToken}`);

    const token = await loginAs("admin.demo");
    const overview = await request(app)
      .get("/api/admin/enrollments")
      .set("Authorization", `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.sportEnrollments).toHaveLength(1);
    expect(overview.body.transportEnrollments).toHaveLength(1);
    expect(overview.body.cafeteria).toHaveLength(1);
    expect(overview.body.matriculas).toHaveLength(2);

    const cancelledSport = await request(app)
      .delete(`/api/admin/enrollments/sports/${overview.body.sportEnrollments[0].id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(cancelledSport.status).toBe(200);

    const cancelledTransport = await request(app)
      .delete("/api/admin/enrollments/transport/1")
      .set("Authorization", `Bearer ${token}`);
    expect(cancelledTransport.status).toBe(200);

    const cafeteria = await request(app)
      .patch("/api/admin/enrollments/cafeteria/1")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(cafeteria.status).toBe(200);
    expect(cafeteria.body.enrollment.active).toBe(false);

    const matriculaId = overview.body.matriculas[0].id as number;
    const cancelledMatricula = await request(app)
      .patch(`/api/admin/enrollments/matriculas/${matriculaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "cancelled" });
    expect(cancelledMatricula.status).toBe(200);
    expect(cancelledMatricula.body.matricula.status).toBe("cancelled");
  });

  it("renames users, resets passwords and creates profiles on role change", async () => {
    const token = await loginAs("admin.demo");

    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        username: "nueva.docente",
        displayName: "Nueva Docente",
        password: PASSWORD,
        role: "teacher",
      });
    expect(created.status).toBe(201);
    const userId = created.body.user.id as number;

    const renamed = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Docente Renombrada" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.user.displayName).toBe("Docente Renombrada");

    const changed = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "student" });
    expect(changed.status).toBe(200);
    expect(changed.body.user.role).toBe("student");

    const profile = await pool.query("SELECT 1 FROM students WHERE user_id = $1", [userId]);
    expect(profile.rowCount).toBe(1);

    const reset = await request(app)
      .patch(`/api/admin/users/${userId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "NuevaClave2027!" });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "nueva.docente", password: "NuevaClave2027!" });
    expect(login.status).toBe(200);
  });
});

describe("report parameters and access (RF-DI-02/03, RF-AD-04)", () => {
  it("applies query parameters when generating reports", async () => {
    const token = await loginAs("director.demo");
    const created = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Alumnos por nivel", entity: "students", fields: ["full_name", "level", "course"] });
    const templateId = created.body.template.id as number;

    const unfiltered = await request(app)
      .post(`/api/director/report-templates/${templateId}/generate`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(unfiltered.status).toBe(200);
    expect(unfiltered.body.report.rows).toHaveLength(2);

    const filtered = await request(app)
      .post(`/api/director/report-templates/${templateId}/generate`)
      .set("Authorization", `Bearer ${token}`)
      .send({ filters: { levelId: 1, courseId: 1 } });
    expect(filtered.status).toBe(200);
    expect(filtered.body.report.rows).toHaveLength(2);

    const empty = await request(app)
      .post(`/api/director/report-templates/${templateId}/generate`)
      .set("Authorization", `Bearer ${token}`)
      .send({ filters: { levelId: 99 } });
    expect(empty.status).toBe(200);
    expect(empty.body.report.rows).toHaveLength(0);
  });

  it("returns filter options and lets the admin consult reports", async () => {
    const directorToken = await loginAs("director.demo");
    const created = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${directorToken}`)
      .send({ name: "Matriculas", entity: "matriculas", fields: ["student_name", "year"] });

    const options = await request(app)
      .get("/api/director/report-filters")
      .set("Authorization", `Bearer ${directorToken}`);
    expect(options.status).toBe(200);
    expect(options.body.filters.levels.length).toBeGreaterThan(0);
    expect(options.body.filters.schoolYears[0].year).toBe(2026);

    const adminToken = await loginAs("admin.demo");
    const list = await request(app)
      .get("/api/director/report-templates")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);

    const generated = await request(app)
      .post(`/api/director/report-templates/${created.body.template.id}/generate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(generated.status).toBe(200);
    expect(generated.body.report.rows).toHaveLength(2);

    const adminCantCreate = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "No permitido", entity: "students", fields: ["full_name"] });
    expect(adminCantCreate.status).toBe(403);
  });

  it("deletes templates", async () => {
    const token = await loginAs("director.demo");
    const created = await request(app)
      .post("/api/director/report-templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Para eliminar", entity: "teachers", fields: ["full_name"] });
    const templateId = created.body.template.id as number;

    const deleted = await request(app)
      .delete(`/api/director/report-templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleted.status).toBe(200);

    const missing = await request(app)
      .delete(`/api/director/report-templates/${templateId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("TEMPLATE_NOT_FOUND");
  });
});

describe("notifications panel", () => {
  it("records confirmations and rejections, then marks them as read", async () => {
    const token = await loginAs("ana.alumna");
    const empty = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body.unreadCount).toBe(0);

    expect((await enroll(token, 1)).status).toBe(201);
    expect((await enroll(token, 2)).status).toBe(409);

    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBeGreaterThanOrEqual(2);
    const types = list.body.notifications.map((entry: { type: string }) => entry.type);
    expect(types).toContain("enrollment_confirmed");
    expect(types).toContain("enrollment_rejected");

    const firstId = list.body.notifications[0].id as number;
    const marked = await request(app)
      .patch(`/api/notifications/${firstId}/read`)
      .set("Authorization", `Bearer ${token}`);
    expect(marked.status).toBe(200);

    const afterOne = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(afterOne.body.unreadCount).toBe(list.body.unreadCount - 1);

    await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);
    const final = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);
    expect(final.body.unreadCount).toBe(0);

    const missing = await request(app)
      .patch("/api/notifications/999999/read")
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("NOTIFICATION_NOT_FOUND");
  });

  it("notifies a user when the administrator updates the account", async () => {
    const adminToken = await loginAs("admin.demo");
    const created = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        username: "avisado.alumno",
        displayName: "Avisado Alumno",
        password: PASSWORD,
        role: "student",
      });
    expect(created.status).toBe(201);

    await request(app)
      .patch(`/api/admin/users/${created.body.user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ displayName: "Avisado Actualizado" });

    const targetToken = await loginAs("avisado.alumno");
    const list = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${targetToken}`);
    expect(list.status).toBe(200);
    expect(list.body.notifications[0]).toMatchObject({
      type: "account_updated",
      title: "Tu cuenta fue actualizada",
    });
  });
});

describe("billing module (Parte 3)", () => {
  it("creates tariffs and generates one invoice per student and period", async () => {
    const adminToken = await loginAs("admin.demo");
    await createBillingTariffs(adminToken);

    const anaToken = await loginAs("ana.alumna");
    expect(
      (
        await request(app)
          .post("/api/student/enrollments")
          .set("Authorization", `Bearer ${anaToken}`)
          .send({ groupId: 1 })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post("/api/student/transport")
          .set("Authorization", `Bearer ${anaToken}`)
          .send({ routeId: 1 })
      ).status,
    ).toBe(201);

    const brunoToken = await loginAs("bruno.alumno");
    expect(
      (
        await request(app)
          .post("/api/student/enrollments")
          .set("Authorization", `Bearer ${brunoToken}`)
          .send({ groupId: 3 })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post("/api/student/cafeteria")
          .set("Authorization", `Bearer ${brunoToken}`)
      ).status,
    ).toBe(201);

    const generated = await request(app)
      .post("/api/admin/billing/invoices/generate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 10 });
    expect(generated.status).toBe(201);
    expect(generated.body).toMatchObject({ created: 2, skipped: 0 });

    const anaInvoice = generated.body.invoices.find(
      (invoice: { studentId: number }) => invoice.studentId === 1,
    );
    expect(anaInvoice.totalAmount).toBe(70000);
    expect(anaInvoice.items.map((item: { description: string }) => item.description)).toEqual([
      "Cuota mensual 2026-10",
      "Futbol",
      "Transporte · Recorrido Norte",
    ]);

    const again = await request(app)
      .post("/api/admin/billing/invoices/generate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 10 });
    expect(again.status).toBe(201);
    expect(again.body).toMatchObject({ created: 0, skipped: 2 });

    const list = await request(app)
      .get("/api/admin/billing/invoices?year=2026&month=10")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.invoices).toHaveLength(2);

    const forbidden = await request(app)
      .get("/api/admin/billing/tariffs")
      .set("Authorization", `Bearer ${anaToken}`);
    expect(forbidden.status).toBe(403);
  });

  it("lets the parent consult only their children's invoices and PDF", async () => {
    const context = await prepareBilling();
    const parentToken = await loginAs("marta.madre");

    const summary = await request(app)
      .get("/api/parent/billing/children/1/summary")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.summary.totalPending).toBe(70000);
    expect(summary.body.summary.currentInvoice.periodMonth).toBe(10);

    const forbidden = await request(app)
      .get("/api/parent/billing/children/2/summary")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe("CHILD_NOT_ASSOCIATED");

    const pdf = await request(app)
      .get(`/api/parent/billing/invoices/${context.anaInvoiceId}/pdf`)
      .set("Authorization", `Bearer ${parentToken}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");

    const bank = await request(app)
      .get("/api/parent/billing/bank-details")
      .set("Authorization", `Bearer ${parentToken}`);
    expect(bank.body.bank.alias).toBe("EDUCAR.TEST");
  });

  it("uploads receipts and approves partial and total payments", async () => {
    const context = await prepareBilling();
    const parentToken = await loginAs("marta.madre");

    const detail = await request(app)
      .get(`/api/parent/billing/invoices/${context.anaInvoiceId}`)
      .set("Authorization", `Bearer ${parentToken}`);
    const items = detail.body.invoice.items as Array<{ id: number; kind: string }>;
    const monthly = items.find((item) => item.kind === "monthly");
    const sport = items.find((item) => item.kind === "sport");
    const transport = items.find((item) => item.kind === "transport");
    expect(monthly && sport && transport).toBeTruthy();

    const upload = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([monthly!.id, sport!.id]))
      .attach("file", Buffer.from("%PDF-1.4\n% comprobante de prueba\n"), {
        filename: "comprobante.pdf",
        contentType: "application/pdf",
      });
    expect(upload.status).toBe(201);
    expect(upload.body.receipt.status).toBe("pending");
    expect(upload.body.receipt.claimedAmount).toBe(58000);
    const receiptId = upload.body.receipt.id as number;

    const ownFile = await request(app)
      .get(`/api/billing/receipts/${receiptId}/file`)
      .set("Authorization", `Bearer ${parentToken}`);
    expect(ownFile.status).toBe(200);

    const otherParent = await loginAs("carlos.padre");
    const forbiddenFile = await request(app)
      .get(`/api/billing/receipts/${receiptId}/file`)
      .set("Authorization", `Bearer ${otherParent}`);
    expect(forbiddenFile.status).toBe(403);

    const adminToken = context.adminToken;
    const pending = await request(app)
      .get("/api/admin/billing/receipts?status=pending")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(pending.body.receipts).toHaveLength(1);

    const approved = await request(app)
      .post(`/api/admin/billing/receipts/${receiptId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.invoice.status).toBe("partial");
    expect(approved.body.invoice.paidAmount).toBe(58000);

    const doubleApproval = await request(app)
      .post(`/api/admin/billing/receipts/${receiptId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(doubleApproval.status).toBe(409);
    expect(doubleApproval.body.code).toBe("RECEIPT_NOT_PENDING");

    const duplicatePaidItem = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([monthly!.id]))
      .attach("file", Buffer.from("%PDF-1.4\n% item pago\n"), {
        filename: "item-pago.pdf",
        contentType: "application/pdf",
      });
    expect(duplicatePaidItem.status).toBe(409);
    expect(duplicatePaidItem.body.code).toBe("ITEM_ALREADY_PAID");

    const uploadRest = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([transport!.id]))
      .attach("file", Buffer.from("%PDF-1.4\n% saldo\n"), {
        filename: "saldo.pdf",
        contentType: "application/pdf",
      });
    expect(uploadRest.status).toBe(201);

    const approvedRest = await request(app)
      .post(`/api/admin/billing/receipts/${uploadRest.body.receipt.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(approvedRest.status).toBe(200);
    expect(approvedRest.body.invoice.status).toBe("paid");
    expect(approvedRest.body.invoice.balance).toBe(0);

    const duplicateItem = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([transport!.id]))
      .attach("file", Buffer.from("%PDF-1.4\n% duplicado\n"), {
        filename: "duplicado.pdf",
        contentType: "application/pdf",
      });
    expect(duplicateItem.status).toBe(409);
    expect(duplicateItem.body.code).toBe("INVOICE_NOT_PAYABLE");
  });

  it("rejects receipts with a reason and validates file types", async () => {
    const context = await prepareBilling();
    const parentToken = await loginAs("marta.madre");
    const detail = await request(app)
      .get(`/api/parent/billing/invoices/${context.anaInvoiceId}`)
      .set("Authorization", `Bearer ${parentToken}`);
    const itemId = detail.body.invoice.items[0].id as number;

    const invalid = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([itemId]))
      .attach("file", Buffer.from("texto"), {
        filename: "comprobante.txt",
        contentType: "text/plain",
      });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("INVALID_FILE_TYPE");

    const upload = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([itemId]))
      .attach("file", Buffer.from("%PDF-1.4\n% rechazo\n"), {
        filename: "rechazo.pdf",
        contentType: "application/pdf",
      });
    expect(upload.status).toBe(201);

    const rejected = await request(app)
      .post(`/api/admin/billing/receipts/${upload.body.receipt.id}/reject`)
      .set("Authorization", `Bearer ${context.adminToken}`)
      .send({ reason: "El importe no coincide" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.receipt.status).toBe("rejected");
    expect(rejected.body.receipt.rejectionReason).toBe("El importe no coincide");

    const invoice = await request(app)
      .get(`/api/admin/billing/invoices/${context.anaInvoiceId}`)
      .set("Authorization", `Bearer ${context.adminToken}`);
    expect(invoice.body.invoice.status).toBe("pending");
    expect(invoice.body.invoice.paidAmount).toBe(0);
  });

  it("reports income, payments, services and delinquency", async () => {
    const context = await prepareBilling();
    const parentToken = await loginAs("marta.madre");
    const detail = await request(app)
      .get(`/api/parent/billing/invoices/${context.anaInvoiceId}`)
      .set("Authorization", `Bearer ${parentToken}`);
    const items = detail.body.invoice.items as Array<{ id: number; kind: string }>;
    const monthly = items.find((item) => item.kind === "monthly")!;
    const sport = items.find((item) => item.kind === "sport")!;

    const upload = await request(app)
      .post(`/api/parent/billing/invoices/${context.anaInvoiceId}/receipts`)
      .set("Authorization", `Bearer ${parentToken}`)
      .field("itemIds", JSON.stringify([monthly.id, sport.id]))
      .attach("file", Buffer.from("%PDF-1.4\n% reporte\n"), {
        filename: "reporte.pdf",
        contentType: "application/pdf",
      });
    await request(app)
      .post(`/api/admin/billing/receipts/${upload.body.receipt.id}/approve`)
      .set("Authorization", `Bearer ${context.adminToken}`);

    const income = await request(app)
      .get("/api/admin/billing/reports/income?from=2026-10-01&to=2026-10-31")
      .set("Authorization", `Bearer ${context.adminToken}`);
    expect(income.status).toBe(200);
    expect(income.body.report.total).toBe(58000);
    expect(income.body.report.count).toBe(1);

    const payments = await request(app)
      .get("/api/admin/billing/reports/payments?from=2026-10-01&to=2026-10-31")
      .set("Authorization", `Bearer ${context.adminToken}`);
    expect(payments.status).toBe(200);
    expect(payments.body.report.complete).toHaveLength(0);
    expect(payments.body.report.incomplete).toHaveLength(2);

    const services = await request(app)
      .get("/api/admin/billing/reports/services?from=2026-10-01&to=2026-10-31")
      .set("Authorization", `Bearer ${context.adminToken}`);
    expect(services.status).toBe(200);
    expect(services.body.report.rows[0]).toMatchObject({
      kind: "sport",
      student: "Ana Alumna",
      service: "Futbol",
      paidAmount: 8000,
    });

    const delinquency = await request(app)
      .get("/api/admin/billing/delinquency?year=2026&month=10")
      .set("Authorization", `Bearer ${context.adminToken}`);
    expect(delinquency.status).toBe(200);
    expect(delinquency.body.report).toMatchObject({
      billed: 137000,
      collected: 58000,
      pending: 79000,
    });
    expect(delinquency.body.report.evolution).toHaveLength(6);
    expect(delinquency.body.report.students[0]).toMatchObject({ student: "Bruno Alumno", balance: 67000 });
  });

  it("sends reminders and debt notices idempotently", async () => {
    const context = await prepareBilling();
    const first = await request(app)
      .post("/api/admin/billing/notifications/reminders")
      .set("Authorization", `Bearer ${context.adminToken}`)
      .send({ year: 2026, month: 10 });
    expect(first.status).toBe(200);
    expect(first.body.result.sent).toBe(2);

    const second = await request(app)
      .post("/api/admin/billing/notifications/reminders")
      .set("Authorization", `Bearer ${context.adminToken}`)
      .send({ year: 2026, month: 10 });
    expect(second.body.result.sent).toBe(0);
    expect(second.body.result.skipped).toBe(2);

    const debt = await request(app)
      .post("/api/admin/billing/notifications/debt")
      .set("Authorization", `Bearer ${context.adminToken}`)
      .send({ year: 2026, month: 10 });
    expect(debt.body.result.sent).toBe(2);
  });

  it("resets a password with a one-use token", async () => {
    const anaId = await userId("ana.alumna");
    const token = "test-reset-token";
    const hash = createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [anaId, hash, new Date(Date.now() + 3600000).toISOString()],
    );

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NuevaClave2027!" });
    expect(reset.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ username: "ana.alumna", password: "NuevaClave2027!" });
    expect(login.status).toBe(200);

    const reused = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "OtraClave2027!" });
    expect(reused.status).toBe(400);
    expect(reused.body.code).toBe("INVALID_RESET_TOKEN");

    const forgot = await request(app)
      .post("/api/auth/forgot-password")
      .send({ username: "ana.alumna" });
    expect(forgot.status).toBe(200);

    const unknown = await request(app)
      .post("/api/auth/forgot-password")
      .send({ username: "no.existe" });
    expect(unknown.status).toBe(200);
  });
});

describe("design patterns evidence", () => {
  it("uses a database-pool proxy that authorizes the requested role and audits success and rejection", async () => {
    const studentToken = await loginAs("ana.alumna");
    const parentToken = await loginAs("marta.madre");

    const ok = await request(app)
      .patch("/api/me/contact")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ email: "ana.node@educar.local", phone: "3624-800000" });
    expect(ok.status).toBe(200);
    expect(ok.body.contact.email).toBe("ana.node@educar.local");

    const forbidden = await request(app)
      .patch("/api/me/contact")
      .set("Authorization", `Bearer ${parentToken}`)
      .send({ email: "marta.node@educar.local", phone: "3624-800001" });
    expect(forbidden.status).toBe(403);

    const audit = await pool.query<{ success: string; rejected: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE result = 'success')::TEXT AS success,
         COUNT(*) FILTER (WHERE result = 'rejected')::TEXT AS rejected
       FROM audit_logs`,
    );
    expect(audit.rows[0]).toMatchObject({ success: expect.any(String), rejected: expect.any(String) });
    const successCount = Number(audit.rows[0].success);
    const rejectedCount = Number(audit.rows[0].rejected);
    expect(successCount).toBeGreaterThan(0);
    expect(rejectedCount).toBeGreaterThan(0);
  });

  it("iterates projected rows without exposing the underlying array", () => {
    const iterator = new RowIterator(
      [
        { full_name: "Ana Alumna", dni: "40111222" },
        { full_name: "Bruno Alumno", dni: "40222333" },
        { full_name: "Laura Docente", dni: "30111222" },
      ],
      (row) => ({ name: row.full_name, dni: row.dni }),
    );

    const first = iterator.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual({ name: "Ana Alumna", dni: "40111222" });
    const second = iterator.next();
    expect(second.value).toEqual({ name: "Bruno Alumno", dni: "40222333" });
    const third = iterator.next();
    expect(third.value).toEqual({ name: "Laura Docente", dni: "30111222" });
    const done = iterator.next();
    expect(done.done).toBe(true);
  });

  it("returns the same database pool for repeated requests (Singleton)", async () => {
    const url = "postgres://singleton:test@localhost:5432/educar";
    const firstPool = getDatabasePool(url);
    const secondPool = getDatabasePool(url);
    expect(secondPool).toBe(firstPool);
    await closeDatabasePool();
  });
});

async function loginAs(username: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

async function userId(username: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    "SELECT id FROM users WHERE username = $1",
    [username],
  );
  return result.rows[0].id;
}

async function createBillingTariffs(token: string): Promise<void> {
  const entries = [
    { kind: "monthly", amount: 50000, validFrom: "2026-01-01" },
    { kind: "sport", sportId: 1, amount: 8000, validFrom: "2026-01-01" },
    { kind: "sport", sportId: 3, amount: 7000, validFrom: "2026-01-01" },
    { kind: "transport", transportRouteId: 1, amount: 12000, validFrom: "2026-01-01" },
    { kind: "cafeteria", amount: 10000, validFrom: "2026-01-01" },
  ];
  for (const entry of entries) {
    const response = await request(app)
      .post("/api/admin/billing/tariffs")
      .set("Authorization", `Bearer ${token}`)
      .send(entry);
    expect(response.status).toBe(201);
  }
}

async function prepareBilling(): Promise<{ adminToken: string; anaInvoiceId: number }> {
  const adminToken = await loginAs("admin.demo");
  await createBillingTariffs(adminToken);

  const anaToken = await loginAs("ana.alumna");
  expect(
    (
      await request(app)
        .post("/api/student/enrollments")
        .set("Authorization", `Bearer ${anaToken}`)
        .send({ groupId: 1 })
    ).status,
  ).toBe(201);
  expect(
    (
      await request(app)
        .post("/api/student/transport")
        .set("Authorization", `Bearer ${anaToken}`)
        .send({ routeId: 1 })
    ).status,
  ).toBe(201);

  const brunoToken = await loginAs("bruno.alumno");
  expect(
    (
      await request(app)
        .post("/api/student/enrollments")
        .set("Authorization", `Bearer ${brunoToken}`)
        .send({ groupId: 3 })
    ).status,
  ).toBe(201);
  expect(
    (
      await request(app)
        .post("/api/student/cafeteria")
        .set("Authorization", `Bearer ${brunoToken}`)
    ).status,
  ).toBe(201);

  const generated = await request(app)
    .post("/api/admin/billing/invoices/generate")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ year: 2026, month: 10 });
  expect(generated.status).toBe(201);
  const anaInvoice = generated.body.invoices.find(
    (invoice: { studentId: number }) => invoice.studentId === 1,
  );
  return { adminToken, anaInvoiceId: anaInvoice.id as number };
}

function enroll(token: string, groupId: number) {
  return request(app)
    .post("/api/student/enrollments")
    .set("Authorization", `Bearer ${token}`)
    .send({ groupId });
}

async function insertFixtures(database: DatabasePool): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const insertUser = async (username: string, displayName: string, role: string) => {
    const result = await database.query<{ id: number }>(
      `INSERT INTO users (username, display_name, password_hash, email, role, status)
       VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id`,
      [username, displayName, passwordHash, `${username}@educar.local`, role],
    );
    return result.rows[0].id;
  };
  const anaUserId = await insertUser("ana.alumna", "Ana Alumna", "student");
  const parentUserId = await insertUser("marta.madre", "Marta Madre", "parent");
  const brunoUserId = await insertUser("bruno.alumno", "Bruno Alumno", "student");
  const adminUserId = await insertUser("admin.demo", "Administracion", "admin");
  const teacherUserId = await insertUser("laura.docente", "Laura Docente", "teacher");
  await insertUser("director.demo", "Direccion", "director");
  const carlosUserId = await insertUser("carlos.padre", "Carlos Padre", "parent");

  const levelResult = await database.query<{ id: number }>(
    "INSERT INTO levels (name) VALUES ('Primario') RETURNING id",
  );
  const courseResult = await database.query<{ id: number }>(
    "INSERT INTO courses (level_id, name) VALUES ($1, '5to A') RETURNING id",
    [levelResult.rows[0].id],
  );
  const insertStudent = async (userId: number, recordNumber: string, dni: string, name: string, email: string) => {
    const result = await database.query<{ id: number }>(
      `INSERT INTO students
        (user_id, record_number, dni, full_name, birth_date, address, phone, email, course_id)
       VALUES ($1, $2, $3, $4, '2014-05-15', 'Domicilio de prueba', '3624-111111', $5, $6)
       RETURNING id`,
      [userId, recordNumber, dni, name, email, courseResult.rows[0].id],
    );
    return result.rows[0].id;
  };
  const anaStudentId = await insertStudent(anaUserId, "AL-0001", "40111222", "Ana Alumna", "ana@educar.local");
  const brunoStudentId = await insertStudent(brunoUserId, "AL-0002", "40222333", "Bruno Alumno", "bruno@educar.local");

  const parentResult = await database.query<{ id: number }>(
    "INSERT INTO parents (user_id, full_name) VALUES ($1, 'Marta Madre') RETURNING id",
    [parentUserId],
  );
  await database.query(
    "INSERT INTO parent_students (parent_id, student_id) VALUES ($1, $2)",
    [parentResult.rows[0].id, anaStudentId],
  );
  const carlosParent = await database.query<{ id: number }>(
    "INSERT INTO parents (user_id, full_name) VALUES ($1, 'Carlos Padre') RETURNING id",
    [carlosUserId],
  );
  await database.query(
    "INSERT INTO parent_students (parent_id, student_id) VALUES ($1, $2)",
    [carlosParent.rows[0].id, brunoStudentId],
  );

  const teacherResult = await database.query<{ id: number }>(
    `INSERT INTO teachers
      (user_id, record_number, dni, full_name, specialty, email, phone)
     VALUES ($1, 'PR-0001', '30111222', 'Laura Docente', 'Deportes', 'laura@educar.local', '3624-100000')
     RETURNING id`,
    [teacherUserId],
  );
  const teacherId = teacherResult.rows[0].id;

  const subjectResult = await database.query<{ id: number }>(
    "INSERT INTO subjects (name) VALUES ('Matematica') RETURNING id",
  );
  const matematicaId = subjectResult.rows[0].id;
  await database.query(
    `INSERT INTO student_subjects (student_id, subject_id, teacher_id)
     VALUES ($1, $2, $3), ($4, $2, $3)
     ON CONFLICT DO NOTHING`,
    [anaStudentId, matematicaId, teacherId, brunoStudentId],
  );
  await database.query(
    `INSERT INTO course_subjects (course_id, subject_id, teacher_id, weekday, start_time, end_time)
     VALUES ($1, $2, $3, 1, '08:00', '09:00')`,
    [courseResult.rows[0].id, matematicaId, teacherId],
  );
  const schoolYearResult = await database.query<{ id: number }>(
    "INSERT INTO school_years (year, active) VALUES (2026, TRUE) RETURNING id",
  );
  await database.query(
    `INSERT INTO school_year_enrollments (student_id, school_year_id, course_id, status, created_by)
     VALUES ($1, $3, $4, 'enrolled', $5), ($2, $3, $4, 'enrolled', $5)`,
    [
      anaStudentId,
      brunoStudentId,
      schoolYearResult.rows[0].id,
      courseResult.rows[0].id,
      adminUserId,
    ],
  );

  const sportIds: number[] = [];
  for (const name of ["Futbol", "Natacion", "Atletismo", "Ajedrez"]) {
    const result = await database.query<{ id: number }>(
      "INSERT INTO sports (name) VALUES ($1) RETURNING id",
      [name],
    );
    sportIds.push(result.rows[0].id);
  }
  for (const [sportId, weekday, startTime, endTime] of [
    [sportIds[0], 1, "16:00", "17:00"],
    [sportIds[1], 1, "16:30", "17:30"],
    [sportIds[2], 2, "16:00", "17:00"],
    [sportIds[3], 3, "16:00", "17:00"],
  ] as const) {
    await database.query(
      `INSERT INTO sport_groups (sport_id, teacher_id, level_id, weekday, start_time, end_time)
       VALUES ($1, $2, NULL, $3, $4, $5)`,
      [sportId, teacherId, weekday, startTime, endTime],
    );
  }
  await database.query(
    `INSERT INTO transport_routes (name, description, active)
     VALUES
       ('Recorrido Norte', 'Acceso norte', TRUE),
       ('Recorrido Centro', 'Centro', TRUE),
       ('Recorrido Sur', 'Acceso sur', TRUE),
       ('Recorrido Oeste', 'Acceso oeste', TRUE)`,
  );

  // Keep the expected student IDs explicit for relationship tests.
  expect(anaStudentId).toBe(1);
  expect(brunoStudentId).toBe(2);
}
