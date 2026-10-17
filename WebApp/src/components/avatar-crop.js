export const AVATAR_CROP_VIEWPORT = 280;
export const AVATAR_OUTPUT_SIZE = 512;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function calculateCropFrame({
  imageWidth,
  imageHeight,
  viewportSize = AVATAR_CROP_VIEWPORT,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  if (![imageWidth, imageHeight, viewportSize].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Image and crop dimensions must be positive numbers');
  }

  const normalizedZoom = clamp(Number(zoom) || 1, 1, 3);
  const scale = Math.max(viewportSize / imageWidth, viewportSize / imageHeight) * normalizedZoom;
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const maxOffsetX = Math.max(0, (width - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (height - viewportSize) / 2);
  const safeOffsetX = clamp(Number(offsetX) || 0, -maxOffsetX, maxOffsetX);
  const safeOffsetY = clamp(Number(offsetY) || 0, -maxOffsetY, maxOffsetY);

  return {
    width,
    height,
    left: (viewportSize - width) / 2 + safeOffsetX,
    top: (viewportSize - height) / 2 + safeOffsetY,
  };
}

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, cleanup: () => bitmap.close?.() };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('อ่านไฟล์ภาพไม่สำเร็จ'));
      element.src = objectUrl;
    });
    return { image, cleanup: () => URL.revokeObjectURL(objectUrl) };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function cropAvatarFile(file, crop = {}) {
  const { image, cleanup } = await loadImage(file);
  try {
    const frame = calculateCropFrame({
      imageWidth: image.width || image.naturalWidth,
      imageHeight: image.height || image.naturalHeight,
      ...crop,
    });
    const viewportSize = crop.viewportSize || AVATAR_CROP_VIEWPORT;
    const outputScale = AVATAR_OUTPUT_SIZE / viewportSize;
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการครอปรูปภาพ');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      image,
      frame.left * outputScale,
      frame.top * outputScale,
      frame.width * outputScale,
      frame.height * outputScale,
    );

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
    if (!blob) throw new Error('สร้างภาพที่ครอปแล้วไม่สำเร็จ');
    const extension = blob.type === 'image/png' ? 'png' : 'webp';
    return new File([blob], `synapsesync-avatar.${extension}`, { type: blob.type, lastModified: Date.now() });
  } finally {
    cleanup();
  }
}
