# Plan de desarrollo — Mi Vehículo (app de mantenimiento vehicular)

Versión 2.2 · 18/11/2026 · Autor: Romero Martín
(Reemplaza al borrador del 17/11/2026. Al final hay un registro de qué cambió y por qué.)

## Resumen

App web 100% frontend (HTML, CSS, JS vanilla) para llevar el historial de mantenimiento de uno o varios vehículos. Avisa por mail los vencimientos por fecha (VTV, matafuegos, seguro) y los services por kilometraje (aceite, bujías, distribución). Es para uso propio, pero se arma multiusuario desde el día uno para poder venderla después.

Decisiones tomadas:

- **Backend:** Firebase en plan Spark (gratis, sin pausas). No se usa Supabase para evitar la pausa semanal del plan gratis.
- **Hosting:** Firebase Hosting (mismo proyecto que la base y el login). Evita problemas del login con Google entre dominios distintos, sobre todo en Safari/iPhone. No se compra dominio por ahora: la app vive en la dirección gratuita que da Firebase (`https://<proyecto>.web.app`). Si más adelante se compra uno, se agrega en Hosting sin cambiar nada más. Cloudflare no se usa.
- **Nombre de la app:** "Mi Vehículo".
- **Deploy manual:** se publica a mano con `firebase deploy` desde tu computadora, después de correr los tests. No hay publicación automática: evita crear y cuidar una cuenta de servicio de deploy y los problemas de permisos de Google Cloud. Si algún día se quiere automatizar, se retoma (ver "Deploy").
- **Mails:** un script diario en GitHub Actions (repo privado) que lee Firestore y manda con Resend. Sin dominio propio verificado, Resend solo permite enviar al mail de la cuenta de Resend, o sea al tuyo. Para uso propio alcanza; mandar a otros usuarios queda para cuando se compre un dominio.
- **Sin fotos ni documentos:** la app no guarda imágenes, cédulas, pólizas ni números de chasis o motor. Solo datos livianos de texto y números. Esto reduce costos, riesgos legales y complejidad.
- **Avisos solo al mail de la cuenta**, que debe estar verificado. Mails adicionales quedan para la versión comercial.
- **Kilometraje:** la app estima los km diarios con las lecturas que carga el usuario y le pide por mail una lectura nueva una vez por mes.
- **Alcance:** versión completa de una vez, desarrollada por fases con Claude Code.
- **Fuera de este plan:** el diseño de la interfaz, que se define aparte.

## Reglas transversales

Valen para todo el código y se revisan en cada fase.

1. **Fechas de calendario como texto `"AAAA-MM-DD"`**: vencimientos, fecha de service, fecha de lectura, fecha de compra, etc. Nunca como `timestamp`, para evitar el error de "un día de diferencia" por zona horaria. Los `timestamp` se usan solo en `creado` y `actualizado`. Toda la lógica de fechas vive en `shared/fechas.js`.
2. **Zona horaria fija: `America/Argentina/Buenos_Aires`.** Es una constante, no un dato del usuario. Si algún día se vende fuera de Argentina, se vuelve configurable.
3. **Todo texto escrito por el usuario se muestra con `textContent`**, nunca con `innerHTML` ni concatenado en un HTML. Si alguien escribe código en el campo "taller", tiene que verse como texto y no ejecutarse. Esto importa más en el informe público, que lo ve un tercero. Hay una función única `crearElemento()` o `esc()` en `js/ui.js` para armar el HTML con seguridad.
4. **Hay una sola función que escribe cada dato derivado.** Los km actuales del vehículo los calcula únicamente `recalcularKmVehiculo()`; el estado de un plan lo calcula únicamente `recalcularPlan()`. Los dos son puros, viven en `shared/` y tienen tests. Ningún otro código toca esos campos.
5. **Montos en pesos como `number` entero**, sin centavos.
6. **Operaciones que tocan varios documentos van en un `writeBatch`** (o transacción), nunca en escrituras sueltas.
7. **Versiones del SDK de Firebase fijadas** en la URL de la CDN (versión exacta, la última estable al empezar), nunca "latest".

## Funcionalidades

La v1 tiene ocho módulos.

| Módulo | Qué hace |
| --- | --- |
| Cuenta | Registro e inicio de sesión (Google y email + contraseña con verificación de mail), recuperar contraseña, preferencias de avisos. |
| Vehículos | Alta, edición, archivo y baja de varios vehículos: patente, marca, modelo, versión, año, color, combustible, fecha de compra, km al comprarlo. |
| Kilometraje | Cargar una lectura del odómetro (fecha + km), ver el historial de lecturas y el promedio estimado de km por día. |
| Historial de services | Cada registro: fecha, km, tipo, taller, mecánico, descripción, lista de piezas (repuesto, marca, código, cantidad, precio), mano de obra, total. Filtros por tipo y por año. |
| Planes de mantenimiento | Reglas periódicas por vehículo: "aceite y filtro cada 10.000 km o 12 meses". La app calcula cuándo toca el próximo. Trae una plantilla con los services típicos. |
| Vencimientos | Fechas que vencen: VTV, matafuegos, seguro, patente, carnet, GNC. Cada uno con días de aviso previos y renovación (al renovar, se carga la nueva fecha). |
| Alertas por mail | Un mail diario de resumen si hay algo por vencer, y uno mensual pidiendo actualizar el kilometraje. |
| Informe para comprador | Link público de solo lectura con el historial del vehículo, sin datos personales, imprimible como PDF. |

El tablero de inicio muestra, por vehículo, lo próximo a vencer (por fecha y por km) ordenado por urgencia.

**No existe** carga de fotos, facturas escaneadas ni documentos (cédulas, póliza, título). Tampoco se guardan chasis ni motor. Si más adelante se quisiera, es una fase nueva con su propio análisis de privacidad y costos.

## Arquitectura

No hay servidor propio: el navegador habla directo con Firebase, y una vez por día GitHub Actions corre un script que revisa los datos y manda los mails.

