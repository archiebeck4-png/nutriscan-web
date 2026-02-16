/**
 * Canvas-based image preprocessing pipeline for OCR improvement.
 * Converts image to grayscale, enhances contrast, sharpens, and binarizes
 * to produce clean black text on white background for Tesseract.
 */

/**
 * Preprocess a camera capture blob for better OCR accuracy.
 * Pipeline: grayscale → contrast stretch → sharpen → adaptive threshold (Otsu's)
 * @param blob - The raw camera capture (JPEG/PNG)
 * @returns A preprocessed PNG blob optimized for OCR
 */
export async function preprocessForOcr(blob: Blob): Promise<Blob> {
  const imageBitmap = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  // Draw original image
  ctx.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Step 1: Convert to grayscale
  const gray = new Float32Array(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    // ITU-R BT.601 luma
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
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
  // Simple 3x3 box blur then subtract and amplify
  const w = canvas.width;
  const h = canvas.height;
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

  const sharpAmount = 1.5; // Sharpening strength
  const sharpened = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = gray[i] + sharpAmount * (gray[i] - blurred[i]);
    sharpened[i] = Math.max(0, Math.min(255, val));
  }

  // Step 4: Otsu's threshold for binarization
  const threshold = otsuThreshold(sharpened);

  // Apply threshold: black text on white background
  for (let i = 0; i < sharpened.length; i++) {
    const idx = i * 4;
    const bw = sharpened[i] > threshold ? 255 : 0;
    data[idx] = bw;
    data[idx + 1] = bw;
    data[idx + 2] = bw;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  // Export as PNG (lossless) for OCR
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Failed to export preprocessed image'));
      },
      'image/png'
    );
  });
}

/**
 * Otsu's method for automatic threshold selection.
 * Finds the threshold that minimizes intra-class variance.
 */
function otsuThreshold(gray: Float32Array): number {
  // Build histogram (256 bins)
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

    const variance = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}
