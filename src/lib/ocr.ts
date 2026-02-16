import { createWorker, Worker } from 'tesseract.js';

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

export async function recognizeImage(image: Blob): Promise<string[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(image);
  return data.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function preloadOcr(): Promise<void> {
  await getWorker();
}
