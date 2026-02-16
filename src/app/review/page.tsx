'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScanData } from '../../context/ScanContext';
import { insertEntry } from '../../lib/db';
import { ScannedNutrition, WebFoodEntry } from '../../models/types';
import NutrientField from '../../components/NutrientField';
import styles from './page.module.css';

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
      energyPer100g: '',
      proteinPer100g: '',
      fatPer100g: '',
      carbsPer100g: '',
      rawText: '',
    }
  );
  const [showRawText, setShowRawText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // If no scan data, redirect back
  if (!scanData) {
    return (
      <div className={styles.centered}>
        <p>No scan data. Go back and scan a label first.</p>
        <button className={styles.actionButton} onClick={() => router.push('/')}>
          Back to Scan
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

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const entry: WebFoodEntry = {
        id: crypto.randomUUID(),
        foodName: nutrition.foodName.trim() || 'Unknown Food',
        dateScanned: new Date().toISOString(),
        energyPerServing: parseNum(nutrition.energyPerServing),
        proteinPerServing: parseNum(nutrition.proteinPerServing),
        fatPerServing: parseNum(nutrition.fatPerServing),
        carbsPerServing: parseNum(nutrition.carbsPerServing),
        energyPer100g: parseNum(nutrition.energyPer100g),
        proteinPer100g: parseNum(nutrition.proteinPer100g),
        fatPer100g: parseNum(nutrition.fatPer100g),
        carbsPer100g: parseNum(nutrition.carbsPer100g),
        servingSize: nutrition.servingSize.trim() || null,
        servingsPerPackage: nutrition.servingsPerPackage.trim() || null,
        rawOcrText: nutrition.rawText || null,
        imageBlob: scanData.imageBlob,
      };

      await insertEntry(entry);
      setScanData(null);
      router.push('/history');
    } catch (error) {
      console.error('Failed to save entry:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setScanData(null);
    router.push('/');
  };

  return (
    <div className={styles.container}>
      {/* Header */}
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
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Form */}
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
              onChange={(e) => updateField('servingsPerPackage', e.target.value)}
              placeholder="e.g. 4"
              inputMode="decimal"
            />
          </div>
        </div>

        {/* Per Serving */}
        <div className="sectionHeader">PER SERVING</div>
        <div className="section">
          <NutrientField label="Energy (kJ)" value={nutrition.energyPerServing} onChange={(v) => updateField('energyPerServing', v)} />
          <NutrientField label="Protein (g)" value={nutrition.proteinPerServing} onChange={(v) => updateField('proteinPerServing', v)} />
          <NutrientField label="Fat (g)" value={nutrition.fatPerServing} onChange={(v) => updateField('fatPerServing', v)} />
          <NutrientField label="Carbs (g)" value={nutrition.carbsPerServing} onChange={(v) => updateField('carbsPerServing', v)} />
        </div>

        {/* Per 100g */}
        <div className="sectionHeader">PER 100g</div>
        <div className="section">
          <NutrientField label="Energy (kJ)" value={nutrition.energyPer100g} onChange={(v) => updateField('energyPer100g', v)} />
          <NutrientField label="Protein (g)" value={nutrition.proteinPer100g} onChange={(v) => updateField('proteinPer100g', v)} />
          <NutrientField label="Fat (g)" value={nutrition.fatPer100g} onChange={(v) => updateField('fatPer100g', v)} />
          <NutrientField label="Carbs (g)" value={nutrition.carbsPer100g} onChange={(v) => updateField('carbsPer100g', v)} />
        </div>

        {/* Raw OCR Text */}
        {nutrition.rawText && (
          <>
            <button
              className="sectionHeader"
              style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
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
