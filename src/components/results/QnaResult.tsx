"use client";

import { useQuestions } from "@/lib/hooks";
import { deleteQuestion, setQuestionHidden } from "@/lib/questions";

/** Q&A sunum görünümü: upvote sırasına göre sorular + moderasyon. */
export default function QnaResult({ presentationId }: { presentationId: string }) {
  const questions = useQuestions(presentationId);
  const visible = questions.filter((q) => !q.hidden);
  const hidden = questions.filter((q) => q.hidden);

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
      {visible.map((q, i) => (
        <div
          key={q.id}
          className={`flex items-start gap-4 rounded-2xl px-5 py-4 ${
            i === 0 ? "bg-accent-soft/50 border border-accent/30" : "bg-paper"
          }`}
        >
          <span className="flex flex-col items-center shrink-0 pt-0.5">
            <span className="text-accent font-bold">▲</span>
            <span className="font-display font-semibold tabular-nums">{q.upvotes}</span>
          </span>
          <p className={`flex-1 break-words ${i === 0 ? "text-xl font-semibold" : "text-lg"}`}>
            {q.text}
          </p>
          <span className="flex gap-1 shrink-0">
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
      ))}
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
