"use client";

/**
 * FOTO SAHNE yönetimi — Wall manage'ın SADELEŞMİŞ hâli (kullanıcı kararı:
 * "wall mantığındaki sayfa gibi"). QR yok, çekiliş yok, moderasyon yok,
 * anons yok. Taslak/yayın katmanı da yok: her değişiklik linke ANINDA düşer.
 *
 * Akış: mod + efekt seç → fotoğrafları yükle → istersen foto başına yazı
 * ("Ahmet Bey'e teşekkürler") → linki bir ekranda alana URL olarak ekle.
 * Bu sayfanın linkini fotoğrafları yönetecek kişiye verebilirsin — o kişi
 * ekranın yerleşimine/yayınına dokunamaz, yalnız sahneyi besler.
 */
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import FlowSpinner from "@/components/FlowSpinner";
import FotoSahne from "@/components/videowall/FotoSahne";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAuthUser } from "@/lib/hooks";
import { loginYolu } from "@/lib/girisYolu";
import { isCloudinaryConfigured, uploadToCloudinary, cldThumb } from "@/lib/cloudinary";
import { addSahneFoto, deleteSahne, removeSahneFoto, updateSahne, watchSahne } from "@/lib/sahneler";
import { FotoSahneKaydi, SAHNE_EFEKTLERI, SAHNE_MODLARI, SahneFoto } from "@/lib/fotoSahne";

const MAX_IMAGE_MB = 10;

