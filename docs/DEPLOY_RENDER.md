# Despliegue en Render

1. Subí el repositorio a GitHub (rama `main`).
2. En Render: **New → Blueprint**, elegí el repo. Render lee `render.yaml` y crea
   `educar-db` (PostgreSQL), `educar-api` y `educar-web`.
3. Cuando pida las variables:
   - `educar-web` → `VITE_API_URL` = `https://<url-de-educar-api>/api`
   - `educar-api` → `CORS_ORIGIN` y `APP_URL` = `https://<url-de-educar-web>`
   Si no conocés las URLs todavía, dejalas vacías, deployá, copiá las URLs
   (`https://educar-api.onrender.com`, etc.) y cargalas en **Environment**.
   Al cambiar `VITE_API_URL` hay que redeployar el sitio web (se fija en el build).
4. En el primer arranque la API ejecuta `scripts/init-db.mjs`, que carga
   `schema.sql`, `seed.sql` y las migraciones solo si la base está vacía.
5. Ingresá con las cuentas demo (contraseña `Educar2027!`, ver README).

Limitaciones del plan gratuito: la API se duerme tras ~15 min sin uso (la primera
request tarda ~1 min), la base gratuita expira a los 30 días y los archivos
subidos (`UPLOADS_DIR`) se pierden en cada redeploy.
