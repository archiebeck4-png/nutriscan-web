/**
 * Grayscale image preprocessing pipeline for LSTM OCR.
 *
 * Pipeline:
 *   1. Decode + optional downscale (max 1600px)
 *   2. Extract 7 grayscale candidates (Luma, R, G, B, |R-G|, |R-B|, |G-B|)
 *   3. Score each channel's contrast → pick the best one
 *   4. CLAHE (Contrast Limited Adaptive Histogram Equalization)
 *   5. Export as grayscale PNG
 *
 * IMPORTANT: This pipeline outputs GRAYSCALE, not binary black/white.
 * Tesseract's LSTM engine (OEM 1) is trained on grayscale images and
 * performs significantly better with gradient/anti-aliasing information
 * preserved. Binarization destroys edge detail the neural network needs.
 *
 * Color-difference channels (|R-G|, |R-B|, |G-B|) detect hue-based contrast
 * that single channels miss on monochromatic colored labels.
 */

// ── Tunable constants ──────────────────────────────────────────────
const MAX_DIMENSION = 1600;
const FAST_MAX_DIMENSION = 1200;

// CLAHE parameters
const CLAHE_TILE_SIZE = 8; // grid tiles (8x8 grid)
const CLAHE_CLIP_LIMIT = 2.5; // contrast amplification limit

// Percentile stretch (fallback / pre-CLAHE normalization)
const PERCENTILE_LOW = 0.005;
const PERCENTILE_HIGH = 0.995;

// ── Main entry point ───────────────────────────────────────────────

export interface PreprocessOptions {
  /** When true: use 1200px max dimension (faster for continuous scanning) */
  fast?: boolean;
}

/**
 * Preprocess a camera capture for better OCR accuracy.
 * Outputs an enhanced grayscale image (NOT binary/binarized).
 *
 * @param blob Raw camera capture (JPEG / PNG)
 * @param options Optional settings (fast mode for continuous scanning)
 * @returns Preprocessed grayscale PNG blob
 */
export async function preprocessForOcr(
  blob: Blob,
  options: PreprocessOptions = {},
): Promise<Blob> {
  const maxDim = options.fast ? FAST_MAX_DIMENSION : MAX_DIMENSION;

  // 1. Decode + optional downscale
  const imageBitmap = await createImageBitmap(blob);
  const { canvas, ctx, w, h } = createScaledCanvas(imageBitmap, maxDim);
  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, w, h);
  const rgba = imageData.data;
  const numPixels = w * h;

  // 2. Extract 7 grayscale channel candidates (incl. color-difference)
  const channels = extractChannels(rgba, numPixels);

  // 3. Pick the channel with best text/background contrast
  const bestGray = selectBestChannel(channels);

  // 4. Percentile stretch to normalize intensity range
  const stretched = percentileStretch(bestGray);

  // 5. CLAHE for local contrast enhancement (preserves grayscale detail)
  const enhanced = clahe(stretched, w, h);

  // 6. Write grayscale back + export PNG
  writeGrayscale(enhanced, rgba);
  ctx.putImageData(imageData, 0, 0);
  return canvasToBlob(canvas);
}

// ── Step 1: Decode + downscale ─────────────────────────────────────