```
                 ┌───────────────────────────────┐
  Navegador ───► │ Firebase Hosting (sitio       │
  (celular/PC)   │ estático: HTML + CSS + JS)    │
      │          └───────────────────────────────┘
      │ SDK de Firebase (reglas de seguridad)
      ▼
┌──────────────────┐  ┌────────────────────┐
│ Firebase Auth    │  │ Firestore          │ ◄── cuenta de servicio (sin reglas)
│ Google + email   │  │ datos de texto     │            ▲
└──────────────────┘  └────────────────────┘            │
                                                 ┌──────┴────────────┐
                                                 │ GitHub Actions     │
                                                 │ job diario 8:00 AR │
                                                 └──┬──────────────┬──┘
                                                    │              │
                                            ┌───────▼─────┐  ┌─────▼──────────┐
                                            │ Resend      │  │ Healthchecks.io │
                                            │ (mails)     │  │ (latido)        │
                                            └─────────────┘  └─────────────────┘
```

Seis piezas, todas en plan gratis: Firebase Hosting, Firebase Auth, Firestore, GitHub Actions, Resend y Healthchecks.io.

La app y el job usan Firestore por caminos distintos. La app pasa por las reglas de seguridad. El job usa la cuenta de servicio, que puede leer a todos los usuarios para armar sus avisos.

- **Frontend:** páginas HTML separadas, sin framework ni paso de compilación. El SDK modular de Firebase se carga desde la CDN de gstatic, con versión fijada. Firestore con caché offline activada (`persistentLocalCache`), porque en el taller a veces no hay señal.
- **Job:** Node 20 con `firebase-admin`. Resend se llama con `fetch`, sin SDK.
- **Cálculos compartidos:** un módulo de JS puro que usan la app y el job, así los dos calculan igual.

## Modelo de datos (Firestore)

Todo cuelga del usuario, así las reglas de seguridad quedan simples: cada uno lee y escribe solo bajo su `uid`. La única colección de primer nivel aparte es `informes`, que es pública.

Convención: `fecha*` y similares son texto `"AAAA-MM-DD"`; `creado` y `actualizado` son `timestamp`.

```
usuarios/{uid}
  nombre: string
  email: string                      // debe ser igual al de la cuenta (lo exigen las reglas)
  avisosResumen: bool                // default true: mail diario de vencimientos
  pedirKmMensual: bool               // default true: mail mensual de km
  ultimoPedidoKm: string | null      // fecha del último mail de km
  borrando: bool                     // true mientras se borra la cuenta (ver Borrado)
  creado, actualizado: timestamp

usuarios/{uid}/vehiculos/{vid}
  patente, marca, modelo, version, color: string
  anio: number
  combustible: 'nafta' | 'diesel' | 'gnc' | 'electrico' | 'hibrido'
  fechaCompra: string | null
  kmCompra: number | null
  kmActual: number                   // lo escribe solo recalcularKmVehiculo()
  fechaKmActual: string
  kmDiario: number | null            // idem
  activo: bool                       // false = vendido / archivado
  borrando: bool                     // true mientras se borra el vehículo
  informeToken: string | null        // link público activo, si hay
  creado, actualizado: timestamp

.../vehiculos/{vid}/lecturasKm/{id}
  fecha: string
  km: number
  origen: 'manual' | 'service' | 'alta'
  creado: timestamp                  // desempata lecturas del mismo día

.../vehiculos/{vid}/services/{id}
  fecha: string
  km: number
  tipo: string                       // 'service', 'reparación', 'neumáticos', etc.
  taller, mecanico, descripcion: string
  piezas: [{ repuesto, marca, codigo: string, cantidad: number, precioUnit: number }]  // máx. 50
  manoObra: number
  total: number                      // suma calculada al guardar
  planesCumplidos: string[]          // ids de planes que este service resetea
  lecturaId: string | null           // lectura de km creada por este service, si hubo
  creado, actualizado: timestamp

.../vehiculos/{vid}/planes/{id}
  nombre: string                     // 'Aceite y filtro'
  cadaKm: number | null
  cadaMeses: number | null           // al menos uno de los dos
  ultimoKm: number | null            // lo escribe solo recalcularPlan()
  ultimaFecha: string | null         // idem
  avisoKmAntes: number               // default 500
  avisoDiasAntes: number             // default 15
  activo: bool
  ultimoAviso: string | null         // clave de idempotencia (ver Job diario)

.../vehiculos/{vid}/vencimientos/{id}
  tipo: 'vtv' | 'matafuegos' | 'seguro' | 'patente' | 'carnet' | 'gnc' | 'otro'
  descripcion: string
  fechaVence: string
  diasAviso: number[]                // default [30, 7, 0]
  activo: bool
  avisosEnviados: string[]           // claves de idempotencia

usuarios/{uid}/avisos/{id}           // log de mails enviados (lo escribe el job)
  fecha: string
  tipo: 'resumen' | 'pedido_km'
  items: number
  resendId: string

informes/{token}                     // público, solo lectura
  uid, vehiculoId: string
  activo: bool
  actualizado: timestamp
  datos: { vehiculo: {...}, services: [...], kmActual, generado }
```

Puntos clave para Claude Code:

- Con todo en texto y números, un usuario típico ocupa unos pocos cientos de KB. No hay imágenes en ninguna parte.
- `kmActual`, `fechaKmActual` y `kmDiario` del vehículo se recalculan con `recalcularKmVehiculo(lecturas)` y se escriben en el mismo `writeBatch` que crea, edita o borra la lectura.
- Un vehículo tiene a lo sumo unos pocos cientos de lecturas por año. Aun así, las consultas del tablero usan `limit` donde corresponda.

## Reglas de seguridad

Cada usuario solo accede a lo suyo, y los informes públicos se leen por token, nunca se listan. El job diario usa la cuenta de servicio (Admin SDK), que no pasa por estas reglas.

