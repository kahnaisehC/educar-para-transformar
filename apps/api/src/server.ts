import { createAppFromConfig } from "./app.js";
import { loadConfig } from "./config.js";
import { closeDatabasePool, getDatabasePool } from "./database.js";

const config = loadConfig();
const pool = getDatabasePool(config.databaseUrl);
const app = createAppFromConfig(pool, config);

const server = app.listen(config.port, () => {
  console.log(`Educar API listening on http://localhost:${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await closeDatabasePool();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
