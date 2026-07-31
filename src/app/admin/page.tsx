"use client";

/**
 * Yönetici paneli — kullanıcı kayıtları. Sadece yöneticiler görür
 * (bootstrap: ADMIN_EMAIL; rules de aynı kuralı sunucu tarafında uygular).
 * v1: listele · yönetici yap/kaldır · kaydı sil. Detaylar sonra genişletilecek.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { useAuthUser } from "@/lib/hooks";
import {
  ADMIN_EMAIL,
  deleteUserRecord,
  getUserRecord,
  isAdminUser,
  listUsers,
  setUserRole,
} from "@/lib/users";
import { UserRecord } from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // işlemdeki uid
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Yetki kontrolü: bootstrap e-posta veya users kaydında role=admin
  useEffect(() => {
    if (!user) return;
    if (user.email === ADMIN_EMAIL) {
      setAllowed(true);
      return;
    }
    getUserRecord(user.uid)
      .then((r) => setAllowed(isAdminUser(user, r)))
      .catch(() => setAllowed(false));
  }, [user]);

  const refresh = useCallback(() => {
    listUsers()
      .then(setUsers)
      .catch((e) => setErr(e instanceof Error ? e.message : "Liste alınamadı."));
  }, []);

  useEffect(() => {
    if (allowed) refresh();
  }, [allowed, refresh]);

  async function toggleRole(u: UserRecord) {
    const makeAdmin = u.role !== "admin";
    if (!confirm(makeAdmin ? `${u.email} yönetici yapılsın mı?` : `${u.email} yöneticilikten alınsın mı?`)) return;
    setBusy(u.id);
    setErr(null);
    try {
      await setUserRole(u.id, makeAdmin ? "admin" : "user");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rol değiştirilemedi.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(u: UserRecord) {
    if (!confirm(`${u.email} kaydı silinsin mi?\nNot: Google hesabı silinmez; tekrar giriş yaparsa kayıt yeniden oluşur. İçerikleri (sunum/duvar) bu işlemde silinmez.`)) return;
    setBusy(u.id);
    setErr(null);
    try {
      await deleteUserRecord(u.id);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Silinemedi.");
    } finally {
      setBusy(null);
    }
  }

  if (loading || allowed === null) {
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  }
  if (!allowed) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Yetki yok</p>
          <p className="text-muted">Bu sayfa sadece yöneticilere açık.</p>
        </div>
      </main>
    );
  }

  const fmt = (t?: { toDate?: () => Date } | null) =>
    t?.toDate ? t.toDate().toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg">←</Link>
          <Logo size="sm" />
          <span className="eyebrow hidden sm:inline">Yönetici paneli</span>
        </div>
        <span className="chip text-muted text-xs truncate max-w-[45vw]">{user?.email}</span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Kullanıcılar</h1>
          <Link href="/admin/stats" className="chip !py-1.5 text-accent font-semibold hover:border-accent shrink-0">
            📊 İstatistikler
          </Link>
        </div>
        <p className="text-muted text-sm mb-6 tabular-nums">{users.length} kayıt · son görülene göre</p>

        {err && <div className="mb-4 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        <div className="flex flex-col gap-2.5">
          {users.map((u) => {
            const isBootstrap = u.email === ADMIN_EMAIL;
            const isSelf = u.id === user?.uid;
            const admin = isBootstrap || u.role === "admin";
            return (
              <div key={u.id} className="card p-4 flex items-center gap-3.5">
                {u.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photoURL} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-accent-soft grid place-items-center font-bold text-accent shrink-0">
                    {(u.displayName || u.email || "?").charAt(0).toLocaleUpperCase("tr-TR")}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {u.displayName || "—"}
                    {admin && <span className="ml-2 chip !py-0 text-xs text-accent">🛡 yönetici</span>}
                    {isSelf && <span className="ml-1.5 text-muted text-xs">(sen)</span>}
                  </p>
                  <p className="text-muted text-sm truncate">{u.email}</p>
                  <p className="text-muted text-xs mt-0.5">
                    Kayıt: {fmt(u.createdAt)} · Son görülme: {fmt(u.lastSeenAt)}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0 flex-col sm:flex-row">
                  {!isBootstrap && (
                    <button
                      onClick={() => toggleRole(u)}
                      disabled={busy === u.id}
                      className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border cursor-pointer ${
                        admin ? "border-line text-muted hover:text-ink" : "border-accent text-accent hover:bg-accent-soft/50"
                      }`}
                    >
                      {admin ? "Yöneticiliği kaldır" : "🛡 Yönetici yap"}
                    </button>
                  )}
                  {!isBootstrap && !isSelf && (
                    <button
                      onClick={() => remove(u)}
                      disabled={busy === u.id}
                      className="!py-1.5 !px-3 text-xs rounded-full font-semibold border border-line text-brand hover:bg-brand-soft/40 cursor-pointer"
                    >
                      🗑 Sil
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <p className="text-muted text-center py-12">
              Henüz kayıt yok. Kullanıcılar giriş yaptıkça burada listelenir.
            </p>
          )}
        </div>

        <p className="text-muted text-xs mt-6 max-w-prose">
          Not: “Sil” yalnızca kullanıcı kaydını kaldırır — Google hesabına ve
          içeriklerine (sunum/duvar) dokunmaz; kullanıcı tekrar giriş yaparsa
          kayıt yeniden oluşur. Kapsamlı yönetim (içerik silme, engelleme)
          sonraki sürümde.
        </p>
      </section>
    </main>
  );
}
