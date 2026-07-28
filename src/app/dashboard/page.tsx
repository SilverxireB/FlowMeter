"use client";

import Link from "next/link";
import Logo from "@/components/Logo";
import LogoRotating from "@/components/LogoRotating";
import SlidePreview from "@/components/editor/SlidePreview";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthUser } from "@/lib/hooks";
import {
  createFromTemplate,
  createPresentation,
  deletePresentation,
  duplicatePresentation,
  getFirstSlide,
  listPresentations,
  newSession,
  renamePresentation,
  setPresentationFolder,
} from "@/lib/presentations";
import { getUserRecord, isAdminUser, upsertUserRecord } from "@/lib/users";
import { createWall, deleteWall, listWalls } from "@/lib/walls";
import { listVideowalls } from "@/lib/videowalls";
import { TEMPLATES } from "@/lib/templates";
import { themeStyle } from "@/lib/themes";
import { withTimeout } from "@/lib/withTimeout";
import { Presentation, Slide, Videowall, Wall } from "@/lib/types";

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
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; err?: boolean } | null>(null);
  // Ürün seçimi: null = HUB (iki markalı kart), decks = FlowMeter, walls = FlowWall
  const [product, setProduct] = useState<"decks" | "walls" | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [signs, setSigns] = useState<Videowall[]>([]);
  const [wallTitle, setWallTitle] = useState("");

  const refresh = useCallback(async () => {
    if (user) setItems(await listPresentations(user.uid));
  }, [user]);

  const refreshWalls = useCallback(async () => {
    if (user) setWalls(await listWalls(user.uid));
  }, [user]);

  // Üç ürünün sayısı/son öğeleri hub'da görünür → hepsini yükle.
  useEffect(() => {
    refreshWalls();
  }, [refreshWalls]);
  useEffect(() => {
    if (user) listVideowalls(user.uid).then(setSigns).catch(() => {});
  }, [user]);

  // Ürün seçimi URL'e yansır (geri-tuşu / paylaşılabilir link), join linkleri değişmez.
  const selectProduct = useCallback((p: "decks" | "walls" | null) => {
    setProduct(p);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", p ? `/dashboard?p=${p}` : "/dashboard");
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("p");
    if (p === "decks" || p === "walls") setProduct(p);
  }, []);

  // "＋ Yeni" → ürünü aç ve oluşturma alanına odaklan ("Aç"tan farklı davranış).
  const titleRef = useRef<HTMLInputElement>(null);
  const wallTitleRef = useRef<HTMLInputElement>(null);
  const openProduct = useCallback(
    (p: "decks" | "walls", focusNew = false) => {
      selectProduct(p);
      if (focusNew) window.setTimeout(() => (p === "walls" ? wallTitleRef : titleRef).current?.focus(), 60);
    },
    [selectProduct]
  );

  async function createWallHandler(e: FormEvent) {
    e.preventDefault();
    if (!user || !wallTitle.trim() || busy) return;
    setBusy(true);
    setFlash(null);
    try {
      const wid = await withTimeout(createWall(user.uid, wallTitle.trim()));
      router.push(`/wall/${wid}/manage`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Duvar oluşturulamadı, tekrar dene.", err: true });
    } finally {
      setBusy(false);
    }
  }

  async function removeWall(w: Wall) {
    if (!confirm(`"${w.title}" duvarı ve tüm medyası silinsin mi? Bu işlem geri alınamaz.`)) return;
    setFlash({ msg: `"${w.title}" siliniyor…` });
    try {
      const idToken = user ? await user.getIdToken().catch(() => undefined) : undefined;
      await deleteWall(w, idToken);
      setFlash(null);
      refreshWalls();
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Silme başarısız, tekrar dene.", err: true });
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Kullanıcı kayıt defteri: girişte kayıt düş + yönetici mi öğren (/admin linki)
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    upsertUserRecord(user).catch(() => {});
    getUserRecord(user.uid)
      .then((r) => setIsAdmin(isAdminUser(user, r)))
      .catch(() => setIsAdmin(isAdminUser(user, null)));
  }, [user]);

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
    setFlash(null);
    try {
      const id = await withTimeout(createPresentation(user.uid, title.trim()));
      router.push(`/edit/${id}`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Sunum oluşturulamadı, tekrar dene.", err: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Presentation) {
    if (!confirm(`"${p.title}" silinsin mi? Bu işlem geri alınamaz.`)) return;
    setFlash({ msg: `"${p.title}" siliniyor…` });
    try {
      await deletePresentation(p);
      setFlash(null);
      refresh();
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Silme başarısız, tekrar dene.", err: true });
    }
  }

  async function duplicate(p: Presentation) {
    if (!user) return;
    setFlash(null);
    try {
      const id = await withTimeout(duplicatePresentation(user.uid, p));
      router.push(`/edit/${id}`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Kopyalanamadı, tekrar dene.", err: true });
    }
  }

  async function newRun(p: Presentation) {
    if (
      !confirm(
        `"${p.title}" için yeni oturum başlat?\nYENİ bir katılım kodu oluşur, ekran sıfırdan başlar. Eski oturumun cevapları silinmez, saklı kalır.`
      )
    )
      return;
    setMenuFor(null);
    setFlash(null);
    try {
      const code = await newSession(p.id, { newCode: true });
      await refresh();
      setFlash({ msg: `✓ Yeni oturum hazır — yeni katılım kodu: ${code}. Sunmak için karttaki “Sun”a bas.` });
      setTimeout(() => setFlash(null), 10000);
    } catch (e) {
      setFlash({ msg: `Yeni oturum başarısız: ${e instanceof Error ? e.message : String(e)}`, err: true });
    }
  }

  async function startFromTemplate(templateId: string) {
    if (!user) return;
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setFlash(null);
    try {
      const id = await withTimeout(createFromTemplate(user.uid, tpl));
      router.push(`/edit/${id}`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Şablondan oluşturulamadı, tekrar dene.", err: true });
      setTemplatesOpen(false);
    }
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
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Link href="/" className="shrink-0">
          {product === null ? <LogoRotating /> : <Logo variant={product === "walls" ? "wall" : "meter"} />}
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {isAdmin && (
            <Link href="/admin" className="chip !py-1.5 text-accent font-semibold shrink-0 hover:border-accent">
              🛡 Admin
            </Link>
          )}
          <span className="chip text-muted min-w-0 max-w-[45vw]">
            <span className="truncate">{user.email}</span>
          </span>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-10">
        {product !== null && (
          <button onClick={() => selectProduct(null)} className="text-muted hover:text-ink text-sm font-semibold mb-4 inline-flex items-center gap-1">
            ← Ürünler
          </button>
        )}

        {flash && (
          <div
            className={`mb-5 rounded-2xl px-4 py-3 text-sm font-semibold ${
              flash.err ? "bg-brand-soft text-brand" : "bg-accent-soft text-accent-dark"
            }`}
          >
            {flash.msg}
          </div>
        )}

        {/* HUB — iki markalı ürün kartı */}
        {product === null && (
          <div>
            <p className="eyebrow mb-2">Panelin</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-7">Ne oluşturmak istersin?</h1>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {/* FlowMeter */}
              <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 bg-gradient-to-br from-accent-soft to-white">
                  <Logo size="lg" />
                  <p className="text-muted text-sm mt-3">İnteraktif sunum & canlı oylama</p>
                </div>
                <div className="p-6 pt-4 flex-1 flex flex-col">
                  <p className="text-xs text-muted mb-2 tabular-nums">{items.length} sunum</p>
                  <ul className="flex flex-col gap-1 mb-4">
                    {[...items].sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0)).slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <button onClick={() => router.push(`/edit/${p.id}`)} className="w-full text-left text-sm truncate text-ink/80 hover:text-accent py-1">• {p.title}</button>
                      </li>
                    ))}
                    {items.length === 0 && <li className="text-sm text-muted py-1">Henüz sunum yok</li>}
                  </ul>
                  <div className="mt-auto flex gap-2">
                    <button onClick={() => openProduct("decks")} className="btn-ghost flex-1 !py-2 text-sm">Sunumlar →</button>
                    <button onClick={() => openProduct("decks", true)} className="btn-primary !py-2 !px-4 text-sm">＋ Yeni</button>
                  </div>
                </div>
              </div>

              {/* FlowWall */}
              <div className="rounded-3xl shadow-sm overflow-hidden flex flex-col text-white" style={{ background: "linear-gradient(160deg,#0b1030 0%,#141b48 100%)" }}>
                <div className="p-6">
                  <Logo size="lg" variant="wall" onDark />
                  <p className="text-white/55 text-sm mt-3">Canlı foto/video etkinlik duvarı</p>
                </div>
                <div className="p-6 pt-4 flex-1 flex flex-col">
                  <p className="text-xs text-white/50 mb-2 tabular-nums">{walls.length} duvar</p>
                  <ul className="flex flex-col gap-1 mb-4">
                    {walls.slice(0, 3).map((w) => (
                      <li key={w.id}>
                        <button onClick={() => router.push(`/wall/${w.id}/manage`)} className="w-full text-left text-sm truncate text-white/75 hover:text-white py-1">• {w.title}</button>
                      </li>
                    ))}
                    {walls.length === 0 && <li className="text-sm text-white/45 py-1">Henüz duvar yok</li>}
                  </ul>
                  <div className="mt-auto flex gap-2">
                    <button onClick={() => openProduct("walls")} className="flex-1 rounded-xl bg-white/10 border border-white/15 py-2 text-sm font-semibold hover:bg-white/15">Duvarlar →</button>
                    <button onClick={() => openProduct("walls", true)} className="rounded-xl bg-white text-[#141b48] px-4 py-2 text-sm font-semibold">＋ Yeni</button>
                  </div>
                </div>
              </div>

              {/* FlowSign (VideoWall) */}
              <div className="rounded-3xl shadow-sm overflow-hidden flex flex-col text-white" style={{ background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 100%)" }}>
                <div className="p-6">
                  <Logo size="lg" variant="sign" onDark />
                  <p className="text-white/55 text-sm mt-3">Video-wall & dijital tabela</p>
                </div>
                <div className="p-6 pt-4 flex-1 flex flex-col">
                  <p className="text-xs text-white/50 mb-2 tabular-nums">{signs.length} duvar</p>
                  <ul className="flex flex-col gap-1 mb-4">
                    {signs.slice(0, 3).map((s) => (
                      <li key={s.id}>
                        <button onClick={() => router.push(`/videowall/${s.id}/edit`)} className="w-full text-left text-sm truncate text-white/75 hover:text-white py-1">• {s.name}</button>
                      </li>
                    ))}
                    {signs.length === 0 && <li className="text-sm text-white/45 py-1">Henüz duvar yok</li>}
                  </ul>
                  <div className="mt-auto flex gap-2">
                    <Link href="/videowall" className="flex-1 rounded-xl bg-white/10 border border-white/15 py-2 text-sm font-semibold hover:bg-white/15 text-center">Duvarlar →</Link>
                    <Link href="/videowall" className="rounded-xl bg-white text-[#312e81] px-4 py-2 text-sm font-semibold">＋ Yeni</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {product === "walls" && (
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Duvarlarım</h1>
            <p className="text-muted text-sm mb-6">
              FlowWall — etkinlik canlı foto/video duvarı. Duvar oluştur, perdeyi aç, misafirler QR ile katılıp fotoğraf paylaşsın.
            </p>
            <form onSubmit={createWallHandler} className="card p-2 flex gap-2 mb-4">
              <input
                ref={wallTitleRef}
                value={wallTitle}
                onChange={(e) => setWallTitle(e.target.value)}
                placeholder="Yeni duvar adı… (ör. Yılbaşı 2027)"
                className="flex-1 bg-transparent px-4 py-3 focus:outline-none font-semibold placeholder:font-normal min-w-0"
              />
              <button type="submit" disabled={!wallTitle.trim() || busy} className="btn-primary px-6">
                + Yeni duvar
              </button>
            </form>

            {walls.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-4" aria-hidden>📷</p>
                <p className="text-muted">Henüz duvarın yok. Yukarıdan ilkini oluştur!</p>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {walls.map((w) => (
                  <li key={w.id} className="card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-semibold truncate">{w.title}</p>
                        <p className="text-muted text-sm mt-0.5">
                          Kod: <span className="font-display font-semibold tracking-[0.15em] text-accent">{w.joinCode || "—"}</span>
                          {w.moderation && <span className="ml-2 text-xs">🛡 moderasyon</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => removeWall(w)}
                        className="btn-ghost !p-0 w-9 h-9 text-brand shrink-0"
                        title="Duvarı sil"
                        aria-label="Duvarı sil"
                      >
                        🗑
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a href={`/wall/${w.id}`} target="_blank" className="btn-primary !py-2 !px-4 text-sm">▶ Perde ↗</a>
                      <Link href={`/wall/${w.id}/manage`} className="btn-ghost !py-2 !px-4 text-sm">Yönet</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {product === "decks" && (
        <>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-6">Sunumlarım</h1>
        <form onSubmit={create} className="card p-2 flex gap-2 mb-3">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yeni sunum adı…"
            className="flex-1 bg-transparent px-4 py-3 focus:outline-none font-semibold placeholder:font-normal min-w-0"
          />
          <button type="submit" disabled={!title.trim() || busy} className="btn-primary px-6">
            + Oluştur
          </button>
        </form>
        <button
          onClick={() => setTemplatesOpen(true)}
          className="btn-ghost mb-8 !py-2.5 text-sm"
        >
          ✨ Şablondan başla
        </button>

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
                  className={`card hover:-translate-y-0.5 transition-transform relative ${
                    view === "list" ? "flex items-stretch" : ""
                  } ${menuFor === p.id ? "z-30" : "z-0"}`}
                >
                  {/* Gerçek 1. slayt önizlemesi (köşe yuvarlaması kartla uyumlu) */}
                  <Link
                    href={`/edit/${p.id}`}
                    className={`block relative shrink-0 overflow-hidden ${
                      view === "grid" ? "aspect-video rounded-t-2xl" : "w-36 self-stretch rounded-l-2xl"
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
                          <span className="font-display font-semibold tracking-[0.15em] text-accent">
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
                            <button onClick={() => newRun(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer">
                              ♻ Yeni oturum (yeni kod)
                            </button>
                            <button onClick={() => duplicate(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer">
                              ⧉ Kopyala
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
        </>
        )}
      </section>

      {/* Şablon galerisi */}
      {templatesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setTemplatesOpen(false)}
        >
          <div
            className="card w-full max-w-2xl p-7 max-h-[85vh] overflow-y-auto animate-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl font-semibold">✨ Şablon galerisi</h2>
              <button onClick={() => setTemplatesOpen(false)} className="btn-ghost !px-3 !py-1.5 text-sm">Kapat</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startFromTemplate(t.id)}
                  className="text-left card !rounded-2xl p-5 hover:-translate-y-0.5 transition-transform cursor-pointer"
                >
                  <div className="text-4xl mb-3" aria-hidden>{t.emoji}</div>
                  <p className="font-display font-semibold mb-1">{t.name}</p>
                  <p className="text-muted text-sm mb-3">{t.description}</p>
                  <p className="eyebrow">{t.slides.length} slayt</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
