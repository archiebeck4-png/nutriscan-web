'use client';

import type { FoodLogEntry, EnergyUnit } from '../models/types';
import { kjToDisplay, energyLabel } from '../lib/units';
import styles from './FoodLogItem.module.css';

interface FoodLogItemProps {
  entry: FoodLogEntry;
  onDelete: (id: string) => void;
  energyUnit?: EnergyUnit;
}

export default function FoodLogItem({ entry, onDelete, energyUnit = 'kj' }: FoodLogItemProps) {
  return (
    <div className={styles.item}>
      <div className={styles.info}>
        <span className={styles.name}>{entry.foodName}</span>
        <span className={styles.macros}>
          {Math.round(kjToDisplay(entry.energyKj, energyUnit))} {energyLabel(energyUnit)} &middot; P {Math.round(entry.proteinG)}g
          &middot; F {Math.round(entry.fatG)}g &middot; C{' '}
          {Math.round(entry.carbsG)}g
        </span>
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
