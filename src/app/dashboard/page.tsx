"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/lib/hooks";
import {
  copyPresentation,
  createFromTemplate,
  createPresentation,
  deletePresentation,
  listPresentations,
} from "@/lib/presentations";
import { TEMPLATES } from "@/lib/templates";
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

  async function fromTemplate(t: (typeof TEMPLATES)[number]) {
    if (!user || busy) return;
    setBusy(true);
    try {
      const id = await createFromTemplate(user.uid, t.title, t.slides);
      router.push(`/edit/${id}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy(p: Presentation) {
    if (!user || busy) return;
    setBusy(true);
    try {
      await copyPresentation(user.uid, p);
      await refresh();
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
        <Link href="/">
          <Logo />
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

        <div className="flex flex-wrap items-center gap-2 -mt-6 mb-10">
          <span className="text-muted text-sm font-semibold">veya şablondan başla:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => fromTemplate(t)}
              disabled={busy}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>

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
                  <Link href={`/results/${p.id}`} className="btn-ghost !py-2 !px-4 text-sm">
                    Sonuçlar
                  </Link>
                  <button
                    onClick={() => copy(p)}
                    disabled={busy}
                    title="Sunumu kopyala"
                    className="text-muted hover:text-ink text-sm font-semibold cursor-pointer px-1 py-1"
                  >
                    ⧉
                  </button>
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
