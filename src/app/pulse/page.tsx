"use client";

/**
 * FlowPulse — nokta listesi + oluştur. Nokta = fiziksel geri bildirim konumu
 * ("Yemekhane çıkışı"). Kokpit AYDINLIK ürün (Meter ailesi); kiosk/pano koyu.
 * Liste = noktalar arası karşılaştırma: bugünkü skor yan yana (v4).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { SkelBox, SkelCards } from "@/components/Skeleton";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { useAuthUser } from "@/lib/hooks";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { createPulse, deletePulse, listPulses, percentOf, watchToday } from "@/lib/pulses";
import { scoreColor, scoreEmoji } from "@/components/pulse/shared";
import { Pulse, PulseDay, PulseQuestionType } from "@/lib/types";

const TYPES: { id: PulseQuestionType; label: string; hint: string }[] = [
  { id: "smiley", label: "😐 Yüz (1–5)", hint: "Klasik memnuniyet — yemekhane, servis, tuvalet" },
  { id: "nps", label: "🔢 NPS (0–10)", hint: "Tavsiye eder misin?" },
  { id: "yesno", label: "👍 Evet / Hayır", hint: "Hızlı tek soru" },
  { id: "choice", label: "☑ Çoktan seçmeli", hint: "Seçenekli mini anket" },
];

function TodayScore({ pulse }: { pulse: Pulse }) {
  const [day, setDay] = useState<PulseDay | null>(null);
  useEffect(() => watchToday(pulse.id, setDay), [pulse.id]);
  const pct = percentOf(pulse.question.type, day);
  const below = !!pulse.threshold && pct !== null && pct < pulse.threshold;
  if (pulse.question.type === "choice")
    return <span className="text-muted text-sm tabular-nums">{day?.total ?? 0} oy bugün</span>;
  if (pct === null) return <span className="text-muted text-sm">Bugün henüz oy yok</span>;
  return (
    <span className={`inline-flex items-center gap-2 font-display font-bold text-xl tabular-nums ${below ? "text-brand" : ""}`} style={below ? undefined : { color: scoreColor(pct) }}>
      {scoreEmoji(pct)} %{pct}
      <span className="text-muted text-xs font-normal">bugün · {day?.total ?? 0} oy</span>
      {below && <span className="chip !py-0.5 text-brand text-[10px]">eşik altı!</span>}
    </span>
  );
}

export default function PulseListPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const playTarget = usePlayTarget();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [title, setTitle] = useState("");
  const [qType, setQType] = useState<PulseQuestionType>("smiley");
  const [qText, setQText] = useState("Bugünkü deneyiminden memnun kaldın mı?");
  const [qOptions, setQOptions] = useState("");
  const [busy, setBusy] = useState(false);
  /** ÇİFT TIKLAMA KİLİDİ — ref, state DEĞİL: state bir sonraki çizimde geçerli
   *  olduğundan hızlı iki dokunuş ikisi de "boşta" görüp iki kayıt açıyordu. */
  const creatingRef = useRef(false);

  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (user) setPulses(await listPulses(user.uid));
  }, [user]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1")
      window.setTimeout(() => titleRef.current?.focus(), 120);
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!user || creatingRef.current) return;
    const options = qOptions.split(",").map((s) => s.trim()).filter(Boolean);
    if (qType === "choice" && (options.length < 2 || options.length > 11)) {
      setErr(options.length > 11 ? "En fazla 11 seçenek olabilir." : "Çoktan seçmeli için virgülle en az 2 seçenek yaz.");
      return;
    }
    creatingRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const q: Pulse["question"] = { type: qType, text: qText.trim() || "Memnun kaldın mı?" };
      if (qType === "choice") q.options = options;
      const id = await createPulse(user.uid, title.trim() || "Yeni nokta", q);
      router.push(`/pulse/${id}/manage`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nokta oluşturulamadı, tekrar dene.");
      creatingRef.current = false; // hata → tekrar denenebilsin
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Pulse) {
    // Silme sunucuda saniyeler sürüyor — başlarken "siliniyor…", bitince "silindi".
    setErr(null);
    setDeletingId(p.id);
    show(`"${p.title}" siliniyor…`, "busy");
    try {
      await deletePulse(p.id);
      await refresh();
      show("Nokta silindi");
    } catch (e) {
      show(e instanceof Error ? e.message : "Silme başarısız.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !user)
    return (
      <main className="min-h-screen bg-wash">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <SkelBox className="h-8 w-44 mb-6" />
          <SkelBox className="h-36 w-full !rounded-2xl mb-8" />
          <SkelCards count={2} />
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Panele dön">←</Link>
          <Logo variant="pulse" />
        </div>
        <span className="chip text-muted min-w-0 max-w-[45vw]"><span className="truncate">{user.email}</span></span>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Nabız noktaların</h1>
        <p className="text-muted text-sm mb-6">Kiosk ya da QR ile sürekli geri bildirim topla; trendleri kokpitte izle. Oylar tamamen anonimdir.</p>

        {err && <div className="mb-5 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        {/* Oluştur */}
        <form onSubmit={create} className="card p-5 mb-8 flex flex-col gap-4">
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nokta adı (ör. Yemekhane çıkışı)"
            className="input-base font-semibold placeholder:font-normal"
          />
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button type="button" key={t.id} onClick={() => setQType(t.id)} title={t.hint} className={`chip cursor-pointer ${qType === t.id ? "!bg-ink !text-white !border-ink" : "hover:border-muted"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Soru metni" className="input-base" />
          {qType === "choice" && (
            <input value={qOptions} onChange={(e) => setQOptions(e.target.value)} placeholder="Seçenekler — virgülle ayır (ör. Çorba, Ana yemek, Tatlı)" className="input-base" />
          )}
          <button type="submit" disabled={busy} className="btn-accent self-end px-6">＋ Nokta oluştur</button>
        </form>

        {pulses.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-5xl mb-4" aria-hidden>📡</p>
            <p>Henüz nokta yok. İlkini oluştur, kioskı duvara as.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            {pulses.map((p) => (
              <li key={p.id} className={`card p-4 flex flex-col gap-3 transition-opacity ${deletingId === p.id ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display font-semibold truncate">{p.title}</p>
                    <p className="text-muted text-xs mt-0.5 truncate">{p.question.text}</p>
                  </div>
                  <button
                    onClick={() =>
                      confirm(
                        { title: "Noktayı sil", message: `"${p.title}" noktası ve TÜM oy geçmişi silinecek. Bu işlem geri alınamaz.`, confirmLabel: "Sil", danger: true },
                        () => remove(p)
                      )
                    }
                    className="btn-icon text-brand hover:text-brand-dark shrink-0"
                    title="Sil"
                    aria-label="Sil"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                <TodayScore pulse={p} />
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/pulse/${p.id}/manage`} className="btn-primary !py-2 !px-4 text-sm">Kokpit</Link>
                  <a href={`/pulse/${p.id}/kiosk`} target={playTarget} className="btn-ghost !py-2 !px-4 text-sm">🖥 Kiosk{playTarget ? " ↗" : ""}</a>
                  <a href={`/pulse/${p.id}/board`} target={playTarget} className="btn-ghost !py-2 !px-4 text-sm">📊 Pano{playTarget ? " ↗" : ""}</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog}
      {toast}
    </main>
  );
}
