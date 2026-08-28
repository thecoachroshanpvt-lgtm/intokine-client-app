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
  setDoc,
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
  apiKey: 'AIzaSyCFgCZGIN0YbCRRZfHkHDM86bxIcnavxwU',
  authDomain: 'intokine-7c86e.firebaseapp.com',
  projectId: 'intokine-7c86e',
  storageBucket: 'intokine-7c86e.firebasestorage.app',
  messagingSenderId: '770844058604',
  appId: '1:770844058604:web:babf8f5c863307429056c9',
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
  setDoc,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
};
export type { User };
