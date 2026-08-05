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

// ── ORTAK RAF — tüm ekranların ortak havuzu (/api/ortak-raf) ────────────────
// Liste SUNUCU GERÇEĞİDİR (klasörün kendisi listelenir); "rafa koy" KOPYADIR.

export interface RafDosyasi {
  kind: "image" | "video";
  src: string;
  name: string;
  publicId: string;
  at?: number;
}

export async function rafListesi(): Promise<RafDosyasi[]> {
  const r = await fetch("/api/ortak-raf", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `sunucu ${r.status}`);
  return j.dosyalar ?? [];
}

/** Cihazdan doğrudan rafa yükleme (ilerleme yüzdesiyle). */
export function uploadRafMedia(file: File, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/ortak-raf");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && d.ok) resolve();
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

/** Ekranın dosyasını rafa KOPYALAR (taşımaz — orijinal yerinde kalır). */
export async function rafaKoy(src: string): Promise<void> {
  const r = await fetch("/api/ortak-raf", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ src }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `sunucu ${r.status}`);
}

/** Yalnız yönetici (karar sunucuda). */
export async function raftanSil(dosya: RafDosyasi): Promise<void> {
  const r = await fetch(`/api/ortak-raf?dosya=${encodeURIComponent(dosya.publicId)}`, { method: "DELETE" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `sunucu ${r.status}`);
}
