"use client";

import { PresentationTheme, themeStyle } from "@/lib/themes";
import { Icon } from "@/components/Icon";
import { SLIDE_TYPE_ICON_NAMES } from "@/lib/slideTypeIcons";
import { Slide, SLIDE_TYPE_LABELS } from "@/lib/types";

/**
 * Editördeki canlı slayt önizlemesi (Menti mobil editöründeki büyük kart).
 * Cevap verisi olmadan, temayla birlikte slaytın sahnede nasıl duracağını
 * gösterir. mini=true film şeridi küçük karesi için sadeleşir.
 */
export default function SlidePreview({
  slide,
  theme,
  mini = false,
  bare = false,
  fill = false,
}: {
  slide: Slide;
  theme?: PresentationTheme;
  mini?: boolean;
  /** Kart içine gömmek için: kendi kenarlığını/köşesini/filigranını kaldırır. */
  bare?: boolean;
  /** Kabını TAM doldur (16:9 dayatma yok) — liste kartında altta boşluk kalmasın. */
  fill?: boolean;
}) {
  const { style, dark } = themeStyle(theme);
  const text = dark ? "text-white" : "text-ink";
  const soft = dark ? "text-white/60" : "text-muted";

  return (
    <div
      className={`overflow-hidden ${fill ? "absolute inset-0 w-full h-full" : "relative w-full aspect-video"} ${
        mini ? "rounded-lg" : bare ? "" : "rounded-2xl border border-line shadow-sm"
      }`}
      style={style}
    >
      {!mini && !bare && (
        <span className={`absolute top-2 right-3 text-[10px] font-bold ${soft}`}>FlowMeter</span>
      )}
      <div className={`absolute inset-0 flex flex-col ${mini ? "p-2" : "p-5 md:p-7"}`}>
        {!mini && (
          <p className={`eyebrow ${dark ? "!text-white/50" : ""} !text-[9px] mb-1`}>
            {slide.settings?.label?.trim() || (
              <span className="inline-flex items-center gap-1 align-middle">
                <Icon name={SLIDE_TYPE_ICON_NAMES[slide.type]} size={11} /> {SLIDE_TYPE_LABELS[slide.type]}
              </span>
            )}
          </p>
        )}
        <p
          className={`font-display font-semibold tracking-tight truncate ${text} ${
            mini ? "text-[9px]" : "text-base md:text-xl"
          }`}
        >
          {slide.question}
        </p>

        <div className="flex-1 flex items-end min-h-0 mt-1">
          <PreviewBody slide={slide} mini={mini} dark={dark} />
        </div>
      </div>
    </div>
  );
}

