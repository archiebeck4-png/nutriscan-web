import type { Gender, ActivityLevel, WeightGoal } from '../models/types';

export interface DailyTargets {
  energyKj: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
}

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

// --- Goal calorie adjustments (kcal/day) ---
const GOAL_ADJUSTMENTS: Record<WeightGoal, number> = {
  lose: -500, // ~0.5 kg/week deficit
  maintain: 0,
  gain: 300, // lean bulk surplus
};

const KJ_PER_KCAL = 4.184;

export function calculateDailyTargets(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: ActivityLevel,
  goal: WeightGoal
): DailyTargets {
  const bmrKcal = calculateBmrKcal(gender, weightKg, heightCm, age);
  const tdeeKcal = bmrKcal * ACTIVITY_MULTIPLIERS[activityLevel];
  const targetKcal = tdeeKcal + GOAL_ADJUSTMENTS[goal];
  const targetKj = Math.round(targetKcal * KJ_PER_KCAL);

  // Macro split based on goal
  let proteinPct: number, fatPct: number, carbsPct: number;
  switch (goal) {
    case 'lose':
      proteinPct = 0.3;
      fatPct = 0.25;
      carbsPct = 0.45;
      break;
    case 'gain':
      proteinPct = 0.25;
      fatPct = 0.25;
      carbsPct = 0.5;
      break;
    case 'maintain':
    default:
      proteinPct = 0.25;
      fatPct = 0.3;
      carbsPct = 0.45;
      break;
  }

  // Protein: 4 kcal/g, Fat: 9 kcal/g, Carbs: 4 kcal/g
  const proteinG = Math.round((targetKcal * proteinPct) / 4);
  const fatG = Math.round((targetKcal * fatPct) / 9);
  const carbsG = Math.round((targetKcal * carbsPct) / 4);

  // Fiber: Australian RDI (NHMRC)
  const fiberG = gender === 'male' ? 30 : 25;

  return { energyKj: targetKj, proteinG, fatG, carbsG, fiberG };
}
