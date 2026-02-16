import { createWorker, Worker } from 'tesseract.js';
import { preprocessForOcr } from './imagePreprocess';

let workerInstance: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;

export type OcrProgressCallback = (status: string, progress: number) => void;

let progressCallback: OcrProgressCallback | null = null;

export function setOcrProgressCallback(cb: OcrProgressCallback | null) {
  progressCallback = cb;
}

async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = createWorker('eng', 1, {
    logger: (m) => {
      if (progressCallback && m.progress !== undefined) {
        progressCallback(m.status, m.progress);
      }
    },
  });

  workerInstance = await workerInitPromise;
  workerInitPromise = null;
  return workerInstance;
}

export async function recognizeImage(
  image: Blob,
  fast: boolean = false,
): Promise<string[]> {
  // Preprocess image for better OCR accuracy
  if (progressCallback) progressCallback('Enhancing image...', 0);
  const processed = await preprocessForOcr(image, { fast });

  const worker = await getWorker();
  const { data } = await worker.recognize(processed);
  return data.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Recognize text from an already-preprocessed image blob.
 * Skips the internal preprocessing step — use when you've already
 * called preprocessForOcr() yourself (e.g. in the debug page).
 */
export async function recognizePreprocessed(
  preprocessedBlob: Blob,
): Promise<string[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(preprocessedBlob);
  return data.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function preloadOcr(): Promise<void> {
  await getWorker();
}
