import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { canEdit, currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { addWallMedya, getWall, MEDIA_DIR, removeWallMedya } from "@/lib/store";
import { ayarSayi } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sınırlar artık AYARDAN geliyor (Uygulama ayarları → görsel/video boyut
// sınırı). Kodda sabit kalsaydı iç ağda 2 GB'lık tanıtım filmi yükleyebilmek
// için yeni sürüm gerekirdi. Otorite SUNUCUDA: panel kapatılıp uca elle istek
// atılabilir.

/**
 * Dosya adı GÜVENLİ hale getirilir: boşluk ve Türkçe/özel karakterler alt
 * çizgiye çevrilir — "Yaz Kampanyası Afişi.PNG" → "yaz_kampanyasi_afisi.png".
 * (Boşluklu/karakterli adlar URL'de kırılıp "dosya gelmiyor" derdi yaratıyordu.)
 * Başa zaman damgası eklenir → aynı adla ikinci yükleme öncekini ezmez.
 */
function sanitizeName(original: string): { base: string; ext: string } {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  const dot = original.lastIndexOf(".");
  const rawBase = dot > 0 ? original.slice(0, dot) : original;
  const rawExt = dot > 0 ? original.slice(dot + 1) : "";
  const base =
    rawBase
      .replace(/[çğıöşüİÇĞÖŞÜ]/g, (m) => map[m] || m)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "dosya";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return { base, ext };
}

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const wallId = req.nextUrl.searchParams.get("wall") ?? "";
  const wall = await getWall(wallId);
  // Medya HEDEF EKRANIN klasörüne yazılır → yükleme de o ekranın yetkisine bağlı
  // (yoksa yetkisiz kişi başkasının ekranına dosya bırakabilirdi).
  if (wall && !canEdit(wall, me)) return forbidden();
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return NextResponse.json({ error: "Yalnız görsel/video yüklenebilir" }, { status: 400 });
  const mb = file.size / (1024 * 1024);
  const maxGorsel = await ayarSayi("maxGorselMB");
  const maxVideo = await ayarSayi("maxVideoMB");
  if (isImage && mb > maxGorsel) return NextResponse.json({ error: `görsel için sınır ~${maxGorsel} MB` }, { status: 400 });
  if (isVideo && mb > maxVideo) return NextResponse.json({ error: `video için sınır ~${maxVideo} MB` }, { status: 400 });

  const { base, ext } = sanitizeName(file.name || "dosya");
  const fname = `${Date.now().toString(36)}_${base}.${ext}`;
  const dir = path.join(MEDIA_DIR, wall.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fname), Buffer.from(await file.arrayBuffer()));

  // Yükleme KÜTÜPHANEYE kaydedilir (ekranın medya[] listesi) — SUNUCUDA, dosya
  // yazımıyla aynı istekte: istemci unutamaz, dosya ile kayıt ayrışamaz.
  const kayit = {
    id: `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind: (isImage ? "image" : "video") as "image" | "video",
    src: `/media/${wall.id}/${fname}`,
    name: file.name || fname,
    at: Date.now(),
    by: me.label || me.name,
  };
  await addWallMedya(wall.id, kayit);

  return NextResponse.json({ url: kayit.src, type: kayit.kind, kayit });
}

/** Kütüphaneden dosya sil (kayıt + disk). Kullanımdaki dosya reddedilir. */
export async function DELETE(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const wallId = req.nextUrl.searchParams.get("wall") ?? "";
  const medyaId = req.nextUrl.searchParams.get("medya") ?? "";
  const wall = await getWall(wallId);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  if (!canEdit(wall, me)) return forbidden();
  const r = await removeWallMedya(wallId, medyaId);
  if (!r.ok) {
    return r.error === "in-use"
      ? NextResponse.json({ error: "Dosya bir alanda kullanılıyor — önce alandan çıkar" }, { status: 409 })
      : NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
