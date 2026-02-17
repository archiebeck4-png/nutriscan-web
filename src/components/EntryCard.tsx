'use client';

import Link from 'next/link';
import type { WebFoodEntry, EnergyUnit } from '../models/types';
import { kjToDisplay, energyLabel } from '../lib/units';
import styles from './EntryCard.module.css';

interface EntryCardProps {
  entry: WebFoodEntry;
  energyUnit?: EnergyUnit;
}

export default function EntryCard({ entry, energyUnit = 'kj' }: EntryCardProps) {
  const dateStr = new Date(entry.dateScanned).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const energyStr =
    entry.energyPer100g != null
      ? `${Math.round(kjToDisplay(entry.energyPer100g, energyUnit))} ${energyLabel(energyUnit)} per 100g`
      : entry.energyPerServing != null
        ? `${Math.round(kjToDisplay(entry.energyPerServing, energyUnit))} ${energyLabel(energyUnit)}/serve`
        : null;

  return (
    <Link href={`/entry/${entry.id}`} className={styles.card}>
      <div className={styles.content}>
        <span className={styles.name}>{entry.foodName}</span>
        <span className={styles.date}>{dateStr}</span>
        {energyStr && <span className={styles.energy}>{energyStr}</span>}
      </div>
      <span className={styles.chevron}>›</span>
    </Link>
  );
}
