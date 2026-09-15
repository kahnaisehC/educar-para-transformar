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
