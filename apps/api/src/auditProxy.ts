import type { DatabasePool } from "./db.js";
import { tryWriteAudit, writeAudit } from "./audit.js";
import { AppError, isAppError } from "./errors.js";
import type { UserRole } from "./auth.js";

export interface AuditProxyOptions<T> {
  operation: string;
  actorUserId: number;
  allowedRoles?: readonly UserRole[];
  actorRole?: UserRole;
  onSuccess?: (result: T) => Record<string, unknown>;
  onError?: (error: unknown) => Record<string, unknown>;
  normalizeError?: (error: unknown) => Error;
  fallbackMessage?: string;
  handler: () => Promise<T>;
}

export async function withAuditProxy<T>(
  pool: DatabasePool,
  options: AuditProxyOptions<T>,
): Promise<T> {
  if (options.allowedRoles && options.actorRole && !options.allowedRoles.includes(options.actorRole)) {
    throw new AppError(403, "No tiene permisos para este módulo", "FORBIDDEN");
  }
  try {
    const result = await options.handler();
    await writeAudit(pool, options.actorUserId, options.operation, "success", options.onSuccess?.(result) ?? {});
    return result;
  } catch (error) {
    const normalized = options.normalizeError
      ? options.normalizeError(error)
      : isAppError(error)
        ? error
        : error instanceof Error
          ? error
          : new Error(options.fallbackMessage ?? "No se pudo completar la operación");
    await tryWriteAudit(pool, options.actorUserId, options.operation, "rejected", options.onError?.(normalized) ?? { reason: normalized.message });
    throw normalized;
  }
}