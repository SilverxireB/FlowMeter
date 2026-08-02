"use client";

/**
 * KANTİN oturum bağlamı — sayfa başına yeniden abone olmamak için tek yerde.
 *
 * BURADA OLMASININ SEBEBİ (denetim bulgusu): "hazır" uyarısı Siparişim
 * sayfasının içindeydi; kişi Menü sekmesine geçer geçmez dinleyici sökülüyor ve
 * uyarı HİÇ gelmiyordu. Oysa ürünün tüm vaadi bu. Uyarı artık kabuk düzeyinde:
 * kantinin herhangi bir sayfasında açık siparişin varsa dinlenir, hazır olduğu
 * an ses + titreşim + sistem bildirimi gelir ve hazır kaldıkça (en fazla 3 kez,
 * 3 dakikada bir) hatırlatılır.
 *
 * Kişi kaydı da CANLI izlenir: yönetici rol verdiğinde ya da yasak koyduğunda
 * kullanıcının ekranı kendiliğinden değişsin (çıkış-giriş gerekmesin).
 */
import { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { KANTIN_ADMIN_EMAIL, izleKantinler, izleKisi, izleOturum, izleSiparislerim } from "./api";
import { kantinYapilandirildi } from "./firebase";
import { bildirimGoster, calDing, ekraniUyanikTut, titret } from "./bildirim";
import { ACIK_DURUMLAR, Kantin, KantinKisi, KantinRol, Siparis } from "./types";

const SECILI = "kantin.secili";
/** Hazır sipariş alınmazsa kaç kez hatırlatılır (3 dakikada bir). */
const HATIRLATMA_TAVANI = 3;

interface Deger {
  user: User | null;
  kisi: KantinKisi | null;
  /** Kişi kaydı okundu ama YOK — profilini tamamlaması gerekiyor. */
  kisiYok: boolean;
  /** Etkin rol. Bootstrap yönetici e-postası kayıt beklemez (kurallar da öyle). */
  rol: KantinRol;
  kantinler: Kantin[];
  hazir: boolean;
  seciliId: string;
  secKantin: (id: string) => void;
  seciliKantin: Kantin | null;
  /** Kişinin AÇIK siparişleri (kabuk rozetini ve uyarıyı besler). */
  acikSiparisler: Siparis[];
  /** Kişinin son 7 günlük siparişleri (tekrar sipariş kısayolu için). */
  siparislerim: Siparis[];
  cevrimici: boolean;
}

const Ctx = createContext<Deger | null>(null);

export function KantinOturum({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [kisi, setKisi] = useState<KantinKisi | null>(null);
  const [kisiHazir, setKisiHazir] = useState(false);
  const [kantinler, setKantinler] = useState<Kantin[]>([]);
  const [hazir, setHazir] = useState(false);
  const [seciliId, setSeciliId] = useState("");
  const [siparislerim, setSiparislerim] = useState<Siparis[]>([]);
  const [cevrimici, setCevrimici] = useState(true);

  // Ayarlar eksikse Firebase örneği açılırken PATLAR ve tüm kantin ağacını
  // götürür; o yüzden hiç dokunmadan "hazır ama oturum yok" durumuna geçilir.
  useEffect(() => {
    if (!kantinYapilandirildi()) {
      setHazir(true);
      return;
    }
    let ilk = true;
    return izleOturum((u) => {
      setUser(u);
      if (ilk) {
        ilk = false;
        setHazir(true);
      }
      if (!u) {
        setKisi(null);
        setKisiHazir(false);
        setSiparislerim([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setKisiHazir(false);
    return izleKisi(user.uid, (k) => {
      setKisi(k);
      setKisiHazir(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return izleKantinler(setKantinler);
  }, [user]);

  // Çevrimdışı göstergesi: sessizce eskiyen bir ekran, yanlış bilgi veren
  // ekrandır. Fabrika sahasında kapsama düzensiz.
  useEffect(() => {
    const guncelle = () => setCevrimici(navigator.onLine !== false);
    guncelle();
    window.addEventListener("online", guncelle);
    window.addEventListener("offline", guncelle);
    return () => {
      window.removeEventListener("online", guncelle);
      window.removeEventListener("offline", guncelle);
    };
  }, []);

  // Seçili kantin: kantinci ise KENDİ kantini (seçim hakkı yok), diğerleri
  // hatırlanan/ilk kantin.
  useEffect(() => {
    if (kisi?.rol === "kantinci" && kisi.kantinId) {
      setSeciliId(kisi.kantinId);
      return;
    }
    setSeciliId((s) => {
      if (s && kantinler.some((k) => k.id === s)) return s;
      const kayitli = typeof localStorage !== "undefined" ? localStorage.getItem(SECILI) : null;
      if (kayitli && kantinler.some((k) => k.id === kayitli)) return kayitli;
      return kantinler[0]?.id ?? "";
    });
  }, [kisi, kantinler]);

  // ── Kişinin siparişleri + "hazır" uyarısı (kabuk düzeyinde) ───────────────
  const durumRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!seciliId || !user) return;
    setSiparislerim([]);
    durumRef.current = {};
    return izleSiparislerim(seciliId, user.uid, (s) => {
      for (const o of s) {
        const eski = durumRef.current[o.id];
        if (eski && eski !== "hazir" && o.durum === "hazir") {
          calDing();
          titret();
          bildirimGoster("Siparişin hazır", "Tezgâhtan alabilirsin.");
        }
        durumRef.current[o.id] = o.durum;
      }
      setSiparislerim(s);
    });
  }, [seciliId, user]);

  const acikSiparisler = useMemo(
    () => siparislerim.filter((s) => ACIK_DURUMLAR.includes(s.durum)),
    [siparislerim]
  );
  const hazirVar = acikSiparisler.some((s) => s.durum === "hazir");

  // Hazır sipariş alınmadıkça hatırlat — insan telefonu cebine koyar ve unutur;
  // alınmayan sipariş de "gelinmedi" olarak kişinin sicilini kirletir.
  useEffect(() => {
    if (!hazirVar) return;
    let kalan = HATIRLATMA_TAVANI;
    const iv = window.setInterval(() => {
      if (kalan-- <= 0) {
        window.clearInterval(iv);
        return;
      }
      calDing();
      titret([90, 60, 90]);
      bildirimGoster("Siparişin seni bekliyor", "Tezgâhtan almayı unutma.");
    }, 180_000);
    return () => window.clearInterval(iv);
  }, [hazirVar]);

  // Açık sipariş varken ekranı uyanık tut: sayfa dondurulmazsa canlı dinleyici
  // ayakta kalır ve "hazır" anında düşer.
  useEffect(() => {
    if (!acikSiparisler.length) return;
    let birak: (() => void) | null = null;
    let iptal = false;
    void ekraniUyanikTut().then((f) => (iptal ? f() : (birak = f)));
    return () => {
      iptal = true;
      birak?.();
    };
  }, [acikSiparisler.length]);

  const deger = useMemo<Deger>(
    () => ({
      user,
      kisi,
      kisiYok: !!user && kisiHazir && !kisi,
      rol: user?.email === KANTIN_ADMIN_EMAIL ? "admin" : (kisi?.rol ?? "personel"),
      kantinler,
      hazir,
      seciliId,
      secKantin: (id: string) => {
        setSeciliId(id);
        try {
          localStorage.setItem(SECILI, id);
        } catch {}
      },
      seciliKantin: kantinler.find((k) => k.id === seciliId) ?? null,
      acikSiparisler,
      siparislerim,
      cevrimici,
    }),
    [user, kisi, kisiHazir, kantinler, hazir, seciliId, acikSiparisler, siparislerim, cevrimici]
  );

  return <Ctx.Provider value={deger}>{children}</Ctx.Provider>;
}

export function useKantin(): Deger {
  const v = useContext(Ctx);
  if (!v) throw new Error("useKantin, KantinOturum içinde kullanılmalı.");
  return v;
}
