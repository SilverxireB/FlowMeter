"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import BarChartResult from "@/components/results/BarChartResult";
import OpenEndedResult from "@/components/results/OpenEndedResult";
import PinOnImageResult from "@/components/results/PinOnImageResult";
import QnaResult from "@/components/results/QnaResult";
import QuizResult from "@/components/results/QuizResult";
import QuizTypeResult from "@/components/results/QuizTypeResult";
import RankingResult from "@/components/results/RankingResult";
import ScalesResult from "@/components/results/ScalesResult";
import WordCloudResult from "@/components/results/WordCloudResult";
import { db } from "@/lib/firebase";
import {
  useAuthUser,
  useLiveResponses,
  useParticipants,
  usePresentation,
  useSlides,
} from "@/lib/hooks";
import { SLIDE_TYPE_ICONS, SLIDE_TYPE_LABELS } from "@/lib/types";

/** Sunum sonrası sonuç inceleme: slayt slayt gezin + CSV export. */
export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const participants = useParticipants(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (slides.length && !slides.some((s) => s.id === selectedId)) {
      setSelectedId(slides[0].id);
    }
  }, [slides, selectedId]);

  const selected = slides.find((s) => s.id === selectedId) ?? null;
  const responses = useLiveResponses(id, selected?.id ?? null);

  /** Tüm cevapları CSV olarak indir. */
  async function exportCsv() {
    if (!presentation || exporting) return;
    setExporting(true);
    try {
      const nick = new Map(participants.map((p) => [p.id, p.nickname]));
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = ["slayt_no,slayt_tipi,soru,katilimci,cevap,zaman"];
      for (const [i, s] of slides.entries()) {
        const snap = await getDocs(
          query(
            collection(db(), "presentations", id, "slides", s.id, "responses"),
            orderBy("createdAt")
          )
        );
        snap.docs.forEach((d) => {
          const r = d.data();
          const value = Array.isArray(r.value)
            ? r.value.join(" | ")
            : typeof r.value === "number"
              ? (s.options[r.value] ?? r.value)
              : r.value;
          lines.push(
            [
              i + 1,
              SLIDE_TYPE_LABELS[s.type],
              esc(s.question),
              esc(nick.get(r.voterId) ?? "Anonim"),
              esc(value),
              r.createdAt?.toDate?.().toISOString() ?? "",
            ].join(",")
          );
        });
      }
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `flowmeter-${presentation.joinCode || id}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(false);
    }
  }

  if (!presentation) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-wash">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0">←</Link>
          <Logo size="sm" />
          <span className="font-display font-semibold truncate">{presentation.title}</span>
          <span className="eyebrow shrink-0 hidden sm:inline">Sonuçlar</span>
        </div>
        <button onClick={exportCsv} disabled={exporting} className="btn-primary !py-2 !px-4 text-sm shrink-0">
          {exporting ? "Hazırlanıyor…" : "⬇ CSV indir"}
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="md:w-64 bg-white border-b md:border-b-0 md:border-r border-line p-3 flex md:flex-col gap-2 overflow-auto">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`shrink-0 md:shrink text-left rounded-xl border px-3 py-2 w-40 md:w-full transition-colors ${
                s.id === selectedId ? "border-accent bg-accent-soft/50" : "border-line hover:border-muted"
              }`}
            >
              <p className="text-xs text-muted">
                {i + 1} · {SLIDE_TYPE_ICONS[s.type]} {SLIDE_TYPE_LABELS[s.type]}
              </p>
              <p className="text-sm font-medium truncate">{s.question}</p>
            </button>
          ))}
        </aside>

        <section className="flex-1 p-4 md:p-8">
          {selected ? (
            <div className="max-w-3xl mx-auto card p-6 md:p-8">
              <p className="eyebrow mb-2">
                {SLIDE_TYPE_ICONS[selected.type]} {SLIDE_TYPE_LABELS[selected.type]}
              </p>
              <h1 className="font-display text-2xl font-semibold mb-6">{selected.question}</h1>
              {selected.type === "multiple-choice" ? (
                <BarChartResult slide={selected} responses={responses} />
              ) : selected.type === "word-cloud" ? (
                <WordCloudResult responses={responses} />
              ) : selected.type === "open-ended" ? (
                <OpenEndedResult responses={responses} />
              ) : selected.type === "scales" ? (
                <ScalesResult slide={selected} responses={responses} />
              ) : selected.type === "ranking" ? (
                <RankingResult slide={selected} responses={responses} />
              ) : selected.type === "quiz" ? (
                <QuizResult slide={selected} responses={responses} />
              ) : selected.type === "quiz-type" ? (
                <QuizTypeResult slide={selected} responses={responses} />
              ) : selected.type === "pin-on-image" ? (
                <PinOnImageResult slide={selected} responses={responses} />
              ) : selected.type === "qna" ? (
                <QnaResult presentationId={id} />
              ) : (
                <p className="text-muted">Bu slayt tipi cevap toplamaz.</p>
              )}
            </div>
          ) : (
            <p className="text-muted text-center py-16">Henüz slayt yok.</p>
          )}
        </section>
      </div>
    </main>
  );
}
