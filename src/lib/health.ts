/**
 * SAĞLIK KONTROLLERİ — "canlıda gerçekten çalışıyor mu?"
 *
 * Neden var: bu ürünün bugüne kadarki en pahalı arızaları koddan değil
 * AYARDAN çıktı — auth alan adı, OAuth yönlendirme adresi, yetkili alan adı,
 * anonim sağlayıcı, Cloudinary preset. Hepsi sessiz: ekranda "hiç kayıt yok"
 * ya da sonsuz "Bağlanıyor…" görünüyor, sebebi görünmüyordu. Buradaki her
 * kontrol o arızalardan BİRİNİN karşılığıdır.
 *
 * Kurallar:
 *  - Hiçbir kontrol oturumu bozmaz. Anonim giriş denemesi AYRI bir Firebase
 *    uygulamasında ve bellekte tutulan oturumla yapılır; bitince kullanıcı
 *    silinir. (Ana oturumun üstüne yazmak tam da düzelttiğimiz hataydı.)
 *  - Hiçbir kontrol kalıcı çöp bırakmaz.
 *  - Bilinemeyen şeye "iyi" denmez; "bilinmiyor" der ve neden bilinemediğini yazar.
 */
import { deleteApp, initializeApp } from "firebase/app";
import { deleteUser, getAuth, inMemoryPersistence, signInAnonymously } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import { cloudinaryStatus } from "./cloudinary";
import { bayt, enDoluYuzde, kotaDurumu, KotaOzeti } from "./kota";

export type Durum = "ok" | "uyari" | "hata" | "bilinmiyor";

export interface Kontrol {
  id: string;
  baslik: string;
  durum: Durum;
  /** Tek satır sonuç — kullanıcı diliyle, jargonsuz. */
  detay: string;
  /** Sorun varsa NE YAPILACAĞI. Konsolda tıklanacak yeri tarif eder. */
  ipucu?: string;
}

/**
 * Kontroller TEK TEK çalıştırılabilir: panel açılır kapanır kutulardan oluşur,
 * bir kutuyu açmak yalnız o kontrolü tetikler. Hepsini birden koşturmak her
 * açılışta anonim giriş denemesi + Cloudinary isteği + Firestore yazımı demekti;
 * çoğu zaman kullanıcının merak ettiği tek bir başlık oluyor.
 */
export interface KontrolTanim {
  id: string;
  baslik: string;
  /** Bu kontrol NEYİ doğruluyor — kutu açılınca görünen tek cümle. */
  ozet: string;
  /** Bir tanım birden fazla sonuç üretebilir (ör. veritabanı + cihaz saati). */
  calistir: (uid?: string) => Promise<Kontrol[]>;
}

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase'in kendi kullandığı uç: yetkili alan adları + açık giriş yolları. */
interface ProjeAyari {
  authorizedDomains?: string[];
  signIn?: {
    anonymous?: { enabled?: boolean };
    email?: { enabled?: boolean };
  };
}

async function projeAyari(): Promise<ProjeAyari | null> {
  if (!cfg.apiKey) return null;
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${cfg.apiKey}`);
    if (!r.ok) return null;
    return (await r.json()) as ProjeAyari;
  } catch {
    return null;
  }
}

/** Cloudinary'de her hesapta hazır duran "sample" görseli yüklenebiliyor mu? */
function cloudinaryUlasilir(cloud: string): Promise<boolean> {
  return new Promise((resolve) => {
    const im = new window.Image();
    const bitir = (v: boolean) => resolve(v);
    im.onload = () => bitir(true);
    im.onerror = () => bitir(false);
    // 10px'lik sürüm: kredi/bant genişliği açısından ihmal edilebilir.
    im.src = `https://res.cloudinary.com/${cloud}/image/upload/w_10/sample.jpg?t=${Date.now()}`;
    window.setTimeout(() => bitir(false), 8000);
  });
}

/**
 * Anonim giriş AÇIK mı — ana oturuma DOKUNMADAN dener.
 * Ayrı uygulama örneği + bellek kalıcılığı → mevcut Google oturumu etkilenmez.
 * Açılan anonim hesap hemen silinir (çöp kalmaz).
 */
