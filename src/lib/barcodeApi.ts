import type { ScannedNutrition } from '../models/types';
import { getCachedBarcode, cacheBarcode } from './db';
import { apiEnabled, apiFetch } from './api';

const KJ_PER_KCAL = 4.184;

interface OpenFoodFactsNutriments {
  'energy-kj_serving'?: number;
  'energy-kj_100g'?: number;
  'energy-kcal_serving'?: number;
  'energy-kcal_100g'?: number;
  'proteins_serving'?: number;
  'proteins_100g'?: number;
  'fat_serving'?: number;
  'fat_100g'?: number;
  'carbohydrates_serving'?: number;
  'carbohydrates_100g'?: number;
  'fiber_serving'?: number;
  'fiber_100g'?: number;
}

export interface BarcodeResult {
  found: boolean;
  nutrition: ScannedNutrition | null;
  productName: string;
}

const NOT_FOUND: BarcodeResult = { found: false, nutrition: null, productName: '' };

function toKj(nutriments: OpenFoodFactsNutriments, key: 'serving' | '100g'): string {
  const kjKey = `energy-kj_${key}` as keyof OpenFoodFactsNutriments;
  const kcalKey = `energy-kcal_${key}` as keyof OpenFoodFactsNutriments;
  const kj = nutriments[kjKey];
  if (kj != null) return String(Math.round(kj));
  const kcal = nutriments[kcalKey];
  if (kcal != null) return String(Math.round(kcal * KJ_PER_KCAL));
  return '';
}

function num(val: number | undefined): string {
  return val != null ? String(Math.round(val * 10) / 10) : '';
}

// --- Shared cache helpers (self-hosted API) ---

async function getFromSharedCache(barcode: string): Promise<BarcodeResult | null> {
  if (!apiEnabled) return null;
  try {
    const data = await apiFetch<{ found: boolean; productName: string; nutrition: ScannedNutrition }>(
      `/barcode/${barcode}`
    );
    if (!data.found) return null;
    return { found: true, nutrition: data.nutrition, productName: data.productName };
  } catch {
    return null;
  }
}

export async function saveToSharedCache(
  barcode: string,
  productName: string,
  nutrition: ScannedNutrition
): Promise<void> {
  if (!apiEnabled) return;
  try {
    await apiFetch(`/barcode/${barcode}`, {
      method: 'PUT',
      body: JSON.stringify({ productName, nutrition }),
    });
  } catch (err) {
    console.warn('Shared cache write failed:', err);
  }
}

// --- Open Food Facts helper (supports regional variants) ---

async function fetchFromOpenFoodFacts(
  barcode: string,
  region: string
): Promise<BarcodeResult> {
  try {
    const response = await fetch(
      `https://${region}.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return NOT_FOUND;
    const data = await response.json();
    if (data.status !== 1 || !data.product) return NOT_FOUND;

    const product = data.product;
    const n: OpenFoodFactsNutriments = product.nutriments ?? {};

    const nutrition: ScannedNutrition = {
      foodName: product.product_name ?? 'Unknown Product',
      servingSize: product.serving_size ?? '',
      servingsPerPackage: '',
      energyPerServing: toKj(n, 'serving'),
      proteinPerServing: num(n['proteins_serving']),
      fatPerServing: num(n['fat_serving']),
      carbsPerServing: num(n['carbohydrates_serving']),
      fiberPerServing: num(n['fiber_serving']),
      energyPer100g: toKj(n, '100g'),
      proteinPer100g: num(n['proteins_100g']),
      fatPer100g: num(n['fat_100g']),
      carbsPer100g: num(n['carbohydrates_100g']),
      fiberPer100g: num(n['fiber_100g']),
      rawText: `Barcode: ${barcode}`,
    };

    return { found: true, nutrition, productName: product.product_name ?? '' };
  } catch {
    return NOT_FOUND;
  }
}

// --- USDA FoodData Central helper ---

async function fetchFromUSDA(barcode: string): Promise<BarcodeResult> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_USDA_API_KEY || 'DEMO_KEY';
    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&dataType=Branded&pageSize=1&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return NOT_FOUND;

    const data = await response.json();
    if (!data.foods || data.foods.length === 0) return NOT_FOUND;

    const food = data.foods[0];
    // Verify the GTIN/UPC matches
    if (food.gtinUpc !== barcode) return NOT_FOUND;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getNutrient = (name: string): number | undefined => {
      const n = food.foodNutrients?.find((fn: any) => fn.nutrientName === name);
      return n?.value;
    };

    // USDA provides per-100g values
    const energyKcal = getNutrient('Energy');
    const energyKj = energyKcal != null ? String(Math.round(energyKcal * KJ_PER_KCAL)) : '';

    const servingSize = food.servingSize
      ? `${food.servingSize}${food.servingSizeUnit || 'g'}`
      : '';

    const nutrition: ScannedNutrition = {
      foodName: food.description || 'Unknown Product',
      servingSize,
      servingsPerPackage: '',
      energyPerServing: '',
      proteinPerServing: '',
      fatPerServing: '',
      carbsPerServing: '',
      fiberPerServing: '',
      energyPer100g: energyKj,
      proteinPer100g: num(getNutrient('Protein')),
      fatPer100g: num(getNutrient('Total lipid (fat)')),
      carbsPer100g: num(getNutrient('Carbohydrate, by difference')),
      fiberPer100g: num(getNutrient('Fiber, total dietary')),
      rawText: `Barcode: ${barcode}`,
    };

    return { found: true, nutrition, productName: food.description || '' };
  } catch {
    return NOT_FOUND;
  }
}

// --- Cache a successful result to local + shared ---

async function cacheResult(barcode: string, result: BarcodeResult): Promise<void> {
  if (!result.found || !result.nutrition) return;
  try { await cacheBarcode(barcode, result.productName, result.nutrition); } catch {}
  try { await saveToSharedCache(barcode, result.productName, result.nutrition); } catch {}
}

// --- Main lookup function ---

export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  // 1. Check local cache first (instant)
  try {
    const cached = await getCachedBarcode(barcode);
    if (cached) {
      return {
        found: true,
        nutrition: cached.nutrition,
        productName: cached.productName,
      };
    }
  } catch (err) {
    console.warn('Local cache read failed:', err);
  }

  // 2. Check shared server cache (fast, ~100ms)
  try {
    const shared = await getFromSharedCache(barcode);
    if (shared && shared.found && shared.nutrition) {
      try { await cacheBarcode(barcode, shared.productName, shared.nutrition); } catch {}
      return shared;
    }
  } catch (err) {
    console.warn('Shared cache read failed:', err);
  }

  // 3. Open Food Facts — world (primary)
  const worldResult = await fetchFromOpenFoodFacts(barcode, 'world');
  if (worldResult.found) {
    await cacheResult(barcode, worldResult);
    return worldResult;
  }

  // 4. Open Food Facts — AU + UK regions (in parallel)
  const [auResult, ukResult] = await Promise.all([
    fetchFromOpenFoodFacts(barcode, 'au'),
    fetchFromOpenFoodFacts(barcode, 'uk'),
  ]);
  if (auResult.found) {
    await cacheResult(barcode, auResult);
    return auResult;
  }
  if (ukResult.found) {
    await cacheResult(barcode, ukResult);
    return ukResult;
  }

  // 5. USDA FoodData Central
  const usdaResult = await fetchFromUSDA(barcode);
  if (usdaResult.found) {
    await cacheResult(barcode, usdaResult);
    return usdaResult;
  }

  return NOT_FOUND;
}
