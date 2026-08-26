import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  Auth,
  User,
} from 'firebase/auth';

// Same Firebase project as the internal INTOKINE platform - this is
// intentional. The Client App is a separate front-end with its own
// branding and its own restricted queries, but it talks to the exact
// same backend, so there is only ever one authoritative source of
// client data, never a duplicate database.
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCFgCZGIN0YbCRRZfHkHDM86bxIcnavxwU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'intokine-7c86e.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'intokine-7c86e',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'intokine-7c86e.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '770844058604',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:770844058604:web:babf8f5c863307429056c9',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function initializeClientFirebaseApp() {
  if (!app) {
    app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }
  return { app, db, auth };
}

export {
  db,
  auth,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
};
export type { User };