function PreviewBody({ slide, mini, dark }: { slide: Slide; mini: boolean; dark: boolean }) {
  const soft = dark ? "text-white/60" : "text-muted";
  const text = dark ? "text-white" : "text-ink";
  const options = slide.options.length ? slide.options : [];

  switch (slide.type) {
    case "multiple-choice":
    case "quiz":
    case "ranking":
    case "hundred-points":
      // Menti editör önizlemesi: sıfır barlar — renkli alt çizgi + etiket
      return (
        <div className="w-full flex gap-2 md:gap-4 items-end">
          {options.slice(0, mini ? 3 : 6).map((o, i) => (
            <div key={i} className="flex-1 min-w-0">
              {!mini && <p className={`text-[10px] tabular-nums mb-0.5 ${soft}`}>0</p>}
              <div
                className="h-[3px] rounded-full"
                style={{ background: `var(--series-${(i % 8) + 1})` }}
              />
              {!mini && <p className={`text-[10px] truncate mt-0.5 ${soft}`}>{o}</p>}
            </div>
          ))}
        </div>
      );
    case "guess-number":
      return (
        <div className={`w-full text-center font-display font-semibold ${text} ${mini ? "text-sm" : "text-4xl"}`}>
          {slide.settings?.correctNumber ?? "?"}
          {slide.settings?.unit ? <span className={`${soft} ${mini ? "text-[8px]" : "text-base"} ml-1`}>{slide.settings.unit}</span> : null}
        </div>
      );
    case "grid-2x2": {
      const [gl, gr, gb, gt] = slide.settings?.gridLabels ?? ["", "", "", ""];
      return (
        <div className="w-full flex flex-col items-center">
          {!mini && <span className={`text-[9px] ${soft} truncate max-w-full`}>{gt}</span>}
          <div className="flex items-center gap-1 w-full justify-center">
            {!mini && <span className={`text-[9px] ${soft} truncate max-w-[3rem]`}>{gl}</span>}
            <div className={`relative ${mini ? "w-8 h-8" : "w-24 h-24"} rounded border ${dark ? "border-white/25" : "border-ink/15"}`}>
              <span className="absolute left-1/2 inset-y-0 w-px" style={{ background: dark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.12)" }} aria-hidden />
              <span className="absolute top-1/2 inset-x-0 h-px" style={{ background: dark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.12)" }} aria-hidden />
            </div>
            {!mini && <span className={`text-[9px] ${soft} truncate max-w-[3rem]`}>{gr}</span>}
          </div>
          {!mini && <span className={`text-[9px] ${soft} truncate max-w-full`}>{gb}</span>}
        </div>
      );
    }
    case "word-cloud": {
      const words = ["fikir", "hızlı", "yaratıcı", "odak", "lider", "ilham"];
      return (
        <div className={`w-full text-center ${mini ? "text-[7px]" : "text-xs md:text-sm"} leading-tight`}>
          {words.slice(0, mini ? 3 : 6).map((w, i) => (
            <span
              key={w}
              className="inline-block mx-1 font-display font-semibold"
              style={{
                color: `var(--series-${(i % 8) + 1})`,
                fontSize: `${(mini ? 0.5 : 1) * (1.4 - i * 0.15)}em`,
              }}
            >
              {w}
            </span>
          ))}
        </div>
      );
    }
    case "open-ended":
    case "qna":
      return (
        <div className="w-full flex gap-1.5">
          {Array.from({ length: mini ? 1 : 3 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-lg ${dark ? "bg-white/15" : "bg-ink/5"} ${mini ? "h-3" : "h-8"}`}
            />
          ))}
        </div>
      );
    case "scales":
      return (
        <div className="w-full flex flex-col gap-1">
          {options.slice(0, mini ? 2 : 4).map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`flex-1 h-[3px] rounded-full ${dark ? "bg-white/20" : "bg-ink/10"}`} />
              <span
                className={`rounded-full ${mini ? "w-1.5 h-1.5" : "w-2.5 h-2.5"}`}
                style={{ background: `var(--series-${(i % 8) + 1})` }}
              />
            </div>
          ))}
        </div>
      );
    case "quiz-type":
      return (
        <div
          className={`w-full rounded-lg border-2 border-dashed ${
            dark ? "border-white/30 text-white/50" : "border-ink/15 text-muted"
          } ${mini ? "h-3" : "h-9 px-2 flex items-center text-xs"}`}
        >
          {!mini && "Cevabını yaz…"}
        </div>
      );
    case "pin-on-image":
    case "image":
      return slide.settings?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.settings.image}
          alt=""
          className="w-full h-full object-contain rounded-md"
        />
      ) : (
        <div
          className={`w-full h-full rounded-md flex items-center justify-center ${
            dark ? "bg-white/10" : "bg-ink/5"
          } ${mini ? "text-xs" : "text-3xl"}`}
          aria-hidden
        >
          {slide.type === "pin-on-image" ? "📍" : "🖼️"}
        </div>
      );
    case "video":
      return (
        <div
          className={`w-full h-full rounded-md flex items-center justify-center bg-black/70 text-white ${
            mini ? "text-xs" : "text-3xl"
          }`}
          aria-hidden
        >
          ▶
        </div>
      );
    case "instructions":
      return (
        <ol className={`w-full flex flex-col ${mini ? "gap-0.5" : "gap-1"}`}>
          {options.slice(0, mini ? 2 : 4).map((s, i) => (
            <li key={i} className={`flex items-center gap-1 ${mini ? "text-[7px]" : "text-[11px]"} ${soft}`}>
              <span
                className="rounded-full text-white font-bold inline-flex items-center justify-center shrink-0"
                style={{
                  background: `var(--series-${(i % 8) + 1})`,
                  width: mini ? 8 : 14,
                  height: mini ? 8 : 14,
                  fontSize: mini ? 5 : 8,
                }}
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="truncate">{s}</span>
            </li>
          ))}
        </ol>
      );
    case "leaderboard":
      return (
        <div className="w-full flex items-end justify-center gap-1.5" aria-hidden>
          {[0.55, 1, 0.4].map((h, i) => (
            <div
              key={i}
              className="rounded-t-md"
              style={{
                width: mini ? 10 : 28,
                height: (mini ? 16 : 52) * h,
                background: ["#94a3b8", "#f59e0b", "#ea580c"][i],
              }}
            />
          ))}
        </div>
      );
    case "content":
    default:
      return (
        <p className={`${soft} ${mini ? "text-[7px]" : "text-xs"} line-clamp-3 w-full`}>
          {slide.settings?.description || " "}
        </p>
      );
  }
}
