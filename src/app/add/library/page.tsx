'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addFoodLogEntry, deleteEntry } from '../../../lib/db';
import { todayDateString, currentTimeString } from '../../../lib/dates';
import { useProfile } from '../../../context/ProfileContext';
import { kjToDisplay, energyLabel } from '../../../lib/units';
import { derivePer100gFromServing } from '../../../lib/nutritionUtils';
import type { WebFoodEntry, FoodLogEntry } from '../../../models/types';
import EmptyState from '../../../components/EmptyState';
import styles from './page.module.css';

export default function LibraryPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const eu = profile?.energyUnit ?? 'kj';
  const [search, setSearch] = useState('');
  const [servings, setServings] = useState<Record<string, string>>({});
  const [quantityModes, setQuantityModes] = useState<Record<string, 'servings' | 'grams'>>({});
  const [grams, setGrams] = useState<Record<string, string>>({});

  const allEntries = useLiveQuery(
    () => db.entries.orderBy('dateScanned').reverse().toArray()
  );

  const filtered = allEntries?.filter((e) =>
    e.foodName.toLowerCase().includes(search.toLowerCase())
  );

  const handleLog = async (entry: WebFoodEntry) => {
    const mode = quantityModes[entry.id] || 'servings';
    let energyKj: number, proteinG: number, fatG: number, carbsG: number, fiberG: number;

    if (mode === 'grams') {
      const g = parseFloat(grams[entry.id] || '0') || 0;
      const factor = g / 100;
      // Use per100g if available, otherwise derive from perServing + servingSize
      const e100 = entry.energyPer100g ?? derivePer100gFromServing(entry.energyPerServing, entry.servingSize);
      const p100 = entry.proteinPer100g ?? derivePer100gFromServing(entry.proteinPerServing, entry.servingSize);
      const f100 = entry.fatPer100g ?? derivePer100gFromServing(entry.fatPerServing, entry.servingSize);
      const c100 = entry.carbsPer100g ?? derivePer100gFromServing(entry.carbsPerServing, entry.servingSize);
      const fi100 = entry.fiberPer100g ?? derivePer100gFromServing(entry.fiberPerServing, entry.servingSize);
      energyKj = (e100 ?? 0) * factor;
      proteinG = (p100 ?? 0) * factor;
      fatG = (f100 ?? 0) * factor;
      carbsG = (c100 ?? 0) * factor;
      fiberG = (fi100 ?? 0) * factor;
    } else {
      const qty = parseFloat(servings[entry.id] || '1') || 1;
      energyKj = (entry.energyPerServing ?? 0) * qty;
      proteinG = (entry.proteinPerServing ?? 0) * qty;
      fatG = (entry.fatPerServing ?? 0) * qty;
      carbsG = (entry.carbsPerServing ?? 0) * qty;
      fiberG = (entry.fiberPerServing ?? 0) * qty;
    }

    const logEntry: FoodLogEntry = {
      id: crypto.randomUUID(),
      date: todayDateString(),
      createdAt: new Date().toISOString(),
      loggedAt: currentTimeString(),
      foodName: entry.foodName,
      energyKj,
      proteinG,
      fatG,
      carbsG,
      fiberG,
      savedFoodId: entry.id,
      source: 'library',
    };
    await addFoodLogEntry(logEntry);
    router.push('/');
  };

  const handleDelete = async (entry: WebFoodEntry) => {
    if (confirm(`Delete "${entry.foodName}"?`)) {
      await deleteEntry(entry.id);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push('/add')}>
          ← Back
        </button>
        <h1 className={styles.title}>Saved Foods</h1>
        <div style={{ width: 60 }} />
      </div>

      {/* Search bar */}
      <div className={styles.searchWrap}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search foods..."
        />
      </div>

      {/* List */}
      <div className={styles.list}>
        {filtered === undefined ? (
          <div className={styles.loading}>Loading...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No saved foods"
            message={
              search
                ? 'No foods match your search'
                : 'Scan some labels first to build your library'
            }
          />
        ) : (
          filtered.map((entry) => {
            const mode = quantityModes[entry.id] || 'servings';
            return (
              <div key={entry.id} className={styles.item}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(entry)}
                  aria-label={`Delete ${entry.foodName}`}
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{entry.foodName}</span>
                  <span className={styles.itemMeta}>
                    {entry.energyPerServing != null ? Math.round(kjToDisplay(entry.energyPerServing, eu)) : '--'} {energyLabel(eu)}/serve
                    {entry.servingSize ? ` (${entry.servingSize})` : ''}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.modeToggle}>
                    <button
                      className={`${styles.modeBtn} ${mode === 'servings' ? styles.modeBtnActive : ''}`}
                      onClick={() => setQuantityModes((prev) => ({ ...prev, [entry.id]: 'servings' }))}
                      type="button"
                    >
                      Srv
                    </button>
                    <button
                      className={`${styles.modeBtn} ${mode === 'grams' ? styles.modeBtnActive : ''}`}
                      onClick={() => setQuantityModes((prev) => ({ ...prev, [entry.id]: 'grams' }))}
                      type="button"
                    >
                      g
                    </button>
                  </div>
                  <input
                    className={styles.qtyInput}
                    value={mode === 'grams' ? (grams[entry.id] || '') : (servings[entry.id] || '')}
                    onChange={(e) => {
                      if (mode === 'grams') {
                        setGrams((prev) => ({ ...prev, [entry.id]: e.target.value }));
                      } else {
                        setServings((prev) => ({ ...prev, [entry.id]: e.target.value }));
                      }
                    }}
                    placeholder={mode === 'grams' ? 'g' : '1'}
                    inputMode="decimal"
                  />
                  <button
                    className={styles.logBtn}
                    onClick={() => handleLog(entry)}
                  >
                    Log
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
