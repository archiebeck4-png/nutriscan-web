'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addFoodLogEntry, insertEntry, cacheBarcode } from '../../../lib/db';
import { saveToSharedCache } from '../../../lib/barcodeApi';
import { todayDateString, currentTimeString } from '../../../lib/dates';
import { useProfile } from '../../../context/ProfileContext';
import { useScanData } from '../../../context/ScanContext';
import { energyLabel, displayToKj } from '../../../lib/units';
import type { FoodLogEntry, ScannedNutrition, WebFoodEntry } from '../../../models/types';
import NutrientField from '../../../components/NutrientField';
import styles from './page.module.css';

export default function ManualEntryPage() {
  return (
    <Suspense>
      <ManualEntryContent />
    </Suspense>
  );
}

function ManualEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRecipe = searchParams.get('from') === 'recipe';
  const { profile } = useProfile();
  const { scanData, setScanData } = useScanData();
  const pendingBarcode = scanData?.barcode ?? null;
  const eu = profile?.energyUnit ?? 'kj';
  const [foodName, setFoodName] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [logTime, setLogTime] = useState(currentTimeString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Convert energy from user's display unit to kJ for storage
      const rawEnergy = parseFloat(energy) || 0;
      const energyKj = displayToKj(rawEnergy, eu);
      const name = foodName.trim() || 'Unknown Food';

      // Always save to library (entries table)
      const libraryEntry: WebFoodEntry = {
        id: crypto.randomUUID(),
        foodName: name,
        dateScanned: new Date().toISOString(),
        energyPerServing: energyKj,
        proteinPerServing: parseFloat(protein) || 0,
        fatPerServing: parseFloat(fat) || 0,
        carbsPerServing: parseFloat(carbs) || 0,
        fiberPerServing: parseFloat(fiber) || 0,
        energyPer100g: null,
        proteinPer100g: null,
        fatPer100g: null,
        carbsPer100g: null,
        fiberPer100g: null,
        servingSize: servingSize.trim() || null,
        servingsPerPackage: null,
        rawOcrText: null,
        imageBlob: null,
      };
      await insertEntry(libraryEntry);

      // Only log to food diary if NOT coming from recipe page
      if (!fromRecipe) {
        const logEntry: FoodLogEntry = {
          id: crypto.randomUUID(),
          date: todayDateString(),
          createdAt: new Date().toISOString(),
          loggedAt: logTime,
          foodName: name,
          energyKj,
          proteinG: parseFloat(protein) || 0,
          fatG: parseFloat(fat) || 0,
          carbsG: parseFloat(carbs) || 0,
          fiberG: parseFloat(fiber) || 0,
          savedFoodId: libraryEntry.id,
          source: pendingBarcode ? 'barcode' : 'manual',
        };
        await addFoodLogEntry(logEntry);
      }

      // If this was for an unknown barcode, cache the nutrition
      if (pendingBarcode) {
        const nutritionForCache: ScannedNutrition = {
          foodName: name,
          servingSize: servingSize.trim(),
          servingsPerPackage: '',
          energyPerServing: energyKj ? String(Math.round(energyKj)) : '',
          proteinPerServing: protein || '',
          fatPerServing: fat || '',
          carbsPerServing: carbs || '',
          fiberPerServing: fiber || '',
          energyPer100g: '',
          proteinPer100g: '',
          fatPer100g: '',
          carbsPer100g: '',
          fiberPer100g: '',
          rawText: `Barcode: ${pendingBarcode}`,
        };
        try {
          await cacheBarcode(pendingBarcode, name, nutritionForCache);
          await saveToSharedCache(pendingBarcode, name, nutritionForCache);
        } catch (err) {
          console.warn('Barcode cache save failed:', err);
        }
        setScanData(null);
      }

      router.push(fromRecipe ? `/add/recipe?newIngredientId=${libraryEntry.id}` : '/');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (pendingBarcode) setScanData(null);
    router.push(fromRecipe ? '/add/recipe' : '/add');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.cancelButton} onClick={handleCancel}>
          Cancel
        </button>
        <h1 className={styles.title}>Manual Entry</h1>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : fromRecipe ? 'Save' : 'Log'}
        </button>
      </div>

      {/* Barcode association badge */}
      {pendingBarcode && (
        <div className={styles.barcodeTag}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="6" y1="8" x2="6" y2="16" />
            <line x1="9" y1="8" x2="9" y2="16" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="15" y1="8" x2="15" y2="16" />
            <line x1="18" y1="8" x2="18" y2="16" />
          </svg>
          Barcode {pendingBarcode} — will be saved for future scans
        </div>
      )}

      <div className={styles.form}>
        <div className="sectionHeader">FOOD</div>
        <div className="section">
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Food Name</label>
            <input
              className={styles.textInput}
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g. Chicken breast"
            />
          </div>
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Serving Size (g)</label>
            <input
              className={styles.textInput}
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
              placeholder="e.g. 100"
              inputMode="decimal"
            />
          </div>
        </div>

        {!fromRecipe && (
          <>
            <div className="sectionHeader">TIME</div>
            <div className="section">
              <div className={styles.textFieldRow}>
                <label className={styles.fieldLabel}>Time</label>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={logTime}
                  onChange={(e) => setLogTime(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="sectionHeader">NUTRITION</div>
        <div className="section">
          <NutrientField label={`Energy (${energyLabel(eu)})`} value={energy} onChange={setEnergy} />
          <NutrientField label="Protein (g)" value={protein} onChange={setProtein} />
          <NutrientField label="Fat (g)" value={fat} onChange={setFat} />
          <NutrientField label="Carbs (g)" value={carbs} onChange={setCarbs} />
          <NutrientField label="Fiber (g)" value={fiber} onChange={setFiber} />
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
