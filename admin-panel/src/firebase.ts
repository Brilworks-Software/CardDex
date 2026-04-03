import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// ─── Config ──────────────────────────────────────────────────────────────────
// Local dev (npm start):  dummy values — all traffic goes to the local emulator
// Production (npm build): reads real credentials from REACT_APP_* env vars

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY            ?? 'local-emulator-key',
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN        ?? 'carddex-local.firebaseapp.com',
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID         ?? 'carddex-local',
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET     ?? 'carddex-local.appspot.com',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId:             process.env.REACT_APP_FIREBASE_APP_ID             ?? '1:000000000000:web:0000000000000000',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ─── Emulator connections (local dev only) ───────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth,           'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db,        'localhost', 8080);
  connectStorageEmulator(storage,     'localhost', 9199);
}
