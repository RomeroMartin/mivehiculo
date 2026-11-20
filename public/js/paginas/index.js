// Pantalla de acceso: iniciar sesión, crear cuenta, recuperar contraseña y verificar el mail.
import {
  CLAVE_MINIMA, registrar, entrarConEmail, entrarConGoogle, recuperarClave,
  reenviarVerificacion, refrescarVerificacion, salir, asegurarUsuario,
  onAuthStateChanged, textoDeError,
} from "../auth.js";
import { auth } from "../firebase.js";
import { $, mostrarMensaje, mostrarVista, ocupado } from "../ui.js";

const vistas = {
  entrar: $("vista-entrar"),
  registro: $("vista-registro"),
  olvide: $("vista-olvide"),
  verificar: $("vista-verificar"),
};
const cargando = $("cargando");
const mensaje = $("mensaje");
const error = $("error");

function ir(nombre) {
  cargando.hidden = true;
  mostrarMensaje(mensaje, "");
  mostrarMensaje(error, "");
  mostrarVista(vistas, nombre);
}

/** Ejecuta una acción mostrando errores en castellano y bloqueando los botones mientras tanto. */
async function ejecutar(contenedor, accion) {
  mostrarMensaje(mensaje, "");
  mostrarMensaje(error, "");
  ocupado(contenedor, true);
  try {
    await accion();
  } catch (e) {
    mostrarMensaje(error, textoDeError(e));
  } finally {
    ocupado(contenedor, false);
  }
}

/** Con sesión: si el mail está verificado entra a la app; si no, pide verificarlo. */
async function continuar(usuario) {
  if (!usuario.emailVerified) {
    $("verificar-email").textContent = usuario.email;
    ir("verificar");
    return;
  }
  cargando.hidden = false;
  mostrarVista(vistas, "");
  try {
    await asegurarUsuario(usuario);
    location.replace("app.html");
  } catch (e) {
    ir("entrar");
    mostrarMensaje(error, textoDeError(e));
  }
}

// ---------- Navegación entre vistas ----------
$("ir-registro").addEventListener("click", () => ir("registro"));
$("ir-entrar").addEventListener("click", () => ir("entrar"));
$("ir-entrar-2").addEventListener("click", () => ir("entrar"));
$("ir-olvide").addEventListener("click", () => {
  $("olvide-email").value = $("entrar-email").value;
  ir("olvide");
});

// ---------- Formularios ----------
$("form-entrar").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const email = $("entrar-email").value.trim();
  const clave = $("entrar-clave").value;
  if (!email || !clave) return mostrarMensaje(error, "Completá el mail y la contraseña.");
  ejecutar(vistas.entrar, () => entrarConEmail(email, clave));
});

$("form-registro").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const nombre = $("reg-nombre").value.trim();
  const email = $("reg-email").value.trim();
  const clave = $("reg-clave").value;
  if (!nombre || !email) return mostrarMensaje(error, "Completá tu nombre y tu mail.");
  if (clave.length < CLAVE_MINIMA) return mostrarMensaje(error, `La contraseña tiene que tener al menos ${CLAVE_MINIMA} caracteres.`);
  ejecutar(vistas.registro, () => registrar(nombre, email, clave));
});

$("form-olvide").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const email = $("olvide-email").value.trim();
  if (!email) return mostrarMensaje(error, "Escribí tu mail.");
  ejecutar(vistas.olvide, async () => {
    try {
      await recuperarClave(email);
    } catch (e) {
      // Por privacidad no se revela si el mail tiene cuenta o no.
      if (e.code !== "auth/user-not-found") throw e;
    }
    mostrarMensaje(mensaje, "Si ese mail tiene una cuenta, te mandamos un link para elegir una contraseña nueva. Revisá también el spam.");
  });
});

// ---------- Google ----------
$("btn-google-entrar").addEventListener("click", () => ejecutar(vistas.entrar, entrarConGoogle));
$("btn-google-registro").addEventListener("click", () => ejecutar(vistas.registro, entrarConGoogle));

// ---------- Verificación de mail ----------
$("btn-ya-verifique").addEventListener("click", () => ejecutar(vistas.verificar, async () => {
  const verificado = await refrescarVerificacion();
  if (verificado) return continuar(auth.currentUser);
  mostrarMensaje(error, "Todavía no figura verificado. Tocá el link del mail y probá de nuevo.");
}));
$("btn-reenviar").addEventListener("click", () => ejecutar(vistas.verificar, async () => {
  await reenviarVerificacion();
  mostrarMensaje(mensaje, "Listo, te mandamos el mail de nuevo.");
}));
$("btn-salir-verificar").addEventListener("click", () => ejecutar(vistas.verificar, salir));

// ---------- Estado de la sesión ----------
onAuthStateChanged(auth, (usuario) => {
  if (usuario) continuar(usuario);
  else ir("entrar");
});
