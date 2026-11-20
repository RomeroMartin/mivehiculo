// Cuentas: registro, login, verificación de mail, guardia de páginas privadas
// y creación del documento usuarios/{uid} en el primer ingreso.

import {
  auth, db, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile, onAuthStateChanged, signOut, doc, getDoc, setDoc, serverTimestamp,
} from "./firebase.js";

export const CLAVE_MINIMA = 8;

// A dónde vuelve la persona después de tocar el link del mail de verificación.
const opcionesLink = () => ({ url: `${location.origin}/index.html` });

// ---------- Acciones ----------

export async function registrar(nombre, email, clave) {
  const cred = await createUserWithEmailAndPassword(auth, email, clave);
  await updateProfile(cred.user, { displayName: nombre.trim().slice(0, 100) });
  await sendEmailVerification(cred.user, opcionesLink());
  return cred.user;
}

export const entrarConEmail = (email, clave) => signInWithEmailAndPassword(auth, email, clave);
export const entrarConGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const recuperarClave = (email) => sendPasswordResetEmail(auth, email, opcionesLink());
export const reenviarVerificacion = () => sendEmailVerification(auth.currentUser, opcionesLink());
export const salir = () => signOut(auth);

/**
 * Después de tocar el link del mail hay que recargar al usuario y renovar el token:
 * las reglas de Firestore leen `email_verified` del token, no del perfil.
 */
export async function refrescarVerificacion() {
  const usuario = auth.currentUser;
  if (!usuario) return false;
  await usuario.reload();
  await usuario.getIdToken(true);
  return usuario.emailVerified;
}

// ---------- Sesión ----------

/** Espera a que Firebase resuelva si hay alguien con sesión. */
export function esperarUsuario() {
  return new Promise((resolver) => {
    const dejarDeEscuchar = onAuthStateChanged(auth, (usuario) => {
      dejarDeEscuchar();
      resolver(usuario);
    });
  });
}

export { onAuthStateChanged };

/**
 * Guardia de páginas privadas. Sin sesión o con mail sin verificar manda al inicio.
 * Con sesión válida devuelve { usuario, perfil } (y crea el perfil si es el primer ingreso).
 */
export async function exigirSesion() {
  const usuario = await esperarUsuario();
  if (!usuario || !usuario.emailVerified) {
    location.replace("index.html");
    return new Promise(() => {}); // la página se va: no sigue ejecutando nada
  }
  const perfil = await asegurarUsuario(usuario);
  return { usuario, perfil };
}

/** Crea usuarios/{uid} la primera vez que alguien con mail verificado ingresa. */
export async function asegurarUsuario(usuario) {
  const ref = doc(db, "usuarios", usuario.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    // Token viejo (sin email_verified): se renueva y se reintenta una vez.
    if (error.code !== "permission-denied") throw error;
    await usuario.getIdToken(true);
    snap = await getDoc(ref);
  }
  if (snap.exists()) return snap.data();

  const nombre = (usuario.displayName || usuario.email.split("@")[0] || "Usuario").slice(0, 100);
  await setDoc(ref, {
    nombre,
    email: usuario.email,
    avisosResumen: true,
    pedirKmMensual: true,
    ultimoPedidoKm: null,
    borrando: false,
    creado: serverTimestamp(),
    actualizado: serverTimestamp(),
  });
  return { nombre, email: usuario.email, avisosResumen: true, pedirKmMensual: true, ultimoPedidoKm: null, borrando: false };
}

// ---------- Mensajes de error en castellano ----------

const ERRORES = {
  "auth/invalid-credential": "El mail o la contraseña no son correctos.",
  "auth/wrong-password": "El mail o la contraseña no son correctos.",
  "auth/user-not-found": "El mail o la contraseña no son correctos.",
  "auth/invalid-email": "Ese mail no parece válido.",
  "auth/email-already-in-use": "Ya hay una cuenta con ese mail. Probá iniciar sesión.",
  "auth/weak-password": `La contraseña es muy débil. Usá al menos ${CLAVE_MINIMA} caracteres.`,
  "auth/too-many-requests": "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  "auth/network-request-failed": "No hay conexión. Revisá tu internet y probá de nuevo.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permitila y probá de nuevo.",
  "auth/user-disabled": "Esta cuenta está deshabilitada.",
};
const SILENCIOSOS = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

/** Devuelve el texto para mostrar, o "" si el error no merece mensaje (por ejemplo, cerrar la ventana de Google). */
export function textoDeError(error) {
  const codigo = error?.code || "";
  if (SILENCIOSOS.has(codigo)) return "";
  return ERRORES[codigo] || `Algo salió mal (${codigo || "error desconocido"}). Probá de nuevo.`;
}
