"use client";

/**
 * PROVA — FlowWall (/admin → "Prova & sağlık" → duvar seç).
 *
 * Duvar etkinliğin TAMAMI demek: medya, tepki yağmuru, beğeni, dilek, yarışma
 * oyu, çekiliş kaydı, galeri gezme. Bu yüzden prova da hepsini yapar — tek tek
 * elle denemek bir etkinlik günü kadar sürüyordu.
 *
 * Misafir yazımları GERÇEK yoldan gider (bkz. lib/simWall.ts): kurallar hiç
 * değişmez, yalnız tek-telefon yardımcıları (hız freni, localStorage işaretleri,
 * tek voterId) atlanır — onlarla 20 ayrı misafir taklit edilemez.
 *
 * MEDYA: kurallar medya `url`'inin gerçek Cloudinary adresi olmasını şart koşar
 * (şekil kontrolü duvar sahibine de uygulanır) — dış link yazılamaz. Bu yüzden
 * örnek foto/video CİHAZDA üretilir (canvas + MediaRecorder) ve misafirle aynı
 * yoldan, aynı klasöre yüklenir; duvar silinince ön ek temizliği onları da alır.
 *
 * Yazım hataları YUTULMAZ: kural reddi ile "hiç denenmedi" ayırt edilebilsin
 * diye işlem akışına düşer.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWall } from "@/lib/hooks";
import {
  addWallMedia,
  fetchApprovedMedia,
  isCurrentSession,
  raffleRegistrationOpen,
  resolveCode,
  watchWallMediaRecent,
} from "@/lib/walls";
import {
  WallBot,
  fireContestVote,
  fireLike,
  fireRaffleEntry,
  fireWallReaction,
  fireWish,
  makeWallBots,
} from "@/lib/simWall";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { useAdminGate } from "@/lib/useAdminGate";
import { WallMedia } from "@/lib/types";

const TICK_MS = 500;
const REACTION_CAP = 30; // tick başına tavan — kaçak yükü keser

// Perdede çeşitlilik görünsün diye farklı en/boy ve renkler.
const OLCU: [number, number][] = [
  [1200, 1600], [1600, 1100], [1400, 1400], [1080, 1350], [1600, 900],
  [1200, 1500], [1500, 1000], [1080, 1440], [1600, 1200], [1300, 1600],
];
const PALET: [string, string][] = [
  ["#4f46e5", "#001e64"], ["#e11d48", "#4a0d21"], ["#0f7a55", "#022c22"],
  ["#eda100", "#4a2d00"], ["#0ea5e9", "#082f49"], ["#7c3aed", "#2e1065"],
  ["#f97316", "#431407"], ["#14b8a6", "#042f2e"], ["#db2777", "#500724"],
  ["#001e64", "#4f46e5"],
];

interface Uretilen {
  type: "image" | "video";
  file: File;
  w?: number;
  h?: number;
}

/** Tek kare: yumuşak degrade + halkalar + büyük numara ("prova" olduğu belli). */
function kareCiz(ctx: CanvasRenderingContext2D, w: number, h: number, i: number, t: number) {
  const [a, b] = PALET[i % PALET.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(4, w * 0.012);
  for (let k = 0; k < 5; k++) {
    const r = (0.16 + k * 0.13) * Math.min(w, h) * (1 + 0.06 * Math.sin(t * 1.6 + k));
    ctx.beginPath();
    ctx.arc(w * (0.5 + 0.12 * Math.sin(t + k)), h * (0.5 + 0.1 * Math.cos(t * 0.8 + k)), r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.34)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(String(i + 1), w / 2, h / 2);
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.055)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("PROVA · örnek medya", w / 2, h * 0.5 + Math.min(w, h) * 0.24);
  ctx.globalAlpha = 1;
}

async function fotoUret(i: number): Promise<Uretilen> {
  const [w, h] = OLCU[i % OLCU.length];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Tuval açılamadı.");
  kareCiz(ctx, w, h, i, 0.6);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Görsel üretilemedi.");
  return { type: "image", file: new File([blob], `prova-${i + 1}.jpg`, { type: "image/jpeg" }), w, h };
}

function videoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Kısa videoları PARTİ HÂLİNDE kaydeder: bir partideki hepsini tek rAF döngüsü
 * çizer. Tek tek kaydetmek yarım dakika sürüyordu; onunu birden kaydetmek ise
 * telefonda 10 kodlayıcı + 10 tuval demek (bu üründe Android'de RAM ölümü daha
 * önce kare kaybettirmişti). Dörderli parti ikisinin ortası.
 */
async function videoPartisi(adet: number, ilkIndex: number, sure: number): Promise<Uretilen[]> {
  const mime = videoMime();
  if (!mime) return [];
  const uzanti = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const kanallar = Array.from({ length: adet }, (_, k) => {
    const i = ilkIndex + k;
    const dikey = i % 3 === 2;
    const w = dikey ? 480 : 854;
    const h = dikey ? 854 : 480;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 800_000 });
    const parcalar: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) parcalar.push(e.data);
    };
    return { i, w, h, ctx, rec, parcalar, stream };
  });

  kanallar.forEach((k) => k.rec.start());
  const bas = performance.now();
  await new Promise<void>((bitti) => {
    const adim = () => {
      const t = (performance.now() - bas) / 1000;
      for (const k of kanallar) kareCiz(k.ctx, k.w, k.h, k.i, t);
      if (performance.now() - bas >= sure) bitti();
      else requestAnimationFrame(adim);
    };
    requestAnimationFrame(adim);
  });

  return Promise.all(
    kanallar.map(
      (k) =>
        new Promise<Uretilen>((cozum) => {
          k.rec.onstop = () => {
            k.stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(k.parcalar, { type: mime.split(";")[0] });
            cozum({
              type: "video",
              file: new File([blob], `prova-${k.i + 1}.${uzanti}`, { type: mime.split(";")[0] }),
              w: k.w,
              h: k.h,
            });
          };
          k.rec.stop();
        })
    )
  );
}

