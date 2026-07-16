"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthUser, usePresentation, useSlides } from "@/lib/hooks";
import { addSlide, deleteSlide, updateSlide } from "@/lib/presentations";
import { AVAILABLE_SLIDE_TYPES, Slide, SLIDE_TYPE_LABELS, SlideType } from "@/lib/types";

/** Slayt editörü: solda slayt listesi, sağda seçili slaytın ayarları. */
export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  async function add(type: SlideType) {
    const newId = await addSlide(id, type, slides.length);
    setSelectedId(newId);
  }

  if (!presentation) {
    return <main className="min-h-screen flex items-center justify-center">Yükleniyor…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 shrink-0">←</Link>
          <span className="font-semibold truncate">{presentation.title}</span>
          <span className="text-slate-400 text-sm shrink-0 hidden sm:inline">
            Kod: <span className="font-mono">{presentation.joinCode}</span>
          </span>
        </div>
        <Link
          href={`/present/${id}`}
          className="bg-brand-navy hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium shrink-0"
        >
          ▶ Sun
        </Link>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        {/* Slayt listesi */}
        <aside className="md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-3 flex md:flex-col gap-2 overflow-auto">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`shrink-0 md:shrink text-left rounded-lg border-2 px-3 py-2 w-40 md:w-full ${
                s.id === selectedId
                  ? "border-brand-blue bg-brand-sky"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-xs text-slate-400">
                {i + 1} · {SLIDE_TYPE_LABELS[s.type]}
              </p>
              <p className="text-sm font-medium truncate">{s.question}</p>
            </button>
          ))}
          <div className="shrink-0 md:mt-2 flex md:flex-col gap-2">
            {AVAILABLE_SLIDE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => add(t)}
                className="border border-dashed border-slate-300 hover:border-brand-blue hover:text-brand-blue rounded-lg px-3 py-2 text-sm text-slate-500"
              >
                + {SLIDE_TYPE_LABELS[t]}
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
              onDelete={async () => {
                await deleteSlide(id, selected.id);
                setSelectedId(null);
              }}
            />
          ) : (
            <p className="text-slate-400 text-center py-16">
              Soldan bir slayt tipi ekleyerek başla.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

// Seçenek listesi düzenlenen tipler ve etiketleri
const OPTION_LABELS: Partial<Record<SlideType, string>> = {
  "multiple-choice": "Seçenekler",
  scales: "İfadeler (her biri 1–5 puanlanır)",
  ranking: "Sıralanacak seçenekler",
};

function SlideEditor({
  presentationId,
  slide,
  onDelete,
}: {
  presentationId: string;
  slide: Slide;
  onDelete: () => Promise<void>;
}) {
  const [question, setQuestion] = useState(slide.question);
  const [options, setOptions] = useState<string[]>(slide.options);
  const [description, setDescription] = useState(slide.settings?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const optionLabel = OPTION_LABELS[slide.type];
  const minOptions = slide.type === "multiple-choice" ? 2 : 1;

  async function save() {
    setSaving(true);
    setSaved(false);
    await updateSlide(presentationId, slide.id, {
      question: question.trim() || "Soru",
      options: options.map((o) => o.trim()).filter(Boolean),
      settings: {
        ...slide.settings,
        ...(slide.type === "content" ? { description } : {}),
      },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
        {SLIDE_TYPE_LABELS[slide.type]}
      </p>

      <label className="block text-sm font-medium mb-1">Soru</label>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-3 mb-4 focus:outline-none focus:border-brand-blue"
      />

      {optionLabel && (
        <>
          <label className="block text-sm font-medium mb-1">{optionLabel}</label>
          <div className="flex flex-col gap-2 mb-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) =>
                    setOptions(options.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-brand-blue"
                />
                <button
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  disabled={options.length <= minOptions}
                  className="text-slate-400 hover:text-red-500 disabled:opacity-30 px-2"
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
            className="text-brand-blue text-sm font-medium mb-4 disabled:opacity-40"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 mb-4 resize-none focus:outline-none focus:border-brand-blue"
          />
        </>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button onClick={onDelete} className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-2 text-sm">
          Slaytı sil
        </button>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-600 text-sm">Kaydedildi ✓</span>}
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-lg px-5 py-2"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
