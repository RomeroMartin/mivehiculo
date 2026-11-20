# Progreso del proyecto — Mi Vehículo

Última actualización: 20/11/2026. **Leer esto al empezar cada sesión**, junto con `CLAUDE.md` y `docs/PLAN.md`.

## Dónde estamos

| Fase | Estado |
| --- | --- |
| 0 — Preparación | ✅ Cerrada |
| 1 — Cuentas y seguridad | ✅ Cerrada y verificada en producción |
| 2 — Vehículos y kilometraje | ⏭️ **Siguiente** |
| 3 — Historial de services | Pendiente |
| 4 — Planes, vencimientos y tablero | Pendiente |
| 5 — Job de alertas | Pendiente |
| 6 — Pedido mensual de km | Pendiente |
| 7 — Informe para comprador | Pendiente |
| 8 — Cierre | Pendiente |

Todo lo hecho está en la rama `main` de `RomeroMartin/mivehiculo`. El dueño dio permiso permanente para subir directo a `main` (no hace falta PR). El flujo de trabajo es: desarrollar en la rama asignada a la sesión, hacer avance directo a `main` cuando esté probado (`git push origin HEAD:main`) y subir también la rama de la sesión.

## Qué existe hoy

**Datos del proyecto**
- Proyecto de Firebase: `mi-vehiculo-mantenimiento`. Dirección: `https://mi-vehiculo-mantenimiento.web.app`. Sin dominio propio.
- Firestore en `southamerica-east1`, modo producción. Plan Spark.
- Authentication con Google y email/contraseña habilitados.
- SDK de Firebase `12.19.0` desde la CDN de gstatic (versión repetida en las tres URLs de `public/js/firebase.js`). Herramientas: `firebase-tools@15.36.0`, `@firebase/rules-unit-testing@5.0.0`.

**Código**
- `public/index.html` + `js/paginas/index.js`: acceso (login con mail, registro, recuperar contraseña, Google, verificación de mail).
- `public/app.html` + `js/paginas/app.js`: tablero **provisorio** (solo muestra el nombre y cerrar sesión). Se reemplaza en la fase 4.
- `public/js/firebase.js`: inicialización, caché offline, y en localhost usa **solo los emuladores**. Re-exporta el SDK.
- `public/js/auth.js`: acciones de cuenta, guardia `exigirSesion()`, creación de `usuarios/{uid}` en el primer ingreso, errores en castellano.
- `public/js/ui.js`: helpers que arman HTML con `textContent` (regla 2).
- `public/css/estilos.css`: estilos mínimos (el diseño se define aparte).
- `firestore.rules`: reglas **completas** con validación de esquema para usuarios, vehículos, lecturas, services, planes, vencimientos e informes.
- `firestore.indexes.json`: índices de grupo de colecciones para el job de alertas.
- `firebase.json`: hosting con cabeceras de seguridad (CSP, etc.), emuladores, reglas e índices.
- `tests/reglas.test.js`: 26 tests con el emulador.

**Todavía no existen:** `public/js/shared/` (`fechas.js`, `calculos.js`, `plantillas.js`), `public/js/db/`, `tests/calculos.test.js`, `job/`, `.github/workflows/alertas.yml`, `manifest.webmanifest`, `README.md`.

## Cómo se trabaja (el dueño usa Windows con VS Code y Git Bash)

```bash
git pull                 # el upstream de main ya está configurado
npm install              # una vez, o cuando cambie package.json
npm run test:reglas      # tests de reglas con emulador (Java instalado: Temurin 21)
npm run emuladores       # emuladores a mano; la app en http://localhost:5000
```

Deploy **manual** (no hay workflow de deploy; se descartó por problemas con Google Cloud):

```bash
npx firebase-tools@15.36.0 deploy --only hosting --project mi-vehiculo-mantenimiento
# si cambiaron reglas o índices:
npx firebase-tools@15.36.0 deploy --only hosting,firestore:rules,firestore:indexes --project mi-vehiculo-mantenimiento
```

Después de publicar, abrir la app y recargar con Ctrl + F5.

## Decisiones tomadas (resumen; el detalle y el porqué están en `docs/PLAN.md`)

- Sin fotos, documentos, chasis ni motor. Sin carga de archivos.
- Fechas de calendario como texto `"AAAA-MM-DD"`; zona fija de Argentina.
- Avisos de mail solo al mail verificado de la cuenta; sin mails de terceros.
- Mails con Resend usando `onboarding@resend.dev` (solo llega al dueño de la cuenta de Resend) hasta que se compre un dominio.
- Hosting en Firebase; Cloudflare no se usa.
- Nombre de la app: **Mi Vehículo**.
- CSP con `style-src 'unsafe-inline'` (por el login con Google). Los mails de verificación y de recuperar contraseña los manda Firebase.

## Notas para la fase 2 (y siguientes)

