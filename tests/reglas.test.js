// Tests de las reglas de seguridad de Firestore (fase 1), con el emulador.
// Se corren con: npm run test:reglas   (necesita Java)
import { test, describe, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp, setLogLevel,
} from "firebase/firestore";

// Los rechazos de reglas son esperados en estos tests: no llenar la consola de avisos.
setLogLevel("silent");

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mi-vehiculo",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// ---------- Contextos ----------
const dbA = () => env.authenticatedContext("A", { email: "a@a.com", email_verified: true }).firestore();
const dbB = () => env.authenticatedContext("B", { email: "b@b.com", email_verified: true }).firestore();
const dbSinVerificar = () => env.authenticatedContext("A", { email: "a@a.com", email_verified: false }).firestore();
const dbAnonimo = () => env.unauthenticatedContext().firestore();

// Escribe datos de partida saltándose las reglas.
const sembrar = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// ---------- Datos de ejemplo válidos ----------
const ts = () => serverTimestamp();
const usuario = (o = {}) => ({
  nombre: "Ana", email: "a@a.com", avisosResumen: true, pedirKmMensual: true,
  ultimoPedidoKm: null, borrando: false, creado: ts(), actualizado: ts(), ...o,
});
const vehiculo = (o = {}) => ({
  patente: "AB123CD", marca: "Ford", modelo: "Fiesta", version: "SE", color: "Gris",
  anio: 2015, combustible: "nafta", fechaCompra: "2020-05-10", kmCompra: 50000,
  kmActual: 80000, fechaKmActual: "2026-11-01", kmDiario: 35, activo: true,
  borrando: false, informeToken: null, creado: ts(), actualizado: ts(), ...o,
});
const lectura = (o = {}) => ({ fecha: "2026-11-01", km: 80000, origen: "manual", creado: ts(), ...o });
const service = (o = {}) => ({
  fecha: "2026-10-15", km: 79000, tipo: "service", taller: "Taller Pepe", mecanico: "Pepe",
  descripcion: "Aceite y filtro", piezas: [{ repuesto: "Filtro", marca: "X", codigo: "1", cantidad: 1, precioUnit: 5000 }],
  manoObra: 8000, total: 13000, planesCumplidos: [], lecturaId: null,
  creado: ts(), actualizado: ts(), ...o,
});
const plan = (o = {}) => ({
  nombre: "Aceite y filtro", cadaKm: 10000, cadaMeses: 12, ultimoKm: 70000,
  ultimaFecha: "2026-01-10", avisoKmAntes: 500, avisoDiasAntes: 15, activo: true,
  ultimoAviso: null, ...o,
});
const vencimiento = (o = {}) => ({
  tipo: "vtv", descripcion: "VTV anual", fechaVence: "2027-03-15", diasAviso: [30, 7, 0],
  activo: true, avisosEnviados: [], ...o,
});
const informe = (o = {}) => ({
  uid: "A", vehiculoId: "v1", activo: true, actualizado: ts(), datos: { vehiculo: {}, services: [] }, ...o,
});

// ---------- Prueba de la fase 0 ----------
test("el emulador escribe y lee un documento", async () => {
  await sembrar(async (db) => {
    await setDoc(doc(db, "prueba/hola"), { mensaje: "funciona" });
    const snap = await getDoc(doc(db, "prueba/hola"));
    if (snap.data().mensaje !== "funciona") throw new Error("no leyó lo escrito");
  });
});

describe("acceso: cada usuario solo ve lo suyo", () => {
  test("sin sesión no se lee ni se escribe nada", async () => {
    await assertFails(getDoc(doc(dbAnonimo(), "usuarios/A")));
    await assertFails(setDoc(doc(dbAnonimo(), "usuarios/A"), usuario()));
  });

  test("el dueño con mail verificado crea y lee su usuario", async () => {
    await assertSucceeds(setDoc(doc(dbA(), "usuarios/A"), usuario()));
    await assertSucceeds(getDoc(doc(dbA(), "usuarios/A")));
  });

  test("el usuario B no puede leer, escribir ni borrar lo del usuario A", async () => {
    await sembrar(async (db) => {
      await setDoc(doc(db, "usuarios/A"), { nombre: "Ana" });
      await setDoc(doc(db, "usuarios/A/vehiculos/v1"), { patente: "X" });
      await setDoc(doc(db, "usuarios/A/vehiculos/v1/services/s1"), { x: 1 });
      await setDoc(doc(db, "usuarios/A/avisos/a1"), { x: 1 });
    });
    const b = dbB();
    await assertFails(getDoc(doc(b, "usuarios/A")));
    await assertFails(setDoc(doc(b, "usuarios/A"), usuario()));
    await assertFails(deleteDoc(doc(b, "usuarios/A")));
    await assertFails(getDoc(doc(b, "usuarios/A/vehiculos/v1")));
    await assertFails(getDocs(collection(b, "usuarios/A/vehiculos")));
    await assertFails(setDoc(doc(b, "usuarios/A/vehiculos/v1"), vehiculo()));
    await assertFails(getDoc(doc(b, "usuarios/A/vehiculos/v1/services/s1")));
    await assertFails(setDoc(doc(b, "usuarios/A/vehiculos/v1/services/s2"), service()));
    await assertFails(getDoc(doc(b, "usuarios/A/avisos/a1")));
  });

  test("un usuario sin mail verificado no puede leer ni escribir", async () => {
    const d = dbSinVerificar();
    await assertFails(setDoc(doc(d, "usuarios/A"), usuario()));
    await assertFails(getDoc(doc(d, "usuarios/A")));
    await assertFails(setDoc(doc(d, "usuarios/A/vehiculos/v1"), vehiculo()));
  });

  test("colecciones no previstas están denegadas", async () => {
    await assertFails(setDoc(doc(dbA(), "cosas/x"), { a: 1 }));
    await assertFails(getDoc(doc(dbA(), "cosas/x")));
  });
});

