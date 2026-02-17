import type { ScannedNutrition } from '../models/types';
import { getCachedBarcode, cacheBarcode } from './db';

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

export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  // 1. Check local cache first
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
    console.warn('Cache read failed, falling back to API:', err);
  }

  // 2. Fetch from Open Food Facts API
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!response.ok) {
      return { found: false, nutrition: null, productName: '' };
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return { found: false, nutrition: null, productName: '' };
    }

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

    // 3. Cache the successful result
    try {
      await cacheBarcode(barcode, product.product_name ?? '', nutrition);
    } catch (err) {
      console.warn('Cache write failed:', err);
    }

    return { found: true, nutrition, productName: product.product_name ?? '' };
  } catch (err) {
    console.error('Barcode lookup failed:', err);
    return { found: false, nutrition: null, productName: '' };
  }
}
