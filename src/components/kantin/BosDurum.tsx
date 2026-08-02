"use client";

/** Boş liste yüzeyi — "hiçbir şey yok" ile "yükleniyor" ayrı görünsün diye. */
import { Icon, IconName } from "@/components/Icon";

export default function BosDurum({
  ikon = "list",
  baslik,
  metin,
  aksiyon,
}: {
  ikon?: IconName;
  baslik: string;
  metin?: string;
  aksiyon?: React.ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <span className="w-12 h-12 rounded-2xl bg-paper grid place-items-center mx-auto mb-3 text-muted">
        <Icon name={ikon} size={22} />
      </span>
      <p className="font-semibold">{baslik}</p>
      {metin && <p className="text-muted text-sm mt-1">{metin}</p>}
      {aksiyon && <div className="mt-4">{aksiyon}</div>}
    </div>
  );
}
