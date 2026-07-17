"use client";

/**
 * ⚠️ TEST/DEV ARACI — gizli link. Kaldırmak için: bu dosyayı (src/app/dev/)
 * ve src/lib/sim.ts'i sil. Kullanıcıya değmez: ?k=<SIM_SECRET> yoksa açılmaz,
 * hiçbir yerden linklenmez. Gerçek izleyici gibi anonim yazar (rules değişmez).
 *
 * Amaç: N katılımcı + gerçekçi personalarla (tepki canavarı, çok soran, sohbetçi,
 * aktif, sessiz) canlı yük üretip "tepkiler çokken" akıcılık sınırını bulmak.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePresentation, useQuestions, useSlides } from "@/lib/hooks";
import { resetSession } from "@/lib/presentations";
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
const REACTIONS_PER_TICK_CAP = 700; // tarayıcı kilitlenmesin

export default function SimPage() {
  const { id } = useParams<{ id: string }>();
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("k");
    setAuthed(k === SIM_SECRET);
  }, []);

  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const questions = useQuestions(id);

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
  const voteQueueRef = useRef<{ bot: Bot; at: number; willVote: boolean }[]>([]);
  const slideStartRef = useRef(0);
  const cfgRef = useRef({ reactionMul, qnaMul, chatOn });
  const countRef = useRef({ reactions: 0, votes: 0, questions: 0, messages: 0 });
  const wpsRef = useRef({ last: 0, acc: 0 });

  useEffect(() => {
    cfgRef.current = { reactionMul, qnaMul, chatOn };
  }, [reactionMul, qnaMul, chatOn]);
  useEffect(() => {
    questionIdsRef.current = questions.filter((q) => !q.hidden).map((q) => q.id);
  }, [questions]);

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const activeSlide: Slide | undefined = rawIndex < 0 ? undefined : slides[Math.min(rawIndex, slides.length - 1)];

  // Aktif slayt değişince oy kuyruğunu kur (personaya göre zamanlanmış)
  useEffect(() => {
    slideRef.current = activeSlide ?? null;
    slideStartRef.current = Date.now();
    if (activeSlide && isVotingSlide(activeSlide)) {
      voteQueueRef.current = botsRef.current.map((bot) => ({
        bot,
        at: Math.min(VOTE_WINDOW, bot.voteDelay * (0.5 + Math.random())),
        willVote: Math.random() < bot.voteProb,
      }));
    } else {
      voteQueueRef.current = [];
    }
  }, [activeSlide?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const bump = (k: keyof typeof countRef.current, by = 1) => {
    countRef.current[k] += by;
    wpsRef.current.acc += by;
  };

  // Ana döngü
  useEffect(() => {
    if (!running) return;
    const bots = botsRef.current;
    const reactorRateSum = bots.reduce((a, b) => a + b.reactionRate, 0);
    const questioners = bots.filter((b) => b.questionEvery > 0);
    const chatters = bots.filter((b) => b.chatEvery > 0);
    const dt = TICK_MS / 1000;

    const iv = window.setInterval(() => {
      const cfg = cfgRef.current;
      const pid = id;

      // 1) Tepkiler (asıl yük) — beklenen sayı kadar fırlat
      let rc = Math.round(reactorRateSum * cfg.reactionMul * dt);
      rc = Math.min(REACTIONS_PER_TICK_CAP, rc + (Math.random() < (reactorRateSum * cfg.reactionMul * dt) % 1 ? 1 : 0));
      for (let i = 0; i < rc; i++) {
        fireReaction(pid).catch(() => {});
        bump("reactions");
      }

      // 2) Oylar — kuyruktaki zamanı gelenler
      const slide = slideRef.current;
      if (slide) {
        const elapsed = Date.now() - slideStartRef.current;
        const due = voteQueueRef.current.filter((v) => v.at <= elapsed);
        if (due.length) {
          voteQueueRef.current = voteQueueRef.current.filter((v) => v.at > elapsed);
          for (const v of due) {
            if (v.willVote) {
              fireResponse(pid, slide, v.bot.voterId).catch(() => {});
              bump("votes");
            }
          }
        }
      }

      // 3) Q&A — sorular + upvote
      const qExpected = questioners.reduce((a, b) => a + dt / (b.questionEvery / 1000), 0) * cfg.qnaMul;
      let qn = Math.floor(qExpected) + (Math.random() < qExpected % 1 ? 1 : 0);
      qn = Math.min(30, qn);
      for (let i = 0; i < qn && questioners.length; i++) {
        fireQuestion(pid, questioners[Math.floor(Math.random() * questioners.length)].voterId).catch(() => {});
        bump("questions");
      }
      const ids = questionIdsRef.current;
      if (ids.length) {
        const upExpected = questioners.length * dt * 0.4 * cfg.qnaMul;
        let un = Math.floor(upExpected) + (Math.random() < upExpected % 1 ? 1 : 0);
        un = Math.min(30, un);
        for (let i = 0; i < un; i++) {
          upvoteQuestion(pid, ids[Math.floor(Math.random() * ids.length)], 0).catch(() => {});
        }
      }

      // 4) Sohbet
      if (cfg.chatOn && chatters.length) {
        const cExpected = chatters.reduce((a, b) => a + dt / (b.chatEvery / 1000), 0);
        let cn = Math.floor(cExpected) + (Math.random() < cExpected % 1 ? 1 : 0);
        cn = Math.min(20, cn);
        for (let i = 0; i < cn; i++) {
          fireMessage(pid, chatters[Math.floor(Math.random() * chatters.length)]).catch(() => {});
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

  const join = useCallback(async () => {
    setBusy(true);
    try {
      const bots = makeBots(n);
      botsRef.current = [...botsRef.current, ...bots];
      await joinBots(id, bots);
      setJoined(botsRef.current.length);
    } finally {
      setBusy(false);
    }
  }, [id, n]);

  const clearAll = useCallback(async () => {
    if (!confirm("Yeni oturum: tüm katılımcılar, oylar, tepkiler, sohbet ve sorular silinsin mi?")) return;
    setRunning(false);
    setBusy(true);
    try {
      await resetSession(id, slides);
      botsRef.current = [];
      voteQueueRef.current = [];
      countRef.current = { reactions: 0, votes: 0, questions: 0, messages: 0 };
      setJoined(0);
      setStats({ reactions: 0, votes: 0, questions: 0, messages: 0, wps: 0 });
    } finally {
      setBusy(false);
    }
  }, [id, slides]);

  if (authed === null) return <main className="min-h-screen grid place-items-center text-muted">…</main>;
  if (!authed) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash">
        <p className="text-muted">404 — sayfa bulunamadı.</p>
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
            <p className="eyebrow text-brand">⚠️ Simülasyon — TEST</p>
            <h1 className="font-display text-2xl font-semibold">{presentation?.title ?? id}</h1>
            <p className="text-muted text-sm">
              Kod {presentation?.joinCode} · slayt {rawIndex < 0 ? "Katılım" : `${rawIndex + 1}/${slides.length}`}
              {activeSlide ? ` · ${activeSlide.type}` : ""}
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
          <Slider label={`Tepki yoğunluğu ×${reactionMul}`} min={0} max={15} step={0.5} value={reactionMul} onChange={setReactionMul} />
          <Slider label={`Q&A yoğunluğu ×${qnaMul}`} min={0} max={10} step={0.5} value={qnaMul} onChange={setQnaMul} />
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={chatOn} onChange={(e) => setChatOn(e.target.checked)} className="w-5 h-5 accent-[#4f46e5]" />
            <span className="text-sm font-semibold">Canlı sohbeti doldur (chatEnabled açıksa)</span>
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setRunning((r) => !r)}
              disabled={joined === 0}
              className={`!py-2.5 !px-6 text-sm rounded-full font-semibold ${running ? "btn-ghost !border-brand !text-brand" : "btn-primary"}`}
            >
              {running ? "■ Durdur" : "▶ Başlat"}
            </button>
            <button onClick={clearAll} disabled={busy} className="btn-ghost !py-2.5 !px-5 text-sm">
              Temizle (Yeni oturum)
            </button>
          </div>
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
            Sınırı bulmak için: <b>Present ↗</b>'i aç, botları ekle, tepki yoğunluğunu kademeli artır ve present
            ekranı takılana / yazma/sn platoya oturana kadar N&apos;i büyüt. Bitince <b>Temizle</b>.
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
