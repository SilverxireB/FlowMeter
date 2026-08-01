import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, isOwner, unauthorized } from "@/lib/serverAuth";
import { getWall, setWallEditors, transferWall } from "@/lib/store";
import { getUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ekran yetkisi — YALNIZ SAHİP (ve yönetici) değiştirir.
 *  { action: "add"|"remove", userId }  → yetkili ekle / geri al
 *  { action: "transfer", userId, keepAsEditor } → DEVRET ("al bu senin olsun")
 * Devir yayın linkini/slug'ı DEĞİŞTİRMEZ — sahadaki ekranlar kararmaz.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const wall = await getWall(params.id);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  if (!isOwner(wall, me)) return forbidden();

  const b = (await req.json().catch(() => ({}))) as { action?: string; userId?: string; keepAsEditor?: boolean };
  const target = b.userId ? await getUser(b.userId) : null;
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 400 });

  const editors = wall.editorIds ?? [];
  if (b.action === "add") {
    if (target.id === wall.ownerId) return NextResponse.json({ error: "Bu kişi zaten sahibi." }, { status: 400 });
    await setWallEditors(params.id, [...editors, target.id]);
  } else if (b.action === "remove") {
    await setWallEditors(params.id, editors.filter((e) => e !== target.id));
  } else if (b.action === "transfer") {
    await transferWall(params.id, target.id, wall.ownerId ?? me.id, b.keepAsEditor !== false);
  } else {
    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