async function anonimDene(): Promise<{ sonuc: "acik" | "kapali" | "bilinmiyor"; hata?: string }> {
  const ikincil = initializeApp(
    { apiKey: cfg.apiKey, projectId: cfg.projectId, appId: cfg.appId },
    `health-${Date.now()}`
  );
  try {
    const a = getAuth(ikincil);
    await a.setPersistence(inMemoryPersistence);
    const cred = await signInAnonymously(a);
    await deleteUser(cred.user).catch(() => {});
    return { sonuc: "acik" };
  } catch (e) {
    const kod = (e as { code?: string })?.code ?? "";
    // AĞA ULAŞAMAMAK ile SAĞLAYICI KAPALI aynı şey değil: ilkinde "kapalı"
    // demek kullanıcıyı boş yere konsola gönderir.
    if (kod === "auth/operation-not-allowed" || kod === "auth/admin-restricted-operation")
      return { sonuc: "kapali", hata: kod };
    return { sonuc: "bilinmiyor", hata: kod || (e instanceof Error ? e.message : "bilinmeyen") };
  } finally {
    await deleteApp(ikincil).catch(() => {});
  }
}

// ── Kontroller ───────────────────────────────────────────────────────────────
// Her biri bağımsız çalışır; hiçbiri oturumu bozmaz, hiçbiri çöp bırakmaz.

async function kontrolCfg(): Promise<Kontrol[]> {
  return [
    isFirebaseConfigured()
      ? { id: "cfg", baslik: "Firebase yapılandırması", durum: "ok", detay: `Proje: ${cfg.projectId}` }
      : {
          id: "cfg",
          baslik: "Firebase yapılandırması",
          durum: "hata",
          detay: "NEXT_PUBLIC_FIREBASE_* değerleri eksik.",
          ipucu: "Vercel > Settings > Environment Variables altına ekle ve yeniden yayınla.",
        },
  ];
}

async function kontrolDomain(): Promise<Kontrol[]> {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const ayar = await projeAyari();
  if (!ayar?.authorizedDomains) {
    return [
      {
        id: "domain",
        baslik: "Yetkili alan adları",
        durum: "bilinmiyor",
        detay: "Liste okunamadı (ağ engeli ya da anahtar kısıtı olabilir).",
      },
    ];
  }
  const liste = ayar.authorizedDomains;
  const uygun = liste.includes(host);
  return [
    {
      id: "domain",
      baslik: "Yetkili alan adları",
      durum: uygun ? "ok" : "hata",
      detay: uygun ? `${host} listede.` : `${host} listede YOK. Kayıtlı: ${liste.join(", ")}`,
      ipucu: uygun
        ? undefined
        : "Firebase Console > Authentication > Settings > Yetkili alan adları'na bu adresi ekle.",
    },
  ];
}

async function kontrolAuthDomain(): Promise<Kontrol[]> {
  const authDomain = (auth().app.options as { authDomain?: string }).authDomain ?? "";
  const kendiAlan = !!authDomain && !authDomain.endsWith(".firebaseapp.com");

  // Bu kontrol eskiden kendi alan adı kullanılıyorsa KOŞULSUZ sarı yanıyordu:
  // "Google Cloud'daki kaydı buradan doğrulayamam" demenin bir yoluydu. Ama
  // 2026-08'de kendi alan adına GEÇİLDİ, yani doğru yapılandırılmış bir sistemde
  // bu uyarı artık kalıcı. Kalıcı uyarı, uyarıyı susturur — asıl arıza çıktığında
  // da kimse bakmaz.
  //
  // Onun yerine GERÇEKTEN ÖLÇÜLEBİLİR olan şey ölçülüyor: giriş yardımcısının
  // adresine bu cihazdan ulaşılıyor mu? Fabrika iç ağında bozulan tam olarak
  // buydu (*.firebaseapp.com kapalıydı, giriş penceresi zaman aşımına düşüyordu).
  let ulasilir: boolean | null = null;
  if (authDomain) {
    try {
      const iptal = new AbortController();
      const zaman = setTimeout(() => iptal.abort(), 6000);
      await fetch(`https://${authDomain}/__/auth/handler`, {
        mode: "no-cors",
        cache: "no-store",
        signal: iptal.signal,
      });
      clearTimeout(zaman);
      ulasilir = true;
    } catch {
      ulasilir = false;
    }
  }

  return [
    {
      id: "authdomain",
      baslik: "Giriş dönüş adresi",
      durum: !authDomain ? "uyari" : ulasilir === false ? "hata" : "ok",
      detay: !authDomain
        ? "tanımsız"
        : ulasilir === false
          ? `${authDomain} — bu cihazdan ULAŞILAMIYOR.`
          : `${authDomain} — ulaşılabilir.`,
      ipucu:
        ulasilir === false
          ? "Bu ağ adresi engelliyor; giriş penceresi zaman aşımına düşer. Bilgi işlemden bu adrese izin iste ya da başka bir ağdan dene."
          : kendiAlan
            ? `Not: kendi alan adımız kullanılıyor, yani Google Cloud > Credentials > Web OAuth istemcisinde https://${authDomain}/__/auth/handler kayıtlı olmak zorunda (giriş çalışıyorsa kayıtlıdır).`
            : undefined,
    },
  ];
}

