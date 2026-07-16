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
  getStoredNickname,
  joinPresentation,
  storeLastPresentation,
  storeNickname,
} from "@/lib/participants";
import { getVoteCount } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** İzleyici ekranı — auth yok, mobile-first. Aktif slaytı canlı takip eder. */
export default function AudiencePage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, loading } = usePresentation(id);
  const { slides } = useSlides(id);
  const [votedSlideIds, setVotedSlideIds] = useState<Set<string>>(new Set());

  // Takma ad: localStorage'dan yüklenir; yoksa önce sorulur (Menti akışı).
  const [nickname, setNickname] = useState<string | null>(null);
  const [nicknameLoaded, setNicknameLoaded] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setNickname(getStoredNickname());
    setNicknameLoaded(true);
  }, []);

  // Katılımı kaydet + son sunumu hatırla
  useEffect(() => {
    if (nickname && presentation) {
      joinPresentation(id, nickname).catch(() => {});
      storeLastPresentation({ id, title: presentation.title });
    }
  }, [nickname, presentation, id]);

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

  function saveNickname(e: FormEvent) {
    e.preventDefault();
    const clean = draft.trim().slice(0, 30);
    if (!clean) return;
    storeNickname(clean);
    setNickname(clean);
  }

  if (loading || !nicknameLoaded) {
    return <Centered><p className="text-muted animate-pulse">Yükleniyor…</p></Centered>;
  }
  if (!presentation) {
    return <Centered><p className="text-xl font-medium">Sunum bulunamadı.</p></Centered>;
  }

  // 1) Takma ad kapısı
  if (!nickname) {
    return (
      <Centered>
        <p className="text-muted text-sm mb-2">{presentation.title}</p>
        <h1 className="text-2xl font-semibold mb-8">Sana nasıl seslenelim?</h1>
        <form onSubmit={saveNickname} className="w-full max-w-xs flex flex-col gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={30}
            autoFocus
            placeholder="Takma adın"
            className="w-full text-center text-xl rounded-2xl px-4 py-4 bg-white border border-line focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="w-full bg-ink hover:bg-black disabled:opacity-30 text-white font-medium rounded-2xl py-4"
          >
            Katıl
          </button>
        </form>
      </Centered>
    );
  }

  // 2) Bekleme / karşılama (sunum kapalı veya hâlâ QR ekranında)
  if (!presentation.isLive || rawIndex < 0 || !slide) {
    return (
      <Centered>
        <p className="text-4xl mb-4">👋</p>
        <h1 className="text-2xl font-semibold mb-2">Hoş geldin, {nickname}!</h1>
        <p className="text-muted">{presentation.title}</p>
        <p className="text-muted mt-6 animate-pulse">Sunumun başlaması bekleniyor…</p>
      </Centered>
    );
  }

  const hasVoted = votedSlideIds.has(slide.id);
  const markVoted = () => setVotedSlideIds((prev) => new Set(prev).add(slide.id));

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 py-3 flex items-center justify-between border-b border-line bg-white">
        <span className="font-semibold">FlowMeter</span>
        <span className="text-muted text-sm truncate ml-4">{nickname}</span>
      </header>

      <section className="flex-1 w-full max-w-md mx-auto px-4 py-8">
        <p className="text-muted text-xs mb-2 tabular-nums">
          {index + 1} / {slides.length}
        </p>
        <h1 className="text-2xl font-semibold mb-6">{slide.question}</h1>

        {presentation.votingClosed ? (
          <StatusCard emoji="🔒" title="Oylama kapalı" text="Sunucu oylamayı tekrar açana kadar bekle." />
        ) : hasVoted ? (
          <StatusCard emoji="✅" title="Cevabın alındı!" text="Sonuçları sunum ekranında izle." />
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
    <div className="text-center py-12">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-muted mt-1">{text}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      {children}
    </main>
  );
}
