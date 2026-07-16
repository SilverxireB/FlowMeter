"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QrCode from "@/components/present/QrCode";
import BarChartResult from "@/components/results/BarChartResult";
import OpenEndedResult from "@/components/results/OpenEndedResult";
import RankingResult from "@/components/results/RankingResult";
import ScalesResult from "@/components/results/ScalesResult";
import WordCloudResult from "@/components/results/WordCloudResult";
import {
  useAuthUser,
  useLiveResponses,
  useParticipants,
  usePresentation,
  useSlides,
} from "@/lib/hooks";
import { setCurrentSlide } from "@/lib/presentations";

/**
 * Sunum modu. index -1 = katılım ekranı (büyük QR + kod + gelen isimler),
 * 0..n-1 = slaytlar. Klavye ←/→ ile gezinir.
 */
export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const participants = useParticipants(id);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const index = Math.min(rawIndex, slides.length - 1);
  const slide = rawIndex < 0 ? undefined : slides[index];
  const responses = useLiveResponses(id, slide?.id ?? null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Sunum ekranı açılınca canlı yayına al — katılım (QR) ekranından başla
  useEffect(() => {
    if (presentation && !presentation.isLive) {
      setCurrentSlide(id, -1);
    }
  }, [presentation, id]);

  useEffect(() => {
    if (presentation?.joinCode) {
      setJoinUrl(`${window.location.origin}/join/${presentation.joinCode}`);
    }
  }, [presentation?.joinCode]);

  // Klavye ile gezinme (←/→), -1 katılım ekranına kadar geri gidilebilir
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && rawIndex < slides.length - 1) setCurrentSlide(id, rawIndex + 1);
      if (e.key === "ArrowLeft" && rawIndex > -1) setCurrentSlide(id, rawIndex - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, rawIndex, slides.length]);

  if (!presentation) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-line bg-white">
        <p className="text-sm">
          <span className="text-muted">Katıl:</span>{" "}
          <span className="font-medium">{typeof window !== "undefined" ? window.location.host : "flowmeter"}</span>{" "}
          <span className="text-muted">· kod</span>{" "}
          <span className="font-mono font-semibold tracking-widest">{presentation.joinCode}</span>
        </p>
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm tabular-nums">
            👥 {participants.length}
          </span>
          <Link href={`/edit/${id}`} className="text-muted hover:text-ink text-sm">
            Editör
          </Link>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-6 py-6">
        {rawIndex < 0 ? (
          /* Katılım ekranı: büyük QR + kod + canlı gelen isimler */
          <div className="w-full max-w-4xl flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="bg-white border border-line rounded-3xl p-6">
              {joinUrl && <QrCode text={joinUrl} size={280} />}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-semibold mb-3">
                {presentation.title}
              </h1>
              <p className="text-muted text-lg mb-2">
                Telefonunla QR kodu okut veya siteye gir, kodu yaz:
              </p>
              <p className="font-mono text-5xl md:text-6xl font-bold tracking-[0.2em] mb-8">
                {presentation.joinCode}
              </p>
              <p className="text-muted text-sm mb-3 tabular-nums">
                {participants.length} kişi katıldı
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start max-h-32 overflow-hidden">
                {participants.slice(0, 24).map((p) => (
                  <span
                    key={p.id}
                    className="bg-white border border-line rounded-full px-3 py-1 text-sm"
                  >
                    {p.nickname}
                  </span>
                ))}
                {participants.length > 24 && (
                  <span className="text-muted text-sm px-2 py-1">
                    +{participants.length - 24} kişi
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : slide ? (
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-line p-8 md:p-12">
            <h1 className="text-2xl md:text-4xl font-semibold mb-8">{slide.question}</h1>
            {slide.type === "multiple-choice" ? (
              <BarChartResult slide={slide} responses={responses} />
            ) : slide.type === "word-cloud" ? (
              <div className="min-h-[16rem] flex items-center justify-center">
                <WordCloudResult responses={responses} />
              </div>
            ) : slide.type === "open-ended" ? (
              <OpenEndedResult responses={responses} />
            ) : slide.type === "scales" ? (
              <ScalesResult slide={slide} responses={responses} />
            ) : slide.type === "ranking" ? (
              <RankingResult slide={slide} responses={responses} />
            ) : slide.type === "content" ? (
              <p className="text-ink/80 text-xl whitespace-pre-wrap">
                {slide.settings?.description}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted text-xl">Henüz slayt yok — editörden slayt ekleyin.</p>
        )}
      </section>

      <footer className="px-6 py-4 flex items-center justify-between border-t border-line bg-white">
        <span className="text-muted text-sm tabular-nums">
          {participants.length} katılımcı
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentSlide(id, rawIndex - 1)}
            disabled={rawIndex <= -1}
            className="border border-line hover:bg-paper disabled:opacity-30 rounded-xl px-4 py-2"
            aria-label="Önceki slayt"
          >
            ←
          </button>
          <span className="text-muted text-sm tabular-nums w-16 text-center">
            {rawIndex < 0 ? "Katılım" : `${index + 1} / ${slides.length}`}
          </span>
          <button
            onClick={() => setCurrentSlide(id, rawIndex + 1)}
            disabled={rawIndex >= slides.length - 1}
            className="border border-line hover:bg-paper disabled:opacity-30 rounded-xl px-4 py-2"
            aria-label="Sonraki slayt"
          >
            →
          </button>
        </div>
      </footer>
    </main>
  );
}