describe("usuarios", () => {
  test("el campo email debe coincidir con el de la cuenta", async () => {
    await assertFails(setDoc(doc(dbA(), "usuarios/A"), usuario({ email: "otro@x.com" })));
  });
  test("rechaza campos de más, nombre largo o vacío y tipos erróneos", async () => {
    const d = dbA();
    await assertFails(setDoc(doc(d, "usuarios/A"), usuario({ extra: 1 })));
    await assertFails(setDoc(doc(d, "usuarios/A"), usuario({ nombre: "x".repeat(101) })));
    await assertFails(setDoc(doc(d, "usuarios/A"), usuario({ nombre: "" })));
    await assertFails(setDoc(doc(d, "usuarios/A"), usuario({ avisosResumen: "si" })));
    await assertFails(setDoc(doc(d, "usuarios/A"), usuario({ ultimoPedidoKm: "ayer" })));
  });
  test("acepta ultimoPedidoKm como fecha en texto", async () => {
    await assertSucceeds(setDoc(doc(dbA(), "usuarios/A"), usuario({ ultimoPedidoKm: "2026-10-01" })));
  });
  test("no existe ningún campo para cargar mails de terceros", async () => {
    await assertFails(setDoc(doc(dbA(), "usuarios/A"), usuario({ emailsAviso: ["victima@x.com"] })));
  });
  test("el log de avisos lo puede leer el dueño pero nadie lo escribe", async () => {
    await sembrar((db) => setDoc(doc(db, "usuarios/A/avisos/a1"), { tipo: "resumen" }));
    await assertSucceeds(getDoc(doc(dbA(), "usuarios/A/avisos/a1")));
    await assertFails(setDoc(doc(dbA(), "usuarios/A/avisos/a2"), { tipo: "resumen" }));
  });
});

describe("vehículos", () => {
  test("crea un vehículo válido", async () => {
    await assertSucceeds(setDoc(doc(dbA(), "usuarios/A/vehiculos/v1"), vehiculo()));
  });
  test("acepta un vehículo con solo los campos obligatorios", async () => {
    const minimo = { patente: "AB123CD", marca: "Ford", modelo: "Fiesta", anio: 2015,
      combustible: "nafta", kmActual: 0, fechaKmActual: "2026-11-01", activo: true,
      creado: ts(), actualizado: ts() };
    await assertSucceeds(setDoc(doc(dbA(), "usuarios/A/vehiculos/v1"), minimo));
  });
  test("rechaza datos inválidos", async () => {
    const d = dbA();
    const v = (o) => setDoc(doc(d, "usuarios/A/vehiculos/v1"), vehiculo(o));
    await assertFails(v({ combustible: "agua" }));
    await assertFails(v({ patente: "x".repeat(13) }));
    await assertFails(v({ patente: "" }));
    await assertFails(v({ anio: 1800 }));
    await assertFails(v({ anio: "2015" }));
    await assertFails(v({ kmActual: -1 }));
    await assertFails(v({ fechaKmActual: new Date() }));       // timestamp: no se permite
    await assertFails(v({ fechaKmActual: "01/11/2026" }));     // formato incorrecto
    await assertFails(v({ activo: "si" }));
    await assertFails(v({ chasis: "1234" }));                  // campo que la app no guarda
    await assertFails(v({ motor: "1234" }));
  });
});

