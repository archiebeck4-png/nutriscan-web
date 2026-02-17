/**
 * Image preprocessing pipeline for OCR.
 *
 * Pipeline:
 *   1. Optional downscale (fast mode: max 1200px)
 *   2. Convert to grayscale (BT.601 luma)
 *   3. Contrast stretch (min/max histogram stretch)
 *   4. Sharpening (unsharp mask with 3x3 box blur)
 *   5. Otsu's threshold for binarization
 *   6. Export as PNG
 */

export type GrayscaleMode = 'luma' | 'red' | 'green' | 'blue' | 'invert';

export interface PreprocessOptions {
  /** When true: downscale to 1200px max dimension (faster for continuous scanning) */
  fast?: boolean;
  /** Which channel to use for grayscale conversion (default: 'luma') */
  grayscaleMode?: GrayscaleMode;
}

const FAST_MAX_DIMENSION = 1200;
const QUALITY_MAX_DIMENSION = 2400;

/**
 * Preprocess a camera capture for better OCR accuracy.
 *
 * @param blob Raw camera capture (JPEG / PNG)
 * @param options Optional settings (fast mode for continuous scanning)
 * @returns Preprocessed binarized PNG blob
 */
export async function preprocessForOcr(
  blob: Blob,
  options: PreprocessOptions = {},
): Promise<Blob> {
  const imageBitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  let w = imageBitmap.width;
  let h = imageBitmap.height;

  // Downscale large images — reduces noise and speeds up processing
  const maxDim = options.fast ? FAST_MAX_DIMENSION : QUALITY_MAX_DIMENSION;
  const currentMax = Math.max(w, h);
  if (currentMax > maxDim) {
    const scale = maxDim / currentMax;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(imageBitmap, 0, 0, w, h);
  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Step 1: Convert to grayscale (channel-selectable)
  const mode = options.grayscaleMode ?? 'luma';
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    switch (mode) {
      case 'red':    gray[i] = r; break;
      case 'green':  gray[i] = g; break;
      case 'blue':   gray[i] = b; break;
      case 'invert': gray[i] = 255 - (0.299 * r + 0.587 * g + 0.114 * b); break;
      default:       gray[i] = 0.299 * r + 0.587 * g + 0.114 * b; break;
    }
  }

  // Step 2: Contrast stretch (histogram stretch)
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < minVal) minVal = gray[i];
    if (gray[i] > maxVal) maxVal = gray[i];
  }
  const range = maxVal - minVal || 1;
  for (let i = 0; i < gray.length; i++) {
    gray[i] = ((gray[i] - minVal) / range) * 255;
  }

  // Step 3: Sharpening (unsharp mask)
  const blurred = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += gray[ny * w + nx];
            count++;
          }
        }
      }
      blurred[y * w + x] = sum / count;
    }
  }

  const sharpAmount = 1.5;
  const sharpened = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = gray[i] + sharpAmount * (gray[i] - blurred[i]);
    sharpened[i] = Math.max(0, Math.min(255, val));
  }

  // Step 4: Otsu's threshold for binarization
  const threshold = otsuThreshold(sharpened);

  for (let i = 0; i < sharpened.length; i++) {
    const idx = i * 4;
    const bw = sharpened[i] > threshold ? 255 : 0;
    data[idx] = bw;
    data[idx + 1] = bw;
    data[idx + 2] = bw;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Failed to export preprocessed image'));
      },
      'image/png',
    );
  });
}

/**
 * Otsu's method for automatic threshold selection.
 * Maximizes inter-class variance between foreground and background.
 */
function otsuThreshold(gray: Float32Array): number {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    histogram[Math.round(gray[i])]++;
  }

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) {
    sumAll += i * histogram[i];
  }

  let sumBg = 0;
  let weightBg = 0;
  let maxVariance = 0;
  let bestThreshold = 0;

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const variance =
      weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}
