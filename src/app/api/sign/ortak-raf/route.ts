/**
 * ORTAK RAF (FlowSign) — tüm ekranların ortak medya havuzu.
 *
 * MİMARİ KURAL: raf, ekran klasörlerinden YAPISAL olarak ayrıdır
 * (`flowsign/ortak/` klasörü). Ekran silme `flowsign/{id}/` temizler — rafa
 * değemez bile. "Rafa koy" TAŞIMA DEĞİL KOPYADIR: orijinal ekranda aynen
 * kalır, hiçbir alan/yayın/başka ekran adresi değişmez. (İlk raf denemesi
 * rename ile taşıyordu ve public_id tuzağı + ölü adresler + çoklanan fotolarla
 * çöktü — bu sürümde o adım hiç yok.)
 *
 * LİSTE = SUNUCU GERÇEĞİ: kayıt tutulmaz, Cloudinary'nin kendisi listelenir
 * (`by_asset_folder` — dinamik klasör modunda public_id klasör taşımayabilir,
 * prefix araması o dosyaları KAÇIRIR; asset folder araması kaçırmaz).
 *
 * Yetki: listeleme + rafa koyma = giriş yapmış herkes; silme = YALNIZ yönetici
 * (bootstrap e-postası veya users/{uid}.role == "admin" — /api/kota ile aynı kapı).
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "doganbaharozu@gmail.com";
const RAF = "flowsign/ortak";

type Islem = "list" | "koy" | "sil";

export async function POST(req: Request) {
  const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const KEY = process.env.CLOUDINARY_API_KEY;
  const SECRET = process.env.CLOUDINARY_API_SECRET;
  const FB_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const FB_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!CLOUD || !KEY || !SECRET) {
    return NextResponse.json({ ok: false, error: "not-configured" }, { status: 501 });
  }
  if (!FB_KEY || !FB_PROJECT) return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });

  let body: { op?: Islem; idToken?: string; src?: string; publicId?: string; resourceType?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const { op, idToken } = body;
  if (!op || !idToken) return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });

  // idToken → hesap (uid + e-posta)
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!lookup.ok) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });
  const account = (await lookup.json())?.users?.[0];
  if (!account?.localId) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });

  const basic = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");

  // ── LİSTELE (sunucu gerçeği) ──────────────────────────────────────────────
  if (op === "list") {
    const out: { kind: "image" | "video"; src: string; name: string; publicId: string; at?: number }[] = [];
    // by_asset_folder tüm türleri tek çağrıda döndürmez diye tür belirtilmeden
    // istenir; yanıttaki resource_type ile ayrıştırılır.
    const r = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/resources/by_asset_folder?asset_folder=${encodeURIComponent(RAF)}&max_results=200`,
      { headers: { Authorization: basic } }
    );
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: "cloudinary", status: r.status, message: await r.text().catch(() => "") },
        { status: 502 }
      );
    }
    const j = await r.json();
    for (const a of j?.resources ?? []) {
      out.push({
        kind: a.resource_type === "video" ? "video" : "image",
        src: a.secure_url,
        // Dinamik klasör modunda insan-okur ad display_name'dedir; yoksa public_id kuyruğu.
        name: a.display_name || String(a.public_id).split("/").pop() || a.public_id,
        publicId: a.public_id,
        at: a.created_at ? Date.parse(a.created_at) : undefined,
      });
    }
    out.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
    return NextResponse.json({ ok: true, dosyalar: out });
  }

  // ── RAFA KOY (kopya — taşıma değil) ──────────────────────────────────────
  if (op === "koy") {
    const src = body.src ?? "";
    // Yalnız kendi bulutumuzdaki dosya kopyalanır (dış link rafın kapısından giremez).
    if (!src.startsWith(`https://res.cloudinary.com/${CLOUD}/`)) {
      return NextResponse.json({ ok: false, error: "src-mismatch" }, { status: 400 });
    }
    const ts = Math.floor(Date.now() / 1000);
    // İmza: file imzalanmaz; parametreler alfabetik (folder, timestamp).
    const imza = crypto.createHash("sha1").update(`folder=${RAF}&timestamp=${ts}${SECRET}`).digest("hex");
    const f = new URLSearchParams();
    f.set("file", src);
    f.set("folder", RAF);
    f.set("timestamp", String(ts));
    f.set("api_key", KEY);
    f.set("signature", imza);
    const up = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`, { method: "POST", body: f });
    const j = await up.json().catch(() => ({}));
    if (!up.ok) {
      return NextResponse.json(
        { ok: false, error: "cloudinary", message: j?.error?.message ?? `sunucu ${up.status}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, publicId: j.public_id, src: j.secure_url });
  }

  // ── SİL (yalnız yönetici) ────────────────────────────────────────────────
  if (op === "sil") {
    let yonetici = account?.email === ADMIN_EMAIL;
    if (!yonetici) {
      const kisi = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${account.localId}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      if (kisi.ok) yonetici = (await kisi.json())?.fields?.role?.stringValue === "admin";
    }
    if (!yonetici) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

    const publicId = body.publicId ?? "";
    const resourceType = body.resourceType === "video" ? "video" : "image";
    if (!publicId) return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });
    // KAPI: dosya gerçekten RAFTA mı? (public_id klasör taşımayabilir — asset
    // folder'a bakılır; yönetici bile rafta olmayan bir dosyayı bu uçtan silemez.)
    const detay = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`,
      { headers: { Authorization: basic } }
    );
    if (!detay.ok) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
    const d = await detay.json();
    if (d?.asset_folder !== RAF && d?.folder !== RAF && !String(publicId).startsWith(`${RAF}/`)) {
      return NextResponse.json({ ok: false, error: "raf-disi" }, { status: 400 });
    }
    const ts = Math.floor(Date.now() / 1000);
    const imza = crypto.createHash("sha1").update(`invalidate=true&public_id=${publicId}&timestamp=${ts}${SECRET}`).digest("hex");
    const f = new URLSearchParams();
    f.set("public_id", publicId);
    f.set("invalidate", "true");
    f.set("timestamp", String(ts));
    f.set("api_key", KEY);
    f.set("signature", imza);
    const del = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/destroy`, { method: "POST", body: f });
    const j = await del.json().catch(() => ({}));
    if (!del.ok || (j.result !== "ok" && j.result !== "not found")) {
      return NextResponse.json({ ok: false, error: "cloudinary", detail: j }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "bad-op" }, { status: 400 });
}
