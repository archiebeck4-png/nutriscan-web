'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, addFoodLogEntry } from '../../../lib/db';
import { todayDateString } from '../../../lib/dates';
import type { WebFoodEntry, FoodLogEntry } from '../../../models/types';
import EmptyState from '../../../components/EmptyState';
import styles from './page.module.css';

export default function LibraryPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [servings, setServings] = useState<Record<string, string>>({});

  const allEntries = useLiveQuery(
    () => db.entries.orderBy('dateScanned').reverse().toArray()
  );

  const filtered = allEntries?.filter((e) =>
    e.foodName.toLowerCase().includes(search.toLowerCase())
  );

  const handleLog = async (entry: WebFoodEntry) => {
    const qty = parseFloat(servings[entry.id] || '1') || 1;
    const logEntry: FoodLogEntry = {
      id: crypto.randomUUID(),
      date: todayDateString(),
      createdAt: new Date().toISOString(),
      foodName: entry.foodName,
      energyKj: (entry.energyPerServing ?? 0) * qty,
      proteinG: (entry.proteinPerServing ?? 0) * qty,
      fatG: (entry.fatPerServing ?? 0) * qty,
      carbsG: (entry.carbsPerServing ?? 0) * qty,
      fiberG: (entry.fiberPerServing ?? 0) * qty,
      savedFoodId: entry.id,
      source: 'library',
    };
    await addFoodLogEntry(logEntry);
    router.push('/');
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
          filtered.map((entry) => (
            <div key={entry.id} className={styles.item}>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{entry.foodName}</span>
                <span className={styles.itemMeta}>
                  {entry.energyPerServing ?? '--'} kJ/serve
                  {entry.servingSize ? ` (${entry.servingSize})` : ''}
                </span>
              </div>
              <div className={styles.itemActions}>
                <input
                  className={styles.qtyInput}
                  value={servings[entry.id] || ''}
                  onChange={(e) =>
                    setServings((prev) => ({
                      ...prev,
                      [entry.id]: e.target.value,
                    }))
                  }
                  placeholder="1"
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
          ))
        )}
      </div>
    </div>
  );
}
