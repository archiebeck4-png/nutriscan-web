export interface ScannedNutrition {
  foodName: string;
  servingSize: string;
  servingsPerPackage: string;

  energyPerServing: string;
  proteinPerServing: string;
  fatPerServing: string;
  carbsPerServing: string;

  energyPer100g: string;
  proteinPer100g: string;
  fatPer100g: string;
  carbsPer100g: string;

  rawText: string;
}

export interface WebFoodEntry {
  id: string;
  foodName: string;
  dateScanned: string;

  energyPerServing: number | null;
  proteinPerServing: number | null;
  fatPerServing: number | null;
  carbsPerServing: number | null;

  energyPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  carbsPer100g: number | null;

  servingSize: string | null;
  servingsPerPackage: string | null;

  rawOcrText: string | null;
  imageBlob: Blob | null;
}
