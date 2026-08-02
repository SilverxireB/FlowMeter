"use client";

/**
 * KANTİN uyarıları — "hazır" anını KAÇIRMAMAK için.
 *
 * Neden sunucu push'u yok: gerçek web push iki şey ister — Console'dan alınan
 * VAPID anahtarı ve mesajı GÖNDEREN sunucu kimliği. İkisi de bizde yok; anahtarsız
 * yazılan push kodu hiç denenemez, denenmemiş bildirim yolu ise güven vermez.
 * Bunun yerine molanın gerçekten kapsadığı 5-10 dakikada ÇALIŞAN yol kuruldu:
 *
 *  1) Ekran uyanık tutulur (Wake Lock) — sipariş açıkken sayfa dondurulmaz,
 *     dolayısıyla canlı dinleyici ayakta kalır. FlowSign perdesinde aynı desen.
 *  2) Sistem bildirimi (Notification) — telefon başka sekmedeyken de görünür.
 *  3) Ses + titreşim — cepteyken hissedilir.
 *
 * Hiçbiri izin/donanım yoksa sessizce atlanır: uyarı gelmemesi ekranı bozmaz,
 * kişi zaten durumu sayfada görüyor.
 */

export type BildirimDurum = "yok" | "kapali" | "acik" | "sorulmadi";

export function bildirimDurumu(): BildirimDurum {
  if (typeof Notification === "undefined") return "yok";
  if (Notification.permission === "granted") return "acik";
  if (Notification.permission === "denied") return "kapali";
  return "sorulmadi";
}

export async function bildirimIste(): Promise<BildirimDurum> {
  if (typeof Notification === "undefined") return "yok";
  try {
    const r = await Notification.requestPermission();
    return r === "granted" ? "acik" : r === "denied" ? "kapali" : "sorulmadi";
  } catch {
    return "yok";
  }
}

export function bildirimGoster(baslik: string, govde: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(baslik, { body: govde, icon: "/icon-192.png", tag: "kantin-siparis" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {}
}

/** Kısa "hazır" tonu — dosya/dış servis yok, WebAudio ile üretilir. */
export function calDing() {
  try {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      const t = now + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.42);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}

export function titret(desen: number[] = [140, 70, 140, 70, 220]) {
  try {
    navigator.vibrate?.(desen);
  } catch {}
}

/** Ekranı uyanık tut; dönen işlev bırakır. Desteklenmiyorsa sessizce boş döner. */
export async function ekraniUyanikTut(): Promise<() => void> {
  type Sentinel = { release: () => Promise<void> };
  const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock;
  if (!wl) return () => {};
  let kilit: Sentinel | null = null;
  let birakildi = false;
  const al = async () => {
    try {
      kilit = await wl.request("screen");
    } catch {
      kilit = null;
    }
  };
  // Sekmeye geri dönünce kilit düşmüş olabilir — yeniden al.
  const gorunurluk = () => {
    if (!birakildi && document.visibilityState === "visible") void al();
  };
  await al();
  document.addEventListener("visibilitychange", gorunurluk);
  return () => {
    birakildi = true;
    document.removeEventListener("visibilitychange", gorunurluk);
    kilit?.release().catch(() => {});
  };
}