/** N kısa video — 4'erli partiler hâlinde (bellek dostu). */
async function videoUret(adet: number, parti = 4, sure = 2500): Promise<Uretilen[]> {
  if (!videoMime()) return [];
  const hepsi: Uretilen[] = [];
  for (let i = 0; i < adet; i += parti) {
    hepsi.push(...(await videoPartisi(Math.min(parti, adet - i), i, sure)));
  }
  return hepsi;
}

export default function WallProvaPage() {
  const { code } = useParams<{ code: string }>();
  const authed = useAdminGate();

  const [wallId, setWallId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (/^\d{6}$/.test(code)) {
      resolveCode(code).then((t) => setWallId(t?.kind === "wall" ? t.id : null)).catch(() => setWallId(null));
    } else {
      setWallId(code);
    }
  }, [code]);

  const { wall } = useWall(wallId ?? null);

  // Misafirler (bot) — duvarda "katılımcı" koleksiyonu yok, yerelde tutulur.
  const [nText, setNText] = useState("20");
  const n = Math.max(1, Math.min(500, Math.floor(Number(nText) || 0)));
  const nGecerli = /^\d+$/.test(nText) && n >= 1;
  const botsRef = useRef<WallBot[]>([]);
  const [misafir, setMisafir] = useState(0);

  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asama, setAsama] = useState("");
  const [tepkiMul, setTepkiMul] = useState(1);
  const [begeniMul, setBegeniMul] = useState(1);
  const [dilekAcik, setDilekAcik] = useState(true);
  const [gezmeAcik, setGezmeAcik] = useState(true);
  const [sayac, setSayac] = useState({ tepki: 0, begeni: 0, dilek: 0, medya: 0, cekilis: 0, oy: 0 });
  const sayacRef = useRef({ tepki: 0, begeni: 0, dilek: 0, medya: 0, cekilis: 0, oy: 0 });

  // Beğeni/yarışma oyu için medya listesi — TEK dinleyici (misafir başına
  // dinleyici açmak ölçeklenmez; perde zaten aynı listeyi izliyor).
  const medyaRef = useRef<WallMedia[]>([]);
  const wallRef = useRef(wall);
  useEffect(() => {
    if (!wallId) return;
    return watchWallMediaRecent(wallId, 60, (m) => {
      // Misafirin gördüğü ne ise o: onaylı + AKTİF oturum. Eski oturumun
      // medyasını beğenmek perdede zaten görünmeyen kareyi şişirirdi.
      medyaRef.current = m.filter((x) => x.status === "approved" && isCurrentSession(x, wallRef.current));
    });
  }, [wallId]);

  useEffect(() => {
    wallRef.current = wall;
  }, [wall]);
  const cfgRef = useRef({ tepkiMul, begeniMul, dilekAcik, gezmeAcik });
  useEffect(() => {
    cfgRef.current = { tepkiMul, begeniMul, dilekAcik, gezmeAcik };
  }, [tepkiMul, begeniMul, dilekAcik, gezmeAcik]);

  // Tek seferlik davranışlar: kim çekilişe kaydoldu, kim yarışmada oy verdi.
  const kayitliRef = useRef<Set<string>>(new Set());
  const oyVerenRef = useRef<Set<string>>(new Set());
  // Reddedilen tek-seferlik yazımlar tekrar denenir ama SINIRLI: kapı gerçekten
  // kapalıysa (ör. süresi dolmuş yarışma) her tik yeniden denemek hata yağmuru
  // olur ve kotayı boşuna yer.
  const denemeRef = useRef<Record<string, number>>({});
  const denenebilir = (k: string) => (denemeRef.current[k] ?? 0) < 3;
  const denendi = (k: string) => {
    denemeRef.current[k] = (denemeRef.current[k] ?? 0) + 1;
  };
  const oyContestRef = useRef<string>("");
  const excitementRef = useRef(1);
  const gezmeRef = useRef(0);

  type Tur = "tepki" | "beğeni" | "dilek" | "medya" | "çekiliş" | "oy" | "gezme" | "bilgi" | "hata";
  const logRef = useRef<{ id: number; tur: Tur; metin: string }[]>([]);
  const logIdRef = useRef(0);
  const [log, setLog] = useState<typeof logRef.current>([]);
  const kaydet = (tur: Tur, metin: string) => {
    logRef.current = [{ id: ++logIdRef.current, tur, metin }, ...logRef.current].slice(0, 80);
  };
  const hataRef = useRef<Record<string, number>>({});
  const hata = (ne: string, e: unknown) => {
    const k = `${ne} yazılamadı — ${e instanceof Error ? e.message : String(e)}`;
    hataRef.current[k] = (hataRef.current[k] ?? 0) + 1;
  };
  const hatalariBas = () => {
    const b = hataRef.current;
    hataRef.current = {};
    for (const [k, v] of Object.entries(b)) kaydet("hata", v > 1 ? `${k} (×${v})` : k);
  };
  const bas = () => {
    hatalariBas();
    setLog([...logRef.current]);
    setSayac({ ...sayacRef.current });
  };

  const misafirEkle = useCallback(() => {
    const yeni = makeWallBots(n, botsRef.current.length);
    botsRef.current = [...botsRef.current, ...yeni];
    setMisafir(botsRef.current.length);
    kaydet("bilgi", `${yeni.length} misafir geldi (toplam ${botsRef.current.length})`);
    // Misafir varsa motor çalışsın: bot eklenmiş ama motor kapalıyken
    // "hiçbir şey olmuyor" görüntüsü oluşuyordu.
    setRunning((r) => {
      if (!r) kaydet("bilgi", "Prova başladı — misafirler kendiliğinden hareket ediyor.");
      return true;
    });
    setLog([...logRef.current]);
  }, [n]);

  // ── Ana döngü ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running || !wallId) return;
    const dt = TICK_MS / 1000;
    const iv = window.setInterval(() => {
      const w = wallRef.current;
      const bots = botsRef.current;
      if (!w || !bots.length) return;
      const cfg = cfgRef.current;
      const kapali = w.closed === true;

      // 1) Tepki yağmuru — dalga dalga (gerçek etkinlikte de öyle gelir).
      let ex = 1 + (excitementRef.current - 1) * 0.9;
      if (Math.random() < 0.02) ex = 2.5 + Math.random() * 2;
      excitementRef.current = ex;
      const tBeklenen = bots.reduce((a, b) => a + b.reactionRate, 0) * cfg.tepkiMul * ex * dt;
      const tAdet = Math.min(REACTION_CAP, Math.floor(tBeklenen) + (Math.random() < tBeklenen % 1 ? 1 : 0));
      for (let i = 0; i < tAdet; i++) {
        fireWallReaction(wallId).catch((e) => hata("tepki", e));
        sayacRef.current.tepki++;
      }

      // 2) Beğeni — onaylı medya üzerinde (perdede "en çok sevilen" şeridi bundan doğar)
      const medya = medyaRef.current;
      if (medya.length) {
        const bBeklenen = bots.reduce((a, b) => a + b.likeRate, 0) * cfg.begeniMul * dt;
        const bAdet = Math.min(12, Math.floor(bBeklenen) + (Math.random() < bBeklenen % 1 ? 1 : 0));
        for (let i = 0; i < bAdet; i++) {
          const m = medya[Math.floor(Math.random() * medya.length)];
          fireLike(wallId, m.id).catch((e) => hata("beğeni", e));
          sayacRef.current.begeni++;
        }
      }

      // 3) Dilekler — duvar ayarı kapalıysa kurallar zaten reddeder, hiç deneme.
      if (cfg.dilekAcik && w.wishesEnabled !== false && !kapali) {
        const dBeklenen = bots.reduce((a, b) => (b.wishEvery ? a + dt / (b.wishEvery / 1000) : a), 0);
        const dAdet = Math.min(3, Math.floor(dBeklenen) + (Math.random() < dBeklenen % 1 ? 1 : 0));
        for (let i = 0; i < dAdet; i++) {
          const bot = bots[Math.floor(Math.random() * bots.length)];
          fireWish(wallId, bot, w.moderation === true)
            .then((t) => kaydet("dilek", `${bot.nickname}: ${t}`))
            .catch((e) => hata("dilek", e));
          sayacRef.current.dilek++;
        }
      }

      // Çekiliş kaldırıldıysa/yenilendiyse işaretleri sıfırla: kayıtlar da
      // silinmiş olur, yoksa misafirler bir daha hiç kaydolmazdı.
      if (!w.raffle) {
        if (kayitliRef.current.size) kayitliRef.current = new Set();
        for (const k of Object.keys(denemeRef.current)) if (k.startsWith("c-")) delete denemeRef.current[k];
      }

      // 4) Çekiliş kaydı — yalnız kayıt türü + kayıt penceresi açıkken; her
      //    misafir BİR kez (sicil doc id, aynı sicil tek kayıt). Tik başına
      //    birkaç kişi: gerçek etkinlikte de sıra sıra kaydolurlar.
      if (w.raffle?.type === "registration" && raffleRegistrationOpen(w)) {
        const bekleyen = bots.filter(
          (b) => !kayitliRef.current.has(b.sicil) && denenebilir(`c-${b.sicil}`)
        );
        for (const bot of bekleyen.slice(0, 2)) {
          if (Math.random() > 0.5) continue;
          kayitliRef.current.add(bot.sicil);
          denendi(`c-${bot.sicil}`);
          fireRaffleEntry(wallId, bot)
            .then(() => kaydet("çekiliş", `${bot.nickname} kaydoldu · ${bot.sicil}`))
            .catch((e) => {
              kayitliRef.current.delete(bot.sicil); // reddedildiyse tekrar denensin
              hata("çekiliş kaydı", e);
            });
          sayacRef.current.cekilis++;
        }
      }

      // 5) Yarışma oyu — yarışma değişirse herkes yeniden oy verir (yeni contestId).
      const contest = w.contest;
      // Süresi dolmuş yarışmada kurallar oy kabul etmez (+2 sn tolerans);
      // kokpit "ended"a çevirmeden önce denemek boşa yazım olurdu.
      const yarismaSuresiVar =
        !contest?.endsAt?.toMillis?.() || Date.now() < contest.endsAt.toMillis();
      if (contest && contest.status === "running" && yarismaSuresiVar && medya.length) {
        if (oyContestRef.current !== contest.id) {
          oyContestRef.current = contest.id;
          oyVerenRef.current = new Set();
        }
        const bekleyen = bots.filter(
          (b) => !oyVerenRef.current.has(b.voterId) && denenebilir(`y-${contest.id}-${b.voterId}`)
        );
        for (const bot of bekleyen.slice(0, 3)) {
          if (Math.random() > 0.4) continue;
          oyVerenRef.current.add(bot.voterId);
          denendi(`y-${contest.id}-${bot.voterId}`);
          // Beğeni gibi: baştaki karelere eğilim (herkes ilk gördüğüne oy verir).
          const m = medya[Math.floor(Math.pow(Math.random(), 1.6) * medya.length)];
          fireContestVote(wallId, bot, contest.id, m.id)
            .then(() => kaydet("oy", `${bot.nickname} yarışmada oy verdi`))
            .catch((e) => {
              oyVerenRef.current.delete(bot.voterId);
              hata("yarışma oyu", e);
            });
          sayacRef.current.oy++;
        }
      }

      // 6) Gezme — misafir galeriyi açar (tek okuma turu). Seyrek tutuldu:
      //    her açılış tüm onaylı medyayı okur, kotayı boşuna yemesin.
      if (cfg.gezmeAcik && Date.now() - gezmeRef.current > 20000) {
        gezmeRef.current = Date.now();
        const bot = bots[Math.floor(Math.random() * bots.length)];
        fetchApprovedMedia(wallId)
          .then((m) => kaydet("gezme", `${bot.nickname} galeriyi gezdi — ${m.length} medya`))
          .catch((e) => hata("galeri", e));
      }
    }, TICK_MS);

    const statIv = window.setInterval(bas, 1000);
    return () => {
      window.clearInterval(iv);
      window.clearInterval(statIv);
    };
  }, [running, wallId]);

  // ── Medya gönderimi (gerçek yükleme yolu) ─────────────────────────────────
  const [done, setDone] = useState(0);
  const [toplam, setToplam] = useState(0);
  const medyaGonder = useCallback(async () => {
    const w = wallRef.current;
    if (!wallId || !w || busy) return;
    if (!isCloudinaryConfigured()) {
      kaydet("hata", "Cloudinary yapılandırılmamış — örnek medya yüklenemez.");
      setLog([...logRef.current]);
      return;
    }
    setBusy(true);
    setDone(0);
    let uretilen: Uretilen[] = [];
    try {
      setAsama("Fotoğraflar üretiliyor…");
      const fotolar = await Promise.all(Array.from({ length: 10 }, (_, i) => fotoUret(i)));
      setAsama("Videolar kaydediliyor…");
      const videolar = w.allowVideo === false ? [] : await videoUret(10);
      if (w.allowVideo === false) kaydet("bilgi", "Duvarda video kapalı — yalnız fotoğraf gönderilecek.");
      else if (!videolar.length) kaydet("bilgi", "Bu tarayıcı video kaydını desteklemiyor — yalnız fotoğraf.");
      for (let i = 0; i < 10; i++) {
        uretilen.push(fotolar[i]);
        if (videolar[i]) uretilen.push(videolar[i]);
      }
    } catch (e) {
      hata("örnek medya üretimi", e);
      uretilen = [];
    }

    setToplam(uretilen.length);
    for (let i = 0; i < uretilen.length; i++) {
      const it = uretilen[i];
      const bot = botsRef.current[i % Math.max(1, botsRef.current.length)];
      setAsama(`${it.type === "video" ? "Video" : "Fotoğraf"} yükleniyor… (${i + 1}/${uretilen.length})`);
      try {
        // MİSAFİRLE AYNI YOL + AYNI KLASÖR: duvar silinince ön ek temizliği alır.
        const res = await uploadToCloudinary(it.file, `walls/${wallId}/${w.sessionId ?? "s"}`, () => {}, {
          keepOriginal: !!w.keepOriginal,
        });
        await addWallMedia(
          wallId,
          {
            voterId: bot?.voterId ?? `prova-${i}`,
            nickname: bot?.nickname ?? "Prova misafiri",
            type: res.type,
            cloudinaryId: res.cloudinaryId,
            url: res.url,
            w: res.w ?? it.w,
            h: res.h ?? it.h,
            durationMs: res.durationMs,
          },
          !!w.moderation,
          w.sessionId
        );
        sayacRef.current.medya++;
        setDone(i + 1);
      } catch (e) {
        hata(`medya #${i + 1}`, e);
      }
      bas();
    }
    setAsama("");
    setBusy(false);
    kaydet(
      "bilgi",
      `Medya gönderimi bitti: ${sayacRef.current.medya} kayıt.` +
        (w.moderation ? " Moderasyon AÇIK — perdede görünmesi için Yönet'ten onayla." : "")
    );
    bas();
  }, [wallId, busy]);

  if (authed === null) return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/60">Yükleniyor…</main>;
  if (!authed) return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/60 px-6 text-center">Bu sayfa sadece yöneticilere açık.</main>;

  const cekilisAcik = wall?.raffle?.type === "registration" && raffleRegistrationOpen(wall);
  const yarismaAcik = wall?.contest?.status === "running";

  return (
    <main className="min-h-screen bg-[#05091c] text-white [color-scheme:dark] p-4 sm:p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div>
          <a href="/admin/prova" className="text-white/50 hover:text-white text-sm">← Prova &amp; sağlık</a>
          <p className="uppercase tracking-widest text-xs text-white/50 mt-2">FlowWall provası</p>
          {wallId === undefined ? (
            <h1 className="text-2xl font-bold">Çözülüyor…</h1>
          ) : wallId === null ? (
            <h1 className="text-2xl font-bold text-[#ff9db3]">Duvar bulunamadı: {code}</h1>
          ) : (
            <>
              <h1 className="text-2xl font-bold truncate">{wall?.title ?? wallId}</h1>
              <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                <Rozet on={wall?.moderation === true} ac="Moderasyon açık" kapa="Moderasyon kapalı" />
                <Rozet on={wall?.allowVideo !== false} ac="Video açık" kapa="Video kapalı" />
                <Rozet on={wall?.wishesEnabled !== false} ac="Dilekler açık" kapa="Dilekler kapalı" />
                <Rozet on={!!cekilisAcik} ac="Çekiliş kaydı açık" kapa="Çekiliş kaydı yok" />
                <Rozet on={!!yarismaAcik} ac="Yarışma sürüyor" kapa="Yarışma yok" />
                <Rozet on={wall?.closed !== true} ac="Duvar açık" kapa="Duvar kapalı" />
              </div>
            </>
          )}
        </div>

        {wallId && (
          <>
            <div className="rounded-3xl bg-white/5 border border-white/12 p-5">
              <p className="uppercase tracking-widest text-xs text-white/50 mb-3">Misafir</p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  value={nText}
                  onChange={(e) => setNText(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  onBlur={() => setNText(String(n))}
                  className="w-24 py-2 text-center tabular-nums rounded-xl bg-white/10 border border-white/15 outline-none focus:border-white/40"
                />
                <button
                  onClick={misafirEkle}
                  disabled={!nGecerli}
                  className="py-2 px-5 text-sm rounded-full bg-white text-[#05091c] font-semibold disabled:opacity-40"
                >
                  + {nGecerli ? n : "…"} misafir
                </button>
                <span className="text-white/60 text-sm tabular-nums">Duvarda: {misafir}</span>
              </div>
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/12 p-5 flex flex-col gap-4">
              <p className="uppercase tracking-widest text-xs text-white/50">Aktiflik</p>
              <Slider label={`Tepki yoğunluğu ×${tepkiMul}`} min={0} max={3} step={0.5} value={tepkiMul} onChange={setTepkiMul} />
              <Slider label={`Beğeni yoğunluğu ×${begeniMul}`} min={0} max={3} step={0.5} value={begeniMul} onChange={setBegeniMul} />
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm">
                <input type="checkbox" checked={dilekAcik} onChange={(e) => setDilekAcik(e.target.checked)} className="w-5 h-5 accent-[#4f46e5]" />
                Dilek bıraksınlar
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm">
                <input type="checkbox" checked={gezmeAcik} onChange={(e) => setGezmeAcik(e.target.checked)} className="w-5 h-5 accent-[#4f46e5]" />
                Galeriyi gezsinler <span className="text-white/50 text-xs">(20 sn'de bir okuma turu)</span>
              </label>
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  onClick={() => setRunning((r) => !r)}
                  disabled={misafir === 0}
                  className={`py-2.5 px-6 text-sm rounded-full font-semibold disabled:opacity-40 ${
                    running ? "border border-[#ff9db3] text-[#ff9db3]" : "bg-white text-[#05091c]"
                  }`}
                >
                  {running ? "■ Durdur" : "▶ Başlat"}
                </button>
                <button
                  onClick={() => void medyaGonder()}
                  disabled={busy}
                  className="py-2.5 px-5 text-sm rounded-full border border-white/25 hover:border-white/50 disabled:opacity-40"
                >
                  {busy ? asama || `Gönderiliyor… ${done}/${toplam}` : "＋ 10 foto + 10 video gönder"}
                </button>
              </div>
              {busy && toplam > 0 && (
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-white transition-[width]" style={{ width: `${(done / toplam) * 100}%` }} />
                </div>
              )}
              <p className="text-white/50 text-xs">
                Çekiliş kaydı ve yarışma oyu <b>kendiliğinden</b> devreye girer: Yönet ekranından çekilişi/yarışmayı
                başlattığın anda misafirler kaydolmaya ve oy vermeye başlar.
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/12 p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="uppercase tracking-widest text-xs text-white/50">Canlı</p>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${running ? "bg-[#1baf7a]/20 text-[#7ef0c2]" : "bg-white/10 text-white/50"}`}>
                  <span className={`w-2 h-2 rounded-full ${running ? "bg-[#7ef0c2] animate-pulse" : "bg-white/40"}`} />
                  {running ? "Çalışıyor" : "Durdu"}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <Stat label="tepki" value={sayac.tepki} />
                <Stat label="beğeni" value={sayac.begeni} />
                <Stat label="dilek" value={sayac.dilek} />
                <Stat label="medya" value={sayac.medya} />
                <Stat label="çekiliş" value={sayac.cekilis} />
                <Stat label="oy" value={sayac.oy} />
              </div>

              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <p className="uppercase tracking-widest text-xs text-white/50">İşlem akışı</p>
                  <p className="text-white/40 text-[11px]">tepki/beğeni yazılmaz — sayaçta</p>
                </div>
                {log.length === 0 ? (
                  <p className="text-white/50 text-sm py-3">Henüz işlem yok.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/12 divide-y divide-white/8">
                    {log.map((o) => (
                      <p key={o.id} className="px-3 py-1.5 text-xs flex items-start gap-2">
                        <span className={`shrink-0 font-bold ${o.tur === "hata" ? "text-[#ff9db3]" : o.tur === "bilgi" ? "text-white/40" : "text-white/70"}`}>
                          {o.tur === "bilgi" ? "·" : o.tur}
                        </span>
                        <span className="min-w-0 break-words text-white/85">{o.metin}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-5 text-sm">
                <a href={`/wall/${wallId}`} target="_blank" className="text-white/60 hover:text-white">Perde ↗</a>
                <a href={`/wall/${wallId}/manage`} target="_blank" className="text-white/60 hover:text-white">Yönet ↗</a>
                <a href={`/g/${wallId}`} target="_blank" className="text-white/60 hover:text-white">Galeri ↗</a>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Rozet({ on, ac, kapa }: { on: boolean; ac: string; kapa: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 border ${on ? "bg-[#1baf7a]/15 border-[#1baf7a]/40 text-[#7ef0c2]" : "bg-white/5 border-white/12 text-white/45"}`}>
      {on ? ac : kapa}
    </span>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold block mb-1">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#4f46e5]" />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl py-3 bg-white/8">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-white/50 text-xs">{label}</p>
    </div>
  );
}
