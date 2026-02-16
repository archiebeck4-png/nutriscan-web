'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCamera } from '../../../hooks/useCamera';
import { useOcr } from '../../../hooks/useOcr';
import { useContinuousScan } from '../../../hooks/useContinuousScan';
import { parseNutritionLabel } from '../../../parsing/nutritionLabelParser';
import { useScanData } from '../../../context/ScanContext';
import { ScannedNutrition } from '../../../models/types';
import styles from './page.module.css';

function LiveValue({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className={styles.liveValue}>
      <span className={styles.liveValueLabel}>{label}</span>
      <span className={styles.liveValueNumber}>
        {value ? `${value}${unit}` : '--'}
      </span>
    </div>
  );
}

export default function ScanPage() {
  const router = useRouter();
  const { videoRef, permissionState, isReady, capture, initCamera } =
    useCamera();
  const { recognize, isProcessing, isReady: ocrReady, progress } = useOcr();
  const { setScanData } = useScanData();
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    initCamera();
  }, [initCamera]);

  // Callback when continuous scan finds a valid result
  const handleValidResult = useCallback(
    (nutrition: ScannedNutrition, imageBlob: Blob) => {
      setNavigating(true);
      setScanData({ nutrition, imageBlob });
      router.push('/add/review');
    },
    [setScanData, router],
  );

  // Continuous scan hook
  const continuousScanEnabled =
    isReady && ocrReady && !isProcessing && !navigating;
  const { isScanning, currentResult, currentScore, stop: stopContinuousScan } =
    useContinuousScan({
      videoRef,
      onValidResult: handleValidResult,
      enabled: continuousScanEnabled,
    });

  // Manual capture fallback — stops continuous scan, does full-quality single capture
  const handleCapture = async () => {
    if (isProcessing || navigating) return;
    stopContinuousScan();
    setError(null);

    try {
      const imageBlob = await capture();
      const ocrLines = await recognize(imageBlob);

      if (ocrLines.length === 0) {
        setError(
          'No text detected. Try holding the camera closer to the nutrition label.',
        );
        return;
      }

      const nutrition = parseNutritionLabel(ocrLines);
      setScanData({ nutrition, imageBlob });
      router.push('/add/review');
    } catch (err) {
      console.error('Scan error:', err);
      setError('Failed to scan. Please try again.');
    }
  };

  // Permission denied
  if (permissionState === 'denied') {
    return (
      <div className={styles.centered}>
        <h2 className={styles.permissionTitle}>Camera Access Required</h2>
        <p className={styles.permissionMessage}>
          ScaleShift needs camera access to scan nutrition labels. Please enable
          camera access in your browser settings.
        </p>
        <button className={styles.backBtn} onClick={() => router.back()}>
          Go Back
        </button>
      </div>
    );
  }

  // Permission prompt
  if (permissionState === 'prompt' || permissionState === 'loading') {
    return (
      <div className={styles.centered}>
        <h2 className={styles.permissionTitle}>Camera Access</h2>
        <p className={styles.permissionMessage}>
          ScaleShift needs camera access to scan nutrition labels.
        </p>
        <button className={styles.permissionButton} onClick={initCamera}>
          Enable Camera
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Back button */}
      <button className={styles.backOverlay} onClick={() => router.back()}>
        ← Back
      </button>

      {/* Camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={styles.video}
      />

      {/* Guide overlay */}
      <div className={styles.overlay}>
        <div
          className={`${styles.guideBox} ${isScanning ? styles.guideBoxScanning : ''}`}
        >
          <span className={styles.guideText}>
            {isScanning
              ? 'Scanning... hold steady'
              : 'Position the nutrition label within the frame'}
          </span>
        </div>
      </div>

      {/* Live detected values panel */}
      {isScanning &&
        currentResult &&
        currentScore &&
        currentScore.fieldsFound.length > 0 && (
          <div className={styles.liveResultsPanel}>
            <div className={styles.liveResultsHeader}>
              <span className={styles.scanningDot} />
              Detected ({currentScore.fieldsFound.length}/6)
            </div>
            <div className={styles.liveResultsGrid}>
              <LiveValue
                label="Energy"
                value={
                  currentResult.energyPerServing || currentResult.energyPer100g
                }
                unit="kJ"
              />
              <LiveValue
                label="Protein"
                value={
                  currentResult.proteinPerServing ||
                  currentResult.proteinPer100g
                }
                unit="g"
              />
              <LiveValue
                label="Fat"
                value={
                  currentResult.fatPerServing || currentResult.fatPer100g
                }
                unit="g"
              />
              <LiveValue
                label="Carbs"
                value={
                  currentResult.carbsPerServing || currentResult.carbsPer100g
                }
                unit="g"
              />
            </div>
            {/* Score bar */}
            <div className={styles.scoreBarContainer}>
              <div
                className={styles.scoreBar}
                style={{
                  width: `${Math.round(currentScore.score * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

      {/* Navigating overlay */}
      {navigating && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingBadge}>
            Label detected! Opening review...
          </div>
        </div>
      )}

      {/* OCR loading progress */}
      {!ocrReady && progress && (
        <div className={styles.progressOverlay}>
          <div className={styles.progressBadge}>
            Loading OCR engine... {progress}
          </div>
        </div>
      )}

      {/* Manual processing overlay */}
      {isProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingBadge}>
            {progress || 'Scanning label...'}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorBadge}>
            {error}
            <button
              className={styles.errorDismiss}
              onClick={() => setError(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Capture button */}
      <div className={styles.buttonContainer}>
        <button
          className={styles.captureButton}
          onClick={handleCapture}
          disabled={isProcessing || !isReady || navigating}
        >
          <div
            className={`${styles.captureButtonInner} ${
              isProcessing || !isReady || navigating ? styles.disabled : ''
            }`}
          />
        </button>
        <span className={styles.captureHint}>
          {isScanning
            ? 'Auto-scanning... tap to capture manually'
            : 'Tap to scan'}
        </span>
      </div>
    </div>
  );
}
