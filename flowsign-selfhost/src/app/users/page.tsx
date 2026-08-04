"use client";

/**
 * Kullanıcılar (yönetici) — hesap aç, parola sıfırla, rol değiştir, sil.
 *
 * Neden gerekli: ekranı ilgilisine teslim edebilmek için karşı tarafın KENDİ
 * hesabı olmalı. Tek ortak parolayla kim ne değiştirdi bilinmez, ayrılan
 * personelin erişimi kesilemezdi.
 *
 * Silinen kişinin ekranları YÖNETİCİYE devrolur (sunucu tarafı) — kimsenin
 * yönetemediği yetim ekran kalmaz.
 */
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Icon } from "@/components/icons";
import { createUser, deleteUser, listUsers, listWalls, setWallGrant, updateUser, wallPerm } from "@/lib/client";
import { PublicUser, SignPerms, Videowall } from "@/lib/types";
import { eslesir } from "@/lib/arama";
import { csvIndir, yetkiCsv, yetkiDosyaAdi, YetkiSatiri } from "@/lib/yetkiCsv";

/**
 * Denetim izi damgası — "kim, ne zaman". Fabrikada personel değişiyor ve
 * sorulan soru hep aynı: bu yetkiyi kim verdi? Kayıt yoksa satır hiç yazılmaz
 * (boş "—" gürültüden ibaret).
 */