/**
 * OTURUM JETONU — Firebase kimlik jetonu ~1 saat yaşar ve tazelenmesi ayrı bir
 * Google adresine (securetoken.googleapis.com) gider.
 *
 * Neden ayrı bir kontrol: o adres kapalıysa ilk saat HER ŞEY çalışır, sonra
 * bütün okumalar "Missing or insufficient permissions" ile düşer — çünkü istek
 * kimliksiz gider. Ekranda bu, "yetkim mi kalktı?" gibi görünür; oysa kural da
 * rol de yerindedir. Fabrika PC'sinde tam olarak bu yaşandı: sayfa açıkken,
 * hiçbir şey değişmeden, çalışırken bozuldu.
 *
 * Zorla tazeleme (`getIdToken(true)`) bu yolu doğrudan sınar.
 */
async function kontrolJeton(): Promise<Kontrol[]> {
  const u = auth().currentUser;
  if (!u) {
    return [{ id: "jeton", baslik: "Oturum jetonu", durum: "bilinmiyor", detay: "Giriş yapılmamış." }];
  }
  try {
    await u.getIdToken(true);
    return [
      {
        id: "jeton",
        baslik: "Oturum jetonu",
        durum: "ok",
        detay: "Tazelenebiliyor — oturum saatler sonra da geçerli kalır.",
      },
    ];
  } catch (e) {
    return [
      {
        id: "jeton",
        baslik: "Oturum jetonu",
        durum: "hata",
        detay: `Tazelenemedi (${e instanceof Error ? e.message : "bilinmeyen"}).`,
        ipucu:
          "Jeton ~1 saatte bir yenilenir; yenilenemezse okumalar 'yetkiniz yok' diye reddedilir (kural değil, kimlik sorunu). Ağın securetoken.googleapis.com ve identitytoolkit.googleapis.com adreslerine izin vermesi gerekiyor.",
      },
    ];
  }
}

async function kontrolAnonim(): Promise<Kontrol[]> {
  const anon = await anonimDene();
  return [
    {
      id: "anon",
      baslik: "Anonim giriş (FlowWall misafiri)",
      durum: anon.sonuc === "acik" ? "ok" : anon.sonuc === "kapali" ? "uyari" : "bilinmiyor",
      detay:
        anon.sonuc === "acik"
          ? "Açık."
          : anon.sonuc === "kapali"
            ? "Kapalı."
            : `Denenemedi (${anon.hata}) — sağlayıcıya ulaşılamadı, kapalı olduğu anlamına gelmez.`,
      ipucu:
        anon.sonuc === "kapali"
          ? "Kapalıyken duvar çalışır ama misafir KENDİ yüklediğini silemez. Firebase Console > Authentication > Sign-in method > Anonymous."
          : undefined,
    },
  ];
}

async function kontrolFirestore(uid?: string): Promise<Kontrol[]> {
  if (!uid) {
    return [
      {
        id: "firestore",
        baslik: "Veritabanı yazma/okuma",
        durum: "bilinmiyor",
        detay: "Oturum açık değil — kendi kaydına yazılamadı.",
      },
    ];
  }
  try {
    const ref = doc(db(), "users", uid);
    const t0 = Date.now();
    await setDoc(ref, { lastSeenAt: serverTimestamp() }, { merge: true });
    const snap = await getDoc(ref);
    const gidisDonus = Date.now() - t0;
    const sunucu = (snap.data()?.lastSeenAt as { toMillis?: () => number } | undefined)?.toMillis?.();
    const out: Kontrol[] = [
      { id: "firestore", baslik: "Veritabanı yazma/okuma", durum: "ok", detay: `Gidiş-dönüş ${gidisDonus} ms.` },
    ];
    if (sunucu) {
      const fark = Math.abs(Date.now() - sunucu);
      out.push({
        id: "saat",
        baslik: "Cihaz saati",
        durum: fark < 60_000 ? "ok" : fark < 300_000 ? "uyari" : "hata",
        detay: `Sunucudan farkı ${Math.round(fark / 1000)} sn.`,
        ipucu:
          fark < 60_000
            ? undefined
            : "FlowSign'ın saat/gün takvimi CİHAZIN saatine bakar — kayma varsa içerik yanlış saatte döner. Perdeyi çalıştıran cihazın saatini otomatiğe al.",
      });
    }
    return out;
  } catch (e) {
    return [
      {
        id: "firestore",
        baslik: "Veritabanı yazma/okuma",
        durum: "hata",
        detay: e instanceof Error ? e.message : "Yazılamadı.",
        ipucu: "Kurallar (firestore.rules) konsola yapıştırılmış mı, kontrol et.",
      },
    ];
  }
}

