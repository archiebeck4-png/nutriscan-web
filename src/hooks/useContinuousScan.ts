'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ScannedNutrition } from '../models/types';
import { captureFrame } from '../lib/camera';
import { recognizeImage } from '../lib/ocr';
import { parseNutritionLabel } from '../parsing/nutritionLabelParser';
import { scoreScanResult, ScanScore } from '../lib/scanValidation';

export interface ContinuousScanState {
  isScanning: boolean;
  currentResult: ScannedNutrition | null;
  currentScore: ScanScore | null;
  scanCount: number;
}

interface UseContinuousScanOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onValidResult: (nutrition: ScannedNutrition, imageBlob: Blob) => void;
  enabled: boolean;
  intervalMs?: number;
}

export function useContinuousScan({
  videoRef,
  onValidResult,
  enabled,
  intervalMs = 500,
}: UseContinuousScanOptions) {
  const [state, setState] = useState<ContinuousScanState>({
    isScanning: false,
    currentResult: null,
    currentScore: null,
    scanCount: 0,
  });

  const isRunningRef = useRef(false);
  const abortRef = useRef(false);
  // Store callback in a ref so the loop always calls the latest version
  const onValidResultRef = useRef(onValidResult);
  onValidResultRef.current = onValidResult;

  const scanLoop = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    abortRef.current = false;

    while (!abortRef.current) {
      const loopStart = performance.now();

      try {
        if (!videoRef.current) break;

        // 1. Capture frame at lower quality for speed
        const imageBlob = await captureFrame(videoRef.current, 0.8);
        if (abortRef.current) break;

        // 2. OCR with fast preprocessing (800px, no morphOpen)
        const ocrLines = await recognizeImage(imageBlob, true);
        if (abortRef.current) break;

        if (ocrLines.length === 0) {
          // No text detected, update state and continue
          setState((prev) => ({
            isScanning: true,
            currentResult: null,
            currentScore: null,
            scanCount: prev.scanCount + 1,
          }));
        } else {
          // 3. Parse
          const nutrition = parseNutritionLabel(ocrLines);

          // 4. Score
          const scanScore = scoreScanResult(nutrition);

          // 5. Update state for live UI feedback
          setState((prev) => ({
            isScanning: true,
            currentResult: nutrition,
            currentScore: scanScore,
            scanCount: prev.scanCount + 1,
          }));

          // 6. If valid, do a full-quality re-capture and navigate
          if (scanScore.isValid) {
            try {
              // Re-capture at full quality
              const finalBlob = await captureFrame(videoRef.current!, 0.95);
              const finalLines = await recognizeImage(finalBlob, false);
              const finalNutrition = parseNutritionLabel(finalLines);
              const finalScore = scoreScanResult(finalNutrition);

              if (finalScore.isValid) {
                onValidResultRef.current(finalNutrition, finalBlob);
              } else {
                // Full-quality scan didn't validate — use the fast result
                onValidResultRef.current(nutrition, imageBlob);
              }
            } catch {
              // Full-quality re-scan failed — use the fast result
              onValidResultRef.current(nutrition, imageBlob);
            }
            break;
          }
        }
      } catch (err) {
        console.warn('Continuous scan frame error:', err);
        // Don't break — try next frame
      }

      // 7. Wait for minimum interval before next scan
      const elapsed = performance.now() - loopStart;
      const waitTime = Math.max(0, intervalMs - elapsed);
      if (waitTime > 0 && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    isRunningRef.current = false;
  }, [videoRef, intervalMs]);

  // Start/stop the loop based on `enabled`
  useEffect(() => {
    if (enabled) {
      setState((prev) => ({
        ...prev,
        isScanning: true,
        scanCount: 0,
        currentResult: null,
        currentScore: null,
      }));
      scanLoop();
    } else {
      abortRef.current = true;
      setState((prev) => ({ ...prev, isScanning: false }));
    }

    return () => {
      abortRef.current = true;
    };
  }, [enabled, scanLoop]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setState((prev) => ({ ...prev, isScanning: false }));
  }, []);

  return { ...state, stop };
}
