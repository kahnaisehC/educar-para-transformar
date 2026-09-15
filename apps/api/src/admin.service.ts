import bcrypt from "bcryptjs";
import type { DatabasePool } from "./db.js";
import { withTransaction } from "./db.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import { AppError, isAppError } from "./errors.js";
import type { UserRole } from "./auth.js";

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt: string;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  status: "active" | "inactive";
}

export interface UpdateUserInput {
  role?: UserRole;
  status?: "active" | "inactive";
}

interface AdminUserRow {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  status: "active" | "inactive";
  created_at: string;
}

function mapUser(user: AdminUserRow): AdminUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
  };
}

export async function listUsers(pool: DatabasePool): Promise<AdminUser[]> {
  const result = await pool.query<AdminUserRow>(
    `SELECT id, username, display_name, role, status, created_at
     FROM users
     ORDER BY display_name, username`,
  );
  return result.rows.map(mapUser);
}

export async function createUser(
  pool: DatabasePool,
  actorUserId: number,
  input: CreateUserInput,
): Promise<AdminUser> {
  try {
    return await withTransaction(pool, async (client) => {
      const passwordHash = await bcrypt.hash(input.password, 12);
      const result = await client.query<AdminUserRow>(
        `INSERT INTO users (username, display_name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, username, display_name, role, status, created_at`,
        [input.username, input.displayName, passwordHash, input.role, input.status],
      );
      const user = result.rows[0];
      if (user.role === "student") {
        await client.query(
          `INSERT INTO students
             (user_id, record_number, dni, full_name, level, course, status)
           VALUES ($1, $2, $3, $4, 'Pendiente', 'Pendiente', $5)`,
          [user.id, `PEND-${user.id}`, `PEND-${user.id}`, input.displayName, input.status],
        );
      }
      if (user.role === "parent") {
        await client.query(
          "INSERT INTO parents (user_id, full_name) VALUES ($1, $2)",
          [user.id, input.displayName],
        );
      }
      await writeAudit(client, actorUserId, "create_user", "success", {
        userId: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
      });
      return mapUser(user);
    });
  } catch (error) {
    const normalizedError = normalizeAdminError(error);
    await tryWriteAudit(pool, actorUserId, "create_user", "rejected", {
      username: input.username,
      role: input.role,
      reason: normalizedError.message,
    });
    throw normalizedError;
  }
}

export async function updateUser(
  pool: DatabasePool,
  actorUserId: number,
  userId: number,
  input: UpdateUserInput,
): Promise<AdminUser> {
  try {
    if (userId === actorUserId && input.status === "inactive") {
      throw new AppError(400, "No puede desactivar su propia cuenta", "SELF_DEACTIVATION");
    }

    return await withTransaction(pool, async (client) => {
      const assignments: string[] = [];
      const values: unknown[] = [];
      if (input.role) {
        values.push(input.role);
        assignments.push(`role = $${values.length}`);
      }
      if (input.status) {
        values.push(input.status);
        assignments.push(`status = $${values.length}`);
      }
      if (!assignments.length) {
        throw new AppError(400, "Debe indicar un rol o estado para actualizar", "EMPTY_UPDATE");
      }
      values.push(userId);
      const result = await client.query<AdminUserRow>(
        `UPDATE users
         SET ${assignments.join(", ")}, updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id, username, display_name, role, status, created_at`,
        values,
      );
      const user = result.rows[0];
      if (!user) {
        throw new AppError(404, "El usuario no existe", "USER_NOT_FOUND");
      }
      await writeAudit(client, actorUserId, "update_user", "success", {
        userId,
        changes: input,
      });
      return mapUser(user);
    });
  } catch (error) {
    const normalizedError = normalizeAdminError(error);
    await tryWriteAudit(pool, actorUserId, "update_user", "rejected", {
      userId,
      changes: input,
      reason: normalizedError.message,
    });
    throw normalizedError;
  }
}

function normalizeAdminError(error: unknown): Error {
  if (isAppError(error)) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return new AppError(409, "El nombre de usuario ya existe", "DUPLICATE_USERNAME");
  }
  return error instanceof Error ? error : new Error("No se pudo completar la operación administrativa");
}
