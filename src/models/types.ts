// --- Weight goal & body stats ---
export type WeightGoal = 'lose' | 'maintain' | 'gain';
export type Gender = 'male' | 'female';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'veryActive';

// --- Unit preferences ---
export type EnergyUnit = 'kj' | 'cal';
export type WeightUnit = 'kg' | 'lbs';

// --- User profile (single-user, stored in IndexedDB) ---
export interface UserProfile {
  id: string; // always 'default'
  name: string;
  gender: Gender;
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goal: WeightGoal;

  // Calculated daily targets
  dailyEnergyTargetKj: number;
  dailyProteinTargetG: number;
  dailyFatTargetG: number;
  dailyCarbsTargetG: number;
  dailyFiberTargetG: number;

  // Unit preferences
  energyUnit: EnergyUnit;
  weightUnit: WeightUnit;

  createdAt: string;
  updatedAt: string;
}

// --- Food log entry (daily diary item) ---
export interface FoodLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  foodName: string;

  energyKj: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;

  savedFoodId: string | null;
  source: 'manual' | 'scan' | 'library' | 'barcode';
}

// --- Scanned nutrition (OCR parsing result) ---
export interface ScannedNutrition {
  foodName: string;
  servingSize: string;
  servingsPerPackage: string;

  energyPerServing: string;
  proteinPerServing: string;
  fatPerServing: string;
  carbsPerServing: string;
  fiberPerServing: string;

  energyPer100g: string;
  proteinPer100g: string;
  fatPer100g: string;
  carbsPer100g: string;
  fiberPer100g: string;

  rawText: string;
}

// --- Saved food entry (from scanning or library) ---
export interface WebFoodEntry {
  id: string;
  foodName: string;
  dateScanned: string;

  energyPerServing: number | null;
  proteinPerServing: number | null;
  fatPerServing: number | null;
  carbsPerServing: number | null;
  fiberPerServing: number | null;

  energyPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;
  fiberPer100g: number | null;

  servingSize: string | null;
  servingsPerPackage: string | null;

  rawOcrText: string | null;
  imageBlob: Blob | null;
}
