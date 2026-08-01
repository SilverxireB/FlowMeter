"use client";

/**
 * Kullanıcılar (yönetici) — hesap aç, parola sıfırla, rol değiştir, sil.
 *
 * Neden gerekli: ekranı ilgilisine teslim edebilmek için karşı tarafın KENDİ
 * hesabı olmalı. Tek ortak parolayla kim ne değiştirdi bilinmez, ayrılan
 * personelin erişimi kesilemezdi.
 *
 * Silinen kişinin ekranları YÖNETİCİYE devrolur (sunucu tarafı) — kimsenin
 * yönetemediği yetim ekran kalmaz.
 */
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/icons";
import { createUser, deleteUser, listUsers, updateUser } from "@/lib/client";
import { PublicUser } from "@/lib/types";

export default function UsersPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBox, setConfirmBox] = useState<{ title: string; message: string; confirmLabel: string; danger?: boolean; run: () => void } | null>(null);

  // Yeni hesap
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  // Parola sıfırlama (satır içi)
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  const refresh = useCallback(async () => {
    try {
      const d = await listUsers();
      setUsers(d.users);
      setMe(d.me);
    } catch {
      setErr("Kullanıcılar okunamadı — oturumun düşmüş olabilir.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const admin = me?.role === "admin";

  if (loading) return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/screens" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Ekranlara dön">←</Link>
          <span className="inline-flex items-center gap-1.5 shrink-0" role="img" aria-label="FlowSign">
            <Image src="/logo.png" alt="" width={140} height={40} className="h-7 w-auto" priority />
            <span aria-hidden className="font-display font-semibold text-[26px] leading-none tracking-[0.03em] text-[#001e64]">SIGN</span>
          </span>
        </div>
        <span className="chip text-muted text-xs min-w-0 max-w-[45vw]">
          <span className="truncate min-w-0">{me?.label || me?.name}</span>
        </span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Kullanıcılar</h1>
        <p className="text-muted text-sm mb-6">
          Her kişiye kendi hesabını aç; ekranları onlara devret ya da yetki ver. Yönetici tüm ekranları yönetir.
        </p>

        {err && <div className="mb-5 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        {!admin && (
          <div className="card p-5 mb-6">
            <p className="text-sm">
              Hesap açmak yöneticiye özeldir. Buradan yalnız <b>kendi parolanı</b> değiştirebilirsin.
            </p>
          </div>
        )}

        {admin && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              run(async () => {
                await createUser(name, pw, role, label);
                setName("");
                setLabel("");
                setPw("");
                setRole("user");
              });
            }}
            className="card p-5 mb-8 flex flex-col gap-3"
          >
            <p className="eyebrow">Yeni hesap</p>
            <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Kullanıcı adı (girişte yazılır)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ayse" className="input-base !py-2.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Görünen ad (isteğe bağlı)</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ayşe — İK" className="input-base !py-2.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Parola</span>
                <input value={pw} onChange={(e) => setPw(e.target.value)} type="text" placeholder="en az 4 karakter" className="input-base !py-2.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Rol</span>
                <select value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")} className="input-base !py-2.5">
                  <option value="user">Kullanıcı — kendi ekranları</option>
                  <option value="admin">Yönetici — tüm ekranlar + hesaplar</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={busy || !name.trim() || pw.length < 4} className="btn-primary !py-2.5 self-start text-sm">
              <Icon name="plus" size={15} /> Hesabı aç
            </button>
            <p className="text-muted text-xs">
              Parolayı kişiye kendin ilet; sistem e-posta göndermez (internetsiz iç ağda çalışır).
            </p>
          </form>
        )}

        <ul className="flex flex-col gap-2">
          {users.map((u) => {
            const isMe = me?.id === u.id;
            const canReset = admin || isMe;
            return (
              <li key={u.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${u.role === "admin" ? "bg-accent-soft text-accent" : "bg-line text-muted"}`}>
                    <Icon name={u.role === "admin" ? "shield" : "users"} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {u.label || u.name} {isMe && <span className="text-muted font-normal text-xs">(sen)</span>}
                    </p>
                    <p className="text-muted text-xs truncate">
                      {u.name} · {u.role === "admin" ? "Yönetici" : "Kullanıcı"}
                    </p>
                  </div>
                  {canReset && (
                    <button
                      onClick={() => {
                        setResetFor(resetFor === u.id ? null : u.id);
                        setResetPw("");
                      }}
                      className="shrink-0 rounded-lg bg-white border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-muted"
                    >
                      Parola
                    </button>
                  )}
                  {admin && !isMe && (
                    <>
                      <button
                        onClick={() =>
                          run(() => updateUser(u.id, { role: u.role === "admin" ? "user" : "admin" }))
                        }
                        className="shrink-0 rounded-lg bg-white border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-muted"
                        title={u.role === "admin" ? "Yöneticiliği al" : "Yönetici yap"}
                      >
                        {u.role === "admin" ? "Yöneticiliği al" : "Yönetici yap"}
                      </button>
                      <button
                        onClick={() =>
                          setConfirmBox({
                            title: "Hesabı sil",
                            message: `${u.label || u.name} hesabı silinecek. Bu kişinin sahibi olduğu ekranlar YÖNETİCİYE devrolur (ekran silinmez).`,
                            confirmLabel: "Sil",
                            danger: true,
                            run: () => run(() => deleteUser(u.id)),
                          })
                        }
                        className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50"
                        title="Hesabı sil"
                        aria-label="Hesabı sil"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </>
                  )}
                </div>

                {resetFor === u.id && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      placeholder="Yeni parola (en az 4 karakter)"
                      className="input-base !py-2.5 flex-1"
                      aria-label="Yeni parola"
                    />
                    <button
                      disabled={busy || resetPw.length < 4}
                      onClick={() =>
                        run(async () => {
                          await updateUser(u.id, { password: resetPw });
                          setResetFor(null);
                          setResetPw("");
                        })
                      }
                      className="btn-primary !py-2.5 text-sm shrink-0"
                    >
                      Parolayı değiştir
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

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
    </main>
  );
}
