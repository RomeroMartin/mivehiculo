// Prueba de la fase 0: los emuladores andan y se puede escribir y leer un documento.
// Las reglas completas y sus tests se arman en la fase 1.
// Se corre con: npm run test:reglas  (necesita Java)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mi-vehiculo",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

after(async () => { await env?.cleanup(); });

test("el emulador escribe y lee un documento", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "prueba/hola"), { mensaje: "funciona" });
    const snap = await getDoc(doc(db, "prueba/hola"));
    assert.equal(snap.data().mensaje, "funciona");
  });
});

test("sin sesión no se puede leer un usuario", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "usuarios/abc")));
});

test("un usuario con mail verificado escribe y lee su propio documento", async () => {
  const db = env.authenticatedContext("abc", { email: "a@a.com", email_verified: true }).firestore();
  await assertSucceeds(setDoc(doc(db, "usuarios/abc"), { email: "a@a.com", nombre: "A" }));
  await assertSucceeds(getDoc(doc(db, "usuarios/abc")));
});
