import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { purgeUserFromWalls } from "@/lib/store";
import { deleteUser, listUsers, setCanCreate, setLabel, setPassword, setRole } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kullanıcı güncelle. Yönetici her şeyi yapar; normal kullanıcı YALNIZ KENDİ
 * parolasını değiştirir (rol/ad değiştiremez — yetki yükseltme yolu kapalı).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const admin = me.role === "admin";
  if (!admin && me.id !== params.id) return forbidden();
  const b = (await req.json().catch(() => ({}))) as { password?: string; role?: string; label?: string; canCreate?: boolean };
  // Yönetici olmayan yalnız KENDİ parolasını değiştirebilir. Rol/ad denemesi
  // sessizce yutulmaz — açıkça reddedilir (istemci "oldu" sanmasın).
  if (!admin && (b.role !== undefined || b.label !== undefined || b.canCreate !== undefined)) return forbidden();
  try {
    if (b.password) await setPassword(params.id, String(b.password));
    if (b.label !== undefined && admin) await setLabel(params.id, String(b.label));
    if (b.role && admin) await setRole(params.id, b.role === "admin" ? "admin" : "user");
    if (b.canCreate !== undefined && admin) await setCanCreate(params.id, !!b.canCreate);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Güncellenemedi" }, { status: 400 });
  }
}

/** Hesabı sil — yönetici. Silinen kişinin ekranları YÖNETİCİYE devrolur
 *  (yetim ekran kalıp kimse yönetemez duruma düşmesin). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  if (me.id === params.id) return NextResponse.json({ error: "Kendi hesabını silemezsin." }, { status: 400 });
  try {
    await deleteUser(params.id);
    const admins = (await listUsers()).filter((u) => u.role === "admin");
    await purgeUserFromWalls(params.id, admins[0]?.id ?? me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Silinemedi" }, { status: 400 });
  }
}
