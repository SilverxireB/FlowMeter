"use client";

/**
 * Yönetici — kullanıcı aktivite istatistikleri. KOTA DOSTU: tek seferlik
 * doküman-düzeyi okuma (oy/medya gibi alt koleksiyonlar SAYILMAZ — onlar
 * binlerce okuma demek); sayfa açılınca 5 koleksiyon bir kez çekilir.
 * Grafik dili Pulse trend çubuklarıyla aynı (saf CSS, kütüphane yok).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, type Timestamp } from "firebase/firestore";
import Logo from "@/components/Logo";
import { db } from "@/lib/firebase";
import { useAuthUser } from "@/lib/hooks";
import { ADMIN_EMAIL, getUserRecord, isAdminUser, listUsers } from "@/lib/users";
import { UserRecord } from "@/lib/types";

interface ContentDoc {
  id: string;
  ownerId?: string;
  title?: string;
  name?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const PRODUCTS = [
  { key: "decks", col: "presentations", label: "Sunum", icon: "/logo-o-meter.png" },
  { key: "walls", col: "walls", label: "Duvar", icon: "/logo-o-wall.png" },
  { key: "signs", col: "videowalls", label: "Ekran", icon: "/logo-o-sign.png" },
  { key: "pulses", col: "pulses", label: "Nokta", icon: "/logo-o-pulse.png" },
] as const;
type ProductKey = (typeof PRODUCTS)[number]["key"];

const DAY_MS = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export default function AdminStatsPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [content, setContent] = useState<Record<ProductKey, ContentDoc[]> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

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

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      try {
        const [u, ...cols] = await Promise.all([
          listUsers(),
          ...PRODUCTS.map((p) =>
            getDocs(collection(db(), p.col)).then((snap) =>
              snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContentDoc)
            )
          ),
        ]);
        setUsers(u);
        setContent({ decks: cols[0], walls: cols[1], signs: cols[2], pulses: cols[3] });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Veri alınamadı.");
      }
    })();
  }, [allowed]);

  // Kullanıcı başına içerik sayıları + son aktivite (doküman updatedAt/createdAt)
  const rows = useMemo(() => {
    if (!content) return [];
    const byOwner = new Map<string, { counts: Record<ProductKey, number>; lastActivity: number }>();
    const bump = (ownerId: string | undefined, key: ProductKey, t: number) => {
      if (!ownerId) return;
      const e = byOwner.get(ownerId) ?? { counts: { decks: 0, walls: 0, signs: 0, pulses: 0 }, lastActivity: 0 };
      e.counts[key] += 1;
      if (t > e.lastActivity) e.lastActivity = t;
      byOwner.set(ownerId, e);
    };
    for (const p of PRODUCTS)
      for (const d of content[p.key])
        bump(d.ownerId, p.key, d.updatedAt?.toMillis?.() ?? d.createdAt?.toMillis?.() ?? 0);

    return users
      .map((u) => {
        const e = byOwner.get(u.id);
        const total = e ? e.counts.decks + e.counts.walls + e.counts.signs + e.counts.pulses : 0;
        return {
          user: u,
          counts: e?.counts ?? { decks: 0, walls: 0, signs: 0, pulses: 0 },
          total,
          lastActivity: Math.max(e?.lastActivity ?? 0, u.lastSeenAt?.toMillis?.() ?? 0),
        };
      })
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [users, content]);

  // Özet: toplamlar + son 7 gün
  const summary = useMemo(() => {
    if (!content) return null;
    const weekAgo = Date.now() - 7 * DAY_MS;
    const activeUsers = users.filter((u) => (u.lastSeenAt?.toMillis?.() ?? 0) > weekAgo).length;
    const per = PRODUCTS.map((p) => {
      const docs = content[p.key];
      const fresh = docs.filter((d) => (d.createdAt?.toMillis?.() ?? 0) > weekAgo).length;
      return { ...p, total: docs.length, fresh };
    });
    return { activeUsers, per };
  }, [users, content]);

  // Son 30 gün: gün başına oluşturulan içerik (4 ürün toplamı)
  const trend = useMemo(() => {
    if (!content) return [];
    const days: { key: string; label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      days.push({ key: dayKey(d), label: d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }), count: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const p of PRODUCTS)
      for (const doc of content[p.key]) {
        const t = doc.createdAt?.toMillis?.();
        if (!t) continue;
        const i = idx.get(dayKey(new Date(t)));
        if (i !== undefined) days[i].count += 1;
      }
    return days;
  }, [content]);
  const trendMax = Math.max(1, ...trend.map((d) => d.count));

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

  const fmt = (ms: number) =>
    ms ? new Date(ms).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/admin" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Yönetici paneline dön">←</Link>
          <Logo size="sm" variant="studio" />
          <span className="eyebrow hidden sm:inline">İstatistikler</span>
        </div>
        <span className="chip text-muted text-xs truncate max-w-[45vw]">{user?.email}</span>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Kullanıcı aktivitesi</h1>
        <p className="text-muted text-sm mb-6">Kim neyi ne kadar kullanıyor — içerikler ve son etkinlikler.</p>

        {err && <div className="mb-4 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}
        {!content && !err && <p className="text-muted animate-pulse py-10 text-center">Veriler toplanıyor…</p>}

        {summary && (
          <>
            {/* Özet karolar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <div className="card p-4">
                <p className="text-muted text-xs mb-1">Kullanıcı</p>
                <p className="font-display text-2xl font-bold tabular-nums">{users.length}</p>
                <p className="text-xs text-muted mt-0.5 tabular-nums">son 7g aktif: {summary.activeUsers}</p>
              </div>
              {summary.per.map((p) => (
                <div key={p.key} className="card p-4">
                  <p className="text-muted text-xs mb-1 flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.icon} alt="" className="h-3.5 w-auto" /> {p.label}
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums">{p.total}</p>
                  <p className="text-xs text-muted mt-0.5 tabular-nums">{p.fresh ? `son 7g +${p.fresh}` : "son 7g —"}</p>
                </div>
              ))}
            </div>

            {/* 30 günlük oluşturma trendi */}
            <div className="card p-5 mb-6">
              <p className="eyebrow mb-3">Son 30 gün — oluşturulan içerik</p>
              <div className="flex items-end gap-[3px] h-28">
                {trend.map((d) => (
                  <div
                    key={d.key}
                    title={`${d.label}: ${d.count}`}
                    className="flex-1 rounded-t bg-accent/70 hover:bg-accent min-h-[2px]"
                    style={{ height: `${(d.count / trendMax) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted mt-1.5">
                <span>{trend[0]?.label}</span>
                <span>{trend[Math.floor(trend.length / 2)]?.label}</span>
                <span>{trend[trend.length - 1]?.label}</span>
              </div>
            </div>

            {/* Kullanıcı tablosu */}
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-line">
                      <th className="px-4 py-3 font-semibold">Kullanıcı</th>
                      <th className="px-3 py-3 font-semibold text-center" title="Sunum">🎤</th>
                      <th className="px-3 py-3 font-semibold text-center" title="Duvar">📷</th>
                      <th className="px-3 py-3 font-semibold text-center" title="Ekran (Sign)">🖥</th>
                      <th className="px-3 py-3 font-semibold text-center" title="Nokta (Pulse)">📈</th>
                      <th className="px-3 py-3 font-semibold text-center">Toplam</th>
                      <th className="px-4 py-3 font-semibold">Son aktivite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.user.id} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold truncate max-w-[220px]">
                            {r.user.displayName || r.user.email || r.user.id}
                            {(r.user.email === ADMIN_EMAIL || r.user.role === "admin") && (
                              <span className="ml-1.5 text-accent text-xs">🛡</span>
                            )}
                          </p>
                          <p className="text-muted text-xs truncate max-w-[220px]">{r.user.email}</p>
                        </td>
                        {(["decks", "walls", "signs", "pulses"] as const).map((k) => (
                          <td key={k} className="px-3 py-2.5 text-center tabular-nums text-ink/80">
                            {r.counts[k] || <span className="text-muted/50">·</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-center tabular-nums font-semibold">{r.total}</td>
                        <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">{fmt(r.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <p className="text-muted text-center py-10">Kayıt yok.</p>}
            </div>

          </>
        )}
      </section>
    </main>
  );
}
