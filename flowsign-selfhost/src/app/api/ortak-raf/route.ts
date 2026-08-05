/**
 * ORTAK RAF — tüm ekranların ortak medya havuzu (`data/media/ortak/`).
 *
 * MİMARİ KURAL: raf, ekran klasörlerinden YAPISAL olarak ayrıdır. Ekran silme
 * `data/media/{id}/` klasörünü siler — rafa değemez bile. "Rafa koy" TAŞIMA
 * DEĞİL KOPYADIR: orijinal ekranda aynen kalır, hiçbir adres değişmez.
 *
 * LİSTE = SUNUCU GERÇEĞİ: kayıt dosyası yok, klasörün kendisi listelenir
 * (readdir) — kayıt/dosya ayrışması diye bir hata sınıfı doğamaz.
 *
 * Yetki: listeleme + ekleme + rafa koyma = giriş yapmış herkes;
 * silme = YALNIZ yönetici.
 */
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { MEDIA_DIR } from "@/lib/store";
import { ayarSayi } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RAF_DIR = path.join(MEDIA_DIR, "ortak");

const IMG_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp"]);
const VID_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "ogv"]);

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
      .slice(0, 60) || "dosya";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  return { base, ext };
}

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  await fs.mkdir(RAF_DIR, { recursive: true });
  const adlar = (await fs.readdir(RAF_DIR)).filter((f) => !f.startsWith("."));
  const dosyalar = (
    await Promise.all(
      adlar.map(async (f) => {
        const ext = path.extname(f).slice(1).toLowerCase();
        const kind = VID_EXT.has(ext) ? "video" : IMG_EXT.has(ext) ? "image" : null;
        if (!kind) return null;
        const stat = await fs.stat(path.join(RAF_DIR, f)).catch(() => null);
        return {
          kind,
          src: `/media/ortak/${f}`,
          name: f.replace(/\.[^.]+$/, ""),
          publicId: f,
          at: stat?.mtimeMs,
        };
      })
    )
  ).filter(Boolean) as { kind: "image" | "video"; src: string; name: string; publicId: string; at?: number }[];
  dosyalar.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return NextResponse.json({ ok: true, dosyalar });
}

/** Cihazdan doğrudan rafa yükleme (giriş yapmış herkes). */
export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
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
  await fs.mkdir(RAF_DIR, { recursive: true });
  await fs.writeFile(path.join(RAF_DIR, fname), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, src: `/media/ortak/${fname}` });
}

/** Ekranın dosyasını rafa KOPYALA (taşıma değil — orijinal yerinde kalır). */
export async function PUT(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  let src = "";
  try {
    src = (await req.json())?.src ?? "";
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  // Yalnız kendi medya deposundaki dosya kopyalanır; yol traversal'a kapalı.
  const m = /^\/media\/([a-z0-9-]{1,64})\/([^/]+)$/i.exec(src);
  if (!m) return NextResponse.json({ error: "Geçersiz kaynak" }, { status: 400 });
  const kaynak = path.join(MEDIA_DIR, m[1], path.basename(m[2]));
  const stat = await fs.stat(kaynak).catch(() => null);
  if (!stat?.isFile()) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
  await fs.mkdir(RAF_DIR, { recursive: true });
  let hedefAd = path.basename(m[2]);
  // Ad çakışırsa yeni zaman damgasıyla yaz — var olan raf dosyası asla ezilmez.
  const hedefVar = await fs.stat(path.join(RAF_DIR, hedefAd)).then((s) => s.isFile()).catch(() => false);
  if (hedefVar) hedefAd = `${Date.now().toString(36)}_${hedefAd}`;
  await fs.copyFile(kaynak, path.join(RAF_DIR, hedefAd));
  return NextResponse.json({ ok: true, src: `/media/ortak/${hedefAd}` });
}

/** Raftan sil — YALNIZ yönetici. */
export async function DELETE(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const dosya = path.basename(req.nextUrl.searchParams.get("dosya") ?? "");
  if (!dosya) return NextResponse.json({ error: "missing-params" }, { status: 400 });
  await fs.rm(path.join(RAF_DIR, dosya), { force: true });
  return NextResponse.json({ ok: true });
}
