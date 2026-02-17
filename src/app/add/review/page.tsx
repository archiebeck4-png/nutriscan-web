'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScanData } from '../../../context/ScanContext';
import { insertEntry, addFoodLogEntry } from '../../../lib/db';
import { todayDateString } from '../../../lib/dates';
import { parseServingSizeGrams } from '../../../lib/nutritionUtils';
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
  const router = useRouter();
  const { scanData, setScanData } = useScanData();
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
  const [quantityMode, setQuantityMode] = useState<'servings' | 'grams'>('servings');
  const [servingsConsumed, setServingsConsumed] = useState('1');
  const [gramsConsumed, setGramsConsumed] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!scanData) {
    return (
      <div className={styles.centered}>
        <p>No scan data. Go back and scan a label first.</p>
        <button className={styles.actionButton} onClick={() => router.push('/add')}>
          Back
        </button>
      </div>
    );
  }

  const updateField = (field: keyof ScannedNutrition, value: string) => {
    setNutrition((prev) => ({ ...prev, [field]: value }));
  };

  const parseNum = (value: string): number | null => {
    if (!value.trim()) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  };

  // Check if grams mode is possible
  const hasAnyPer100g = !!(
    nutrition.energyPer100g || nutrition.proteinPer100g ||
    nutrition.fatPer100g || nutrition.carbsPer100g
  );
  const canDeriveFromServing = !!parseServingSizeGrams(nutrition.servingSize);
  const canUseGramsMode = hasAnyPer100g || canDeriveFromServing;

  // Get effective per100g value (from data or derived)
  const getEffectivePer100g = (per100g: string, perServing: string): number | null => {
    const direct = parseNum(per100g);
    if (direct != null) return direct;
    const derived = derivePer100g(perServing, nutrition.servingSize);
    return parseNum(derived);
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

      // 2. Add to today's food log
      let energyKj: number, proteinG: number, fatG: number, carbsG: number, fiberG: number;

      if (quantityMode === 'grams') {
        const grams = parseFloat(gramsConsumed) || 0;
        const factor = grams / 100;
        energyKj = (getEffectivePer100g(nutrition.energyPer100g, nutrition.energyPerServing) ?? 0) * factor;
        proteinG = (getEffectivePer100g(nutrition.proteinPer100g, nutrition.proteinPerServing) ?? 0) * factor;
        fatG = (getEffectivePer100g(nutrition.fatPer100g, nutrition.fatPerServing) ?? 0) * factor;
        carbsG = (getEffectivePer100g(nutrition.carbsPer100g, nutrition.carbsPerServing) ?? 0) * factor;
        fiberG = (getEffectivePer100g(nutrition.fiberPer100g, nutrition.fiberPerServing) ?? 0) * factor;
      } else {
        const qty = parseFloat(servingsConsumed) || 1;
        energyKj = (parseNum(nutrition.energyPerServing) ?? 0) * qty;
        proteinG = (parseNum(nutrition.proteinPerServing) ?? 0) * qty;
        fatG = (parseNum(nutrition.fatPerServing) ?? 0) * qty;
        carbsG = (parseNum(nutrition.carbsPerServing) ?? 0) * qty;
        fiberG = (parseNum(nutrition.fiberPerServing) ?? 0) * qty;
      }

      const logEntry: FoodLogEntry = {
        id: crypto.randomUUID(),
        date: todayDateString(),
        createdAt: new Date().toISOString(),
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

      setScanData(null);
      router.push('/');
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setScanData(null);
    router.push('/add');
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
          {isSaving ? 'Saving...' : 'Log'}
        </button>
      </div>

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
          {/* Quantity mode toggle */}
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Log by</label>
            <div className={styles.segmentedControl}>
              <button
                className={`${styles.segmentButton} ${quantityMode === 'servings' ? styles.segmentActive : ''}`}
                onClick={() => setQuantityMode('servings')}
                type="button"
              >
                Servings
              </button>
              <button
                className={`${styles.segmentButton} ${quantityMode === 'grams' ? styles.segmentActive : ''}`}
                onClick={() => canUseGramsMode && setQuantityMode('grams')}
                disabled={!canUseGramsMode}
                type="button"
              >
                Grams
              </button>
            </div>
          </div>
          {quantityMode === 'servings' ? (
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
          ) : (
            <div className={styles.textFieldRow}>
              <label className={styles.fieldLabel}>Grams eaten</label>
              <input
                className={styles.textInput}
                value={gramsConsumed}
                onChange={(e) => setGramsConsumed(e.target.value)}
                placeholder="e.g. 150"
                inputMode="decimal"
              />
            </div>
          )}
          {quantityMode === 'grams' && nutrition.servingSize && (
            <div className={styles.servingRef}>
              1 serving = {nutrition.servingSize}
            </div>
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

        {/* Per 100g */}
        <div className="sectionHeader">PER 100g</div>
        <div className="section">
          <NutrientField label="Energy (kJ)" value={nutrition.energyPer100g} onChange={(v) => updateField('energyPer100g', v)} />
          <NutrientField label="Protein (g)" value={nutrition.proteinPer100g} onChange={(v) => updateField('proteinPer100g', v)} />
          <NutrientField label="Fat (g)" value={nutrition.fatPer100g} onChange={(v) => updateField('fatPer100g', v)} />
          <NutrientField label="Carbs (g)" value={nutrition.carbsPer100g} onChange={(v) => updateField('carbsPer100g', v)} />
          <NutrientField label="Fiber (g)" value={nutrition.fiberPer100g} onChange={(v) => updateField('fiberPer100g', v)} />
        </div>

        {/* Raw OCR Text */}
        {nutrition.rawText && (
          <>
            <button
              className="sectionHeader"
              style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left', color: 'inherit' }}
              onClick={() => setShowRawText((prev) => !prev)}
            >
              RAW OCR TEXT {showRawText ? '▼' : '▶'}
            </button>
            {showRawText && (
              <div className="section">
                <pre className={styles.rawText}>{nutrition.rawText}</pre>
              </div>
            )}
          </>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
