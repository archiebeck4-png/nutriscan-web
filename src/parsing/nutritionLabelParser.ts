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
    energyPer100g: '',
    proteinPer100g: '',
    fatPer100g: '',
    carbsPer100g: '',
    fiberPer100g: '',
    rawText: ocrLines.join('\n'),
  };

  const normalizedLines = ocrLines.map(normalize);

  // Extract serving metadata
  result.servingSize = extractServingSize(normalizedLines);
  result.servingsPerPackage = extractServingsPerPackage(normalizedLines);

  // Extract nutrient values
  const energy = extractNutrientValues(['energy'], normalizedLines);
  result.energyPerServing = energy.perServing;
  result.energyPer100g = energy.per100g;

  const protein = extractNutrientValues(['protein'], normalizedLines);
  result.proteinPerServing = protein.perServing;
  result.proteinPer100g = protein.per100g;

  const fat = extractNutrientValues(
    ['fat, total', 'fat total', 'total fat', 'fat'],
    normalizedLines
  );
  result.fatPerServing = fat.perServing;
  result.fatPer100g = fat.per100g;

  const carbs = extractNutrientValues(
    ['carbohydrate', 'carbohydrates', 'carbs', 'carb'],
    normalizedLines
  );
  result.carbsPerServing = carbs.perServing;
  result.carbsPer100g = carbs.per100g;

  const fiber = extractNutrientValues(
    ['dietary fibre', 'dietary fiber', 'fibre', 'fiber'],
    normalizedLines
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
  // Using a non-lookbehind approach for broader compatibility
  s = s.replace(/(\d)l(\d)/g, '$1' + '1' + '$2');

  // Fix OCR misreads: 'O' or 'o' after a digit → '0'
  s = s.replace(/(\d)[Oo]/g, '$1' + '0');

  // Collapse multiple spaces into one
  s = s.replace(/\s+/g, ' ');

  return s.trim();
}

/**
 * Extract the serving size from lines like "Serving Size: 150g"
 */
function extractServingSize(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/serving\s*size\s*:?\s*(.+)/);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
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
 */
function extractNutrientValues(
  keywords: string[],
  lines: string[]
): NutrientPair {
  for (const keyword of keywords) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(keyword)) {
        let numbers = extractNumbers(line, keyword);

        // If fewer than 2 numbers, check the next line
        // (OCR sometimes splits a table row across two lines)
        if (numbers.length < 2 && i + 1 < lines.length) {
          const nextLineNumbers = extractNumbers(lines[i + 1], null);
          numbers = numbers.concat(nextLineNumbers);
        }

        if (numbers.length >= 2) {
          // Australian NIP: first number = per serving, second = per 100g
          return { perServing: numbers[0], per100g: numbers[1] };
        } else if (numbers.length === 1) {
          // Only one value found — determine which column it belongs to
          if (line.includes('100')) {
            return { perServing: '', per100g: numbers[0] };
          } else {
            return { perServing: numbers[0], per100g: '' };
          }
        }
      }
    }
  }
  return { perServing: '', per100g: '' };
}

/**
 * Extract numeric values from text, skipping "100" when it's part of "100g"/"100ml"
 * column headers.
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

  // Match decimal numbers: "608", "12.5", "1,234"
  const pattern = /\d[\d,]*\.?\d*/g;
  const matches = searchText.match(pattern) || [];

  return matches
    .map((m) => m.replace(/,/g, ''))
    .filter((numberStr) => {
      // Skip "100" if it's the "per 100g" / "per 100ml" column header
      if (numberStr === '100') {
        const idx = searchText.indexOf(numberStr);
        const afterIdx = idx + numberStr.length;
        if (afterIdx < searchText.length) {
          const afterChar = searchText[afterIdx];
          if (afterChar === 'g' || afterChar === 'm') {
            return false;
          }
        }
      }
      return true;
    });
}
