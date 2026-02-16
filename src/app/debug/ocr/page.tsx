'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessForOcr, type PreprocessOptions } from '../../../lib/imagePreprocess';
import {
  recognizePreprocessed,
  preloadOcr,
  setOcrProgressCallback,
} from '../../../lib/ocr';
import { parseNutritionLabel } from '../../../parsing/nutritionLabelParser';
import { scoreScanResult } from '../../../lib/scanValidation';
import type { ScannedNutrition } from '../../../models/types';
import type { ScanScore } from '../../../lib/scanValidation';
import styles from './page.module.css';

interface TestResult {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error';
  originalUrl?: string;
  preprocessedUrl?: string;
  ocrLines?: string[];
  rawText?: string;
  nutrition?: ScannedNutrition;
  score?: ScanScore;
  error?: string;
  durationMs?: number;
  grayscaleMode?: string;
}

async function processImage(
  imageBlob: Blob,
  name: string,
  description: string,
  options?: PreprocessOptions,
): Promise<TestResult> {
  const start = performance.now();
  try {
    const originalUrl = URL.createObjectURL(imageBlob);

    // Preprocess
    const preprocessed = await preprocessForOcr(imageBlob, options ?? {});
    const preprocessedUrl = URL.createObjectURL(preprocessed);

    // OCR on preprocessed image
    const ocrLines = await recognizePreprocessed(preprocessed);

    // Parse
    const nutrition = parseNutritionLabel(ocrLines);

    // Score
    const score = scoreScanResult(nutrition);

    return {
      name,
      description,
      status: 'done',
      originalUrl,
      preprocessedUrl,
      ocrLines,
      rawText: ocrLines.join('\n'),
      nutrition,
      score,
      durationMs: performance.now() - start,
      grayscaleMode: options?.grayscaleMode ?? 'luma',
    };
  } catch (err) {
    return {
      name,
      description,
      status: 'error',
      error: String(err),
      durationMs: performance.now() - start,
    };
  }
}

