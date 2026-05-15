'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addFoodLogEntry } from '../../../lib/db';
import { todayDateString, currentTimeString } from '../../../lib/dates';
import { useProfile } from '../../../context/ProfileContext';
import { energyLabel, displayToKj } from '../../../lib/units';
import type { FoodLogEntry } from '../../../models/types';
import NutrientField from '../../../components/NutrientField';
import styles from './page.module.css';

export default function QuickAddPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const eu = profile?.energyUnit ?? 'kj';

  const [foodName, setFoodName] = useState('');
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [saturatedFat, setSaturatedFat] = useState('');
  const [logTime, setLogTime] = useState(currentTimeString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const rawEnergy = parseFloat(energy) || 0;
      const energyKj = displayToKj(rawEnergy, eu);

      const logEntry: FoodLogEntry = {
        id: crypto.randomUUID(),
        date: todayDateString(),
        createdAt: new Date().toISOString(),
        loggedAt: logTime,
        foodName: foodName.trim() || 'Quick Add',
        energyKj,
        proteinG: parseFloat(protein) || 0,
        fatG: parseFloat(fat) || 0,
        carbsG: parseFloat(carbs) || 0,
        fiberG: parseFloat(fiber) || 0,
        saturatedFatG: parseFloat(saturatedFat) || 0,
        savedFoodId: null,
        source: 'quick',
      };
      await addFoodLogEntry(logEntry);
      router.push('/');
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.cancelButton} onClick={() => router.push('/add')}>
          Cancel
        </button>
        <h1 className={styles.title}>Quick Add</h1>
        <button
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Log'}
        </button>
      </div>

      <div className={styles.form}>
        <div className="sectionHeader">FOOD</div>
        <div className="section">
          <div className={styles.textFieldRow}>
            <label className={styles.fieldLabel}>Description</label>
            <input
              className={styles.textInput}
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g. Afternoon snack"
            />
          </div>
        </div>

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

        <div className="sectionHeader">NUTRITION</div>
        <div className="section">
          <NutrientField label={`Energy (${energyLabel(eu)})`} value={energy} onChange={setEnergy} />
          {profile?.trackProtein && (
            <NutrientField label="Protein (g)" value={protein} onChange={setProtein} />
          )}
          {profile?.trackFat && (
            <NutrientField label="Fat (g)" value={fat} onChange={setFat} />
          )}
          {profile?.trackSaturatedFat && (
            <NutrientField label="Saturated Fat (g)" value={saturatedFat} onChange={setSaturatedFat} />
          )}
          {profile?.trackCarbs && (
            <NutrientField label="Carbs (g)" value={carbs} onChange={setCarbs} />
          )}
          {profile?.trackFiber && (
            <NutrientField label="Fiber (g)" value={fiber} onChange={setFiber} />
          )}
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
