'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteEntry } from '../../lib/db';
import EntryCard from '../../components/EntryCard';
import EmptyState from '../../components/EmptyState';
import styles from './page.module.css';

export default function HistoryPage() {
  const entries = useLiveQuery(
    () => db.entries.orderBy('dateScanned').reverse().toArray()
  );

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete "${name}"?`)) {
      await deleteEntry(id);
    }
  };

  if (entries === undefined) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>History</h1>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>History</h1>

      {entries.length === 0 ? (
        <EmptyState
          title="No Entries Yet"
          message="Scan a nutrition label to get started."
        />
      ) : (
        <div className={styles.list}>
          {entries.map((entry) => (
            <div key={entry.id} className={styles.entryRow}>
              <EntryCard entry={entry} />
              <button
                className={styles.deleteButton}
                onClick={() => handleDelete(entry.id, entry.foodName)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
