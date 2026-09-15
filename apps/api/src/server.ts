import { createAppFromConfig } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const app = createAppFromConfig(pool, config);

const server = app.listen(config.port, () => {
  console.log(`Educar API listening on http://localhost:${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
