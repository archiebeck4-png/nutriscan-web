'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCamera } from '../../../hooks/useCamera';
import { useOcr } from '../../../hooks/useOcr';
import { useContinuousScan } from '../../../hooks/useContinuousScan';
import { parseNutritionLabel } from '../../../parsing/nutritionLabelParser';
import { smartRecognize } from '../../../lib/smartRecognize';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [isSmartProcessing, setIsSmartProcessing] = useState(false);

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
  const anyProcessing = isProcessing || isSmartProcessing;
  const continuousScanEnabled =
    isReady && ocrReady && !anyProcessing && !navigating;
  const { isScanning, currentResult, currentScore, stop: stopContinuousScan } =
    useContinuousScan({
      videoRef,
      onValidResult: handleValidResult,
      enabled: continuousScanEnabled,
    });

  // Manual capture — stops continuous scan, does full-quality smart recognition
  const handleCapture = async () => {
    if (isProcessing || isSmartProcessing || navigating) return;
    stopContinuousScan();
    setError(null);
    setIsSmartProcessing(true);

    try {
      const imageBlob = await capture();
      const ocrLines = await smartRecognize(imageBlob);

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
    } finally {
      setIsSmartProcessing(false);
    }
  };

  // Upload a photo from gallery
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isProcessing || isSmartProcessing || navigating) return;
    stopContinuousScan();
    setError(null);
    setIsSmartProcessing(true);

    try {
      const imageBlob: Blob = file;
      const ocrLines = await smartRecognize(imageBlob);

      if (ocrLines.length === 0) {
        setError(
          'No text detected in the uploaded image. Try a clearer photo of the nutrition label.',
        );
        return;
      }

      const nutrition = parseNutritionLabel(ocrLines);
      setScanData({ nutrition, imageBlob });
      router.push('/add/review');
    } catch (err) {
      console.error('Upload scan error:', err);
      setError('Failed to process the image. Please try again.');
    } finally {
      setIsSmartProcessing(false);
    }

    // Reset so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
        <p className={styles.permissionMessage}>
          Or upload a photo of a nutrition label instead:
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        <button
          className={styles.permissionButton}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Photo
        </button>
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
      {anyProcessing && (
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

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />

      {/* Capture + Upload buttons */}
      <div className={styles.buttonContainer}>
        <div className={styles.buttonRow}>
          {/* Upload button */}
          <button
            className={styles.uploadButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={anyProcessing || navigating}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.5"/>
              <path d="M3 16l5-5 4 4 3-3 6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="15.5" cy="8.5" r="1.5" stroke="white" strokeWidth="1.5"/>
            </svg>
          </button>

          {/* Capture button */}
          <button
            className={styles.captureButton}
            onClick={handleCapture}
            disabled={anyProcessing || !isReady || navigating}
          >
            <div
              className={`${styles.captureButtonInner} ${
                anyProcessing || !isReady || navigating ? styles.disabled : ''
              }`}
            />
          </button>

          {/* Spacer for visual balance */}
          <div className={styles.uploadButtonSpacer} />
        </div>
        <span className={styles.captureHint}>
          {isScanning
            ? 'Auto-scanning... tap to capture manually'
            : 'Tap to scan'}
        </span>
      </div>
    </div>
  );
}
