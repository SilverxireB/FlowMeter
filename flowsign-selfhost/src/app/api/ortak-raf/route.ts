/**
 * ORTAK RAF ucu (self-host) — liste / rafa koy / raftan sil.
 *
 * Kararlar SUNUCUDA: panel kapatılıp uca elle istek atılabilir.
 *  - GET    : giriş yeter (ekranını hazırlayan rafta ne var görmeli)
 *  - POST   : giriş yeter — rafa HERKES koyar (kullanıcı kararı)
 *  - DELETE : YALNIZ YÖNETİCİ — silmek başkasının duvarını karartabilir
 *
 * Dosya TAŞINIR (kopyalanmaz): `data/media/{ekran}/x.jpg` → `data/media/_ortak/x.jpg`.
 * Raf ayrı klasörde olduğu için ekran silme (o ekranın klasörünü kaldırır) rafa
 * yapısal olarak ulaşamaz.
 */
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { MEDIA_DIR, DATA_DIR } from "@/lib/store";
import { medyaDosyaAdi, ORTAK_KLASOR, raftaMi, RafOgesi } from "@/lib/ortakRaf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RAF_DOSYA = path.join(DATA_DIR, "ortak-raf.json");
const RAF_DIZIN = path.join(MEDIA_DIR, ORTAK_KLASOR);

async function oku(): Promise<RafOgesi[]> {
  try {
    return JSON.parse(await fs.readFile(RAF_DOSYA, "utf8")) as RafOgesi[];
  } catch {
    return [];
  }
}

async function yaz(liste: RafOgesi[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const gecici = `${RAF_DOSYA}.${process.pid}.tmp`;
  await fs.writeFile(gecici, JSON.stringify(liste, null, 2), "utf8");
  await fs.rename(gecici, RAF_DOSYA);
}

export async function GET(req: NextRequest) {
  if (!(await currentUser(req))) return unauthorized();
  return NextResponse.json({ raf: await oku() });
}

/** Rafa koy — dosya TAŞINIR, sonra kayıt yazılır. */
export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as {
    src?: string;
    kind?: string;
    name?: string;
    fromWall?: string;
  };
  const src = String(b.src ?? "");
  if (!src.startsWith("/media/")) return NextResponse.json({ error: "Geçersiz adres" }, { status: 400 });
  if (raftaMi(src)) return NextResponse.json({ error: "Bu dosya zaten ortak rafta." }, { status: 409 });

  // Dosya adı SUNUCUDA türetilir; istemciden gelen yola güvenilmez ("..%2f.."
  // ile klasör dışına çıkma denemesi böyle kesilir).
  const dosya = medyaDosyaAdi(src);
  if (!dosya || dosya.includes("..") || dosya.includes("/") || dosya.includes("\\")) {
    return NextResponse.json({ error: "Geçersiz dosya adı" }, { status: 400 });
  }
  const kaynakEkran = src.split("/")[2] ?? "";
  if (!kaynakEkran || kaynakEkran.includes("..")) return NextResponse.json({ error: "Geçersiz adres" }, { status: 400 });

  const kaynak = path.join(MEDIA_DIR, kaynakEkran, dosya);
  await fs.mkdir(RAF_DIZIN, { recursive: true });
  // Aynı adlı dosya rafta varsa öncekini EZMEZ — zaman damgası ekler.
  let hedefAd = dosya;
  try {
    await fs.access(path.join(RAF_DIZIN, hedefAd));
    hedefAd = `${Date.now().toString(36)}_${dosya}`;
  } catch {}
  try {
    await fs.rename(kaynak, path.join(RAF_DIZIN, hedefAd));
  } catch {
    return NextResponse.json({ error: "Dosya taşınamadı" }, { status: 500 });
  }

  const yeni: RafOgesi = {
    id: `raf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind: b.kind === "video" ? "video" : "image",
    src: `/media/${ORTAK_KLASOR}/${hedefAd}`,
    name: String(b.name ?? "").slice(0, 120) || dosya,
    // Denetim izine GİRİŞ ADI yazılır, kimlik değil.
    by: me.name,
    at: Date.now(),
    fromWall: String(b.fromWall ?? "").slice(0, 120) || undefined,
  };
  await yaz([yeni, ...(await oku())]);
  return NextResponse.json({ ok: true, oge: yeni });
}

/** Raftan KALICI sil — YALNIZ YÖNETİCİ. */
export async function DELETE(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const liste = await oku();
  const oge = liste.find((o) => o.id === id);
  if (!oge) return NextResponse.json({ error: "Kayıt yok" }, { status: 404 });
  // Yalnız RAF klasöründeki dosya silinebilir — bu satır olmasaydı bozuk bir
  // kayıt bu uçtan herhangi bir ekranın medyasını sildirebilirdi.
  if (!raftaMi(oge.src)) return NextResponse.json({ error: "Raf dışı" }, { status: 400 });
  await fs.rm(path.join(RAF_DIZIN, medyaDosyaAdi(oge.src)), { force: true });
  await yaz(liste.filter((o) => o.id !== id));
  return NextResponse.json({ ok: true });
}
