'use client';

import { useRouter } from 'next/navigation';
import { useScanData } from '../../../context/ScanContext';
import styles from './page.module.css';

export default function UnknownBarcodePage() {
  const router = useRouter();
  const { scanData, setScanData } = useScanData();
  const barcode = scanData?.barcode;

  if (!barcode) {
    router.replace('/add/scan');
    return null;
  }

  const handleBack = () => {
    setScanData(null);
    router.push('/add/scan');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          ← Back
        </button>
        <h1 className={styles.title}>Product Not Found</h1>
        <div style={{ width: 60 }} />
      </div>

      <div className={styles.content}>
        <div className={styles.barcodeDisplay}>
          <span className={styles.barcodeLabel}>Barcode</span>
          <span className={styles.barcodeValue}>{barcode}</span>
        </div>

        <p className={styles.hint}>
          This barcode isn&apos;t in our database yet. Add the nutrition info so
          it&apos;s saved for next time.
        </p>

        <div className={styles.cardGroup}>
          <button
            className={styles.card}
            onClick={() => router.push('/add/scan')}
          >
            <span className={styles.cardIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <div className={styles.cardText}>
              <span className={styles.cardLabel}>Scan the Label</span>
              <span className={styles.cardDesc}>
                Take a photo of the nutrition label
              </span>
            </div>
            <span className={styles.chevron}>›</span>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/add/manual')}
          >
            <span className={styles.cardIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </span>
            <div className={styles.cardText}>
              <span className={styles.cardLabel}>Enter Manually</span>
              <span className={styles.cardDesc}>
                Type the nutrition values yourself
              </span>
            </div>
            <span className={styles.chevron}>›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
