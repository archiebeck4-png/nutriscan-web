'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCamera } from '../../../hooks/useCamera';
import { useOcr } from '../../../hooks/useOcr';
import { parseNutritionLabel } from '../../../parsing/nutritionLabelParser';
import { useScanData } from '../../../context/ScanContext';
import styles from './page.module.css';

export default function ScanPage() {
  const router = useRouter();
  const { videoRef, permissionState, isReady, capture, initCamera } =
    useCamera();
  const { recognize, isProcessing, isReady: ocrReady, progress } = useOcr();
  const { setScanData } = useScanData();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initCamera();
  }, [initCamera]);

  const handleCapture = async () => {
    if (isProcessing) return;
    setError(null);

    try {
      const imageBlob = await capture();
      const ocrLines = await recognize(imageBlob);

      if (ocrLines.length === 0) {
        setError(
          'No text detected. Try holding the camera closer to the nutrition label.'
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
        <div className={styles.guideBox}>
          <span className={styles.guideText}>
            Position the nutrition label within the frame
          </span>
        </div>
      </div>

      {/* OCR loading progress */}
      {!ocrReady && progress && (
        <div className={styles.progressOverlay}>
          <div className={styles.progressBadge}>
            Loading OCR engine... {progress}
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingBadge}>Scanning label...</div>
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
          disabled={isProcessing || !isReady}
        >
          <div
            className={`${styles.captureButtonInner} ${
              isProcessing || !isReady ? styles.disabled : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}