async function kontrolCloudinary(): Promise<Kontrol[]> {
  const cs = cloudinaryStatus();
  if (!cs.cloud || !cs.preset) {
    return [
      {
        id: "cloudinary",
        baslik: "Medya deposu (Cloudinary)",
        durum: "hata",
        detay: `${cs.cloud ? "" : "cloud adı eksik. "}${cs.preset ? "" : "upload preset eksik."}`,
        ipucu: "Eksikken foto/video yüklenemez (URL/metin içerik çalışır).",
      },
    ];
  }
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME as string;
  const ulasti = await cloudinaryUlasilir(cloud);
  return [
    {
      id: "cloudinary",
      baslik: "Medya deposu (Cloudinary)",
      durum: ulasti ? "ok" : "uyari",
      detay: ulasti ? `${cloud} erişilebilir.` : `${cloud} yanıt vermedi.`,
      ipucu: ulasti ? undefined : "Cloud adı yanlış olabilir ya da ağ engelliyor olabilir.",
    },
  ];
}

/**
 * MEDYA KOTASI — hesabın Cloudinary kullanımının GERÇEK rakamı.
 *
 * Panelde neden tek kota satırı var: suite'in kota sayılabilen iki kaynağından
 * yalnız bu okunabiliyor. Firestore'un günlük okuma/yazma sayacı istemci
 * SDK'sında yok; Cloud Monitoring API'si servis hesabı ister (yeni dış
 * bağımlılık) ve kendi sayacımızı tutmak, YAZIMI ÖLÇMEK İÇİN YAZIM harcamak
 * demek. Kullanıcı kararı: tahmin satırı yok, ölçüm için ek maliyet yok.
 * Firestore tarafı Firebase konsolundan (Usage + bütçe alarmı) izlenir.
 *
 * Yüzde eşikleri SKOR DEĞİL, DOLULUK: burada büyük sayı kötüdür, o yüzden
 * ürünün yeşil/amber/gül semantiği TERS uygulanır.
 */
async function kontrolKota(): Promise<Kontrol[]> {
  const baslik = "Medya kotası (Cloudinary)";
  const kullanici = auth().currentUser;
  if (!kullanici)
    return [{ id: "kota", baslik, durum: "bilinmiyor", detay: "Oturum yok — kota hesabın kendi anahtarıyla okunuyor." }];

  const res = await fetch("/api/kota", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await kullanici.getIdToken() }),
  });
  const j = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Bilinemeyen şeye "iyi" denmez (bu dosyanın kuralı): her ret kendi
    // sebebini ve YAPILACAK İŞİ söyler, hepsi "hata" diye toplanmaz.
    const durum: Durum = res.status === 501 || res.status === 403 ? "bilinmiyor" : "uyari";
    const detay =
      res.status === 501
        ? "Sunucuda Cloudinary anahtarları tanımlı değil."
        : res.status === 403
          ? "Kota yalnız yöneticiye gösterilir."
          : `Cloudinary yanıt vermedi (${j.status ?? res.status}).`;
    const ipucu =
      res.status === 501
        ? "Vercel → Settings → Environment Variables: CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET."
        : res.status === 403
          ? undefined
          : "Anahtarlar doğru mu, ya da Cloudinary geçici olarak erişilemiyor olabilir.";
    return [{ id: "kota", baslik, durum, detay, ipucu }];
  }

  // En dolu ölçü panelin bakacağı TEK sayı — kredi %10'dayken bant genişliği
  // %95 olabilir ve asıl duracak yer odur (hesap `kota.ts`te, sınavlı).
  const ozet = j as KotaOzeti;
  const enDolu = enDoluYuzde(ozet);

  const parcalar: string[] = [];
  if (ozet.kredi?.limit) parcalar.push(`${Number(ozet.kredi.kullanilan ?? 0).toFixed(2)}/${ozet.kredi.limit} kredi`);
  for (const m of ozet.olculer ?? []) {
    if (typeof m.kullanim !== "number") continue;
    const yaz = (n: number) => (m.bayt ? bayt(n) : n.toLocaleString("tr-TR"));
    parcalar.push(`${m.ad.toLowerCase()} ${yaz(m.kullanim)}${m.limit ? ` / ${yaz(m.limit)}` : ""}`);
  }
  if (typeof ozet.dosya === "number") parcalar.push(`${ozet.dosya.toLocaleString("tr-TR")} dosya`);

  return [
    {
      id: "kota",
      baslik,
      durum: kotaDurumu(enDolu),
      detay:
        (enDolu === null ? "Plan bir üst sınır bildirmiyor. " : `%${Math.round(enDolu)} dolu. `) +
        parcalar.join(" · ") +
        // Rakam CANLI DEĞİL: Cloudinary günlük toparlar. Bunu yazmazsak panel
        // "bugün yüklenen 2 GB" görünmediği için yanlış rahatlatır.
        (ozet.guncellendi ? ` (Cloudinary'nin son güncellemesi: ${ozet.guncellendi})` : ""),
      ipucu:
        enDolu !== null && enDolu >= 70
          ? "Biten etkinliklerin duvarlarını silmek yer açar — duvar silinince Cloudinary'deki dosyaları da temizlenir."
          : undefined,
    },
  ];
}

