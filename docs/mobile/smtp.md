# Correo SMTP

La API usa `nodemailer`. Si `SMTP_HOST` está vacío, usa un transporte JSON de
prueba: el correo no sale a Internet, pero la llamada se registra como enviada.
Con `SMTP_HOST` configurado, envía por SMTP real.

## Variables

| Variable | Obligatoria con SMTP | Ejemplo |
|---|---|---|
| `SMTP_HOST` | Sí | `smtp.sendgrid.net` |
| `SMTP_PORT` | No (`587`) | `587` |
| `SMTP_SECURE` | No (`false`) | `true` para puerto 465 |
| `SMTP_USER` | Según proveedor | `apikey` |
| `SMTP_PASS` | Según proveedor | API key |
| `SMTP_FROM` | No | `EDUCAR <no-reply@tudominio.com>` |

No versionar credenciales. En Render se cargan con `sync: false` en el panel;
en local van en `apps/api/.env`.

## Verificación

Con la API levantada y un administrador autenticado:

```bash
GET  /api/admin/notifications/mail-status
POST /api/admin/notifications/test
```

`mail-status` devuelve `transport: "json" | "smtp"` y el resultado de
`verify()`. `test` envía un correo al email del administrador autenticado.

## Proveedores

- **Demo:** Gmail con contraseña de aplicación (requiere verificación en dos pasos).
- **Producción:** SendGrid, Resend o Mailgun con dominio verificado.
- Configurar SPF y DKIM del dominio para evitar spam.
- Si el proveedor limita el remitente, usar exactamente el dominio verificado en
  `SMTP_FROM`.

## Tests

Las pruebas usan `SMTP_HOST` vacío (transporte JSON). No se envían correos
reales en CI.
