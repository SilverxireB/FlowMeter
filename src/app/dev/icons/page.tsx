"use client";

/**
 * TASARIM ARACI — ikon kontrol sayfası (hiçbir yerden linklenmez).
 * Tüm çekirdek ikonları gerçek kullanım boyutlarında, aydınlık ve koyu zeminde
 * yan yana gösterir; yeni ikon çizince ya da kalınlık ayarı değişince buradan
 * bakılır. Kaldırmak için: bu klasörü sil.
 */
import { Icon, IconName } from "@/components/Icon";

const GROUPS: { title: string; names: IconName[] }[] = [
  {
    title: "Eylem",
    names: ["plus", "pencil", "trash", "copy", "save", "download", "upload", "print", "refresh", "undo", "swap", "search", "settings", "close", "check", "link", "share"],
  },
  {
    title: "Medya / perde",
    names: ["image", "video", "film", "camera", "gallery", "play", "stop", "expand", "grid", "list", "split", "pin", "palette", "wand", "ruler", "clock", "calendar", "timer", "folder", "qr"],
  },
  {
    title: "Durum / iletişim",
    names: ["chat", "mail", "megaphone", "shield", "lock", "warning", "help", "eye", "users", "trophy", "gift", "chart", "monitor", "phone", "book", "receipt", "sparkles", "hourglass", "hand"],
  },
  {
    title: "Slayt tipleri + yön",
    names: ["cloud", "star", "listOrdered", "zap", "hash", "target", "text", "up", "down", "chevronLeft", "chevronRight", "grip", "dots"],
  },
];

const SIZES = [14, 16, 20, 28];

function Cell({ name, dark }: { name: IconName; dark: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 flex flex-col items-center gap-2 ${dark ? "bg-white/5 border border-white/10" : "bg-white border border-line"}`}>
      <div className="flex items-end gap-2.5 h-8">
        {SIZES.map((s) => (
          <Icon key={s} name={name} size={s} />
        ))}
      </div>
      <span className={`text-[10px] tabular-nums ${dark ? "text-white/45" : "text-muted"}`}>{name}</span>
    </div>
  );
}

export default function IconSheetPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">İkon kontrol sayfası</h1>
        <p className="text-muted text-sm mb-6">Her ikon 14 · 16 · 20 · 28 piksel. Üst blok aydınlık yüzey, alt blok koyu yüzey.</p>

        {GROUPS.map((g) => (
          <section key={g.title} className="mb-7">
            <p className="eyebrow mb-2">{g.title}</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {g.names.map((n) => (
                <Cell key={n} name={n} dark={false} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="bg-[#0d102f] text-white" style={{ colorScheme: "dark" }}>
        <div className="max-w-5xl mx-auto px-4 py-8">
          <p className="eyebrow !text-white/50 mb-3">Koyu yüzeyde (Sign / Wall perde / Pulse pano)</p>
          {GROUPS.map((g) => (
            <section key={g.title} className="mb-7">
              <p className="eyebrow !text-white/40 mb-2">{g.title}</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                {g.names.map((n) => (
                  <Cell key={n} name={n} dark />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
