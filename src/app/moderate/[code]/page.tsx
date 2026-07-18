"use client";

/**
 * Q&A moderasyon ekranı: /moderate/<6 haneli kod veya sunum id>.
 * Moderasyon açıkken izleyici soruları önce buraya düşer; ✓ onaylanınca
 * present + izleyici Q&A listesine çıkar. Yetki: sadece sunum sahibi
 * (Google girişli) — rules onay yazmasına başka kimseye izin vermez.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useAuthUser, usePresentation, useQuestions } from "@/lib/hooks";
import { resolveJoinCode, setQnaModeration } from "@/lib/presentations";
import { deleteQuestion, setQuestionApproved } from "@/lib/questions";

export default function ModeratePage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();

  // 6 haneli kod da id de kabul: koddan sunum id'sini çöz.
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
  const questions = useQuestions(id || null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  if (authLoading || pid === undefined || (pid && !presentation)) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }
  if (pid === null || !presentation) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Sunum bulunamadı</p>
          <p className="text-muted">({rawCode}) geçerli bir koda/sunuma karşılık gelmiyor.</p>
        </div>
      </main>
    );
  }
  if (user && presentation.ownerId !== user.uid) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Yetki yok</p>
          <p className="text-muted">Bu sunumun moderasyonunu sadece sahibi yapabilir.</p>
        </div>
      </main>
    );
  }

  const moderation = !!presentation.qnaModeration;
  const pending = questions.filter((q) => !q.approved && !q.hidden);
  const approved = questions.filter((q) => q.approved && !q.hidden);

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg">←</Link>
          <span className="shrink-0"><Logo size="sm" /></span>
          <span className="font-display font-semibold truncate min-w-0">{presentation.title}</span>
          <span className="eyebrow shrink-0 hidden md:inline">Q&A Moderasyon</span>
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={moderation}
            onChange={(e) => setQnaModeration(id, e.target.checked)}
            className="w-5 h-5 accent-[#4f46e5]"
          />
          <span className="text-sm font-semibold">Moderasyon {moderation ? "açık" : "kapalı"}</span>
        </label>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-8 flex flex-col gap-6">
        {!moderation && (
          <div className="card p-4 text-sm text-muted">
            Moderasyon <b>kapalı</b>: sorular doğrudan herkese görünür. Yukarıdan açarsan yeni
            sorular önce burada onay bekler.
          </div>
        )}

        <section>
          <p className="eyebrow mb-3">Onay bekleyen ({pending.length})</p>
          {pending.length === 0 ? (
            <p className="text-muted text-sm">Bekleyen soru yok.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pending.map((q) => (
                <div key={q.id} className="card p-4 flex items-start gap-3">
                  <p className="flex-1 break-words">{q.text}</p>
                  <span className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setQuestionApproved(id, q.id, true)}
                      className="btn-accent !py-1.5 !px-4 text-sm"
                      title="Onayla — herkese görünür"
                    >
                      ✓ Onayla
                    </button>
                    <button
                      onClick={() => deleteQuestion(id, q.id)}
                      className="btn-ghost !py-1.5 !px-3 text-sm !border-brand !text-brand"
                      title="Reddet — soruyu siler"
                    >
                      ✕
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {approved.length > 0 && (
          <section>
            <p className="eyebrow mb-3 text-accent">✓ Onaylananlar ({approved.length})</p>
            <div className="flex flex-col gap-2">
              {approved.map((q) => (
                <div key={q.id} className="card p-4 flex items-start gap-3 opacity-80">
                  <span className="text-accent font-bold shrink-0">▲ {q.upvotes}</span>
                  <p className="flex-1 break-words">{q.text}</p>
                  <button
                    onClick={() => setQuestionApproved(id, q.id, false)}
                    className="text-muted hover:text-ink text-xs px-2 py-1 cursor-pointer shrink-0 font-semibold"
                    title="Onayı geri al — tekrar onay bekler"
                  >
                    ↩ Geri al
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
