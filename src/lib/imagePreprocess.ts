/**
 * Multi-channel adaptive image preprocessing pipeline for OCR.
 *
 * Pipeline:
 *   1. Decode + optional downscale (max 1600px)
 *   2. Extract 4 grayscale candidates (Luma, R, G, B)
 *   3. Score each channel's bimodality → pick the best one
 *   4. Percentile-based contrast stretch (0.5th – 99.5th)
 *   5. Sauvola local adaptive thresholding
 *   6. Morphological open (remove noise specks)
 *   7. Export as lossless PNG
 *
 * This handles both traditional high-contrast labels AND colored labels
 * (e.g. dark text on green/blue/yellow backgrounds) by automatically
 * selecting the colour channel with the best text-vs-background separation
 * and adapting the binarization threshold per-region.
 */

// ── Tunable constants ──────────────────────────────────────────────
const MAX_DIMENSION = 1600;
const PERCENTILE_LOW = 0.005;
const PERCENTILE_HIGH = 0.995;
const SAUVOLA_K = 0.2;
const SAUVOLA_R = 128;
const WINDOW_DIVISOR = 60;
const WINDOW_MIN = 15;
const WINDOW_MAX = 51;

// ── Main entry point ───────────────────────────────────────────────

/**
 * Preprocess a camera capture for better OCR accuracy.
 * @param blob Raw camera capture (JPEG / PNG)
 * @returns Preprocessed PNG blob — clean black text on white background
 */
export async function preprocessForOcr(blob: Blob): Promise<Blob> {
  // 1. Decode + optional downscale
  const imageBitmap = await createImageBitmap(blob);
  const { canvas, ctx, w, h } = createScaledCanvas(imageBitmap);
  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, w, h);
  const rgba = imageData.data;
  const numPixels = w * h;

  // 2. Extract 4 grayscale channel candidates
  const channels = extractChannels(rgba, numPixels);

  // 3. Pick the channel with best text/background separation
  const bestGray = selectBestChannel(channels);

  // 4. Percentile-based contrast stretch
  const stretched = percentileStretch(bestGray);

  // 5. Sauvola local adaptive thresholding
  const windowSize = computeWindowSize(w);
  const binarized = sauvolaThreshold(stretched, w, h, windowSize);

  // 6. Morphological open to remove noise specks
  const cleaned = morphOpen(binarized, w, h);

  // 7. Write back + export PNG
  writeToImageData(cleaned, rgba);
  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}

// ── Step 1: Decode + downscale ─────────────────────────────────────

function createScaledCanvas(bitmap: ImageBitmap) {
  const canvas = document.createElement('canvas');
  let w = bitmap.width;
  let h = bitmap.height;

  const maxDim = Math.max(w, h);
  if (maxDim > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / maxDim;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(bitmap, 0, 0, w, h);
  return { canvas, ctx, w, h };
}

// ── Step 2: Multi-channel extraction ───────────────────────────────

interface ChannelSet {
  luma: Uint8Array;
  red: Uint8Array;
  green: Uint8Array;
  blue: Uint8Array;
}

function extractChannels(rgba: Uint8ClampedArray, numPixels: number): ChannelSet {
  const luma = new Uint8Array(numPixels);
  const red = new Uint8Array(numPixels);
  const green = new Uint8Array(numPixels);
  const blue = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    luma[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    red[i] = r;
    green[i] = g;
    blue[i] = b;
  }

  return { luma, red, green, blue };
}

// ── Step 3: Channel selection by bimodality score ──────────────────

function selectBestChannel(channels: ChannelSet): Uint8Array {
  const candidates: Uint8Array[] = [
    channels.luma,
    channels.red,
    channels.green,
    channels.blue,
  ];

  let best = channels.luma;
  let bestScore = -1;

  for (let c = 0; c < candidates.length; c++) {
    const score = bimodalityScore(candidates[c]);
    if (score > bestScore) {
      bestScore = score;
      best = candidates[c];
    }
  }

  return best;
}

/**
 * Measure how cleanly a grayscale histogram separates into two classes.
 * Uses Otsu's inter-class variance normalised by total variance.
 * Higher score → cleaner bimodal split → better for binarization.
 */
function bimodalityScore(gray: Uint8Array): number {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) {
    sumAll += i * histogram[i];
  }
  const meanAll = sumAll / total;

  // Total variance
  let totalVariance = 0;
  for (let i = 0; i < 256; i++) {
    const diff = i - meanAll;
    totalVariance += diff * diff * histogram[i];
  }
  totalVariance /= total;
  if (totalVariance === 0) return 0;

  // Max inter-class variance (Otsu criterion)
  let sumBg = 0;
  let weightBg = 0;
  let maxInterClassVar = 0;

  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t];
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;

    sumBg += t * histogram[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const icv = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (icv > maxInterClassVar) maxInterClassVar = icv;
  }

  return maxInterClassVar / (total * total * totalVariance);
}

