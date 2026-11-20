// Tablero (por ahora solo comprueba que la sesión y el perfil funcionan).
import { exigirSesion, salir, textoDeError } from "../auth.js";
import { $, mostrarMensaje } from "../ui.js";

try {
  const { perfil } = await exigirSesion();
  $("nombre").textContent = perfil.nombre;
  $("cargando").hidden = true;
  $("contenido").hidden = false;
} catch (e) {
  $("cargando").hidden = true;
  mostrarMensaje($("error"), textoDeError(e));
}

$("btn-salir").addEventListener("click", async () => {
  await salir();
  location.replace("index.html");
});
