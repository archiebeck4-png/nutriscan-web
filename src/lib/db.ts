import Dexie, { type EntityTable } from 'dexie';
import { WebFoodEntry, FoodLogEntry, UserProfile, BarcodeCacheEntry, ScannedNutrition } from '../models/types';

const db = new Dexie('NutriScanDB') as Dexie & {
  entries: EntityTable<WebFoodEntry, 'id'>;
  foodLog: EntityTable<FoodLogEntry, 'id'>;
  profile: EntityTable<UserProfile, 'id'>;
  barcodeCache: EntityTable<BarcodeCacheEntry, 'barcode'>;
};

// Version 1: original schema (preserved for backward compat)
db.version(1).stores({
  entries: 'id, dateScanned',
});

// Version 2: add food log + profile tables
db.version(2).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
});

// Version 3: add unit preferences to profile
db.version(3).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
}).upgrade((tx) => {
  return tx.table('profile').toCollection().modify((profile) => {
    if (!profile.energyUnit) profile.energyUnit = 'kj';
    if (!profile.weightUnit) profile.weightUnit = 'kg';
  });
});

// Version 4: add barcode cache table
db.version(4).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
  barcodeCache: 'barcode, cachedAt',
});

// Version 5: add goalIntensity to profile
db.version(5).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
  barcodeCache: 'barcode, cachedAt',
}).upgrade((tx) => {
  return tx.table('profile').toCollection().modify((profile) => {
    if (profile.goalIntensity == null) {
      const map: Record<string, number> = { lose: -50, maintain: 0, gain: 50 };
      profile.goalIntensity = map[profile.goal] ?? 0;
    }
  });
});

export { db };

// --- Saved food entries (existing) ---

export async function insertEntry(entry: WebFoodEntry): Promise<void> {
  await db.entries.add(entry);
}

export async function getAllEntries(): Promise<WebFoodEntry[]> {
  return db.entries.orderBy('dateScanned').reverse().toArray();
}

export async function getEntryById(
  id: string
): Promise<WebFoodEntry | undefined> {
  return db.entries.get(id);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

// --- User profile ---

export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.get('default');
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await db.profile.put(profile);
}

// --- Food log ---

export async function addFoodLogEntry(entry: FoodLogEntry): Promise<void> {
  await db.foodLog.add(entry);
}

export async function getFoodLogForDate(
  date: string
): Promise<FoodLogEntry[]> {
  return db.foodLog.where('date').equals(date).sortBy('createdAt');
}

export async function deleteFoodLogEntry(id: string): Promise<void> {
  await db.foodLog.delete(id);
}

export async function deleteAllFoodLog(): Promise<void> {
  await db.foodLog.clear();
}

export async function deleteAllEntries(): Promise<void> {
  await db.entries.clear();
}

// --- Barcode cache ---

export async function getCachedBarcode(
  barcode: string
): Promise<BarcodeCacheEntry | undefined> {
  return db.barcodeCache.get(barcode);
}

export async function cacheBarcode(
  barcode: string,
  productName: string,
  nutrition: ScannedNutrition
): Promise<void> {
  await db.barcodeCache.put({
    barcode,
    productName,
    nutrition,
    cachedAt: new Date().toISOString(),
  });
}
