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
    return <main className="min-h-screen flex items-center justify-center">Yükleniyor…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">FlowMeter</Link>
        <span className="text-slate-500 text-sm">{user.email}</span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Sunumlarım</h1>

        <form onSubmit={create} className="flex gap-2 mb-8">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni sunum adı…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-3 focus:outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={!title.trim() || busy}
            className="bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-lg px-5"
          >
            Oluştur
          </button>
        </form>

        {items.length === 0 ? (
          <p className="text-slate-400 text-center py-12">
            Henüz sunumun yok. Yukarıdan ilkini oluştur!
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((p) => (
              <li
                key={p.id}
                className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.title}</p>
                  <p className="text-slate-400 text-sm">
                    Kod: <span className="font-mono">{p.joinCode || "—"}</span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/edit/${p.id}`}
                    className="border border-slate-300 hover:bg-slate-50 rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    Düzenle
                  </Link>
                  <Link
                    href={`/present/${p.id}`}
                    className="bg-brand-navy hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    Sun
                  </Link>
                  <button
                    onClick={() => remove(p)}
                    className="text-red-500 hover:bg-red-50 rounded-lg px-3 py-2 text-sm"
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
