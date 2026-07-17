"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import ChatPanel from "@/components/present/ChatPanel";
import Grid2x2Vote from "@/components/vote/Grid2x2Vote";
import GuessNumberVote from "@/components/vote/GuessNumberVote";
import HundredPointsVote from "@/components/vote/HundredPointsVote";
import MultipleChoiceVote from "@/components/vote/MultipleChoiceVote";
import PinOnImageVote from "@/components/vote/PinOnImageVote";
import QnaVote from "@/components/vote/QnaVote";
import QuizPersonalResult from "@/components/vote/QuizPersonalResult";
import QuizTypeVote from "@/components/vote/QuizTypeVote";
import QuizVote from "@/components/vote/QuizVote";
import OpenEndedVote from "@/components/vote/OpenEndedVote";
import RankingVote from "@/components/vote/RankingVote";
import ScalesVote from "@/components/vote/ScalesVote";
import WordCloudVote from "@/components/vote/WordCloudVote";
import { usePresentation, useSlides } from "@/lib/hooks";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import {
  AVATAR_SEEDS,
  clearIdentity,
  getStoredAvatarSeed,
  getStoredNickname,
  getStoredSession,
  joinPresentation,
  randomAvatarSeed,
  storeIdentity,
  storeLastPresentation,
  storeSession,
} from "@/lib/participants";
import { REACTION_EMOJIS, sendReaction } from "@/lib/reactions";
import { clearSlideVotes, getVoteCount, setActiveSession } from "@/lib/responses";
import { themeStyle } from "@/lib/themes";
import { Slide } from "@/lib/types";

