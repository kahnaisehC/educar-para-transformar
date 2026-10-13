import { createPool, type DatabasePool } from "./db.js";

let poolInstance: DatabasePool | undefined;

export function getDatabasePool(connectionString: string): DatabasePool {
  if (!poolInstance) {
    poolInstance = createPool(connectionString);
  }
  return poolInstance;
}

export function closeDatabasePool(): Promise<void> {
  if (!poolInstance) {
    return Promise.resolve();
  }
  const current = poolInstance;
  poolInstance = undefined;
  return current.end();
}