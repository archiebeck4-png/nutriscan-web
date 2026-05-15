import Dexie, { type EntityTable } from 'dexie';
import { WebFoodEntry, FoodLogEntry, UserProfile, BarcodeCacheEntry, ScannedNutrition, RecipeIngredient } from '../models/types';

const db = new Dexie('NutriScanDB') as Dexie & {
  entries: EntityTable<WebFoodEntry, 'id'>;
  foodLog: EntityTable<FoodLogEntry, 'id'>;
  profile: EntityTable<UserProfile, 'id'>;
  barcodeCache: EntityTable<BarcodeCacheEntry, 'barcode'>;
  recipeIngredients: EntityTable<RecipeIngredient, 'id'>;
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

// Version 6: add loggedAt to food log entries
db.version(6).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
  barcodeCache: 'barcode, cachedAt',
}).upgrade((tx) => {
  return tx.table('foodLog').toCollection().modify((entry) => {
    if (!entry.loggedAt && entry.createdAt) {
      const d = new Date(entry.createdAt);
      entry.loggedAt = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  });
});

// Version 7: add recipe ingredients table
db.version(7).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
  barcodeCache: 'barcode, cachedAt',
  recipeIngredients: 'id, recipeId, foodEntryId',
});

// Version 8: per-macro tracking toggles + saturated fat
db.version(8).stores({
  entries: 'id, dateScanned',
  foodLog: 'id, date, createdAt',
  profile: 'id',
  barcodeCache: 'barcode, cachedAt',
  recipeIngredients: 'id, recipeId, foodEntryId',
}).upgrade(async (tx) => {
  await tx.table('profile').toCollection().modify((p) => {
    if (p.trackProtein == null) p.trackProtein = true;
    if (p.trackFat == null) p.trackFat = true;
    if (p.trackCarbs == null) p.trackCarbs = true;
    if (p.trackFiber == null) p.trackFiber = false;
    if (p.trackSaturatedFat == null) p.trackSaturatedFat = false;
    if (p.dailySaturatedFatTargetG == null) {
      p.dailySaturatedFatTargetG = Math.round((p.dailyEnergyTargetKj * 0.10) / 37.656);
    }
  });
  await tx.table('foodLog').toCollection().modify((e) => {
    if (e.saturatedFatG == null) e.saturatedFatG = 0;
  });
  await tx.table('entries').toCollection().modify((e) => {
    if (e.saturatedFatPerServing === undefined) e.saturatedFatPerServing = null;
    if (e.saturatedFatPer100g === undefined) e.saturatedFatPer100g = null;
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

// --- Recipe ingredients ---

export async function saveRecipeIngredients(ingredients: RecipeIngredient[]): Promise<void> {
  await db.recipeIngredients.bulkAdd(ingredients);
}

export async function getRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
  return db.recipeIngredients.where('recipeId').equals(recipeId).toArray();
}

export async function deleteRecipeIngredients(recipeId: string): Promise<void> {
  await db.recipeIngredients.where('recipeId').equals(recipeId).delete();
}
