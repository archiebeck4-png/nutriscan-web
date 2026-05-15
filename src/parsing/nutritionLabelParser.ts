import { ScannedNutrition } from '../models/types';

interface NutrientPair {
  perServing: string;
  per100g: string;
}

/**
 * Parse OCR text lines from a nutrition label (Australian NIP format)
 * into structured nutrition data.
 *
 * Australian labels typically show values in two columns:
 *   Per Serving | Per 100g
 */
export function parseNutritionLabel(ocrLines: string[]): ScannedNutrition {
  const result: ScannedNutrition = {
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
    rawText: ocrLines.join('\n'),
  };

  const normalizedLines = ocrLines.map(normalize);

  // Try to focus on just the nutrition table by finding boundaries
  const tableLines = extractTableRegion(normalizedLines);

  // Extract serving metadata (search all lines — header may be before table)
  result.servingSize = extractServingSize(normalizedLines);
  result.servingsPerPackage = extractServingsPerPackage(normalizedLines);

  // Extract nutrient values from the focused table region
  const energy = extractNutrientValues(['energy'], tableLines, true);
  result.energyPerServing = energy.perServing;
  result.energyPer100g = energy.per100g;

  const protein = extractNutrientValues(['protein'], tableLines);
  result.proteinPerServing = protein.perServing;
  result.proteinPer100g = protein.per100g;

  const fat = extractNutrientValues(
    ['fat, total', 'fat total', 'total fat', 'fat'],
    tableLines
  );
  result.fatPerServing = fat.perServing;
  result.fatPer100g = fat.per100g;

  const saturatedFat = extractNutrientValues(
    ['saturated fat', 'saturates', 'sat fat', 'saturated'],
    tableLines
  );
  result.saturatedFatPerServing = saturatedFat.perServing;
  result.saturatedFatPer100g = saturatedFat.per100g;

  const carbs = extractNutrientValues(
    ['carbohydrate', 'carbohydrates', 'carbs', 'carb'],
    tableLines
  );
  result.carbsPerServing = carbs.perServing;
  result.carbsPer100g = carbs.per100g;

  const fiber = extractNutrientValues(
    ['dietary fibre', 'dietary fiber', 'fibre', 'fiber'],
    tableLines
  );
  result.fiberPerServing = fiber.perServing;
  result.fiberPer100g = fiber.per100g;

  return result;
}

/**
 * Normalize an OCR line: lowercase, fix common OCR misreads, collapse whitespace.
 */
function normalize(line: string): string {
  let s = line.toLowerCase();

  // Fix OCR misreads: 'l' between digits → '1'
  s = s.replace(/(\d)l(\d)/g, '$11$2');

  // Fix OCR misreads: 'O' or 'o' after a digit → '0'
  s = s.replace(/(\d)[Oo]/g, '$10');

  // Fix OCR misread kJ variants: k), k], kl, ki → kj
  s = s.replace(/k[)\]li]/g, 'kj');

  // Fix "less than 1g" → keep as "less than 1g" (preserve for later parsing)
  // Fix pipe characters that OCR reads from table lines
  s = s.replace(/[|]/g, ' ');

  // Collapse multiple spaces into one
  s = s.replace(/\s+/g, ' ');

  return s.trim();
}

/**
 * Try to extract just the nutrition table lines from the full OCR output.
 * Looks for "nutrition information" header and takes lines until the end
 * of the table (detected by finding ingredients or other non-table content).
 * Falls back to all lines if no table boundaries found.
 */
function extractTableRegion(lines: string[]): string[] {
  let startIdx = -1;

  // Find the "nutrition information" header
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('nutrition') && lines[i].includes('information')) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    // No header found — use all lines
    return lines;
  }

  // Find the end of the table by looking for non-table content
  // Table ends when we hit ingredients, disclaimers, or other content
  const endMarkers = ['ingredient', 'contains', 'allergen', 'manufactured',
    'fermented', 'store in', 'ready to eat', 'best before',
    'made in', 'product of', '% daily intake', 'daily intakes',
    'meat including', 'including pork', 'including beef',
    'may contain', 'warning', 'storage'];
  let endIdx = lines.length;

  // Start looking a few lines after the header (skip column headers)
  for (let i = startIdx + 3; i < lines.length; i++) {
    const line = lines[i];
    // Check if this line matches an end marker
    const isEndMarker = endMarkers.some((marker) => line.includes(marker));
    // Also end if the line has no numbers at all and is long (likely paragraph text)
    const hasNumbers = /\d/.test(line);
    const isLongText = line.length > 50 && !hasNumbers;

    if (isEndMarker || isLongText) {
      endIdx = i;
      break;
    }
  }

  return lines.slice(startIdx, endIdx);
}

/**
 * Extract the serving size from lines like:
 *   "Serving Size: 150g"
 *   "Serving size 40g"
 *   "per serving (150g)"
 *   "per 40g serving"
 *   "per serve: 30g"
 *   Column headers: "Per Serving (250ml)"
 */
