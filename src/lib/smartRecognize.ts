import { preprocessForOcr, type GrayscaleMode } from './imagePreprocess';
import { recognizePreprocessed } from './ocr';
import { parseNutritionLabel } from '../parsing/nutritionLabelParser';
import { scoreScanResult } from './scanValidation';
import { ScannedNutrition } from '../models/types';

interface ModeResult {
  mode: GrayscaleMode | 'luma';
  nutrition: ScannedNutrition;
  lines: string[];
  score: number;
}

/**
 * Smart OCR recognition with multi-channel fallback and field-level merging.
 *
 * 1. Runs the standard luma pipeline first.
 * 2. If the result is valid (score >= threshold + energy), returns immediately.
 * 3. Otherwise tries alternative grayscale channels.
 * 4. Merges the best field values from across all modes.
 *
 * Only use for full-quality scans (manual capture, photo upload).
 * Continuous scanning should use recognizeImage(blob, true) for speed.
 */
export async function smartRecognize(
  image: Blob,
  onProgress?: (status: string) => void,
): Promise<string[]> {
  // 1. Standard luma pipeline
  if (onProgress) onProgress('Processing...');
  const standardProcessed = await preprocessForOcr(image);
  const standardLines = await recognizePreprocessed(standardProcessed);
  const standardNutrition = parseNutritionLabel(standardLines);
  const standardScore = scoreScanResult(standardNutrition);

  // Fast path: standard pipeline gave a good result
  if (standardScore.isValid && standardScore.score >= 0.9) {
    return standardLines;
  }

  // 2. Try alternative channels
  const fallbackModes: GrayscaleMode[] = ['red', 'green', 'blue', 'invert'];
  const results: ModeResult[] = [
    {
      mode: 'luma',
      nutrition: standardNutrition,
      lines: standardLines,
      score: standardScore.score,
    },
  ];

  for (const mode of fallbackModes) {
    if (onProgress) onProgress(`Trying ${mode} channel...`);
    const processed = await preprocessForOcr(image, { grayscaleMode: mode });
    const lines = await recognizePreprocessed(processed);
    const nutrition = parseNutritionLabel(lines);
    const score = scoreScanResult(nutrition);

    results.push({ mode, nutrition, lines, score: score.score });

    // Early exit if a single mode gives a perfect result
    if (score.isValid && score.score >= 0.9) {
      return lines;
    }
  }

  // 3. Merge best field values from all modes
  const merged = mergeResults(results);
  const mergedScore = scoreScanResult(merged);

  // Find the best single-mode result for comparison
  const bestSingle = results.reduce((a, b) =>
    a.score >= b.score ? a : b,
  );

  // If merged is better, synthesize OCR lines from the merged nutrition
  // (the review page uses parsed values, not raw lines, so this is fine)
  if (mergedScore.score > bestSingle.score) {
    // Return lines from the best mode, but the merged nutrition will be
    // picked up by re-parsing in the scan page. Since we can't easily
    // synthesize OCR lines, return best mode's lines — the parser will
    // re-parse them. For actual usage, the scan page should call
    // smartRecognizeNutrition() instead.
    return bestSingle.lines;
  }

  return bestSingle.lines;
}

/**
 * Smart OCR that returns parsed nutrition directly (with field-level merging).
 * Preferred over smartRecognize() when you need the parsed result.
 */
