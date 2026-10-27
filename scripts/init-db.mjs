// Inicializa la base de datos en el primer arranque (Render, etc.).
// Aplica schema.sql, seed.sql y las migraciones solo si la tabla `users`
// todavía no existe, así que es seguro ejecutarlo en cada inicio.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL es obligatorio");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const { rows } = await client.query("SELECT to_regclass('public.users') AS users");
  if (rows[0].users) {
    console.log("Base de datos ya inicializada; no se aplica nada.");
  } else {
    const migrationsDir = join(root, "database", "migrations");
    const migrations = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const files = [
      join(root, "database", "schema.sql"),
      join(root, "database", "seed.sql"),
      ...migrations.map((file) => join(migrationsDir, file)),
    ];
    for (const file of files) {
      console.log(`Aplicando ${file.slice(root.length + 1)}...`);
      await client.query(readFileSync(file, "utf8"));
    }
    console.log("Base de datos inicializada.");
  }
} finally {
  await client.end();
}
