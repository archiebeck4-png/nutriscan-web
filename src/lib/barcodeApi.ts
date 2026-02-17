import type { ScannedNutrition } from '../models/types';
import { getCachedBarcode, cacheBarcode } from './db';
import { supabase } from './supabase';

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

// --- Shared (Supabase) cache helpers ---

async function getFromSharedCache(barcode: string): Promise<BarcodeResult | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('barcode_cache')
      .select('product_name, nutrition')
      .eq('barcode', barcode)
      .single();
    if (error || !data) return null;
    return {
      found: true,
      nutrition: data.nutrition as ScannedNutrition,
      productName: data.product_name,
    };
  } catch {
    return null;
  }
}

export async function saveToSharedCache(
  barcode: string,
  productName: string,
  nutrition: ScannedNutrition
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('barcode_cache')
      .upsert(
        {
          barcode,
          product_name: productName,
          nutrition,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'barcode' }
      );
  } catch (err) {
    console.warn('Shared cache write failed:', err);
  }
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

  // 2. Check shared Supabase cache (fast, ~100ms)
  try {
    const shared = await getFromSharedCache(barcode);
    if (shared && shared.found && shared.nutrition) {
      // Save to local cache for offline/fast access
      try { await cacheBarcode(barcode, shared.productName, shared.nutrition); } catch {}
      return shared;
    }
  } catch (err) {
    console.warn('Shared cache read failed:', err);
  }

  // 3. Fetch from Open Food Facts API (slow, ~1-3s)
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

    const productName = product.product_name ?? '';

    // Save to both caches
    try { await cacheBarcode(barcode, productName, nutrition); } catch {}
    try { await saveToSharedCache(barcode, productName, nutrition); } catch {}

    return { found: true, nutrition, productName };
  } catch (err) {
    console.error('Barcode lookup failed:', err);
    return { found: false, nutrition: null, productName: '' };
  }
}
