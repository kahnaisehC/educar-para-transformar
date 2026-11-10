#!/usr/bin/env node
/**
 * Runner de migraciones idempotente.
 *
 * - En una base vacía aplica schema.sql y seed.sql.
 * - Aplica las migraciones de database/migrations/ que todavía no estén
 *   registradas en schema_migrations.
 * - Registra versión, nombre, checksum y fecha de aplicación.
 *
 * Uso:
 *   DATABASE_URL=postgres://... node scripts/migrate-db.mjs
 *   DATABASE_URL=... node scripts/migrate-db.mjs --dry-run
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
const dryRun = process.argv.includes("--dry-run");

if (!databaseUrl) {
  console.error("DATABASE_URL es obligatorio");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

function checksum(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function tableExists(name) {
  const { rows } = await client.query(
    "SELECT to_regclass($1) AS relation",
    [`public.${name}`],
  );
  return Boolean(rows[0]?.relation);
}

async function runFile(label, path) {
  const sql = readFileSync(path, "utf8");
  console.log(`${dryRun ? "[dry-run] " : ""}Aplicando ${label}...`);
  if (!dryRun) {
    await client.query(sql);
  }
  return checksum(sql);
}

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(10) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const hasUsers = await tableExists("users");
  if (!hasUsers) {
    console.log("Base vacía: aplicando esquema y datos demo.");
    await runFile("database/schema.sql", join(root, "database", "schema.sql"));
    await runFile("database/seed.sql", join(root, "database", "seed.sql"));
  } else {
    console.log("Base existente: se aplicarán solo migraciones pendientes.");
  }

  const migrationsDir = join(root, "database", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = await client.query("SELECT version, checksum FROM schema_migrations");
  const appliedByVersion = new Map(applied.rows.map((row) => [row.version, row.checksum]));

  for (const file of files) {
    const version = file.slice(0, 3);
    const path = join(migrationsDir, file);
    const content = readFileSync(path, "utf8");
    const hash = checksum(content);
    const previous = appliedByVersion.get(version);

    if (previous) {
      if (previous !== hash) {
        console.warn(
          `Advertencia: la migración ${file} cambió después de aplicarse. ` +
            "No se vuelve a ejecutar.",
        );
      }
      continue;
    }

    await runFile(`database/migrations/${file}`, path);
    if (!dryRun) {
      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING`,
        [version, file, hash],
      );
    }
  }

  const pending = (await client.query("SELECT COUNT(*)::TEXT AS total FROM schema_migrations")).rows[0]
    ?.total;
  console.log(`Migraciones registradas: ${pending ?? "0"}.`);
  console.log("Base de datos al día.");
} catch (error) {
  console.error("Error aplicando migraciones:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
