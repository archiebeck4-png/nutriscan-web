'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useScanData } from '../../../context/ScanContext';
import { insertEntry, addFoodLogEntry, cacheBarcode } from '../../../lib/db';
import { saveToSharedCache } from '../../../lib/barcodeApi';
import { todayDateString, currentTimeString } from '../../../lib/dates';
import { parseServingSizeGrams, derivePerServingFrom100g } from '../../../lib/nutritionUtils';
import type { ScannedNutrition, WebFoodEntry, FoodLogEntry } from '../../../models/types';
import NutrientField from '../../../components/NutrientField';
import styles from './page.module.css';

function derivePer100g(perServing: string, servingSize: string): string {
  const servingGrams = parseServingSizeGrams(servingSize);
  const perServingVal = parseFloat(perServing);
  if (servingGrams && servingGrams > 0 && !isNaN(perServingVal)) {
    return String(Math.round((perServingVal * (100 / servingGrams)) * 10) / 10);
  }
  return '';
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewPageContent />
    </Suspense>
  );
}

function ReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRecipeParam = searchParams.get('from') === 'recipe';
  const { scanData, setScanData } = useScanData();
  // fromRecipe can come from query param OR from context (survives barcode-lookup redirects)
  const fromRecipe = fromRecipeParam || scanData?.fromRecipe === true;
  const [nutrition, setNutrition] = useState<ScannedNutrition>(
    scanData?.nutrition ?? {
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
      rawText: '',
    }
  );
  const [servingsConsumed, setServingsConsumed] = useState('1');
  const [logTime, setLogTime] = useState(currentTimeString());
  const [isSaving, setIsSaving] = useState(false);

  // Auto-derive per-serving values from per-100g when user enters a serving size
  useEffect(() => {
    const servingGrams = parseServingSizeGrams(nutrition.servingSize);
    if (!servingGrams || servingGrams <= 0) return;

    const hasAnyPer100gData = !!(
      nutrition.energyPer100g || nutrition.proteinPer100g ||
      nutrition.fatPer100g || nutrition.carbsPer100g || nutrition.fiberPer100g
    );
    if (!hasAnyPer100gData) return;

    const perServingFields = [
      nutrition.energyPerServing,
      nutrition.proteinPerServing,
      nutrition.fatPerServing,
      nutrition.carbsPerServing,
      nutrition.fiberPerServing,
    ];
    const allPerServingEmpty = perServingFields.every(
      (v) => !v || v.trim() === '' || v.trim() === '0'
    );
    if (!allPerServingEmpty) return;

    // Derive per-serving from per-100g
    const derive = (per100gStr: string): string => {
      const val = parseFloat(per100gStr);
      if (isNaN(val)) return '';
      const result = derivePerServingFrom100g(val, nutrition.servingSize);
      return result != null ? String(result) : '';
    };

    setNutrition((prev) => ({
      ...prev,
      energyPerServing: derive(prev.energyPer100g),
      proteinPerServing: derive(prev.proteinPer100g),
      fatPerServing: derive(prev.fatPer100g),
      carbsPerServing: derive(prev.carbsPer100g),
      fiberPerServing: derive(prev.fiberPer100g),
    }));
  }, [nutrition.servingSize]);

  // Auto-redirect away if no scan data (e.g. user navigated back after logging)
  useEffect(() => {
    if (!scanData) {
      window.location.replace('/add');
    }
  }, [scanData]);

  if (!scanData) {
    return null;
  }

  const updateField = (field: keyof ScannedNutrition, value: string) => {
    setNutrition((prev) => ({ ...prev, [field]: value }));
  };

  const parseNum = (value: string): number | null => {
    if (!value.trim()) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const entryId = crypto.randomUUID();
      const foodName = nutrition.foodName.trim() || 'Unknown Food';
      const isBarcode = nutrition.rawText?.startsWith('Barcode:');

      // 1. Save to food library
      const entry: WebFoodEntry = {
        id: entryId,
        foodName,
        dateScanned: new Date().toISOString(),
        energyPerServing: parseNum(nutrition.energyPerServing),
        proteinPerServing: parseNum(nutrition.proteinPerServing),
        fatPerServing: parseNum(nutrition.fatPerServing),
        carbsPerServing: parseNum(nutrition.carbsPerServing),
        fiberPerServing: parseNum(nutrition.fiberPerServing),
        energyPer100g: parseNum(nutrition.energyPer100g),
        proteinPer100g: parseNum(nutrition.proteinPer100g),
        fatPer100g: parseNum(nutrition.fatPer100g),
        carbsPer100g: parseNum(nutrition.carbsPer100g),
        fiberPer100g: parseNum(nutrition.fiberPer100g),
        servingSize: nutrition.servingSize.trim() || null,
        servingsPerPackage: nutrition.servingsPerPackage.trim() || null,
        rawOcrText: nutrition.rawText || null,
        imageBlob: scanData.imageBlob,
      };
      await insertEntry(entry);

      // 2. Add to today's food log (skip if adding to a recipe)
      if (!fromRecipe) {
        const qty = parseFloat(servingsConsumed) || 1;
        const energyKj = (parseNum(nutrition.energyPerServing) ?? 0) * qty;
        const proteinG = (parseNum(nutrition.proteinPerServing) ?? 0) * qty;
        const fatG = (parseNum(nutrition.fatPerServing) ?? 0) * qty;
        const carbsG = (parseNum(nutrition.carbsPerServing) ?? 0) * qty;
        const fiberG = (parseNum(nutrition.fiberPerServing) ?? 0) * qty;

        const logEntry: FoodLogEntry = {
          id: crypto.randomUUID(),
          date: todayDateString(),
          createdAt: new Date().toISOString(),
          loggedAt: logTime,
          foodName,
          energyKj,
          proteinG,
          fatG,
          carbsG,
          fiberG,
          savedFoodId: entryId,
          source: isBarcode ? 'barcode' : 'scan',
        };
        await addFoodLogEntry(logEntry);
      }

      // 3. If this was a barcode-initiated scan, cache the nutrition for that barcode
      if (scanData.barcode) {
        try {
          await cacheBarcode(scanData.barcode, foodName, nutrition);
          await saveToSharedCache(scanData.barcode, foodName, nutrition);
        } catch (err) {
          console.warn('Barcode cache save failed:', err);
        }
      }

      setScanData(null);
      // Use native location.replace to fully exit — Next.js router.replace
      // doesn't reliably clear history in iOS standalone PWA / WKWebView
      window.location.replace(fromRecipe ? `/add/recipe?newIngredientId=${entryId}` : '/');
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setScanData(null);
    window.location.replace(fromRecipe ? '/add/recipe' : '/add');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.cancelButton} onClick={handleCancel}>
          Cancel
        </button>
        <h1 className={styles.title}>Review Scan</h1>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : fromRecipe ? 'Save' : 'Log'}
        </button>
      </div>

      {/* Barcode association badge */}
      {scanData.barcode && (
        <div className={styles.barcodeTag}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="6" y1="8" x2="6" y2="16" />
            <line x1="9" y1="8" x2="9" y2="16" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="15" y1="8" x2="15" y2="16" />
            <line x1="18" y1="8" x2="18" y2="16" />
          </svg>
          Barcode {scanData.barcode} — will be saved for future scans
        </div>
      )}

      <div className={styles.form}>
        {/* Food Details */}
        <div className="sectionHeader">FOOD DETAILS</div>
        <div className="section">
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Food Name</label>
            <input
              className={styles.textInput}
              value={nutrition.foodName}
              onChange={(e) => updateField('foodName', e.target.value)}
              placeholder="Enter food name"
            />
          </div>
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Serving Size</label>
            <input
              className={styles.textInput}
              value={nutrition.servingSize}
              onChange={(e) => updateField('servingSize', e.target.value)}
              placeholder="e.g. 150g"
            />
          </div>
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Servings/Pkg</label>
            <input
              className={styles.textInput}
              value={nutrition.servingsPerPackage}
              onChange={(e) =>
                updateField('servingsPerPackage', e.target.value)
              }
              placeholder="e.g. 4"
              inputMode="decimal"
            />
          </div>
          {!fromRecipe && (
            <>
              <div className={styles.textFieldRow}>
                <label className={styles.fieldLabel}>Servings eaten</label>
                <input
                  className={styles.textInput}
                  value={servingsConsumed}
                  onChange={(e) => setServingsConsumed(e.target.value)}
                  placeholder="1"
                  inputMode="decimal"
                />
              </div>
              <div className={styles.textFieldRow}>
                <label className={styles.fieldLabel}>Time</label>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* Per Serving */}
        <div className="sectionHeader">PER SERVING</div>
        <div className="section">
          <NutrientField label="Energy (kJ)" value={nutrition.energyPerServing} onChange={(v) => updateField('energyPerServing', v)} />
          <NutrientField label="Protein (g)" value={nutrition.proteinPerServing} onChange={(v) => updateField('proteinPerServing', v)} />
          <NutrientField label="Fat (g)" value={nutrition.fatPerServing} onChange={(v) => updateField('fatPerServing', v)} />
          <NutrientField label="Carbs (g)" value={nutrition.carbsPerServing} onChange={(v) => updateField('carbsPerServing', v)} />
          <NutrientField label="Fiber (g)" value={nutrition.fiberPerServing} onChange={(v) => updateField('fiberPerServing', v)} />
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