Cambios clave respecto al borrador: **solo escribe quien tiene el mail verificado** (los usuarios de Google ya lo tienen; los de email + contraseña deben hacer clic en el link de verificación), y **el campo `email` del usuario debe coincidir con el de su cuenta**. Así nadie puede cargar el mail de otra persona para que le lleguen avisos.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function isOwner(uid) {
      return request.auth != null
        && request.auth.uid == uid
        && request.auth.token.email_verified == true;
    }

    match /usuarios/{uid} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid)
        && request.resource.data.email == request.auth.token.email
        && request.resource.data.nombre is string
        && request.resource.data.nombre.size() <= 100;

      // log de mails: solo lo escribe el job
      match /avisos/{id} {
        allow read: if isOwner(uid);
        allow write: if false;
      }

      match /vehiculos/{vid} {
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid)
          && request.resource.data.patente is string
          && request.resource.data.patente.size() <= 12;

        match /lecturasKm/{id}   { allow read, write: if isOwner(uid); }
        match /services/{id} {
          allow read, delete: if isOwner(uid);
          allow create, update: if isOwner(uid)
            && request.resource.data.piezas.size() <= 50;
        }
        match /planes/{id}       { allow read, write: if isOwner(uid); }
        match /vencimientos/{id} { allow read, write: if isOwner(uid); }
      }
    }

    match /informes/{token} {
      allow get: if resource.data.activo == true;
      allow list: if false;
      allow create: if isOwner(request.resource.data.uid);
      allow update, delete: if isOwner(resource.data.uid);
    }
  }
}
```

- Este bloque es el esqueleto. En la fase 1 se completan las validaciones (largos máximos de textos, tipos de cada campo, `keys().hasOnly(...)` en el informe para que nadie guarde datos arbitrarios) y se prueban con el emulador.
- Las subcolecciones se listan una por una y no con un comodín, para que cada una tenga sus propias validaciones (en Firestore alcanza con que una regla permita, así que un comodín anularía las demás).
- Como en el plan Spark el corte por cuota es duro (no hay factura sorpresa), el riesgo es que un usuario malicioso agote la cuota gratis. Se cubre con **App Check** (ver Configuración externa) y con los topes de tamaño de arriba.
- Probar las reglas con el emulador de Firebase antes de publicar. Los tests de reglas usan la librería `@firebase/rules-unit-testing` y el emulador necesita Java instalado.

### Borrado de vehículos y de cuenta

Firestore no borra las subcolecciones al borrar un documento, y el navegador puede cerrarse a mitad del borrado. Por eso:

1. Se marca `borrando: true` en el vehículo (o en el usuario).
2. Se borran las subcolecciones por tandas de 500 documentos.
3. Recién al final se borra el documento principal (y, para la cuenta, el usuario de Auth).
4. Si queda algo con `borrando: true`, la app lo detecta al iniciar sesión y retoma el borrado. Todo lo que tenga `borrando: true` se oculta de las listas.
5. Al borrar un vehículo con informe activo, se desactiva el informe antes de empezar.

Existe `activo: false` para archivar un vehículo sin borrarlo.

## Kilometraje

La app nunca sabe los km reales del día: los estima con las lecturas que carga el usuario y le pide una nueva cuando pasan 30 días sin cargar.

**De dónde salen las lecturas**

- Al dar de alta el vehículo (`origen: 'alta'`).
- A mano, desde la app o desde el link del mail mensual (`'manual'`).
- Al registrar un service (`'service'`), si encaja con las lecturas existentes (ver abajo).

**Validación al cargar** (siempre por fecha, no por orden de carga)

Una lectura nueva con fecha *F* y km *K* es válida si `km de la lectura anterior a F ≤ K ≤ km de la lectura posterior a F`. Esto permite **cargar historial viejo** sin romper nada: un service de hace dos años a 40.000 km se acepta si las lecturas de esa época lo permiten.

- Si no encaja, la app lo marca y pide confirmación. El usuario puede marcar "cambio de tablero / corrección"; en ese caso se borran las lecturas posteriores a esa fecha (con confirmación explícita).
- Si el salto implica más de 1.000 km por día respecto de la lectura vecina, se pide confirmación (probable error de tipeo).

**Service y lectura automática**

- Un service **siempre se guarda** con su fecha y km propios.
- Además crea una lectura (`origen: 'service'`) solo si encaja con las vecinas según la regla de arriba. Si no encaja, el service se guarda igual, sin lectura, y la app avisa "este km no coincide con tus lecturas".
- Si el service se edita o se borra, se actualiza o elimina su lectura (`lecturaId`).

**Recalcular** (`recalcularKmVehiculo(lecturas)`, puro, en `shared/calculos.js`)

Toma todas las lecturas y devuelve `kmActual`, `fechaKmActual` y `kmDiario`:

1. `kmActual` y `fechaKmActual` salen de la lectura más reciente por fecha (desempata `creado`).
2. Para `kmDiario`: tomar las lecturas de los últimos 180 días.
3. Si hay al menos 2 y cubren 14 días o más: `(km más nueva − km más vieja) / días entre ambas`.
4. Si no alcanza: usar `kmCompra` y `fechaCompra` contra la lectura actual.
5. Si tampoco hay datos: `kmDiario = null`. Los planes por km solo avisan con km reales, sin estimar.

**Km estimados para hoy**

```
kmEstimado = kmActual + kmDiario × díasDesdeLaLectura
```

Si la última lectura tiene más de 90 días, la estimación se muestra como "poco confiable" y el mail insiste en actualizar.

**Pedido mensual de km**

- El job diario manda el mail si `pedirKmMensual` es `true`, algún vehículo activo tiene `fechaKmActual` de hace más de 30 días, y `ultimoPedidoKm` es `null` o de hace más de 30 días.
- Va un solo mail por usuario, con la lista de vehículos a actualizar.
- Cada vehículo trae un link directo: `/km.html?v={vid}`. Pide iniciar sesión si hace falta y abre el formulario con el vehículo elegido.
- Se cuenta desde la última lectura y no por mes calendario: quien cargó km hace una semana no recibe el pedido.

## Planes de mantenimiento

Cada plan vence por km, por tiempo o por lo que llegue primero. Se resetea solo cuando se registra un service que lo incluye.

**Cálculo del estado** (función `estadoPlan(plan, vehiculo, hoy)`):

1. `proximoKm = ultimoKm + cadaKm` y `proximaFecha = ultimaFecha + cadaMeses` (con `fechas.js`; si el día no existe en el mes destino, se usa el último día del mes).
2. Si `cadaKm` existe y hay `kmDiario`, se estima el día en que se llega a `proximoKm`.
3. Estado `vencido`: los km estimados superan `proximoKm`, o la fecha de hoy pasa `proximaFecha`.
4. Estado `próximo`: faltan `avisoKmAntes` km o menos, o faltan `avisoDiasAntes` días o menos (por fecha o por la llegada estimada a los km).
5. Si no, `ok`. La función devuelve el estado y el motivo ("faltan ~420 km", "vence el 12/03").

**Reset:** `recalcularPlan(plan, services)` busca el service más nuevo que incluya el plan en `planesCumplidos` y toma de él `ultimoKm` y `ultimaFecha`. Si no hay ninguno, conserva los valores iniciales cargados al crear el plan. Se ejecuta, dentro del mismo `writeBatch`, cada vez que se guarda, edita o borra un service que toca ese plan, y pone `ultimoAviso` en `null`. Es la única función que escribe `ultimoKm` y `ultimaFecha`.

**Primer uso:** al crear un plan se pregunta cuándo se hizo por última vez. Si el usuario no lo sabe, se toman los km y la fecha de alta, y el plan arranca en `próximo` para que se revise.

**Plantilla sugerida** (valores orientativos: cada uno se ajusta al manual del vehículo):

| Plan | Cada km | Cada meses |
| --- | --- | --- |
| Aceite y filtro de aceite | 10.000 | 12 |
| Filtro de aire | 20.000 | 24 |
| Filtro de combustible | 20.000 | 24 |
| Filtro de habitáculo | 15.000 | 12 |
| Bujías | 30.000 | — |
| Correa de distribución y bomba de agua | 60.000 | 48 |
| Líquido de frenos | — | 24 |
| Líquido refrigerante | 40.000 | 24 |
| Rotación y alineación | 10.000 | — |
| Revisión de frenos | 20.000 | 12 |

**Código compartido:** `estadoPlan`, `estadoVencimiento`, `recalcularKmVehiculo` y `recalcularPlan` viven en `shared/calculos.js`, que usan el navegador y el job. Así el tablero y el mail nunca dicen cosas distintas.

## Job diario de alertas

Un script de Node corre todos los días a las 8:00 de Argentina en GitHub Actions. Le manda a cada usuario como máximo un mail de resumen y, si corresponde, uno de pedido de km.

**Workflow** (`.github/workflows/alertas.yml`)

- `schedule: cron '0 11 * * *'` (11:00 UTC = 8:00 en Argentina, que no tiene horario de verano) + `workflow_dispatch` para correrlo a mano.
- Node 20, `npm ci` en `job/`, y después `node job/alertas.js`.
- Secrets: `FIREBASE_SERVICE_ACCOUNT` (el JSON completo, solo lectura de datos), `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `HEALTHCHECK_URL`.
- GitHub puede demorar las tareas programadas en horas pico, e incluso saltearlas alguna vez. Para avisos diarios la demora no importa, pero la omisión hay que detectarla (ver Latido).
- Si el job falla, GitHub le manda un mail al dueño del repo.