/** Panelin sırası: en sık arızalanan (ve en sessiz) başlıklar üstte. */
export const KONTROLLER: KontrolTanim[] = [
  {
    id: "cfg",
    baslik: "Firebase yapılandırması",
    ozet: "Yayına giren pakette Firebase değişkenleri var mı — yoksa hiçbir şey kaydedilmez.",
    calistir: kontrolCfg,
  },
  {
    id: "domain",
    baslik: "Yetkili alan adları",
    ozet: "Bu adres Google girişi için yetkili mi. Alan adı değişince listeye eklemek unutulur, giriş sessizce takılır.",
    calistir: kontrolDomain,
  },
  {
    id: "authdomain",
    baslik: "Giriş dönüş adresi",
    ozet: "Girişin geri döneceği adres. Kendi alan adımız Google Cloud'da ayrı bir kayıt daha ister.",
    calistir: kontrolAuthDomain,
  },
  {
    id: "jeton",
    baslik: "Oturum jetonu",
    ozet: "Kimlik jetonu ~1 saatte bir yenilenir. Yenilenemezse her okuma 'yetkiniz yok' diye reddedilir.",
    calistir: kontrolJeton,
  },
  {
    id: "anon",
    baslik: "Anonim giriş (FlowWall misafiri)",
    ozet: "Misafirin KENDİ yüklediğini silebilmesi buna bağlı. Deneme ayrı bağlantıda yapılır, açılan hesap hemen silinir.",
    calistir: kontrolAnonim,
  },
  {
    id: "firestore",
    baslik: "Veritabanı + cihaz saati",
    ozet: "Gerçek bir yazma/okuma turu; aynı turda cihaz saatinin sunucudan sapması da ölçülür (Sign takvimi cihaz saatine bakar).",
    calistir: kontrolFirestore,
  },
  {
    id: "cloudinary",
    baslik: "Medya deposu (Cloudinary)",
    ozet: "FlowWall medyası ve FlowSign içeriği buna bağlı; ayarlar var mı ve depo yanıt veriyor mu.",
    calistir: kontrolCloudinary,
  },
  {
    id: "kota",
    baslik: "Medya kotası (Cloudinary)",
    ozet: "Hesabın gerçek kullanımı — depo, bant genişliği, dosya sayısı. Tahmin değil, Cloudinary'nin kendi rakamı.",
    calistir: kontrolKota,
  },
];

/** Tüm kontroller. `uid` verilirse Firestore gidiş-dönüşü ve saat farkı da ölçülür. */
export async function saglikTara(uid?: string): Promise<Kontrol[]> {
  const out: Kontrol[] = [];
  for (const t of KONTROLLER) {
    try {
      out.push(...(await t.calistir(uid)));
    } catch (e) {
      out.push({
        id: t.id,
        baslik: t.baslik,
        durum: "bilinmiyor",
        detay: e instanceof Error ? e.message : "Kontrol çalıştırılamadı.",
      });
    }
  }
  return out;
}
