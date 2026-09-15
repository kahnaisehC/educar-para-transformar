import type { Queryable } from "./db.js";

export async function writeAudit(
  executor: Queryable,
  actorUserId: number,
  operation: string,
  result: "success" | "rejected",
  details: Record<string, unknown>,
): Promise<void> {
  await executor.query(
    `INSERT INTO audit_logs (actor_user_id, operation, result, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [actorUserId, operation, result, JSON.stringify(details)],
  );
}

export async function tryWriteAudit(
  executor: Queryable,
  actorUserId: number,
  operation: string,
  result: "success" | "rejected",
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await writeAudit(executor, actorUserId, operation, result, details);
  } catch (error) {
    // Audit failure must not hide the business response, but should remain visible to operators.
    console.error("Unable to write audit log", error);
  }
}
