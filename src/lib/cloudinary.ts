/**
 * FlowWall medya deposu — Cloudinary (yalnız dosya byte'ları + görüntü boru hattı).
 * İmzasız (unsigned) yükleme: sadece cloud name + upload preset gerekir, backend yok.
 * Env: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.
 * (Kural 4 istisnası: yalnız FlowWall; FlowMeter'a sıçramaz — bkz. docs/FLOWWALL.md.)
 */
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD && PRESET);
}

/** Teşhis: hangi değişken build'e girmiş? (değerleri sızdırmaz, sadece var/yok) */
export function cloudinaryStatus(): { cloud: boolean; preset: boolean } {
  return { cloud: Boolean(CLOUD), preset: Boolean(PRESET) };
}

export interface UploadResult {
  cloudinaryId: string;
  url: string;
  type: "image" | "video";
  w?: number;
  h?: number;
  durationMs?: number;
}

/** Kalıcı (yeniden denemesi anlamsız) yükleme hatası — ör. 4xx, geçersiz preset. */
class PermanentUploadError extends Error {}

/**
 * Görseli yüklemeden ÖNCE tarayıcıda küçültür (max kenar ~1920px, JPEG).
 * ÖNEMLİ: Bu Cloudinary DEPOLAMASINI düşürür — teslimat q_auto/f_auto orijinali
 * küçültmez, tam çözünürlük saklanır. Sıkıştırma başarısızsa/küçülmezse orijinali
 * gönderir (yükleme asla bozulmaz). GIF ve video dokunulmaz.
 */
async function compressImageForUpload(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file; // küçülmediyse orijinali gönder
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/**
 * Etkinlik çerçevesi: fotonun ÜSTÜNE şeffaf PNG bindirilir — misafir karesi
 * markalı iner (ZIP/galeri indirmeleri dahil; Cloudinary dönüşümü değil,
 * yükleme ÖNCESİ compose → kredi yemez). Çerçeve foto boyutuna STRETCH edilir;
 * herhangi bir hata olursa çerçevesiz devam edilir (yükleme asla bozulmaz).
 * Yalnız görselde (GIF/video dokunulmaz).
 */
async function applyFrame(file: File, frameUrl: string): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const [bitmap, frame] = await Promise.all([
      createImageBitmap(file),
      new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("frame-load"));
        img.src = frameUrl;
      }),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0);
    ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Tek yükleme denemesi (XHR + canlı ilerleme). 4xx → PermanentUploadError. */
function attemptUpload(file: File, folder: string, onProgress: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`;
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", PRESET as string);
    if (folder) form.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const r = JSON.parse(xhr.responseText);
          resolve({
            cloudinaryId: r.public_id,
            url: r.secure_url,
            type: r.resource_type === "video" ? "video" : "image",
            w: r.width,
            h: r.height,
            durationMs: r.duration ? Math.round(r.duration * 1000) : undefined,
          });
        } catch {
          reject(new Error("Cloudinary yanıtı okunamadı."));
        }
      } else if (xhr.status >= 400 && xhr.status < 500) {
        // Kalıcı hata (geçersiz preset, dosya reddi…) — tekrar deneme boşuna.
        // Cloudinary sebebi gövdede JSON olarak söylüyor; eskiden yalnız durum
        // kodu gösteriliyordu ve "Yükleme reddedildi (400)" hiçbir şey
        // anlatmıyordu: preset mi kapalı, klasör mü yasak, dosya mı büyük —
        // hepsi aynı cümleye çıkıyordu. Sebebi bilinen hata düzeltilebilir.
        let sebep = "";
        try {
          sebep = JSON.parse(xhr.responseText)?.error?.message ?? "";
        } catch {}
        reject(
          new PermanentUploadError(
            sebep ? `Yükleme reddedildi: ${sebep}` : `Yükleme reddedildi (${xhr.status}).`
          )
        );
      } else {
        reject(new Error("Yükleme başarısız (" + xhr.status + ")."));
      }
    };
    xhr.onerror = () => reject(new Error("Ağ hatası — yükleme tamamlanamadı."));
    xhr.send(form);
  });
}

/**
 * Dosyayı Cloudinary'ye yükler; onProgress(0-100) canlı ilerleme verir.
 * Görseli önce ~1920px'e sıkıştırır (depolama tasarrufu). Geçici ağ/5xx
 * hatalarında üstel bekleyişle (2s, 4s) 3 kez dener; 4xx'te hemen vazgeçer.
 */
export async function uploadToCloudinary(
  file: File,
  folder: string,
  onProgress: (pct: number) => void,
  opts?: { keepOriginal?: boolean; frameUrl?: string }
): Promise<UploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary yapılandırılmadı. NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ve NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET değişkenlerini ekleyin."
    );
  }
  // Önce çerçeve (orijinal çözünürlükte), sonra gerekiyorsa küçültme.
  let toSend = opts?.frameUrl ? await applyFrame(file, opts.frameUrl) : file;
  // Duvar ayarı "orijinali sakla" ise küçültme atlanır (tam çözünürlük yüklenir).
  toSend = opts?.keepOriginal ? toSend : await compressImageForUpload(toSend);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      onProgress(0);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1))); // 2s, 4s
    }
    try {
      return await attemptUpload(toSend, folder, onProgress);
    } catch (e) {
      lastErr = e;
      if (e instanceof PermanentUploadError) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Yükleme başarısız.");
}

/** Gerçek Cloudinary URL'si mi? (Cloudinary-dışı test/örnek URL'lere dokunma.) */
function isCld(url: string): boolean {
  return url.includes("res.cloudinary.com") && url.includes("/upload/");
}

/** secure_url'e Cloudinary dönüşümü ekler (thumbnail — kare doldur). */
export function cldThumb(url: string, w = 480, h = 480): string {
  return isCld(url) ? url.replace("/upload/", `/upload/c_fill,g_auto,w_${w},h_${h},q_auto,f_auto/`) : url;
}

/** Büyük sahne için sığdırılmış sürüm (en/boy korunur). */
export function cldFit(url: string, w = 1400): string {
  return isCld(url) ? url.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`) : url;
}

/** Video için poster kare (ilk kare, jpg). Cloudinary değilse "" → çağıran <video>'ya düşer. */
export function cldVideoPoster(url: string, w = 480, h = 480): string {
  if (!isCld(url)) return "";
  return url
    .replace("/upload/", `/upload/c_fill,g_auto,w_${w},h_${h},q_auto,so_0/`)
    .replace(/\.(mp4|mov|webm|m4v)$/i, ".jpg");
}
