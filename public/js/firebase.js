// Inicialización de Firebase para Mi Vehículo.
// La config es pública por diseño: la protección son las reglas de Firestore,
// App Check y la restricción de la API key al dominio de la app (Google Cloud).
// SDK modular desde la CDN de gstatic con versión fijada (regla 8 de CLAUDE.md).
// Para actualizar la versión, cambiar VERSION_SDK en un solo lugar.

export const VERSION_SDK = "12.19.0";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCU91rQVKLOAQHP3-Ck6rJ5LMnTP8TiqF4",
  authDomain: "mi-vehiculo-mantenimiento.firebaseapp.com",
  projectId: "mi-vehiculo-mantenimiento",
  messagingSenderId: "1015145264756",
  appId: "1:1015145264756:web:25ae3b0148d173f2aa8321",
};

export const app = initializeApp(firebaseConfig);
