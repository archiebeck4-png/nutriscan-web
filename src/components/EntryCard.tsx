'use client';

import Link from 'next/link';
import { WebFoodEntry } from '../models/types';
import styles from './EntryCard.module.css';

interface EntryCardProps {
  entry: WebFoodEntry;
}

export default function EntryCard({ entry }: EntryCardProps) {
  const dateStr = new Date(entry.dateScanned).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const energyStr =
    entry.energyPer100g != null
      ? `${entry.energyPer100g.toFixed(0)} kJ per 100g`
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
