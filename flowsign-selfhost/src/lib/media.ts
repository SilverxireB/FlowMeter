"use client";

/**
 * FlowSign self-host — İSTEMCİ medya yardımcıları. Cloudinary YOK: dosyalar
 * sunucu diskine yüklenir (/api/upload), yerel /media/... yoluyla servis edilir.
 * Dönüştürme/küçültme yapılmaz — README'deki kural: "MP4 (H.264) yükleyin,
 * görseli alanın hedef çözünürlüğünde hazırlayın".
 */

export interface UploadResult {
  url: string; // /media/{wallId}/{dosya}
  type: "image" | "video";
}

/** İlerleme yüzdesiyle yükleme (XMLHttpRequest — fetch upload progress vermiyor). */
export function uploadMedia(file: File, wallId: string, onProgress?: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload?wall=${encodeURIComponent(wallId)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(d as UploadResult);
        else reject(new Error(d.error ?? `yükleme hatası (${xhr.status})`));
      } catch {
        reject(new Error(`yükleme hatası (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("sunucuya ulaşılamadı"));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Cloudinary boyutlandırma karşılığı YOK — yerel dosya olduğu gibi döner. */
export const fit = (src: string) => src;
