'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { startCamera, stopCamera, captureFrame } from '../lib/camera';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<
    'prompt' | 'granted' | 'denied' | 'loading'
  >('loading');
  const [isReady, setIsReady] = useState(false);

  const initCamera = useCallback(async () => {
    try {
      const stream = await startCamera();
      streamRef.current = stream;
      setPermissionState('granted');

      // Handle iOS stream ending when app goes to background
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener('ended', () => {
          setIsReady(false);
          streamRef.current = null;
        });
      }
    } catch (err) {
      const error = err as DOMException;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionState('denied');
      } else {
        setPermissionState('prompt');
      }
      setIsReady(false);
    }
  }, []);

  // Attach stream to video element AFTER it renders (fixes race condition
  // where stream is obtained before <video> is in the DOM)
  useEffect(() => {
    if (permissionState === 'granted' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play()
        .then(() => setIsReady(true))
        .catch(() => setIsReady(false));
    }
  }, [permissionState]);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      stopCamera(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  const capture = useCallback(async (): Promise<Blob> => {
    if (!videoRef.current) {
      throw new Error('Camera not ready');
    }
    return captureFrame(videoRef.current);
  }, []);

  // Handle iOS PWA background resume
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !streamRef.current?.active) {
        initCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup();
    };
  }, [initCamera, cleanup]);

  return { videoRef, permissionState, isReady, capture, initCamera };
}
