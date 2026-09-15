import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(apiDirectory, "../.env") });
dotenv.config();

export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigin: string;
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const jwtSecret = process.env.JWT_SECRET;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return {
    port: Number(process.env.PORT ?? 4000),
    databaseUrl,
    jwtSecret,
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  };
}
