/**
 * ORTAK RAF istemci yardımcıları — tek kapı /api/sign/ortak-raf.
 * Liste SUNUCU GERÇEĞİDİR (Cloudinary'nin kendisi listelenir, kayıt tutulmaz);
 * "rafa koy" KOPYADIR (orijinal ekranda kalır, hiçbir adres değişmez).
 */
import { auth } from "./firebase";

export interface RafDosyasi {
  kind: "image" | "video";
  src: string;
  name: string;
  publicId: string;
  at?: number;
}

async function rafIstek(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const idToken = await auth().currentUser?.getIdToken();
  if (!idToken) throw new Error("oturum bulunamadı");
  const r = await fetch("/api/sign/ortak-raf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, idToken }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.message || j.error || `sunucu ${r.status}`);
  return j;
}

export async function rafListesi(): Promise<RafDosyasi[]> {
  const j = await rafIstek({ op: "list" });
  return (j.dosyalar as RafDosyasi[]) ?? [];
}

/** Ekranın dosyasını rafa KOPYALAR (taşımaz). */
export async function rafaKoy(src: string): Promise<void> {
  await rafIstek({ op: "koy", src });
}

/** Yalnız yönetici; sunucu dosyanın gerçekten rafta olduğunu doğrular. */
export async function raftanSil(dosya: RafDosyasi): Promise<void> {
  await rafIstek({ op: "sil", publicId: dosya.publicId, resourceType: dosya.kind });
}
