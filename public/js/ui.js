// Helpers para armar la interfaz de forma segura (regla 2 de CLAUDE.md):
// todo texto se inserta con textContent / createTextNode, nunca como HTML.

export const $ = (id) => document.getElementById(id);

const URL_PELIGROSA = /^\s*(javascript|data|vbscript):/i;

/**
 * Crea un elemento.
 *   el("p", { clase: "aviso", texto: "Hola" })
 *   el("a", { href: "app.html" }, "Ir al tablero")
 * Los hijos que son texto se agregan como nodos de texto (nunca se interpretan como HTML).
 */
export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (clave === "texto") nodo.textContent = String(valor);
    else if (clave === "clase") nodo.className = String(valor);
    else if (clave.startsWith("on") && typeof valor === "function") nodo.addEventListener(clave.slice(2), valor);
    else if ((clave === "href" || clave === "src" || clave === "action") && URL_PELIGROSA.test(String(valor))) continue;
    else nodo.setAttribute(clave, valor === true ? "" : String(valor));
  }
  for (const hijo of hijos.flat()) {
    if (hijo === undefined || hijo === null || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

/** Muestra u oculta un mensaje de estado o de error. */
export function mostrarMensaje(nodo, texto) {
  nodo.textContent = texto || "";
  nodo.hidden = !texto;
}

/** Muestra una sola vista de una lista (las demás quedan ocultas). */
export function mostrarVista(vistas, nombre) {
  for (const [clave, nodo] of Object.entries(vistas)) nodo.hidden = clave !== nombre;
}

/** Deshabilita los botones de un formulario mientras se espera una respuesta. */
export function ocupado(contenedor, estaOcupado) {
  for (const b of contenedor.querySelectorAll("button, input")) b.disabled = estaOcupado;
}
