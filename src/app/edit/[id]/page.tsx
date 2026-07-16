"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ThemePanel from "@/components/editor/ThemePanel";
import { useAuthUser, usePresentation, useSlides } from "@/lib/hooks";
import {
  addSlide,
  deleteSlide,
  duplicateSlide,
  setCurrentSlide,
  swapSlideOrder,
  updateSlide,
} from "@/lib/presentations";
import {
  AVAILABLE_SLIDE_TYPES,
  Slide,
  SLIDE_TYPE_ICONS,
  SLIDE_TYPE_LABELS,
  SlideType,
} from "@/lib/types";

/** Slayt editörü: solda slayt listesi, sağda seçili slaytın ayarları. */
export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Seçim yoksa veya seçili slayt silindiyse ilk slaytı seç
  useEffect(() => {
    if (slides.length && !slides.some((s) => s.id === selectedId)) {
      setSelectedId(slides[0].id);
    }
  }, [slides, selectedId]);

  const selected = slides.find((s) => s.id === selectedId) ?? null;
  const isLive = presentation?.isLive ?? false;

  /** Slayt seçimi: sunum canlıysa izleyicileri de bu slayta taşı (canlı senkron). */
  function select(slideId: string, slideIndex: number) {
    setSelectedId(slideId);
    if (isLive) setCurrentSlide(id, slideIndex);
  }

  async function add(type: SlideType) {
    const newId = await addSlide(id, type, slides.length);
    setSelectedId(newId);
  }

  if (!presentation) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0">←</Link>
          <span className="font-display font-semibold truncate">{presentation.title}</span>
          <span className="text-muted text-sm shrink-0 hidden sm:inline">
            Kod: <span className="font-mono">{presentation.joinCode}</span>
          </span>
          {isLive && (
            <span className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-brand bg-brand-soft rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              CANLI
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setThemeOpen(true)} className="btn-ghost !py-2 !px-4 text-sm">
            🎨 Tema
          </button>
          <Link href={`/present/${id}`} className="btn-primary !py-2 !px-4 text-sm">
            ▶ Sun
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Slayt listesi */}
        <aside className="md:w-64 bg-white border-b md:border-b-0 md:border-r border-line p-3 flex md:flex-col gap-2 overflow-auto">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => select(s.id, i)}
              className={`shrink-0 md:shrink text-left rounded-xl border px-3 py-2 w-40 md:w-full transition-colors ${
                s.id === selectedId
                  ? "border-accent bg-accent-soft/50"
                  : "border-line hover:border-muted"
              }`}
            >
              <p className="text-xs text-muted">
                {i + 1} · {SLIDE_TYPE_ICONS[s.type]} {SLIDE_TYPE_LABELS[s.type]}
              </p>
              <p className="text-sm font-medium truncate">{s.question}</p>
            </button>
          ))}
          <div className="shrink-0 md:mt-2 flex md:flex-col gap-2">
            {AVAILABLE_SLIDE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => add(t)}
                className="border border-dashed border-line hover:border-accent hover:text-accent rounded-xl px-3 py-2 text-sm text-muted transition-colors"
              >
                + {SLIDE_TYPE_ICONS[t]} {SLIDE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </aside>

        {/* Slayt ayarları */}
        <section className="flex-1 p-4 md:p-8">
          {selected ? (
            <SlideEditor
              key={selected.id}
              presentationId={id}
              slide={selected}
              index={slides.findIndex((s) => s.id === selected.id)}
              count={slides.length}
              onMove={async (dir) => {
                const i = slides.findIndex((s) => s.id === selected.id);
                const j = i + dir;
                if (j < 0 || j >= slides.length) return;
                await swapSlideOrder(id, slides[i], slides[j]);
              }}
              onDuplicate={async () => {
                const newId = await duplicateSlide(id, selected);
                setSelectedId(newId);
              }}
              onDelete={async () => {
                await deleteSlide(id, selected.id);
                setSelectedId(null);
              }}
            />
          ) : (
            <p className="text-muted text-center py-16">
              Soldan bir slayt tipi ekleyerek başla.
            </p>
          )}
        </section>
      </div>

      {themeOpen && (
        <ThemePanel
          presentationId={id}
          theme={presentation.theme}
          onClose={() => setThemeOpen(false)}
        />
      )}
    </main>
  );
}

// Seçenek listesi düzenlenen tipler ve etiketleri
const OPTION_LABELS: Partial<Record<SlideType, string>> = {
  "multiple-choice": "Seçenekler",
  scales: "İfadeler (her biri 1–5 puanlanır)",
  ranking: "Sıralanacak seçenekler",
  quiz: "Seçenekler (doğru cevabı işaretle)",
};

