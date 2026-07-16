"use client";

import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import MultipleChoiceVote from "@/components/vote/MultipleChoiceVote";
import OpenEndedVote from "@/components/vote/OpenEndedVote";
import RankingVote from "@/components/vote/RankingVote";
import ScalesVote from "@/components/vote/ScalesVote";
import WordCloudVote from "@/components/vote/WordCloudVote";
import { usePresentation, useSlides } from "@/lib/hooks";
import {
  AVATAR_EMOJIS,
  getStoredEmoji,
  getStoredNickname,
  joinPresentation,
  storeIdentity,
  storeLastPresentation,
} from "@/lib/participants";
import { getVoteCount } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** İzleyici ekranı — auth yok, mobile-first. Aktif slaytı canlı takip eder. */
export default function AudiencePage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, loading } = usePresentation(id);
  const { slides } = useSlides(id);
  const [votedSlideIds, setVotedSlideIds] = useState<Set<string>>(new Set());

  // Kimlik (takma ad + emoji): localStorage'dan yüklenir; yoksa önce sorulur.
  const [nickname, setNickname] = useState<string | null>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftEmoji, setDraftEmoji] = useState<string>(AVATAR_EMOJIS[0]);

  useEffect(() => {
    setNickname(getStoredNickname());
    setEmoji(getStoredEmoji());
    setIdentityLoaded(true);
  }, []);

  // Katılımı kaydet + son sunumu hatırla
  useEffect(() => {
    if (nickname && presentation) {
      joinPresentation(id, nickname, emoji ?? "😀").catch(() => {});
      storeLastPresentation({ id, title: presentation.title });
    }
  }, [nickname, emoji, presentation, id]);

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const index = Math.min(rawIndex, Math.max(0, slides.length - 1));
  const slide: Slide | undefined = rawIndex < 0 ? undefined : slides[index];

  // Tek gönderimli tipler için sayfa yenilense bile oy kaydını hatırla
  useEffect(() => {
    if (
      slide &&
      getVoteCount(slide.id) > 0 &&
      ["multiple-choice", "scales", "ranking"].includes(slide.type)
    ) {
      setVotedSlideIds((prev) => new Set(prev).add(slide.id));
    }
  }, [slide]);

  function saveIdentity(e: FormEvent) {
    e.preventDefault();
    const clean = draft.trim().slice(0, 30);
    if (!clean) return;
    storeIdentity(clean, draftEmoji);
    setNickname(clean);
    setEmoji(draftEmoji);
  }

  if (loading || !identityLoaded) {
    return <Centered><p className="text-muted animate-pulse">Yükleniyor…</p></Centered>;
  }
  if (!presentation) {
    return <Centered><p className="text-xl font-medium">Sunum bulunamadı.</p></Centered>;
  }

  // 1) Kimlik kapısı: emoji + takma ad
  if (!nickname) {
    return (
      <Centered>
        <p className="eyebrow mb-2">{presentation.title}</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-8">
          Sana nasıl seslenelim?
        </h1>
        <form onSubmit={saveIdentity} className="w-full max-w-sm flex flex-col gap-5">
          <div className="card p-5">
            <div className="text-6xl mb-4" aria-hidden>{draftEmoji}</div>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setDraftEmoji(e)}
                  aria-label={`Emoji seç: ${e}`}
                  className={`text-xl rounded-xl p-1.5 transition-all ${
                    draftEmoji === e
                      ? "bg-accent-soft ring-2 ring-accent scale-110"
                      : "hover:bg-paper"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
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

  // 2) Bekleme / karşılama (sunum kapalı veya hâlâ QR ekranında)
  if (!presentation.isLive || rawIndex < 0 || !slide) {
    return (
      <Centered>
        <div className="text-7xl mb-5 animate-bounce" aria-hidden>{emoji ?? "👋"}</div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">
          Hoş geldin, {nickname}!
        </h1>
        <p className="text-muted">{presentation.title}</p>
        <p className="text-muted mt-8 animate-pulse">Sunumun başlaması bekleniyor…</p>
      </Centered>
    );
  }

  const hasVoted = votedSlideIds.has(slide.id);
  const markVoted = () => setVotedSlideIds((prev) => new Set(prev).add(slide.id));

  return (
    <main className="min-h-screen flex flex-col bg-wash">
      <header className="px-4 py-3 flex items-center justify-between border-b border-line bg-white/80 backdrop-blur">
        <span className="font-extrabold tracking-tight">FlowMeter</span>
        <span className="flex items-center gap-2 bg-paper border border-line rounded-full pl-1.5 pr-3 py-1 text-sm font-medium">
          <span aria-hidden>{emoji ?? "😀"}</span>
          <span className="truncate max-w-[9rem]">{nickname}</span>
        </span>
      </header>

      <section className="flex-1 w-full max-w-md mx-auto px-4 py-8">
        {/* İlerleme çubuğu */}
        <div className="flex items-center gap-1.5 mb-6" aria-label={`Slayt ${index + 1} / ${slides.length}`}>
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`h-1 rounded-full flex-1 transition-colors ${
                i <= index ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight mb-6">{slide.question}</h1>

        {presentation.votingClosed ? (
          <StatusCard emoji="🔒" title="Oylama kapalı" text="Sunucu oylamayı tekrar açana kadar bekle." />
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
        ) : slide.type === "content" ? (
          <div className="text-ink/80 whitespace-pre-wrap">
            {slide.settings?.description || "Sunumu ekrandan takip et."}
          </div>
        ) : (
          <p className="text-muted">Bu slayt için katılım gerekmiyor.</p>
        )}
      </section>
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