/** İzleyici ekranı — auth yok, mobile-first. Aktif slaytı canlı takip eder. */
export default function AudiencePage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, loading } = usePresentation(id);
  const { slides } = useSlides(id);
  const [votedSlideIds, setVotedSlideIds] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);

  // Kimlik (takma ad + avatar): localStorage'dan yüklenir; yoksa önce sorulur.
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftSeed, setDraftSeed] = useState<string>(AVATAR_SEEDS[0]);
  const [extraSeeds, setExtraSeeds] = useState<string[]>([]);

  useEffect(() => {
    const n = getStoredNickname();
    setNickname(n);
    setAvatarSeed(getStoredAvatarSeed());
    if (n) setDraft(n);
    setIdentityLoaded(true);
  }, []);

  // Yeni oturum tespiti: sunumun sessionId'si telefondakinden farklıysa
  // (sunucu "Yeni oturum" başlattı) → yerel oyları temizle; gerçek oturum
  // değişiminde kimliği de sıfırla (avatar/ad yeniden seçilsin).
  useEffect(() => {
    const sid = presentation?.sessionId;
    if (!sid || slides.length === 0) return;
    const stored = getStoredSession(id);
    if (stored === sid) return;
    clearSlideVotes(slides.map((s) => s.id));
    setVotedSlideIds(new Set());
    if (stored !== null) {
      clearIdentity();
      setNickname(null);
      setAvatarSeed(null);
      setDraft("");
    }
    storeSession(id, sid);
  }, [presentation?.sessionId, slides, id]);

  // Aktif oturumu ayarla → gönderilen oylar bununla etiketlenir
  useEffect(() => {
    setActiveSession(presentation?.sessionId);
  }, [presentation?.sessionId]);

  // Katılımı kaydet + son sunumu hatırla
  useEffect(() => {
    if (nickname && presentation) {
      joinPresentation(id, nickname, avatarSeed ?? "Luna", presentation.sessionId).catch(() => {});
      storeLastPresentation({ id, title: presentation.title });
    }
  }, [nickname, avatarSeed, presentation, id]);

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const index = Math.min(rawIndex, Math.max(0, slides.length - 1));
  const slide: Slide | undefined = rawIndex < 0 ? undefined : slides[index];

  // Tek gönderimli tipler için sayfa yenilense bile oy kaydını hatırla
  useEffect(() => {
    if (
      slide &&
      getVoteCount(slide.id) > 0 &&
      [
        "multiple-choice",
        "scales",
        "ranking",
        "quiz",
        "quiz-type",
        "pin-on-image",
        "guess-number",
        "hundred-points",
        "grid-2x2",
      ].includes(slide.type)
    ) {
      setVotedSlideIds((prev) => new Set(prev).add(slide.id));
    }
  }, [slide]);

  function saveIdentity(e: FormEvent) {
    e.preventDefault();
    const clean = draft.trim().slice(0, 30);
    if (!clean) return;
    storeIdentity(clean, draftSeed);
    setNickname(clean);
    setAvatarSeed(draftSeed);
  }

  /** Galeriye 8 rastgele avatar ekle ("karıştır"). */
  function shuffleAvatars() {
    const fresh = Array.from({ length: 8 }, () => randomAvatarSeed());
    setExtraSeeds(fresh);
    setDraftSeed(fresh[0]);
  }

  if (loading || !identityLoaded) {
    return <Centered><p className="text-muted animate-pulse">Yükleniyor…</p></Centered>;
  }
  if (!presentation) {
    return <Centered><p className="text-xl font-medium">Sunum bulunamadı.</p></Centered>;
  }

  // 1) Kimlik kapısı: avatar + takma ad (yalnızca ilk giriş — sonrası kalıcı).
  // Avatarı olmayan eski kayıtlar (emoji dönemi) da bir kez seçici görür.
  if (!nickname || !avatarSeed) {
    return (
      <Centered>
        <p className="eyebrow mb-2">{presentation.title}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-8">
          Sana nasıl seslenelim?
        </h1>
        <form onSubmit={saveIdentity} className="w-full max-w-sm flex flex-col gap-5">
          <div className="card p-5">
            <div className="flex justify-center mb-4">
              <Avatar seed={draftSeed} size={88} className="ring-4 ring-accent-soft" />
            </div>
            <div className="grid grid-cols-6 gap-2">
              {[...(extraSeeds.length ? extraSeeds : AVATAR_SEEDS.slice(0, 16)), ...AVATAR_SEEDS.slice(16, 24)].slice(0, 24).map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setDraftSeed(seed)}
                  aria-label="Avatar seç"
                  className={`rounded-full p-0.5 transition-all cursor-pointer ${
                    draftSeed === seed
                      ? "ring-[3px] ring-accent scale-110"
                      : "hover:scale-105 opacity-90"
                  }`}
                >
                  <Avatar seed={seed} size={44} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={shuffleAvatars}
              className="mt-4 text-accent hover:text-accent-dark text-sm font-bold cursor-pointer"
            >
              🎲 Karıştır — yeni avatarlar getir
            </button>
          </div>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={30}
            autoFocus
            placeholder="Takma adın"
            className="input-base text-center text-xl font-semibold"
          />
          <button type="submit" disabled={!draft.trim()} className="btn-accent py-4">
            Katıl →
          </button>
        </form>
      </Centered>
    );
  }

  // 2a) Sunum bitti ekranı
  if (presentation.ended && !presentation.isLive) {
    return (
      <Centered>
        <div className="mb-5">
          <Avatar seed={avatarSeed ?? "Luna"} size={104} className="ring-4 ring-white shadow-lg" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Sunum sona erdi 🎉
        </h1>
        <p className="text-muted">Katıldığın için teşekkürler, {nickname}!</p>
      </Centered>
    );
  }

  // 2) Bekleme / karşılama (sunum kapalı veya hâlâ QR ekranında)
  if (!presentation.isLive || rawIndex < 0 || !slide) {
    return (
      <Centered>
        <div className="mb-5 animate-bounce">
          <Avatar seed={avatarSeed ?? "Luna"} size={104} className="ring-4 ring-white shadow-lg" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Hoş geldin, {nickname}!
        </h1>
        <p className="text-muted">{presentation.title}</p>
        <p className="text-muted mt-8 animate-pulse">Sunumun başlaması bekleniyor…</p>
      </Centered>
    );
  }

  const hasVoted = votedSlideIds.has(slide.id);
  const markVoted = () => setVotedSlideIds((prev) => new Set(prev).add(slide.id));
  const { style: themeBg, dark } = themeStyle(presentation.theme);
  const logo = presentation.theme?.logo;

  return (
    <main className="min-h-screen flex flex-col" style={themeBg}>
      <header
        className={`px-4 py-3 flex items-center justify-between border-b backdrop-blur ${
          dark ? "border-white/10 bg-black/20" : "border-line bg-white/80"
        }`}
      >
        <span className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Sunum logosu" className="h-6 w-auto" />
          )}
          <Logo size="sm" onDark={dark} />
        </span>
        <span className="flex items-center gap-2 bg-white border border-line rounded-full pl-1 pr-3 py-1 text-sm font-semibold">
          <Avatar seed={avatarSeed ?? "Luna"} size={24} />
          <span className="truncate max-w-[9rem] text-ink">{nickname}</span>
        </span>
      </header>

      <section key={slide.id} className="flex-1 w-full max-w-md mx-auto px-4 py-8 animate-pop">
        {/* İlerleme çubuğu (atlanan slaytlar sayılmaz) */}
        <div className="flex items-center gap-1.5 mb-6" aria-label={`Slayt ${index + 1} / ${slides.length}`}>
          {slides.filter((s) => !s.settings?.skipped).map((s) => {
            const i = slides.findIndex((x) => x.id === s.id);
            return (
              <span
                key={s.id}
                className={`h-1 rounded-full flex-1 transition-colors ${
                  i <= index ? "bg-accent" : "bg-line"
                }`}
              />
            );
          })}
        </div>

        <h1 className={`font-display text-2xl font-semibold tracking-tight mb-2 ${dark ? "text-white" : ""}`}>{slide.question}</h1>

        {/* Katılımcıya açıklama (Menti "Information for participants") */}
        {slide.settings?.description && slide.type !== "content" && slide.type !== "image" && (
          <p className={`text-sm mb-4 ${dark ? "text-white/70" : "text-muted"}`}>
            {slide.settings.description}
          </p>
        )}

        {/* Soru görseli (pin-on-image kendi görselini kullanır) */}
        {slide.settings?.image && !["pin-on-image", "image"].includes(slide.type) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.settings.image}
            alt=""
            className="w-full h-auto max-h-56 object-contain rounded-2xl border border-line bg-white mb-4 mt-2"
          />
        )}
        <div className="mt-4" />

        {presentation.votingClosed ? (
          <StatusCard emoji="🔒" title="Oylama kapalı" text="Sunucu oylamayı tekrar açana kadar bekle." />
        ) : hasVoted && (slide.type === "quiz" || slide.type === "quiz-type") ? (
          <QuizPersonalResult slide={slide} />
        ) : hasVoted ? (
          <StatusCard emoji="🎉" title="Cevabın alındı!" text="Sonuçları sunum ekranında izle." />
        ) : slide.type === "multiple-choice" ? (
          <MultipleChoiceVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "word-cloud" ? (
          <WordCloudVote presentationId={id} slide={slide} onDone={markVoted} />
        ) : slide.type === "open-ended" ? (
          <OpenEndedVote presentationId={id} slide={slide} onDone={markVoted} />
        ) : slide.type === "scales" ? (
          <ScalesVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "ranking" ? (
          <RankingVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "quiz" ? (
          <QuizVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "quiz-type" ? (
          <QuizTypeVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "pin-on-image" ? (
          <PinOnImageVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "guess-number" ? (
          <GuessNumberVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "hundred-points" ? (
          <HundredPointsVote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "grid-2x2" ? (
          <Grid2x2Vote presentationId={id} slide={slide} onVoted={markVoted} />
        ) : slide.type === "qna" ? (
          <QnaVote presentationId={id} />
        ) : slide.type === "content" ? (
          <div className="text-ink/80 whitespace-pre-wrap">
            {slide.settings?.description || "Sunumu ekrandan takip et."}
          </div>
        ) : slide.type === "image" ? (
          <div className="flex flex-col gap-3">
            {slide.settings?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.settings.image}
                alt={slide.question}
                className="w-full h-auto rounded-2xl border border-line"
              />
            )}
            {slide.settings?.description && (
              <p className={dark ? "text-white/80" : "text-ink/80"}>{slide.settings.description}</p>
            )}
          </div>
        ) : slide.type === "instructions" ? (
          <ol className="flex flex-col gap-3">
            {slide.options.map((step, i) => (
              <li key={i} className={`flex items-start gap-3 ${dark ? "text-white/90" : ""}`}>
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: `var(--series-${(i % 8) + 1})` }}
                  aria-hidden
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        ) : slide.type === "leaderboard" ? (
          <StatusCard emoji="🏆" title="Skor Tablosu" text="Podyumu sunum ekranında izle!" />
        ) : (
          <p className="text-muted">Bu slayt için katılım gerekmiyor.</p>
        )}
      </section>

      {/* Tepki çubuğu: her an bir emoji fırlat (+ canlı sohbet) */}
      <footer className="sticky bottom-0 px-4 py-2.5 bg-white/85 backdrop-blur border-t border-line">
        <div className="max-w-md mx-auto flex items-center justify-center gap-3">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => sendReaction(id, e)}
              aria-label={`Tepki gönder: ${e}`}
              className="text-xl w-11 h-11 rounded-full grayscale hover:grayscale-0 active:grayscale-0 cursor-pointer transition-all duration-150 hover:scale-110 active:scale-90 hover:bg-paper"
            >
              {e}
            </button>
          ))}
          {presentation.chatEnabled && (
            <button
              onClick={() => setChatOpen(true)}
              aria-label="Canlı sohbeti aç"
              className="text-xl w-11 h-11 rounded-full cursor-pointer transition-all duration-150 hover:scale-110 active:scale-90 hover:bg-paper"
            >
              💬
            </button>
          )}
        </div>
      </footer>

      {chatOpen && (
        <ChatPanel presentationId={id} nickname={nickname} onClose={() => setChatOpen(false)} />
      )}
    </main>
  );
}

function StatusCard({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="card text-center py-12 px-6">
      <p className="text-5xl mb-4" aria-hidden>{emoji}</p>
      <p className="text-xl font-bold">{title}</p>
      <p className="text-muted mt-1">{text}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-wash">
      {children}
    </main>
  );
}