function extractServingSize(lines: string[]): string {
  // Pass 1: explicit "serving size" label (most reliable)
  for (const line of lines) {
    const match = line.match(/serving\s*size\s*:?\s*(.+)/);
    if (match) {
      return cleanServingSize(match[1]);
    }
  }

  // Pass 2: "per serving (Xg)" or "per serve (Xg)" in column headers
  for (const line of lines) {
    const match = line.match(/per\s*serv(?:ing|e)\s*\(([^)]+)\)/);
    if (match) {
      return cleanServingSize(match[1]);
    }
  }

  // Pass 3: "per Xg serving" or "per Xml serving"
  for (const line of lines) {
    const match = line.match(/per\s+(\d+\.?\d*\s*(?:g|ml))\s+serv/);
    if (match) {
      return cleanServingSize(match[1]);
    }
  }

  // Pass 4: "per serve: Xg" or "per serve Xg"
  for (const line of lines) {
    const match = line.match(/per\s*serve\s*:?\s*(\d+\.?\d*\s*(?:g|ml))/);
    if (match) {
      return cleanServingSize(match[1]);
    }
  }

  return '';
}

/**
 * Clean up a serving size string — trim whitespace, remove trailing junk
 */
function cleanServingSize(raw: string): string {
  let s = raw.trim();
  // Remove trailing non-alphanumeric junk (OCR artifacts)
  s = s.replace(/[^a-z0-9.)]+$/i, '');
  return s;
}

/**
 * Extract servings per package from lines like "Servings per package: 4"
 */
function extractServingsPerPackage(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/servings?\s*per\s*package\s*:?\s*(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * For a given nutrient keyword, find the matching OCR line and extract
 * two numeric values: per serving (first) and per 100g (second).
 *
 * Handles:
 * - %DI columns between per-serving and per-100g (filtered out)
 * - "NOT DETECTED" values → "0"
 * - "LESS THAN Xg" → the number X
 * - OCR splitting rows across multiple lines
 */
function extractNutrientValues(
  keywords: string[],
  lines: string[],
  isEnergy: boolean = false,
): NutrientPair {
  for (const keyword of keywords) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(keyword)) {
        // Check for "not detected" — treat as 0 for both columns
        const afterKeyword = line.substring(line.indexOf(keyword) + keyword.length);
        if (afterKeyword.includes('not detected')) {
          return { perServing: '0', per100g: '0' };
        }

        // Try extracting from keyword line only, and also from merged line+next
        const numbersFromLine = extractNumbers(line, keyword);
        let numbers = numbersFromLine;

        if (i + 1 < lines.length) {
          const mergedLine = line + ' ' + lines[i + 1];
          const mergedNumbers = extractNumbers(mergedLine, keyword);

          if (mergedNumbers.length >= 2) {
            // Prefer merged if it gives a more plausible pair
            // (per100g should be >= perServing for non-energy values)
            const mA = parseFloat(mergedNumbers[0]) || 0;
            const mB = parseFloat(mergedNumbers[1]) || 0;
            const lA = parseFloat(numbersFromLine[0]) || 0;
            const lB = parseFloat(numbersFromLine[1]) || 0;

            if (numbers.length < 2) {
              // Definitely use merged if line-only had < 2 numbers
              numbers = mergedNumbers;
            } else if (!isEnergy && mB > mA && !(lB > lA)) {
              // Merged has correct ordering (per100g > perServing) but line-only doesn't
              numbers = mergedNumbers;
            } else if (mergedNumbers.length > numbers.length) {
              numbers = mergedNumbers;
            }
          }
        }

        if (numbers.length >= 2) {
          // Fix obvious OCR errors first
          const fixed = numbers.map((n) => fixOcrNumber(n, isEnergy));

          if (isEnergy) {
            // For energy, just take first two values
            return { perServing: fixed[0], per100g: fixed[1] };
          }

          // For macronutrients: expand each number with decimal variants,
          // then find the best consecutive pair across all candidates
          const expandedPairs: Array<{
            a: string;
            b: string;
            origA: string;
            origB: string;
          }> = [];
          for (let p = 0; p < fixed.length - 1; p++) {
            const aVars = [fixed[p], ...decimalVariants(fixed[p])];
            const bVars = [fixed[p + 1], ...decimalVariants(fixed[p + 1])];
            for (const av of aVars) {
              for (const bv of bVars) {
                expandedPairs.push({
                  a: av,
                  b: bv,
                  origA: fixed[p],
                  origB: fixed[p + 1],
                });
              }
            }
          }

          let bestResult = { a: fixed[0], b: fixed[1] };
          let bestScore = -Infinity;
          for (const pair of expandedPairs) {
            const s = scorePair(pair.a, pair.b, pair.origA, pair.origB);
            if (s > bestScore) {
              bestScore = s;
              bestResult = pair;
            }
          }

          return {
            perServing: bestResult.a,
            per100g: bestResult.b,
          };
        } else if (numbers.length === 1) {
          const fixed = fixOcrNumber(numbers[0], isEnergy);
          if (line.includes('100')) {
            return { perServing: '', per100g: fixed };
          } else {
            return { perServing: fixed, per100g: '' };
          }
        }
      }
    }
  }
  return { perServing: '', per100g: '' };
}