**Latido (aviso si el job no corre)**

GitHub avisa cuando el job falla, pero no cuando directamente no se ejecuta. Para cubrir eso se usa Healthchecks.io (plan gratis):

- Al terminar bien, el job hace un `fetch` a `HEALTHCHECK_URL`. Si algo falla, hace `fetch` a `HEALTHCHECK_URL + '/fail'`.
- En Healthchecks se configura el check con período de 1 día y margen ("grace") de 2 horas. Si no llega señal en ese plazo, manda un mail al dueño.
- Si `HEALTHCHECK_URL` no está definido, el job lo ignora (para pruebas locales).

**Pasos del script**

1. Iniciar Firebase Admin con la cuenta de servicio. Calcular "hoy" en la zona horaria de Argentina (con `Intl`, no con la hora del servidor), como texto `AAAA-MM-DD`.
2. Leer en pocas consultas, con `collectionGroup`: vehículos activos, vencimientos activos y planes activos (ignorando los que estén bajo un usuario o vehículo con `borrando: true`). Agrupar por `uid` usando la ruta del documento. Leer los documentos `usuarios` de los uids involucrados.
3. **Vencimientos:** calcular los días que faltan. Tomar el umbral más chico de `diasAviso` ya cruzado. Si su clave (`{fechaVence}:{umbral}`) no está en `avisosEnviados`, entra en el resumen. Ya vencido, se vuelve a avisar a los 7 y a los 30 días (claves `post7` y `post30`) y después se deja de avisar.
4. **Planes:** correr `estadoPlan`. Si da `próximo` o `vencido` y `ultimoAviso` no es la clave de ese ciclo (`{proximoKm}|{proximaFecha}:{estado}`), entra en el resumen. Así cada ciclo avisa como máximo dos veces, y se reinicia con el service.
5. **Pedido de km:** aplicar la regla de la sección Kilometraje.
6. Respetar las preferencias: sin `avisosResumen` no se manda resumen; sin `pedirKmMensual` no se manda pedido de km.
7. Armar un mail por usuario: "Tenés 3 cosas por revisar en tus vehículos", agrupado por vehículo, ordenado por urgencia, con link a la app y link a Ajustes para apagar los avisos. Versión HTML simple + versión texto.
8. Enviar con la API de Resend (`POST https://api.resend.com/emails`) al mail de la cuenta (`usuarios.email`, que las reglas obligan a coincidir con el de Auth). Esperar ~600 ms entre envíos para respetar el límite de velocidad de Resend. Reintentar hasta 3 veces si responde 429 o 5xx. Si Resend rechaza el destinatario por no estar permitido (pasa con otros usuarios mientras no haya dominio verificado), registrarlo en el log, no marcar nada y seguir con el siguiente sin fallar. Si se alcanza el límite diario de Resend, cortar los envíos sin fallar: lo que no se marcó sale al día siguiente.
9. **Recién después de un envío exitoso**, marcar en Firestore con una escritura por lotes: las claves enviadas, `ultimoPedidoKm` y el registro en `usuarios/{uid}/avisos`. Si el envío falla, no se marca nada y se reintenta al día siguiente.
10. Imprimir un resumen en el log (usuarios revisados, mails enviados, errores) y enviar el latido.

