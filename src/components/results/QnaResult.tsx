"use client";

import { useQuestions } from "@/lib/hooks";
import { deleteQuestion, setQuestionAnswered, setQuestionHidden } from "@/lib/questions";

/** Q&A sunum görünümü: upvote sırasına göre sorular + moderasyon (gizle / cevaplandı / sil). */
export default function QnaResult({ presentationId }: { presentationId: string }) {
  const questions = useQuestions(presentationId);
  const hidden = questions.filter((q) => q.hidden);
  // Cevaplanmamışlar üstte, cevaplananlar altta
  const visible = questions
    .filter((q) => !q.hidden)
    .sort((a, b) => Number(a.answered ?? false) - Number(b.answered ?? false));

  if (questions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-3 animate-pulse" aria-hidden>🙋</p>
        <p className="text-muted text-lg">Sorular bekleniyor…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[26rem] overflow-y-auto pr-1">
      {visible.map((q, i) => {
        const highlight = i === 0 && !q.answered;
        return (
          <div
            key={q.id}
            className={`flex items-start gap-4 rounded-2xl px-5 py-4 transition-opacity ${
              q.answered
                ? "bg-paper opacity-60"
                : highlight
                  ? "bg-accent-soft/50 border border-accent/30"
                  : "bg-paper"
            }`}
          >
            <span className="flex flex-col items-center shrink-0 pt-0.5">
              <span className="text-accent font-bold">▲</span>
              <span className="font-display font-semibold tabular-nums">{q.upvotes}</span>
            </span>
            <div className="flex-1 min-w-0">
              {q.answered && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5 mb-1">
                  ✓ Cevaplandı
                </span>
              )}
              <p className={`break-words ${highlight ? "text-xl font-semibold" : "text-lg"} ${q.answered ? "line-through" : ""}`}>
                {q.text}
              </p>
            </div>
            <span className="flex gap-1 shrink-0">
              <button
                onClick={() => setQuestionAnswered(presentationId, q.id, !q.answered)}
                className={`text-sm px-2 py-1 cursor-pointer ${
                  q.answered ? "text-green-700" : "text-muted hover:text-green-700"
                }`}
                title={q.answered ? "Cevaplandı işaretini kaldır" : "Cevaplandı olarak işaretle"}
              >
                ✓
              </button>
              <button
                onClick={() => setQuestionHidden(presentationId, q.id, true)}
                className="text-muted hover:text-ink text-sm px-2 py-1 cursor-pointer"
                title="Gizle"
              >
                🙈
              </button>
              <button
                onClick={() => deleteQuestion(presentationId, q.id)}
                className="text-muted hover:text-brand text-sm px-2 py-1 cursor-pointer"
                title="Sil"
              >
                ✕
              </button>
            </span>
          </div>
        );
      })}
      {hidden.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-semibold">
            {hidden.length} gizli soru
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            {hidden.map((q) => (
              <div key={q.id} className="flex items-center gap-3 opacity-60 px-2">
                <p className="flex-1 break-words line-through">{q.text}</p>
                <button
                  onClick={() => setQuestionHidden(presentationId, q.id, false)}
                  className="text-accent font-semibold cursor-pointer shrink-0"
                >
                  Göster
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
