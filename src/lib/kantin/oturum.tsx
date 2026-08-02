"use client";

/**
 * KANTİN oturum bağlamı — sayfa başına yeniden abone olmamak için tek yerde.
 * Kişi kaydı CANLI izlenir: yönetici rol verdiğinde ya da yasak koyduğunda
 * kullanıcının ekranı kendiliğinden değişsin (çıkış-giriş gerekmesin).
 */
import { User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { KANTIN_ADMIN_EMAIL, izleKantinler, izleKisi, izleOturum } from "./api";
import { kantinYapilandirildi } from "./firebase";
import { Kantin, KantinKisi, KantinRol } from "./types";

const SECILI = "kantin.secili";

interface Deger {
  user: User | null;
  kisi: KantinKisi | null;
  /** Kişi kaydı okundu ama YOK — profilini tamamlaması gerekiyor. */
  kisiYok: boolean;
  /** Etkin rol. Bootstrap yönetici e-postası kayıt beklemez (kurallar da öyle). */
  rol: KantinRol;
  kantinler: Kantin[];
  /** null = henüz belli değil (ekranı bekletmek için) */
  hazir: boolean;
  seciliId: string;
  secKantin: (id: string) => void;
  seciliKantin: Kantin | null;
}

const Ctx = createContext<Deger | null>(null);

export function KantinOturum({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [kisi, setKisi] = useState<KantinKisi | null>(null);
  const [kisiHazir, setKisiHazir] = useState(false);
  const [kantinler, setKantinler] = useState<Kantin[]>([]);
  const [hazir, setHazir] = useState(false);
  const [seciliId, setSeciliId] = useState("");

  // Ayarlar eksikse Firebase örneği açılırken PATLAR ve tüm kantin ağacını
  // götürür; o yüzden hiç dokunmadan "hazır ama oturum yok" durumuna geçilir —
  // giriş sayfası da bunu insan diliyle söyler.
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
    }),
    [user, kisi, kisiHazir, kantinler, hazir, seciliId]
  );

  return <Ctx.Provider value={deger}>{children}</Ctx.Provider>;
}

export function useKantin(): Deger {
  const v = useContext(Ctx);
  if (!v) throw new Error("useKantin, KantinOturum içinde kullanılmalı.");
  return v;
}
