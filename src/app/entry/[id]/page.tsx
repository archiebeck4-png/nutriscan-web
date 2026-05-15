'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getEntryById, deleteEntry } from '../../../lib/db';
import { useProfile } from '../../../context/ProfileContext';
import { kjToDisplay, energyLabel } from '../../../lib/units';
import { WebFoodEntry } from '../../../models/types';
import NutrientRow from '../../../components/NutrientRow';
import styles from './page.module.css';

export default function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useProfile();
  const eu = profile?.energyUnit ?? 'kj';
  const [entry, setEntry] = useState<WebFoodEntry | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await getEntryById(id);
        setEntry(data ?? null);
      } catch (error) {
        console.error('Failed to load entry:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Create object URL for image display
  useEffect(() => {
    if (entry?.imageBlob) {
      const url = URL.createObjectURL(entry.imageBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [entry]);

  const handleDelete = async () => {
    if (!entry) return;
    if (confirm(`Delete "${entry.foodName}"?`)) {
      await deleteEntry(entry.id);
      router.push('/log');
    }
  };

  if (loading) {
    return <div className={styles.centered}>Loading...</div>;
  }

  if (!entry) {
    return <div className={styles.centered}>Entry not found.</div>;
  }

  const dateStr = new Date(entry.dateScanned).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push('/log')}>
          ‹ Back
        </button>
        <h1 className={styles.title}>{entry.foodName}</h1>
        <button className={styles.deleteButton} onClick={handleDelete}>
          Delete
        </button>
      </div>

      {/* Food Details */}
      <div className="sectionHeader">FOOD DETAILS</div>
      <div className="section">
        <DetailRow label="Name" value={entry.foodName} />
        <DetailRow label="Date Scanned" value={dateStr} />
        {entry.servingSize && <DetailRow label="Serving Size" value={entry.servingSize} />}
        {entry.servingsPerPackage && <DetailRow label="Servings/Pkg" value={entry.servingsPerPackage} />}
      </div>

      {/* Per Serving */}
      <div className="sectionHeader">PER SERVING</div>
      <div className="section">
        <NutrientRow label="Energy" value={entry.energyPerServing != null ? Math.round(kjToDisplay(entry.energyPerServing, eu) * 10) / 10 : null} unit={energyLabel(eu)} />
        {profile?.trackProtein && <NutrientRow label="Protein" value={entry.proteinPerServing} unit="g" />}
        {profile?.trackFat && <NutrientRow label="Fat" value={entry.fatPerServing} unit="g" />}
        {profile?.trackSaturatedFat && <NutrientRow label="Saturated Fat" value={entry.saturatedFatPerServing ?? null} unit="g" />}
        {profile?.trackCarbs && <NutrientRow label="Carbs" value={entry.carbsPerServing} unit="g" />}
        {profile?.trackFiber && <NutrientRow label="Fiber" value={entry.fiberPerServing ?? null} unit="g" />}
      </div>

      {/* Per 100g */}
      <div className="sectionHeader">PER 100g</div>
      <div className="section">
        <NutrientRow label="Energy" value={entry.energyPer100g != null ? Math.round(kjToDisplay(entry.energyPer100g, eu) * 10) / 10 : null} unit={energyLabel(eu)} />
        {profile?.trackProtein && <NutrientRow label="Protein" value={entry.proteinPer100g} unit="g" />}
        {profile?.trackFat && <NutrientRow label="Fat" value={entry.fatPer100g} unit="g" />}
        {profile?.trackSaturatedFat && <NutrientRow label="Saturated Fat" value={entry.saturatedFatPer100g ?? null} unit="g" />}
        {profile?.trackCarbs && <NutrientRow label="Carbs" value={entry.carbsPer100g} unit="g" />}
        {profile?.trackFiber && <NutrientRow label="Fiber" value={entry.fiberPer100g ?? null} unit="g" />}
      </div>

      {/* Scanned Image */}
      {imageUrl && (
        <>
          <div className="sectionHeader">SCANNED IMAGE</div>
          <div className="section">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Scanned nutrition label" className={styles.image} />
          </div>
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  );
}
