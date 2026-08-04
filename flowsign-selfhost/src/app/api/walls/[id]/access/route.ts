import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { getWall, setWallGrant } from "@/lib/store";
import { getUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ekran yetkisi — YALNIZ YÖNETİCİ. Tek yönetim yeri "Sign yetkileri" sekmesi
 * olduğundan yetki dağıtma da tek kapıdan geçer.
 *   { userId, perms: {view,edit,copy,delete} }  → kaydı yaz
 *   { userId, perms: null }                     → kaydı kaldır (varsayılana dön)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const wall = await getWall(params.id);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as {
    userId?: string;
    perms?: { view?: boolean; edit?: boolean; copy?: boolean; delete?: boolean } | null;
  };
  const target = b.userId ? await getUser(b.userId) : null;
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 400 });

  // Denetim izine GİRİŞ ADI yazılır, kimlik değil — paneli okuyan insan
  // "u-3f9a" değil "ayse" görmeli.
  await setWallGrant(params.id, target.id, b.perms ?? null, me.name);
  return NextResponse.json({ ok: true });
}
