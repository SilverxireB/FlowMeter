import { NextRequest, NextResponse } from "next/server";
import { canDelete, canEdit, currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { deleteWall, getWall, patchWall } from "@/lib/store";
import { Videowall } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const wall = await getWall(params.id);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  return NextResponse.json(wall);
}

/** İçerik/yerleşim yazımı: SAHİP ya da YETKİLİ (yetki alanları patch'le değişmez). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const cur = await getWall(params.id);
  if (!cur) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  if (!canEdit(cur, me)) return forbidden();
  const patch = (await req.json().catch(() => null)) as Partial<Videowall> | null;
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  await patchWall(params.id, patch);
  return NextResponse.json({ ok: true });
}

/** Silme: matriste "Sil" tiki olan kişi (yoksa ekranı oluşturan / yönetici). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const cur = await getWall(params.id);
  if (!cur) return NextResponse.json({ ok: true });
  if (!canDelete(cur, me)) return forbidden();
  await deleteWall(params.id);
  return NextResponse.json({ ok: true });
}
