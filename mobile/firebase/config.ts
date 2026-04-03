import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import Constants from 'expo-constants';

// ─── Config ──────────────────────────────────────────────────────────────────
// Local dev:  uses dummy values — all traffic goes to the local emulator
// Production: reads real credentials from environment variables (EXPO_PUBLIC_*)
//             Set these in your .env.production file or CI/CD secrets

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            ?? 'local-emulator-key',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? 'carddex-local.firebaseapp.com',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? 'carddex-local',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? 'carddex-local.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             ?? '1:000000000000:web:0000000000000000',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ─── Emulator connection (local dev only) ────────────────────────────────────
// __DEV__ is true when running via `expo start`, false in production builds.
// On a physical device the Metro host IP is used so the device can reach your
// machine's emulator — on simulators/web `localhost` works fine.

if (__DEV__) {
  // Detect the host IP so physical devices can also reach the emulator
  const metaHost = Constants.expoConfig?.hostUri ?? (Constants as any).manifest?.debuggerHost ?? '';
  const emulatorHost = metaHost ? metaHost.split(':')[0] : 'localhost';

  connectAuthEmulator(auth,    `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db,      emulatorHost, 8080);
  connectStorageEmulator(storage,   emulatorHost, 9199);
}

export default app;
