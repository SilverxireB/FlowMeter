"use client";

/**
 * KİŞİLER — yalnız yönetici. Rol atama + geçici yasak.
 *
 * Yasak BİLEREK ölçülü: sipariş alıp gelmemek bir kere olur (toplantı uzar,
 * telefon susar). Rapor önce görülür, yaptırım sonra konur; bu yüzden ekran
 * kişinin "gelinmedi" sayısını gösterir ve süreyi yönetici seçer.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { izleKisiler, kantinHata, rolAta, yasakla, yasakli } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { KantinKisi, KantinRol } from "@/lib/kantin/types";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

const ROL_ETIKET: Record<KantinRol, string> = {
  admin: "Yönetici",
  kantinci: "Kantin görevlisi",
  personel: "Personel",
};

export default function KantinKisilerPage() {
  const { user, rol, hazir, kantinler } = useKantin();
  const router = useRouter();
  const [liste, setListe] = useState<KantinKisi[]>([]);
  const [ara, setAra] = useState("");
  const { show, toast } = useToast();
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);
  useEffect(() => {
    if (rol !== "admin") return;
    return izleKisiler(setListe, (e) => show(kantinHata(e), "error"));
  }, [rol, show]);

  if (!hazir || !user) return <Bekle />;
  if (rol !== "admin") {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-xl font-bold mb-1">Yetki yok</p>
        <p className="text-muted">Bu sayfa yalnız yöneticiye açık.</p>
      </main>
    );
  }

  const q = ara.trim().toLowerCase();
  const suzulmus = q
    ? liste.filter((k) => `${k.ad} ${k.sicil} ${k.email}`.toLowerCase().includes(q))
    : liste;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {toast}
      {dialog}
      <h1 className="font-display text-2xl font-semibold">Kişiler</h1>
      <p className="text-muted text-sm mb-4">{liste.length} kayıt</p>

      <input
        value={ara}
        onChange={(e) => setAra(e.target.value)}
        placeholder="Ad, sicil ya da e-posta ara"
        className="input-base !py-2 text-sm mb-4"
      />

      <div className="flex flex-col gap-2">
        {suzulmus.map((k) => (
          <div key={k.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-sm">
                  {k.ad} <span className="text-muted font-normal">· {k.sicil}</span>
                </p>
                <p className="text-muted text-xs truncate">{k.email}</p>
                {yasakli(k) && (
                  <p className="text-brand text-xs font-semibold mt-0.5">
                    Yasaklı — {new Date(k.yasakBitis!.toMillis()).toLocaleDateString("tr-TR")} tarihine kadar
                  </p>
                )}
              </div>
              <span className="text-xs text-muted shrink-0">{ROL_ETIKET[k.rol]}</span>
            </div>

            <div className="flex gap-2 mt-3 flex-wrap items-center">
              <select
                value={k.rol}
                onChange={(e) =>
                  void rolAta(k.id, e.target.value as KantinRol, k.kantinId)
                    .then(() => show("Rol güncellendi"))
                    .catch((x) => show(kantinHata(x), "error"))
                }
                className="input-base !py-1.5 text-xs !w-auto"
              >
                <option value="personel">Personel</option>
                <option value="kantinci">Kantin görevlisi</option>
                <option value="admin">Yönetici</option>
              </select>
              {k.rol === "kantinci" && (
                <select
                  value={k.kantinId ?? ""}
                  onChange={(e) =>
                    void rolAta(k.id, "kantinci", e.target.value)
                      .then(() => show("Kantin atandı"))
                      .catch((x) => show(kantinHata(x), "error"))
                  }
                  className="input-base !py-1.5 text-xs !w-auto"
                >
                  <option value="">Kantin seç…</option>
                  {kantinler.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ad}
                    </option>
                  ))}
                </select>
              )}
              {yasakli(k) ? (
                <button
                  onClick={() =>
                    void yasakla(k.id, 0)
                      .then(() => show("Yasak kaldırıldı"))
                      .catch((x) => show(kantinHata(x), "error"))
                  }
                  className="btn-ghost !py-1.5 !px-3 text-xs"
                >
                  Yasağı kaldır
                </button>
              ) : (
                <button
                  onClick={() =>
                    confirm(
                      {
                        title: "3 gün yasak",
                        message: `${k.ad} 3 gün sipariş veremeyecek.`,
                        confirmLabel: "Yasakla",
                        danger: true,
                      },
                      () =>
                        void yasakla(k.id, 3)
                          .then(() => show("Yasak kondu"))
                          .catch((x) => show(kantinHata(x), "error"))
                    )
                  }
                  className="btn-ghost !py-1.5 !px-3 text-xs !text-brand !border-brand/40"
                >
                  3 gün yasakla
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Bekle() {
  return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
}
