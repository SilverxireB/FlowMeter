/**
 * FOTO SAHNE fotoğraf yükleme — dosya `data/media/sahne/{id}/` klasörüne yazılır
 * ve kayıt AYNI istekte sahneye eklenir (istemci unutamaz). Yalnız fotoğraf.
 */
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { addSahneFotoKaydi, getSahne, SAHNE_MEDIA_DIR } from "@/lib/sahneStore";
import { ayarSayi } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** upload rotasındaki güvenli ad kuralının kopyası (boşluk/TR → alt çizgi). */
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
      .slice(0, 60) || "foto";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "jpg";
  return { base, ext };
}

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const sahne = await getSahne(id);
  if (!sahne) return NextResponse.json({ error: "Sahne bulunamadı" }, { status: 404 });
  // Fotoğraf eklemek de düzenlemedir — aynı yetki kapısı.
  if (me.role !== "admin" && sahne.ownerId !== me.name && !(sahne.duzenleyenler ?? []).includes(me.name)) return forbidden();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Sahneye yalnız fotoğraf girer" }, { status: 400 });
  const maxGorsel = await ayarSayi("maxGorselMB");
  if (file.size / (1024 * 1024) > maxGorsel) return NextResponse.json({ error: `görsel için sınır ~${maxGorsel} MB` }, { status: 400 });

  const { base, ext } = sanitizeName(file.name || "foto");
  const fname = `${Date.now().toString(36)}_${base}.${ext}`;
  const dir = path.join(SAHNE_MEDIA_DIR, sahne.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fname), Buffer.from(await file.arrayBuffer()));

  const foto = { src: `/media/sahne/${sahne.id}/${fname}`, at: Date.now() };
  await addSahneFotoKaydi(sahne.id, foto);
  return NextResponse.json({ ok: true, foto });
}
