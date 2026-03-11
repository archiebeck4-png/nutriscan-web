'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { ScannedNutrition } from '../models/types';

interface ScanData {
  nutrition: ScannedNutrition;
  imageBlob: Blob | null;
  barcode?: string; // present when user scanned label after barcode lookup failed
  fromRecipe?: boolean; // true when adding an ingredient to a recipe
}

interface ScanContextValue {
  scanData: ScanData | null;
  setScanData: (data: ScanData | null) => void;
}

const ScanContext = createContext<ScanContextValue>({
  scanData: null,
  setScanData: () => {},
});

export function ScanContextProvider({ children }: { children: ReactNode }) {
  const [scanData, setScanData] = useState<ScanData | null>(null);
  return (
    <ScanContext.Provider value={{ scanData, setScanData }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanData() {
  return useContext(ScanContext);
}
