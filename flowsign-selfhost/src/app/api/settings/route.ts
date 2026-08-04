/**
 * Uygulama ayarları ucu. OKUMA giriş yapmış herkese açık (kurum adı gibi
 * değerleri kokpit çiziyor); YAZMA yalnız yöneticiye. Kararlar SUNUCUDA —
 * panel kapatılıp uca elle istek atılabilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { ayarTablosu, ayarYaz } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  return NextResponse.json({ ayarlar: await ayarTablosu() });
}

export async function PUT(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const b = (await req.json().catch(() => ({}))) as { anahtar?: string; deger?: string };
  try {
    // Denetim izine GİRİŞ ADI yazılır, kimlik değil: paneli okuyan insan
    // "u-3f9a" değil "ayse" görmeli.
    await ayarYaz(String(b.anahtar ?? ""), String(b.deger ?? ""), me.name);
    return NextResponse.json({ ok: true, ayarlar: await ayarTablosu() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kaydedilemedi" }, { status: 400 });
  }
}
