import type { Queryable } from "./db.js";
import { AppError } from "./errors.js";

export interface NotificationView {
  id: number;
  type: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function notify(
  executor: Queryable,
  userId: number,
  input: NotificationInput,
): Promise<void> {
  await executor.query(
    `INSERT INTO notifications (user_id, type, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, input.type, input.title, input.body, JSON.stringify(input.metadata ?? {})],
  );
}

export async function safeNotify(
  executor: Queryable,
  userId: number,
  input: NotificationInput,
): Promise<void> {
  try {
    await notify(executor, userId, input);
  } catch (error) {
    // A notification failure must not hide the business response.
    console.error("Unable to write notification", error);
  }
}

export async function listNotifications(
  pool: Queryable,
  userId: number,
): Promise<{ notifications: NotificationView[]; unreadCount: number }> {
  const [list, count] = await Promise.all([
    pool.query<{
      id: string;
      type: string;
      title: string;
      body: string;
      metadata: unknown;
      read_at: string | null;
      created_at: string;
    }>(
      `SELECT id, type, title, body, metadata, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 50`,
      [userId],
    ),
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::TEXT AS total
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    ),
  ]);

  return {
    notifications: list.rows.map((row) => ({
      id: Number(row.id),
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: parseMetadata(row.metadata),
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount: Number(count.rows[0]?.total ?? 0),
  };
}

export async function markNotificationRead(
  pool: Queryable,
  userId: number,
  notificationId: number,
): Promise<void> {
  const result = await pool.query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
    [notificationId, userId],
  );
  if (!result.rowCount) {
    const existing = await pool.query(
      "SELECT 1 FROM notifications WHERE id = $1 AND user_id = $2",
      [notificationId, userId],
    );
    if (!existing.rowCount) {
      throw new AppError(404, "La notificación no existe", "NOTIFICATION_NOT_FOUND");
    }
  }
}

export async function markAllNotificationsRead(pool: Queryable, userId: number): Promise<void> {
  await pool.query(
    "UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL",
    [userId],
  );
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
