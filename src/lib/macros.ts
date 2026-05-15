import type { Gender, ActivityLevel, WeightGoal } from '../models/types';

export interface DailyTargets {
  energyKj: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  saturatedFatG: number;
}

// 1g saturated fat = 9 kcal = 9 * 4.184 kJ
const KJ_PER_G_FAT = 9 * 4.184;

// --- BMR via Mifflin-St Jeor (returns kcal) ---
function calculateBmrKcal(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  age: number
): number {
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

// --- Activity multipliers for TDEE ---
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

const KJ_PER_KCAL = 4.184;

/**
 * Convert legacy WeightGoal to numeric intensity.
 * lose → -50, maintain → 0, gain → +50
 */
export function goalToIntensity(goal: WeightGoal): number {
  switch (goal) {
    case 'lose': return -50;
    case 'gain': return 50;
    case 'maintain':
    default: return 0;
  }
}

/**
 * Derive a legacy WeightGoal label from intensity.
 */
export function intensityToGoal(intensity: number): WeightGoal {
  if (intensity < -10) return 'lose';
  if (intensity > 10) return 'gain';
  return 'maintain';
}

/**
 * Calculate daily targets using continuous goal intensity.
 *
 * goalIntensity: -100 (aggressive cut) to +100 (aggressive bulk)
 * Maps to kcal adjustment via: intensity * 7.5 (range: -750 to +750 kcal/day)
 *
 * Macro split interpolates smoothly:
 *   -100: protein 35%, fat 25%, carbs 40% (high protein for deep cut)
 *      0: protein 25%, fat 30%, carbs 45% (maintenance)
 *   +100: protein 25%, fat 20%, carbs 55% (high carbs for bulk)
 */
export function calculateDailyTargets(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  goalIntensity: number
): DailyTargets {
  const bmrKcal = calculateBmrKcal(gender, weightKg, heightCm, age);
  const tdeeKcal = bmrKcal * ACTIVITY_MULTIPLIERS[activityLevel];

  // Clamp intensity to -100..+100
  const clamped = Math.max(-100, Math.min(100, goalIntensity));
  const adjustmentKcal = clamped * 7.5;
  const targetKcal = Math.max(1200, tdeeKcal + adjustmentKcal); // floor at 1200 kcal
  const targetKj = Math.round(targetKcal * KJ_PER_KCAL);

  // Normalize to 0..1 where 0 = max deficit, 1 = max surplus
  const t = (clamped + 100) / 200;

  // Smooth macro split interpolation
  const proteinPct = 0.35 - t * 0.10;          // 0.35 at -100, 0.25 at +100
  const fatPct = 0.25 + 0.05 * (1 - Math.abs(2 * t - 1)); // peaks at 0.30 at center, 0.25 at edges
  const carbsPct = 1 - proteinPct - fatPct;     // remainder: ~0.40 at -100, 0.45 at 0, ~0.55 at +100

  // Protein: 4 kcal/g, Fat: 9 kcal/g, Carbs: 4 kcal/g
  const proteinG = Math.round((targetKcal * proteinPct) / 4);
  const fatG = Math.round((targetKcal * fatPct) / 9);
  const carbsG = Math.round((targetKcal * carbsPct) / 4);

  // Fiber: Australian RDI (NHMRC)
  const fiberG = gender === 'male' ? 30 : 25;

  // Saturated fat: WHO/AHA upper limit of <10% of daily energy
  const saturatedFatG = Math.round((targetKj * 0.10) / KJ_PER_G_FAT);

  return { energyKj: targetKj, proteinG, fatG, carbsG, fiberG, saturatedFatG };
}

export function saturatedFatTargetFromEnergyKj(energyKj: number): number {
  return Math.round((energyKj * 0.10) / KJ_PER_G_FAT);
}