describe("subcolecciones del vehículo", () => {
  const base = "usuarios/A/vehiculos/v1";
  test("acepta documentos válidos", async () => {
    const d = dbA();
    await assertSucceeds(setDoc(doc(d, `${base}/lecturasKm/l1`), lectura()));
    await assertSucceeds(setDoc(doc(d, `${base}/services/s1`), service()));
    await assertSucceeds(setDoc(doc(d, `${base}/planes/p1`), plan()));
    await assertSucceeds(setDoc(doc(d, `${base}/vencimientos/x1`), vencimiento()));
  });
  test("plan solo por km, solo por meses; rechaza sin ninguno", async () => {
    const d = dbA();
    await assertSucceeds(setDoc(doc(d, `${base}/planes/p1`), plan({ cadaMeses: null })));
    await assertSucceeds(setDoc(doc(d, `${base}/planes/p2`), plan({ cadaKm: null })));
    await assertFails(setDoc(doc(d, `${base}/planes/p3`), plan({ cadaKm: null, cadaMeses: null })));
  });
  test("rechaza fechas mal formadas, orígenes y tipos inválidos", async () => {
    const d = dbA();
    await assertFails(setDoc(doc(d, `${base}/lecturasKm/l1`), lectura({ fecha: "2026-1-1" })));
    await assertFails(setDoc(doc(d, `${base}/lecturasKm/l1`), lectura({ origen: "magia" })));
    await assertFails(setDoc(doc(d, `${base}/lecturasKm/l1`), lectura({ km: -5 })));
    await assertFails(setDoc(doc(d, `${base}/vencimientos/x1`), vencimiento({ tipo: "otra" })));
    await assertFails(setDoc(doc(d, `${base}/vencimientos/x1`), vencimiento({ fechaVence: "mañana" })));
    await assertFails(setDoc(doc(d, `${base}/planes/p1`), plan({ ultimaFecha: "enero" })));
  });
  test("un service admite hasta 50 piezas y no más", async () => {
    const d = dbA();
    const pieza = { repuesto: "r", marca: "m", codigo: "c", cantidad: 1, precioUnit: 1 };
    await assertSucceeds(setDoc(doc(d, `${base}/services/s1`), service({ piezas: Array(50).fill(pieza) })));
    await assertFails(setDoc(doc(d, `${base}/services/s2`), service({ piezas: Array(51).fill(pieza) })));
  });
  test("un service rechaza textos demasiado largos y campos de más", async () => {
    const d = dbA();
    await assertFails(setDoc(doc(d, `${base}/services/s1`), service({ descripcion: "x".repeat(2001) })));
    await assertFails(setDoc(doc(d, `${base}/services/s1`), service({ facturaDocId: "abc" })));
    await assertFails(setDoc(doc(d, `${base}/services/s1`), service({ total: -1 })));
  });
  test("no hay colección de archivos ni documentos", async () => {
    const d = dbA();
    await assertFails(setDoc(doc(d, `${base}/archivos/a1`), { datos: "x" }));
    await assertFails(setDoc(doc(d, `${base}/documentos/a1`), { nombre: "x" }));
  });
});

describe("informes públicos", () => {
  test("un informe activo se lee sin iniciar sesión", async () => {
    await sembrar((db) => setDoc(doc(db, "informes/tok1"), { uid: "A", vehiculoId: "v1", activo: true, datos: {} }));
    await assertSucceeds(getDoc(doc(dbAnonimo(), "informes/tok1")));
  });
  test("un informe inactivo no se lee", async () => {
    await sembrar((db) => setDoc(doc(db, "informes/tok2"), { uid: "A", vehiculoId: "v1", activo: false, datos: {} }));
    await assertFails(getDoc(doc(dbAnonimo(), "informes/tok2")));
    await assertFails(getDoc(doc(dbB(), "informes/tok2")));
  });
  test("los informes no se pueden listar", async () => {
    await sembrar((db) => setDoc(doc(db, "informes/tok1"), { uid: "A", vehiculoId: "v1", activo: true, datos: {} }));
    await assertFails(getDocs(collection(dbAnonimo(), "informes")));
    await assertFails(getDocs(collection(dbA(), "informes")));
  });
  test("solo el dueño crea, actualiza y borra su informe", async () => {
    await assertSucceeds(setDoc(doc(dbA(), "informes/tok3"), informe()));
    await assertFails(setDoc(doc(dbB(), "informes/tok4"), informe({ uid: "A" })));   // B no puede crear a nombre de A
    await assertFails(setDoc(doc(dbB(), "informes/tok3"), informe({ uid: "B" })));   // ni pisar el de A
    await assertSucceeds(setDoc(doc(dbA(), "informes/tok3"), informe({ activo: false })));
    await assertFails(deleteDoc(doc(dbB(), "informes/tok3")));
    await assertSucceeds(deleteDoc(doc(dbA(), "informes/tok3")));
  });
  test("no se puede crear un informe con campos de más o sin ser el dueño verificado", async () => {
    await assertFails(setDoc(doc(dbA(), "informes/tok5"), informe({ chasis: "123" })));
    await assertFails(setDoc(doc(dbSinVerificar(), "informes/tok6"), informe()));
    await assertFails(setDoc(doc(dbAnonimo(), "informes/tok7"), informe()));
  });
  test("el dueño no puede cambiar a quién pertenece el informe", async () => {
    await assertSucceeds(setDoc(doc(dbA(), "informes/tok8"), informe()));
    await assertFails(setDoc(doc(dbA(), "informes/tok8"), informe({ uid: "B" })));
  });
});
