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
  await database.query(
    `INSERT INTO users (id, username, display_name, password_hash, role, status)
     VALUES
       (1, 'ana.alumna', 'Ana Alumna', $1, 'student', 'active'),
       (2, 'marta.madre', 'Marta Madre', $1, 'parent', 'active'),
       (3, 'bruno.alumno', 'Bruno Alumno', $1, 'student', 'active'),
       (4, 'admin.demo', 'Administracion', $1, 'admin', 'active')`,
    [passwordHash],
  );
  await database.query(
    `INSERT INTO students (id, user_id, record_number, dni, full_name, level, course)
     VALUES
       (1, 1, 'AL-0001', '40111222', 'Ana Alumna', 'Primario', '5to A'),
       (2, 3, 'AL-0002', '40222333', 'Bruno Alumno', 'Secundario', '2do B')`,
  );
  await database.query("INSERT INTO parents (id, user_id, full_name) VALUES (1, 2, 'Marta Madre')");
  await database.query("INSERT INTO parent_students (parent_id, student_id) VALUES (1, 1)");
  await database.query("INSERT INTO teachers (id, full_name, specialty) VALUES (1, 'Diego Profesor', 'Deportes')");
  await database.query(
    `INSERT INTO sports (id, name)
     VALUES (1, 'Futbol'), (2, 'Natacion'), (3, 'Atletismo'), (4, 'Ajedrez')`,
  );
  await database.query(
    `INSERT INTO sport_groups (id, sport_id, teacher_id, level, weekday, start_time, end_time)
     VALUES
       (1, 1, 1, 'Todos', 1, '16:00', '17:00'),
       (2, 2, 1, 'Todos', 1, '16:30', '17:30'),
       (3, 3, 1, 'Todos', 2, '16:00', '17:00'),
       (4, 4, 1, 'Todos', 3, '16:00', '17:00')`,
  );
}
