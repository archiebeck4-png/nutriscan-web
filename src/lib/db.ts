import Dexie, { type EntityTable } from 'dexie';
import { WebFoodEntry } from '../models/types';

const db = new Dexie('NutriScanDB') as Dexie & {
  entries: EntityTable<WebFoodEntry, 'id'>;
};

db.version(1).stores({
  entries: 'id, dateScanned',
});

export { db };

export async function insertEntry(entry: WebFoodEntry): Promise<void> {
  await db.entries.add(entry);
}

export async function getAllEntries(): Promise<WebFoodEntry[]> {
  return db.entries.orderBy('dateScanned').reverse().toArray();
}

export async function getEntryById(id: string): Promise<WebFoodEntry | undefined> {
  return db.entries.get(id);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}