**Modo prueba:** con `DRY_RUN=true`, el script imprime los mails que mandaría y no envía ni escribe nada. Con `ONLY_UID=xxx` procesa un solo usuario. Las dos variables sirven para probar con tu cuenta.

**Por qué marcar después de enviar:** si se marca antes y Resend falla, el aviso se pierde para siempre. Al revés, lo peor que puede pasar es un mail repetido, que es mucho menos grave.

## Informe para comprador

El informe es una copia del historial que la app publica en `informes/{token}`. El comprador abre un link sin iniciar sesión y nunca accede a los datos reales del dueño.

**Generar el link**

1. El dueño toca "Compartir historial" y elige qué mostrar. Por defecto: patente parcial (`AB***12`) y sin costos.
2. La app arma `datos`: vehículo (marca, modelo, versión, año, combustible), km actuales y services (fecha, km, tipo, taller, descripción, piezas con marca). Los precios solo van si se eligió mostrarlos.
3. Crea el informe con `token = crypto.randomUUID()` y guarda `informeToken` en el vehículo.
4. Comparte `APP_URL/informe.html?t={token}` con la API Web Share del celular, o lo copia al portapapeles.

**Mantenerlo al día:** cada vez que se guarda, edita o borra un service de un vehículo con `informeToken`, la app regenera `datos` en el mismo `writeBatch`. El comprador siempre ve lo último.

**Cortar el acceso:** "Dejar de compartir" pone `activo: false` (el link muestra "Este informe ya no está disponible"). Si se vuelve a compartir, se crea un token nuevo y el link viejo queda muerto. Al archivar o borrar el vehículo también se corta.

**Seguridad:** `informe.html` arma todo con `textContent` (regla transversal 3), porque lo escrito por el dueño lo ve un tercero.

**PDF:** `informe.html` tiene estilos `@media print` y un botón "Descargar PDF" que llama a `window.print()` (el navegador ofrece "Guardar como PDF"). No hace falta ninguna librería.

**Aclaración en el informe:** "Datos cargados por el propietario. Generado el {fecha}." Es un historial declarado, no una certificación, y debe decirlo para no prometer de más.

Un documento de Firestore admite hasta 1 MB, lo que alcanza para varios cientos de services. Si se pasa, se recortan las descripciones largas.

## Estructura del repo

Un solo repo privado: el sitio estático en `public/` (sin paso de compilación) y el job en `job/`, que reutiliza el mismo módulo de cálculos.

```
/
├─ public/                    ← lo que publica Firebase Hosting
│  ├─ index.html              login / registro / verificación de mail
│  ├─ app.html                tablero: vehículos + próximo a vencer
│  ├─ vehiculo.html           ?v=  datos, services, planes, vencimientos, km
│  ├─ km.html                 ?v=  carga rápida de km (link del mail)
│  ├─ informe.html            ?t=  informe público, sin login
│  ├─ ajustes.html            avisos, pedido mensual de km, borrar cuenta
│  ├─ manifest.webmanifest    para instalarla en el celular
│  ├─ css/
│  └─ js/
│     ├─ firebase.js          inicialización + exports del SDK modular (CDN gstatic)
│     ├─ auth.js              login, logout, verificación de mail, guardia de páginas privadas
│     ├─ ui.js                helpers para armar HTML de forma segura (textContent)
│     ├─ db/                  un archivo por colección: vehiculos, lecturas,
│     │                       services, planes, vencimientos, informes, borrado
│     ├─ shared/              SIN imports de Firebase ni del DOM (lo usa el job)
│     │  ├─ calculos.js       recalcularKmVehiculo, kmEstimado, estadoPlan,
│     │  │                    recalcularPlan, estadoVencimiento
│     │  ├─ fechas.js         "hoy" en zona AR, sumar meses, diferencia en días (todo sobre "AAAA-MM-DD")
│     │  └─ plantillas.js     planes sugeridos y tipos de vencimiento
│     └─ paginas/             un script por página HTML
├─ job/
│  ├─ package.json            "type": "module", dependencia firebase-admin
│  ├─ alertas.js              punto de entrada
│  ├─ mails.js                plantillas HTML + texto
│  └─ resend.js               envío con reintentos
├─ tests/
│  ├─ calculos.test.js        node:test, sin librerías
│  └─ reglas.test.js          emulador + @firebase/rules-unit-testing (necesita Java)
├─ package.json               solo herramientas de desarrollo (tests de reglas, firebase-tools)
├─ firestore.rules
├─ firestore.indexes.json
├─ firebase.json              hosting (public/, cabeceras CSP), emuladores, reglas e índices
├─ .github/workflows/
│  └─ alertas.yml             job diario de mails
├─ .firebaserc                id del proyecto de Firebase
├─ .gitignore                 incluye cualquier *.json de cuenta de servicio
├─ CLAUDE.md                  corto: reglas y convenciones; apunta a docs/PLAN.md
├─ docs/PLAN.md               este documento
└─ README.md
```

