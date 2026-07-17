"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import SlidePreview from "@/components/editor/SlidePreview";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/lib/hooks";
import {
  createPresentation,
  deletePresentation,
  getFirstSlide,
  listPresentations,
  renamePresentation,
  setPresentationFolder,
} from "@/lib/presentations";
import { themeStyle } from "@/lib/themes";
import { Presentation, Slide } from "@/lib/types";

/** Kart önizlemesi — sunumun gerçek 1. slaytını render eder (yoksa başlık). */
function CardThumb({ presentation, view }: { presentation: Presentation; view: "grid" | "list" }) {
  const [slide, setSlide] = useState<Slide | null | undefined>(undefined);
  const { style, dark } = themeStyle(presentation.theme);

  useEffect(() => {
    let active = true;
    getFirstSlide(presentation.id)
      .then((s) => active && setSlide(s))
      .catch(() => active && setSlide(null));
    return () => {
      active = false;
    };
  }, [presentation.id]);

  if (slide) {
    return <SlidePreview slide={slide} theme={presentation.theme} bare />;
  }
  // Yükleniyor / slayt yok → temalı başlık
  return (
    <div className="absolute inset-0 flex items-center justify-center px-4" style={style}>
      {presentation.theme?.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={presentation.theme.logo} alt="" className="absolute top-2 left-3 h-5 w-auto" />
      )}
      <span
        className={`text-center font-display font-semibold ${dark ? "text-white" : "text-ink"} ${
          view === "grid" ? "text-lg" : "text-xs"
        }`}
      >
        {presentation.title}
      </span>
    </div>
  );
}

/** Sunucu paneli — arama, klasörler, grid/liste görünümü (Menti "My Mentis"). */
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [items, setItems] = useState<Presentation[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [folder, setFolder] = useState<string | null>(null); // null = tümü
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (user) setItems(await listPresentations(user.uid));
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const folders = useMemo(
    () => [...new Set(items.map((p) => p.folder).filter((f): f is string => !!f))].sort(),
    [items]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return items
      .filter((p) => (folder === null ? true : (p.folder ?? "") === folder))
      .filter((p) => !q || p.title.toLocaleLowerCase("tr-TR").includes(q))
      .sort(
        (a, b) =>
          (b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0) -
          (a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0)
      );
  }, [items, search, folder]);

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

  async function rename(p: Presentation) {
    const name = prompt("Yeni sunum adı:", p.title)?.trim();
    if (!name || name === p.title) return;
    await renamePresentation(p.id, name);
    refresh();
  }

  async function moveToFolder(p: Presentation) {
    const name = prompt(
      "Klasör adı (boş bırak = klasörden çıkar):",
      p.folder ?? ""
    );
    if (name === null) return;
    await setPresentationFolder(p.id, name.trim());
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
    <main className="min-h-screen bg-wash" onClick={() => setMenuFor(null)}>
      <header className="bg-white/80 backdrop-blur border-b border-line px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <span className="chip text-muted">{user.email}</span>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-10">
        <p className="eyebrow mb-2">Sunucu paneli</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-6">Sunumlarım</h1>

        <form onSubmit={create} className="card p-2 flex gap-2 mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni sunum adı…"
            className="flex-1 bg-transparent px-4 py-3 focus:outline-none font-semibold placeholder:font-normal min-w-0"
          />
          <button type="submit" disabled={!title.trim() || busy} className="btn-primary px-6">
            + Oluştur
          </button>
        </form>

        {/* Arama + görünüm */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sunumlarda ara…"
              className="input-base !py-2.5 !pl-11"
              aria-label="Sunumlarda ara"
            />
          </div>
          <button
            onClick={() => setView("grid")}
            aria-label="Kart görünümü"
            className={`btn-ghost !p-0 w-11 h-11 ${view === "grid" ? "!border-accent text-accent" : ""}`}
          >
            ▦
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="Liste görünümü"
            className={`btn-ghost !p-0 w-11 h-11 ${view === "list" ? "!border-accent text-accent" : ""}`}
          >
            ☰
          </button>
        </div>

        {/* Klasör çipleri */}
        {folders.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setFolder(null)}
              className={`chip cursor-pointer ${folder === null ? "!bg-ink !text-white !border-ink" : "hover:border-muted"}`}
            >
              Tümü
            </button>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => setFolder(folder === f ? null : f)}
                className={`chip cursor-pointer ${folder === f ? "!bg-ink !text-white !border-ink" : "hover:border-muted"}`}
              >
                📁 {f}
              </button>
            ))}
          </div>
        )}

        <p className="text-muted text-sm font-semibold mb-4 tabular-nums">
          {visible.length} sunum · son düzenlenene göre
        </p>

        {visible.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4" aria-hidden>🎤</p>
            <p className="text-muted">
              {items.length === 0 ? "Henüz sunumun yok. Yukarıdan ilkini oluştur!" : "Eşleşen sunum yok."}
            </p>
          </div>
        ) : (
          <ul className={view === "grid" ? "grid gap-4 sm:grid-cols-2" : "flex flex-col gap-3"}>
            {visible.map((p) => {
              return (
                <li
                  key={p.id}
                  className={`card overflow-hidden hover:-translate-y-0.5 transition-transform relative ${
                    view === "list" ? "flex items-stretch" : ""
                  }`}
                >
                  {/* Gerçek 1. slayt önizlemesi */}
                  <Link
                    href={`/edit/${p.id}`}
                    className={`block relative shrink-0 overflow-hidden ${
                      view === "grid" ? "aspect-video" : "w-36 self-stretch"
                    }`}
                  >
                    <CardThumb presentation={p} view={view} />
                  </Link>

                  <div className="p-4 flex flex-col gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-semibold truncate">{p.title}</p>
                        <p className="text-muted text-sm mt-0.5">
                          Kod:{" "}
                          <span className="font-display font-semibold tracking-[0.15em] text-brand">
                            {p.joinCode || "—"}
                          </span>
                          {p.folder && <span className="ml-2 text-xs">📁 {p.folder}</span>}
                        </p>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === p.id ? null : p.id);
                          }}
                          aria-label="Sunum menüsü"
                          className="btn-ghost !p-0 w-9 h-9 text-lg"
                        >
                          ···
                        </button>
                        {menuFor === p.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-40 card !rounded-2xl p-2 w-48 flex flex-col animate-pop"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button onClick={() => rename(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer">
                              ✏️ Yeniden adlandır
                            </button>
                            <button onClick={() => moveToFolder(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer">
                              📁 Klasöre taşı
                            </button>
                            <button onClick={() => remove(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold text-brand hover:bg-brand-soft/50 cursor-pointer">
                              🗑 Sil
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Link href={`/present/${p.id}`} className="btn-primary !py-2 !px-4 text-sm">
                        ▶ Sun
                      </Link>
                      <Link href={`/edit/${p.id}`} className="btn-ghost !py-2 !px-4 text-sm">
                        Düzenle
                      </Link>
                      <Link href={`/results/${p.id}`} className="btn-ghost !py-2 !px-4 text-sm">
                        Sonuçlar
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
