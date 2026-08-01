"use client";

/**
 * Yönetici → "Sign yetkileri": FlowSign yetkilerinin TEK yönetim yeri.
 *
 * Neden burada: yetki kutuları ekran ekran dağıtılınca ürün "her sayfada yetki"
 * hissi veriyordu (kullanıcı kararı). Artık ekran sayfalarında yetki yüzeyi YOK;
 * yönetici tek listeden dağıtır.
 *
 * Yapı: KİŞİ bazlı. Her kişi bir satır — "yeni ekran açabilir" tiki üstte,
 * satır açılınca TÜM ekranlar tik tablosu olarak gelir. Kişinin OLUŞTURDUĞU
 * ekranlar varsayılan olarak tam yetkilidir ("yarattığına zaten yetkili");
 * yönetici tiki kaldırdığı anda o kişi için açık kayıt yazılır ve varsayılanı
 * ezer (ayrılan personelin erişimi kesilebilsin).
 *
 * NOT: view/copy GÖRÜNÜRLÜK seviyesidir — perde linki herkese açık olmak
 * zorunda (tabela cihazı giriş yapmaz), o yüzden doküman okuması kısıtlanamaz.
 * edit/delete gerçek kapıdır (firestore.rules).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminTabs from "@/components/AdminTabs";
import Logo from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { SkelBox } from "@/components/Skeleton";
import { useAuthUser } from "@/lib/hooks";
import { ADMIN_EMAIL, getUserRecord, isAdminUser, listUsers, setCanCreateSign } from "@/lib/users";
import { clearSignGrant, listAllVideowalls, setSignGrant, signPerm } from "@/lib/videowalls";
import { SignGrant, UserRecord, Videowall } from "@/lib/types";

const PERMS = [
  { key: "view", label: "Görüntüle", hint: "Listede görsün, editörü açsın" },
  { key: "edit", label: "Düzenle", hint: "İçeriği değiştirsin ve yayınlasın" },
  { key: "copy", label: "Kopyala", hint: "Kendine kopyasını çıkarsın" },
  { key: "delete", label: "Sil", hint: "Ekranı silsin" },
] as const;

export default function AdminSignPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [walls, setWalls] = useState<Videowall[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    getUserRecord(user.uid)
      .then((r) => setAllowed(isAdminUser(user, r)))
      .catch(() => setAllowed(user.email === ADMIN_EMAIL));
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    const [u, w] = await Promise.all([listUsers(), listAllVideowalls()]);
    setUsers(u);
    setWalls(w);
  }, []);

  useEffect(() => {
    if (allowed) refresh().catch(() => setErr("Liste okunamadı — tekrar dene."));
  }, [allowed, refresh]);

  const wallsSorted = useMemo(
    () => [...walls].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [walls]
  );
  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email ?? "").toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q));
  }, [users, search]);

  /** Tek tik → o kişinin o ekrandaki kaydı (varsayılandan kopyalanarak) yazılır. */
  const toggle = async (wall: Videowall, uid: string, key: keyof SignGrant) => {
    setErr(null);
    setBusy(true);
    try {
      const cur = signPerm(wall, uid);
      const next: SignGrant = { ...cur, [key]: !cur[key] };
      // Oluşturan kişide TÜM tikler geri gelirse açık kaydı kaldır → varsayılana dön.
      if (wall.ownerId === uid && next.view && next.edit && next.copy && next.delete) {
        await clearSignGrant(wall.id, uid);
      } else {
        await setSignGrant(wall.id, uid, next);
      }
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yetki kaydedilemedi — tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  const toggleCreate = async (u: UserRecord) => {
    setErr(null);
    setBusy(true);
    try {
      await setCanCreateSign(u.id, u.canCreateSign === false);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi — tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || allowed === null)
    return (
      <main className="min-h-screen bg-wash">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <SkelBox className="h-8 w-48 mb-6" />
          <SkelBox className="h-64 w-full !rounded-2xl" />
        </div>
      </main>
    );

  if (!allowed)
    return (
      <main className="min-h-screen grid place-items-center bg-wash px-4">
        <div className="text-center">
          <p className="text-5xl mb-4" aria-hidden>🔒</p>
          <p className="text-muted mb-6">Bu sayfa yöneticilere özel.</p>
          <Link href="/dashboard" className="btn-ghost">← Panele dön</Link>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Panele dön">←</Link>
          <Logo size="sm" variant="sign" />
          <span className="eyebrow hidden sm:inline">Yönetici paneli</span>
        </div>
        <span className="chip text-muted text-xs min-w-0 max-w-[45vw]">
          <span className="truncate min-w-0">{user?.email}</span>
        </span>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-8">
        <AdminTabs />
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Sign yetkileri</h1>
        <p className="text-muted text-sm mb-6">
          Kim hangi ekranı yönetebilir? Kişiye tıkla, altındaki ekran listesinden tikle. Kendi oluşturduğu
          ekranlarda kişi zaten tam yetkilidir — tik kaldırırsan o da geçerli olur.
        </p>

        {err && <div className="mb-4 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
            <Icon name="search" size={16} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kişi ara…"
            className="input-base !py-2.5 !pl-11"
            aria-label="Kişi ara"
          />
        </div>

        <p className="text-muted text-sm font-semibold mb-3 tabular-nums">
          {visibleUsers.length} kişi · {walls.length} ekran
        </p>

        <ul className="flex flex-col gap-2.5">
          {visibleUsers.map((u) => {
            const expanded = open === u.id;
            const owned = wallsSorted.filter((w) => w.ownerId === u.id).length;
            const granted = wallsSorted.filter((w) => w.ownerId !== u.id && !!w.grants?.[u.id]).length;
            const canCreate = u.canCreateSign !== false;
            return (
              <li key={u.id} className="card overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => setOpen(expanded ? null : u.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    aria-expanded={expanded}
                  >
                    <span className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden>
                      <Icon name="chevronRight" size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="font-semibold truncate block">{u.displayName || u.email}</span>
                      <span className="text-muted text-xs truncate block">
                        {u.email}
                        {u.role === "admin" || u.email === ADMIN_EMAIL ? " · yönetici (tüm ekranlar)" : ` · ${owned} oluşturduğu · ${granted} yetkilendirildiği`}
                      </span>
                    </span>
                  </button>
                  <label className="shrink-0 inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canCreate}
                      disabled={busy}
                      onChange={() => toggleCreate(u)}
                      className="w-4 h-4 accent-accent cursor-pointer"
                    />
                    <span className="hidden sm:inline">Yeni ekran açabilir</span>
                    <span className="sm:hidden">Açabilir</span>
                  </label>
                </div>

                {expanded && (
                  <div className="border-t border-line bg-paper/60 px-4 py-3">
                    {u.role === "admin" || u.email === ADMIN_EMAIL ? (
                      <p className="text-muted text-sm py-2">
                        Yönetici — tüm ekranlarda tam yetkilidir, tik gerekmez.
                      </p>
                    ) : wallsSorted.length === 0 ? (
                      <p className="text-muted text-sm py-2">Henüz ekran yok.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-separate border-spacing-y-1">
                          <thead>
                            <tr className="text-muted text-[11px] uppercase tracking-wider">
                              <th className="text-left font-bold py-1">Ekran</th>
                              {PERMS.map((p) => (
                                <th key={p.key} className="font-bold px-2 py-1 whitespace-nowrap" title={p.hint}>
                                  {p.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {wallsSorted.map((w) => {
                              const perm = signPerm(w, u.id);
                              const isOwner = w.ownerId === u.id;
                              return (
                                <tr key={w.id} className="bg-white">
                                  <td className="rounded-l-xl px-3 py-2 min-w-0">
                                    <span className="font-semibold">{w.name}</span>
                                    {isOwner && <span className="text-muted text-xs"> · oluşturan</span>}
                                  </td>
                                  {PERMS.map((p, i) => (
                                    <td
                                      key={p.key}
                                      className={`text-center px-2 py-2 ${i === PERMS.length - 1 ? "rounded-r-xl" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={!!perm[p.key]}
                                        disabled={busy}
                                        onChange={() => toggle(w, u.id, p.key)}
                                        aria-label={`${w.name} — ${p.label}`}
                                        className="w-4 h-4 accent-accent cursor-pointer"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
