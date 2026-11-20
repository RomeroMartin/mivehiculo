// Inicialización de Firebase para Mi Vehículo.
// La config es pública por diseño: la protección son las reglas de Firestore,
// App Check y la restricción de la API key al dominio de la app (Google Cloud).
// SDK modular desde la CDN de gstatic con versión fijada (regla 8 de CLAUDE.md).
// Los imports estáticos no admiten variables: para actualizar la versión hay que
// cambiar el número en las tres URLs de abajo (y en package.json, que se usa para los tests).

export const VERSION_SDK = "12.19.0";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, updateProfile, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, connectFirestoreEmulator, persistentLocalCache,
  persistentMultipleTabManager, memoryLocalCache, doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCU91rQVKLOAQHP3-Ck6rJ5LMnTP8TiqF4",
  authDomain: "mi-vehiculo-mantenimiento.firebaseapp.com",
  projectId: "mi-vehiculo-mantenimiento",
  messagingSenderId: "1015145264756",
  appId: "1:1015145264756:web:25ae3b0148d173f2aa8321",
};

// En localhost la app usa los emuladores (npm run emuladores), nunca la base real.
export const usaEmuladores = ["localhost", "127.0.0.1"].includes(location.hostname);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  // Caché offline para el taller sin señal. Con emuladores, en memoria para no arrastrar datos viejos.
  localCache: usaEmuladores
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (usaEmuladores) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.info("Mi Vehículo: usando emuladores de Firebase (no la base real).");
}

// Re-exports: el resto de la app importa el SDK solo desde este archivo.
export {
  GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile, onAuthStateChanged, signOut,
  doc, getDoc, setDoc, serverTimestamp,
};
