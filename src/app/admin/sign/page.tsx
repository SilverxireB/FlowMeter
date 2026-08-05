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
import { studioHata } from "@/lib/hata";
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
import { loginYolu } from "@/lib/girisYolu";
import { eslesir } from "@/lib/arama";
import { csvIndir, yetkiCsv, yetkiDosyaAdi, YetkiSatiri } from "@/lib/yetkiCsv";

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
      router.replace(loginYolu());
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
  // Kişi araması da Türkçe duyarlı: "gozde" yazan "Gözde"yi bulmalı. Eskiden
  // düz `toLowerCase()` ile aranıyordu ve büyük İ/ı olan adlar bulunamıyordu.
  const visibleUsers = useMemo(
    () => users.filter((u) => eslesir(u.email, search) || eslesir(u.displayName, search)),
    [users, search]
  );

  /**
   * EKRAN ARAMASI — kişi satırının İÇİNDE. Kırk ekranlık tabloda tek bir
   * ekranı bulmak için kaydırmak gerekiyordu. Tek kutu tüm kişiler için
   * geçerli: kişi kişi ayrı arama durumu tutmak, bir sonraki kişiye geçince
   * süzgecin sıfırlanması demekti (ve aynı ekranı herkese vermek en sık iş).
   */
  const [wallSearch, setWallSearch] = useState("");
  const wallsFiltered = useMemo(
    () => wallsSorted.filter((w) => eslesir(w.name, wallSearch) || eslesir(w.slug, wallSearch)),
    [wallsSorted, wallSearch]
  );

  /**
   * SÜZGEÇTEKİ TÜM EKRANLARA tek sütunu uygula. Ekran görüntülerinden okunan
   * gerçek kalıp şu: herkese görüntüleme, birkaçına düzenleme, kimseye silme.
   * Bu kalıbı kurmak kırk tık sürüyordu; artık bir tık + istisnalar.
   *
   * ARAMAYLA BİRLİKTE çalışır: "montaj" aratıp yalnız o ekranlara düzenleme
   * vermek mümkün. Bu yüzden düğme SÜZÜLMÜŞ listeye bakar, tamamına değil —
   * aksi hâlde arama yapan kişi görmediği ekranları da değiştirirdi.
   */
  const topluUygula = async (uid: string, key: (typeof PERMS)[number]["key"], deger: boolean) => {
    setErr(null);
    setBusy(true);
    try {
      for (const w of wallsFiltered) {
        const cur = signPerm(w, uid);
        if (!!cur[key] === deger) continue; // gereksiz yazım yok
        const next: SignGrant = { ...cur, [key]: deger };
        if (w.ownerId === uid && next.view && next.edit && next.copy && next.delete) await clearSignGrant(w.id, uid);
        else await setSignGrant(w.id, uid, next);
      }
      await refresh();
    } catch (e) {
      setErr(studioHata(e, "Toplu yetki uygulanamadı — tekrar dene."));
    } finally {
      setBusy(false);
    }
  };

  /**
   * CSV: "kim hangi ekranda ne yapabiliyor" — iç denetim/ISO sorusunun cevabı.
   * SÜZGEÇLERDEN BAĞIMSIZ, herkesi ve tüm ekranları yazar: denetim belgesi
   * ekranda ne gördüğüne değil, sistemde ne olduğuna bakmalı. Yalnız en az bir
   * yetkisi olan satırlar girer (yoksa "kimse erişemiyor" gürültüsü).
   */
  const disaAktar = () => {
    const satirlar: YetkiSatiri[] = [];
    for (const u of users) {
      const yonetici = u.role === "admin" || u.email === ADMIN_EMAIL;
      for (const w of wallsSorted) {
        const p = signPerm(w, u.id);
        if (!yonetici && !p.view && !p.edit && !p.copy && !p.delete) continue;
        const acikKayit = !!w.grants?.[u.id];
        satirlar.push({
          kisi: u.displayName || u.email || u.id,
          girisAdi: u.email ?? "",
          ekran: w.name,
          view: yonetici || !!p.view,
          edit: yonetici || !!p.edit,
          copy: yonetici || !!p.copy,
          delete: yonetici || !!p.delete,
          kaynak: yonetici ? "yönetici" : acikKayit ? "açık kayıt" : w.ownerId === u.id ? "oluşturan" : "varsayılan",
        });
      }
    }
    csvIndir(yetkiCsv(satirlar), yetkiDosyaAdi(new Date()));
  };

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
      setErr(studioHata(e, "Yetki kaydedilemedi — tekrar dene."));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Satır sonundaki "Hepsi": dördü de tikliyse hepsini kaldırır, değilse hepsini
   * verir. Oluşturan kişide "hepsi" = açık kaydı silmek (varsayılana dönmek);
   * "hiçbiri" = tamamen boş açık kayıt yazmak (erişimi kesmek).
   */
  const toggleAll = async (wall: Videowall, uid: string, allOn: boolean) => {
    setErr(null);
    setBusy(true);
    try {
      if (allOn) {
        await setSignGrant(wall.id, uid, { view: false, edit: false, copy: false, delete: false });
      } else if (wall.ownerId === uid) {
        await clearSignGrant(wall.id, uid);
      } else {
        await setSignGrant(wall.id, uid, { view: true, edit: true, copy: true, delete: true });
      }
      await refresh();
    } catch (e) {
      setErr(studioHata(e, "Yetki kaydedilemedi — tekrar dene."));
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
      setErr(studioHata(e, "Kaydedilemedi — tekrar dene."));
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
          <Logo size="sm" variant="studio" />
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
          Kişiye tıkla, ekranlarını tikle. Kendi oluşturduğu ekranlarda zaten tam yetkilidir.
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

        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-muted text-sm font-semibold tabular-nums">
            {visibleUsers.length} kişi · {walls.length} ekran
          </p>
          {/* DIŞA AKTAR: "kim hangi ekranda ne yapabiliyor" tablosu tek dosya.
              İç denetim/ISO istediğinde sorulan tam olarak bu; bugüne dek
              cevabı ekrandan tek tek okumaktı. Dosya SÜZGEÇTEN BAĞIMSIZ:
              denetim belgesi ekranda ne göründüğüne değil, sistemde ne
              olduğuna bakar. */}
          <button
            onClick={disaAktar}
            disabled={!users.length}
            className="chip !py-1.5 text-xs text-muted hover:border-muted shrink-0 inline-flex items-center gap-1.5 disabled:opacity-40"
            title="Tüm yetki tablosunu CSV olarak indir (Excel ile açılır)"
          >
            <Icon name="download" size={14} /> <span className="hidden sm:inline">Dışa aktar</span>
          </button>
        </div>

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
                      <>
                      {/* Ekran araması + toplu uygulama: kırk ekranlık tabloda
                          "herkese görüntüleme" kurmak kırk tık sürüyordu.
                          Süzgeç varken düğmeler YALNIZ görünen ekranlara işler. */}
                      {wallsSorted.length > 6 && (
                        <div className="relative mb-2.5">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden>
                            <Icon name="search" size={14} />
                          </span>
                          <input
                            value={wallSearch}
                            onChange={(e) => setWallSearch(e.target.value)}
                            placeholder="Ekran ara…"
                            aria-label="Bu tabloda ekran ara"
                            className="input-base !py-1.5 !pl-9 !text-sm"
                          />
                        </div>
                      )}
                      <div className="mb-2.5 text-[11px]">
                        <span className="text-muted">
                          {wallSearch.trim() ? `${wallsFiltered.length} ekran süzüldü · ` : ""}Görünenlere uygula:
                        </span>
<div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
                        {PERMS.map((p) => (
                          <span key={p.key} className="inline-flex w-full sm:w-auto items-center rounded-lg border border-line overflow-hidden bg-white">
                            <span className="flex-1 sm:flex-none px-2 py-1 bg-paper text-muted font-semibold">{p.label}</span>
                            <button
                              onClick={() => topluUygula(u.id, p.key, true)}
                              disabled={busy || !wallsFiltered.length}
                              className="px-2 py-1 font-bold text-accent hover:bg-accent-soft disabled:opacity-30 border-l border-line"
                              title={`Görünen ${wallsFiltered.length} ekranda "${p.label}" yetkisini AÇ`}
                            >
                              aç
                            </button>
                            <button
                              onClick={() => topluUygula(u.id, p.key, false)}
                              disabled={busy || !wallsFiltered.length}
                              className="px-2 py-1 font-bold text-muted hover:bg-paper disabled:opacity-30 border-l border-line"
                              title={`Görünen ${wallsFiltered.length} ekranda "${p.label}" yetkisini KAPAT`}
                            >
                              kapat
                            </button>
                          </span>
                        ))}
                      </div>
</div>
                      {wallsFiltered.length === 0 ? (
                        <p className="text-muted text-sm py-2">&ldquo;{wallSearch}&rdquo; ile eşleşen ekran yok.</p>
                      ) : (
                      <div className="overflow-x-auto max-h-[26rem] overflow-y-auto rounded-xl">
                        <table className="w-full text-sm border-separate border-spacing-y-1">
                          {/* YAPIŞIK BAŞLIK: kırk satırlık tabloda 30. satırdayken
                              hangi tikin "Düzenle" hangisinin "Sil" olduğu
                              görünmüyordu — yanlış tik sessiz ve tehlikeli. */}
                          <thead className="sticky top-0 z-10 bg-paper">
                            <tr className="text-muted text-[11px] uppercase tracking-wider">
                              <th className="text-left font-bold py-1.5">Ekran</th>
                              {PERMS.map((p) => (
                                <th key={p.key} className="font-bold px-2 py-1.5 whitespace-nowrap" title={p.hint}>
                                  {p.label}
                                </th>
                              ))}
                              <th className="font-bold px-2 py-1 whitespace-nowrap" title="Dördünü birden aç/kapat">
                                Hepsi
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {wallsFiltered.map((w) => {
                              const perm = signPerm(w, u.id);
                              const allOn = PERMS.every((p) => perm[p.key]);
                              const someOn = PERMS.some((p) => perm[p.key]);
                              const isOwner = w.ownerId === u.id;
                              return (
                                <tr key={w.id} className="bg-white">
                                  <td className="rounded-l-xl px-3 py-2 min-w-0">
                                    <span className="font-semibold">{w.name}</span>
                                    {isOwner && <span className="text-muted text-xs"> · oluşturan</span>}
                                  </td>
                                  {PERMS.map((p) => (
                                    <td key={p.key} className="text-center px-2 py-2">
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
                                  {/* "Hepsi": kısmen tikliyken BELİRSİZ (—) görünür;
                                      indeterminate yalnız DOM'dan verilebilir. */}
                                  <td className="text-center px-2 py-2 rounded-r-xl border-l border-line">
                                    <input
                                      type="checkbox"
                                      checked={allOn}
                                      ref={(el) => {
                                        if (el) el.indeterminate = someOn && !allOn;
                                      }}
                                      disabled={busy}
                                      onChange={() => toggleAll(w, u.id, allOn)}
                                      aria-label={`${w.name} — hepsi`}
                                      className="w-4 h-4 accent-accent cursor-pointer"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      )}
                      </>
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
