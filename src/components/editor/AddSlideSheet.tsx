"use client";

import Sheet from "@/components/editor/Sheet";
import { Icon } from "@/components/Icon";
import { SLIDE_TYPE_ICON_NAMES } from "@/lib/slideTypeIcons";
import {
  CONTENT_SLIDE_TYPES,
  INTERACTIVE_SLIDE_TYPES,
  SLIDE_TYPE_LABELS,
  SlideType,
} from "@/lib/types";

/** Slayt ekleme galerisi — Menti'deki kategorili tip seçici. */
export default function AddSlideSheet({
  onPick,
  onClose,
}: {
  onPick: (type: SlideType) => void;
  onClose: () => void;
}) {
  function Group({ title, types }: { title: string; types: SlideType[] }) {
    return (
      <div className="mb-7">
        <p className="eyebrow mb-3">{title}</p>
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="flex items-center gap-2.5 border border-line hover:border-accent hover:bg-accent-soft/40 rounded-2xl px-3.5 py-3 text-sm font-semibold text-left transition-colors cursor-pointer"
            >
              <Icon name={SLIDE_TYPE_ICON_NAMES[t]} size={20} className="text-accent" />
              <span className="truncate">{SLIDE_TYPE_LABELS[t]}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Sheet title="Slayt ekle" onClose={onClose}>
      <Group title="Etkileşimli sorular" types={INTERACTIVE_SLIDE_TYPES} />
      <Group title="İçerik slaytları" types={CONTENT_SLIDE_TYPES} />
    </Sheet>
  );
}
