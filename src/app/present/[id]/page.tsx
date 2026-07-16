"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import BarChartResult from "@/components/results/BarChartResult";
import WordCloudResult from "@/components/results/WordCloudResult";
import { useAuthUser, useLiveResponses, usePresentation, useSlides } from "@/lib/hooks";
import { setCurrentSlide } from "@/lib/presentations";

/** Tam ekran sunum modu: büyük soru + canlı sonuçlar + katılım banner'ı. */
export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);

  const index = Math.min(
    presentation?.currentSlideIndex ?? 0,
    Math.max(0, slides.length - 1)
  );
  const slide = slides[index];
  const responses = useLiveResponses(id, slide?.id ?? null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Sunum ekranı açılınca canlı yayına al
  useEffect(() => {
    if (presentation && !presentation.isLive && slides.length > 0) {
      setCurrentSlide(id, index);
    }
  }, [presentation, slides.length, id, index]);

  // Klavye ile slayt geçişi (← →)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && index < slides.length - 1) setCurrentSlide(id, index + 1);
      if (e.key === "ArrowLeft" && index > 0) setCurrentSlide(id, index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, index, slides.length]);

  if (!presentation) {
    return (
      <main className="min-h-screen bg-brand-navy flex items-center justify-center">
        <p className="text-white/80 animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  const voterCount = new Set(responses.map((r) => r.voterId)).size;

  return (
    <main className="min-h-screen bg-brand-navy flex flex-col">
      {/* Katılım banner'ı */}
      <header className="px-6 py-4 flex items-center justify-between">
        <p className="text-white text-lg">
          <span className="text-white/60">Katılmak için</span>{" "}
          <span className="font-semibold">flowmeter</span>
          <span className="text-white/60">&apos;a git, kodu gir:</span>{" "}
          <span className="font-mono font-bold text-2xl tracking-widest bg-white/10 rounded-lg px-3 py-1 ml-1">
            {presentation.joinCode}
          </span>
        </p>
        <Link href={`/edit/${id}`} className="text-white/50 hover:text-white text-sm">
          Editöre dön
        </Link>
      </header>

      {/* Slayt içeriği */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
        {slide ? (
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl p-8 md:p-12">
            <h1 className="text-2xl md:text-4xl font-bold mb-8">{slide.question}</h1>
            {slide.type === "multiple-choice" ? (
              <BarChartResult slide={slide} responses={responses} />
            ) : slide.type === "word-cloud" ? (
              <div className="min-h-[16rem] flex items-center justify-center">
                <WordCloudResult responses={responses} />
              </div>
            ) : (
              <p className="text-slate-400">Bu slayt tipi için sonuç görünümü yakında.</p>
            )}
          </div>
        ) : (
          <p className="text-white/60 text-xl">
            Henüz slayt yok — editörden slayt ekleyin.
          </p>
        )}
      </section>

      {/* Kontroller */}
      <footer className="px-6 py-4 flex items-center justify-between">
        <span className="text-white/50 text-sm">{voterCount} katılımcı cevapladı</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentSlide(id, index - 1)}
            disabled={index <= 0}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg px-4 py-2"
            aria-label="Önceki slayt"
          >
            ←
          </button>
          <span className="text-white/70 text-sm tabular-nums">
            {slides.length ? index + 1 : 0} / {slides.length}
          </span>
          <button
            onClick={() => setCurrentSlide(id, index + 1)}
            disabled={index >= slides.length - 1}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded-lg px-4 py-2"
            aria-label="Sonraki slayt"
          >
            →
          </button>
        </div>
      </footer>
    </main>
  );
}
