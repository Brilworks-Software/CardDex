import {
  doc,
  getDoc,
  runTransaction,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';

export type RedeemResult =
  | { success: true; cardId: string }
  | { success: false; error: 'not_found' | 'already_used' | 'already_owned' | 'server_error' };

// Internal error codes thrown inside the transaction
const ERR = {
  NOT_FOUND:     'not_found',
  ALREADY_USED:  'already_used',
  ALREADY_OWNED: 'already_owned',
} as const;

/**
 * Atomically redeems a QR code for a user.
 *
 * Uses a Firestore transaction so two simultaneous scans of the same code
 * cannot both succeed — only the first write goes through.
 */
export const redeemCode = async (
  code: string,
  uid: string
): Promise<RedeemResult> => {
  const codeRef = doc(db, 'qr_codes', code);
  const userRef = doc(db, 'users', uid);

  try {
    const cardId = await runTransaction(db, async (tx) => {
      // Read both documents inside the transaction (atomic snapshot)
      const [codeSnap, userSnap] = await Promise.all([
        tx.get(codeRef),
        tx.get(userRef),
      ]);

      if (!codeSnap.exists()) throw new Error(ERR.NOT_FOUND);

      const codeData = codeSnap.data();
      if (codeData.used)         throw new Error(ERR.ALREADY_USED);

      const binder: string[] = userSnap.data()?.binder ?? [];
      if (binder.includes(codeData.cardId)) throw new Error(ERR.ALREADY_OWNED);

      // Write both updates in the same transaction
      tx.update(codeRef, {
        used:      true,
        claimedBy: uid,
        claimedAt: serverTimestamp(),
      });
      tx.update(userRef, {
        binder: arrayUnion(codeData.cardId),
      });

      return codeData.cardId as string;
    });

    return { success: true, cardId };
  } catch (e: any) {
    const msg: string = e?.message ?? '';
    if (msg === ERR.NOT_FOUND)     return { success: false, error: 'not_found' };
    if (msg === ERR.ALREADY_USED)  return { success: false, error: 'already_used' };
    if (msg === ERR.ALREADY_OWNED) return { success: false, error: 'already_owned' };
    console.error('[redeemCode] unexpected error:', e);
    return { success: false, error: 'server_error' };
  }
};

export const getUserBinder = async (uid: string): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.binder ?? [];
};
