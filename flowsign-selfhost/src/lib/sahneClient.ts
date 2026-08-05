"use client";

/**
 * FOTO SAHNE — İSTEMCİ yardımcıları (self-host). Online karşılığı
 * `lib/sahneler.ts` (Firestore); burada REST + SSE.
 */
import { FotoSahneKaydi, SahneFoto } from "./fotoSahne";

async function j<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `sunucu ${r.status}`);
  return d as T;
}

/** Tüm sahneler — "Foto sahneler" bölümü. */
export async function listSahneler(): Promise<FotoSahneKaydi[]> {
  const d = await j<{ sahneler: FotoSahneKaydi[] }>(await fetch("/api/sahne", { cache: "no-store" }));
  return d.sahneler ?? [];
}

export async function createSahne(name: string): Promise<FotoSahneKaydi> {
  const d = await j<{ sahne: FotoSahneKaydi }>(
    await fetch("/api/sahne", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
  );
  return d.sahne;
}

export async function updateSahne(id: string, patch: Partial<FotoSahneKaydi>): Promise<void> {
  await j(await fetch("/api/sahne", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, patch }) }));
}

export async function deleteSahne(id: string): Promise<void> {
  await j(await fetch(`/api/sahne?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
}

/** İlerleme yüzdesiyle fotoğraf yükleme; kayıt SUNUCUDA eklenir. */
export function uploadSahneFoto(id: string, file: File, onProgress?: (pct: number) => void): Promise<SahneFoto> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/sahne/upload?id=${encodeURIComponent(id)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && d.ok) resolve(d.foto as SahneFoto);
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

/** Sahneyi canlı izle (SSE — public; perde ve yönetim aynı kanalı dinler). */
export function watchSahne(id: string, cb: (s: FotoSahneKaydi | null) => void): () => void {
  const es = new EventSource(`/api/sahne/${encodeURIComponent(id)}/events`);
  es.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data) as { found?: boolean; sahne?: FotoSahneKaydi | null };
      cb(d.found ? (d.sahne ?? null) : null);
    } catch {}
  };
  return () => es.close();
}