function ResultCard({ result }: { result: TestResult }) {
  const [showRaw, setShowRaw] = useState(false);

  const statusClass =
    result.status === 'running'
      ? styles.statusRunning
      : result.status === 'done'
        ? styles.statusDone
        : result.status === 'error'
          ? styles.statusError
          : styles.statusPending;

  return (
    <div className={styles.labelCard}>
      <div className={styles.labelHeader}>
        <span className={styles.labelName}>{result.name}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {result.grayscaleMode && result.status === 'done' && (
            <span className={styles.modeTag}>{result.grayscaleMode}</span>
          )}
          <span className={`${styles.statusBadge} ${statusClass}`}>
            {result.status}
          </span>
        </div>
      </div>
      <div className={styles.labelDesc}>{result.description}</div>

      {result.status === 'error' && (
        <div className={styles.errorText}>{result.error}</div>
      )}

      {result.status === 'done' && (
        <>
          {/* Images */}
          <div className={styles.imagesRow}>
            {result.originalUrl && (
              <div className={styles.imageWrapper}>
                <span className={styles.imageLabel}>Original</span>
                <img src={result.originalUrl} alt="Original" />
              </div>
            )}
            {result.preprocessedUrl && (
              <div className={styles.imageWrapper}>
                <span className={styles.imageLabel}>Preprocessed</span>
                <img src={result.preprocessedUrl} alt="Preprocessed" />
              </div>
            )}
          </div>

          {/* Parsed values */}
          <div className={styles.sectionTitle}>Parsed Values</div>
          <div className={styles.nutrientGrid}>
            <div className={styles.nutrientHeader}>Nutrient</div>
            <div className={styles.nutrientHeader}>Per Serving</div>
            <div className={styles.nutrientHeader}>Per 100g</div>

            <NutrientRow
              label="Energy (kJ)"
              perServing={result.nutrition?.energyPerServing}
              per100g={result.nutrition?.energyPer100g}
            />
            <NutrientRow
              label="Protein (g)"
              perServing={result.nutrition?.proteinPerServing}
              per100g={result.nutrition?.proteinPer100g}
            />
            <NutrientRow
              label="Fat (g)"
              perServing={result.nutrition?.fatPerServing}
              per100g={result.nutrition?.fatPer100g}
            />
            <NutrientRow
              label="Carbs (g)"
              perServing={result.nutrition?.carbsPerServing}
              per100g={result.nutrition?.carbsPer100g}
            />
            <NutrientRow
              label="Fiber (g)"
              perServing={result.nutrition?.fiberPerServing}
              per100g={result.nutrition?.fiberPer100g}
            />
          </div>

          {/* Serving info */}
          {(result.nutrition?.servingSize || result.nutrition?.servingsPerPackage) && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {result.nutrition.servingSize && `Serving: ${result.nutrition.servingSize}`}
              {result.nutrition.servingSize && result.nutrition.servingsPerPackage && ' · '}
              {result.nutrition.servingsPerPackage && `Per pkg: ${result.nutrition.servingsPerPackage}`}
            </div>
          )}

          {/* Score */}
          <div className={styles.scoreRow}>
            <span
              className={`${styles.scoreBadge} ${
                result.score?.isValid ? styles.scoreValid : styles.scoreInvalid
              }`}
            >
              Score: {result.score ? (result.score.score * 100).toFixed(0) : 0}%
              {result.score?.isValid ? ' VALID' : ' INVALID'}
            </span>
            <span className={styles.scoreFields}>
              {result.score?.fieldsFound.join(', ')}
            </span>
            {result.durationMs && (
              <span className={styles.timing}>
                {(result.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {/* Raw OCR text (collapsible) */}
          <button
            className={styles.sectionTitle}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', color: 'inherit' }}
            onClick={() => setShowRaw(!showRaw)}
          >
            Raw OCR Text {showRaw ? '▼' : '▶'}
          </button>
          {showRaw && (
            <pre className={styles.rawText}>
              {result.rawText || '(no text detected)'}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function NutrientRow({
  label,
  perServing,
  per100g,
}: {
  label: string;
  perServing?: string;
  per100g?: string;
}) {
  return (
    <>
      <span className={styles.nutrientLabel}>{label}</span>
      <span className={perServing ? styles.nutrientValue : styles.nutrientMissing}>
        {perServing || '--'}
      </span>
      <span className={per100g ? styles.nutrientValue : styles.nutrientMissing}>
        {per100g || '--'}
      </span>
    </>
  );
}

export default function DebugOcrPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrReady, setOcrReady] = useState(false);
  const [progress, setProgress] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ name: string; blob: Blob }[]>([]);

  useEffect(() => {
    setOcrProgressCallback((status, prog) => {
      setProgress(`${status} (${Math.round(prog * 100)}%)`);
    });
    preloadOcr().then(() => {
      setOcrReady(true);
      setProgress('');
    });
    return () => setOcrProgressCallback(null);
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      const newImages = Array.from(files).map((f) => ({
        name: f.name,
        blob: f as Blob,
      }));
      setUploadedImages((prev) => [...prev, ...newImages]);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [],
  );

  const runAll = useCallback(async () => {
    if (uploadedImages.length === 0 || isRunning) return;
    setIsRunning(true);

    // Initialize results as pending
    const initial: TestResult[] = uploadedImages.map((img, i) => ({
      name: `Label ${i + 1}`,
      description: img.name,
      status: 'pending' as const,
    }));
    setResults(initial);

    // Process each sequentially
    for (let i = 0; i < uploadedImages.length; i++) {
      // Mark as running
      setResults((prev) =>
        prev.map((r, j) => (j === i ? { ...r, status: 'running' as const } : r)),
      );

      const img = uploadedImages[i];
      const result = await processImage(
        img.blob,
        `Label ${i + 1}`,
        img.name,
      );

      setResults((prev) => prev.map((r, j) => (j === i ? result : r)));
    }

    setIsRunning(false);
  }, [uploadedImages, isRunning]);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>OCR Debug</h1>
      <p className={styles.subtitle}>
        {ocrReady
          ? `Upload label images and test the OCR pipeline. ${uploadedImages.length} image(s) loaded.`
          : `Loading OCR engine... ${progress}`}
      </p>

      <div className={styles.controls}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button
          className={styles.uploadLabel}
          onClick={() => fileInputRef.current?.click()}
          disabled={isRunning}
        >
          + Add Images
        </button>
        <button
          className={styles.runButton}
          onClick={runAll}
          disabled={!ocrReady || isRunning || uploadedImages.length === 0}
        >
          {isRunning ? 'Processing...' : `Run All (${uploadedImages.length})`}
        </button>
        {uploadedImages.length > 0 && !isRunning && (
          <button
            className={styles.uploadLabel}
            onClick={() => {
              setUploadedImages([]);
              setResults([]);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Uploaded image previews before running */}
      {uploadedImages.length > 0 && results.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          {uploadedImages.map((img, i) => (
            <div key={i} className={styles.labelCard}>
              <span className={styles.labelName}>Label {i + 1}</span>
              <div className={styles.labelDesc}>{img.name}</div>
              <img
                src={URL.createObjectURL(img.blob)}
                alt={img.name}
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, background: '#111' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {results.map((result, i) => (
        <ResultCard key={i} result={result} />
      ))}
    </div>
  );
}
