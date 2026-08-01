"use client";

/**
 * FlowSign — "Kimler yönetebilir" kartı (ekran editörü).
 *
 * Neden var: ekranı hazırlayıp BİR BAŞKASINA teslim etmek FlowSign'ın asıl
 * kullanımı ("İK'ya bir ekran kur, al bu senin olsun, bundan sonra sen yönet").
 * Yetki e-posta üzerinden verilir — karşı tarafın uid'sini bilmeye ve kullanıcı
 * dizinini okumaya gerek yok; kişi hiç giriş yapmamış olsa bile davet edilir.
 *
 * İki rol var, bilerek:
 *  - SAHİP: her şey (düzenle, yayınla, sil, devret, yetki dağıt)
 *  - YETKİLİ: düzenler ve yayınlar; silemez, devredemez, yetki dağıtamaz
 * İzleyici rolü YOK — yayın linki zaten herkese açık (perde auth istemez).
 */
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  addSignEditor,
  isEmailLike,
  isSignOwner,
  normEmail,
  removeSignEditor,
  transferSignOwnership,
} from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function AccessCard({
  vw,
  user,
}: {
  vw: Videowall;
  user: { uid: string; email?: string | null; displayName?: string | null };
}) {
  const owner = isSignOwner(vw, user);
  const { confirm, dialog } = useConfirm();
  const [email, setEmail] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [keepAsEditor, setKeepAsEditor] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const me = normEmail(user.email);
  const ownerMail = normEmail(vw.ownerEmail);
  const editors = (vw.editorEmails ?? []).map(normEmail).filter(Boolean);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem tamamlanamadı, tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="eyebrow">Kimler yönetebilir</p>
        {!owner && (
          <span className="chip text-xs text-muted">
            <Icon name="eye" size={13} /> Yetkili
          </span>
        )}
      </div>

      {/* Sahip */}
      <div className="flex items-center gap-2.5 rounded-xl bg-paper border border-line px-3 py-2.5 mb-2">
        <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-dark grid place-items-center shrink-0">
          <Icon name="shield" size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{ownerMail || vw.ownerName || "—"}</p>
          <p className="text-muted text-xs">Sahip · düzenler, yayınlar, siler, devreder</p>
        </div>
        {ownerMail && ownerMail === me && <span className="chip !py-0.5 text-[11px] text-muted shrink-0">sen</span>}
      </div>

      {/* Yetkililer */}
      {editors.length > 0 && (
        <ul className="flex flex-col gap-2 mb-2">
          {editors.map((e) => (
            <li key={e} className="flex items-center gap-2.5 rounded-xl bg-paper border border-line px-3 py-2.5">
              <span className="w-8 h-8 rounded-full bg-line text-muted grid place-items-center shrink-0">
                <Icon name="pencil" size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{e}</p>
                <p className="text-muted text-xs">Yetkili · düzenler ve yayınlar</p>
              </div>
              {e === me && <span className="chip !py-0.5 text-[11px] text-muted shrink-0">sen</span>}
              {owner && (
                <button
                  onClick={() =>
                    confirm(
                      {
                        title: "Yetkiyi geri al",
                        message: `${e} artık bu ekranı düzenleyemeyecek. Yayındaki içerik değişmez.`,
                        confirmLabel: "Geri al",
                        danger: true,
                      },
                      () => run(() => removeSignEditor(vw, e))
                    )
                  }
                  className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50"
                  title="Yetkiyi geri al"
                  aria-label={`${e} yetkisini geri al`}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {owner ? (
        <>
          {/* Yetkili ekle */}
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (busy || !email.trim()) return;
              run(async () => {
                await addSignEditor(vw, email);
                setEmail("");
              });
            }}
            className="flex flex-col sm:flex-row gap-2 mt-3"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@sirket.com"
              className="input-base !py-2.5 flex-1"
              aria-label="Yetkili e-postası"
            />
            <button type="submit" disabled={busy || !isEmailLike(normEmail(email))} className="btn-primary !py-2.5 text-sm shrink-0">
              <Icon name="plus" size={15} /> Yetkili ekle
            </button>
          </form>
          <p className="text-muted text-xs mt-2 leading-relaxed">
            Yetkili, bu ekranın içeriğini düzenleyip yayınlayabilir; silemez, devredemez, başkasına yetki veremez.
            Kişi Flow Studio&apos;ya <b>aynı e-posta ile Google girişi</b> yaptığında ekranı listesinde görür.
          </p>

          {/* Devret */}
          <div className="mt-4 pt-4 border-t border-line">
            {!transferOpen ? (
              <button onClick={() => setTransferOpen(true)} className="btn-ghost !py-2 text-sm">
                <Icon name="refresh" size={15} /> Ekranı devret
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold">Ekranı devret</p>
                <p className="text-muted text-xs leading-relaxed">
                  Sahiplik karşı tarafa geçer: silme, devretme ve yetki dağıtma onun olur. Yayın linki ve QR
                  <b> değişmez</b> — sahadaki ekranlar kararmaz.
                </p>
                <input
                  type="email"
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  placeholder="yeni.sahip@sirket.com"
                  className="input-base !py-2.5"
                  aria-label="Yeni sahip e-postası"
                />
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={keepAsEditor} onChange={(e) => setKeepAsEditor(e.target.checked)} />
                  Ben yetkili olarak kalayım (devir teslim için)
                </label>
                <div className="flex gap-2">
                  <button
                    disabled={busy || !isEmailLike(normEmail(transferTo))}
                    onClick={() =>
                      confirm(
                        {
                          title: "Ekranı devret",
                          message: `"${vw.name}" ekranının sahibi ${normEmail(transferTo)} olacak.${
                            keepAsEditor ? "\nSen yetkili olarak kalırsın; yeni sahip istediğinde çıkarabilir." : "\nBu ekrana erişimin tamamen kalkar."
                          }`,
                          confirmLabel: "Devret",
                          danger: !keepAsEditor,
                        },
                        () =>
                          run(async () => {
                            await transferSignOwnership(vw, transferTo, { keepAsEditor, previousOwnerEmail: me });
                            setTransferOpen(false);
                            setTransferTo("");
                          })
                      )
                    }
                    className="btn-primary !py-2 text-sm"
                  >
                    Devret
                  </button>
                  <button onClick={() => setTransferOpen(false)} className="btn-ghost !py-2 text-sm">
                    Vazgeç
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-muted text-xs mt-3 leading-relaxed">
          Bu ekranı düzenleyip yayınlayabilirsin. Silmek, devretmek ve yetki vermek sahibindedir.
        </p>
      )}

      {err && <p className="text-brand text-xs font-semibold mt-3">{err}</p>}
      {dialog}
    </div>
  );
}
