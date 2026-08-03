"use client";

/**
 * Yönetici paneli — kullanıcı kayıtları. Sadece yöneticiler görür
 * (bootstrap: ADMIN_EMAIL; rules de aynı kuralı sunucu tarafında uygular).
 * v1: listele · yönetici yap/kaldır · kaydı sil. Detaylar sonra genişletilecek.
 */
import Link from "next/link";
import { studioHata } from "@/lib/hata";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminTabs from "@/components/AdminTabs";
import Logo from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAuthUser } from "@/lib/hooks";
import {
  ADMIN_EMAIL,
  deleteUserRecord,
  getUserRecord,
  isAdminUser,
  isGhostRecord,
  listUsers,
  setUserBlocked,
  setUserRole,
  transferAllContent,
  deleteAllContent,
} from "@/lib/users";
import { listPresentations } from "@/lib/presentations";
import { listWalls } from "@/lib/walls";
import { listVideowalls } from "@/lib/videowalls";
import { listPulses } from "@/lib/pulses";
import { UserRecord } from "@/lib/types";

export default function AdminPage() {
  const { confirm, dialog } = useConfirm();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // işlemdeki uid
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Yetki kontrolü: bootstrap e-posta veya users kaydında role=admin
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

  const refresh = useCallback(() => {
    listUsers()
      .then(setUsers)
      .catch((e) => setErr(studioHata(e, "Liste alınamadı.")));
  }, []);

  useEffect(() => {
    if (allowed) refresh();
  }, [allowed, refresh]);

  async function toggleRole(u: UserRecord) {
    const makeAdmin = u.role !== "admin";
    setBusy(u.id);
    setErr(null);
    try {
      await setUserRole(u.id, makeAdmin ? "admin" : "user");
      refresh();
    } catch (e) {
      setErr(studioHata(e, "Rol değiştirilemedi."));
    } finally {
      setBusy(null);
    }
  }

  // İçerik özeti İSTENİNCE yüklenir: her kullanıcı için dört sorgu demek,
  // listeyi açar açmaz hepsini çekmek gereksiz okuma olurdu.
  const [icerik, setIcerik] = useState<Record<string, { sunum: number; duvar: number; ekran: number; nokta: number }>>({});
  const [icerikBusy, setIcerikBusy] = useState<string | null>(null);
  async function icerikSay(uid: string) {
    setIcerikBusy(uid);
    try {
      const [a, b, c, d] = await Promise.all([
        listPresentations(uid),
        listWalls(uid),
        listVideowalls(uid),
        listPulses(uid),
      ]);
      setIcerik((m) => ({ ...m, [uid]: { sunum: a.length, duvar: b.length, ekran: c.length, nokta: d.length } }));
    } catch (e) {
      setErr(studioHata(e, "İçerik sayılamadı."));
    } finally {
      setIcerikBusy(null);
    }
  }

  async function devral(u: UserRecord) {
    if (!user) return;
    setBusy(u.id);
    setErr(null);
    try {
      const n = await transferAllContent(u.id, user.uid);
      setIcerik((m) => ({ ...m, [u.id]: { sunum: 0, duvar: 0, ekran: 0, nokta: 0 } }));
      setErr(n ? `${n} içerik devralındı — artık senin panelinde.` : "Devralınacak içerik yok.");
    } catch (e) {
      setErr(studioHata(e, "Devralınamadı."));
    } finally {
      setBusy(null);
    }
  }

  async function icerigiSil(u: UserRecord) {
    if (!user) return;
    setBusy(u.id);
    setErr(null);
    try {
      const idToken = await user.getIdToken().catch(() => undefined);
      const n = await deleteAllContent(u.id, user.uid, idToken);
      setIcerik((m) => ({ ...m, [u.id]: { sunum: 0, duvar: 0, ekran: 0, nokta: 0 } }));
      setErr(n ? `${n} içerik silindi.` : "Silinecek içerik yok.");
    } catch (e) {
      setErr(studioHata(e, "Silinemedi."));
    } finally {
      setBusy(null);
    }
  }

  async function engelle(u: UserRecord, kapat: boolean) {
    setBusy(u.id);
    setErr(null);
    try {
      await setUserBlocked(u.id, kapat);
      refresh();
    } catch (e) {
      setErr(studioHata(e, "Değiştirilemedi."));
    } finally {
      setBusy(null);
    }
  }

  async function remove(u: UserRecord) {
    setBusy(u.id);
    setErr(null);
    try {
      await deleteUserRecord(u.id);
      refresh();
    } catch (e) {
      setErr(studioHata(e, "Silinemedi."));
    } finally {
      setBusy(null);
    }
  }

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

  // E-postasız kayıtlar GERÇEK KULLANICI DEĞİL: duvar yükleme sayfasının açtığı
  // anonim oturumlar, düzeltilen bir hata yüzünden panele girip kayıt düşmüştü.
  // Listede kullanıcı gibi durmaları kafa karıştırıyordu; ayrı gösterilip tek
  // tuşla temizlenirler (sessizce gizlemek, çöpü sonsuza kadar orada bırakırdı).
  const gercek = users.filter((u) => !isGhostRecord(u));
  const hayalet = users.filter(isGhostRecord);

  async function hayaletleriSil() {
    setBusy("hayalet");
    setErr(null);
    try {
      for (const u of hayalet) await deleteUserRecord(u.id);
      refresh();
    } catch (e) {
      setErr(studioHata(e, "Silinemedi."));
    } finally {
      setBusy(null);
    }
  }

  const fmt = (t?: { toDate?: () => Date } | null) =>
    t?.toDate ? t.toDate().toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg">←</Link>
          <Logo size="sm" variant="studio" />
          <span className="eyebrow hidden sm:inline">Yönetici paneli</span>
        </div>
        {/* Kırpma İÇ katmanda: çip esnek kutu, metni doğrudan üstüne "truncate"
            vermek üç nokta koymuyor, yazıyı kenardan makaslıyordu. */}
        <span className="chip text-muted text-xs min-w-0 max-w-[45vw]">
          <span className="truncate min-w-0">{user?.email}</span>
        </span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <AdminTabs />
        <h1 className="font-display text-3xl font-semibold tracking-tight">Kullanıcılar</h1>
        <p className="text-muted text-sm mb-6 tabular-nums">{gercek.length} kayıt · son görülene göre</p>

        {err && <div className="mb-4 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        {hayalet.length > 0 && (
          <div className="card p-4 mb-4 flex items-center gap-3 flex-wrap border-[#eda100]/40 bg-[#eda100]/[0.06]">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{hayalet.length} boş kayıt</p>
              <p className="text-muted text-xs">
                Anonim oturumdan kalma — gerçek kullanıcı değil, e-postaları yok. Silmek güvenli.
              </p>
            </div>
            <button
              onClick={() =>
                confirm(
                  {
                    title: "Boş kayıtları sil",
                    message: `${hayalet.length} kayıt silinecek. Bunlar anonim oturumlardan kalma; kimsenin hesabına dokunulmaz.`,
                    confirmLabel: "Sil",
                    danger: true,
                  },
                  () => void hayaletleriSil()
                )
              }
              disabled={busy === "hayalet"}
              className="!py-1.5 !px-3 text-xs rounded-full font-semibold border border-line text-brand hover:bg-brand-soft/40 cursor-pointer inline-flex items-center justify-center gap-1 shrink-0"
            >
              <Icon name="trash" size={13} /> Temizle
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {gercek.map((u) => {
            const isBootstrap = u.email === ADMIN_EMAIL;
            const isSelf = u.id === user?.uid;
            const admin = isBootstrap || u.role === "admin";
            return (
              <div key={u.id} className={`card p-4 flex items-center gap-3.5 flex-wrap ${u.blocked ? "opacity-70 border-[#eda100]/50" : ""}`}>
                {u.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photoURL} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-accent-soft grid place-items-center font-bold text-accent shrink-0">
                    {(u.displayName || u.email || "?").charAt(0).toLocaleUpperCase("tr-TR")}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {u.displayName || "—"}
                    {admin && <span className="ml-2 chip !py-0 text-xs text-accent"><Icon name="shield" size={12} /> yönetici</span>}
                    {isSelf && <span className="ml-1.5 text-muted text-xs">(sen)</span>}
                    {u.blocked && <span className="ml-2 chip !py-0 text-xs text-[#8a6100] border-[#eda100]/50"><Icon name="lock" size={12} /> kapalı</span>}
                  </p>
                  <p className="text-muted text-sm truncate">{u.email}</p>
                  <p className="text-muted text-xs mt-0.5">
                    Kayıt: {fmt(u.createdAt)} · Son görülme: {fmt(u.lastSeenAt)}
                  </p>
                  {/* İçerik özeti: "bu kişiyi kapatırsam/silersem arkada ne kalıyor?"
                      sorusunun cevabı. İstenince yüklenir (kişi başına dört sorgu). */}
                  {icerik[u.id] ? (
                    <div className="mt-1">
                      <p className="text-muted text-xs tabular-nums">
                        {icerik[u.id].sunum} sunum · {icerik[u.id].duvar} duvar · {icerik[u.id].ekran} ekran · {icerik[u.id].nokta} nokta
                      </p>
                      {!isSelf && icerik[u.id].sunum + icerik[u.id].duvar + icerik[u.id].nokta > 0 && (
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          <button
                            onClick={() =>
                              confirm(
                                {
                                  title: "İçeriği devral",
                                  message: `${u.email} kişisinin sunum, duvar ve nabız noktaları SANA geçer. Hiçbir şey silinmez; linkler ve kodlar aynı kalır.`,
                                  confirmLabel: "Devral",
                                },
                                () => void devral(u)
                              )
                            }
                            disabled={busy === u.id}
                            className="!py-1 !px-2.5 text-[11px] rounded-full font-semibold border border-line text-muted hover:text-ink hover:border-ink/30 cursor-pointer"
                          >
                            Devral
                          </button>
                          <button
                            onClick={() =>
                              confirm(
                                {
                                  title: "Tüm içeriğini sil",
                                  message: `${u.email} kişisinin sunum, duvar ve nabız noktaları KALICI olarak silinir (medya dosyaları dahil). Geri alınamaz.\nFlowSign ekranları buna dahil değil — onları "Sign yetkileri"nden yönet.`,
                                  confirmLabel: "Sil",
                                  danger: true,
                                },
                                () => void icerigiSil(u)
                              )
                            }
                            disabled={busy === u.id}
                            className="!py-1 !px-2.5 text-[11px] rounded-full font-semibold border border-line text-brand hover:bg-brand-soft/40 cursor-pointer"
                          >
                            Tüm içeriğini sil
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => void icerikSay(u.id)}
                      disabled={icerikBusy === u.id}
                      className="text-accent text-xs mt-1 font-semibold hover:underline cursor-pointer"
                    >
                      {icerikBusy === u.id ? "Sayılıyor…" : "İçeriğini göster"}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0 flex-col sm:flex-row">
                  {!isBootstrap && (
                    <button
                      onClick={() =>
                        confirm(
                          {
                            title: u.role === "admin" ? "Yöneticilikten al" : "Yönetici yap",
                            message: u.role === "admin" ? `${u.email} yöneticilikten alınacak.` : `${u.email} yönetici yetkisi alacak.`,
                            confirmLabel: u.role === "admin" ? "Yetkiyi al" : "Yönetici yap",
                          },
                          () => void toggleRole(u)
                        )
                      }
                      disabled={busy === u.id}
                      className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border cursor-pointer inline-flex items-center justify-center gap-1 ${
                        admin ? "border-line text-muted hover:text-ink" : "border-accent text-accent hover:bg-accent-soft/50"
                      }`}
                    >
                      {admin ? "Yöneticiliği kaldır" : <><Icon name="shield" size={13} /> Yönetici yap</>}
                    </button>
                  )}
                  {!isBootstrap && !isSelf && (
                    <button
                      onClick={() =>
                        confirm(
                          {
                            title: u.blocked ? "Erişimi aç" : "Erişimi kapat",
                            message: u.blocked
                              ? `${u.email} kokpite tekrar girebilecek.`
                              : `${u.email} kokpite giremeyecek. İçerikleri DURUR; perde/izleyici linkleri çalışmaya devam eder.`,
                            confirmLabel: u.blocked ? "Aç" : "Kapat",
                          },
                          () => void engelle(u, !u.blocked)
                        )
                      }
                      disabled={busy === u.id}
                      className="!py-1.5 !px-3 text-xs rounded-full font-semibold border border-line text-muted hover:text-ink hover:border-ink/30 cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Icon name={u.blocked ? "eye" : "lock"} size={13} /> {u.blocked ? "Erişimi aç" : "Erişimi kapat"}
                    </button>
                  )}
                  {!isBootstrap && !isSelf && (
                    <button
                      onClick={() =>
                        confirm(
                          {
                            title: "Kaydı sil",
                            message: `${u.email} kaydı silinecek.\nGoogle hesabı silinmez; tekrar giriş yaparsa kayıt yeniden oluşur. İçerikleri (sunum/duvar) bu işlemde silinmez.`,
                            confirmLabel: "Sil",
                            danger: true,
                          },
                          () => void remove(u)
                        )
                      }
                      disabled={busy === u.id}
                      className="!py-1.5 !px-3 text-xs rounded-full font-semibold border border-line text-brand hover:bg-brand-soft/40 cursor-pointer inline-flex items-center justify-center gap-1"
                    >
                      <Icon name="trash" size={13} /> Sil
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {gercek.length === 0 && (
            <p className="text-muted text-center py-12">
              Henüz kayıt yok. Kullanıcılar giriş yaptıkça burada listelenir.
            </p>
          )}
        </div>


      </section>

      {dialog}
    </main>
  );
}
