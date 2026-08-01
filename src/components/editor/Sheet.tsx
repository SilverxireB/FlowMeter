"use client";

/**
 * Ortak panel kabuğu: mobilde alttan açılan sayfa (bottom sheet, Menti gibi),
 * geniş ekranda sağdan açılan çekmece.
 */
import { Icon } from "@/components/Icon";

export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-ink/30"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md max-h-[85vh] sm:max-h-none sm:h-full rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line shrink-0">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="btn-ghost !px-3 !py-1.5 text-sm">
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex-1">{children}</div>
      </div>
    </div>
  );
}
