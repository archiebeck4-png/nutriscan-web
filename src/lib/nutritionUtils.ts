/**
 * Parse a serving size string to extract grams.
 * Handles patterns like "150g", "150 g", "200ml", "30g (1 cup)".
 */
export function parseServingSizeGrams(
  servingSize: string | null
): number | null {
  if (!servingSize) return null;
  const match = servingSize.match(/(\d+\.?\d*)\s*(g|ml)\b/i);
  if (match) return parseFloat(match[1]);
  return null;
}

/**
 * Derive a per-100g value from a per-serving value + serving size.
 * Returns null if serving size can't be parsed as grams.
 */
export function derivePer100gFromServing(
  perServingValue: number | null,
  servingSizeStr: string | null
): number | null {
  if (perServingValue == null) return null;
  const servingGrams = parseServingSizeGrams(servingSizeStr);
  if (!servingGrams || servingGrams <= 0) return null;
  return Math.round((perServingValue * (100 / servingGrams)) * 10) / 10;
}
