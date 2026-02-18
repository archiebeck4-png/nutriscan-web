'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteFoodLogEntry, deleteEntry } from '../../lib/db';
import { formatDateDisplay, formatTimeDisplay } from '../../lib/dates';
import { useProfile } from '../../context/ProfileContext';
import { kjToDisplay, energyLabel } from '../../lib/units';
import type { FoodLogEntry } from '../../models/types';
import EntryCard from '../../components/EntryCard';
import EmptyState from '../../components/EmptyState';
import styles from './page.module.css';

type Tab = 'diary' | 'saved';

export default function LogPage() {
  const { profile } = useProfile();
  const eu = profile?.energyUnit ?? 'kj';
  const [activeTab, setActiveTab] = useState<Tab>('diary');

  const foodLogEntries = useLiveQuery(() =>
    db.foodLog.orderBy('createdAt').reverse().toArray()
  );

  const savedEntries = useLiveQuery(() =>
    db.entries.orderBy('dateScanned').reverse().toArray()
  );

  // Group diary entries by date
  const grouped = foodLogEntries
    ? foodLogEntries.reduce<Record<string, FoodLogEntry[]>>((acc, entry) => {
        if (!acc[entry.date]) acc[entry.date] = [];
        acc[entry.date].push(entry);
        return acc;
      }, {})
    : {};

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const handleDeleteLog = async (id: string) => {
    if (confirm('Delete this log entry?')) {
      await deleteFoodLogEntry(id);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    if (confirm('Delete this saved food?')) {
      await deleteEntry(id);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Log</h1>

      {/* Segmented control */}
      <div className={styles.segmentedControl}>
        <button
          className={`${styles.segment} ${activeTab === 'diary' ? styles.segmentActive : ''}`}
          onClick={() => setActiveTab('diary')}
        >
          Diary
        </button>
        <button
          className={`${styles.segment} ${activeTab === 'saved' ? styles.segmentActive : ''}`}
          onClick={() => setActiveTab('saved')}
        >
          Saved Foods
        </button>
      </div>

      {/* Diary tab */}
      {activeTab === 'diary' && (
        <div>
          {foodLogEntries === undefined ? (
            <div className={styles.loading}>Loading...</div>
          ) : sortedDates.length === 0 ? (
            <EmptyState
              icon="📖"
              title="No diary entries"
              message="Your food log will appear here"
            />
          ) : (
            sortedDates.map((date) => (
              <div key={date} className={styles.dateGroup}>
                <div className="sectionHeader">
                  {formatDateDisplay(date).toUpperCase()}
                </div>
                <div className="section">
                  {[...grouped[date]]
                    .sort((a, b) => (a.loggedAt ?? a.createdAt).localeCompare(b.loggedAt ?? b.createdAt))
                    .map((entry) => (
                    <div key={entry.id} className={styles.logRow}>
                      <span className={styles.logTime}>
                        {entry.loggedAt ? formatTimeDisplay(entry.loggedAt) : ''}
                      </span>
                      <div className={styles.logInfo}>
                        <span className={styles.logName}>{entry.foodName}</span>
                        <span className={styles.logMeta}>
                          {Math.round(kjToDisplay(entry.energyKj, eu))} {energyLabel(eu)} &middot; P{' '}
                          {Math.round(entry.proteinG)}g &middot; F{' '}
                          {Math.round(entry.fatG)}g &middot; C{' '}
                          {Math.round(entry.carbsG)}g
                        </span>
                      </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteLog(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved foods tab */}
      {activeTab === 'saved' && (
        <div>
          {savedEntries === undefined ? (
            <div className={styles.loading}>Loading...</div>
          ) : savedEntries.length === 0 ? (
            <EmptyState
              icon="📚"
              title="No saved foods"
              message="Scan labels to build your library"
            />
          ) : (
            <div className="section">
              {savedEntries.map((entry) => (
                <div key={entry.id} className={styles.savedRow}>
                  <EntryCard entry={entry} energyUnit={eu} />
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteSaved(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
