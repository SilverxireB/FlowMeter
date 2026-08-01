"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import AddSlideSheet from "@/components/editor/AddSlideSheet";
import Sheet from "@/components/editor/Sheet";
import SlidePreview from "@/components/editor/SlidePreview";
import ThemePanel from "@/components/editor/ThemePanel";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuthUser, usePresentation, useSlides } from "@/lib/hooks";
import { fileToCompressedDataUrl } from "@/lib/images";
import { setResponseDryRun } from "@/lib/responses";
import { Timestamp } from "firebase/firestore";
import Grid2x2Vote from "@/components/vote/Grid2x2Vote";
import GuessNumberVote from "@/components/vote/GuessNumberVote";
import HundredPointsVote from "@/components/vote/HundredPointsVote";
import MultipleChoiceVote from "@/components/vote/MultipleChoiceVote";
import OpenEndedVote from "@/components/vote/OpenEndedVote";
import PinOnImageVote from "@/components/vote/PinOnImageVote";
import QuizTypeVote from "@/components/vote/QuizTypeVote";
import QuizVote from "@/components/vote/QuizVote";
import RankingVote from "@/components/vote/RankingVote";
import ScalesVote from "@/components/vote/ScalesVote";
import WordCloudVote from "@/components/vote/WordCloudVote";
import {
  addSlide,
  changeSlideType,
  deleteSlide,
  duplicateSlide,
  reorderSlides,
  resetResponses,
  setAudienceLanguage,
  setChatEnabled,
  setPresentationMode,
  setCurrentSlide,
  setSlideSkipped,
  swapSlideOrder,
  updateSlide,
} from "@/lib/presentations";
import {
  AVAILABLE_SLIDE_TYPES,
  Presentation,
  Slide,
  SLIDE_TYPE_LABELS,
  SlideType,
} from "@/lib/types";

type SheetKind = "edit" | "add" | "more" | "interactivity" | "test" | null;

/**
 * Slayt editörü — Menti mobil düzeni: ortada canlı önizleme, altında yüzen
 * araç çubuğu (✏️ ➕ 🎨 ⋯), en altta yatay slayt film şeridi. Düzenleme
 * panelleri bottom-sheet (geniş ekranda sağ çekmece) olarak açılır,
 * değişiklikler otomatik kaydedilir.
 */
