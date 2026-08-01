"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import BarChartResult from "@/components/results/BarChartResult";
import Grid2x2Result from "@/components/results/Grid2x2Result";
import GuessNumberResult from "@/components/results/GuessNumberResult";
import HundredPointsResult from "@/components/results/HundredPointsResult";
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
import { listSessions } from "@/lib/presentations";
import { Icon } from "@/components/Icon";
import { SLIDE_TYPE_ICON_NAMES } from "@/lib/slideTypeIcons";
import { SessionRecord, SLIDE_TYPE_LABELS } from "@/lib/types";

/** Oturum kaydını "12 Tem 14:30–15:10" biçiminde etiketler. */
function sessionLabel(s: SessionRecord, index: number): string {
  const start = s.startedAt?.toDate?.();
  const end = s.endedAt?.toDate?.();
  const anchor = start ?? end;
  if (!anchor) return `Geçmiş oturum ${index + 1}`;
  const date = anchor.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const t = (d?: Date) =>
    d ? d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : "";
  const range = [t(start), t(end)].filter(Boolean).join("–");
  return `${date} ${range}`.trim();
}

/** Sunum sonrası sonuç inceleme: slayt slayt gezin + CSV export. */
export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const participants = useParticipants(id); // filtresiz: CSV'de eski oturum adları da çözülsün
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Oturum seçici: "all" = tüm oturumlar; aksi halde bir sessionId.
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionSel, setSessionSel] = useState<string>("all");
  useEffect(() => {
    listSessions(id).then(setSessions).catch(() => {});
  }, [id, presentation?.sessionId]); // yeni oturum açılınca arşiv listesi tazelenir
  const sessionFilter = sessionSel === "all" ? undefined : sessionSel;

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (slides.length && !slides.some((s) => s.id === selectedId)) {
      setSelectedId(slides[0].id);
    }
  }, [slides, selectedId]);

  const selected = slides.find((s) => s.id === selectedId) ?? null;
  const responses = useLiveResponses(id, selected?.id ?? null, sessionFilter);

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
          if (sessionFilter && r.sessionId !== sessionFilter) return;
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

  /** Grafikli PDF özet: slayt slayt sorular + çubuk grafikler (jspdf, dış servis yok). */
  async function exportPdf() {
    if (!presentation || exporting) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      // jsPDF gömülü fontu ğ/ş/ı bilmiyor → Türkçe karakterleri katla (Pulse deseni)
      const fold = (s: string) =>
        s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" })[m] ?? m);
      const pdf = new jsPDF();
      let y = 0;
      const need = (h: number) => {
        if (y + h > 282) {
          pdf.addPage();
          y = 18;
        }
      };
      const bars = (rows: { label: string; n: number; hint?: string }[]) => {
        const max = Math.max(1, ...rows.map((r) => r.n));
        for (const r of rows) {
          need(8);
          pdf.setFontSize(9);
          pdf.text(fold(r.label).slice(0, 48), 14, y + 3.5);
          pdf.setFillColor(234, 235, 250);
          pdf.rect(104, y, 66, 4.5, "F");
          pdf.setFillColor(79, 70, 229);
          pdf.rect(104, y, (66 * r.n) / max, 4.5, "F");
          pdf.setFontSize(8.5);
          pdf.text(`${r.n}${r.hint ? ` ${r.hint}` : ""}`, 172, y + 3.5);
          y += 7;
        }
      };

      pdf.setFontSize(16);
      pdf.text(`FlowMeter Raporu — ${fold(presentation.title)}`.slice(0, 70), 14, 18);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`${new Date().toLocaleString("tr-TR")} · ${sessionSel === "all" ? "Tum oturumlar" : "Secili oturum"} · kod ${presentation.joinCode}`, 14, 25);
      pdf.setTextColor(0);
      y = 36;

      const noChart = ["content", "image", "video", "instructions", "leaderboard", "qna"];
      for (const [i, s] of slides.entries()) {
        if (s.settings?.skipped || noChart.includes(s.type)) continue;
        const snap = await getDocs(query(collection(db(), "presentations", id, "slides", s.id, "responses"), orderBy("createdAt")));
        const rs = snap.docs
          .map((d) => d.data())
          .filter((r) => (!sessionFilter || r.sessionId === sessionFilter) && r.status !== "pending");

        need(22);
        pdf.setFontSize(12);
        pdf.text(fold(`${i + 1}. ${s.question}`).slice(0, 88), 14, y);
        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text(`${fold(SLIDE_TYPE_LABELS[s.type])} · ${rs.length} cevap`, 14, y + 5.5);
        pdf.setTextColor(0);
        y += 12;
        if (rs.length === 0) {
          y += 3;
          continue;
        }

        if (s.type === "multiple-choice" || s.type === "quiz") {
          const counts = s.options.map(() => 0);
          rs.forEach((r) => {
            const v = r.value;
            const idxs = Array.isArray(v) ? v : [v];
            idxs.forEach((x) => {
              if (typeof x === "number" && counts[x] !== undefined) counts[x] += 1;
            });
          });
          bars(s.options.map((o, oi) => ({ label: o, n: counts[oi], hint: s.type === "quiz" && s.settings?.correctIndex === oi ? "(dogru)" : undefined })));
        } else if (s.type === "word-cloud" || s.type === "quiz-type") {
          const freq = new Map<string, number>();
          rs.forEach((r) => {
            const raw = Array.isArray(r.value) ? r.value[0] : r.value;
            const w = String(raw ?? "").trim().toLocaleLowerCase("tr");
            if (w) freq.set(w, (freq.get(w) ?? 0) + 1);
          });
          bars([...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, n]) => ({ label: w, n })));
        } else if (s.type === "open-ended") {
          pdf.setFontSize(9);
          rs.slice(0, 12).forEach((r) => {
            const lines: string[] = pdf.splitTextToSize(`• ${fold(String(r.value ?? ""))}`, 176);
            need(lines.length * 4.5 + 2);
            pdf.text(lines, 14, y + 3);
            y += lines.length * 4.5 + 1.5;
          });
          if (rs.length > 12) {
            need(6);
            pdf.setTextColor(120);
            pdf.text(`… ve ${rs.length - 12} cevap daha (CSV'de tamami)`, 14, y + 3);
            pdf.setTextColor(0);
            y += 6;
          }
        } else if (s.type === "scales") {
          const sums = s.options.map(() => ({ t: 0, n: 0 }));
          rs.forEach((r) => {
            if (Array.isArray(r.value))
              (r.value as number[]).forEach((v, vi) => {
                if (typeof v === "number" && sums[vi]) {
                  sums[vi].t += v;
                  sums[vi].n += 1;
                }
              });
          });
          bars(s.options.map((o, oi) => ({ label: o, n: sums[oi].n ? Math.round((sums[oi].t / sums[oi].n) * 10) / 10 : 0, hint: "ort" })));
        } else if (s.type === "guess-number") {
          const nums = rs.map((r) => Number(r.value)).filter((n) => !Number.isNaN(n));
          const avg = nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
          need(7);
          pdf.setFontSize(9);
          pdf.text(`Ortalama ${avg} · en dusuk ${Math.min(...nums)} · en yuksek ${Math.max(...nums)}${s.settings?.correctNumber !== undefined ? ` · dogru ${s.settings.correctNumber}` : ""}`, 14, y + 3);
          y += 8;
        } else {
          need(7);
          pdf.setFontSize(9);
          pdf.setTextColor(120);
          pdf.text("Bu tipin grafigi icin Sonuclar ekranina bak (CSV'de ham veri var).", 14, y + 3);
          pdf.setTextColor(0);
          y += 8;
        }
        y += 6;
      }
      pdf.save(`flowmeter-rapor-${presentation.joinCode || id}.pdf`);
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
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg">←</Link>
          <span className="shrink-0">
            <Logo size="sm" />
          </span>
          <span className="font-display font-semibold truncate min-w-0 flex-1">{presentation.title}</span>
          <span className="eyebrow shrink-0 hidden md:inline">Sonuçlar</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sessionSel}
            onChange={(e) => setSessionSel(e.target.value)}
            className="input-base !py-2 !px-3 text-sm !w-auto max-w-[13rem]"
            title="Oturum seç"
          >
            <option value="all">Tüm oturumlar</option>
            {presentation?.sessionId && (
              <option value={presentation.sessionId}>Şu anki oturum</option>
            )}
            {sessions
              .filter((s) => s.id !== presentation?.sessionId)
              .map((s, i) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s, i)}
                </option>
              ))}
          </select>
          <button onClick={exportPdf} disabled={exporting} className="btn-ghost !py-2 !px-4 text-sm" title="Grafikli tek dosya özet — yöneticiye atmalık">
            {exporting ? "…" : "📄 PDF"}
          </button>
          <button onClick={exportCsv} disabled={exporting} className="btn-primary !py-2 !px-4 text-sm">
            {exporting ? "Hazırlanıyor…" : "⬇ CSV indir"}
          </button>
        </div>
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
                <span className="inline-flex items-center gap-1 align-middle">{i + 1} · <Icon name={SLIDE_TYPE_ICON_NAMES[s.type]} size={12} /> {SLIDE_TYPE_LABELS[s.type]}</span>
              </p>
              <p className="text-sm font-medium truncate">{s.question}</p>
            </button>
          ))}
        </aside>

        <section className="flex-1 p-4 md:p-8">
          {selected ? (
            <div className="max-w-3xl mx-auto card p-6 md:p-8">
              <p className="eyebrow mb-2">
                <span className="inline-flex items-center gap-1.5"><Icon name={SLIDE_TYPE_ICON_NAMES[selected.type]} size={13} /> {SLIDE_TYPE_LABELS[selected.type]}</span>
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
              ) : selected.type === "guess-number" ? (
                <GuessNumberResult slide={selected} responses={responses} />
              ) : selected.type === "hundred-points" ? (
                <HundredPointsResult slide={selected} responses={responses} />
              ) : selected.type === "grid-2x2" ? (
                <Grid2x2Result slide={selected} responses={responses} />
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
