import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './config';

export type Card = {
  id: string;
  number: number;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  description: string;
  imageUrl: string;
  videoUrl: string;
  type: string;
  hp: number;
};

export const getAllCards = async (): Promise<Card[]> => {
  const q = query(collection(db, 'cards'), orderBy('number', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Card));
};

export const getCard = async (cardId: string): Promise<Card | null> => {
  const snap = await getDoc(doc(db, 'cards', cardId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Card;
};
