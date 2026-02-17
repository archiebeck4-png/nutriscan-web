'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { preprocessForOcr, type PreprocessOptions, type GrayscaleMode } from '../../../lib/imagePreprocess';
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

const ALL_MODES: GrayscaleMode[] = ['luma', 'red', 'green', 'blue', 'invert'];

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

interface ImageGroup {
  name: string;
  fileName: string;
  blob: Blob;
  results: TestResult[];
  bestMode?: string;
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
    const preprocessed = await preprocessForOcr(imageBlob, options ?? {});
    const preprocessedUrl = URL.createObjectURL(preprocessed);
    const ocrLines = await recognizePreprocessed(preprocessed);
    const nutrition = parseNutritionLabel(ocrLines);
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
      grayscaleMode: options?.grayscaleMode ?? 'luma',
    };
  }
}

function ResultCard({ result, isBest }: { result: TestResult; isBest: boolean }) {
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
    <div className={`${styles.labelCard} ${isBest ? styles.bestCard : ''}`}>
      <div className={styles.labelHeader}>
        <span className={styles.labelName}>
          {result.name}
          {isBest && <span className={styles.bestTag}>BEST</span>}
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {result.grayscaleMode && result.status === 'done' && (
            <span className={styles.modeTag}>{result.grayscaleMode}</span>
          )}
          <span className={`${styles.statusBadge} ${statusClass}`}>
            {result.status}
          </span>
        </div>
      </div>

      {result.status === 'error' && (
        <div className={styles.errorText}>{result.error}</div>
      )}

      {result.status === 'done' && (
        <>
          <div className={styles.imagesRow}>
            {result.preprocessedUrl && (
              <div className={styles.imageWrapper}>
                <span className={styles.imageLabel}>Preprocessed</span>
                <img src={result.preprocessedUrl} alt="Preprocessed" />
              </div>
            )}
          </div>

          <div className={styles.sectionTitle}>Parsed Values</div>
          <div className={styles.nutrientGrid}>
            <div className={styles.nutrientHeader}>Nutrient</div>
            <div className={styles.nutrientHeader}>Per Serving</div>
            <div className={styles.nutrientHeader}>Per 100g</div>
            <NutrientRow label="Energy (kJ)" perServing={result.nutrition?.energyPerServing} per100g={result.nutrition?.energyPer100g} />
            <NutrientRow label="Protein (g)" perServing={result.nutrition?.proteinPerServing} per100g={result.nutrition?.proteinPer100g} />
            <NutrientRow label="Fat (g)" perServing={result.nutrition?.fatPerServing} per100g={result.nutrition?.fatPer100g} />
            <NutrientRow label="Carbs (g)" perServing={result.nutrition?.carbsPerServing} per100g={result.nutrition?.carbsPer100g} />
            <NutrientRow label="Fiber (g)" perServing={result.nutrition?.fiberPerServing} per100g={result.nutrition?.fiberPer100g} />
          </div>

          {(result.nutrition?.servingSize || result.nutrition?.servingsPerPackage) && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              {result.nutrition?.servingSize && `Serving: ${result.nutrition.servingSize}`}
              {result.nutrition?.servingSize && result.nutrition?.servingsPerPackage && ' · '}
              {result.nutrition?.servingsPerPackage && `Per pkg: ${result.nutrition.servingsPerPackage}`}
            </div>
          )}

          <div className={styles.scoreRow}>
            <span className={`${styles.scoreBadge} ${result.score?.isValid ? styles.scoreValid : styles.scoreInvalid}`}>
              Score: {result.score ? (result.score.score * 100).toFixed(0) : 0}%
              {result.score?.isValid ? ' VALID' : ' INVALID'}
            </span>
            <span className={styles.scoreFields}>{result.score?.fieldsFound.join(', ')}</span>
            {result.durationMs && (
              <span className={styles.timing}>{(result.durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>

          <button
            className={styles.sectionTitle}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', color: 'inherit' }}
            onClick={() => setShowRaw(!showRaw)}
          >
            Raw OCR Text {showRaw ? '▼' : '▶'}
          </button>
          {showRaw && (
            <pre className={styles.rawText}>{result.rawText || '(no text detected)'}</pre>
          )}
        </>
      )}
    </div>
  );
}

function NutrientRow({ label, perServing, per100g }: { label: string; perServing?: string; per100g?: string }) {
  return (
    <>
      <span className={styles.nutrientLabel}>{label}</span>
      <span className={perServing ? styles.nutrientValue : styles.nutrientMissing}>{perServing || '--'}</span>
      <span className={per100g ? styles.nutrientValue : styles.nutrientMissing}>{per100g || '--'}</span>
    </>
  );
}

function ScoreMatrix({ groups }: { groups: ImageGroup[] }) {
  if (groups.length === 0 || groups[0].results.length === 0) return null;

  return (
    <div className={styles.labelCard}>
      <div className={styles.labelName} style={{ marginBottom: 12 }}>Score Comparison Matrix</div>
      <div style={{ overflowX: 'auto' }}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th>Image</th>
              {ALL_MODES.map((mode) => (
                <th key={mode}>{mode}</th>
              ))}
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, i) => {
              let bestScore = -1;
              let bestMode = '';
              group.results.forEach((r) => {
                if (r.score && r.score.score > bestScore) {
                  bestScore = r.score.score;
                  bestMode = r.grayscaleMode ?? '';
                }
              });

              return (
                <tr key={i}>
                  <td>{group.name}</td>
                  {group.results.map((r, j) => {
                    const score = r.score?.score ?? 0;
                    const isValid = r.score?.isValid ?? false;
                    const isBest = r.grayscaleMode === bestMode;
                    return (
                      <td
                        key={j}
                        style={{
                          color: isValid ? '#2ed573' : score > 0.3 ? '#ffa502' : '#ff4757',
                          fontWeight: isBest ? 700 : 400,
                          background: isBest ? 'rgba(46, 213, 115, 0.08)' : undefined,
                        }}
                      >
                        {(score * 100).toFixed(0)}%
                      </td>
                    );
                  })}
                  <td style={{ fontWeight: 600, color: '#2ed573' }}>{bestMode}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DebugOcrPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrReady, setOcrReady] = useState(false);
  const [progress, setProgress] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [uploadedImages, setUploadedImages] = useState<{ name: string; blob: Blob }[]>([]);
  const [statusText, setStatusText] = useState('');

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

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = Array.from(files).map((f) => ({ name: f.name, blob: f as Blob }));
    setUploadedImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Run all images through all 5 grayscale modes
  const runAllModes = useCallback(async () => {
    if (uploadedImages.length === 0 || isRunning) return;
    setIsRunning(true);

    const newGroups: ImageGroup[] = uploadedImages.map((img, i) => ({
      name: `Label ${i + 1}`,
      fileName: img.name,
      blob: img.blob,
      results: ALL_MODES.map((mode) => ({
        name: `Label ${i + 1}`,
        description: `${img.name} (${mode})`,
        status: 'pending' as const,
        grayscaleMode: mode,
      })),
    }));
    setGroups(newGroups);

    for (let i = 0; i < uploadedImages.length; i++) {
      const img = uploadedImages[i];

      for (let m = 0; m < ALL_MODES.length; m++) {
        const mode = ALL_MODES[m];
        setStatusText(`Processing Label ${i + 1} / ${mode} channel...`);

        // Mark as running
        setGroups((prev) =>
          prev.map((g, gi) =>
            gi === i
              ? {
                  ...g,
                  results: g.results.map((r, ri) =>
                    ri === m ? { ...r, status: 'running' as const } : r,
                  ),
                }
              : g,
          ),
        );

        const result = await processImage(
          img.blob,
          `Label ${i + 1}`,
          `${img.name} (${mode})`,
          { grayscaleMode: mode },
        );

        setGroups((prev) =>
          prev.map((g, gi) =>
            gi === i
              ? {
                  ...g,
                  results: g.results.map((r, ri) => (ri === m ? result : r)),
                }
              : g,
          ),
        );
      }

      // Determine best mode for this image
      setGroups((prev) =>
        prev.map((g, gi) => {
          if (gi !== i) return g;
          let bestScore = -1;
          let bestMode = '';
          g.results.forEach((r) => {
            if (r.score && r.score.score > bestScore) {
              bestScore = r.score.score;
              bestMode = r.grayscaleMode ?? '';
            }
          });
          return { ...g, bestMode };
        }),
      );
    }

    setStatusText('');
    setIsRunning(false);
  }, [uploadedImages, isRunning]);

  // Quick run: just standard luma mode
  const runQuick = useCallback(async () => {
    if (uploadedImages.length === 0 || isRunning) return;
    setIsRunning(true);

    const newGroups: ImageGroup[] = uploadedImages.map((img, i) => ({
      name: `Label ${i + 1}`,
      fileName: img.name,
      blob: img.blob,
      results: [
        {
          name: `Label ${i + 1}`,
          description: `${img.name} (luma)`,
          status: 'pending' as const,
          grayscaleMode: 'luma',
        },
      ],
    }));
    setGroups(newGroups);

    for (let i = 0; i < uploadedImages.length; i++) {
      const img = uploadedImages[i];
      setStatusText(`Processing Label ${i + 1}...`);

      setGroups((prev) =>
        prev.map((g, gi) =>
          gi === i
            ? { ...g, results: g.results.map((r) => ({ ...r, status: 'running' as const })) }
            : g,
        ),
      );

      const result = await processImage(img.blob, `Label ${i + 1}`, `${img.name} (luma)`);

      setGroups((prev) =>
        prev.map((g, gi) => (gi === i ? { ...g, results: [result] } : g)),
      );
    }

    setStatusText('');
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
          onClick={runQuick}
          disabled={!ocrReady || isRunning || uploadedImages.length === 0}
        >
          {isRunning ? 'Processing...' : 'Quick Run'}
        </button>
        <button
          className={styles.runButton}
          onClick={runAllModes}
          disabled={!ocrReady || isRunning || uploadedImages.length === 0}
          style={{ background: '#6c5ce7' }}
        >
          All Modes (5x)
        </button>
        {uploadedImages.length > 0 && !isRunning && (
          <button
            className={styles.uploadLabel}
            onClick={() => {
              setUploadedImages([]);
              setGroups([]);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {statusText && (
        <p className={styles.subtitle} style={{ marginTop: -10, marginBottom: 16 }}>
          {statusText}
        </p>
      )}

      {/* Uploaded image previews before running */}
      {uploadedImages.length > 0 && groups.length === 0 && (
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

      {/* Score matrix (only for multi-mode runs) */}
      {groups.length > 0 && groups[0].results.length > 1 && (
        <ScoreMatrix groups={groups} />
      )}

      {/* Results grouped by image */}
      {groups.map((group, gi) => (
        <div key={gi}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 8px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {group.name}
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{group.fileName}</span>
            {group.bestMode && (
              <span className={styles.modeTag}>best: {group.bestMode}</span>
            )}
          </div>

          {/* Show original image once per group */}
          {group.results[0]?.originalUrl && (
            <div className={styles.labelCard} style={{ padding: 8 }}>
              <img
                src={group.results[0].originalUrl}
                alt="Original"
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, background: '#111' }}
              />
            </div>
          )}

          {group.results.map((result, ri) => (
            <ResultCard key={ri} result={result} isBest={result.grayscaleMode === group.bestMode && group.results.length > 1} />
          ))}
        </div>
      ))}
    </div>
  );
}
