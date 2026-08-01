import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/serverAuth";
import { findByName, listUsers, publicUser, verifyPassword } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Giriş: kullanıcı adı + parola. Kullanıcı adı BOŞ bırakılırsa tek yönetici
 * hesabı denenir — eski tek-parola kurulumundan gelenler alışkanlıklarını
 * bozmadan girsin (ilk açılışta .env parolasıyla "yonetici" kurulur).
 */
export async function POST(req: NextRequest) {
  const { name, password } = (await req.json().catch(() => ({}))) as { name?: string; password?: string };
  const users = await listUsers();
  const user = name?.trim()
    ? await findByName(name)
    : users.length === 1
      ? users[0]
      : users.find((u) => u.role === "admin" && users.filter((x) => x.role === "admin").length === 1) ?? null;

  // Kullanıcı yoksa da parola doğrulanmış gibi zaman harcanmaz; mesaj TEK tip
  // (hangi kullanıcı adının var olduğu dışarı sızmasın).
  if (!user || !verifyPassword(user, password ?? "")) {
    return NextResponse.json({ error: "Kullanıcı adı ya da parola hatalı." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, await sessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 gün
  });
  return res;
}
