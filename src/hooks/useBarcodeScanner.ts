'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseBarcodeOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onBarcodeDetected: (barcode: string) => void;
  intervalMs?: number;
}

export function useBarcodeScanner({
  videoRef,
  enabled,
  onBarcodeDetected,
  intervalMs = 400,
}: UseBarcodeOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const abortRef = useRef(false);
  const isRunningRef = useRef(false);
  const onDetectedRef = useRef(onBarcodeDetected);
  onDetectedRef.current = onBarcodeDetected;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detectorRef = useRef<any>(null);

  const initDetector = useCallback(async () => {
    if (detectorRef.current) return detectorRef.current;

    try {
      if ('BarcodeDetector' in window) {
        // Use native BarcodeDetector API (Chrome Android)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
        });
      } else {
        // Polyfill fallback
        const { BarcodeDetector } = await import('barcode-detector/pure');
        detectorRef.current = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
        });
      }
    } catch (err) {
      console.warn('BarcodeDetector not available:', err);
      return null;
    }

    return detectorRef.current;
  }, []);

  const scanLoop = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    abortRef.current = false;

    const detector = await initDetector();
    if (!detector) {
      isRunningRef.current = false;
      return;
    }

    while (!abortRef.current) {
      const start = performance.now();
      try {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          // Video not ready yet, wait and retry
          await new Promise((r) => setTimeout(r, intervalMs));
          continue;
        }

        const barcodes = await detector.detect(videoRef.current);

        if (barcodes.length > 0 && !abortRef.current) {
          const barcode = barcodes[0].rawValue;
          if (barcode) {
            onDetectedRef.current(barcode);
            break; // Stop scanning after detection
          }
        }
      } catch {
        // Silently continue — frame capture errors are normal
      }

      const elapsed = performance.now() - start;
      const wait = Math.max(0, intervalMs - elapsed);
      if (wait > 0 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    isRunningRef.current = false;
  }, [videoRef, intervalMs, initDetector]);

  useEffect(() => {
    if (enabled) {
      setIsScanning(true);
      scanLoop();
    } else {
      abortRef.current = true;
      setIsScanning(false);
    }
    return () => {
      abortRef.current = true;
    };
  }, [enabled, scanLoop]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsScanning(false);
  }, []);

  return { isScanning, stop };
}
