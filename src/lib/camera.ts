export async function startCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 2560 },
      height: { ideal: 1920 },
    },
    audio: false,
  });
  return stream;
}

export function stopCamera(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

export function captureFrame(
  video: HTMLVideoElement,
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to capture frame'));
      },
      'image/jpeg',
      quality
    );
  });
}
