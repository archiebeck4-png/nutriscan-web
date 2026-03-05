'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteFoodLogEntry } from '../lib/db';
import { todayDateString, formatDateDisplay, addDays, isToday } from '../lib/dates';
import { useProfile } from '../context/ProfileContext';
import { kjToDisplay, energyLabel } from '../lib/units';
import EnergyRing from '../components/EnergyRing';
import MacroProgressBar from '../components/MacroProgressBar';
import FoodLogItem from '../components/FoodLogItem';
import EmptyState from '../components/EmptyState';
import styles from './page.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const [selectedDate, setSelectedDate] = useState(todayDateString());

  const entries = useLiveQuery(
    () => db.foodLog.where('date').equals(selectedDate).sortBy('createdAt'),
    [selectedDate]
  );

  const totals = useMemo(() => {
    if (!entries)
      return { energyKj: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 };
    return entries.reduce(
      (acc, e) => ({
        energyKj: acc.energyKj + e.energyKj,
        proteinG: acc.proteinG + e.proteinG,
        fatG: acc.fatG + e.fatG,
        carbsG: acc.carbsG + e.carbsG,
        fiberG: acc.fiberG + e.fiberG,
      }),
      { energyKj: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0 }
    );
  }, [entries]);

  const handleDelete = async (id: string) => {
    if (confirm('Delete this food entry?')) {
      await deleteFoodLogEntry(id);
    }
  };

  if (!profile) return null;

  const eu = profile.energyUnit ?? 'kj';

  return (
    <div className={styles.container}>
      <h1 className={styles.appTitle}>ScaleShift</h1>

      {/* Date navigation */}
      <div className={styles.dateNav}>
        <button
          className={styles.dateArrow}
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        >
          ‹
        </button>
        <div className={styles.dateCenter}>
          <span className={styles.dateText}>
            {formatDateDisplay(selectedDate)}
          </span>
          {isToday(selectedDate) && (
            <span className={styles.todayBadge}>Today</span>
          )}
        </div>
        <button
          className={styles.dateArrow}
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          disabled={isToday(selectedDate)}
        >
          ›
        </button>
      </div>

      {/* Energy ring */}
      <div className={styles.ringSection}>
        <EnergyRing
          current={Math.round(kjToDisplay(totals.energyKj, eu))}
          target={Math.round(kjToDisplay(profile.dailyEnergyTargetKj, eu))}
          unit={energyLabel(eu)}
        />
      </div>

      {/* Macro bars */}
      <div className={styles.macroSection}>
        <MacroProgressBar
          label="Protein"
          current={totals.proteinG}
          target={profile.dailyProteinTargetG}
          unit="g"
          color="#34C759"
        />
        <MacroProgressBar
          label="Fat"
          current={totals.fatG}
          target={profile.dailyFatTargetG}
          unit="g"
          color="#FF9500"
        />
        <MacroProgressBar
          label="Carbs"
          current={totals.carbsG}
          target={profile.dailyCarbsTargetG}
          unit="g"
          color="#5856D6"
        />
        <MacroProgressBar
          label="Fiber"
          current={totals.fiberG}
          target={profile.dailyFiberTargetG}
          unit="g"
          color="#AF52DE"
        />
      </div>

      {/* Food log */}
      <div className={styles.logSection}>
        <div className="sectionHeader">FOOD LOG</div>
        <div className="section">
          {entries === undefined ? (
            <div className={styles.loading}>Loading...</div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon="🍽️"
              title="No food logged"
              message="Tap + to add your first meal"
            />
          ) : (
            [...entries]
              .sort((a, b) => (a.loggedAt ?? a.createdAt).localeCompare(b.loggedAt ?? b.createdAt))
              .map((entry) => (
                <FoodLogItem
                  key={entry.id}
                  entry={entry}
                  onDelete={handleDelete}
                  energyUnit={eu}
                />
              ))
          )}
        </div>
      </div>

      {/* Add food button */}
      <button
        className={styles.addButton}
        onClick={() => router.push('/add')}
      >
        + Add Food
      </button>
    </div>
  );
}
