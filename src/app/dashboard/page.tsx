"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/lib/hooks";
import {
  createPresentation,
  deletePresentation,
  listPresentations,
} from "@/lib/presentations";
import { Presentation } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [items, setItems] = useState<Presentation[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (user) setItems(await listPresentations(user.uid));
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || busy) return;
    setBusy(true);
    try {
      const id = await createPresentation(user.uid, title.trim());
      router.push(`/edit/${id}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Presentation) {
    if (!confirm(`"${p.title}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    await deletePresentation(p);
    refresh();
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-wash">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand" aria-hidden />
          <span className="font-display font-semibold tracking-tight text-lg">FlowMeter</span>
        </Link>
        <span className="chip text-muted">{user.email}</span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-10">
        <p className="eyebrow mb-2">Sunucu paneli</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-8">Sunumlarım</h1>

        <form onSubmit={create} className="card p-2 flex gap-2 mb-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni sunum adı…"
            className="flex-1 bg-transparent px-4 py-3 focus:outline-none font-semibold placeholder:font-normal"
          />
          <button type="submit" disabled={!title.trim() || busy} className="btn-primary px-6">
            + Oluştur
          </button>
        </form>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4" aria-hidden>🎤</p>
            <p className="text-muted">Henüz sunumun yok. Yukarıdan ilkini oluştur!</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((p) => (
              <li key={p.id} className="card p-5 flex flex-col gap-4 hover:-translate-y-0.5 transition-transform">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-lg truncate">{p.title}</p>
                  <p className="text-muted text-sm mt-1">
                    Kod:{" "}
                    <span className="font-display font-semibold tracking-[0.15em] text-brand">
                      {p.joinCode || "—"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <Link href={`/present/${p.id}`} className="btn-primary !py-2 !px-4 text-sm">
                    ▶ Sun
                  </Link>
                  <Link href={`/edit/${p.id}`} className="btn-ghost !py-2 !px-4 text-sm">
                    Düzenle
                  </Link>
                  <button
                    onClick={() => remove(p)}
                    className="ml-auto text-muted hover:text-brand text-sm font-semibold cursor-pointer px-2 py-1"
                    aria-label={`${p.title} sunumunu sil`}
                  >
                    Sil
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