export default function SahneManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [sahne, setSahne] = useState<FotoSahneKaydi | null | undefined>(undefined);
  const [queue, setQueue] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [silOnay, setSilOnay] = useState<SahneFoto | null>(null);
  const [sahneSilOnay, setSahneSilOnay] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cloudReady = isCloudinaryConfigured();

  useEffect(() => {
    if (!loading && !user) router.replace(loginYolu());
  }, [loading, user, router]);

  useEffect(() => watchSahne(decodeURIComponent(id), setSahne), [id]);

  // Kalıcı kayıt onSnapshot ile taze — yerel state tutulmaz, iki sekme çakışmaz.
  const link = typeof window !== "undefined" ? `${window.location.origin}/sahne/${id}` : `/sahne/${id}`;

  async function yukle(files: File[]) {
    if (!sahne) return;
    setErr(null);
    if (!cloudReady) {
      setErr("Medya deposu yapılandırılmadı — fotoğraf yüklenemez.");
      return;
    }
    const ok = files.filter((f) => f.type.startsWith("image/") && f.size / (1024 * 1024) <= MAX_IMAGE_MB);
    const failed = files
      .filter((f) => !ok.includes(f))
      .map((f) => `${f.name} (${f.type.startsWith("image/") ? `sınır ~${MAX_IMAGE_MB} MB` : "yalnız fotoğraf"})`);
    let n = 0;
    for (let i = 0; i < ok.length; i++) {
      try {
        setQueue({ done: i, total: ok.length, pct: 0 });
        const res = await uploadToCloudinary(ok[i], `flowsign/sahne/${sahne.id}`, (pct) => setQueue({ done: i, total: ok.length, pct }), { keepOriginal: true });
        await addSahneFoto(sahne.id, { src: res.url, cloudinaryId: res.cloudinaryId, at: Date.now() });
        n++;
      } catch (e) {
        failed.push(`${ok[i].name} (${e instanceof Error ? e.message : "yükleme hatası"})`);
      }
    }
    setQueue(null);
    if (failed.length) setErr(`${n}/${n + failed.length} fotoğraf yüklendi. Yüklenemeyenler: ${failed.join(" · ")}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function yaziYaz(src: string, yazi: string) {
    if (!sahne) return;
    const fotolar = (sahne.fotolar ?? []).map((f) => (f.src === src ? { ...f, yazi: yazi.trim() || undefined } : f));
    await updateSahne(sahne.id, { fotolar }).catch(() => setErr("Yazı kaydedilemedi."));
  }

  if (loading || sahne === undefined)
    return <main className="min-h-screen bg-wash grid place-items-center text-muted text-sm">Yükleniyor…</main>;
  if (sahne === null)
    return (
      <main className="min-h-screen bg-wash grid place-items-center text-muted text-sm text-center px-6">
        Sahne bulunamadı — silinmiş olabilir.
      </main>
    );

  return (
    <main className="min-h-screen bg-wash">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Başlık: ← geldiği yere (editörden açılır) */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/videowall"))}
            className="w-10 h-10 grid place-items-center rounded-xl border border-line bg-white text-muted hover:text-ink hover:border-muted text-lg"
            aria-label="Geri"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">Foto sahne</p>
            <input
              defaultValue={sahne.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== sahne.name) void updateSahne(sahne.id, { name: v });
                else e.target.value = sahne.name;
              }}
              className="font-display font-bold text-xl bg-transparent border-b border-transparent hover:border-line focus:border-accent focus:outline-none w-full max-w-md"
              aria-label="Sahne adı"
            />
          </div>
          <button
            onClick={() => setSahneSilOnay(true)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted hover:text-brand hover:border-brand/40 inline-flex items-center gap-1.5"
          >
            <Icon name="trash" size={13} /> Sahneyi sil
          </button>
        </div>

        {/* LİNK — sahnenin kimliği: ekranda bir alana URL olarak eklenir. */}
        <div className="rounded-2xl border border-line bg-white p-4 mb-4 flex flex-wrap items-center gap-3">
          <code className="text-xs bg-paper rounded-lg px-3 py-2 flex-1 min-w-[220px] truncate">{link}</code>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => {
                setKopyalandi(true);
                window.setTimeout(() => setKopyalandi(false), 1600);
              });
            }}
            className="btn-primary !py-2 !px-4 text-xs"
          >
            {kopyalandi ? "✓ Kopyalandı" : "Linki kopyala"}
          </button>
          <p className="text-muted text-xs basis-full">
            Bu linki ekranında bir alana <b>URL</b> olarak ekle — perde sahneyi tanır ve akıcı çizer. Tek başına
            açarsan tam ekran sahne olur. Değişiklikler linke <b>anında</b> düşer.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* SOL: mod + efekt + önizleme */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Sahne modu</p>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {SAHNE_MODLARI.map((m) => (
                <button
                  key={m.id}
                  onClick={() => void updateSahne(sahne.id, { mod: m.id })}
                  title={m.ipucu}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    (sahne.mod ?? "mozaik") === m.id ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"
                  }`}
                >
                  {m.ad}
                </button>
              ))}
            </div>
            <p className="text-muted text-[11px] mb-4">{SAHNE_MODLARI.find((m) => m.id === (sahne.mod ?? "mozaik"))?.ipucu}</p>

            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Efekt</p>
            {/* Emoji BİLİNÇLİ: efekt seçicisi efektin kendisini gösterir (Wall ile aynı dil). */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {SAHNE_EFEKTLERI.map((e) => (
                <button
                  key={e.id}
                  onClick={() => void updateSahne(sahne.id, { efekt: e.id })}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-semibold border ${
                    (sahne.efekt ?? "none") === e.id ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"
                  }`}
                >
                  {e.ikon} {e.ad}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Canlı önizleme</p>
            <div className="relative aspect-video rounded-xl overflow-hidden border border-line [color-scheme:dark]" style={{ containerType: "size" }}>
              <FotoSahne sahne={sahne} box={{ w: 640, h: 360 }} />
            </div>
          </div>

          {/* SAĞ: fotoğraflar */}
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
              Fotoğraflar ({(sahne.fotolar ?? []).length}) — sıra: yükleme sırası
            </p>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void yukle(Array.from(e.target.files))} />
            {queue ? (
              <div className="w-full mb-3 rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/30 px-3 py-4 flex items-center justify-center gap-3">
                <FlowSpinner size={44} center={<span className="text-[10px] font-bold tabular-nums text-ink">%{queue.pct}</span>} />
                <p className="text-sm font-semibold text-ink">
                  Yükleniyor… <span className="text-muted text-xs tabular-nums font-normal">Fotoğraf {queue.done + 1}/{queue.total}</span>
                </p>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={!cloudReady}
                title={cloudReady ? undefined : "Medya deposu yapılandırılmadı"}
                className="w-full mb-3 rounded-xl border-2 border-dashed border-line hover:border-accent hover:bg-accent-soft/20 text-muted hover:text-accent px-3 py-4 flex flex-col items-center gap-1.5 transition-colors disabled:opacity-40 group"
              >
                <span className="w-10 h-10 rounded-full bg-paper group-hover:bg-accent-soft grid place-items-center transition-colors">
                  <Icon name="upload" size={17} />
                </span>
                <span className="text-sm font-semibold text-ink">Fotoğraf yükle</span>
                <span className="text-[11px]">Sahneye anında girer — birden çok seçebilirsin</span>
              </button>
            )}
            {err && <p className="text-brand text-xs mb-3 font-semibold">{err}</p>}

            {(sahne.fotolar ?? []).length === 0 ? (
              <p className="text-muted text-sm text-center py-8">Henüz fotoğraf yok — yukarıdan yüklemeyle başla.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(sahne.fotolar ?? []).map((f) => (
                  <li key={f.src} className="flex items-center gap-2.5 rounded-xl border border-line p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cldThumb(f.src, 160, 160)} alt="" className="w-14 h-14 rounded-lg object-cover bg-black shrink-0" />
                    <input
                      defaultValue={f.yazi ?? ""}
                      placeholder="Foto yazısı (ör. Ahmet Bey'e teşekkürler)"
                      onBlur={(e) => void yaziYaz(f.src, e.target.value)}
                      className="input-base !rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                      aria-label="Foto yazısı"
                    />
                    <button
                      onClick={() => setSilOnay(f)}
                      className="w-9 h-9 grid place-items-center rounded-lg border border-line text-muted hover:text-brand hover:border-brand/40 shrink-0"
                      aria-label="Fotoğrafı sahneden sil"
                      title="Sahneden sil"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {silOnay && (
        <ConfirmDialog
          title="Fotoğrafı sil"
          message="Fotoğraf sahneden çıkarılacak. Bu işlem geri alınamaz."
          confirmLabel="Sil"
          danger
          onConfirm={() => {
            const f = silOnay;
            setSilOnay(null);
            void removeSahneFoto(sahne, f.src).catch(() => setErr("Silinemedi."));
          }}
          onCancel={() => setSilOnay(null)}
        />
      )}
      {sahneSilOnay && (
        <ConfirmDialog
          title="Sahneyi sil"
          message={`"${sahne.name}" tamamen silinecek — linki kullanan tüm ekranlarda sahne kararır. Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
          onConfirm={() => {
            setSahneSilOnay(false);
            void deleteSahne(sahne.id)
              .then(() => router.push("/videowall"))
              .catch(() => setErr("Silinemedi — yalnız sahneyi oluşturan ya da yönetici silebilir."));
          }}
          onCancel={() => setSahneSilOnay(false)}
        />
      )}
    </main>
  );
}