const iz = (kim?: string, ne?: number) =>
  kim
    ? `${kim} · ${new Date(ne ?? 0).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "";

/** Yetki sütunları — matrisin tamamı bu dört tikten ibaret (bilerek sade). */
const PERMS = [
  { key: "view", label: "Görüntüle", hint: "Listede görsün, editörü açsın" },
  { key: "edit", label: "Düzenle", hint: "İçeriği değiştirsin ve yayınlasın" },
  { key: "copy", label: "Kopyala", hint: "Kendine kopyasını çıkarsın" },
  { key: "delete", label: "Sil", hint: "Ekranı silsin" },
] as const;

export default function UsersPage() {
  const [tab, setTab] = useState<"accounts" | "access">("accounts");
  const [walls, setWalls] = useState<Videowall[]>([]);
  const [open, setOpen] = useState<string | null>(null); // açık kişi (yetki matrisi)
  const [wallAra, setWallAra] = useState("");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmBox, setConfirmBox] = useState<{ title: string; message: string; confirmLabel: string; danger?: boolean; run: () => void } | null>(null);

  // Yeni hesap
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [pw, setPw] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");

  // Parola sıfırlama (satır içi)
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [u, w] = await Promise.all([listUsers(), listWalls()]);
      setUsers(u.users);
      setMe(u.me);
      setWalls([...w.walls].sort((a, b) => a.name.localeCompare(b.name, "tr")));
    } catch {
      setErr("Kullanıcılar okunamadı — oturumun düşmüş olabilir.");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Tek tik → o kişinin o ekrandaki kaydı (varsayılandan kopyalanarak) yazılır.
   * Oluşturan kişide TÜM tikler geri gelirse kayıt kaldırılır → varsayılana döner.
   */
  const toggleGrant = (w: Videowall, u: PublicUser, key: keyof SignPerms) => {
    const cur = wallPerm(w, u);
    const next: SignPerms = { ...cur, [key]: !cur[key] };
    const backToDefault = w.ownerId === u.id && next.view && next.edit && next.copy && next.delete;
    run(() => setWallGrant(w.id, u.id, backToDefault ? null : next));
  };

  /**
   * Satır sonundaki "Hepsi": dördü de tikliyse hepsini kaldırır, değilse
   * hepsini verir. Oluşturan kişide "hepsi" = kaydı silmek (varsayılana dönmek),
   * "hiçbiri" = boş kayıt yazmak (erişimi kesmek).
   */
  const toggleAllGrants = (w: Videowall, u: PublicUser, allOn: boolean) => {
    if (allOn) run(() => setWallGrant(w.id, u.id, { view: false, edit: false, copy: false, delete: false }));
    else if (w.ownerId === u.id) run(() => setWallGrant(w.id, u.id, null));
    else run(() => setWallGrant(w.id, u.id, { view: true, edit: true, copy: true, delete: true }));
  };

  /**
   * EKRAN ARAMASI — kişi satırının İÇİNDE. Kırk ekranlık tabloda tek bir ekranı
   * bulmak için kaydırmak gerekiyordu. Tek kutu tüm kişiler için geçerli: kişi
   * kişi ayrı süzgeç tutmak, bir sonraki kişiye geçince aramanın sıfırlanması
   * demekti (aynı ekranı birkaç kişiye vermek en sık iş).
   */
  const wallsFiltered = walls.filter((w) => eslesir(w.name, wallAra) || eslesir(w.slug, wallAra));

  /**
   * SÜZGEÇTEKİ TÜM EKRANLARA tek sütunu uygula. Gerçek kalıp şu: herkese
   * görüntüleme, birkaçına düzenleme, kimseye silme. Bu kalıbı kurmak kırk tık
   * sürüyordu. Düğme SÜZÜLMÜŞ listeye bakar, tamamına değil — aksi hâlde arama
   * yapan kişi görmediği ekranları da değiştirirdi.
   */
  const topluUygula = (u: PublicUser, key: keyof SignPerms, deger: boolean) =>
    run(async () => {
      for (const w of wallsFiltered) {
        const cur = wallPerm(w, u);
        if (!!cur[key] === deger) continue; // gereksiz yazım yok
        const next: SignPerms = { ...cur, [key]: deger };
        const varsayilana = w.ownerId === u.id && next.view && next.edit && next.copy && next.delete;
        await setWallGrant(w.id, u.id, varsayilana ? null : next);
      }
    });

  /**
   * CSV: "kim hangi ekranda ne yapabiliyor" — iç denetim sorusunun cevabı.
   * SÜZGEÇLERDEN BAĞIMSIZ: denetim belgesi ekranda ne göründüğüne değil,
   * sistemde ne olduğuna bakar. Yalnız en az bir yetkisi olan satır girer.
   */
  const disaAktar = () => {
    const satirlar: YetkiSatiri[] = [];
    for (const u of users) {
      const yonetici = u.role === "admin";
      for (const w of walls) {
        const p = wallPerm(w, u);
        if (!yonetici && !p.view && !p.edit && !p.copy && !p.delete) continue;
        const g = w.grants?.[u.id];
        satirlar.push({
          kisi: u.label || u.name,
          girisAdi: u.name,
          ekran: w.name,
          view: !!p.view, edit: !!p.edit, copy: !!p.copy, delete: !!p.delete,
          kaynak: yonetici ? "yönetici" : g ? "açık kayıt" : w.ownerId === u.id ? "oluşturan" : "varsayılan",
          veren: g?.by,
          tarih: g?.at,
        });
      }
    }
    csvIndir(yetkiCsv(satirlar), yetkiDosyaAdi(new Date()));
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const admin = me?.role === "admin";

  if (loading) return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/screens" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Ekranlara dön">←</Link>
          <span className="inline-flex items-center gap-1.5 shrink-0" role="img" aria-label="FlowSign">
            <Image src="/logo.png" alt="" width={140} height={40} className="h-7 w-auto" priority />
            <span aria-hidden className="font-display font-semibold text-[26px] leading-none tracking-[0.03em] text-[#001e64]">SIGN</span>
          </span>
        </div>
        <span className="chip text-muted text-xs min-w-0 max-w-[45vw]">
          <span className="truncate min-w-0">{me?.label || me?.name}</span>
        </span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-10">
        {/* Sekmeler: hesap açma ile yetki dağıtma AYRI işler (ikisi tek sayfada
            karışıyordu). Yetki yönetiminin TEK yeri burası. */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto">
          {([
            { k: "accounts", label: "Hesaplar" },
            { k: "access", label: "Sign yetkileri" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`chip !py-1.5 shrink-0 whitespace-nowrap cursor-pointer ${
                tab === t.k ? "!bg-ink !text-white !border-ink" : "text-muted hover:border-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">
          {tab === "accounts" ? "Kullanıcılar" : "Sign yetkileri"}
        </h1>
        <p className="text-muted text-sm mb-6">
          {tab === "accounts"
            ? "Her kişiye kendi hesabını aç; yetkileri yandaki sekmeden dağıt."
            : "Kişiye tıkla, ekranlarını tikle. Kendi oluşturduğu ekranlarda zaten tam yetkilidir."}
        </p>

        {err && <div className="mb-5 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        {tab === "accounts" && !admin && (
          <div className="card p-5 mb-6">
            <p className="text-sm">
              Hesap açmak yöneticiye özeldir. Buradan yalnız <b>kendi parolanı</b> değiştirebilirsin.
            </p>
          </div>
        )}

        {tab === "accounts" && admin && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              run(async () => {
                await createUser(name, pw, role, label);
                setName("");
                setLabel("");
                setPw("");
                setRole("user");
              });
            }}
            className="card p-5 mb-8 flex flex-col gap-3"
          >
            <p className="eyebrow">Yeni hesap</p>
            <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Kullanıcı adı (girişte yazılır)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ayse" className="input-base !py-2.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Görünen ad (isteğe bağlı)</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ayşe — İK" className="input-base !py-2.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Parola</span>
                <input value={pw} onChange={(e) => setPw(e.target.value)} type="text" placeholder="en az 4 karakter" className="input-base !py-2.5" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-muted text-xs">Rol</span>
                <select value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")} className="input-base !py-2.5">
                  <option value="user">Kullanıcı — kendi ekranları</option>
                  <option value="admin">Yönetici — tüm ekranlar + hesaplar</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={busy || !name.trim() || pw.length < 4} className="btn-primary !py-2.5 self-start text-sm">
              <Icon name="plus" size={15} /> Hesabı aç
            </button>
            <p className="text-muted text-xs">Parolayı kişiye kendin ilet — sistem e-posta göndermez.</p>
          </form>
        )}

        {tab === "accounts" && (
        <ul className="flex flex-col gap-2">
          {users.map((u) => {
            const isMe = me?.id === u.id;
            const canReset = admin || isMe;
            return (
              <li key={u.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 ${u.role === "admin" ? "bg-accent-soft text-accent" : "bg-line text-muted"}`}>
                    <Icon name={u.role === "admin" ? "shield" : "users"} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {u.label || u.name} {isMe && <span className="text-muted font-normal text-xs">(sen)</span>}
                    </p>
                    <p className="text-muted text-xs truncate">
                      {u.name} · {u.role === "admin" ? "Yönetici" : "Kullanıcı"}
                    </p>
                    {/* Hesabı en son kim değiştirdi (rol/parola/ad). Ayrılan
                        personelin yetkisi neden hâlâ açık sorusunun ilk adımı. */}
                    {u.updatedBy && (
                      <p className="text-muted text-[11px] truncate">son düzenleyen: {iz(u.updatedBy, u.updatedAt)}</p>
                    )}
                  </div>
                  {canReset && (
                    <button
                      onClick={() => {
                        setResetFor(resetFor === u.id ? null : u.id);
                        setResetPw("");
                      }}
                      className="shrink-0 rounded-lg bg-white border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-muted"
                    >
                      Parola
                    </button>
                  )}
                  {admin && !isMe && (
                    <>
                      <button
                        onClick={() =>
                          run(() => updateUser(u.id, { role: u.role === "admin" ? "user" : "admin" }))
                        }
                        className="shrink-0 rounded-lg bg-white border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-muted"
                        title={u.role === "admin" ? "Yöneticiliği al" : "Yönetici yap"}
                      >
                        {u.role === "admin" ? "Yöneticiliği al" : "Yönetici yap"}
                      </button>
                      <button
                        onClick={() =>
                          setConfirmBox({
                            title: "Hesabı sil",
                            message: `${u.label || u.name} hesabı silinecek. Bu kişinin sahibi olduğu ekranlar YÖNETİCİYE devrolur (ekran silinmez).`,
                            confirmLabel: "Sil",
                            danger: true,
                            run: () => run(() => deleteUser(u.id)),
                          })
                        }
                        className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50"
                        title="Hesabı sil"
                        aria-label="Hesabı sil"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </>
                  )}
                </div>

                {resetFor === u.id && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                      placeholder="Yeni parola (en az 4 karakter)"
                      className="input-base !py-2.5 flex-1"
                      aria-label="Yeni parola"
                    />
                    <button
                      disabled={busy || resetPw.length < 4}
                      onClick={() =>
                        run(async () => {
                          await updateUser(u.id, { password: resetPw });
                          setResetFor(null);
                          setResetPw("");
                        })
                      }
                      className="btn-primary !py-2.5 text-sm shrink-0"
                    >
                      Parolayı değiştir
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        )}

        {/* ── Sign yetkileri: kişi bazlı açılır matris ─────────────────────── */}
        {tab === "access" && (
          !admin ? (
            <div className="card p-5">
              <p className="text-sm">Yetki dağıtmak yöneticiye özeldir.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-muted text-sm font-semibold tabular-nums">
                  {users.length} kişi · {walls.length} ekran
                </p>
                {/* DIŞA AKTAR: "kim hangi ekranda ne yapabiliyor" tek dosya.
                    İç denetim istediğinde sorulan tam olarak bu; bugüne dek
                    cevabı ekrandan tek tek okumaktı. */}
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
                {users.map((u) => {
                  const expanded = open === u.id;
                  const owned = walls.filter((w) => w.ownerId === u.id).length;
                  const granted = walls.filter((w) => w.ownerId !== u.id && !!w.grants?.[u.id]).length;
                  const canCreate = u.canCreate !== false;
                  return (
                    <li key={u.id} className="card overflow-hidden">
                      <div className="p-4 flex items-center gap-3">
                        <button
                          onClick={() => setOpen(expanded ? null : u.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          aria-expanded={expanded}
                        >
                          <span className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden>
                            ›
                          </span>
                          <span className="min-w-0">
                            <span className="font-semibold truncate block">{u.label || u.name}</span>
                            <span className="text-muted text-xs truncate block">
                              {u.name}
                              {u.role === "admin"
                                ? " · yönetici (tüm ekranlar)"
                                : ` · ${owned} oluşturduğu · ${granted} yetkilendirildiği`}
                            </span>
                          </span>
                        </button>
                        <label className="shrink-0 inline-flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input
                            type="checkbox"
                            checked={u.role === "admin" ? true : canCreate}
                            disabled={busy || u.role === "admin"}
                            onChange={() => run(() => updateUser(u.id, { canCreate: !canCreate }))}
                            className="w-4 h-4 accent-accent cursor-pointer"
                          />
                          <span className="hidden sm:inline">Yeni ekran açabilir</span>
                          <span className="sm:hidden">Açabilir</span>
                        </label>
                      </div>

                      {expanded && (
                        <div className="border-t border-line bg-paper/60 px-4 py-3">
                          {u.role === "admin" ? (
                            <p className="text-muted text-sm py-2">Yönetici — tüm ekranlarda tam yetkilidir, tik gerekmez.</p>
                          ) : walls.length === 0 ? (
                            <p className="text-muted text-sm py-2">Henüz ekran yok.</p>
                          ) : (
                            <>
                            {/* Ekran araması + toplu uygulama: kırk ekranlık
                                tabloda "herkese görüntüleme" kurmak kırk tık
                                sürüyordu. Süzgeç varken düğmeler YALNIZ görünen
                                ekranlara işler. */}
                            {walls.length > 6 && (
                              <div className="relative mb-2.5">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden>
                                  <Icon name="search" size={14} />
                                </span>
                                <input
                                  value={wallAra}
                                  onChange={(e) => setWallAra(e.target.value)}
                                  placeholder="Ekran ara…"
                                  aria-label="Bu tabloda ekran ara"
                                  className="input-base !py-1.5 !pl-9 !text-sm"
                                />
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[11px]">
                              <span className="text-muted">
                                {wallAra.trim() ? `${wallsFiltered.length} ekran süzüldü · ` : ""}Görünenlere uygula:
                              </span>
                              {PERMS.map((p) => (
                                <span key={p.key} className="inline-flex items-center rounded-lg border border-line overflow-hidden">
                                  <span className="px-2 py-1 bg-paper text-muted font-semibold">{p.label}</span>
                                  <button
                                    onClick={() => topluUygula(u, p.key, true)}
                                    disabled={busy || !wallsFiltered.length}
                                    className="px-2 py-1 font-bold text-accent hover:bg-accent-soft disabled:opacity-30 border-l border-line"
                                    title={`Görünen ${wallsFiltered.length} ekranda "${p.label}" yetkisini AÇ`}
                                  >
                                    aç
                                  </button>
                                  <button
                                    onClick={() => topluUygula(u, p.key, false)}
                                    disabled={busy || !wallsFiltered.length}
                                    className="px-2 py-1 font-bold text-muted hover:bg-paper disabled:opacity-30 border-l border-line"
                                    title={`Görünen ${wallsFiltered.length} ekranda "${p.label}" yetkisini KAPAT`}
                                  >
                                    kapat
                                  </button>
                                </span>
                              ))}
                            </div>
                            {wallsFiltered.length === 0 ? (
                              <p className="text-muted text-sm py-2">&ldquo;{wallAra}&rdquo; ile eşleşen ekran yok.</p>
                            ) : (
                            <div className="overflow-x-auto max-h-[26rem] overflow-y-auto rounded-xl">
                              <table className="w-full text-sm border-separate border-spacing-y-1">
                                {/* YAPIŞIK BAŞLIK: kırk satırlık tabloda 30.
                                    satırdayken hangi tikin "Düzenle" hangisinin
                                    "Sil" olduğu görünmüyordu — yanlış tik sessiz
                                    ve tehlikeli. */}
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
                                    const perm = wallPerm(w, u);
                                    const allOn = PERMS.every((p) => perm[p.key]);
                                    const someOn = PERMS.some((p) => perm[p.key]);
                                    return (
                                      <tr key={w.id} className="bg-white">
                                        <td className="rounded-l-xl px-3 py-2 min-w-0">
                                          <span className="font-semibold">{w.name}</span>
                                          {w.ownerId === u.id && <span className="text-muted text-xs"> · oluşturan</span>}
                                          {/* Yetkiyi KİM verdi: satırın kendisinde durur, ayrı
                                              bir "geçmiş" ekranı açtırmaz — soru bu satıra
                                              bakarken soruluyor. */}
                                          {w.grants?.[u.id]?.by && (
                                            <span className="block text-muted text-[11px] mt-0.5">
                                              yetkilendiren: {iz(w.grants[u.id].by, w.grants[u.id].at)}
                                            </span>
                                          )}
                                        </td>
                                        {PERMS.map((p) => (
                                          <td key={p.key} className="text-center px-2 py-2">
                                            <input
                                              type="checkbox"
                                              checked={!!perm[p.key]}
                                              disabled={busy}
                                              onChange={() => toggleGrant(w, u, p.key)}
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
                                            onChange={() => toggleAllGrants(w, u, allOn)}
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
            </>
          )
        )}
      </section>

      {confirmBox && (
        <ConfirmDialog
          title={confirmBox.title}
          message={confirmBox.message}
          confirmLabel={confirmBox.confirmLabel}
          danger={confirmBox.danger}
          onConfirm={() => {
            confirmBox.run();
            setConfirmBox(null);
          }}
          onCancel={() => setConfirmBox(null)}
        />
      )}
    </main>
  );
}
