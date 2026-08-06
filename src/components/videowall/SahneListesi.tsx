"use client";

/**
 * FOTO SAHNELER bölümü — sahnelerin EVİ (ekran listesinin altında).
 *
 * NEDEN VAR: sahne linki alandan silinince sahneye ulaşmanın yolu kalmıyordu;
 * kayıt + fotoğraflar depoda görünmez çöp olarak yaşıyordu. Burası her sahneyi
 * listeler: kaç foto, hangi ekranlarda kullanılıyor (taslak + yayın taranır),
 * hiçbir ekranda geçmiyorsa "kullanılmıyor" rozeti (kütüphanedeki desenle aynı).
 * Silme = kayıt + depo birlikte (deleteSahne tam temizlik yapar) ve yalnız
 * sahibi/yönetici; onay penceresi kullanan ekranların ADLARIYLA uyarır.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAuthUser } from "@/lib/hooks";
import { useAdminGate } from "@/lib/useAdminGate";
import { deleteSahne, listSahneler } from "@/lib/sahneler";
import { FotoSahneKaydi, sahneAdresi } from "@/lib/fotoSahne";
import { Icon } from "@/components/Icon";
import { Videowall } from "@/lib/types";

export default function SahneListesi({ walls }: { walls: Videowall[] }) {
  const [sahneler, setSahneler] = useState<FotoSahneKaydi[] | null>(null);
  const [silOnay, setSilOnay] = useState<FotoSahneKaydi | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { user } = useAuthUser();
  const adminMi = useAdminGate();

  useEffect(() => {
    listSahneler()
      .then(setSahneler)
      .catch(() => setSahneler([]));
  }, []);

  // sahneId → kullanan ekran adları (taslak + yayın: ikisinden birinde geçen
  // sahne "kullanımda"dır — yayından çıkarılmış ama taslakta duran da öyle).
  const kullanim = useMemo(() => {
    const m = new Map<string, string[]>();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    for (const w of walls) {
      const buWall = new Set<string>();
      for (const z of [...(w.zones ?? []), ...(w.live?.zones ?? [])])
        for (const it of z.items ?? []) {
          const sid = it.kind === "url" ? sahneAdresi(it.src, origin) : null;
          if (sid) buWall.add(sid);
        }
      for (const sid of buWall) m.set(sid, [...(m.get(sid) ?? []), w.name]);
    }
    return m;
  }, [walls]);

  async function sil(s: FotoSahneKaydi) {
    setErr(null);
    setBusy(s.id);
    try {
      await deleteSahne(s.id);
      setSahneler((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    } catch {
      setErr("Silinemedi — yalnız sahneyi oluşturan ya da yönetici silebilir.");
    } finally {
      setBusy(null);
    }
  }

  // Hiç sahne yoksa bölüm hiç görünmez (liste sayfasını kalabalıklaştırmasın).
  if (!sahneler?.length) return null;

  return (
    // Ekran listesiyle AYNI kapta ve AYNI genişlikte (oluşturma kartıyla hizalı);
    // bilgi az olduğundan satırlar ikişerli dizilir.
    <section className="max-w-5xl mx-auto px-4 pb-10">
      <h2 className="font-display font-bold text-lg mb-1">📸 Foto sahneler</h2>
      <p className="text-muted text-xs mb-3">
        Kendi linki olan hatıra köşeleri — link alandan silinse de sahneye buradan ulaşılır.
      </p>
      {err && <p className="text-brand text-xs mb-2 font-semibold">{err}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {sahneler.map((s) => {
          const ekranlar = kullanim.get(s.id) ?? [];
          const silebilir = adminMi === true || (user && s.ownerId === user.uid);
          return (
            <li key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-white p-2.5 ${busy === s.id ? "opacity-50" : ""}`}>
              <span className="w-8 h-8 rounded-lg grid place-items-center text-base shrink-0" style={{ background: "#05091c" }} aria-hidden>
                📸
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{s.name}</p>
                <p className="text-muted text-[11px]">
                  {(s.fotolar ?? []).length} foto{s.ownerName ? ` · ${s.ownerName}` : ""}
                </p>
              </div>
              {ekranlar.length > 0 ? (
                <span className="text-[11px] text-muted truncate max-w-[40%]" title={ekranlar.join(", ")}>
                  {ekranlar.length} ekranda: {ekranlar.join(", ")}
                </span>
              ) : (
                <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5">Kullanılmıyor</span>
              )}
              <Link href={`/sahne/${s.id}/manage`} className="rounded-lg bg-paper border border-line px-3 py-1.5 text-xs font-semibold hover:border-muted">
                Yönet
              </Link>
              {silebilir && (
                <button
                  onClick={() => setSilOnay(s)}
                  disabled={busy !== null}
                  className="w-8 h-8 grid place-items-center rounded-lg border border-line text-muted hover:text-brand hover:border-brand/40 disabled:opacity-40"
                  aria-label={`${s.name} sahnesini sil`}
                  title="Sahneyi sil (kayıt + depodaki fotoğraflar)"
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {silOnay && (
        <ConfirmDialog
          title="Sahneyi sil"
          message={
            (kullanim.get(silOnay.id) ?? []).length
              ? `"${silOnay.name}" şu ekranlarda KULLANILIYOR: ${(kullanim.get(silOnay.id) ?? []).join(", ")}. Silersen oralarda sahne kararır; depodaki fotoğraflar da gider. Geri alınamaz.`
              : `"${silOnay.name}" ve depodaki fotoğrafları kalıcı olarak silinecek. Geri alınamaz.`
          }
          confirmLabel="Sil"
          danger
          onConfirm={() => {
            const s = silOnay;
            setSilOnay(null);
            void sil(s);
          }}
          onCancel={() => setSilOnay(null)}
        />
      )}
    </section>
  );
}