// ── Step 4: Percentile-based contrast stretch ──────────────────────

function percentileStretch(gray: Uint8Array): Float32Array {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }

  const total = gray.length;
  const lowCount = Math.floor(total * PERCENTILE_LOW);
  const highCount = Math.floor(total * PERCENTILE_HIGH);

  let cumulative = 0;
  let lowVal = 0;
  let highVal = 255;
  let foundLow = false;

  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (!foundLow && cumulative >= lowCount) {
      lowVal = i;
      foundLow = true;
    }
    if (cumulative >= highCount) {
      highVal = i;
      break;
    }
  }

  const range = highVal - lowVal || 1;
  const stretched = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = ((gray[i] - lowVal) / range) * 255;
    stretched[i] = Math.max(0, Math.min(255, val));
  }
  return stretched;
}

// ── Step 5: Sauvola local adaptive thresholding ────────────────────

function computeWindowSize(imgWidth: number): number {
  let ws = Math.round(imgWidth / WINDOW_DIVISOR);
  ws = Math.max(WINDOW_MIN, Math.min(WINDOW_MAX, ws));
  // Ensure odd
  if (ws % 2 === 0) ws += 1;
  return ws;
}

/**
 * Sauvola binarization using integral images for O(N) performance.
 * T(x,y) = mean * (1 + k * (stddev / R − 1))
 */
function sauvolaThreshold(
  gray: Float32Array,
  w: number,
  h: number,
  windowSize: number,
): Uint8Array {
  const n = w * h;
  const halfW = (windowSize - 1) >> 1;

  // Build integral images for sum and sum-of-squares
  const integralSum = new Float64Array(n);
  const integralSq = new Float64Array(n);

  // First pixel
  integralSum[0] = gray[0];
  integralSq[0] = gray[0] * gray[0];

  // First row
  for (let x = 1; x < w; x++) {
    integralSum[x] = integralSum[x - 1] + gray[x];
    integralSq[x] = integralSq[x - 1] + gray[x] * gray[x];
  }

  // Remaining rows
  for (let y = 1; y < h; y++) {
    let rowSum = 0;
    let rowSqSum = 0;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      rowSum += gray[idx];
      rowSqSum += gray[idx] * gray[idx];
      integralSum[idx] = integralSum[(y - 1) * w + x] + rowSum;
      integralSq[idx] = integralSq[(y - 1) * w + x] + rowSqSum;
    }
  }

  // Compute per-pixel threshold
  const output = new Uint8Array(n);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Window bounds (clamped to image)
      const x1 = Math.max(0, x - halfW) - 1;
      const y1 = Math.max(0, y - halfW) - 1;
      const x2 = Math.min(w - 1, x + halfW);
      const y2 = Math.min(h - 1, y + halfW);

      const area = (x2 - x1) * (y2 - y1);

      // Rectangle sum via integral image
      let sum = integralSum[y2 * w + x2];
      let sqSum = integralSq[y2 * w + x2];
      if (x1 >= 0) {
        sum -= integralSum[y2 * w + x1];
        sqSum -= integralSq[y2 * w + x1];
      }
      if (y1 >= 0) {
        sum -= integralSum[y1 * w + x2];
        sqSum -= integralSq[y1 * w + x2];
      }
      if (x1 >= 0 && y1 >= 0) {
        sum += integralSum[y1 * w + x1];
        sqSum += integralSq[y1 * w + x1];
      }

      const mean = sum / area;
      const variance = sqSum / area - mean * mean;
      const stddev = Math.sqrt(Math.max(0, variance));

      const threshold = mean * (1 + SAUVOLA_K * (stddev / SAUVOLA_R - 1));

      output[y * w + x] = gray[y * w + x] > threshold ? 255 : 0;
    }
  }

  return output;
}

// ── Step 6: Morphological open (erode → dilate) ────────────────────

function morphOpen(binary: Uint8Array, w: number, h: number): Uint8Array {
  // Erode: pixel is black (0) if ANY 3x3 neighbour is black
  const eroded = new Uint8Array(binary.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minVal = 255;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const v = binary[ny * w + nx];
            if (v < minVal) minVal = v;
          }
        }
      }
      eroded[y * w + x] = minVal;
    }
  }

  // Dilate: pixel is white (255) if ANY 3x3 neighbour is white
  const dilated = new Uint8Array(eroded.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const v = eroded[ny * w + nx];
            if (v > maxVal) maxVal = v;
          }
        }
      }
      dilated[y * w + x] = maxVal;
    }
  }

  return dilated;
}

// ── Step 7: Write back + export ────────────────────────────────────

function writeToImageData(binary: Uint8Array, rgba: Uint8ClampedArray) {
  for (let i = 0; i < binary.length; i++) {
    const idx = i * 4;
    rgba[idx] = binary[i];
    rgba[idx + 1] = binary[i];
    rgba[idx + 2] = binary[i];
    rgba[idx + 3] = 255;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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
