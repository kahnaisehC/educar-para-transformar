import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
};

export type DatabasePool = Pool & Queryable;

export function createPool(connectionString: string): DatabasePool {
  return new Pool({ connectionString }) as DatabasePool;
}

// ---------------------------------------------------------------------------
// Patrón Singleton: instancia única del pool de base de datos
// ---------------------------------------------------------------------------
// La variable `_poolInstance` se mantiene en el ámbito del módulo. La primera
// llamada a `getPool()` crea el Pool con la cadena de conexión proporcionada;
// las llamadas siguientes devuelven siempre la misma instancia, evitando que
// múltiples partes del código abran conjuntos de conexiones independientes.
// ---------------------------------------------------------------------------
let _poolInstance: DatabasePool | null = null;

/**
 * Singleton — devuelve la instancia única del pool de conexiones de PostgreSQL.
 * Si todavía no existe, la crea usando `connectionString`; en caso contrario
 * ignora el argumento y retorna la instancia ya creada.
 */
export function getPool(connectionString?: string): DatabasePool {
  if (_poolInstance === null) {
    if (!connectionString) {
      throw new Error(
        "getPool: se requiere connectionString para crear la instancia del pool",
      );
    }
    _poolInstance = createPool(connectionString);
  }
  return _poolInstance;
}

/** Cierra la instancia singleton y la descarta (útil en pruebas). */
export async function destroyPool(): Promise<void> {
  if (_poolInstance !== null) {
    await _poolInstance.end();
    _poolInstance = null;
  }
}

export async function withTransaction<T>(
  pool: DatabasePool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
