import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/serverAuth";
import { ensureDisKullanici, findByName, listUsers, publicUser, verifyPassword, User } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DIŞ KİMLİK KAPISI (LDAP / üst uygulama). .env'de DIS_KIMLIK_URL tanımlıysa
 * parola doğrulaması ORAYA sorulur: POST {kullanici, parola} → {ok, ad?, rol?}.
 * LDAP'a bu paket HİÇ dokunmaz — kurumun kendi uygulaması (ör. .NET servisi)
 * LDAP'ı zaten biliyordur, tek küçük uç açması yeter. Başarıda yerel hesap
 * otomatik açılır (ilk giriş: user + ekran/sahne açma kapalı → herkes yalnız
 * görüntüleyerek doğar). Dış servis HAYIR derse ya da ulaşılamazsa yerel
 * users.json denenir — .env'li yönetici hesabı her koşulda girer (kurtarma kapısı).
 */
async function disKimlikDene(name: string, password: string): Promise<User | null> {
  const url = process.env.DIS_KIMLIK_URL;
  if (!url || !name.trim()) return null;
  try {
    const ctrl = new AbortController();
    const zaman = setTimeout(() => ctrl.abort(), 4000); // dış servis asılırsa giriş asılmasın
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kullanici: name.trim(), parola: password }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(zaman);
    if (!r.ok) return null;
    const d = (await r.json().catch(() => null)) as { ok?: boolean; ad?: string; rol?: string } | null;
    if (!d?.ok) return null;
    return await ensureDisKullanici(name, d.ad, d.rol);
  } catch {
    return null; // ulaşılamadı → yerel deftere düş (tanılama: sunucu logu değil, sessiz geri çekilme)
  }
}

/**
 * Giriş: kullanıcı adı + parola. Kullanıcı adı BOŞ bırakılırsa tek yönetici
 * hesabı denenir — eski tek-parola kurulumundan gelenler alışkanlıklarını
 * bozmadan girsin (ilk açılışta .env parolasıyla "yonetici" kurulur).
 */
export async function POST(req: NextRequest) {
  const { name, password } = (await req.json().catch(() => ({}))) as { name?: string; password?: string };

  let user = await disKimlikDene(name ?? "", password ?? "");
  if (!user) {
    const users = await listUsers();
    const aday = name?.trim()
      ? await findByName(name)
      : users.length === 1
        ? users[0]
        : users.find((u) => u.role === "admin" && users.filter((x) => x.role === "admin").length === 1) ?? null;
    // Kullanıcı yoksa da parola doğrulanmış gibi zaman harcanmaz; mesaj TEK tip
    // (hangi kullanıcı adının var olduğu dışarı sızmasın).
    if (aday && verifyPassword(aday, password ?? "")) user = aday;
  }
  if (!user) {
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
