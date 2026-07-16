"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import MultipleChoiceVote from "@/components/vote/MultipleChoiceVote";
import OpenEndedVote from "@/components/vote/OpenEndedVote";
import RankingVote from "@/components/vote/RankingVote";
import ScalesVote from "@/components/vote/ScalesVote";
import WordCloudVote from "@/components/vote/WordCloudVote";
import { usePresentation, useSlides } from "@/lib/hooks";
import { getVoteCount } from "@/lib/responses";
import { Slide } from "@/lib/types";

/** İzleyici oylama ekranı — auth yok, mobile-first. Aktif slaytı canlı takip eder. */
export default function AudiencePage() {
  const { id } = useParams<{ id: string }>();
  const { presentation, loading } = usePresentation(id);
  const { slides } = useSlides(id);
  const [votedSlideIds, setVotedSlideIds] = useState<Set<string>>(new Set());

  const index = Math.min(
    presentation?.currentSlideIndex ?? 0,
    Math.max(0, slides.length - 1)
  );
  const slide: Slide | undefined = slides[index];

  // Sayfa yenilense bile localStorage'daki oy kaydını dikkate al.
  // Tek gönderimli tipler: MC, scales, ranking. (WC ve open-ended kendi
  // maxEntries sayacını bileşen içinde tutar.)
  useEffect(() => {
    if (
      slide &&
      getVoteCount(slide.id) > 0 &&
      ["multiple-choice", "scales", "ranking"].includes(slide.type)
    ) {
      setVotedSlideIds((prev) => new Set(prev).add(slide.id));
    }
  }, [slide]);

  if (loading) {
    return <Centered><p className="text-white/80 animate-pulse">Yükleniyor…</p></Centered>;
  }
  if (!presentation) {
    return <Centered><p className="text-white text-xl">Sunum bulunamadı.</p></Centered>;
  }
  if (!presentation.isLive || !slide) {
    return (
      <Centered>
        <p className="text-white text-xl font-semibold mb-2">{presentation.title}</p>
        <p className="text-white/60">Sunum başlamasını bekliyorsun…</p>
      </Centered>
    );
  }

  const hasVoted = votedSlideIds.has(slide.id);
  const markVoted = () => setVotedSlideIds((prev) => new Set(prev).add(slide.id));

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-brand-navy px-4 py-3 flex items-center justify-between">
        <span className="text-white font-bold">FlowMeter</span>
        <span className="text-white/60 text-sm">{presentation.title}</span>
      </header>

      <section className="flex-1 w-full max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{slide.question}</h1>

        {presentation.votingClosed ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔒</p>
            <p className="text-lg font-semibold">Oylama kapalı</p>
            <p className="text-slate-500 mt-1">Sunucu oylamayı tekrar açana kadar bekle.</p>
          </div>
        ) : hasVoted ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-lg font-semibold">Cevabın alındı!</p>
            <p className="text-slate-500 mt-1">Sonuçları sunum ekranında izle.</p>
          </div>
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
          <div className="text-slate-600 whitespace-pre-wrap">
            {slide.settings?.description || "Sunumu ekrandan takip et."}
          </div>
        ) : (
          <p className="text-slate-500">Bu slayt için katılım gerekmiyor.</p>
        )}
      </section>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-brand-navy flex flex-col items-center justify-center px-4 text-center">
      {children}
    </main>
  );
}
