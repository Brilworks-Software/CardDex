import Constants from 'expo-constants';
import { getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const toBool = (value: string | undefined) => value === 'true' || value === '1';

// By default we talk to real Firebase (even in dev).
// Opt-in to emulators by setting: EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true
const useEmulators = __DEV__ && toBool(process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS);

const required = (name: string): string => {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (value && value.trim()) return value.trim();
  throw new Error(
    `Missing ${name}. Add it to mobile/.env (or disable emulators).`
  );
};

// ─── Config ──────────────────────────────────────────────────────────────────
// Emulators: allow dummy values because all traffic is redirected.
// Real Firebase: require real credentials via EXPO_PUBLIC_* env vars.

const firebaseConfig = useEmulators
  ? {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'local-emulator-key',
      authDomain:
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
        'carddex-local.firebaseapp.com',
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'carddex-local',
      storageBucket:
        process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
        'carddex-local.appspot.com',
      messagingSenderId:
        process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
        '000000000000',
      appId:
        process.env.EXPO_PUBLIC_FIREBASE_APP_ID ??
        '1:000000000000:web:0000000000000000',
    }
  : {
      apiKey: required('EXPO_PUBLIC_FIREBASE_API_KEY'),
      authDomain: required('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      projectId: required('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
      storageBucket: required('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: required('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      appId: required('EXPO_PUBLIC_FIREBASE_APP_ID'),
    };

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(`[Firebase] Emulators ${useEmulators ? 'ENABLED' : 'DISABLED'}`);
}

// ─── Emulator connection (local dev only) ────────────────────────────────────
// __DEV__ is true when running via `expo start`, false in production builds.
// On a physical device the Metro host IP is used so the device can reach your
// machine's emulator — on simulators/web `localhost` works fine.

if (useEmulators) {
  // Detect the host IP so physical devices can also reach the emulator
  const metaHost = Constants.expoConfig?.hostUri ?? (Constants as any).manifest?.debuggerHost ?? '';
  const emulatorHost = metaHost ? metaHost.split(':')[0] : 'localhost';

  connectAuthEmulator(auth,    `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db,      emulatorHost, 8080);
  connectStorageEmulator(storage,   emulatorHost, 9199);
}

export default app;
