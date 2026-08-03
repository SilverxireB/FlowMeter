/**
 * FlowWall + FlowSign — Cloudinary'den KALICI dosya silme (yalnız duvar sahibi).
 * Secret istemciye asla inmez; imza burada üretilir.
 *
 * Güvenlik zinciri:
 *  1. Firebase idToken doğrulanır (identitytoolkit REST) → uid
 *  2. (walls|videowalls)/{wallId}.ownerId == uid kontrolü (Firestore REST; herkese okunur)
 *  3. Cloudinary destroy çağrısı imzalanıp yapılır
 * mode: yok=tek dosya (FlowWall) · "wall"=walls/{id}/ toplu · "sign"=flowsign/{id}/ toplu
 * · "kantin"=kantin/{id}/ toplu (iç kullanım uygulaması; yetki kantinUsers rolünden)
 *
 * Env (Vercel, server-side): CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * (+ mevcut NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_FIREBASE_API_KEY,
 *  NEXT_PUBLIC_FIREBASE_PROJECT_ID)
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const KEY = process.env.CLOUDINARY_API_KEY;
  const SECRET = process.env.CLOUDINARY_API_SECRET;
  const FB_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const FB_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!CLOUD || !KEY || !SECRET) {
    return NextResponse.json(
      { ok: false, error: "not-configured", message: "CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET tanımlı değil." },
      { status: 501 }
    );
  }
  if (!FB_KEY || !FB_PROJECT) {
    return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });
  }

  let body: { wallId?: string; cloudinaryId?: string; resourceType?: string; idToken?: string; mode?: string; mediaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const { wallId, idToken } = body;
  let cloudinaryId = body.cloudinaryId;
  const wallMode = body.mode === "wall"; // FlowWall: tüm duvarı topluca temizle (prefix)
  const signMode = body.mode === "sign"; // FlowSign: videowall medyasını topluca temizle
  const guestMode = body.mode === "guest"; // misafir KENDİ medyasını siler (voterId == uid)
  const kantinMode = body.mode === "kantin"; // Kantin: ürün görsellerini topluca temizle
  const bulk = wallMode || signMode || kantinMode;
  let resourceType = body.resourceType === "video" ? "video" : "image";
  if (!wallId || !idToken || (!bulk && !guestMode && !cloudinaryId) || (guestMode && !body.mediaId)) {
    return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });
  }

  // 1) idToken → uid
  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!lookup.ok) {
    return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });
  }
  const account = (await lookup.json())?.users?.[0];
  const uid: string | undefined = account?.localId;
  if (!uid) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });

  // 2) yetki: misafir modunda MEDYANIN voterId'si == uid (kendi yüklediği);
  //    diğer modlarda (walls|videowalls)/{wallId}.ownerId == uid.
  //    Misafirde public_id İSTEMCİDEN ALINMAZ — sunucu dokümandan okur
  //    (yoksa misafir imzasıyla başkasının dosyası silinebilirdi).
  if (guestMode) {
    const mediaRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/walls/${wallId}/media/${body.mediaId}`
    );
    if (!mediaRes.ok) return NextResponse.json({ ok: false, error: "media-not-found" }, { status: 404 });
    const f = (await mediaRes.json())?.fields ?? {};
    if (f.voterId?.stringValue !== uid) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    cloudinaryId = f.cloudinaryId?.stringValue;
    resourceType = f.type?.stringValue === "video" ? "video" : "image";
    if (!cloudinaryId) return NextResponse.json({ ok: true, skipped: true });
  } else if (kantinMode) {
    // Kantin ayrı bir dünya: sahiplik yerine ROL. Yönetici ya da o kantinin
    // görevlisi silebilir (Firestore kurallarındaki kGorevli ile aynı kapı).
    // KİMLİKLE oku: `kantinUsers` kuralları giriş yapmış olmayı şart koşuyor
    // (`kGirisli()`), yani kimliksiz istek HER ZAMAN reddediliyordu. Sonuç
    // sessizdi: `kisiRes.ok` false → rol boş → yalnız bootstrap e-postası
    // geçiyor, `rol:"admin"` yapılmış İKİNCİ bir yönetici kantin silince 403
    // alıyordu. Üstelik çağıran taraf bu hatayı yutuyor (api.ts), yani
    // Firestore temizleniyor ama Cloudinary'deki ürün görselleri yetim kalıp
    // URL'siyle açık kalmaya devam ediyordu. (Diğer dallar çalışıyordu çünkü
    // `walls`/`videowalls` belgeleri herkese açık okunabiliyor.)
    const kisiRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/kantinUsers/${uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    const kf = kisiRes.ok ? ((await kisiRes.json())?.fields ?? {}) : {};
    const rol = kf?.rol?.stringValue ?? "";
    const kantinId = kf?.kantinId?.stringValue ?? "";
    const eposta = account?.email ?? "";
    const yetkili = eposta === "doganbaharozu@gmail.com" || rol === "admin" || (rol === "kantinci" && kantinId === wallId);
    if (!yetkili) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  } else {
    const ownerCollection = signMode ? "videowalls" : "walls";
    const wallRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/${ownerCollection}/${wallId}`
    );
    if (!wallRes.ok) return NextResponse.json({ ok: false, error: "wall-not-found" }, { status: 404 });
    const fields = (await wallRes.json())?.fields ?? {};
    const ownerId = fields?.ownerId?.stringValue;
    // FlowSign: silme yetkisi MATRİSTEN gelir (yönetici "Sign yetkileri"nden
    // dağıtır). Firestore rules ile AYNI kapı — sunucu tarafı gevşek kalmasın
    // diye burada birebir tekrarlanır: açık kayıt varsa o geçerli, yoksa
    // ekranı oluşturan kişi tam yetkilidir.
    const grants = fields?.grants?.mapValue?.fields ?? {};
    const mine = grants?.[uid]?.mapValue?.fields;
    const isOwner = signMode
      ? (mine ? mine?.delete?.booleanValue === true : ownerId === uid)
      : ownerId === uid;
    if (!isOwner) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // ── Toplu temizlik: duvarın klasörü altındaki TÜM dosyaları sil ───────────────
  // (duvar silinince yetim Cloudinary dosyası kalmasın → depolama sızıntısı biter)
  // FlowWall: walls/{id}/ · FlowSign: flowsign/{id}/
  if (bulk) {
    const prefix = signMode ? `flowsign/${wallId}` : kantinMode ? `kantin/${wallId}` : `walls/${wallId}`;
    const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
    const purged: Record<string, number> = {};
    // image ve video ayrı resource_type → her biri için prefix sil
    for (const rt of ["image", "video"] as const) {
      let deleted = 0;
      // delete_resources_by_prefix 1000/çağrı siler, kalırsa partial=true → tekrar
      for (let guard = 0; guard < 25; guard++) {
        const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${rt}/upload?prefix=${encodeURIComponent(prefix)}`;
        const del = await fetch(url, { method: "DELETE", headers: { Authorization: auth } });
        if (!del.ok) break;
        const j = await del.json().catch(() => ({}));
        deleted += j.deleted ? Object.keys(j.deleted).length : 0;
        if (!j.partial) break;
      }
      purged[rt] = deleted;
    }
    return NextResponse.json({ ok: true, purged });
  }

  // Test tohumu / Cloudinary-dışı kayıtlar: silinecek dosya yok
  if (cloudinaryId!.startsWith("seed/")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 3) imzalı destroy
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `invalidate=true&public_id=${cloudinaryId!}&timestamp=${timestamp}${SECRET}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const form = new URLSearchParams();
  form.set("public_id", cloudinaryId!);
  form.set("invalidate", "true");
  form.set("timestamp", String(timestamp));
  form.set("api_key", KEY);
  form.set("signature", signature);

  const destroy = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  });
  const result = await destroy.json().catch(() => ({}));
  if (!destroy.ok || (result.result && result.result !== "ok" && result.result !== "not found")) {
    return NextResponse.json({ ok: false, error: "cloudinary", detail: result }, { status: 502 });
  }
  return NextResponse.json({ ok: true, result: result.result ?? "ok" });
}