- El job importa `../public/js/shared/calculos.js`. Por eso `shared/` no puede usar nada del navegador.
- Las consultas `collectionGroup` con `where('activo', '==', true)` necesitan habilitar el índice de grupo de colecciones (`fieldOverrides` en `firestore.indexes.json`). Si no, el job falla con un error de índice.
- La config de Firebase en `firebase.js` es pública por diseño. La protección son las reglas, App Check y restringir la API key a `<proyecto>.web.app` y `localhost` (opcional, ver Configuración externa).
- `firebase.json` define cabeceras de seguridad para el hosting, incluida una política CSP (qué scripts y conexiones puede usar la página: solo la propia y los dominios de Firebase). Se ajusta en la fase 1 probando login, base y App Check.
- El deploy es manual (ver la sección siguiente).

## Deploy

La publicación es **manual**, desde tu computadora, con `firebase-tools`. No hay workflow de deploy ni cuenta de servicio de deploy.

**Una sola vez**

- Instalar Node 20 o más nuevo y, en la carpeta del repo, hacer `npx firebase-tools@15.36.0 login` (abre el navegador y entrás con tu cuenta de Google). No hace falta instalar nada de forma global.
- Para los tests de reglas (fase 1 en adelante) hace falta Java instalado.

**Cada vez que querés publicar** (siempre desde `main`, actualizado con `git pull`)

1. Correr los tests: `node --test tests/` y, desde que existan, los de reglas con el emulador.
2. Publicar según lo que cambió:
   - Solo el sitio: `npx firebase-tools@15.36.0 deploy --only hosting --project mi-vehiculo-mantenimiento`
   - Sitio, reglas e índices: `npx firebase-tools@15.36.0 deploy --only hosting,firestore:rules,firestore:indexes --project mi-vehiculo-mantenimiento`
3. Abrir `https://mi-vehiculo-mantenimiento.web.app` y comprobar que carga y que el login anda. Si algo quedó roto, se vuelve a la versión anterior desde la consola de Firebase → Hosting → "Versiones anteriores".

**Reglas del juego**

- Antes de publicar reglas, correr sus tests: una regla mal puesta deja la base abierta o inutilizable.
- Se publica solo lo que está en `main`, para que lo que está online siempre coincida con lo del repo.
- Con `.firebaserc` y `firebase.json` en el repo, no hace falta pasar `--project`, pero se deja explícito para no publicar en otro proyecto por error.

**Para más adelante (opcional)**

Si publicar a mano se vuelve molesto, se puede automatizar con GitHub Actions y una cuenta de servicio de deploy con permisos mínimos (Firebase Hosting Admin, Firebase Rules Admin y Cloud Datastore Index Admin), guardada solo como secret. Los pasos quedaron en el historial de este documento (versión 2.1).

## Configuración externa

Son cinco servicios y se configuran una sola vez, antes de la fase 1. Los pasos que no tienen vuelta atrás son la ubicación de Firestore y el nombre del proyecto.

**Firebase**

- [ ] Crear el proyecto (sin Google Analytics) y dejarlo en plan Spark.
- [ ] Authentication: habilitar Google y Email/contraseña.
- [ ] Firestore: crear la base en modo producción, ubicación `southamerica-east1` (San Pablo, la más cercana). **No se puede cambiar después.**
- [ ] Registrar una app web y copiar la config a `public/js/firebase.js`.
- [ ] Hosting: activarlo y publicar una página de prueba. Verificar el login con Google en la URL `*.web.app` desde **Safari en iPhone** y Chrome en Android antes de seguir.
- [ ] Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada. El JSON va solo al secret de GitHub, **nunca al repo**.
- [ ] App Check: registrar la app web con reCAPTCHA y dejarlo **sin exigir** hasta la fase 8 (para no bloquearte durante el desarrollo; se usa token de depuración en local).
- [ ] Primera publicación de reglas e índices (a mano), cuando existan en la fase 1: ver "Deploy".

**Resend**

- [ ] Crear la cuenta de Resend **con tu mail personal** (es al único que podrá mandar mientras no haya dominio verificado).
- [ ] Remitente: `Mi Vehículo <onboarding@resend.dev>` (el remitente de pruebas que da Resend). Usar siempre el mismo mail en Resend, en Firebase Auth y en el campo `email` del usuario.
- [ ] Crear una API key con permiso solo de envío.
- [ ] *Cuando se compre un dominio:* verificarlo en Resend (registros SPF y DKIM en el DNS; la propagación puede tardar días), agregar un registro DMARC (`v=DMARC1; p=none; rua=mailto:vos@tudominio`), y cambiar `MAIL_FROM` a `Mi Vehículo <avisos@tudominio>`. Recién ahí se puede mandar a otros usuarios.

**Healthchecks.io**

- [ ] Crear cuenta gratis y un check con período 1 día y margen 2 horas.
- [ ] Copiar la URL de ping al secret `HEALTHCHECK_URL` y configurar que avise a tu mail.

**GitHub**

- [ ] Repo **privado**.
- [ ] Proteger la rama `main` (Settings → Branches): exigir pull request antes de mergear.
- [ ] Secrets de alertas: `FIREBASE_SERVICE_ACCOUNT`, `RESEND_API_KEY`, `MAIL_FROM` (`Mi Vehículo <onboarding@resend.dev>`), `APP_URL` (la dirección `https://<proyecto>.web.app`), `HEALTHCHECK_URL`.

**Dirección de la app (sin dominio propio)**

- [ ] Usar la dirección gratuita `https://<proyecto>.web.app` (elegir bien el ID del proyecto al crearlo: ahí queda para siempre, por ejemplo `mi-vehiculo-app`). Firebase ya la tiene como dominio autorizado para el login.
- [ ] *Opcional:* en Google Cloud → Credenciales, restringir la API key de Firebase a esa dirección y a `localhost`. Es una capa extra: la protección real son las reglas y App Check, así que si Google Cloud da problemas se puede postergar sin riesgo para los datos.

## Límites del plan gratis

Sin fotos, el espacio deja de ser un problema. El primer techo pasa a ser el envío de mails.

