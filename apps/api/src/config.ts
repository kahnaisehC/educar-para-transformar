import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(apiDirectory, "../.env") });
dotenv.config();

export interface SmtpConfig {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
}

export interface BankDetails {
  alias: string;
  cbu: string;
  holder: string;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  corsOrigin: string;
  uploadsDir: string;
  appUrl: string;
  smtp: SmtpConfig;
  bank: BankDetails;
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
    uploadsDir: process.env.UPLOADS_DIR ?? "uploads",
    appUrl: process.env.APP_URL ?? "http://localhost:5173",
    smtp: {
      host: process.env.SMTP_HOST ?? null,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER ?? null,
      password: process.env.SMTP_PASS ?? null,
      from: process.env.SMTP_FROM ?? "EDUCAR PARA TRANSFORMAR <no-reply@educar.local>",
    },
    bank: {
      alias: process.env.BANK_ALIAS ?? "EDUCAR.CUOTAS",
      cbu: process.env.BANK_CBU ?? "0000003100010000000001",
      holder: process.env.BANK_HOLDER ?? "Centro Educativo Educar para Transformar",
    },
  };
}
