import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Queryable } from "./db.js";
import { AppError } from "./errors.js";
import { sendMail } from "./mail.service.js";

const RESET_TTL_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function requestPasswordReset(
  pool: Queryable,
  identifier: string,
  appUrl: string,
): Promise<void> {
  const result = await pool.query<{
    id: number;
    username: string;
    email: string | null;
    status: string;
  }>(
    `SELECT id, username, email, status
     FROM users
     WHERE lower(username) = lower($1) OR lower(email) = lower($1)
     LIMIT 1`,
    [identifier],
  );
  const user = result.rows[0];
  if (!user || user.status !== "active" || !user.email) {
    // Respuesta uniforme para no revelar si la cuenta existe.
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, hashToken(token), expiresAt],
  );

  const link = `${appUrl}/reset-password?token=${token}`;
  try {
    await sendMail({
      to: user.email,
      subject: "Recuperación de contraseña · EDUCAR",
      text: `Para restablecer tu contraseña ingresá a: ${link}\nEl enlace vence en 60 minutos.`,
      html: `<p>Para restablecer tu contraseña ingresá a:</p><p><a href="${link}">${link}</a></p><p>El enlace vence en 60 minutos.</p>`,
    });
  } catch (error) {
    console.error("No se pudo enviar el correo de recuperación", error);
  }
}

export async function resetPassword(
  pool: Queryable,
  token: string,
  newPassword: string,
): Promise<void> {
  const now = new Date().toISOString();
  const result = await pool.query<{ id: number; user_id: number }>(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2`,
    [hashToken(token), now],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppError(400, "El enlace no es válido o venció", "INVALID_RESET_TOKEN");
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
    passwordHash,
    row.user_id,
  ]);
  await pool.query("UPDATE password_reset_tokens SET used_at = $1 WHERE id = $2", [now, row.id]);
  await pool.query(
    "UPDATE password_reset_tokens SET used_at = $1 WHERE user_id = $2 AND used_at IS NULL",
    [now, row.user_id],
  );
}

export async function changePassword(
  pool: Queryable,
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const result = await pool.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new AppError(400, "La contraseña actual no es correcta", "INVALID_PASSWORD");
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
    passwordHash,
    userId,
  ]);
}