function createScaledCanvas(bitmap: ImageBitmap, maxDimension: number) {
  const canvas = document.createElement('canvas');
  let w = bitmap.width;
  let h = bitmap.height;

  const maxDim = Math.max(w, h);
  if (maxDim > maxDimension) {
    const scale = maxDimension / maxDim;
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
  diffRG: Uint8Array;
  diffRB: Uint8Array;
  diffGB: Uint8Array;
}

function extractChannels(
  rgba: Uint8ClampedArray,
  numPixels: number,
): ChannelSet {
  const luma = new Uint8Array(numPixels);
  const red = new Uint8Array(numPixels);
  const green = new Uint8Array(numPixels);
  const blue = new Uint8Array(numPixels);
  const diffRG = new Uint8Array(numPixels);
  const diffRB = new Uint8Array(numPixels);
  const diffGB = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    luma[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    red[i] = r;
    green[i] = g;
    blue[i] = b;
    diffRG[i] = Math.abs(r - g);
    diffRB[i] = Math.abs(r - b);
    diffGB[i] = Math.abs(g - b);
  }

  return { luma, red, green, blue, diffRG, diffRB, diffGB };
}

// ── Step 3: Channel selection by contrast score ────────────────────

function selectBestChannel(channels: ChannelSet): Uint8Array {
  const candidates: Uint8Array[] = [
    channels.luma,
    channels.red,
    channels.green,
    channels.blue,
    channels.diffRG,
    channels.diffRB,
    channels.diffGB,
  ];

  let best = channels.luma;
  let bestScore = -1;

  for (let c = 0; c < candidates.length; c++) {
    const score = contrastScore(candidates[c]);
    if (score > bestScore) {
      bestScore = score;
      best = candidates[c];
    }
  }

  return best;
}

/**
 * Measure how much contrast a grayscale channel has between
 * text and background. Uses Otsu's inter-class variance normalised
 * by total variance. Higher = cleaner separation.
 */
function contrastScore(gray: Uint8Array): number {
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

function percentileStretch(gray: Uint8Array): Uint8Array {
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
  const output = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = ((gray[i] - lowVal) / range) * 255;
    output[i] = Math.max(0, Math.min(255, Math.round(val)));
  }
  return output;
}

// ── Step 5: CLAHE (Contrast Limited Adaptive Histogram Equalization)

/**
 * CLAHE enhances local contrast while preventing over-amplification.
 * Unlike global histogram equalization, it works on small tiles and
 * interpolates between them for smooth results.
 *
 * This preserves grayscale gradients that Tesseract's LSTM needs,
 * while making text more legible against varied backgrounds.
 */
function clahe(gray: Uint8Array, w: number, h: number): Uint8Array {
  const tilesX = CLAHE_TILE_SIZE;
  const tilesY = CLAHE_TILE_SIZE;
  const tileW = Math.ceil(w / tilesX);
  const tileH = Math.ceil(h / tilesY);
  const clipLimit = Math.max(
    1,
    Math.round(CLAHE_CLIP_LIMIT * ((tileW * tileH) / 256)),
  );

  // 1. Build lookup tables for each tile
  const luts: Uint8Array[][] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    luts[ty] = [];
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, w);
      const y1 = Math.min(y0 + tileH, h);

      // Build histogram for this tile
      const hist = new Uint32Array(256);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[gray[y * w + x]]++;
          count++;
        }
      }

      // Clip histogram and redistribute
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipLimit) {
          excess += hist[i] - clipLimit;
          hist[i] = clipLimit;
        }
      }
      const avgExcess = Math.floor(excess / 256);
      const remainder = excess - avgExcess * 256;
      for (let i = 0; i < 256; i++) {
        hist[i] += avgExcess;
      }
      // Distribute remainder evenly across bins
      const step = Math.max(1, Math.floor(256 / (remainder + 1)));
      for (let i = 0; i < remainder; i++) {
        hist[(i * step) % 256]++;
      }

      // Build CDF lookup table
      const lut = new Uint8Array(256);
      let cdf = 0;
      const scale = count > 0 ? 255 / count : 0;
      for (let i = 0; i < 256; i++) {
        cdf += hist[i];
        lut[i] = Math.min(255, Math.round(cdf * scale));
      }

      luts[ty][tx] = lut;
    }
  }

  // 2. Interpolate between tile LUTs for each pixel
  const output = new Uint8Array(gray.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = gray[y * w + x];

      // Which tile center is this pixel relative to?
      const txf = (x + 0.5) / tileW - 0.5;
      const tyf = (y + 0.5) / tileH - 0.5;

      const tx0 = Math.max(0, Math.floor(txf));
      const ty0 = Math.max(0, Math.floor(tyf));
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const ty1 = Math.min(tilesY - 1, ty0 + 1);

      const fx = txf - tx0;
      const fy = tyf - ty0;

      // Bilinear interpolation of the 4 surrounding tile LUTs
      const tl = luts[ty0][tx0][val];
      const tr = luts[ty0][tx1][val];
      const bl = luts[ty1][tx0][val];
      const br = luts[ty1][tx1][val];

      const top = tl + (tr - tl) * fx;
      const bot = bl + (br - bl) * fx;
      output[y * w + x] = Math.round(top + (bot - top) * fy);
    }
  }

  return output;
}

// ── Step 6: Write back + export ────────────────────────────────────

function writeGrayscale(gray: Uint8Array, rgba: Uint8ClampedArray) {
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    rgba[idx] = gray[i];
    rgba[idx + 1] = gray[i];
    rgba[idx + 2] = gray[i];
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
