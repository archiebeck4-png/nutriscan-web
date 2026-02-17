'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addFoodLogEntry } from '../../../lib/db';
import { todayDateString } from '../../../lib/dates';
import { useProfile } from '../../../context/ProfileContext';
import { energyLabel, displayToKj } from '../../../lib/units';
import type { FoodLogEntry } from '../../../models/types';
import NutrientField from '../../../components/NutrientField';
import styles from './page.module.css';

export default function ManualEntryPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const eu = profile?.energyUnit ?? 'kj';
  const [foodName, setFoodName] = useState('');
  const [energy, setEnergy] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fiber, setFiber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Convert energy from user's display unit to kJ for storage
      const rawEnergy = parseFloat(energy) || 0;
      const energyKj = displayToKj(rawEnergy, eu);

      const entry: FoodLogEntry = {
        id: crypto.randomUUID(),
        date: todayDateString(),
        createdAt: new Date().toISOString(),
        foodName: foodName.trim() || 'Unknown Food',
        energyKj,
        proteinG: parseFloat(protein) || 0,
        fatG: parseFloat(fat) || 0,
        carbsG: parseFloat(carbs) || 0,
        fiberG: parseFloat(fiber) || 0,
        savedFoodId: null,
        source: 'manual',
      };
      await addFoodLogEntry(entry);
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
        <h1 className={styles.title}>Manual Entry</h1>
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
            <label className={styles.fieldLabel}>Food Name</label>
            <input
              className={styles.textInput}
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="e.g. Chicken breast"
            />
          </div>
        </div>

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