export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  /** Sürükle-bırak biter bitmez yeni sırayı yazar. */
  async function commitReorder() {
    if (dragId && dropId && dragId !== dropId) {
      const ids = slides.map((s) => s.id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(dropId);
      if (from !== -1 && to !== -1) {
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        await reorderSlides(id, ids);
      }
    }
    setDragId(null);
    setDropId(null);
  }

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
  const selectedIndex = selected ? slides.findIndex((s) => s.id === selected.id) : -1;
  const isLive = presentation?.isLive ?? false;

  /** Slayt seçimi: sunum canlıysa izleyicileri de bu slayta taşı (canlı senkron). */
  function select(slideId: string, slideIndex: number) {
    setSelectedId(slideId);
    if (isLive) setCurrentSlide(id, slideIndex);
  }

  async function add(type: SlideType) {
    const newId = await addSlide(id, type, slides.length);
    setSelectedId(newId);
    setSheet("edit");
  }

  if (!presentation) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-wash">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  return (
    <main className="h-dvh flex flex-col bg-wash">
      {/* ── Üst bar ── */}
      <header className="bg-white/80 backdrop-blur border-b border-line px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard?p=decks" className="text-muted hover:text-ink shrink-0 text-lg px-1" aria-label="Panele dön">←</Link>
          <span className="font-display font-semibold truncate">{presentation.title}</span>
          {isLive && (
            <span className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-brand bg-brand-soft rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              CANLI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="btn-ghost !py-2 !px-3 text-sm"
            aria-label="Sunum menüsü"
            aria-expanded={menuOpen}
          >
            <Icon name="dots" size={18} />
          </button>
          <Link href={`/present/${id}`} className="btn-accent !py-2 !px-5 text-sm">
            Sun
          </Link>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-40 card !rounded-2xl p-2 w-56 flex flex-col animate-pop">
                <Link href={`/present/${id}`} className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper">
                  Önizle / Sun
                </Link>
                <Link href={`/results/${id}`} className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper">
                  Sonuçlar
                </Link>
                <Link href={`/remote/${id}`} className="rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper">
                  📱 Kumanda
                </Link>
                <div className="border-t border-line my-1.5" />
                <label className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-paper cursor-pointer">
                  💬 Canlı sohbet
                  <input
                    type="checkbox"
                    checked={presentation.chatEnabled ?? false}
                    onChange={(e) => setChatEnabled(id, e.target.checked)}
                    className="w-5 h-5 accent-[#2563eb]"
                  />
                </label>
                <p className="px-4 py-2 text-xs text-muted">
                  Katılım kodu:{" "}
                  <span className="font-display font-semibold tracking-[0.15em] text-accent">
                    {presentation.joinCode}
                  </span>
                </p>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Önizleme sahnesi ── */}
      <section className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-3 gap-4 overflow-hidden">
        {selected ? (
          <div className="w-full max-w-3xl min-h-0 flex items-center">
            <div className="w-full relative">
              <SlidePreview slide={selected} theme={presentation.theme} />
              {selected.settings?.skipped && (
                <span className="absolute top-2 left-2 chip !bg-ink !text-white !border-ink text-xs">
                  🚫 Atlanıyor
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-5xl mb-3" aria-hidden>🎬</p>
            <p className="text-muted">İlk slaytını ekleyerek başla.</p>
          </div>
        )}

        {/* Yüzen araç çubuğu */}
        <div className="card !rounded-full px-3 py-2 flex items-center gap-1 shrink-0">
          <ToolButton label="Slaytı düzenle" onClick={() => selected && setSheet("edit")} disabled={!selected}>
            <Icon name="pencil" />
          </ToolButton>
          <button
            onClick={() => setSheet("add")}
            aria-label="Slayt ekle"
            className="w-12 h-12 rounded-2xl bg-ink hover:bg-black text-white cursor-pointer transition-transform active:scale-95 flex items-center justify-center"
          >
            <Icon name="plus" size={24} />
          </button>
          <ToolButton label="Etkileşim" onClick={() => setSheet("interactivity")}>
            <Icon name="chat" />
          </ToolButton>
          <ToolButton label="Dene — katılımcı gözünden prova" onClick={() => selected && setSheet("test")} disabled={!selected}>
            <Icon name="play" />
          </ToolButton>
          <ToolButton label="Tema" onClick={() => setThemeOpen(true)}>
            <Icon name="palette" />
          </ToolButton>
          <ToolButton label="Diğer işlemler" onClick={() => selected && setSheet("more")} disabled={!selected}>
            <Icon name="dots" />
          </ToolButton>
        </div>
      </section>

      {/* ── Film şeridi (sürükle-bırak ile sırala) ── */}
      <footer className="shrink-0 bg-white/70 backdrop-blur border-t border-line px-3 pt-2 pb-3 overflow-x-auto">
        <div className="flex gap-3 items-end min-w-max">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => select(s.id, i)}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId && dragId !== s.id) setDropId(s.id);
              }}
              onDragEnd={commitReorder}
              onDrop={(e) => {
                e.preventDefault();
                commitReorder();
              }}
              className={`text-left shrink-0 w-32 cursor-grab active:cursor-grabbing group transition-opacity ${
                dragId === s.id ? "opacity-40" : ""
              }`}
            >
              <span className="text-xs text-muted font-semibold tabular-nums pl-0.5">
                {i + 1}
                {s.settings?.skipped && <span className="ml-1" title="Atlanıyor">·atlanıyor</span>}
              </span>
              <div
                className={`rounded-xl overflow-hidden border-2 transition-all ${
                  dropId === s.id && dragId !== s.id
                    ? "border-accent ring-2 ring-accent-soft scale-[1.03]"
                    : s.id === selectedId
                      ? "border-accent ring-2 ring-accent-soft"
                      : "border-line group-hover:border-muted"
                } ${s.settings?.skipped ? "opacity-50" : ""}`}
              >
                <SlidePreview slide={s} theme={presentation.theme} mini />
              </div>
            </button>
          ))}
          <button
            onClick={() => setSheet("add")}
            aria-label="Slayt ekle"
            className="shrink-0 w-32 aspect-video mb-0.5 rounded-xl border-2 border-dashed border-line hover:border-accent hover:text-accent text-muted text-2xl cursor-pointer transition-colors"
          >
            +
          </button>
        </div>
      </footer>

      {/* ── Paneller ── */}
      {sheet === "add" && (
        <AddSlideSheet
          onPick={(t) => {
            add(t);
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === "test" && selected && (
        <Sheet title="Dene — katılımcı gözünden" onClose={() => setSheet(null)}>
          <TestPane slide={selected} presentationId={id} />
        </Sheet>
      )}

      {sheet === "interactivity" && (
        <Sheet title="Etkileşim" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-6">
            <div>
              <p className="eyebrow mb-3">⏱ Sunum temposu</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { v: "presenter-pace", label: "🎤 Sunucu yönetir", desc: "Canlı sunum: herkes perdedeki slaytı görür, sen ilerletirsin." },
                    { v: "audience-pace", label: "📝 Katılımcı kendi ilerler", desc: "Anket modu: linki gönder, herkes kendi hızında doldurur. Yarışma slaytları bu modda atlanır." },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setPresentationMode(id, o.v)}
                    className={`text-left rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
                      (presentation.mode ?? "presenter-pace") === o.v ? "border-accent bg-accent-soft" : "border-line hover:border-ink/30"
                    }`}
                  >
                    <span className="text-sm font-bold block">{o.label}</span>
                    <span className="text-muted text-xs">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">🌐 Katılımcı dili</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { v: "tr", label: "🇹🇷 Türkçe" },
                    { v: "en", label: "🇬🇧 English" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setAudienceLanguage(id, o.v)}
                    className={`text-left rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
                      (presentation.language ?? "tr") === o.v ? "border-accent bg-accent-soft" : "border-line hover:border-ink/30"
                    }`}
                  >
                    <span className="text-sm font-bold block">{o.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-muted text-xs mt-2">
                Yalnız izleyicinin telefonundaki metinleri değiştirir; kokpit Türkçe kalır.
              </p>
            </div>
            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">💬 Canlı sohbet</p>
              <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                <span className="text-sm font-semibold">Canlı sohbeti aç</span>
                <input
                  type="checkbox"
                  checked={presentation.chatEnabled ?? false}
                  onChange={(e) => setChatEnabled(id, e.target.checked)}
                  className="w-5 h-5 accent-[#2563eb]"
                />
              </label>
              <p className="text-muted text-xs mt-2">
                Açıkken izleyiciler telefonlarındaki 💬 ile mesaj yazar; sunucu ekranından
                moderasyon yapıp mesaj silebilirsin.
              </p>
            </div>
            <div className="border-t border-line pt-5">
              <p className="eyebrow mb-3">🙋 Soru & Cevap</p>
              <p className="text-muted text-sm">
                Soru & Cevap, bir <strong>slayt tipi</strong> olarak eklenir: <b>+</b> → Etkileşimli
                sorular → Soru & Cevap. İzleyiciler soru gönderip birbirininkini oylar; sunum
                ekranından gizleyip silebilirsin.
              </p>
              <button
                onClick={() => add("qna")}
                className="btn-ghost mt-3 !py-2 !px-4 text-sm"
              >
                + Soru & Cevap slaytı ekle
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {sheet === "edit" && selected && (
        <Sheet title="Düzenle" onClose={() => setSheet(null)}>
          <SlideEditor key={`${selected.id}:${selected.type}`} presentationId={id} slide={selected} />
        </Sheet>
      )}

      {sheet === "more" && selected && (
        <MoreSheet
          presentation={presentation}
          slide={selected}
          index={selectedIndex}
          count={slides.length}
          onMove={async (dir) => {
            const j = selectedIndex + dir;
            if (j < 0 || j >= slides.length) return;
            await swapSlideOrder(id, slides[selectedIndex], slides[j]);
          }}
          onDuplicate={async () => {
            const newId = await duplicateSlide(id, selected);
            setSelectedId(newId);
            setSheet(null);
          }}
          onDelete={async () => {
            await deleteSlide(id, selected.id);
            setSelectedId(null);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}

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

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="w-11 h-11 rounded-full flex items-center justify-center text-ink hover:bg-paper cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-default"
    >
      {children}
    </button>
  );
}

/** ⋯ menüsü: taşı, çoğalt, atla, cevapları temizle, sil (Menti slide menu). */
function MoreSheet({
  presentation,
  slide,
  index,
  count,
  onMove,
  onDuplicate,
  onDelete,
  onClose,
}: {
  presentation: Presentation;
  slide: Slide;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const Item = ({
    onClick,
    danger,
    children,
    disabled,
  }: {
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default ${
        danger ? "text-brand hover:bg-brand-soft/50" : "hover:bg-paper"
      }`}
    >
      {children}
    </button>
  );

  return (
    <Sheet title={`Slayt ${index + 1} / ${count}`} onClose={onClose}>
      <div className="flex flex-col gap-0.5 -mx-2">
        <Item onClick={() => onMove(-1)} disabled={index <= 0}><Icon name="up" size={15} /> Yukarı taşı</Item>
        <Item onClick={() => onMove(1)} disabled={index >= count - 1}><Icon name="down" size={15} /> Aşağı taşı</Item>
        <Item onClick={onDuplicate}><Icon name="copy" size={15} /> Slaytı çoğalt</Item>
        <Item
          onClick={async () => {
            await setSlideSkipped(presentation.id, slide, !slide.settings?.skipped);
            onClose();
          }}
        >
          {slide.settings?.skipped ? <><Icon name="eye" size={15} /> Atlamayı geri al</> : <><Icon name="close" size={15} /> Slaytı atla</>}
        </Item>
        <div className="border-t border-line my-2" />
        <Item
          onClick={() =>
            confirm(
              { title: "Cevapları temizle", message: "Bu slaytın tüm cevapları silinecek. Bu işlem geri alınamaz.", confirmLabel: "Temizle", danger: true },
              async () => {
                await resetResponses(presentation.id, slide.id);
                onClose();
              }
            )
          }
        >
          <Icon name="undo" size={15} /> Cevapları temizle
        </Item>
        <Item
          danger
          onClick={() =>
            confirm(
              { title: "Slaytı sil", message: "Slayt ve içeriği silinecek. Bu işlem geri alınamaz.", confirmLabel: "Sil", danger: true },
              () => void onDelete()
            )
          }
        >
          <Icon name="trash" size={15} /> Slaytı sil
        </Item>
      </div>
      {dialog}
    </Sheet>
  );
}

// Seçenek listesi düzenlenen tipler ve etiketleri
const OPTION_LABELS: Partial<Record<SlideType, string>> = {
  "multiple-choice": "Seçenekler",
  scales: "İfadeler (her biri 1–5 puanlanır)",
  ranking: "Sıralanacak seçenekler",
  quiz: "Seçenekler (doğru cevabı işaretle)",
  "quiz-type": "Kabul edilen cevaplar",
  "hundred-points": "Puan dağıtılacak seçenekler",
  instructions: "Adımlar",
};

/** Soru görseli eklenebilen tipler (Menti "Design > Content image"). */
const IMAGE_TYPES: SlideType[] = [
  "multiple-choice",
  "word-cloud",
  "open-ended",
  "scales",
  "ranking",
  "quiz",
  "quiz-type",
  "pin-on-image",
  "content",
  "image",
];

/** Katlanır bölüm (Menti "More settings" accordion'u). */
function Accordion({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 py-4 text-left cursor-pointer"
        aria-expanded={open}
      >
        <span className="eyebrow flex items-center gap-2">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </span>
        <span className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>⌄</span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

/** Slaytın tipini yerinde değiştiren dropdown (Menti "Edit" sheet başındaki). */
function TypeSwitcher({
  presentationId,
  slide,
}: {
  presentationId: string;
  slide: Slide;
}) {
  return (
    <label className="block mb-5">
      <span className="block text-sm font-medium mb-1">Slayt tipi</span>
      <div className="relative">
        <select
          value={slide.type}
          onChange={(e) => changeSlideType(presentationId, slide, e.target.value as SlideType)}
          className="input-base !py-3 font-semibold appearance-none pr-10 cursor-pointer"
        >
          {AVAILABLE_SLIDE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SLIDE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden>⌄</span>
      </div>
    </label>
  );
}

/** Doğru alan seçici: görsele tıkla → daire merkezi; kaydırıcı → yarıçap. */
function CorrectAreaPicker({
  image,
  area,
  onChange,
}: {
  image: string;
  area: [number, number, number];
  onChange: (a: [number, number, number]) => void;
}) {
  function place(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onChange([x, y, area[2]]);
  }
  return (
    <div className="flex flex-col gap-3">
      <div onClick={place} className="relative rounded-xl overflow-hidden border-2 border-line cursor-crosshair select-none" role="button" aria-label="Doğru alanın merkezini seç">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="w-full h-auto block" draggable={false} />
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-500 bg-green-500/25"
          style={{
            left: `${area[0] * 100}%`,
            top: `${area[1] * 100}%`,
            width: `${area[2] * 200}%`,
            height: `${area[2] * 200}%`,
          }}
          aria-hidden
        />
      </div>
      <label className="flex items-center gap-3">
        <span className="text-sm font-semibold shrink-0">Alan boyutu</span>
        <input
          type="range"
          min={5}
          max={40}
          value={Math.round(area[2] * 100)}
          onChange={(e) => onChange([area[0], area[1], Number(e.target.value) / 100])}
          className="flex-1 accent-[#2563eb]"
        />
        <span className="text-sm tabular-nums text-muted w-10 text-right">%{Math.round(area[2] * 100)}</span>
      </label>
      <p className="text-muted text-xs">
        Yeşil dairenin içine işaret koyan izleyiciler puan kazanır (sabit 1000 + seri bonusu).
      </p>
    </div>
  );
}

/** Slayt ayar formu — otomatik kaydeder (600ms debounce, Kaydet butonu yok). */
function SlideEditor({ presentationId, slide }: { presentationId: string; slide: Slide }) {
  const [question, setQuestion] = useState(slide.question);
  const [options, setOptions] = useState<string[]>(slide.options);
  const [description, setDescription] = useState(slide.settings?.description ?? "");
  const [label, setLabel] = useState(slide.settings?.label ?? "");
  const [notes, setNotes] = useState(slide.settings?.notes ?? "");
  const [allowMultiple, setAllowMultiple] = useState(slide.settings?.allowMultiple ?? false);
  const [correctIndex, setCorrectIndex] = useState(slide.settings?.correctIndex ?? 0);
  const [timeLimit, setTimeLimit] = useState(slide.settings?.timeLimit ?? 20);
  const [scoreMode, setScoreMode] = useState<"time" | "fixed">(slide.settings?.scoreMode ?? "time");
  const [music, setMusic] = useState(slide.settings?.music ?? false);
  const [videoUrl, setVideoUrl] = useState(slide.settings?.videoUrl ?? "");
  const [image, setImage] = useState<string | undefined>(slide.settings?.image);
  const [correctArea, setCorrectArea] = useState<[number, number, number] | undefined>(
    slide.settings?.correctArea
  );
  const [correctNumber, setCorrectNumber] = useState(slide.settings?.correctNumber ?? 50);
  const [numMin, setNumMin] = useState(slide.settings?.min ?? 0);
  const [numMax, setNumMax] = useState(slide.settings?.max ?? 100);
  const [unit, setUnit] = useState(slide.settings?.unit ?? "");
  const [gridLabels, setGridLabels] = useState<[string, string, string, string]>(
    slide.settings?.gridLabels ?? ["Düşük", "Yüksek", "Kolay", "Zor"]
  );
  const [maxEntries, setMaxEntries] = useState(
    slide.settings?.maxEntries ?? (slide.type === "word-cloud" ? 3 : 1)
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  const optionLabel = OPTION_LABELS[slide.type];
  const minOptions = ["multiple-choice", "quiz", "hundred-points"].includes(slide.type) ? 2 : 1;
  const hasMaxEntries = slide.type === "word-cloud" || slide.type === "open-ended";
  const isQuiz = slide.type === "quiz" || slide.type === "quiz-type";
  const hasImage = IMAGE_TYPES.includes(slide.type);

  // Otomatik kayıt: alanlar değişince 600ms sonra yaz
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      const settings: Record<string, unknown> = {
        ...slide.settings,
        description: description.trim(),
        label: label.trim(),
        notes: notes.trim(),
      };
      if (slide.type === "multiple-choice") settings.allowMultiple = allowMultiple;
      if (hasMaxEntries) settings.maxEntries = Math.min(10, Math.max(1, maxEntries));
      if (isQuiz) {
        settings.timeLimit = Math.min(120, Math.max(5, timeLimit));
        settings.scoreMode = scoreMode;
        settings.music = music;
      }
      if (slide.type === "quiz")
        settings.correctIndex = Math.max(0, Math.min(correctIndex, options.length - 1));
      if (slide.type === "video") settings.videoUrl = videoUrl.trim();
      if (hasImage) {
        if (image) settings.image = image;
        else delete settings.image;
      }
      if (slide.type === "pin-on-image") {
        if (correctArea) settings.correctArea = correctArea;
        else delete settings.correctArea;
      }
      if (slide.type === "guess-number") {
        settings.min = numMin;
        settings.max = Math.max(numMin + 1, numMax);
        settings.correctNumber = Math.min(numMax, Math.max(numMin, correctNumber));
        settings.unit = unit.trim();
      }
      if (slide.type === "grid-2x2") settings.gridLabels = gridLabels;
      await updateSlide(presentationId, slide.id, {
        question: question.trim() || "Soru",
        options: options.map((o) => o.trim()).filter(Boolean),
        settings: settings as Slide["settings"],
      });
      setStatus("saved");
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, options, description, label, notes, allowMultiple, correctIndex, timeLimit, scoreMode, music, videoUrl, image, correctArea, correctNumber, numMin, numMax, unit, gridLabels, maxEntries]);

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setImgBusy(true);
    setImgError(null);
    try {
      setImage(await fileToCompressedDataUrl(file, 1200, 300_000));
    } catch (e) {
      setImgError(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setImgBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Kayıt durumu */}
      <p className="text-xs font-semibold text-right h-4 mb-1" aria-live="polite">
        {status === "saving" && <span className="text-muted animate-pulse">Kaydediliyor…</span>}
        {status === "saved" && <span style={{ color: "var(--series-2)" }}>Kaydedildi ✓</span>}
      </p>

      <TypeSwitcher presentationId={presentationId} slide={slide} />

      <label className="block text-sm font-medium mb-1">
        {slide.type === "content" || slide.type === "image" ? "Başlık" : "Soru"}
      </label>
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
                {/* Menti'deki gibi seri rengi noktası */}
                {["multiple-choice", "scales", "ranking"].includes(slide.type) && (
                  <span
                    aria-hidden
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ background: `var(--series-${(i % 8) + 1})` }}
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
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setOptions([...options, `Seçenek ${options.length + 1}`])}
            disabled={options.length >= 8}
            className="text-accent text-sm font-medium mb-5 text-left disabled:opacity-40"
          >
            + Ekle
          </button>
        </>
      )}

      {(slide.type === "content" || slide.type === "image") && (
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

      {slide.type === "video" && (
        <>
          <label className="block text-sm font-medium mb-1">Video URL (mp4/webm)</label>
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://…/video.mp4"
            className="input-base mb-1.5"
          />
          <p className="text-muted text-xs mb-4">
            Not: dış sunucudaki videolar bazı kurumsal ağlarda engellenebilir.
          </p>
        </>
      )}

      {/* Sayı tahmini ayarları */}
      {slide.type === "guess-number" && (
        <div className="border-t border-line pt-4 mb-4">
          <p className="eyebrow mb-3">Tahmin ayarları</p>
          <div className="flex gap-2 mb-3">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">En az</span>
              <input type="number" value={numMin} onChange={(e) => setNumMin(Number(e.target.value))} className="input-base !py-2 text-center tabular-nums" />
            </label>
            <label className="flex-1">
              <span className="block text-sm font-medium mb-1">En çok</span>
              <input type="number" value={numMax} onChange={(e) => setNumMax(Number(e.target.value))} className="input-base !py-2 text-center tabular-nums" />
            </label>
          </div>
          <label className="block mb-3">
            <span className="block text-sm font-medium mb-1">Doğru sayı</span>
            <input type="number" value={correctNumber} min={numMin} max={numMax} onChange={(e) => setCorrectNumber(Number(e.target.value))} className="input-base !py-2 text-center tabular-nums" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">Birim (opsiyonel)</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={12} placeholder="₺, kg, %…" className="input-base !py-2" />
          </label>
        </div>
      )}

      {/* 2x2 Izgara eksen etiketleri */}
      {slide.type === "grid-2x2" && (
        <div className="border-t border-line pt-4 mb-4">
          <p className="eyebrow mb-3">Eksen uçları</p>
          {([["Sol", 0], ["Sağ", 1], ["Alt", 2], ["Üst", 3]] as const).map(([lbl, i]) => (
            <label key={i} className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold w-10 shrink-0">{lbl}</span>
              <input
                value={gridLabels[i]}
                onChange={(e) =>
                  setGridLabels(gridLabels.map((g, j) => (j === i ? e.target.value : g)) as [string, string, string, string])
                }
                className="input-base flex-1 !py-2"
              />
            </label>
          ))}
        </div>
      )}

      {/* Quiz ayarları (Menti "Quiz settings") */}
      {isQuiz && (
        <div className="border-t border-line pt-4 mb-4">
          <p className="eyebrow mb-3">Quiz ayarları</p>
          <label className="flex items-center justify-between gap-3 mb-3">
            <span className="text-sm font-semibold">Cevap süresi (saniye)</span>
            <input
              type="number"
              min={5}
              max={120}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="input-base !w-24 !py-1.5 text-center tabular-nums"
            />
          </label>
          {/* Puanlama (Menti "Score allocation") */}
          <div className="mb-3">
            <span className="text-sm font-semibold block mb-1.5">Puanlama</span>
            <div className="flex gap-1 p-1 bg-paper rounded-xl border border-line">
              {([
                ["time", "⏱ Zamana göre", "Hızlı cevap daha çok puan (500–1000)"],
                ["fixed", "🎯 Sabit puan", "Her doğru 1000 puan"],
              ] as const).map(([val, lbl, hint]) => (
                <button
                  key={val}
                  onClick={() => setScoreMode(val)}
                  title={hint}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                    scoreMode === val ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <span className="text-sm font-semibold">🎵 Quiz müziği (geri sayımda)</span>
            <input
              type="checkbox"
              checked={music}
              onChange={(e) => setMusic(e.target.checked)}
              className="w-5 h-5 accent-[#2563eb]"
            />
          </label>
        </div>
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
        <label className="flex items-center justify-between gap-3 mb-4">
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

      {/* Tasarım: soru görseli (Menti "Design > Content image") */}
      {hasImage && (
        <Accordion
          title={slide.type === "pin-on-image" ? "İşaretlenecek görsel (zorunlu)" : "Görsel"}
          icon="🖼️"
          defaultOpen={slide.type === "pin-on-image" || slide.type === "image"}
        >
          {image ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Slayt görseli" className="h-20 w-auto rounded-xl border border-line" />
              <button onClick={() => setImage(undefined)} className="text-brand text-sm font-bold cursor-pointer">
                Görseli kaldır
              </button>
            </div>
          ) : (
            <button
              onClick={() => imgInput.current?.click()}
              disabled={imgBusy}
              className="btn-ghost w-full py-5 border-dashed"
            >
              {imgBusy ? "Sıkıştırılıyor…" : "+ Görsel yükle (~300KB'a sıkıştırılır)"}
            </button>
          )}
          <input
            ref={imgInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              uploadImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {imgError && <p className="text-brand text-sm font-semibold mt-2">{imgError}</p>}
        </Accordion>
      )}

      {/* Pin on Image: puanlı doğru alan (Menti "Choose correct area") */}
      {slide.type === "pin-on-image" && (
        <Accordion title="Doğru alanı seç (puanlı)" icon="🎯" defaultOpen={!!correctArea}>
          <label className="flex items-center justify-between gap-3 mb-3 cursor-pointer select-none">
            <span className="text-sm font-semibold">Doğru alan puanlaması</span>
            <input
              type="checkbox"
              checked={!!correctArea}
              onChange={(e) => setCorrectArea(e.target.checked ? [0.5, 0.5, 0.15] : undefined)}
              className="w-5 h-5 accent-[#2563eb]"
            />
          </label>
          {correctArea &&
            (image ? (
              <CorrectAreaPicker image={image} area={correctArea} onChange={setCorrectArea} />
            ) : (
              <p className="text-muted text-sm">Önce yukarıdan bir görsel yükleyin.</p>
            ))}
        </Accordion>
      )}

      {/* Diğer ayarlar (Menti "More settings") */}
      <Accordion title="Diğer ayarlar" icon="⚙️">
        <label className="block text-sm font-medium mb-1">Başlık etiketi (eyebrow)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder={SLIDE_TYPE_LABELS[slide.type]}
          className="input-base mb-4 !py-2"
        />
        {slide.type !== "content" && slide.type !== "image" && (
          <>
            <label className="block text-sm font-medium mb-1">Katılımcıya açıklama</label>
            <p className="text-muted text-xs mb-1.5">İzleyicinin telefonunda soru altında görünür.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Bağlam veya yönerge ekle…"
              className="input-base resize-none"
            />
          </>
        )}
        <label className="block text-sm font-medium mb-1 mt-4">🗒 Konuşmacı notu</label>
        <p className="text-muted text-xs mb-1.5">Yalnız sen görürsün — telefon kumandasında bu slaytın yanında çıkar.</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Burada şunu anlat…"
          className="input-base resize-none"
        />
      </Accordion>
    </div>
  );
}

/**
 * Prova paneli: seçili slaytı GERÇEK katılımcı bileşenleriyle dener —
 * kuru çalışma modunda hiçbir cevap Firestore'a yazılmaz, yerel oy
 * sayaçları kirlenmez. Quiz'lerde geri sayım provada hemen başlar.
 */
function TestPane({ slide, presentationId }: { slide: Slide; presentationId: string }) {
  const [runId, setRunId] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setResponseDryRun(true);
    return () => setResponseDryRun(false);
  }, []);
  useEffect(() => {
    setDone(false);
  }, [slide.id, runId]);

  // Quiz provası: geri sayım sunucu tetiklemesini beklemesin
  const s: Slide =
    slide.type === "quiz" || slide.type === "quiz-type"
      ? { ...slide, quizStartedAt: Timestamp.now() }
      : slide;
  const markDone = () => setDone(true);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800 font-semibold">
        🧪 Prova modu — cevaplar kaydedilmez, gerçek sonuçlara karışmaz.
      </div>
      <div key={`${slide.id}-${runId}`} className="rounded-2xl border border-line bg-white p-4">
        <h2 className="font-display text-xl font-semibold mb-1">{s.question}</h2>
        {s.settings?.description && <p className="text-muted text-sm mb-3">{s.settings.description}</p>}
        <div className="mt-3">
          {done ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2" aria-hidden>🎉</p>
              <p className="font-bold">Cevabın alındı! <span className="font-normal text-muted">(prova — kaydedilmedi)</span></p>
            </div>
          ) : s.type === "multiple-choice" ? (
            <MultipleChoiceVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "word-cloud" ? (
            <WordCloudVote presentationId={presentationId} slide={s} onDone={markDone} />
          ) : s.type === "open-ended" ? (
            <OpenEndedVote presentationId={presentationId} slide={s} onDone={markDone} />
          ) : s.type === "scales" ? (
            <ScalesVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "ranking" ? (
            <RankingVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "quiz" ? (
            <QuizVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "quiz-type" ? (
            <QuizTypeVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "pin-on-image" ? (
            <PinOnImageVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "guess-number" ? (
            <GuessNumberVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "hundred-points" ? (
            <HundredPointsVote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : s.type === "grid-2x2" ? (
            <Grid2x2Vote presentationId={presentationId} slide={s} onVoted={markDone} />
          ) : (
            <p className="text-muted text-sm">Bu slayt tipi cevap toplamaz — katılımcı yalnız içeriği görür.</p>
          )}
        </div>
      </div>
      <button onClick={() => setRunId((r) => r + 1)} className="btn-ghost !py-2.5 text-sm">
        ↻ Baştan dene
      </button>
    </div>
  );
}
