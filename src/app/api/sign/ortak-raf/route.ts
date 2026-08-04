/**
 * ORTAK RAF — dosya taşıma (Cloudinary `rename`) ve silme.
 *
 * NEDEN SUNUCUDA: iki işlem de `api_secret` ister ve o anahtar istemciye asla
 * inmez. `/api/wall/destroy` ile aynı zincir: idToken → uid/e-posta → yetki →
 * imzalı Cloudinary çağrısı.
 *
 * NEDEN KOPYALAMA DEĞİL TAŞIMA: kopyalasaydık aynı dosya iki yerde durur, kota
 * iki kez yenir, ekran silinince "hangisi gitti" karışırdı. `rename` anlıktır
 * ve dosya yeni ağaca geçtiği anda ekran silme temizliği ona ULAŞAMAZ hâle
 * gelir — güvence klasör yapısından gelir, hatırlamaktan değil.
 *
 * YETKİ (kullanıcı kararı): rafa HERKES koyar (giriş yeter), raftan YALNIZ
 * YÖNETİCİ siler. Panel de öyle çiziyor ama karar BURADA verilir — panel
 * kapatılıp uca elle istek atılabilir.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { ORTAK_KLASOR } from "@/lib/ortakRaf";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "doganbaharozu@gmail.com";

interface Kimlik {
  uid: string;
  email: string;
  yonetici: boolean;
}

/** idToken → kimlik + yöneticilik. Doğrulanamazsa null. */
async function kimlikCoz(idToken: string, FB_KEY: string, FB_PROJECT: string): Promise<Kimlik | null> {
  const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!lookup.ok) return null;
  const account = (await lookup.json())?.users?.[0];
  const uid: string | undefined = account?.localId;
  if (!uid) return null;
  const email: string = account?.email ?? "";
  let yonetici = email === ADMIN_EMAIL;
  if (!yonetici) {
    const kisi = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (kisi.ok) yonetici = (await kisi.json())?.fields?.role?.stringValue === "admin";
  }
  return { uid, email, yonetici };
}

function ortam() {
  return {
    CLOUD: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    KEY: process.env.CLOUDINARY_API_KEY,
    SECRET: process.env.CLOUDINARY_API_SECRET,
    FB_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    FB_PROJECT: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
}

/** Cloudinary imzası: parametreler alfabetik, sonuna secret. */
function imza(params: Record<string, string>, secret: string): string {
  const govde = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(govde + secret).digest("hex");
}

/** POST — dosyayı ekranın klasöründen ORTAK RAFA taşı. */
export async function POST(req: Request) {
  const { CLOUD, KEY, SECRET, FB_KEY, FB_PROJECT } = ortam();
  if (!CLOUD || !KEY || !SECRET) return NextResponse.json({ ok: false, error: "not-configured" }, { status: 501 });
  if (!FB_KEY || !FB_PROJECT) return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as {
    idToken?: string;
    publicId?: string;
    resourceType?: string;
  };
  if (!b.idToken || !b.publicId) return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });

  const kim = await kimlikCoz(b.idToken, FB_KEY, FB_PROJECT);
  if (!kim) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });
  // Rafa koymak için giriş YETER (kullanıcı kararı) — yönetici şartı yok.

  const resourceType = b.resourceType === "video" ? "video" : "image";
  // Zaten raftaysa tekrar taşıma: aynı dosyayı iki kez paylaşmak sessizce
  // ikinci bir kayıt üretirdi.
  if (b.publicId.startsWith(`${ORTAK_KLASOR}/`)) {
    return NextResponse.json({ ok: false, error: "already-shared" }, { status: 409 });
  }

  // Yeni ad: raf klasörü + dosyanın son parçası. Aynı ad varsa Cloudinary
  // `overwrite=false` ile reddeder; o yüzden çakışmayı zaman damgasıyla keser.
  const sonParca = b.publicId.split("/").pop() || "dosya";
  const yeniId = `${ORTAK_KLASOR}/${Date.now().toString(36)}-${sonParca}`;

  const params: Record<string, string> = {
    from_public_id: b.publicId,
    to_public_id: yeniId,
    overwrite: "false",
    invalidate: "true",
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const form = new URLSearchParams({ ...params, api_key: KEY, signature: imza(params, SECRET) });

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/rename`, {
    method: "POST",
    body: form,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.secure_url) {
    return NextResponse.json({ ok: false, error: "cloudinary", detail: j }, { status: 502 });
  }
  return NextResponse.json({ ok: true, src: j.secure_url, publicId: j.public_id as string });
}

/** DELETE — raftan dosyayı KALICI sil. YALNIZ YÖNETİCİ. */
export async function DELETE(req: Request) {
  const { CLOUD, KEY, SECRET, FB_KEY, FB_PROJECT } = ortam();
  if (!CLOUD || !KEY || !SECRET) return NextResponse.json({ ok: false, error: "not-configured" }, { status: 501 });
  if (!FB_KEY || !FB_PROJECT) return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });

  const b = (await req.json().catch(() => ({}))) as {
    idToken?: string;
    publicId?: string;
    resourceType?: string;
  };
  if (!b.idToken || !b.publicId) return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });

  const kim = await kimlikCoz(b.idToken, FB_KEY, FB_PROJECT);
  if (!kim) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });
  if (!kim.yonetici) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  // Yalnız RAF klasöründeki dosya silinebilir. Bu satır olmasaydı, uca elle
  // istek atan bir yönetici (ya da yanlış yazılmış bir istemci) herhangi bir
  // ekranın medyasını bu uçtan silebilirdi.
  if (!b.publicId.startsWith(`${ORTAK_KLASOR}/`)) {
    return NextResponse.json({ ok: false, error: "not-in-shelf" }, { status: 400 });
  }

  const resourceType = b.resourceType === "video" ? "video" : "image";
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: "true", public_id: b.publicId, timestamp: String(timestamp) };
  const form = new URLSearchParams({ ...params, api_key: KEY, signature: imza(params, SECRET) });

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || (j.result && j.result !== "ok" && j.result !== "not found")) {
    return NextResponse.json({ ok: false, error: "cloudinary", detail: j }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
