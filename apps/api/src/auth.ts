import bcrypt from "bcryptjs";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import type { DatabasePool } from "./db.js";
import { AppError } from "./errors.js";
import type { CurrentUser } from "./types.js";

export const USER_ROLES = ["student", "parent", "teacher", "admin", "director"] as const;
export type UserRole = (typeof USER_ROLES)[number];

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  status: "active" | "inactive";
}

interface PublicUserRow {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  status: "active" | "inactive";
}

export function toCurrentUser(row: PublicUserRow): CurrentUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
  };
}

export async function authenticate(
  pool: DatabasePool,
  username: string,
  password: string,
  jwtSecret: string,
): Promise<{ token: string; user: CurrentUser }> {
  const result = await pool.query<UserRow>(
    `SELECT id, username, display_name, password_hash, role, status
     FROM users
     WHERE username = $1`,
    [username.trim().toLowerCase()],
  );
  const user = result.rows[0];

  if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, "Usuario o contraseña incorrectos", "INVALID_CREDENTIALS");
  }

  const token = jwt.sign(
    { sub: String(user.id), role: user.role },
    jwtSecret,
    { expiresIn: "8h", issuer: "educar-para-transformar" },
  );

  return {
    token,
    user: toCurrentUser(user),
  };
}

export function requireAuth(pool: DatabasePool, jwtSecret: string): RequestHandler {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const header = request.header("authorization");
      if (!header?.startsWith("Bearer ")) {
        throw new AppError(401, "Se requiere autenticación", "UNAUTHENTICATED");
      }

      const payload = jwt.verify(header.slice("Bearer ".length), jwtSecret, {
        issuer: "educar-para-transformar",
      });
      if (typeof payload === "string" || !payload.sub || !/^\d+$/.test(String(payload.sub))) {
        throw new AppError(401, "Token inválido", "INVALID_TOKEN");
      }

      const result = await pool.query<PublicUserRow>(
        `SELECT id, username, display_name, role, status
         FROM users
         WHERE id = $1`,
        [Number(payload.sub)],
      );
      const user = result.rows[0];
      if (!user || user.status !== "active") {
        throw new AppError(401, "La sesión ya no está activa", "INACTIVE_SESSION");
      }

      request.user = toCurrentUser(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "Se requiere autenticación", "UNAUTHENTICATED"));
      return;
    }
    if (!roles.includes(request.user.role)) {
      next(new AppError(403, "No tiene permisos para este módulo", "FORBIDDEN"));
      return;
    }
    next();
  };
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function isUserStatus(value: unknown): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}
