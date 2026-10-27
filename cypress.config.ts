import { defineConfig } from "cypress";

// Pruebas E2E (caja negra) contra la aplicación real: frontend + API + PostgreSQL.
// Por defecto apunta al servidor de desarrollo de Vite (proxy /api -> :4000).
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    env: {
      apiUrl: process.env.CYPRESS_API_URL ?? "http://localhost:4000/api",
    },
  },
});
