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

/** Tüm kontroller. `uid` verilirse Firestore gidiş-dönüşü ve saat farkı da ölçülür. */
export async function saglikTara(uid?: string): Promise<Kontrol[]> {
  const out: Kontrol[] = [];
  const host = typeof window !== "undefined" ? window.location.hostname : "";

  // 1 — Temel yapılandırma
  out.push(
    isFirebaseConfigured()
      ? { id: "cfg", baslik: "Firebase yapılandırması", durum: "ok", detay: `Proje: ${cfg.projectId}` }
      : {
          id: "cfg",
          baslik: "Firebase yapılandırması",
          durum: "hata",
          detay: "NEXT_PUBLIC_FIREBASE_* değerleri eksik.",
          ipucu: "Vercel > Settings > Environment Variables altına ekle ve yeniden yayınla.",
        }
  );

  const ayar = await projeAyari();

  // 2 — Bu adres Google girişi için yetkili mi? (giriş sessizce takılmasının
  //     bir numaralı sebebi; alan adı değişince listeye eklemek unutuluyor)
  if (!ayar?.authorizedDomains) {
    out.push({
      id: "domain",
      baslik: "Yetkili alan adları",
      durum: "bilinmiyor",
      detay: "Liste okunamadı (ağ engeli ya da anahtar kısıtı olabilir).",
    });
  } else {
    const liste = ayar.authorizedDomains;
    const uygun = liste.includes(host);
    out.push({
      id: "domain",
      baslik: "Yetkili alan adları",
      durum: uygun ? "ok" : "hata",
      detay: uygun ? `${host} listede.` : `${host} listede YOK. Kayıtlı: ${liste.join(", ")}`,
      ipucu: uygun
        ? undefined
        : "Firebase Console > Authentication > Settings > Yetkili alan adları'na bu adresi ekle.",
    });
  }

  // 3 — Girişin geri döneceği adres. Kendi alan adımızı kullanmak, Google
  //     Cloud'da AYRI bir kayıt daha ister; eksikse "redirect_uri_mismatch".
  const authDomain = (auth().app.options as { authDomain?: string }).authDomain ?? "";
  const kendiAlan = !!authDomain && !authDomain.endsWith(".firebaseapp.com");
  out.push({
    id: "authdomain",
    baslik: "Giriş dönüş adresi",
    durum: kendiAlan ? "uyari" : "ok",
    detay: authDomain || "tanımsız",
    ipucu: kendiAlan
      ? `Kendi alan adı kullanılıyor: Google Cloud > Credentials > Web OAuth istemcisi > Authorized redirect URIs listesinde https://${authDomain}/__/auth/handler OLMALI. Yoksa giriş "redirect_uri_mismatch" verir.`
      : undefined,
  });

  // 4 — Anonim giriş: FlowWall misafirinin kendi medyasını silebilmesi buna bağlı
  const anon = await anonimDene();
  out.push({
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
  });

  // 5 — Firestore gidiş-dönüşü + SAAT FARKI. Sign'ın saat/gün takvimi CİHAZIN
  //     saatine bakar; cihaz saati kayarsa içerik yanlış saatte döner.
  if (uid) {
    try {
      const ref = doc(db(), "users", uid);
      const t0 = Date.now();
      await setDoc(ref, { lastSeenAt: serverTimestamp() }, { merge: true });
      const snap = await getDoc(ref);
      const gidisDonus = Date.now() - t0;
      const sunucu = (snap.data()?.lastSeenAt as { toMillis?: () => number } | undefined)?.toMillis?.();
      out.push({
        id: "firestore",
        baslik: "Veritabanı yazma/okuma",
        durum: "ok",
        detay: `Gidiş-dönüş ${gidisDonus} ms.`,
      });
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
    } catch (e) {
      out.push({
        id: "firestore",
        baslik: "Veritabanı yazma/okuma",
        durum: "hata",
        detay: e instanceof Error ? e.message : "Yazılamadı.",
        ipucu: "Kurallar (firestore.rules) konsola yapıştırılmış mı, kontrol et.",
      });
    }
  }

  // 6 — Cloudinary: FlowWall medyası ve FlowSign içeriği buna bağlı
  const cs = cloudinaryStatus();
  if (!cs.cloud || !cs.preset) {
    out.push({
      id: "cloudinary",
      baslik: "Medya deposu (Cloudinary)",
      durum: "hata",
      detay: `${cs.cloud ? "" : "cloud adı eksik. "}${cs.preset ? "" : "upload preset eksik."}`,
      ipucu: "Eksikken foto/video yüklenemez (URL/metin içerik çalışır).",
    });
  } else {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME as string;
    const ulasti = await cloudinaryUlasilir(cloud);
    out.push({
      id: "cloudinary",
      baslik: "Medya deposu (Cloudinary)",
      durum: ulasti ? "ok" : "uyari",
      detay: ulasti ? `${cloud} erişilebilir.` : `${cloud} yanıt vermedi.`,
      ipucu: ulasti ? undefined : "Cloud adı yanlış olabilir ya da ağ engelliyor olabilir.",
    });
  }

  return out;
}
