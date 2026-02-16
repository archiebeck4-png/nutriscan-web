'use client';

import { useState, useEffect, useCallback } from 'react';
import { recognizeImage, preloadOcr, setOcrProgressCallback } from '../lib/ocr';

export function useOcr() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    setOcrProgressCallback((status, prog) => {
      setProgress(`${status} (${Math.round(prog * 100)}%)`);
    });

    preloadOcr().then(() => {
      setIsReady(true);
      setProgress('');
    });

    return () => {
      setOcrProgressCallback(null);
    };
  }, []);

  const recognize = useCallback(async (image: Blob): Promise<string[]> => {
    setIsProcessing(true);
    try {
      return await recognizeImage(image);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { recognize, isProcessing, isReady, progress };
}
