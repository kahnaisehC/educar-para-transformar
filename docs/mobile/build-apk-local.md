# Build local del APK (podman)

Procedimiento reproducible para generar un APK instalable de `apps/mobile`
sin cuentas externas ni Android SDK en el host. Se usa cuando EAS Build no
está disponible y GitHub Actions está bloqueado.

## Resultado esperado

```
apps/mobile/dist/educar-movil-1.0.0-arm64.apk   (~29 MB)
```

## Requisitos del host

- podman (o Docker, ajustando el comando)
- ~12 GB de disco libre
- red para bajar SDK, NDK y dependencias de Gradle

No hace falta Java ni Android SDK: todo vive en la imagen.

## Versiones que impone el proyecto

Salen de `apps/mobile/android/` tras `expo prebuild`:

| Componente | Versión |
|---|---|
| compileSdk | 37 |
| targetSdk | 36 |
| minSdk | 24 |
| NDK | 27.1.12297006 |
| CMake | 3.22.1 |
| Gradle | 9.4.1 |
| JDK | 17 |

El `compileSdk 37` no es obvio: el fallback del plugin de Expo dice 36, pero
React Native 0.88 lo define explícitamente en 37. Si la imagen sólo trae 36,
Gradle falla con `Failed to install the following SDK components`.

## 1. Preparar el proyecto nativo

`android/` es código generado y está en `.gitignore`.

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install
```

`prebuild` reescribe los scripts `android`/`ios` de `package.json` a
`expo run:android` / `expo run:ios`. Revertir con `git checkout -- package.json`
si no se quieren esos cambios.

## 2. Construir la imagen (una sola vez)

```bash
cd /tmp/opencode/apk-build
podman build -t educar-android-builder .
```

La imagen instala JDK 17, Node 22, cmdline-tools, `platforms;android-36`,
`platforms;android-37.0`, `build-tools;37.0.0`, `cmake;3.22.1` y el NDK.
El SDK queda con permisos de escritura para que AGP pueda bajar componentes
faltantes en tiempo de build.

## 3. Compilar

```bash
API_URL=https://educar-api-d7l3.onrender.com/api ./build.sh arm64-v8a
```

El script (`build.sh`) monta el repo, fija `GRADLE_USER_HOME` en un volumen
persistente y ejecuta `./gradlew assembleRelease`.

### Sobre la URL de la API

`EXPO_PUBLIC_API_URL` se inlinea en el bundle **en tiempo de compilación**.
Consideraciones:

- Tiene que ser HTTPS. Android bloquea tráfico cleartext en apps standalone, así
  que una IP de LAN por `http://` no funciona en el APK (sí en Expo Go).
- En EAS Build no alcanza con exportar la variable en el shell: hay que
  declararla en `eas.json` (`build.<perfil>.env`) porque el build corre en un
  servidor remoto.
- La tarea de Metro **no** declara las variables `EXPO_PUBLIC_*` como inputs.
  Si se regenera el APK con otra URL, hay que borrar antes
  `app/build/generated/assets` y `app/build/intermediates/assets`, o Gradle
  marca el bundle como `UP-TO-DATE` y deja la URL vieja.

### Arquitecturas

`gradle.properties` declara cuatro ABIs. Compilar las cuatro multiplica el
tiempo de C++ (reanimated, worklets). Para teléfonos reales alcanza con
`arm64-v8a`; usar `armeabi-v7a` sólo si hace falta un dispositivo de 32 bits.
Un APK `arm64-v8a` **no instala** en emuladores x86.

## 4. Verificar el artefacto

```bash
cd apps/mobile/android/app/build/outputs/apk/release
podman run --rm --userns=keep-id -v "$PWD":/apk:Z educar-android-builder bash -c '
  BT=/opt/android-sdk/build-tools/37.0.0
  $BT/aapt2 dump badging /apk/app-release.apk | grep -E "^package|targetSdk|native-code"
  $BT/apksigner verify --print-certs /apk/app-release.apk | head -2
'
```

Y comprobar que el bundle apunte al host correcto:

```bash
python3 - <<'PY'
import zipfile
data = zipfile.ZipFile("app-release.apk").read("assets/index.android.bundle")
print(b"educar-api-d7l3.onrender.com" in data)
PY
```

## 5. Instalar en el teléfono

Por cable, con `adb` del SDK:

```bash
adb install -r apps/mobile/dist/educar-movil-1.0.0-arm64.apk
```

O copiando el `.apk` al teléfono y abriéndolo. Al estar firmado con la keystore
de debug (`Android Debug`), Android pide habilitar "instalar apps de origen
desconocido" y Play Protect puede mostrar una advertencia.

## Errores conocidos corriendo el APK

### `Unsupported FormDataPart implementation` al subir un comprobante

Síntoma: en Pagos, al enviar el comprobante, la app muestra ese texto.

Causa: en Expo SDK 58 el `fetch` global es el de Expo
(`expo/src/winter/fetch/convertFormData.ts`), no el de React Native. Su
`convertFormDataAsync` sólo acepta:

1. `string`
2. instancias de `Blob`
3. objetos con método `bytes()`

El pseudo-blob que documenta React Native para archivos
(`formData.append("file", { uri, name, type })`) **no** entra en ninguna de las
tres ramas y cae al `throw` de la línea 77.

Solución aplicada en `app/parent/pagos.tsx`: se envía un objeto que cumple las
dos interfaces a la vez:

```ts
const source = new ExpoFile(file.uri); // expo-file-system
formData.append("file", {
  uri: file.uri,   // lo usa la red nativa de RN
  name: file.name,
  type: file.type,
  bytes: () => source.bytes(), // lo usa el fetch de Expo
} as unknown as Blob);
```

El MIME se resuelve por extensión (`pdf`, `png`, `jpg`, `jpeg`) porque la API
sólo acepta `application/pdf`, `image/png` e `image/jpeg`
(`ALLOWED_RECEIPT_TYPES` en `apps/api/src/app.ts`).

En web no aplica: ahí `Platform.OS === "web"` usa el `File` real del
`DocumentPicker`, que el navegador sí entiende.

## Limitaciones conocidas

- **Firma de debug:** el APK sirve para demo y pruebas, no para distribución.
  Para publicar hace falta una keystore propia y `assembleRelease` con
  `signingConfigs.release`.
- **Render free duerme la instancia:** la primera request puede tardar 30-60 s.
  La app no muestra un indicador específico de ese arranque en frío.
- **Una sola arquitectura:** ver la sección de ABIs.
- **Sin auto-actualización:** no se configuró `expo-updates`; cada cambio
  requiere recompilar e instalar.
