import type { EnergyUnit, WeightUnit } from '../models/types';

export const KJ_PER_KCAL = 4.184;
export const LBS_PER_KG = 2.20462;
export const CM_PER_INCH = 2.54;

// --- Energy conversions ---

export function kjToDisplay(kj: number, unit: EnergyUnit): number {
  return unit === 'cal' ? kj / KJ_PER_KCAL : kj;
}

export function displayToKj(value: number, unit: EnergyUnit): number {
  return unit === 'cal' ? value * KJ_PER_KCAL : value;
}

export function energyLabel(unit: EnergyUnit): string {
  return unit === 'cal' ? 'cal' : 'kJ';
}

// --- Weight conversions ---

export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lbs' ? kg * LBS_PER_KG : kg;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lbs' ? value / LBS_PER_KG : value;
}

export function weightLabel(unit: WeightUnit): string {
  return unit === 'lbs' ? 'lbs' : 'kg';
}

// --- Height display ---

export function cmToDisplay(cm: number, unit: WeightUnit): string {
  if (unit === 'lbs') {
    const totalInches = cm / CM_PER_INCH;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${cm} cm`;
}

export function heightLabel(unit: WeightUnit): string {
  return unit === 'lbs' ? 'ft/in' : 'cm';
}

// --- Formatting ---

export function formatEnergy(kj: number, unit: EnergyUnit): string {
  const value = kjToDisplay(kj, unit);
  return `${Math.round(value).toLocaleString()} ${energyLabel(unit)}`;
}
