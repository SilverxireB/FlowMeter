"use client";

/**
 * ⚠️ TEST/DEV ARACI — gizli link. Kaldırmak için: bu dosyayı (src/app/dev/)
 * ve src/lib/sim.ts'i sil. Kullanıcıya değmez: ?k=<SIM_SECRET> yoksa açılmaz,
 * hiçbir yerden linklenmez. Gerçek izleyici gibi anonim yazar (rules değişmez).
 *
 * Amaç: N katılımcı + gerçekçi personalarla (hevesli, meraklı, sohbetçi,
 * aktif, sessiz) GERÇEK bir oturumu insanca oranlarda taklit etmek.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePresentation, useQuestions, useSlides } from "@/lib/hooks";
import { newSession, resolveJoinCode } from "@/lib/presentations";
import {
  Bot,
  SIM_SECRET,
  fireMessage,
  fireQuestion,
  fireReaction,
  fireResponse,
  isVotingSlide,
  joinBots,
  makeBots,
  upvoteQuestion,
} from "@/lib/sim";
import { Slide } from "@/lib/types";

const TICK_MS = 250;
const VOTE_WINDOW = 7000;
// Güvenlik tavanı: gerçekçi modda normalde çok altında kalır; kaçak yükü keser.
const REACTIONS_PER_TICK_CAP = 40; // ~160 tepki/sn tavan (250 ms tick)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SimPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("k");
    setAuthed(k === SIM_SECRET);
  }, []);

  // 6 haneli kod da kabul et: koddan sunum id'sini çöz. undefined=çözülüyor, null=yok.
  const [pid, setPid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (/^\d{6}$/.test(rawId)) {
      resolveJoinCode(rawId).then((r) => setPid(r)).catch(() => setPid(null));
    } else {
      setPid(rawId);
    }
  }, [rawId]);
  const id = pid ?? "";

  const { presentation } = usePresentation(id || null);
  const { slides } = useSlides(id || null);
  const questions = useQuestions(id || null);

  const [n, setN] = useState(100);
  const [reactionMul, setReactionMul] = useState(1);
  const [qnaMul, setQnaMul] = useState(1);
  const [chatOn, setChatOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [joined, setJoined] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ reactions: 0, votes: 0, questions: 0, messages: 0, wps: 0 });

  // Runner refs
  const botsRef = useRef<Bot[]>([]);
  const questionIdsRef = useRef<string[]>([]);
  const slideRef = useRef<Slide | null>(null);
  const voteQueueRef = useRef<{ bot: Bot; dueAt: number; willVote: boolean }[]>([]);
  const votedRef = useRef<Set<string>>(new Set()); // bu slaytta oyu işlenen botlar
  const slideStartRef = useRef(0);
  const cfgRef = useRef({ reactionMul, qnaMul, chatOn });
  const sidRef = useRef<string | undefined>(undefined);
  const countRef = useRef({ reactions: 0, votes: 0, questions: 0, messages: 0 });
  const wpsRef = useRef({ last: 0, acc: 0 });
  // Tepki "an" zarfı: gerçek izleyicilerde tepkiler dalga dalga gelir.
  const excitementRef = useRef(1);

  useEffect(() => {
    cfgRef.current = { reactionMul, qnaMul, chatOn };
  }, [reactionMul, qnaMul, chatOn]);
  useEffect(() => {
    questionIdsRef.current = questions.filter((q) => !q.hidden).map((q) => q.id);
  }, [questions]);
  useEffect(() => {
    sidRef.current = presentation?.sessionId;
  }, [presentation?.sessionId]);

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const activeSlide: Slide | undefined = rawIndex < 0 ? undefined : slides[Math.min(rawIndex, slides.length - 1)];

  /** Quiz slaytında bitiş anı (ms) — süre bittiyse/başlamadıysa null. */
  const quizDeadline = (slide: Slide): number | null => {
    if (slide.type !== "quiz" && slide.type !== "quiz-type") return Infinity;
    const started = slide.quizStartedAt?.toMillis?.();
    if (!started) return null; // quiz başlamadı → oy yok
    return started + (slide.settings?.timeLimit ?? 20) * 1000;
  };

  /** Verilen (henüz oy vermemiş) botlar için mutlak-zamanlı oy kuyruğu üretir. */
  const buildQueue = useCallback((bots: Bot[]) => {
    const slide = slideRef.current;
    const now = Date.now();
    let cap = 3200;
    if (slide) {
      const dl = quizDeadline(slide);
      if (dl === null) return []; // quiz başlamadı
      if (now >= dl - 250) return []; // süre bitti → oy yok
      if (dl !== Infinity) cap = Math.max(300, Math.min(cap, dl - now - 250));
    }
    return bots
      .filter((b) => !votedRef.current.has(b.voterId))
      .map((b) => ({
        bot: b,
        dueAt: now + 400 + Math.random() * cap,
        willVote: Math.random() < b.voteProb,
      }));
  }, []);

  /** Tüm mevcut botları aktif slaytta HEMEN oylat (anında sonuç / teşhis). */
  const voteAllNow = useCallback(() => {
    const slide = slideRef.current;
    if (!slide || !isVotingSlide(slide) || !id) return;
    const dl = quizDeadline(slide);
    if (dl === null || Date.now() >= dl) return; // quiz süresi dolduysa oy yok
    let fired = 0;
    for (const b of botsRef.current) {
      if (votedRef.current.has(b.voterId)) continue;
      votedRef.current.add(b.voterId);
      fireResponse(id, slide, b.voterId, sidRef.current).catch(() => {});
      fired++;
    }
    voteQueueRef.current = [];
    countRef.current.votes += fired;
    setStats((s) => ({ ...s, votes: countRef.current.votes }));
  }, [id]);

  // Slaytın GÜNCEL halini her snapshot'ta taşı: quizStartedAt sunum sırasında
  // aynı slayt id'siyle sonradan gelir; sadece id'ye bakmak quiz oylarını kilitler.
  useEffect(() => {
    slideRef.current = activeSlide ?? null;
  }, [activeSlide]);

  // Aktif slayt DEĞİŞİNCE: işaretleri sıfırla + mevcut botlar için kuyruğu kur
  useEffect(() => {
    slideStartRef.current = Date.now();
    votedRef.current = new Set();
    voteQueueRef.current =
      activeSlide && isVotingSlide(activeSlide) ? buildQueue(botsRef.current) : [];
  }, [activeSlide?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = (k: keyof typeof countRef.current, by = 1) => {
    countRef.current[k] += by;
    wpsRef.current.acc += by;
  };

  // Ana döngü
  useEffect(() => {
    if (!running || !id) return;
    const dt = TICK_MS / 1000;
    const tid = id;

    const iv = window.setInterval(() => {
      const cfg = cfgRef.current;
      // Oranları her tick canlı hesapla → kademeli gelen botlar rampalanır
      const bots = botsRef.current;
      const reactorRateSum = bots.reduce((a, b) => a + b.reactionRate, 0);
      const questioners = bots.filter((b) => b.questionEvery > 0);
      const chatters = bots.filter((b) => b.chatEvery > 0);

      // 1) Tepkiler — gerçek izleyici gibi: düşük taban + ara sıra "an" dalgaları.
      // Zarf her tick 1'e doğru söner; ~20 sn'de bir kısa bir heyecan dalgası olur.
      let ex = 1 + (excitementRef.current - 1) * 0.92;
      if (Math.random() < 0.012) ex = 2.5 + Math.random() * 1.5;
      excitementRef.current = ex;
      const rExpected = reactorRateSum * cfg.reactionMul * ex * dt;
      const rc = Math.min(
        REACTIONS_PER_TICK_CAP,
        Math.floor(rExpected) + (Math.random() < rExpected % 1 ? 1 : 0)
      );
      for (let i = 0; i < rc; i++) {
        fireReaction(tid).catch(() => {});
        bump("reactions");
      }

      // 2) Oylar — aktif oy slaytında kuyruk (kendini onarır) + zamanı gelenler
      const slide = slideRef.current;
      if (slide && isVotingSlide(slide)) {
        const now = Date.now();
        // kuyruğa hiç girmemiş & oyu işlenmemiş botları ekle (botlar sonradan eklenmiş olabilir)
        const inFlight = new Set(voteQueueRef.current.map((v) => v.bot.voterId));
        const missing = botsRef.current.filter(
          (b) => !votedRef.current.has(b.voterId) && !inFlight.has(b.voterId)
        );
        if (missing.length) voteQueueRef.current.push(...buildQueue(missing));
        // zamanı gelenleri oyla (skip edenleri de işaretle ki tekrar kuyruğa girmesin)
        const due = voteQueueRef.current.filter((v) => v.dueAt <= now);
        if (due.length) {
          voteQueueRef.current = voteQueueRef.current.filter((v) => v.dueAt > now);
          for (const v of due) {
            if (votedRef.current.has(v.bot.voterId)) continue;
            votedRef.current.add(v.bot.voterId);
            if (v.willVote) {
              fireResponse(tid, slide, v.bot.voterId, sidRef.current).catch(() => {});
              bump("votes");
            }
          }
        }
      }

      // 3) Q&A — sorular + upvote
      const qExpected = questioners.reduce((a, b) => a + dt / (b.questionEvery / 1000), 0) * cfg.qnaMul;
      let qn = Math.floor(qExpected) + (Math.random() < qExpected % 1 ? 1 : 0);
      qn = Math.min(6, qn);
      for (let i = 0; i < qn && questioners.length; i++) {
        fireQuestion(tid, questioners[Math.floor(Math.random() * questioners.length)].voterId).catch(() => {});
        bump("questions");
      }
      const ids = questionIdsRef.current;
      if (ids.length) {
        const upExpected = questioners.length * dt * 0.4 * cfg.qnaMul;
        let un = Math.floor(upExpected) + (Math.random() < upExpected % 1 ? 1 : 0);
        un = Math.min(6, un);
        for (let i = 0; i < un; i++) {
          upvoteQuestion(tid, ids[Math.floor(Math.random() * ids.length)], 0).catch(() => {});
        }
      }

      // 4) Sohbet
      if (cfg.chatOn && chatters.length) {
        const cExpected = chatters.reduce((a, b) => a + dt / (b.chatEvery / 1000), 0);
        let cn = Math.floor(cExpected) + (Math.random() < cExpected % 1 ? 1 : 0);
        cn = Math.min(6, cn);
        for (let i = 0; i < cn; i++) {
          fireMessage(tid, chatters[Math.floor(Math.random() * chatters.length)]).catch(() => {});
          bump("messages");
        }
      }
    }, TICK_MS);

    // İstatistik yenileme (yazma/sn dahil)
    const statIv = window.setInterval(() => {
      const now = Date.now();
      const w = wpsRef.current;
      const secs = w.last ? (now - w.last) / 1000 : 1;
      const wps = Math.round(w.acc / Math.max(0.001, secs));
      w.acc = 0;
      w.last = now;
      setStats({ ...countRef.current, wps });
    }, 1000);

    return () => {
      window.clearInterval(iv);
      window.clearInterval(statIv);
    };
  }, [running, id]);

  // Kademeli katılım: botlar ~15-20 sn'ye yayılarak gelir (gerçekçi + izlenebilir)
  const join = useCallback(async () => {
    setBusy(true);
    try {
      const bots = makeBots(n);
      const windowMs = 15000 + Math.random() * 5000;
      const chunks = Math.min(bots.length, 20);
      const size = Math.ceil(bots.length / chunks);
      for (let i = 0; i < bots.length; i += size) {
        const slice = bots.slice(i, i + size);
        await joinBots(id, slice, sidRef.current);
        botsRef.current = [...botsRef.current, ...slice];
        setJoined(botsRef.current.length);
        if (i + size < bots.length) await sleep((windowMs / chunks) * (0.5 + Math.random()));
      }
    } finally {
      setBusy(false);
    }
  }, [id, n]);

  const clearAll = useCallback(async () => {
    if (!confirm("Yeni oturum (taze kapsam) başlatılsın mı? Silme yapılmaz; eski veri saklı kalır, ekran sıfırdan başlar.")) return;
    setRunning(false);
    setBusy(true);
    try {
      await newSession(id, { live: true }); // silmez, anında; kodu korur
      botsRef.current = [];
      voteQueueRef.current = [];
      countRef.current = { reactions: 0, votes: 0, questions: 0, messages: 0 };
      setJoined(0);
      setStats({ reactions: 0, votes: 0, questions: 0, messages: 0, wps: 0 });
    } finally {
      setBusy(false);
    }
  }, [id]);

  if (authed === null) return <main className="min-h-screen grid place-items-center text-muted">…</main>;
  if (!authed) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash">
        <p className="text-muted">404 — sayfa bulunamadı.</p>
      </main>
    );
  }
  if (pid === undefined) {
    return <main className="min-h-screen grid place-items-center bg-wash"><p className="text-muted animate-pulse">Sunum çözülüyor…</p></main>;
  }
  if (pid === null || !id) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Sunum bulunamadı</p>
          <p className="text-muted">Bu kod/id ({rawId}) geçerli bir sunuma karşılık gelmiyor.</p>
        </div>
      </main>
    );
  }

  const personaCounts = botsRef.current.reduce<Record<string, number>>((a, b) => {
    a[b.persona] = (a[b.persona] ?? 0) + 1;
    return a;
  }, {});

  return (
    <main className="min-h-screen bg-wash p-4 sm:p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow text-accent">Gerçekçi oturum simülasyonu</p>
            <h1 className="font-display text-2xl font-semibold">{presentation?.title ?? id}</h1>
            <p className="text-muted text-sm">
              Kod {presentation?.joinCode} · slayt {rawIndex < 0 ? "Katılım" : `${rawIndex + 1}/${slides.length}`}
              {activeSlide
                ? ` · ${activeSlide.type} ${isVotingSlide(activeSlide) ? "✓ oy alır" : "✗ oy YOK"}`
                : " · katılım ekranı (oy YOK)"}
            </p>
          </div>
          <a href={`/present/${id}`} target="_blank" className="btn-ghost !py-2 !px-4 text-sm">
            Present ↗
          </a>
        </div>

        {/* Katılımcı üret */}
        <div className="card p-5">
          <p className="eyebrow mb-3">Katılımcı</p>
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="number"
              min={1}
              max={3000}
              value={n}
              onChange={(e) => setN(Math.max(1, Math.min(3000, Number(e.target.value))))}
              className="input-base !w-28 !py-2 text-center tabular-nums"
            />
            <button onClick={join} disabled={busy} className="btn-primary !py-2 !px-5 text-sm">
              + {n} bot ekle
            </button>
            <span className="text-muted text-sm tabular-nums">Aktif bot: {joined}</span>
          </div>
          {joined > 0 && (
            <p className="text-muted text-xs mt-2">
              {Object.entries(personaCounts).map(([k, v]) => `${k}:${v}`).join("  ·  ")}
            </p>
          )}
        </div>

        {/* Yoğunluk kontrolleri */}
        <div className="card p-5 flex flex-col gap-4">
          <p className="eyebrow">Aktiflik</p>
          <Slider label={`Tepki yoğunluğu ×${reactionMul}`} min={0} max={3} step={0.5} value={reactionMul} onChange={setReactionMul} />
          <Slider label={`Q&A yoğunluğu ×${qnaMul}`} min={0} max={3} step={0.5} value={qnaMul} onChange={setQnaMul} />
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={chatOn} onChange={(e) => setChatOn(e.target.checked)} className="w-5 h-5 accent-[#4f46e5]" />
            <span className="text-sm font-semibold">Canlı sohbeti doldur (chatEnabled açıksa)</span>
          </label>
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={joined === 0}
              className={`!py-2.5 !px-6 text-sm rounded-full font-semibold ${running ? "btn-ghost !border-brand !text-brand" : "btn-primary"}`}
            >
              {running ? "■ Durdur" : "▶ Başlat"}
            </button>
            <button
              onClick={voteAllNow}
              disabled={joined === 0 || !activeSlide || !isVotingSlide(activeSlide)}
              className="btn-accent !py-2.5 !px-5 text-sm"
              title="Tüm botları aktif slaytta hemen oylat"
            >
              ⚡ Şimdi oylat
            </button>
            <button onClick={clearAll} disabled={busy} className="btn-ghost !py-2.5 !px-5 text-sm">
              Temizle (Yeni oturum)
            </button>
          </div>
          {activeSlide && !isVotingSlide(activeSlide) && (
            <p className="text-brand text-xs font-semibold">
              Aktif slayt oy toplamayan bir tip ({activeSlide.type}). Present&apos;te bir <b>soru</b>
              slaytına geçince oylar düşer.
            </p>
          )}
        </div>

        {/* Canlı sayaçlar */}
        <div className="card p-5">
          <p className="eyebrow mb-3">Canlı</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <Stat label="yazma/sn" value={stats.wps} highlight />
            <Stat label="tepki" value={stats.reactions} />
            <Stat label="oy" value={stats.votes} />
            <Stat label="soru" value={stats.questions} />
            <Stat label="mesaj" value={stats.messages} />
          </div>
          <p className="text-muted text-xs mt-4">
            Gerçek oturum gibi: <b>Present ↗</b>'i aç, botları ekle ve <b>Başlat</b>. Tepkiler dalga dalga,
            insanca oranlarda gelir (×1 = normal katılım). Yoğunluğu abartmak Firebase kotasını hızlı tüketir.
            Bitince <b>Temizle</b>.
          </p>
        </div>
      </div>
    </main>
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

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl py-3 ${highlight ? "bg-accent-soft" : "bg-paper"}`}>
      <p className={`font-display text-2xl font-semibold tabular-nums ${highlight ? "text-accent" : ""}`}>{value}</p>
      <p className="text-muted text-xs">{label}</p>
    </div>
  );
}
