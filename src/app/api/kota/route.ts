/**
 * MEDYA KOTASI — Cloudinary'nin GERÇEK kullanım rakamı (yalnız yönetici).
 *
 * NEDEN SUNUCUDA: Admin API'si `api_secret` ister ve o anahtar istemciye asla
 * inmez. `/api/wall/destroy` ile aynı zincir: idToken → uid/e-posta → yetki →
 * imzalı/kimlikli Cloudinary çağrısı.
 *
 * NEDEN YALNIZ BU: suite'in kota sayılabilen İKİ kaynağı var, biri okunabiliyor
 * biri okunamıyor. Firestore'un "bugün kaç okuma yaptım" sayacı istemci SDK'sında
 * YOK; yalnız Cloud Monitoring API'sinde ve o da servis hesabı ister — yani yeni
 * bir dış bağımlılık. Kullanıcı kararı: tahmine dayalı satır İSTEMİYORUZ,
 * ölçmek için ek yazım harcamıyoruz. Bu yüzden panelde tek satır var ve o satır
 * gerçek. (Firestore tarafı için yol: Firebase konsolu → Usage + bütçe alarmı.)
 *
 * Env (Vercel, server-side): CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * (+ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_FIREBASE_API_KEY,
 *  NEXT_PUBLIC_FIREBASE_PROJECT_ID)
 */
import { NextResponse } from "next/server";
import { kotaOzeti } from "@/lib/kota";

/** Kota anlık bir değerdir — kenarda önbelleğe alınırsa dünkü sayıyı gösterir. */
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "doganbaharozu@gmail.com";

export async function POST(req: Request) {
  const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const KEY = process.env.CLOUDINARY_API_KEY;
  const SECRET = process.env.CLOUDINARY_API_SECRET;
  const FB_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const FB_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // "Yapılandırılmamış" ile "hata" AYRI: ilki bir eksiklik, ikincisi bir arıza.
  // Sağlık paneli ikisine aynı şeyi diyemez — biri env ekletir, diğeri ağ baktırır.
  if (!CLOUD || !KEY || !SECRET) {
    return NextResponse.json(
      { ok: false, error: "not-configured", message: "CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET tanımlı değil." },
      { status: 501 }
    );
  }
  if (!FB_KEY || !FB_PROJECT) return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });

  let idToken: string | undefined;
  try {
    idToken = (await req.json())?.idToken;
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  if (!idToken) return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });

  // 1) idToken → uid + e-posta
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!lookup.ok) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });
  const account = (await lookup.json())?.users?.[0];
  const uid: string | undefined = account?.localId;
  if (!uid) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });

  // 2) YÖNETİCİ KAPISI. Kota, hesabın faturasıdır — ekran açabilen herkesin
  //    göreceği bir şey değil. Kapı `isAdminUser` ile birebir aynı: bootstrap
  //    e-postası VEYA users/{uid}.role == "admin".
  let yonetici = account?.email === ADMIN_EMAIL;
  if (!yonetici) {
    const kisi = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (kisi.ok) yonetici = (await kisi.json())?.fields?.role?.stringValue === "admin";
  }
  if (!yonetici) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  // 3) Cloudinary Admin API — kullanım
  const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/usage`, { headers: { Authorization: auth } });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "cloudinary", status: res.status, message: await res.text().catch(() => "") },
      { status: 502 }
    );
  }
  // Şekillendirme SAF ve SINANABİLİR (src/lib/kota.ts): plana göre iki farklı
  // şema geliyor ve hangisinin geleceğini biz seçmiyoruz.
  return NextResponse.json({ ok: true, ...kotaOzeti(await res.json()) });
}
