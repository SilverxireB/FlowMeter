/**
 * Görseli tarayıcıda küçültüp sıkıştırarak data-URI'ye çevirir.
 * Firestore doküman limiti (1MB) için maxBytes'a sığana kadar kaliteyi düşürür.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim: number,
  maxBytes: number
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas desteklenmiyor.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // PNG şeffaflığı önemliyse (logo) önce PNG dene, sığmazsa JPEG'e düş
  if (file.type === "image/png") {
    const png = canvas.toDataURL("image/png");
    if (png.length <= maxBytes) return png;
  }
  for (const q of [0.8, 0.65, 0.5, 0.35]) {
    const jpeg = canvas.toDataURL("image/jpeg", q);
    if (jpeg.length <= maxBytes) return jpeg;
  }
  throw new Error("Görsel çok büyük — daha küçük bir görsel deneyin.");
}

/** Kolaylık sarmalayıcı: dosyayı verilen boyuta sıkıştırıp data-URI döner. */
export async function compressImage(
  file: File,
  maxDim = 1600,
  _quality?: number, // ileride özel kalite; şu an Firestore limitine otomatik sığdırılır
  maxBytes = 900_000
): Promise<string> {
  return fileToCompressedDataUrl(file, maxDim, maxBytes);
}
