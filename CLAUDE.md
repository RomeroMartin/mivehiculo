# CLAUDE.md

App web de mantenimiento vehicular: 100% frontend (HTML, CSS y JS vanilla, sin framework ni build) + Firebase (Auth, Firestore, Hosting, plan Spark) + un job diario en GitHub Actions que manda mails con Resend.

**El plan completo está en `docs/PLAN.md`. Leelo antes de empezar cualquier fase y trabajá una fase por sesión.** Si algo del código contradice el plan, avisá antes de decidir.

## Reglas que no se negocian

1. Fechas de calendario como texto `"AAAA-MM-DD"`, nunca `timestamp` (salvo `creado` y `actualizado`). Zona fija `America/Argentina/Buenos_Aires`. Toda la lógica de fechas va en `public/js/shared/fechas.js`.
2. Texto del usuario siempre con `textContent` (o los helpers de `js/ui.js`), nunca `innerHTML` ni HTML armado con strings.
3. `public/js/shared/` no importa nada de Firebase ni del DOM: lo usa también el job de Node.
4. `recalcularKmVehiculo()` es la única que escribe `kmActual`, `fechaKmActual` y `kmDiario`; `recalcularPlan()` es la única que escribe `ultimoKm` y `ultimaFecha`. Siempre dentro de un `writeBatch`.
5. Nada de fotos, documentos, chasis ni motor. No hay carga de archivos.
6. Avisos de mail solo a `usuarios.email` (verificado). El job marca los avisos como enviados **después** de enviar con éxito.
7. Cuenta de servicio, API keys y secrets nunca van al repo.
8. Firebase SDK con versión fijada en la URL de la CDN.

## Comandos (se completan a medida que existan)

- Tests de cálculos: `node --test tests/`
- Emuladores: `firebase emulators:start`
- Deploy (manual): `firebase deploy`
- Job en prueba: `DRY_RUN=true ONLY_UID=<uid> node job/alertas.js`

## Idioma

La interfaz, los mails y los comentarios del código van en español rioplatense (voseo).