/**
 * Fix common OCR number errors:
 * - Trailing '9' that's likely a misread 'g' (e.g., "1.29" → "1.2", "21.89" → "21.8")
 * - Missing decimal point in macronutrient values (e.g., "261" → "26.1" for grams)
 *
 * Uses heuristics based on expected ranges for nutrition values.
 */
function fixOcrNumber(numStr: string, isEnergy: boolean): string {
  const val = parseFloat(numStr);
  if (isNaN(val)) return numStr;

  // For energy (kJ), values up to ~4000 per 100g are normal, don't modify
  if (isEnergy) return numStr;

  // Pattern: "X.Y9" where the trailing 9 is likely a misread 'g'
  // e.g., "1.29" → "1.2", "21.89" → "21.8", "3.09" → "3.0"
  if (numStr.match(/\.\d9$/) && !numStr.endsWith('.9')) {
    return numStr.slice(0, -1);
  }

  // Pattern: 3+ digit integer that should have a decimal point
  // e.g., "261" → "26.1", "652" → "65.2"
  if (!numStr.includes('.') && val >= 100 && val < 1000) {
    const fixed = numStr.slice(0, -1) + '.' + numStr.slice(-1);
    const fixedVal = parseFloat(fixed);
    if (fixedVal < 100) return fixed;
  }

  return numStr;
}

/**
 * Generate decimal-inserted variants for a number string.
 * e.g. "87" → ["8.7"], "21" → ["2.1"], "53" → ["5.3"]
 * Only generates variants that are valid macronutrient values (0-100).
 */
function decimalVariants(numStr: string): string[] {
  const val = parseFloat(numStr);
  if (isNaN(val) || numStr.includes('.') || numStr.length < 2) return [];
  const variants: string[] = [];
  for (let pos = 1; pos < numStr.length; pos++) {
    const candidate = numStr.slice(0, pos) + '.' + numStr.slice(pos);
    const cv = parseFloat(candidate);
    if (cv > 0 && cv < 100) {
      variants.push(candidate);
    }
  }
  return variants;
}

/**
 * Score a candidate perServing/per100g pair for plausibility.
 * Higher score = more plausible. Used to select the best pair from
 * multiple candidates including decimal-inserted variants.
 */
function scorePair(
  aStr: string,
  bStr: string,
  origA: string,
  origB: string,
): number {
  const a = parseFloat(aStr) || 0;
  const b = parseFloat(bStr) || 0;

  if (b < a) return -100;
  if (a < 0 || b < 0) return -100;
  if (a >= 100 || b >= 100) return -100;

  let score = 0;

  // Ratio scoring: typical serving is 20-50g, so per100g/perServing ~ 2-5x
  if (a > 0 && b > 0) {
    const ratio = b / a;
    if (ratio >= 1.5 && ratio <= 8) score += 4;
    else if (ratio >= 1 && ratio <= 12) score += 2;
  }

  if (a > 0 && a <= 50) score += 2;
  if (b > 0 && b <= 80) score += 1;

  // Prefer values with decimal points (OCR commonly drops them)
  if (aStr.includes('.')) score += 1.5;
  if (bStr.includes('.')) score += 1.5;

  // Small bonus for not modifying
  if (aStr === origA) score += 0.2;
  if (bStr === origB) score += 0.2;

  return score;
}

/**
 * Extract numeric values from text, skipping %DI values and "100g"/"100ml" headers.
 *
 * Strategy:
 * 1. Remove %DI values (number followed by %)
 * 2. Remove "100g"/"100ml" column headers
 * 3. Extract numbers in left-to-right order (preserving column position)
 */
function extractNumbers(text: string, keyword: string | null): string[] {
  let searchText = text;

  // Remove the keyword portion so we only look at numeric parts
  if (keyword) {
    const idx = searchText.indexOf(keyword);
    if (idx !== -1) {
      searchText = searchText.substring(idx + keyword.length);
    }
  }

  // Remove %DI values: number followed by optional space then %
  searchText = searchText.replace(/\d[\d,]*\.?\d*\s*%/g, ' ');

  // Remove "per 100g" / "100g" / "100ml" column headers
  searchText = searchText.replace(/\bper\s*100\s*(g|ml)\b/gi, ' ');
  searchText = searchText.replace(/\b100(g|ml)\b/gi, ' ');

  // Strip unit suffixes from numbers so "1.2g" → "1.2 " and doesn't
  // get misread as "1.29" when OCR confuses 'g' for '9'
  searchText = searchText.replace(
    /(\d[\d,]*\.?\d*)\s*(kj|g|mg|ml)\b/gi,
    '$1 '
  );

  // Match decimal numbers in left-to-right order
  const pattern = /\d[\d,]*\.?\d*/g;
  const matches = searchText.match(pattern) || [];

  return matches
    .map((m) => m.replace(/,/g, ''))
    .filter((n) => n !== '100');
}