| Servicio | Límite gratis | Consumo estimado | Techo aproximado |
| --- | --- | --- | --- |
| Firestore: datos guardados | 1 GiB total | ~0,3 MB por usuario (2 vehículos, ~100 services, lecturas, planes) | Miles de usuarios |
| Firestore: lecturas | 50.000 por día | ~30 por usuario en el job + uso de la app | ~1.000 usuarios activos |
| Firestore: escrituras | 20.000 por día | Pocas por usuario | Muy lejos |
| Firestore: transferencia | 10 GiB por mes | Solo texto | Muy lejos |
| Firebase Hosting | 10 GB almacenado, 360 MB por día | Sitio chico | Muy lejos |
| Resend | 3.000 por mes y 100 por día | 1 mail por usuario con avisos | ~100 mails por día |
| GitHub Actions (privado) | 2.000 minutos por mes | ~1 minuto por día | Muy lejos |
| Healthchecks.io | Plan gratis | 1 ping por día | Muy lejos |

- En Resend el límite diario es el que se toca primero: unos cientos de usuarios, según cuántos tengan algo para avisar cada día. Si un día se supera, el job corta los envíos (los avisos quedan sin marcar y salen al día siguiente), sin fallar.
- Al llegar a alguno de estos techos, el paso natural es el plan Blaze de Firebase (con alertas de presupuesto activadas) y el Pro de Resend (USD 20 por mes). Para entonces ya habría clientes que lo paguen.

