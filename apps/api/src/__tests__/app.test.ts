import bcrypt from "bcryptjs";
import { newDb } from "pg-mem";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "../app.js";
import type { DatabasePool } from "../db.js";

const schema = readFileSync(
  fileURLToPath(new URL("../../../../database/schema.sql", import.meta.url)),
  "utf8",
);
const JWT_SECRET = "test-secret-that-is-long-enough-for-the-suite";
const PASSWORD = "Educar2027!";

let pool: DatabasePool;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  const database = newDb({ autoCreateForeignKeyIndices: true });
  database.public.none(schema.replace(/^BEGIN;\s*/, "").replace(/\s*COMMIT;\s*$/, ""));
  const pg = database.adapters.createPg();
  pool = new pg.Pool() as unknown as DatabasePool;
  await insertFixtures(pool);
  app = createApp({ pool, jwtSecret: JWT_SECRET, corsOrigin: "http://localhost:5173" });
});

afterEach(async () => {
  if (pool) {
    await pool.end();
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
    const profile = await pool.query<{ full_name: string; level: string; course: string }>(
      "SELECT full_name, level, course FROM students WHERE user_id = $1",
      [created.body.user.id],
    );
    expect(profile.rows[0]).toMatchObject({
      full_name: "Nuevo Alumno",
      level: "Pendiente",
      course: "Pendiente",
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

async function loginAs(username: string): Promise<string> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
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
      `INSERT INTO users (username, display_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
      [username, displayName, passwordHash, role],
    );
    return result.rows[0].id;
  };
  const anaUserId = await insertUser("ana.alumna", "Ana Alumna", "student");
  const parentUserId = await insertUser("marta.madre", "Marta Madre", "parent");
  const brunoUserId = await insertUser("bruno.alumno", "Bruno Alumno", "student");
  await insertUser("admin.demo", "Administracion", "admin");
  const teacherUserId = await insertUser("laura.docente", "Laura Docente", "teacher");

  const insertStudent = async (userId: number, recordNumber: string, dni: string, name: string, email: string) => {
    const result = await database.query<{ id: number }>(
      `INSERT INTO students
        (user_id, record_number, dni, full_name, birth_date, address, phone, email, level, course)
       VALUES ($1, $2, $3, $4, '2014-05-15', 'Domicilio de prueba', '3624-111111', $5, 'Primario', '5to A')
       RETURNING id`,
      [userId, recordNumber, dni, name, email],
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

  const teacherResult = await database.query<{ id: number }>(
    `INSERT INTO teachers
      (user_id, record_number, dni, full_name, specialty, email, phone)
     VALUES ($1, 'PR-0001', '30111222', 'Laura Docente', 'Deportes', 'laura@educar.local', '3624-100000')
     RETURNING id`,
    [teacherUserId],
  );
  const teacherId = teacherResult.rows[0].id;

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
      `INSERT INTO sport_groups (sport_id, teacher_id, level, weekday, start_time, end_time)
       VALUES ($1, $2, 'Todos', $3, $4, $5)`,
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
