"use client";

/**
 * Flow Studio ÇEKİRDEK rehber çekmecesi — "?" ile açılan yardım.
 *
 * NEDEN SAYFA DEĞİL ÇEKMECE (kullanıcı kararı): yardım aranan an, iş yapılan
 * andır. Ayrı sayfaya gitmek editörden çıkmak demek; dönünce nerede kaldığını
 * yeniden bulman gerekir. Çekmece açılır, adımı yanındaki gerçek ekranda
 * uygularsın, kapatırsın.
 *
 * NEDEN EKRAN GÖRÜNTÜSÜ YOK: rehber içeriği CANLI bileşenlerle ve ürünün kendi
 * sınıflarıyla yazılır (`btn-primary`, `card`, `Icon`…). Tasarım değişince
 * rehberdeki görüntü de kendiliğinden değişir — eskimiş ekran görüntüsü diye
 * bir şey olmaz. Yalnız BİZİM OLMAYAN yüzeyler (Windows güç ayarı, ekran kartı
 * paneli) gerçek ekran görüntüsü ister; onlar zaten biz tasarım değiştirince
 * değişmiyor.
 *
 * Derin link: `bolum` verilirse çekmece o başlıkta açılır. Hata şeritleri bunu
 * kullanır — "bu alan bölünemez" uyarısı doğrudan "Yerleşim" başlığını açar.
 */
import { ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export interface RehberBolum {
  id: string;
  /** Üstteki küçük etiket ("KURULUM") — bölümün ne tür bilgi olduğunu söyler. */
  kicker: string;
  baslik: string;
  icerik: ReactNode;
}

export default function Rehber({
  baslik,
  altBaslik,
  bolumler,
  bolum,
  onClose,
}: {
  baslik: string;
  altBaslik?: string;
  bolumler: RehberBolum[];
  /** Açılışta kaydırılacak bölüm kimliği (derin link); yoksa baştan başlar. */
  bolum?: string | null;
  onClose: () => void;
}) {
  const govde = useRef<HTMLDivElement>(null);
  const [aktif, setAktif] = useState(bolum ?? bolumler[0]?.id ?? "");

  // ESC ile kapat + arka planı kilitle (çekmece kayarken sayfa kaymasın).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = eski;
    };
  }, [onClose]);

  // Derin link: istenen bölüme kaydır (çekmece açılış animasyonu bitince).
  useEffect(() => {
    if (!bolum) return;
    const t = window.setTimeout(() => {
      govde.current?.querySelector(`#rehber-${bolum}`)?.scrollIntoView({ block: "start" });
      setAktif(bolum);
    }, 60);
    return () => window.clearTimeout(t);
  }, [bolum]);

  // Okunan bölüm çip şeridinde işaretli kalsın (uzun metinde nerede olduğunu bil).
  useEffect(() => {
    const kok = govde.current;
    if (!kok) return;
    const göz = new IntersectionObserver(
      (girisler) => {
        const gorunen = girisler.filter((g) => g.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (gorunen) setAktif(gorunen.target.id.replace("rehber-", ""));
      },
      { root: kok, rootMargin: "0px 0px -70% 0px" }
    );
    kok.querySelectorAll("section[id^='rehber-']").forEach((s) => göz.observe(s));
    return () => göz.disconnect();
  }, [bolumler]);

  const git = (id: string) => {
    govde.current?.querySelector(`#rehber-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setAktif(id);
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label={baslik}>
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Rehberi kapat" tabIndex={-1} />

      <div className="relative w-full sm:max-w-xl bg-white h-full flex flex-col shadow-2xl animate-slide-in">
        {/* Başlık */}
        <div className="shrink-0 flex items-start gap-3 px-5 pt-5 pb-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-lg leading-tight">{baslik}</p>
            {altBaslik && <p className="text-muted text-sm mt-0.5">{altBaslik}</p>}
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Rehberi kapat">
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Bölüm şeridi */}
        <div className="shrink-0 flex gap-1.5 overflow-x-auto px-5 py-2.5 border-b border-line">
          {bolumler.map((b) => (
            <button
              key={b.id}
              onClick={() => git(b.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                aktif === b.id ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted hover:text-ink"
              }`}
            >
              {b.baslik}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div ref={govde} className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 flex flex-col gap-12">
          {bolumler.map((b) => (
            <section key={b.id} id={`rehber-${b.id}`} className="scroll-mt-2">
              <p className="eyebrow text-accent-dark mb-1.5">{b.kicker}</p>
              <h2 className="font-display text-xl font-semibold tracking-tight mb-3 text-balance">{b.baslik}</h2>
              <div className="flex flex-col gap-3 text-[15px] leading-relaxed">{b.icerik}</div>
            </section>
          ))}
          <p className="text-muted text-xs pb-4">Bir şey eksikse söyle — rehber ürünle birlikte güncelleniyor.</p>
        </div>
      </div>
    </div>
  );
}