function SlideEditor({
  presentationId,
  slide,
  index,
  count,
  onMove,
  onDuplicate,
  onDelete,
}: {
  presentationId: string;
  slide: Slide;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [question, setQuestion] = useState(slide.question);
  const [options, setOptions] = useState<string[]>(slide.options);
  const [description, setDescription] = useState(slide.settings?.description ?? "");
  const [allowMultiple, setAllowMultiple] = useState(slide.settings?.allowMultiple ?? false);
  const [correctIndex, setCorrectIndex] = useState(slide.settings?.correctIndex ?? 0);
  const [timeLimit, setTimeLimit] = useState(slide.settings?.timeLimit ?? 20);
  const [maxEntries, setMaxEntries] = useState(
    slide.settings?.maxEntries ?? (slide.type === "word-cloud" ? 3 : 1)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const optionLabel = OPTION_LABELS[slide.type];
  const minOptions = slide.type === "multiple-choice" ? 2 : 1;
  const hasMaxEntries = slide.type === "word-cloud" || slide.type === "open-ended";

  async function save() {
    setSaving(true);
    setSaved(false);
    await updateSlide(presentationId, slide.id, {
      question: question.trim() || "Soru",
      options: options.map((o) => o.trim()).filter(Boolean),
      settings: {
        ...slide.settings,
        ...(slide.type === "content" ? { description } : {}),
        ...(slide.type === "multiple-choice" ? { allowMultiple } : {}),
        ...(hasMaxEntries ? { maxEntries: Math.min(10, Math.max(1, maxEntries)) } : {}),
        ...(slide.type === "quiz"
          ? {
              correctIndex: Math.min(correctIndex, options.length - 1),
              timeLimit: Math.min(120, Math.max(5, timeLimit)),
            }
          : {}),
      },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto card p-6">
      <p className="eyebrow mb-4">
        {SLIDE_TYPE_LABELS[slide.type]}
      </p>

      <label className="block text-sm font-medium mb-1">Soru</label>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="input-base mb-4 font-semibold"
      />

      {optionLabel && (
        <>
          <label className="block text-sm font-medium mb-1">{optionLabel}</label>
          <div className="flex flex-col gap-2 mb-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                {slide.type === "quiz" && (
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                    title="Doğru cevap"
                    className="w-5 h-5 accent-[#008300] cursor-pointer shrink-0"
                  />
                )}
                <input
                  value={opt}
                  onChange={(e) =>
                    setOptions(options.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  className="input-base flex-1 !py-2"
                />
                <button
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  disabled={options.length <= minOptions}
                  className="text-muted hover:text-brand disabled:opacity-30 px-2 cursor-pointer"
                  aria-label={`Seçenek ${i + 1} sil`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setOptions([...options, `Seçenek ${options.length + 1}`])}
            disabled={options.length >= 8}
            className="text-accent text-sm font-medium mb-4 disabled:opacity-40"
          >
            + Seçenek ekle
          </button>
        </>
      )}

      {slide.type === "content" && (
        <>
          <label className="block text-sm font-medium mb-1">Açıklama</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input-base mb-4 resize-none"
          />
        </>
      )}

      {slide.type === "quiz" && (
        <label className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold">Süre (saniye)</span>
          <input
            type="number"
            min={5}
            max={120}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="input-base !w-24 !py-1.5 text-center tabular-nums"
          />
        </label>
      )}

      {slide.type === "multiple-choice" && (
        <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            className="w-5 h-5 accent-[#2563eb]"
          />
          <span className="text-sm font-semibold">Birden fazla seçime izin ver</span>
        </label>
      )}

      {hasMaxEntries && (
        <label className="flex items-center gap-3 mb-4">
          <span className="text-sm font-semibold">Kişi başı cevap hakkı</span>
          <input
            type="number"
            min={1}
            max={10}
            value={maxEntries}
            onChange={(e) => setMaxEntries(Number(e.target.value))}
            className="input-base !w-20 !py-1.5 text-center tabular-nums"
          />
        </label>
      )}

      <div className="flex items-center gap-1.5 mb-4 pt-4 border-t border-line">
        <button onClick={() => onMove(-1)} disabled={index <= 0} className="btn-ghost !py-1.5 !px-3 text-sm" title="Yukarı taşı">↑</button>
        <button onClick={() => onMove(1)} disabled={index >= count - 1} className="btn-ghost !py-1.5 !px-3 text-sm" title="Aşağı taşı">↓</button>
        <button onClick={onDuplicate} className="btn-ghost !py-1.5 !px-3 text-sm">⧉ Çoğalt</button>
        <span className="text-muted text-xs ml-auto tabular-nums">Slayt {index + 1} / {count}</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-line">
        <button onClick={onDelete} className="text-muted hover:text-brand hover:bg-brand-soft/50 rounded-full px-3 py-2 text-sm font-semibold cursor-pointer">
          Slaytı sil
        </button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-semibold" style={{ color: "var(--series-2)" }}>Kaydedildi ✓</span>}
          <button
            onClick={save}
            disabled={saving}
            className="bg-ink hover:bg-black disabled:opacity-40 text-white font-semibold rounded-lg px-5 py-2"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
