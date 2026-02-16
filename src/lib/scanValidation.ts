import { ScannedNutrition } from '../models/types';

export interface ScanScore {
  score: number;         // 0.0 to 1.0
  fieldsFound: string[]; // human-readable list of what was detected
  isValid: boolean;      // true when score >= threshold AND energy detected
}

const FIELD_WEIGHTS: Record<string, number> = {
  energy: 0.3,
  protein: 0.2,
  carbs: 0.2,
  fat: 0.15,
  fiber: 0.05,
  servingSize: 0.1,
};

const AUTO_NAVIGATE_THRESHOLD = 0.5;

/**
 * Score a parsed nutrition result to determine if it's "good enough"
 * to auto-navigate to the review page.
 *
 * Requires energy as a hard gate — without energy it's not a nutrition label.
 * Threshold of 0.50 means energy (0.30) + any one macro (0.15–0.20) is enough.
 */
export function scoreScanResult(nutrition: ScannedNutrition): ScanScore {
  const fieldsFound: string[] = [];
  let score = 0;

  const hasEnergy = !!(nutrition.energyPerServing || nutrition.energyPer100g);
  if (hasEnergy) {
    score += FIELD_WEIGHTS.energy;
    fieldsFound.push('Energy');
  }

  const hasProtein = !!(nutrition.proteinPerServing || nutrition.proteinPer100g);
  if (hasProtein) {
    score += FIELD_WEIGHTS.protein;
    fieldsFound.push('Protein');
  }

  const hasFat = !!(nutrition.fatPerServing || nutrition.fatPer100g);
  if (hasFat) {
    score += FIELD_WEIGHTS.fat;
    fieldsFound.push('Fat');
  }

  const hasCarbs = !!(nutrition.carbsPerServing || nutrition.carbsPer100g);
  if (hasCarbs) {
    score += FIELD_WEIGHTS.carbs;
    fieldsFound.push('Carbs');
  }

  const hasFiber = !!(nutrition.fiberPerServing || nutrition.fiberPer100g);
  if (hasFiber) {
    score += FIELD_WEIGHTS.fiber;
    fieldsFound.push('Fiber');
  }

  const hasServing = !!nutrition.servingSize;
  if (hasServing) {
    score += FIELD_WEIGHTS.servingSize;
    fieldsFound.push('Serving');
  }

  // Hard gate: energy must be present for auto-navigation
  const isValid = hasEnergy && score >= AUTO_NAVIGATE_THRESHOLD;

  return { score, fieldsFound, isValid };
}
