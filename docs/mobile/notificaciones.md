# Notificaciones automáticas

## Reglas

- **Recordatorio mensual:** el último día hábil del mes.
- **Aviso de deuda:** el día 20 de cada mes.
- Solo se envía a padres con saldo pendiente y correo configurado.
- Cada envío queda en `notification_deliveries` con una clave de idempotencia
  (`tipo:año-mes:usuario`). Un reintento no duplica el correo.

La lógica de fecha está en `apps/api/src/billingNotifications.service.ts`
(`isLastBusinessDayOfMonth`, `isDebtNoticeDay`) y usa UTC. Los feriados
nacionales no se calculan: si el último día del mes cae en feriado, se considera
hábil. Documentar y ajustar si la institución lo requiere.

## Ejecución programada

`.github/workflows/billing-notifications.yml` corre todos los días a las 12:00
UTC (09:00 en Argentina) y llama dos veces al endpoint interno:

```text
POST /api/internal/notifications/run
x-internal-token: <NOTIFICATIONS_TOKEN>
{ "kind": "reminders", "year": 2026, "month": 11 }
{ "kind": "debt", "year": 2026, "month": 11 }
```

La API responde `reason: "not_last_business_day"` o
`"not_debt_notice_day"` fuera de fecha, sin enviar nada.

### Secretos de GitHub Actions

| Secreto | Valor |
|---|---|
| `APP_URL` | URL pública de la API, sin `/api` final |
| `NOTIFICATIONS_TOKEN` | Mismo valor que `NOTIFICATIONS_TOKEN` de Render |

Sin estos secretos el workflow falla; el envío manual sigue disponible desde el
panel de administración.

## Ejecución manual

Los endpoints de administración fuerzan el envío aunque la fecha no coincida:

```text
POST /api/admin/billing/notifications/reminders
POST /api/admin/billing/notifications/debt
{ "year": 2026, "month": 11 }
```

## Alternativa Render Cron

Si el plan de Render lo permite, se puede agregar un servicio `type: cron` con
`schedule: "0 12 * * *"` y `startCommand: node scripts/billing-notifications.mjs`
(script pendiente de crear) en lugar del workflow de GitHub Actions.
