"use client";

/**
 * Telefon kumandası (Mentimote karşılığı): sunucu sahnede, perde kürsüdeki
 * bilgisayarda — slaytları buradan ilerletir, konuşmacı notunu ve gelen
 * Q&A sorularını perdeye yansıtmadan görür. Yetki: sadece sunum sahibi.
 * 6 haneli katılım kodu da sunum id'si de kabul edilir (moderate deseni).
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuthUser, usePresentation, useQuestions, useSlides } from "@/lib/hooks";
import { endPresentation, resolveJoinCode, setCurrentSlide, setVotingClosed, startQuiz } from "@/lib/presentations";
import { SLIDE_TYPE_LABELS } from "@/lib/types";

export default function RemotePage() {
  const { confirm, dialog } = useConfirm({ tone: "dark" });
  const { id: rawCode } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();

  const [pid, setPid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (/^\d{6}$/.test(rawCode)) {
      resolveJoinCode(rawCode).then(setPid).catch(() => setPid(null));
    } else {
      setPid(rawCode);
    }
  }, [rawCode]);
  const id = pid ?? "";

  const { presentation } = usePresentation(id || null);
  const { slides } = useSlides(id || null);
  const questions = useQuestions(id || null);
  const [qaOpen, setQaOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  if (authLoading || pid === undefined || (pid && !presentation)) {
    return <main className="min-h-screen grid place-items-center bg-[#101014] text-white/60 animate-pulse">Yükleniyor…</main>;
  }
  if (pid === null || !presentation) {
    return <main className="min-h-screen grid place-items-center bg-[#101014] text-white/70 px-6 text-center">({rawCode}) geçerli bir koda/sunuma karşılık gelmiyor.</main>;
  }
  if (user && presentation.ownerId !== user.uid) {
    return <main className="min-h-screen grid place-items-center bg-[#101014] text-white/70 px-6 text-center">Kumandayı sadece sunum sahibi kullanabilir.</main>;
  }

  const idx = presentation.currentSlideIndex ?? -1;
  const cur = idx >= 0 ? slides[Math.min(idx, slides.length - 1)] : undefined;

  /** Sıradaki/önceki GÖSTERİLEBİLİR slayt (atlananlar geçilir); -1 = QR ekranı. */
  const step = (dir: 1 | -1): number | null => {
    let i = idx + dir;
    while (i >= 0 && i < slides.length && slides[i]?.settings?.skipped) i += dir;
    if (dir === -1 && i < -1) return null;
    if (dir === 1 && i >= slides.length) return null;
    return Math.max(-1, i);
  };
  const nextIdx = step(1);
  const prevIdx = step(-1);
  const next = nextIdx !== null && nextIdx >= 0 ? slides[nextIdx] : undefined;

  const isQuizCur = cur && (cur.type === "quiz" || cur.type === "quiz-type");
  const quizStarted = !!cur?.quizStartedAt;
  const visibleQuestions = questions.filter((q) => !q.hidden && (presentation.qnaModeration ? q.approved : true));

  return (
    <main className="min-h-screen bg-[#101014] text-white flex flex-col" style={{ colorScheme: "dark" }}>
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href={`/edit/${id}`} className="text-white/50 hover:text-white shrink-0 text-lg" aria-label="Editöre dön">←</Link>
          <Logo size="sm" onDark />
        </div>
        <span className="text-white/45 text-xs truncate max-w-[45vw]">📱 Kumanda · {presentation.title}</span>
      </header>

      <section className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Şu anki slayt */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-bold mb-1">
            {idx < 0 ? "Katılım (QR) ekranı" : `Slayt ${idx + 1} / ${slides.length} · ${SLIDE_TYPE_LABELS[cur!.type] ?? cur!.type}`}
          </p>
          <p className="font-display text-lg font-semibold leading-snug">{idx < 0 ? `Kod: ${presentation.joinCode}` : cur!.question}</p>
          {cur?.settings?.notes && (
            <div className="mt-3 rounded-xl bg-amber-400/10 border border-amber-400/25 px-3 py-2.5">
              <p className="text-amber-200/90 text-sm whitespace-pre-wrap">🗒 {cur.settings.notes}</p>
            </div>
          )}
          {isQuizCur && !quizStarted && (
            <button onClick={() => startQuiz(id, cur!.id)} className="mt-3 w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-3 font-bold">
              ▶ Yarışmayı başlat
            </button>
          )}
        </div>

        {/* Sıradaki */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/35 font-bold mb-0.5">Sıradaki</p>
          <p className="text-white/70 text-sm truncate">
            {nextIdx === null ? "— son slayttasın" : next ? `${nextIdx + 1}. ${next.question}` : "Katılım ekranı"}
          </p>
        </div>

        {/* Gezinme — baş parmak bölgesinde dev butonlar */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => prevIdx !== null && setCurrentSlide(id, prevIdx)}
            disabled={prevIdx === null}
            className="rounded-2xl bg-white/10 border border-white/15 py-6 text-xl font-bold disabled:opacity-30 active:scale-95 transition-transform"
          >
            ←
          </button>
          <button
            onClick={() => nextIdx !== null && setCurrentSlide(id, nextIdx)}
            disabled={nextIdx === null}
            className="rounded-2xl bg-accent hover:bg-accent-dark py-6 text-xl font-bold disabled:opacity-30 active:scale-95 transition-transform"
          >
            →
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentSlide(id, -1)}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            ⟲ QR ekranı
          </button>
          <button
            onClick={() => setVotingClosed(id, !presentation.votingClosed)}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${presentation.votingClosed ? "bg-rose-400/15 border-rose-400/30 text-rose-300" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"}`}
          >
            {presentation.votingClosed ? "🔒 Oylama kapalı" : "🔓 Oylama açık"}
          </button>
        </div>

        {/* Q&A — perdeye yansıtmadan gör */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/10">
          <button onClick={() => setQaOpen(!qaOpen)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-white/80">
            🙋 Sorular <span className="text-white/45">{visibleQuestions.length} {qaOpen ? "▴" : "▾"}</span>
          </button>
          {qaOpen && (
            <div className="px-4 pb-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
              {visibleQuestions.length === 0 ? (
                <p className="text-white/40 text-sm">Henüz soru yok.</p>
              ) : (
                visibleQuestions.map((q) => (
                  <div key={q.id} className="rounded-xl bg-white/5 px-3 py-2 text-sm flex items-start gap-2">
                    <span className="text-accent font-bold shrink-0">▲ {q.upvotes}</span>
                    <span className="text-white/85 break-words">{q.text}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={() =>
            confirm(
              { title: "Sunumu bitir", message: "İzleyiciler teşekkür ekranı görür.", confirmLabel: "Bitir", tone: "dark" },
              () => void endPresentation(id)
            )
          }
          className="mt-auto rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white/40 hover:text-rose-300 hover:border-rose-400/30"
        >
          Sunumu bitir
        </button>
      </section>

      {dialog}
    </main>
  );
}
