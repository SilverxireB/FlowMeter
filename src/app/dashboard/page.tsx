"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import Logo from "@/components/Logo";
import StudioHero from "@/components/StudioHero";
import SlidePreview from "@/components/editor/SlidePreview";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
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
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { SkelBox, SkelCards } from "@/components/Skeleton";
import { SLIDE_TYPE_ICON_NAMES } from "@/lib/slideTypeIcons";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { getUserRecord, isAdminUser, upsertUserRecord } from "@/lib/users";
import { createWall, deleteWall, listWalls } from "@/lib/walls";
import { listVideowalls } from "@/lib/videowalls";
import { listPulses } from "@/lib/pulses";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import { themeStyle } from "@/lib/themes";
import { withTimeout } from "@/lib/withTimeout";
import { Presentation, Pulse, Slide, SLIDE_TYPE_LABELS, Videowall, Wall } from "@/lib/types";

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
    // Liste görünümü: küçük kutuda tam boy tipografi iç içe giriyordu → mini;
    // ayrıca kabı TAM doldursun ki 16:9 farkından altta beyaz boşluk kalmasın.
    return <SlidePreview slide={slide} theme={presentation.theme} bare mini={view === "list"} fill={view === "list"} />;
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
          view === "grid" ? "text-lg line-clamp-3" : "text-xs line-clamp-2"
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
  const playTarget = usePlayTarget();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<Presentation[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [folder, setFolder] = useState<string | null>(null); // null = tümü
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // Şablondan sunum kurmak birkaç saniye sürüyor (sunum + slaytlar yazılıyor).
  // Geri bildirim olmadığı için kullanıcı "tıklayamadım mı?" deyip ikinci kez
  // basıyor ve İKİ sunum oluşuyordu → kilit + görünür "Hazırlanıyor…" durumu.
  const [creatingTpl, setCreatingTpl] = useState<string | null>(null);
  /**
   * ÇİFT TIKLAMA KİLİDİ — ref, state DEĞİL. State güncellemesi bir sonraki
   * çizimde geçerli olduğundan, hızlı iki dokunuş aynı çizimin kapanışını
   * okuyup ikisi de "boşta" görüyor ve İKİ kayıt oluşturuyordu. Ref anında
   * değişir; ikinci dokunuş kapıdan dönüyor.
   */
  const creatingRef = useRef(false);
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
  const [pulses, setPulses] = useState<Pulse[]>([]);
  useEffect(() => {
    if (user) listPulses(user.uid).then(setPulses).catch(() => {});
  }, [user]);

  // Ürün seçimi URL'e yansır (paylaşılabilir link) VE geçmişe adım ekler:
  // hub'dan bir ürüne girmek gerçek bir adımdır — geri tuşu ürün kartlarına
  // (hub'a) dönmeli. Eskiden replaceState kullanıldığından geri tuşu hub'ı
  // atlayıp karşılama sayfasına düşürüyordu (PWA'da uygulamayı kapatıyordu).
  const pushedRef = useRef(false);
  const selectProduct = useCallback((p: "decks" | "walls" | null) => {
    if (typeof window === "undefined") {
      setProduct(p);
      return;
    }
    const cur = new URLSearchParams(window.location.search).get("p");
    if (p && !cur) {
      // Hub → ürün: YENİ geçmiş adımı
      window.history.pushState(null, "", `/dashboard?p=${p}`);
      pushedRef.current = true;
      setProduct(p);
      return;
    }
    if (!p && pushedRef.current) {
      // "← Ürünler": eklediğimiz adımı geri sar (durumu popstate senkronlar) —
      // sistem geri tuşuyla tıpatıp aynı davranış.
      pushedRef.current = false;
      window.history.back();
      return;
    }
    // Ürünler arası geçiş / doğrudan linkle gelinmişse: adım biriktirme
    setProduct(p);
    window.history.replaceState(null, "", p ? `/dashboard?p=${p}` : "/dashboard");
  }, []);
  // Geri/ileri tuşu → görünüm URL ile aynı kalsın (adres çubuğu ve ekran ayrışmasın)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const p = new URLSearchParams(window.location.search).get("p");
      setProduct(p === "decks" || p === "walls" ? p : null);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
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
    if (!user || !wallTitle.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    setFlash(null);
    try {
      const wid = await withTimeout(createWall(user.uid, wallTitle.trim()));
      router.push(`/wall/${wid}/manage`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Duvar oluşturulamadı, tekrar dene.", err: true });
      creatingRef.current = false; // hata → tekrar denenebilsin (başarıda sayfa değişiyor)
    } finally {
      setBusy(false);
    }
  }

  async function removeWall(w: Wall) {
    setMenuFor(null);
    // Duvar silme en yavaş işlem: medya dokümanları sayfalı siliniyor + Cloudinary
    // klasörü temizleniyor. Alt şerit işlem boyunca görünür kalır.
    setDeletingId(w.id);
    show(`"${w.title}" siliniyor…`, "busy");
    try {
      const idToken = user ? await user.getIdToken().catch(() => undefined) : undefined;
      await deleteWall(w, idToken);
      await refreshWalls();
      show("Duvar silindi");
    } catch (err) {
      show(err instanceof Error ? err.message : "Silme başarısız, tekrar dene.", "error");
    } finally {
      setDeletingId(null);
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
    if (!user || !title.trim() || creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    setFlash(null);
    try {
      const id = await withTimeout(createPresentation(user.uid, title.trim()));
      router.push(`/edit/${id}`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Sunum oluşturulamadı, tekrar dene.", err: true });
      creatingRef.current = false; // hata → tekrar denenebilsin (başarıda sayfa değişiyor)
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Presentation) {
    setMenuFor(null); // kart soluklaşınca açık menü hayalet gibi kalıyordu
    setDeletingId(p.id);
    show(`"${p.title}" siliniyor…`, "busy");
    try {
      await deletePresentation(p);
      await refresh();
      show("Sunum silindi");
    } catch (err) {
      show(err instanceof Error ? err.message : "Silme başarısız, tekrar dene.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function duplicate(p: Presentation) {
    if (!user || creatingRef.current) return; // çift tıklama iki kopya üretmesin
    creatingRef.current = true;
    setMenuFor(null); // menü açık kalırsa kullanıcı tekrar basmayı deniyor
    setBusy(true);
    setFlash({ msg: `"${p.title}" kopyalanıyor…` });
    try {
      const id = await withTimeout(duplicatePresentation(user.uid, p));
      router.push(`/edit/${id}`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Kopyalanamadı, tekrar dene.", err: true });
      creatingRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  async function newRun(p: Presentation) {
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
    if (!user || creatingRef.current) return; // çift tıklama iki sunum üretmesin
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    creatingRef.current = true;
    setFlash(null);
    setCreatingTpl(templateId);
    try {
      const id = await withTimeout(createFromTemplate(user.uid, tpl));
      // Kilidi AÇMIYORUZ: yönlendirme başlayana dek kart "Hazırlanıyor…" kalsın.
      router.push(`/edit/${id}`);
    } catch (err) {
      setFlash({ msg: err instanceof Error ? err.message : "Şablondan oluşturulamadı, tekrar dene.", err: true });
      setTemplatesOpen(false);
      setCreatingTpl(null);
      creatingRef.current = false;
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
      <main className="min-h-screen bg-wash">
        <div className="h-[68px] border-b border-line bg-white/80" />
        <div className="max-w-5xl mx-auto px-4 py-10">
          <SkelBox className="h-9 w-52 mb-6" />
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <SkelBox className="h-40 !rounded-2xl" />
            <SkelBox className="h-40 !rounded-2xl" />
          </div>
          <SkelCards count={2} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-wash" onClick={() => setMenuFor(null)}>
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Link href="/" className="shrink-0">
          {product === null ? <Logo variant="studio" /> : <Logo variant={product === "walls" ? "wall" : "meter"} />}
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {isAdmin && (
            <Link href="/admin" className="chip !py-1.5 text-accent font-semibold shrink-0 hover:border-accent inline-flex items-center gap-1.5">
              <Icon name="shield" size={15} /> Admin
            </Link>
          )}
          <span className="chip text-muted min-w-0 max-w-[45vw]">
            <span className="truncate">{user.email}</span>
          </span>
          <button
            onClick={() => signOut(auth()).then(() => router.replace("/login"))}
            className="chip !py-1.5 shrink-0 text-muted hover:text-ink hover:border-ink/30"
            title="Çıkış yap"
          >
            Çıkış
          </button>
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

        {/* HUB — Studio açılış animasyonu + markalı ürün kartları */}
        {product === null && (
          <div>
            <StudioHero />
            <div className="grid gap-5 sm:grid-cols-2">
              {/* FlowMeter */}
              <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
                {/* Panel tonları O-halkasının dört yayından (kullanıcı kararı):
                    Meter mavi, Wall turuncu, Sign yeşil, Pulse kırmızı (EKG) */}
                <div className="p-6" style={{ background: "linear-gradient(160deg,#e7f2fe 0%,#ffffff 100%)" }}>
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

              {/* FlowWall — beyaz gövde, üst panel şeftali tonu */}
              <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="p-6" style={{ background: "linear-gradient(160deg,#fff1e4 0%,#ffffff 100%)" }}>
                  <Logo size="lg" variant="wall" />
                  <p className="text-muted text-sm mt-3">Canlı foto/video etkinlik duvarı</p>
                </div>
                <div className="p-6 pt-4 flex-1 flex flex-col">
                  <p className="text-xs text-muted mb-2 tabular-nums">{walls.length} duvar</p>
                  <ul className="flex flex-col gap-1 mb-4">
                    {walls.slice(0, 3).map((w) => (
                      <li key={w.id}>
                        <button onClick={() => router.push(`/wall/${w.id}/manage`)} className="w-full text-left text-sm truncate text-ink/80 hover:text-accent py-1">• {w.title}</button>
                      </li>
                    ))}
                    {walls.length === 0 && <li className="text-sm text-muted py-1">Henüz duvar yok</li>}
                  </ul>
                  <div className="mt-auto flex gap-2">
                    <button onClick={() => openProduct("walls")} className="btn-ghost flex-1 !py-2 text-sm">Duvarlar →</button>
                    <button onClick={() => openProduct("walls", true)} className="btn-primary !py-2 !px-4 text-sm">＋ Yeni</button>
                  </div>
                </div>
              </div>

              {/* FlowSign — beyaz gövde, üst panel yeşil yay tonu */}
              <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="p-6" style={{ background: "linear-gradient(160deg,#ecfdf5 0%,#ffffff 100%)" }}>
                  <Logo size="lg" variant="sign" />
                  <p className="text-muted text-sm mt-3">Video-wall & dijital tabela</p>
                </div>
                <div className="p-6 pt-4 flex-1 flex flex-col">
                  <p className="text-xs text-muted mb-2 tabular-nums">{signs.length} ekran</p>
                  <ul className="flex flex-col gap-1 mb-4">
                    {signs.slice(0, 3).map((s) => (
                      <li key={s.id}>
                        <button onClick={() => router.push(`/videowall/${s.id}/edit`)} className="w-full text-left text-sm truncate text-ink/80 hover:text-accent py-1">• {s.name}</button>
                      </li>
                    ))}
                    {signs.length === 0 && <li className="text-sm text-muted py-1">Henüz ekran yok</li>}
                  </ul>
                  <div className="mt-auto flex gap-2">
                    <Link href="/videowall" className="btn-ghost flex-1 !py-2 text-sm text-center">Ekranlar →</Link>
                    <Link href="/videowall?new=1" className="btn-primary !py-2 !px-4 text-sm">＋ Yeni</Link>
                  </div>
                </div>
              </div>

              {/* FlowPulse — beyaz gövde, üst panel kırmızı yay tonu (EKG kırmızısı) */}
              <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden flex flex-col">
                <div className="p-6" style={{ background: "linear-gradient(160deg,#fdeceb 0%,#ffffff 100%)" }}>
                  <Logo size="lg" variant="pulse" />
                  <p className="text-muted text-sm mt-3">Sürekli nabız & geri bildirim</p>
                </div>
                <div className="p-6 pt-4 flex-1 flex flex-col">
                  <p className="text-xs text-muted mb-2 tabular-nums">{pulses.length} nokta</p>
                  <ul className="flex flex-col gap-1 mb-4">
                    {pulses.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <button onClick={() => router.push(`/pulse/${p.id}/manage`)} className="w-full text-left text-sm truncate text-ink/80 hover:text-accent py-1">• {p.title}</button>
                      </li>
                    ))}
                    {pulses.length === 0 && <li className="text-sm text-muted py-1">Henüz geri bildirim noktası yok</li>}
                  </ul>
                  <div className="mt-auto flex gap-2">
                    <Link href="/pulse" className="btn-ghost flex-1 !py-2 text-sm text-center">Noktalar →</Link>
                    <Link href="/pulse?new=1" className="btn-primary !py-2 !px-4 text-sm">＋ Yeni</Link>
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
                  <li key={w.id} className={`card p-4 flex flex-col gap-3 transition-opacity ${deletingId === w.id ? "opacity-40 pointer-events-none" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-semibold truncate">{w.title}</p>
                        <p className="text-muted text-sm mt-0.5">
                          Kod: <span className="font-display font-semibold tracking-[0.15em] text-accent">{w.joinCode || "—"}</span>
                          {w.moderation && <span className="ml-2 text-xs inline-flex items-center gap-1"><Icon name="shield" size={12} /> moderasyon</span>}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          confirm(
                            { title: "Duvarı sil", message: `"${w.title}" duvarı ve tüm medyası silinecek. Bu işlem geri alınamaz.`, confirmLabel: "Sil", danger: true },
                            () => removeWall(w)
                          )
                        }
                        className="btn-ghost !p-0 w-9 h-9 text-brand shrink-0"
                        title="Duvarı sil"
                        aria-label="Duvarı sil"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a href={`/wall/${w.id}`} target={playTarget} className="btn-primary !py-2 !px-4 text-sm"><Icon name="play" size={14} /> Perde{playTarget ? " ↗" : ""}</a>
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
          <Icon name="sparkles" size={15} /> Şablondan başla
        </button>

        {/* Arama + görünüm */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden><Icon name="search" size={16} /></span>
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
            <Icon name="grid" size={18} />
          </button>
          <button
            onClick={() => setView("list")}
            aria-label="Liste görünümü"
            className={`btn-ghost !p-0 w-11 h-11 ${view === "list" ? "!border-accent text-accent" : ""}`}
          >
            <Icon name="list" size={18} />
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
                <Icon name="folder" size={13} /> {f}
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
                  className={`card hover:-translate-y-0.5 transition-all relative ${
                    view === "list" ? "flex items-stretch" : ""
                  } ${menuFor === p.id ? "z-30" : "z-0"} ${
                    deletingId === p.id ? "opacity-40 pointer-events-none" : ""
                  }`}
                >
                  {/* Gerçek 1. slayt önizlemesi (köşe yuvarlaması kartla uyumlu) */}
                  <Link
                    href={`/edit/${p.id}`}
                    className={`block relative shrink-0 overflow-hidden ${
                      view === "grid" ? "aspect-video rounded-t-2xl" : "w-24 sm:w-36 self-stretch rounded-l-2xl"
                    }`}
                  >
                    <CardThumb presentation={p} view={view} />
                  </Link>

                  <div className={`flex flex-col gap-2.5 min-w-0 flex-1 ${view === "list" ? "p-3 sm:p-4" : "p-4"}`}>
                    <div className="min-w-0 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-semibold truncate">{p.title}</p>
                        <p className="text-muted text-sm mt-0.5">
                          Kod:{" "}
                          <span className="font-display font-semibold tracking-[0.15em] text-accent">
                            {p.joinCode || "—"}
                          </span>
                          {p.folder && <span className="ml-2 text-xs inline-flex items-center gap-1"><Icon name="folder" size={12} /> {p.folder}</span>}
                        </p>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === p.id ? null : p.id);
                          }}
                          aria-label="Sunum menüsü"
                          className="btn-ghost !p-0 w-9 h-9"
                        >
                          <Icon name="dots" size={18} />
                        </button>
                        {menuFor === p.id && (
                          <div
                            className="absolute right-0 top-full mt-1 z-40 card !rounded-2xl p-2 w-48 flex flex-col animate-pop"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button onClick={() => rename(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer inline-flex items-center gap-2">
                              <Icon name="pencil" size={14} /> Yeniden adlandır
                            </button>
                            <button
                              onClick={() =>
                                confirm(
                                  {
                                    title: "Yeni oturum başlat",
                                    message: `"${p.title}" için YENİ bir katılım kodu oluşur ve ekran sıfırdan başlar.\nEski oturumun cevapları silinmez, saklı kalır.`,
                                    confirmLabel: "Yeni oturum",
                                  },
                                  () => newRun(p)
                                )
                              } className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer inline-flex items-center gap-2">
                              <Icon name="refresh" size={14} /> Yeni oturum (yeni kod)
                            </button>
                            <button onClick={() => duplicate(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer inline-flex items-center gap-2">
                              <Icon name="copy" size={14} /> Kopyala
                            </button>
                            <button onClick={() => moveToFolder(p)} className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold hover:bg-paper cursor-pointer inline-flex items-center gap-2">
                              <Icon name="folder" size={14} /> Klasöre taşı
                            </button>
                            <button
                              onClick={() =>
                                confirm(
                                  { title: "Sunumu sil", message: `"${p.title}" silinecek. Bu işlem geri alınamaz.`, confirmLabel: "Sil", danger: true },
                                  () => remove(p)
                                )
                              } className="text-left rounded-xl px-3.5 py-2 text-sm font-semibold text-brand hover:bg-brand-soft/50 cursor-pointer inline-flex items-center gap-2">
                              <Icon name="trash" size={14} /> Sil
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap mt-auto">
                      <Link href={`/present/${p.id}`} className="btn-primary !py-2 !px-3.5 text-sm">
                        <Icon name="play" size={14} /> Sun
                      </Link>
                      {/* Kart görünümünde etiket zaten var → ikincil düğmelerde ikon YOK
                          (üçü tek satıra sığsın; ikonla genişleyip alta düşüyordu).
                          Liste görünümünde tam tersi: yer dar, yalnız ikon. */}
                      <Link href={`/edit/${p.id}`} className="btn-ghost !py-2 !px-3.5 text-sm" title="Düzenle" aria-label="Düzenle">
                        {view === "list" ? <Icon name="pencil" size={15} /> : null}
                        <span className={view === "list" ? "hidden sm:inline" : ""}>Düzenle</span>
                      </Link>
                      <Link href={`/results/${p.id}`} className="btn-ghost !py-2 !px-3.5 text-sm" title="Sonuçlar" aria-label="Sonuçlar">
                        {view === "list" ? <Icon name="chart" size={15} /> : null}
                        <span className={view === "list" ? "hidden sm:inline" : ""}>Sonuçlar</span>
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
              <h2 className="font-display text-2xl font-semibold flex items-center gap-2"><Icon name="sparkles" size={20} /> Şablon galerisi</h2>
              <button onClick={() => setTemplatesOpen(false)} className="btn-ghost !px-3 !py-1.5 text-sm">Kapat</button>
            </div>
            {TEMPLATE_CATEGORIES.map((cat) => {
              const list = TEMPLATES.filter((t) => t.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat} className="mb-6 last:mb-0">
                  <p className="eyebrow mb-2.5">{cat}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {list.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => startFromTemplate(t.id)}
                        disabled={!!creatingTpl}
                        aria-busy={creatingTpl === t.id}
                        className={`relative text-left card !rounded-2xl p-4 transition-all flex flex-col gap-2 ${
                          creatingTpl
                            ? "cursor-default"
                            : "cursor-pointer hover:-translate-y-0.5 hover:border-accent/40"
                        } ${creatingTpl && creatingTpl !== t.id ? "opacity-40" : ""}`}
                      >
                        {creatingTpl === t.id && (
                          <span className="absolute inset-0 z-10 rounded-2xl bg-white/75 backdrop-blur-[1px] grid place-items-center">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
                              <span className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" aria-hidden />
                              Sunumun hazırlanıyor…
                            </span>
                          </span>
                        )}
                        <div className="flex items-center gap-2.5">
                          <span className="shrink-0 text-3xl leading-none" aria-hidden>{t.emoji}</span>
                          <p className="font-display font-semibold min-w-0 truncate">{t.name}</p>
                        </div>
                        <p className="text-muted text-sm leading-snug">{t.description}</p>
                        {/* Şablonun İÇİNDE ne var: tip rozetleri (aynı tip bir kez) */}
                        <div className="flex flex-wrap items-center gap-1 mt-auto pt-1">
                          {Array.from(new Set(t.slides.map((sl) => sl.type))).slice(0, 6).map((ty) => (
                            <span key={ty} className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted bg-paper border border-line rounded-full px-1.5 py-0.5">
                              <Icon name={SLIDE_TYPE_ICON_NAMES[ty]} size={11} />
                              {SLIDE_TYPE_LABELS[ty]}
                            </span>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted/80 border-t border-line pt-2 mt-1">
                          {t.slides.length} slayt · {t.useCase}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dialog}
      {toast}
    </main>
  );
}
