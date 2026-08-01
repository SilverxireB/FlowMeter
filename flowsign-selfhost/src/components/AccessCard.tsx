"use client";

/**
 * FlowSign self-host — "Kimler yönetebilir" kartı (ekran editörü).
 *
 * Paketin asıl kullanımı: ekranı hazırla, ilgilisine TESLİM ET — "İK'ya bir
 * ekran kur, al bu senin olsun, bundan sonra sen yönet". Online sürümde kimlik
 * e-posta ile taşınır; burada gerçek bir KULLANICI DEFTERİ olduğu için kişi
 * listeden seçilir (yazım hatası olmaz).
 *
 * İki rol, bilerek:
 *  - SAHİP  : düzenler, yayınlar, siler, devreder, yetki dağıtır
 *  - YETKİLİ: düzenler ve yayınlar — silemez, devredemez, yetki dağıtamaz
 * İzleyici rolü YOK — yayın linki zaten herkese açık (perde giriş istemez).
 * Yönetici (BT) her ekranda sahip yetkisindedir.
 */
import { useState } from "react";
import { Icon } from "@/components/icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { addWallEditor, isWallOwner, removeWallEditor, transferWall } from "@/lib/client";
import { PublicUser, Videowall } from "@/lib/types";

const who = (u?: PublicUser | null) => (u ? u.label || u.name : "—");

export default function AccessCard({
  vw,
  me,
  users,
  onChanged,
}: {
  vw: Videowall;
  me: PublicUser | null;
  users: PublicUser[];
  onChanged: () => void;
}) {
  const owner = isWallOwner(vw, me);
  const [pick, setPick] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [keepAsEditor, setKeepAsEditor] = useState(true);
  const [confirmBox, setConfirmBox] = useState<{ title: string; message: string; confirmLabel: string; danger?: boolean; run: () => void } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = (id?: string) => users.find((u) => u.id === id) ?? null;
  const ownerUser = byId(vw.ownerId);
  const editors = (vw.editorIds ?? []).map(byId).filter(Boolean) as PublicUser[];
  // Yetkili olarak eklenebilecekler: sahip ve mevcut yetkililer hariç herkes.
  const addable = users.filter((u) => u.id !== vw.ownerId && !(vw.editorIds ?? []).includes(u.id));

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      onChanged();
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
        {!owner && <span className="chip text-xs text-muted">Yetkili</span>}
      </div>

      {/* Sahip */}
      <div className="flex items-center gap-2.5 rounded-xl bg-paper border border-line px-3 py-2.5 mb-2">
        <span className="w-8 h-8 rounded-full bg-accent-soft text-accent grid place-items-center shrink-0">
          <Icon name="shield" size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{ownerUser ? who(ownerUser) : "Yönetici (sahipsiz ekran)"}</p>
          <p className="text-muted text-xs">Sahip · düzenler, yayınlar, siler, devreder</p>
        </div>
        {ownerUser && me && ownerUser.id === me.id && <span className="chip !py-0.5 text-[11px] text-muted shrink-0">sen</span>}
      </div>

      {/* Yetkililer */}
      {editors.length > 0 && (
        <ul className="flex flex-col gap-2 mb-2">
          {editors.map((u) => (
            <li key={u.id} className="flex items-center gap-2.5 rounded-xl bg-paper border border-line px-3 py-2.5">
              <span className="w-8 h-8 rounded-full bg-line text-muted grid place-items-center shrink-0">
                <Icon name="pencil" size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{who(u)}</p>
                <p className="text-muted text-xs">Yetkili · düzenler ve yayınlar</p>
              </div>
              {me && u.id === me.id && <span className="chip !py-0.5 text-[11px] text-muted shrink-0">sen</span>}
              {owner && (
                <button
                  onClick={() =>
                    setConfirmBox({
                      title: "Yetkiyi geri al",
                      message: `${who(u)} artık bu ekranı düzenleyemeyecek. Yayındaki içerik değişmez.`,
                      confirmLabel: "Geri al",
                      danger: true,
                      run: () => run(() => removeWallEditor(vw.id, u.id)),
                    })
                  }
                  className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50"
                  title="Yetkiyi geri al"
                  aria-label={`${who(u)} yetkisini geri al`}
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
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="input-base !py-2.5 flex-1"
              aria-label="Yetkili verilecek kişi"
              disabled={addable.length === 0}
            >
              <option value="">{addable.length ? "Kişi seç…" : "Eklenecek başka kullanıcı yok"}</option>
              {addable.map((u) => (
                <option key={u.id} value={u.id}>
                  {who(u)} ({u.name})
                </option>
              ))}
            </select>
            <button
              onClick={() => pick && run(async () => { await addWallEditor(vw.id, pick); setPick(""); })}
              disabled={busy || !pick}
              className="btn-primary !py-2.5 text-sm shrink-0"
            >
              Yetkili ekle
            </button>
          </div>
          <p className="text-muted text-xs mt-2 leading-relaxed">
            Yetkili bu ekranın içeriğini düzenleyip yayınlayabilir; silemez, devredemez, başkasına yetki veremez.
            Hesap açmak için <b>Kullanıcılar</b> sayfasına git.
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
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="input-base !py-2.5"
                  aria-label="Yeni sahip"
                >
                  <option value="">Yeni sahibi seç…</option>
                  {users
                    .filter((u) => u.id !== vw.ownerId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {who(u)} ({u.name})
                      </option>
                    ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" checked={keepAsEditor} onChange={(e) => setKeepAsEditor(e.target.checked)} />
                  Eski sahip yetkili olarak kalsın (devir teslim için)
                </label>
                <div className="flex gap-2">
                  <button
                    disabled={busy || !transferTo}
                    onClick={() =>
                      setConfirmBox({
                        title: "Ekranı devret",
                        message: `"${vw.name}" ekranının sahibi ${who(byId(transferTo))} olacak.${
                          keepAsEditor ? "\nEski sahip yetkili olarak kalır." : "\nEski sahibin bu ekrana erişimi kalkar."
                        }`,
                        confirmLabel: "Devret",
                        danger: !keepAsEditor,
                        run: () =>
                          run(async () => {
                            await transferWall(vw.id, transferTo, keepAsEditor);
                            setTransferOpen(false);
                            setTransferTo("");
                          }),
                      })
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

      {confirmBox && (
        <ConfirmDialog
          title={confirmBox.title}
          message={confirmBox.message}
          confirmLabel={confirmBox.confirmLabel}
          danger={confirmBox.danger}
          onConfirm={() => {
            confirmBox.run();
            setConfirmBox(null);
          }}
          onCancel={() => setConfirmBox(null)}
        />
      )}
    </div>
  );
}
