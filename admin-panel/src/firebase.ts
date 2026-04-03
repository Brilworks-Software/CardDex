import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

// ─── Config ──────────────────────────────────────────────────────────────────
// By default we talk to real Firebase (even in dev).
// Opt-in to emulators by setting: REACT_APP_USE_FIREBASE_EMULATORS=true

const toBool = (value: string | undefined) => value === 'true' || value === '1';

const useEmulators =
  process.env.NODE_ENV === 'development' && toBool(process.env.REACT_APP_USE_FIREBASE_EMULATORS);

const required = (name: string): string => {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (value && value.trim()) return value.trim();
  throw new Error(
    `Missing ${name}. Add it to admin-panel/.env (or enable emulators via REACT_APP_USE_FIREBASE_EMULATORS=true).`
  );
};

// Emulators: allow dummy values because all traffic is redirected.
// Real Firebase: require real credentials via REACT_APP_* env vars.
const firebaseConfig = useEmulators
  ? {
      apiKey: process.env.REACT_APP_FIREBASE_API_KEY ?? 'local-emulator-key',
      authDomain:
        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN ?? 'carddex-local.firebaseapp.com',
      projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID ?? 'carddex-local',
      storageBucket:
        process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ?? 'carddex-local.appspot.com',
      messagingSenderId:
        process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
      appId:
        process.env.REACT_APP_FIREBASE_APP_ID ?? '1:000000000000:web:0000000000000000',
    }
  : {
      apiKey: required('REACT_APP_FIREBASE_API_KEY'),
      authDomain: required('REACT_APP_FIREBASE_AUTH_DOMAIN'),
      projectId: required('REACT_APP_FIREBASE_PROJECT_ID'),
      storageBucket: required('REACT_APP_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: required('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
      appId: required('REACT_APP_FIREBASE_APP_ID'),
    };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ─── Emulator connections (local dev only) ───────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log(`[Firebase] Emulators ${useEmulators ? 'ENABLED' : 'DISABLED'}`);
}

if (useEmulators) {
  connectAuthEmulator(auth,           'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db,        'localhost', 8080);
  connectStorageEmulator(storage,     'localhost', 9199);
}
