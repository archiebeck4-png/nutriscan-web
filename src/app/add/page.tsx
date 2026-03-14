'use client';

import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AddFoodPage() {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Add Food</h1>

      <div className={styles.cardGroup}>
        <button
          className={styles.card}
          onClick={() => router.push('/add/scan')}
        >
          <span className={styles.cardIcon}>📷</span>
          <div className={styles.cardText}>
            <span className={styles.cardLabel}>Scan a Label</span>
            <span className={styles.cardDesc}>
              Use your camera to scan a nutrition label
            </span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>

        <button
          className={styles.card}
          onClick={() => router.push('/add/quick')}
        >
          <span className={styles.cardIcon}>⚡</span>
          <div className={styles.cardText}>
            <span className={styles.cardLabel}>Quick Add</span>
            <span className={styles.cardDesc}>
              Log macros without saving to library
            </span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>

        <button
          className={styles.card}
          onClick={() => router.push('/add/manual')}
        >
          <span className={styles.cardIcon}>✏️</span>
          <div className={styles.cardText}>
            <span className={styles.cardLabel}>Manual Entry</span>
            <span className={styles.cardDesc}>
              Type in the food name and macros
            </span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>

        <button
          className={styles.card}
          onClick={() => router.push('/add/library')}
        >
          <span className={styles.cardIcon}>📚</span>
          <div className={styles.cardText}>
            <span className={styles.cardLabel}>From Library</span>
            <span className={styles.cardDesc}>
              Pick from previously scanned foods
            </span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>

        <button
          className={styles.card}
          onClick={() => router.push('/add/recipe')}
        >
          <span className={styles.cardIcon}>🍳</span>
          <div className={styles.cardText}>
            <span className={styles.cardLabel}>Create Recipe</span>
            <span className={styles.cardDesc}>
              Combine saved foods into a recipe
            </span>
          </div>
          <span className={styles.chevron}>›</span>
        </button>
      </div>
    </div>
  );
}
