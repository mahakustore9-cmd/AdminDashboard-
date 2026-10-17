// ==============================================================================
// MAHAKU CORPORATION PVT. LTD. - STUDENT SAFETY TRACKING SYSTEM
// Photo Compression & Validation Engine (Strict 50 KB Limit)
// ==============================================================================

export const MAX_PHOTO_BYTES = 50 * 1024; // 51,200 bytes (50 KB)
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CompressionResult {
  blob: Blob;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  previewUrl: string;
}

/**
 * Compresses an image file to ensure it does not exceed the strict 50 KB limit.
 * Iteratively rescales and tunes compression quality.
 */
export async function compressStudentPhoto(file: File): Promise<CompressionResult> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Unsupported format. Please upload a JPEG, PNG, or WebP image.');
  }

  // Load image into an HTMLImageElement
  const img = await loadImage(file);

  // We optimize dimensions for standard school ID cards: target max 400x480 (plenty for high-DPI print)
  let targetWidth = img.width;
  let targetHeight = img.height;
  const maxDimension = 480;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    const ratio = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
    targetWidth = Math.round(targetWidth * ratio);
    targetHeight = Math.round(targetHeight * ratio);
  }

  // Determine best format (WebP if browser supports canvas export to webp, else JPEG)
  const format = supportsWebPExport() ? 'image/webp' : 'image/jpeg';

  // Iterative compression steps
  const qualitySteps = [0.82, 0.70, 0.58, 0.45, 0.35, 0.25];

  for (const quality of qualitySteps) {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to initialize 2D canvas for photo compression.');
    }

    // Fill white background in case source is transparent PNG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, quality);
    });

    if (blob && blob.size <= MAX_PHOTO_BYTES) {
      return {
        blob,
        sizeBytes: blob.size,
        mimeType: format,
        width: targetWidth,
        height: targetHeight,
        previewUrl: URL.createObjectURL(blob),
      };
    }

    // If still over 50 KB, reduce dimensions by 15% for next loop
    targetWidth = Math.round(targetWidth * 0.85);
    targetHeight = Math.round(targetHeight * 0.85);
  }

  // Final emergency attempt with small portrait dimensions (240x300)
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = 240;
  finalCanvas.height = 300;
  const finalCtx = finalCanvas.getContext('2d');
  if (finalCtx) {
    finalCtx.fillStyle = '#FFFFFF';
    finalCtx.fillRect(0, 0, 240, 300);
    finalCtx.drawImage(img, 0, 0, 240, 300);
    const finalBlob = await new Promise<Blob | null>((resolve) => {
      finalCanvas.toBlob(resolve, 'image/jpeg', 0.3);
    });

    if (finalBlob && finalBlob.size <= MAX_PHOTO_BYTES) {
      return {
        blob: finalBlob,
        sizeBytes: finalBlob.size,
        mimeType: 'image/jpeg',
        width: 240,
        height: 300,
        previewUrl: URL.createObjectURL(finalBlob),
      };
    }
  }

  throw new Error(`Unable to compress image below the strict 50 KB limit. File was too large. Please select a closer crop.`);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to parse uploaded image file.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.readAsDataURL(file);
  });
}

function supportsWebPExport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}
