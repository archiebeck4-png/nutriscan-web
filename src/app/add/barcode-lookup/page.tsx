'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useScanData } from '../../../context/ScanContext';
import { lookupBarcode } from '../../../lib/barcodeApi';
import styles from './page.module.css';

export default function BarcodeLookupPage() {
  const router = useRouter();
  const { scanData, setScanData } = useScanData();
  const barcode = scanData?.barcode;
  const barcodeRef = useRef(barcode);
  const lookupStarted = useRef(false);

  // Capture the barcode on first render so re-renders after setScanData don't lose it
  if (!barcodeRef.current && barcode) {
    barcodeRef.current = barcode;
  }

  useEffect(() => {
    const code = barcodeRef.current;
    if (!code || lookupStarted.current) return;
    lookupStarted.current = true;

    (async () => {
      try {
        const result = await lookupBarcode(code);
        if (result.found && result.nutrition) {
          setScanData({ nutrition: result.nutrition, imageBlob: null });
          router.replace('/add/review');
        } else {
          const emptyNutrition = {
            foodName: '', servingSize: '', servingsPerPackage: '',
            energyPerServing: '', proteinPerServing: '', fatPerServing: '',
            carbsPerServing: '', fiberPerServing: '',
            energyPer100g: '', proteinPer100g: '', fatPer100g: '',
            carbsPer100g: '', fiberPer100g: '', rawText: '',
          };
          setScanData({ nutrition: emptyNutrition, imageBlob: null, barcode: code });
          router.replace('/add/unknown-barcode');
        }
      } catch {
        const emptyNutrition = {
          foodName: '', servingSize: '', servingsPerPackage: '',
          energyPerServing: '', proteinPerServing: '', fatPerServing: '',
          carbsPerServing: '', fiberPerServing: '',
          energyPer100g: '', proteinPer100g: '', fatPer100g: '',
          carbsPer100g: '', fiberPer100g: '', rawText: '',
        };
        setScanData({ nutrition: emptyNutrition, imageBlob: null, barcode: code });
        router.replace('/add/unknown-barcode');
      }
    })();
  }, [setScanData, router]);

  if (!barcodeRef.current) {
    router.replace('/add/scan');
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.spinner} />
        <p className={styles.barcode}>{barcode}</p>
        <p className={styles.message}>Looking up barcode...</p>
      </div>
    </div>
  );
}
