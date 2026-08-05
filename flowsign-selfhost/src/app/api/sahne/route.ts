/**
 * FOTO SAHNE uçları. Oluşturma + güncelleme giriş yapan HERKESE açık
 * (fabrika içi delegasyon: yönetim linkini verdiğin kişi fotoğrafları yönetir,
 * ekranın yerleşimine dokunamaz); silme YALNIZ sahibi ya da yönetici.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { createSahne, deleteSahne, getSahne, patchSahne } from "@/lib/sahneStore";
import { FotoSahneKaydi } from "@/lib/fotoSahne";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  let name = "";
  try {
    name = (await req.json())?.name ?? "";
  } catch {}
  const sahne = await createSahne(name, me.name);
  return NextResponse.json({ ok: true, sahne });
}

export async function PATCH(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  let body: { id?: string; patch?: Partial<FotoSahneKaydi> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  if (!body.id || !body.patch) return NextResponse.json({ error: "missing-params" }, { status: 400 });
  const sahne = await patchSahne(body.id, body.patch);
  if (!sahne) return NextResponse.json({ error: "Sahne bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true, sahne });
}

export async function DELETE(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const sahne = await getSahne(id);
  if (!sahne) return NextResponse.json({ error: "Sahne bulunamadı" }, { status: 404 });
  if (me.role !== "admin" && sahne.ownerId !== me.name) return forbidden();
  await deleteSahne(id);
  return NextResponse.json({ ok: true });
}
