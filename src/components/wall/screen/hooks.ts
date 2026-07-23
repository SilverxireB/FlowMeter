"use client";

/**
 * Perde oynatma hook'ları — page.tsx orkestratöründen ayrıldı (token maliyeti).
 *  - usePagedPlayback: tekil-foto modları (Sahne/Sinema/Spot/Polaroid) için ağırlıklı
 *    adil seçim + yeni foto anında açılır + tüm modlarda aynı süre.
 *  - useDominantColor: görselin baskın rengini canvas'la örnekler (ambiyans tint).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WallMedia } from "@/lib/types";

const IMAGE_MS = 6500; // tüm modlarda fotoğraf sahne süresi
const VIDEO_CAP_MS = 12000; // uzun videoları kesme sınırı

/**
 * Ortak oynatma denetleyicisi (tekil-foto modları için).
 *  - Ağırlıklı adil seçim: taze foto öne, aynı kişi arka arkaya gelmez,
 *    az gösterilen öne, beğeni bonusu, küçük rastgelelik.
 *  - Yeni foto gelince ANINDA ona geçer (kesintisiz — en kritik davranış).
 *  - Kalma süresi tüm modlarda AYNI (IMAGE_MS / video cap).
 * advance() kimlik olarak sabittir (ref'lerle) → zamanlayıcı kararsızlaşmaz.
 */
export function usePagedPlayback(media: WallMedia[]): { current: WallMedia | null; advance: () => void } {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const currentIdRef = useRef<string | null>(null);
  const startedAt = useRef(0); // aktif fotonun gösterime başladığı an
  const playCounts = useRef<Record<string, number>>({});
  const lastByVoter = useRef<Record<string, number>>({});
  const knownIds = useRef<Set<string>>(new Set());

  const current = useMemo(
    () => media.find((m) => m.id === currentId) ?? media[media.length - 1] ?? null,
    [media, currentId]
  );
  currentIdRef.current = current?.id ?? null;

  const advance = useCallback(() => {
    const list = mediaRef.current;
    if (!list.length) { setCurrentId(null); return; }
    if (list.length === 1) { setCurrentId(list[0].id); return; }
    const now = Date.now();
    const curId = currentIdRef.current;
    // En düşük gösterim sayısı BASKIN faktör → gerçek round-robin (hiç foto aç kalmaz);
    // tazelik/beğeni/rastgelelik yalnız eşit gösterimliler arasında ayırt eder.
    let bestId = list[0].id;
    let best = -Infinity;
    for (const m of list) {
      if (m.id === curId) continue;
      let s = Math.random() * 0.5;
      s -= (playCounts.current[m.id] ?? 0) * 4; // BASKIN adalet
      const age = now - (m.createdAt?.toMillis?.() ?? now);
      if (age < 5 * 60000) s += 1.5; else if (age < 15 * 60000) s += 0.6;
      if (m.voterId) { const t = lastByVoter.current[m.voterId] ?? 0; if (now - t < 30000) s -= 2; }
      s += (m.likes ?? 0) * 0.15;
      if (s > best) { best = s; bestId = m.id; }
    }
    startedAt.current = now;
    setCurrentId(bestId);
  }, []);

  // Sayım TEK yerde: bir foto gösterime girdiğinde (jump ya da advance farketmez)
  // bir kez sayılır. Yeni fotolar sayaç=0 ile gelir → round-robin'de EN yüksek
  // öncelik → mutlaka görünür.
  const curForCount = current?.id;
  useEffect(() => {
    if (!curForCount) return;
    playCounts.current[curForCount] = (playCounts.current[curForCount] ?? 0) + 1;
    const v = mediaRef.current.find((m) => m.id === curForCount)?.voterId;
    if (v) lastByVoter.current[v] = Date.now();
  }, [curForCount]);

  // Yeni medya → ona geç. İlk yükleme baseline kurar. Mevcut foto en az ~1.6 sn
  // gösterildiyse hemen geçer (kesintisiz his); daha yeni başladıysa kesmez.
  useEffect(() => {
    let newest: WallMedia | null = null;
    for (const m of media) if (!knownIds.current.has(m.id)) newest = m; // asc → son yeni = en yeni
    const first = knownIds.current.size === 0;
    knownIds.current = new Set(media.map((m) => m.id));
    if (first) { if (media.length) { setCurrentId(media[media.length - 1].id); startedAt.current = Date.now(); } return; }
    if (newest) {
      const sinceStart = Date.now() - startedAt.current;
      const jump = () => { startedAt.current = Date.now(); setCurrentId(newest!.id); };
      if (sinceStart >= 1600) jump();
      else { const t = window.setTimeout(jump, 1600 - sinceStart); return () => window.clearTimeout(t); }
    }
  }, [media]);

  // Kalma süresi zamanlayıcısı — yalnız aktif id/tip değişince yeniden kurulur.
  const curId = current?.id;
  const curType = current?.type;
  useEffect(() => {
    if (!curId) return;
    const dur = curType === "video" ? VIDEO_CAP_MS : IMAGE_MS;
    const t = window.setTimeout(advance, dur);
    return () => window.clearTimeout(t);
  }, [curId, curType, advance]);

  return { current, advance };
}

/** Görselin baskın (ortalama) rengini canvas'la örnekler; CORS/hatada null. */
export function useDominantColor(url: string | undefined): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setColor(null);
      return;
    }
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        if (!cancelled && n) setColor(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`);
      } catch {
        if (!cancelled) setColor(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setColor(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return color;
}
