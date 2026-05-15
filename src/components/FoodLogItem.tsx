'use client';

import type { FoodLogEntry, EnergyUnit } from '../models/types';
import { kjToDisplay, energyLabel } from '../lib/units';
import { formatTimeDisplay } from '../lib/dates';
import { useProfile } from '../context/ProfileContext';
import styles from './FoodLogItem.module.css';

interface FoodLogItemProps {
  entry: FoodLogEntry;
  onDelete: (id: string) => void;
  energyUnit?: EnergyUnit;
}

export default function FoodLogItem({ entry, onDelete, energyUnit = 'kj' }: FoodLogItemProps) {
  const { profile } = useProfile();
  const parts: string[] = [
    `${Math.round(kjToDisplay(entry.energyKj, energyUnit))} ${energyLabel(energyUnit)}`,
  ];
  if (profile?.trackProtein) parts.push(`P ${Math.round(entry.proteinG)}g`);
  if (profile?.trackFat) parts.push(`F ${Math.round(entry.fatG)}g`);
  if (profile?.trackSaturatedFat) parts.push(`Sat ${Math.round(entry.saturatedFatG ?? 0)}g`);
  if (profile?.trackCarbs) parts.push(`C ${Math.round(entry.carbsG)}g`);
  if (profile?.trackFiber) parts.push(`Fib ${Math.round(entry.fiberG)}g`);

  return (
    <div className={styles.item}>
      {entry.loggedAt && (
        <span className={styles.time}>{formatTimeDisplay(entry.loggedAt)}</span>
      )}
      <div className={styles.info}>
        <span className={styles.name}>{entry.foodName}</span>
        <span className={styles.macros}>{parts.join(' · ')}</span>
      </div>
      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(entry.id)}
        aria-label="Delete"
      >
        ✕
      </button>
    </div>
  );
}