Fuentes: [precios de Firebase](https://firebase.google.com/pricing), [precios de Resend](https://resend.com/docs/knowledge-base/what-is-resend-pricing). Datos consultados el 17/11/2026; volver a verificarlos antes de vender.

## Fases de desarrollo

Son nueve fases en orden, y cada una termina con algo que se puede probar. Con Claude Code conviene hacer una fase por sesión y un commit al cerrar cada una. El orden prioriza lo que da valor real (los avisos) y valida pronto lo más riesgoso (mails, GitHub Actions).

0. **Fase 0 — Preparación.** Configuración externa completa, repo con la estructura vacía, una página de prueba publicada a mano, `firebase.js`, emuladores de Auth y Firestore andando.
   - Listo cuando: una página de prueba escribe y lee un documento en el emulador, `firebase deploy` la publica en `https://<proyecto>.web.app`, y el login con Google funciona ahí desde Safari iPhone y Chrome Android.
1. **Fase 1 — Cuentas y seguridad.** Login con Google y email, verificación de mail, recuperar contraseña, guardia de páginas privadas, creación de `usuarios/{uid}` en el primer ingreso (con el mail ya verificado), reglas publicadas, cabeceras CSP, `ui.js`.
   - Listo cuando: un test en el emulador confirma que el usuario A no puede leer ni escribir nada del usuario B, que un usuario sin mail verificado no puede escribir, que no se puede guardar un `email` distinto al de la cuenta, y que un informe inactivo no se lee.
   - **Estado:** implementada y probada en emuladores (26 tests de reglas y recorrido completo de registro, verificación, login y recuperar contraseña). Pendiente: publicar las reglas y probar Google con la CSP en producción.
2. **Fase 2 — Vehículos y kilometraje.** Alta, edición y archivo de vehículos. Lecturas de km con validación por fecha. `shared/fechas.js` y `shared/calculos.js` con `recalcularKmVehiculo` y `kmEstimado`. Borrado reanudable de vehículos.
   - Listo cuando: `node --test` pasa casos de 0 lecturas, 1 lectura, lecturas en menos de 14 días, carga de lecturas viejas entre otras dos, corrección de tablero y salto de más de 1.000 km por día. Borrar un vehículo cerrando la pestaña a la mitad y reabriéndola termina el borrado.
3. **Fase 3 — Historial de services.** Alta y edición con lista de piezas dinámica, total automático, lectura de km automática (solo si encaja), filtros. Carga de historial viejo.
   - Listo cuando: un service reciente actualiza `kmActual` en la misma escritura por lotes, y un service viejo se guarda sin tocar `kmActual` ni crear lecturas inconsistentes.
4. **Fase 4 — Planes, vencimientos y tablero.** Plantilla de planes, `estadoPlan`, `estadoVencimiento`, `recalcularPlan`, renovación de vencimientos, tablero ordenado por urgencia.
   - Listo cuando: los tests cubren vencer por km, por fecha, por lo que llegue primero, sin `kmDiario`, fin de mes al sumar meses, y el reset al editar o borrar un service.
5. **Fase 5 — Job de alertas.** `alertas.js`, `mails.js`, `resend.js`, workflow con `DRY_RUN`, `ONLY_UID` y latido a Healthchecks.
   - Listo cuando: con tu cuenta, `DRY_RUN` muestra el mail correcto. El envío real te llega. Correrlo dos veces el mismo día no manda nada la segunda vez. Si no llega el latido, Healthchecks te avisa.
6. **Fase 6 — Pedido mensual de km.** `km.html` con el vehículo preseleccionado, mail mensual, opción de apagarlo en ajustes.
   - Listo cuando: con una lectura de hace 31 días llega el pedido. Desde el link se carga el km en menos de 3 toques. Al día siguiente no se repite.
7. **Fase 7 — Informe para comprador.** Generar, actualizar solo, dejar de compartir, `informe.html` imprimible.
   - Listo cuando: el link abre en una ventana de incógnito, no muestra datos personales por defecto, un texto con código en un campo se ve como texto, y deja de abrir al cortarlo.
8. **Fase 8 — Cierre.** Ajustes (preferencias de avisos), manifest para instalar en el celular, borrar la cuenta con todos sus datos (reanudable), activar App Check en modo exigido, README, revisión final del procedimiento de deploy.
   - Listo cuando: usaste la app una semana con tus vehículos reales sin errores en la consola.

## Riesgos, decisiones abiertas y camino a producto

El riesgo más grande no es técnico: es que el usuario deje de cargar km y los avisos por km pierdan precisión. El resto se cubre con configuración.

| Riesgo | Qué pasa | Cómo se cubre |
| --- | --- | --- |
| No se cargan km | Los planes por km avisan tarde o temprano | Mail mensual, lectura automática en cada service, aviso de "poco confiable" |
| Mails en spam | No llegan los avisos | Asunto claro y sin imágenes pesadas; con dominio propio, SPF, DKIM y DMARC. Mientras se use `onboarding@resend.dev`, revisar la carpeta de spam y marcar el remitente como seguro |
| Sin dominio, solo llegan mails a tu cuenta | Otros usuarios no reciben avisos | El job trata el rechazo de Resend como "destinatario no permitido": lo registra, no marca nada y sigue con el resto sin fallar. Se resuelve comprando un dominio antes de vender |
| Se publica algo roto | App caída hasta el siguiente deploy | Tests locales antes de publicar; volver a una versión anterior desde la consola de Hosting |
| Publicar a mano algo que no está en `main` | Lo online no coincide con el repo | Regla: se publica solo desde `main` actualizado |
| Se filtra la clave de servicio | Acceso total a la base | Solo en secrets de GitHub, nunca en el repo. Si se expone, revocarla en Firebase y generar otra |
| Ubicación de Firestore mal elegida | No se puede cambiar | Elegir `southamerica-east1` en la fase 0 |
| El job falla | No salen avisos | GitHub avisa por mail y queda el log en `avisos` |
| El job directamente no corre | No salen avisos y nadie se entera | Latido con Healthchecks.io |
| Límite de 100 mails por día | Avisos demorados | El job corta y retoma al día siguiente; con más usuarios, pasar al plan Pro |
| Mails a terceros | Alguien usa la app para mandar mails a otra persona | Mail de la cuenta verificado y reglas que lo obligan; extras solo con confirmación (versión comercial) |
| Usuario que agota la cuota gratis | La app se frena para todos | App Check, topes de tamaño en reglas |
| Texto malicioso en un campo | Código ejecutado en el navegador de otro | Todo con `textContent`, CSP |
| Fechas con un día de diferencia | Avisos y vencimientos errados | Fechas como texto `AAAA-MM-DD` |

**Decisiones abiertas**

- [x] Nombre de la app: **Mi Vehículo**.
- [x] Dominio: por ahora ninguno, se usa `https://<proyecto>.web.app`.
- [x] Deploy: manual con `firebase deploy` (se descartó la publicación automática por ahora).
- [x] ID del proyecto de Firebase: `mi-vehiculo-mantenimiento` (dirección `https://mi-vehiculo-mantenimiento.web.app`).
- [ ] Cuándo comprar un dominio (obligatorio antes de que otras personas reciban mails).

**Si se vende, falta sumar**

- Términos y política de privacidad: aun sin documentos, la app guarda datos personales (mail, patente, historial), alcanzados por la Ley 25.326 de Protección de Datos Personales. Conviene que los revise alguien que sepa del tema.
- Comprar un dominio propio y verificarlo en Resend (sin eso, los mails solo llegan a tu cuenta). Pasar también la app a ese dominio.
- Mails de aviso adicionales (familia), con confirmación del destinatario (el job manda un código y la persona lo confirma).
- Cobro: una suscripción con Mercado Pago necesita recibir notificaciones de pago, o sea un pequeño backend (por ejemplo un Cloudflare Worker). Es la primera pieza que no es 100% frontend.
- Límites por plan (cantidad de vehículos).
- Fotos y documentos: solo con un análisis previo de privacidad, y probablemente con Firebase Storage en plan Blaze.
- Ideas con valor comercial: compartir un vehículo con otro usuario (la familia), y una versión para talleres que cargan el service directo en el historial del cliente.

## Registro de decisiones (qué cambió respecto al borrador del 17/11/2026)

| Cambio | Por qué |
| --- | --- |
| Fechas como texto `AAAA-MM-DD` | Evita el error de un día por zona horaria |
| Hosting en Firebase en vez de Cloudflare Pages | Evita fallas del login con Google entre dominios, una pieza menos |
| Avisos solo al mail verificado de la cuenta | Evita que la app mande mails a terceros |
| Validación de km por fecha, service con lectura condicional | Permite cargar historial viejo sin errores |
| `textContent` + CSP | Evita que un texto escrito por el usuario ejecute código |
| `recalcularKmVehiculo` y `recalcularPlan` como únicas escrituras | Evita datos duplicados desincronizados |
| Latido con Healthchecks.io | Detecta cuando el job no corre |
| Borrado reanudable con `borrando` | Evita datos huérfanos si se cierra la pestaña |
| Se eliminan documentos, fotos, chasis y motor | Evita datos sensibles, costos y riesgos legales; baja mucho el consumo de espacio |
| App Check + topes en reglas | Evita que un usuario agote la cuota gratis |
| Fases reordenadas (alertas antes, 9 en total) | Da valor real antes y valida pronto el dominio y el job |
| Nombre "Mi Vehículo", sin dominio propio por ahora | Menos costo y menos pasos; los mails solo salen a tu cuenta hasta tener dominio |
| Deploy manual (se descarta la publicación automática) | Menos piezas y sin cuentas de servicio extra; se retoma si molesta |
| CSP con `style-src 'unsafe-inline'` | El login con Google carga componentes de Google que pueden necesitar estilos en línea; los scripts siguen restringidos a la propia app, gstatic y apis.google.com |
| Los mails de verificación y de recuperar contraseña los manda Firebase, no Resend | Vienen de `noreply@<proyecto>.firebaseapp.com`; pueden caer en spam. La plantilla (y el idioma) se edita en Authentication → Plantillas |
| En localhost la app usa solo los emuladores | Nadie toca la base real por error al desarrollar |
| Se quita `zonaHoraria`, se separan los avisos, se suma DMARC, caché offline, versiones fijadas, tests de reglas con librería y Java | Detalles técnicos menores |
| Plan en `docs/PLAN.md` + `CLAUDE.md` corto | Menos contexto gastado en cada sesión de Claude Code |
