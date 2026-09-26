/**
 * Scales an image down to fit `maxSide` pixels and returns it as a PNG data
 * URL. School logos are stored inline (report-card PDFs embed them), so a
 * 2 MB photo straight from a phone would ride along on every page that reads
 * the school profile; at 320 px a logo is a few dozen kilobytes. Browser-only.
 */
export async function shrinkImageToDataUrl(file: File, maxSide = 320): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot process images.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/png');
}