- **Las reglas de `firestore.rules` son estrictas** (`keys().hasOnly(...)` y `hasAll(...)`). Si la fase 2 necesita otro campo en un vehículo o una lectura, hay que agregarlo en las reglas **y** en `tests/reglas.test.js`, y publicar las reglas junto con el sitio.
- Respetar las reglas de `CLAUDE.md`: fechas en texto, `textContent`, `shared/` sin Firebase ni DOM, `recalcularKmVehiculo()` como única escritura de `kmActual`/`fechaKmActual`/`kmDiario`, todo en `writeBatch`.
- La validación de km va **por fecha contra las lecturas vecinas** (no contra la última cargada), para poder cargar historial viejo. Un service siempre se guarda; solo crea lectura si encaja. Ver sección Kilometraje del plan.
- El borrado de vehículos usa `borrando: true` y es reanudable (tandas de 500). Ver "Borrado" en el plan.
- La guía de pruebas manuales de la fase 1 se hizo con un recorrido en navegador (Playwright) contra los emuladores, sirviendo el SDK de gstatic desde una copia local porque el entorno de desarrollo en la nube no llega a gstatic ni a apis.google.com. Esa prueba **no está en el repo**. Si se quiere una prueba de interfaz automatizada, hay que crearla en el repo. El popup de Google solo se puede probar en producción.
- En la nube de Claude Code, `npm run test:reglas` funciona (Java disponible). El emulador deja el puerto ocupado si se corta un proceso: `pkill -f cloud-firestore-emulator`.
- Para las pruebas de interfaz con emuladores, los datos quedan bajo el ID de proyecto de la app (`mi-vehiculo-mantenimiento`) dentro del emulador, no bajo `demo-mi-vehiculo`.

## Pendientes

Ninguno bloquea las fases 2, 3 y 4. Los dos primeros se necesitan para la fase 5.

### Para la fase 5 (job de alertas)

- [ ] **Cuenta de Resend** con el mail personal del dueño. Crear una API key con permiso "Sending access" y dominio "All domains". La clave empieza con `re_` y se muestra una sola vez: guardarla en un gestor de contraseñas, nunca en el repo ni en el chat. Remitente: `Mi Vehículo <onboarding@resend.dev>`.
- [ ] **Cuenta de Healthchecks.io**: crear un check "Mi Vehiculo alertas" con período de 1 día y margen ("grace") de 2 horas, con aviso por email. Guardar la Ping URL (`https://hc-ping.com/...`).
- [ ] **Clave de cuenta de servicio** para el job de alertas: en la consola de Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. No pasa por IAM de Google Cloud. Va solo al secret de GitHub, nunca al repo.
- [ ] **Secrets de GitHub** (Settings → Secrets and variables → Actions): `FIREBASE_SERVICE_ACCOUNT`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL` (`https://mi-vehiculo-mantenimiento.web.app`), `HEALTHCHECK_URL`.

### Para la fase 8 (cierre)

- [ ] **App Check**: registrar la app web y exigirlo recién al final. Pide claves de reCAPTCHA que se crean pasando por Google Cloud (donde hubo problemas), por eso se deja para el final. Mientras tanto, las reglas protegen los datos.

### Opcionales

- [ ] **Proteger `main` en GitHub** (Settings → Rules → Rulesets): solo "Restrict deletions" y "Block force pushes". **No** activar "Require a pull request", porque impediría el avance directo a `main`. En repos privados con plan gratuito puede no estar disponible; no es esencial.
- [ ] **Restringir la API key de Firebase** en Google Cloud → Credenciales a `mi-vehiculo-mantenimiento.web.app`, `mi-vehiculo-mantenimiento.firebaseapp.com` y `localhost`. Es una capa extra; se puede postergar si Google Cloud da problemas.
- [ ] **Plantilla de mails de Firebase**: en Authentication → Plantillas, poner el idioma en español. Los mails salen de `noreply@mi-vehiculo-mantenimiento.firebaseapp.com` y pueden caer en spam.
- [ ] **Probar el login con Google en Chrome de Android** (ya probado en Chrome de PC y Safari de iPhone; el riesgo es muy bajo).
- [ ] **Avisos de `npm install`** (19 vulnerabilidades en herramientas de desarrollo, no en el sitio): revisar con calma más adelante. No correr `npm audit fix --force` porque rompe las versiones fijadas.

### Decisiones abiertas

- [ ] Cuándo comprar un dominio propio. **Obligatorio antes de que otras personas reciban mails** (sin dominio verificado, Resend solo manda al dueño de la cuenta). Con el dominio: verificarlo en Resend (SPF, DKIM), agregar DMARC y cambiar `MAIL_FROM`.
- [ ] Diseño de la interfaz (está fuera de este plan; hoy los estilos son mínimos).
- [ ] Automatizar el deploy con GitHub Actions: descartado por ahora. Se retoma solo si publicar a mano molesta.

## Cómo arrancar la próxima sesión

Mensaje sugerido:

> Leé `CLAUDE.md`, `docs/PROGRESO.md` y `docs/PLAN.md`. Las fases 0 y 1 están cerradas. Hagamos la fase 2.

Al cerrar cada fase: probar, actualizar la tabla de arriba y los pendientes de este archivo, y subir a `main`.
