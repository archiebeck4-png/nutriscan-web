'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCamera } from '../../../hooks/useCamera';
import { useOcr } from '../../../hooks/useOcr';
import { useBarcodeScanner } from '../../../hooks/useBarcodeScanner';
import { smartRecognizeNutrition } from '../../../lib/smartRecognize';
import { useScanData } from '../../../context/ScanContext';
import styles from './page.module.css';

export default function ScanPage() {
  return (
    <Suspense>
      <ScanPageContent />
    </Suspense>
  );
}

function ScanPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRecipe = searchParams.get('from') === 'recipe';
  const { videoRef, permissionState, isReady, capture, initCamera } =
    useCamera();
  const { isProcessing, isReady: ocrReady, progress } = useOcr();
  const { scanData, setScanData } = useScanData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [isSmartProcessing, setIsSmartProcessing] = useState(false);
  const barcodeProcessingRef = useRef(false);

  // If there's already a barcode in ScanContext, we're in "scan the label" mode
  const existingBarcode = scanData?.barcode ?? null;

  useEffect(() => {
    initCamera();
  }, [initCamera]);

  // Barcode detection — navigate immediately to lookup page
  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      if (navigating || barcodeProcessingRef.current) return;
      barcodeProcessingRef.current = true;
      setNavigating(true);

      const emptyNutrition = {
        foodName: '', servingSize: '', servingsPerPackage: '',
        energyPerServing: '', proteinPerServing: '', fatPerServing: '',
        carbsPerServing: '', fiberPerServing: '',
        energyPer100g: '', proteinPer100g: '', fatPer100g: '',
        carbsPer100g: '', fiberPer100g: '', rawText: '',
      };
      setScanData({ nutrition: emptyNutrition, imageBlob: null, barcode });
      router.push('/add/barcode-lookup');
    },
    [navigating, setScanData, router]
  );

  // Barcode scanner hook — runs continuously in background
  // Disabled when in "scan the label" mode (existingBarcode set)
  const anyProcessing = isProcessing || isSmartProcessing;
  const barcodeScanEnabled =
    isReady && !anyProcessing && !navigating && !barcodeProcessingRef.current && !existingBarcode;
  const { isScanning: isBarcodeScanning, stop: stopBarcode } =
    useBarcodeScanner({
      videoRef,
      enabled: barcodeScanEnabled,
      onBarcodeDetected: handleBarcodeDetected,
    });

  // Manual capture — freezes camera, then does smart recognition
  const handleCapture = async () => {
    if (isProcessing || isSmartProcessing || navigating) return;
    stopBarcode();
    setError(null);

    try {
      const imageBlob = await capture();
      // Freeze camera on the captured frame
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setIsSmartProcessing(true);

      const { nutrition, rawLines } = await smartRecognizeNutrition(imageBlob);

      if (rawLines.length === 0) {
        // Resume camera if no text detected
        if (videoRef.current) videoRef.current.play();
        setError(
          'No text detected. Try holding the camera closer to the nutrition label.'
        );
        return;
      }

      setScanData({ nutrition, imageBlob, barcode: existingBarcode ?? undefined });
      router.push(fromRecipe ? '/add/review?from=recipe' : '/add/review');
    } catch (err) {
      console.error('Scan error:', err);
      // Resume camera on error
      if (videoRef.current) videoRef.current.play();
      setError('Failed to scan. Please try again.');
    } finally {
      setIsSmartProcessing(false);
    }
  };

  // Upload a photo from gallery
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isProcessing || isSmartProcessing || navigating) return;
    stopBarcode();
    setError(null);
    setIsSmartProcessing(true);

    try {
      const imageBlob: Blob = file;
      const { nutrition, rawLines } = await smartRecognizeNutrition(imageBlob);

      if (rawLines.length === 0) {
        setError(
          'No text detected in the uploaded image. Try a clearer photo of the nutrition label.'
        );
        return;
      }

      setScanData({ nutrition, imageBlob, barcode: existingBarcode ?? undefined });
      router.push(fromRecipe ? '/add/review?from=recipe' : '/add/review');
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

  // Loading — camera is initializing (permission already granted or being checked)
  if (permissionState === 'loading') {
    return (
      <div className={styles.centered}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 17 }}>Starting camera...</span>
      </div>
    );
  }

  // Permission prompt — only shown on very first visit
  if (permissionState === 'prompt') {
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
            {existingBarcode
              ? `Scan the nutrition label for barcode ${existingBarcode}`
              : 'Position the nutrition label and tap to capture'}
          </span>
        </div>
      </div>

      {/* Barcode scanning indicator */}
      {isBarcodeScanning && !existingBarcode && (
        <div className={styles.barcodeIndicator}>
          <span className={styles.scanningDot} />
          Scanning for barcodes...
        </div>
      )}

      {/* Navigating overlay */}
      {navigating && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingBadge}>
            Opening review...
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
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="3"
                stroke="white"
                strokeWidth="1.5"
              />
              <path
                d="M3 16l5-5 4 4 3-3 6 6"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="15.5"
                cy="8.5"
                r="1.5"
                stroke="white"
                strokeWidth="1.5"
              />
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
        <span className={styles.captureHint}>Tap to scan nutrition label</span>
      </div>
    </div>
  );
}
