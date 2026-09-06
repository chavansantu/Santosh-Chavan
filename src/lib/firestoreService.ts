import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { JournalEntry, InteractionMessage } from '../types';
import { cleanPayload } from './sanitize';

/**
 * Service for managing user-isolated Journal entries and Gemini interactions
 * All data paths are locked strictly under /users/{userId}/...
 */

export async function saveJournalEntry(
  userId: string,
  entry: Omit<JournalEntry, 'userId' | 'updatedAt' | 'createdAt'> & {
    id?: string;
    createdAt?: number;
    updatedAt?: number;
  }
): Promise<JournalEntry> {
  if (!userId) {
    throw new Error('User authentication required to save journal entries.');
  }

  const entryId = entry.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const entryRef = doc(db, 'users', userId, 'entries', entryId);

  const now = Date.now();
  const payload: JournalEntry = {
    id: entryId,
    userId,
    title: entry.title.trim() || 'Untitled Reflection',
    content: entry.content,
    mood: entry.mood || 'neutral',
    tags: entry.tags || [],
    summary: entry.summary,
    theme: entry.theme,
    keyTakeaways: entry.keyTakeaways,
    location: entry.location
      ? {
          latitude: Number(entry.location.latitude),
          longitude: Number(entry.location.longitude),
          placeName: entry.location.placeName || '',
          formattedAddress: entry.location.formattedAddress || '',
        }
      : undefined,
    createdAt: entry.createdAt || now,
    updatedAt: now,
  };

  const sanitized = cleanPayload(payload);
  await setDoc(entryRef, sanitized, { merge: true });
  return payload;
}

export async function fetchUserEntries(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'), limit(100));

  const snapshot = await getDocs(q);
  const entries: JournalEntry[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    entries.push({
      id: docSnap.id,
      userId,
      title: data.title || 'Untitled Reflection',
      content: data.content || '',
      mood: data.mood,
      tags: data.tags || [],
      summary: data.summary,
      theme: data.theme,
      keyTakeaways: data.keyTakeaways,
      location: data.location
        ? {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            placeName: data.location.placeName,
            formattedAddress: data.location.formattedAddress,
          }
        : undefined,
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now(),
    });
  });

  return entries;
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryRef);
}

export async function saveInteraction(
  userId: string,
  interaction: Omit<InteractionMessage, 'id' | 'userId'>
): Promise<InteractionMessage> {
  if (!userId) {
    throw new Error('User authentication required to save interaction.');
  }

  const interactionId = `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const docRef = doc(db, 'users', userId, 'interactions', interactionId);

  const payload: InteractionMessage = {
    id: interactionId,
    userId,
    entryId: interaction.entryId,
    role: interaction.role,
    content: interaction.content,
    mode: interaction.mode,
    modelUsed: interaction.modelUsed,
    createdAt: interaction.createdAt || Date.now(),
  };

  const sanitized = cleanPayload(payload);
  await setDoc(docRef, sanitized);
  return payload;
}

export async function fetchInteractionsForEntry(
  userId: string,
  entryId: string
): Promise<InteractionMessage[]> {
  if (!userId || !entryId) return [];

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(
    interactionsRef,
    where('entryId', '==', entryId),
    orderBy('createdAt', 'asc'),
    limit(50)
  );

  const snapshot = await getDocs(q);
  const list: InteractionMessage[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    list.push({
      id: docSnap.id,
      userId,
      entryId: data.entryId,
      role: data.role,
      content: data.content || '',
      mode: data.mode,
      modelUsed: data.modelUsed,
      createdAt: data.createdAt || Date.now(),
    });
  });

  return list;
}
