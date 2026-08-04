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
// ÇEKİRDEKTEN: `@/lib/ortakRaf` Firestore istemcisini içeri çeker ve bu uç
// sunucuda çalışıyor (tek sabit için tüm Firebase SDK'sı yüklenmemeli).
import { ORTAK_KLASOR } from "@/lib/ortakRafCekirdek";

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

/**
 * GET — rafı LİSTELE (giriş yeter). Kaynak: CLOUDINARY'NİN KENDİSİ, Firestore
 * kaydı değil.
 *
 * Neden: taşıma iki adım (dosyayı taşı + listeye yaz) ve ikincisi düşebiliyor —
 * kurallar yapıştırılmadan yapılan ilk denemelerde tam bu oldu: dosyalar rafa
 * TAŞINDI ama liste kaydı yazılamadı. Sonuç "Ortak raf (0)" ama "bu dosya zaten
 * rafta" çelişkisi: YETİM dosyalar. Liste sunucu gerçeğinden gelince yetim diye
 * bir şey kalmaz — rafta ne varsa o görünür; Firestore kaydı yalnız kim/ne
 * zaman bilgisini süsler.
 */
export async function GET(req: Request) {
  const { CLOUD, KEY, SECRET, FB_KEY, FB_PROJECT } = ortam();
  if (!CLOUD || !KEY || !SECRET) return NextResponse.json({ ok: false, error: "not-configured" }, { status: 501 });
  if (!FB_KEY || !FB_PROJECT) return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });
  const idToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!idToken || !(await kimlikCoz(idToken, FB_KEY, FB_PROJECT)))
    return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });

  const auth = "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64");
  const dosyalar: { publicId: string; src: string; kind: "image" | "video"; name: string }[] = [];
  for (const rt of ["image", "video"] as const) {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${rt}/upload?prefix=${encodeURIComponent(ORTAK_KLASOR + "/")}&max_results=200`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) continue;
    const j = await res.json().catch(() => ({}));
    for (const r of (j.resources ?? []) as { public_id: string; secure_url: string }[]) {
      const kuyruk = r.public_id.split("/").pop() ?? r.public_id;
      dosyalar.push({
        publicId: r.public_id,
        src: r.secure_url,
        kind: rt,
        // Ad: "ts-orijinalad" → zaman öneki atılır (insan orijinal adı görmeli).
        name: kuyruk.includes("-") ? kuyruk.slice(kuyruk.indexOf("-") + 1) : kuyruk,
      });
    }
  }
  return NextResponse.json({ ok: true, dosyalar });
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

  /**
   * ADAY KİMLİKLER. Cloudinary'nin "dinamik klasör" kipinde TESLİM ADRESİ
   * klasörü gösterir ama gerçek `public_id` ÇIPLAK isimdir:
   *   adres  .../upload/v17/flowsign/{ekran}/v7blwb1d1tqzwinnyuu8.jpg
   *   kimlik v7blwb1d1tqzwinnyuu8          ← klasör YOK
   * Klasik kipte ise kimlik tam yoldur. Hangi kipte olduğumuzu dışarıdan
   * bilemeyiz ve hesap ayarı zamanla değişebilir; bu yüzden ikisini de deneriz.
   *
   * Yeni yüklemelerde gerçek kimlik öğeye yazılıyor (`cloudinaryId`) ve o zaten
   * ilk aday oluyor — bu geri dönüş ESKİ öğeler için.
   */
  const adaylar = [b.publicId, b.publicId.split("/").pop() ?? b.publicId].filter(
    (v, i, a) => v && a.indexOf(v) === i
  ) as string[];

  const sonParca = adaylar[adaylar.length - 1];
  const yeniId = `${ORTAK_KLASOR}/${Date.now().toString(36)}-${sonParca}`;

  let j: Record<string, unknown> = {};
  let sonDurum = 0;
  for (const aday of adaylar) {
    const params: Record<string, string> = {
      from_public_id: aday,
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
    j = await res.json().catch(() => ({}));
    sonDurum = res.status;
    if (res.ok && (j as { secure_url?: string }).secure_url) {
      return NextResponse.json({
        ok: true,
        src: (j as { secure_url: string }).secure_url,
        publicId: (j as { public_id: string }).public_id,
      });
    }
    // "Bulunamadı" dışındaki hatalarda (imza, yetki, kota) tekrar denemenin
    // anlamı yok — aynı hatayı ikinci kez almak teşhisi zorlaştırır.
    const mesaj0 = (j as { error?: { message?: string } })?.error?.message ?? "";
    if (!/not found/i.test(mesaj0)) break;
  }

  {
    // HATA METNİ YÜZEYE ÇIKAR: hangi kimlikler denendi, Cloudinary ne dedi.
    // Önce yalnız "Ortak rafa taşınamadı" yazıyordu ve teşhis imkânsızdı.
    const mesaj = (j as { error?: { message?: string } })?.error?.message ?? `Cloudinary ${sonDurum}`;
    return NextResponse.json(
      { ok: false, error: "cloudinary", message: mesaj, denenen: adaylar.join(" · ") },
      { status: 502 }
    );
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
    const mesaj = (j as { error?: { message?: string } })?.error?.message ?? `Cloudinary ${res.status}`;
    return NextResponse.json({ ok: false, error: "cloudinary", message: mesaj, denenen: b.publicId }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
