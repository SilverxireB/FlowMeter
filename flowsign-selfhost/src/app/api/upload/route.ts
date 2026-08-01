import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { canEdit, currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { getWall, MEDIA_DIR } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 500;

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
  if (isImage && mb > MAX_IMAGE_MB) return NextResponse.json({ error: `görsel için sınır ~${MAX_IMAGE_MB} MB` }, { status: 400 });
  if (isVideo && mb > MAX_VIDEO_MB) return NextResponse.json({ error: `video için sınır ~${MAX_VIDEO_MB} MB` }, { status: 400 });

  const { base, ext } = sanitizeName(file.name || "dosya");
  const fname = `${Date.now().toString(36)}_${base}.${ext}`;
  const dir = path.join(MEDIA_DIR, wall.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fname), Buffer.from(await file.arrayBuffer()));

  return NextResponse.json({ url: `/media/${wall.id}/${fname}`, type: isImage ? "image" : "video" });
}
