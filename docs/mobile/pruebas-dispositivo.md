# Pruebas en dispositivo y build EAS

## Requisitos

- Cuenta de Expo/EAS (para generar APK).
- Android Studio con un emulador, o un teléfono con Expo Go.
- API accesible desde el dispositivo.
- SDK 58 compatible con Expo Go.

## Probar con Expo Go

```bash
./scripts/start.sh
EXPO_PUBLIC_API_URL=http://<IP-LAN>:4000/api npm run start --workspace @educar/mobile
```

- Emulador Android: `http://10.0.2.2:4000/api`.
- iOS simulator: `http://localhost:4000/api`.
- Escanear el QR con Expo Go.

## Generar APK

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build:configure
npm run build:android
```

El perfil `preview` genera un APK interno (`apps/mobile/eas.json`). Para
producción usar `--profile production`.

## Checklist de humo

| Caso | Resultado |
|---|---|
| Login con padre (`marta.madre`) | |
| Restauración de sesión al cerrar y abrir | |
| Resumen con cuotas y saldo | |
| Detalle de factura e ítems | |
| Selección de ítems y total | |
| Datos bancarios visibles | |
| Carga de comprobante PDF/imagen | |
| Comprobante pendiente en historial | |
| Login admin y aprobación/rechazo | |
| Padre ve el pago aprobado y descarga el comprobante | |
| Login con token vencido → rechazo | |
| API caída → mensaje de error | |

## Evidencias

Guardar capturas y versión del build en `docs/mobile/evidencias/` (o enlace
externo). Registrar fecha, dispositivo, versión de Android y URL de API usada.