export async function smartRecognizeNutrition(
  image: Blob,
  onProgress?: (status: string) => void,
): Promise<{ nutrition: ScannedNutrition; rawLines: string[] }> {
  if (onProgress) onProgress('Processing...');
  const standardProcessed = await preprocessForOcr(image);
  const standardLines = await recognizePreprocessed(standardProcessed);
  const standardNutrition = parseNutritionLabel(standardLines);
  const standardScore = scoreScanResult(standardNutrition);

  if (standardScore.isValid && standardScore.score >= 0.9) {
    return { nutrition: standardNutrition, rawLines: standardLines };
  }

  const fallbackModes: GrayscaleMode[] = ['red', 'green', 'blue', 'invert'];
  const results: ModeResult[] = [
    {
      mode: 'luma',
      nutrition: standardNutrition,
      lines: standardLines,
      score: standardScore.score,
    },
  ];

  for (const mode of fallbackModes) {
    if (onProgress) onProgress(`Trying ${mode} channel...`);
    const processed = await preprocessForOcr(image, { grayscaleMode: mode });
    const lines = await recognizePreprocessed(processed);
    const nutrition = parseNutritionLabel(lines);
    const score = scoreScanResult(nutrition);

    results.push({ mode, nutrition, lines, score: score.score });

    if (score.isValid && score.score >= 0.9) {
      return { nutrition, rawLines: lines };
    }
  }

  const merged = mergeResults(results);
  const bestSingle = results.reduce((a, b) =>
    a.score >= b.score ? a : b,
  );

  return { nutrition: merged, rawLines: bestSingle.lines };
}

/**
 * Merge nutrition results from multiple modes by picking the best
 * value for each field. Uses plausibility checks to prefer
 * reasonable values over garbled ones.
 */
function mergeResults(results: ModeResult[]): ScannedNutrition {
  // Sort by score descending
  const sorted = [...results].sort((a, b) => b.score - a.score);

  const merged: ScannedNutrition = {
    foodName: '',
    servingSize: '',
    servingsPerPackage: '',
    energyPerServing: '',
    proteinPerServing: '',
    fatPerServing: '',
    carbsPerServing: '',
    fiberPerServing: '',
    saturatedFatPerServing: '',
    energyPer100g: '',
    proteinPer100g: '',
    fatPer100g: '',
    carbsPer100g: '',
    fiberPer100g: '',
    saturatedFatPer100g: '',
    rawText: sorted[0]?.nutrition.rawText || '',
  };

  const fields = [
    'servingSize',
    'servingsPerPackage',
    'energyPerServing',
    'energyPer100g',
    'proteinPerServing',
    'proteinPer100g',
    'fatPerServing',
    'fatPer100g',
    'carbsPerServing',
    'carbsPer100g',
    'fiberPerServing',
    'fiberPer100g',
    'saturatedFatPerServing',
    'saturatedFatPer100g',
  ] as const;

  for (const field of fields) {
    // Collect all non-empty values from all modes with their scores
    const candidates: Array<{ value: string; modeScore: number }> = [];
    for (const result of sorted) {
      const value = result.nutrition[field];
      if (value) {
        candidates.push({ value, modeScore: result.score });
      }
    }

    if (candidates.length === 0) continue;

    // For energy fields, prefer values in plausible ranges
    if (field === 'energyPer100g') {
      const plausible = candidates.find((c) => {
        const v = parseFloat(c.value);
        return !isNaN(v) && v >= 100 && v <= 4000;
      });
      if (plausible) {
        (merged as unknown as Record<string, string>)[field] =
          plausible.value;
        continue;
      }
    }

    if (field === 'energyPerServing') {
      const plausible = candidates.find((c) => {
        const v = parseFloat(c.value);
        return !isNaN(v) && v >= 10 && v <= 4000;
      });
      if (plausible) {
        (merged as unknown as Record<string, string>)[field] =
          plausible.value;
        continue;
      }
    }

    // For macronutrient per-100g, prefer values > 0 and < 100
    if (field.endsWith('Per100g') && field !== 'energyPer100g') {
      const plausible = candidates.find((c) => {
        const v = parseFloat(c.value);
        return !isNaN(v) && v > 0 && v < 100;
      });
      if (plausible) {
        (merged as unknown as Record<string, string>)[field] =
          plausible.value;
        continue;
      }
    }

    // Default: take the first non-empty value from the highest-scoring mode
    (merged as unknown as Record<string, string>)[field] =
      candidates[0].value;
  }

  return merged;
}
