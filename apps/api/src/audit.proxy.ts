/**
 * Patrón Proxy — AuditingQueryProxy
 *
 * Este archivo implementa el patrón de diseño **Proxy** (GoF estructural).
 *
 * Contexto:
 *   La interfaz `Queryable` representa cualquier objeto capaz de ejecutar
 *   consultas SQL contra la base de datos (Pool o PoolClient de `pg`).
 *
 * Problema:
 *   Queremos registrar en `audit_logs` toda sentencia de escritura (INSERT,
 *   UPDATE, DELETE) que pase por un `Queryable` determinado, sin modificar
 *   los servicios existentes ni la interfaz real del Pool.
 *
 * Solución — Proxy:
 *   `AuditingQueryProxy` implementa `Queryable` y envuelve otro `Queryable`
 *   (el sujeto real). Intercepta cada llamada a `query()`:
 *     1. Delega la ejecución al sujeto real.
 *     2. Si la sentencia es de escritura, registra de forma no bloqueante
 *        en `audit_logs` la operación, el actor y la cantidad de filas
 *        afectadas. Los errores de auditoría se absorben para no ocultar
 *        la respuesta de negocio.
 *
 * Uso típico:
 *   ```ts
 *   import { AuditingQueryProxy } from "./audit.proxy.js";
 *
 *   const proxy = new AuditingQueryProxy(pool, actorUserId, "batch_import");
 *   await proxy.query("INSERT INTO students ...", [...]);
 *   // → la INSERT se ejecuta Y se guarda en audit_logs automáticamente.
 *   ```
 */

import type { QueryResult, QueryResultRow } from "pg";
import type { Queryable } from "./db.js";

// Palabras clave SQL que modifican datos. Se comparan con la primera palabra
// de la sentencia (case-insensitive).
const WRITE_KEYWORDS = new Set(["INSERT", "UPDATE", "DELETE", "TRUNCATE"]);

function isWriteQuery(sql: string): boolean {
  const first = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "";
  return WRITE_KEYWORDS.has(first);
}

// ---------------------------------------------------------------------------
// Patrón Proxy
// ---------------------------------------------------------------------------

export class AuditingQueryProxy implements Queryable {
  /** El sujeto real al que se delegan las consultas. */
  private readonly _subject: Queryable;
  /** Identificador del usuario que originó las operaciones. */
  private readonly _actorUserId: number;
  /** Etiqueta descriptiva de la operación de negocio (ej. "batch_import"). */
  private readonly _operation: string;

  constructor(subject: Queryable, actorUserId: number, operation: string) {
    this._subject = subject;
    this._actorUserId = actorUserId;
    this._operation = operation;
  }

  /**
   * Intercepta la ejecución de la consulta:
   *  1. Delega al sujeto real.
   *  2. Si es una sentencia de escritura, emite una entrada en audit_logs
   *     de forma asíncrona y no bloqueante.
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    const result = await this._subject.query<T>(text, values);

    if (isWriteQuery(text)) {
      // El registro de auditoría es «fire-and-forget»: si falla no debe
      // interrumpir la operación principal.
      this._recordAudit(text, result.rowCount ?? 0).catch((err: unknown) => {
        console.error("[AuditingQueryProxy] Error al registrar auditoría:", err);
      });
    }

    return result;
  }

  private async _recordAudit(sql: string, rowCount: number): Promise<void> {
    const verb = sql.trimStart().split(/\s+/)[0]?.toUpperCase() ?? "UNKNOWN";
    await this._subject.query(
      `INSERT INTO audit_logs (actor_user_id, operation, result, details)
       VALUES ($1, $2, 'success', $3::jsonb)`,
      [
        this._actorUserId,
        `${this._operation}:${verb}`,
        JSON.stringify({ rowCount, sql: sql.slice(0, 200) }),
      ],
    );
  }
}
