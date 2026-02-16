import { preprocessForOcr, type GrayscaleMode } from './imagePreprocess';
import { recognizePreprocessed, setOcrProgressCallback } from './ocr';
import { parseNutritionLabel } from '../parsing/nutritionLabelParser';
import { scoreScanResult } from './scanValidation';

/**
 * Smart OCR recognition with multi-channel fallback.
 *
 * 1. Runs the standard luma pipeline first.
 * 2. If the result is valid (score >= threshold + energy), returns immediately.
 * 3. Otherwise tries alternative grayscale channels (red, green, blue, inverted).
 * 4. Returns the highest-scoring result.
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

  // Fast path: standard pipeline worked
  if (standardScore.isValid) {
    return standardLines;
  }

  // 2. Try alternative channels
  const fallbackModes: GrayscaleMode[] = ['red', 'green', 'blue', 'invert'];
  let bestLines = standardLines;
  let bestScore = standardScore.score;

  for (const mode of fallbackModes) {
    if (onProgress) onProgress(`Trying ${mode} channel...`);
    const processed = await preprocessForOcr(image, { grayscaleMode: mode });
    const lines = await recognizePreprocessed(processed);
    const nutrition = parseNutritionLabel(lines);
    const score = scoreScanResult(nutrition);

    if (score.score > bestScore) {
      bestLines = lines;
      bestScore = score.score;
    }

    // Early exit if we found a valid result
    if (score.isValid) break;
  }

  return bestLines;
}
