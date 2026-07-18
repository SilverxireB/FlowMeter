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

export interface UploadResult {
  cloudinaryId: string;
  url: string;
  type: "image" | "video";
  w?: number;
  h?: number;
  durationMs?: number;
}

/** Dosyayı Cloudinary'ye yükler; onProgress(0-100) canlı ilerleme verir. */
export function uploadToCloudinary(
  file: File,
  folder: string,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      reject(
        new Error(
          "Cloudinary yapılandırılmadı. NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ve NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET değişkenlerini ekleyin."
        )
      );
      return;
    }
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
      } else {
        reject(new Error("Yükleme başarısız (" + xhr.status + ")."));
      }
    };
    xhr.onerror = () => reject(new Error("Ağ hatası — yükleme tamamlanamadı."));
    xhr.send(form);
  });
}

/** secure_url'e Cloudinary dönüşümü ekler (thumbnail — kare doldur). */
export function cldThumb(url: string, w = 480, h = 480): string {
  return url.replace("/upload/", `/upload/c_fill,g_auto,w_${w},h_${h},q_auto,f_auto/`);
}

/** Büyük sahne için sığdırılmış sürüm (en/boy korunur). */
export function cldFit(url: string, w = 1400): string {
  return url.replace("/upload/", `/upload/c_limit,w_${w},q_auto,f_auto/`);
}

/** Video için poster kare (ilk kare, jpg). */
export function cldVideoPoster(url: string, w = 480, h = 480): string {
  return url
    .replace("/upload/", `/upload/c_fill,g_auto,w_${w},h_${h},q_auto,so_0/`)
    .replace(/\.(mp4|mov|webm|m4v)$/i, ".jpg");
}
