import { NextRequest, NextResponse } from "next/server";
import { currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { createUser, listUsers, publicUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kullanıcı defteri. Herkes OKUR (yetki verirken kişi seçmek için); parola
 *  özeti/tuz asla dışarı çıkmaz (publicUser). Hesap AÇMAK yöneticiye özel. */
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  return NextResponse.json({ users: (await listUsers()).map(publicUser), me: publicUser(me) });
}

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  if (me.role !== "admin") return forbidden();
  const b = (await req.json().catch(() => ({}))) as { name?: string; password?: string; role?: string; label?: string };
  try {
    const u = await createUser(String(b.name ?? ""), String(b.password ?? ""), b.role === "admin" ? "admin" : "user", b.label);
    return NextResponse.json({ ok: true, user: publicUser(u) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Kullanıcı açılamadı" }, { status: 400 });
  }
}
