"use client";

/**
 * Yönetici girişi — tek parola (.env SIGN_ADMIN_PASSWORD). Yayın (perde)
 * linkleri giriş istemez; bu kapı yalnız kokpit içindir.
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(d?.error ?? "Giriş başarısız — parolayı kontrol et.");
        return;
      }
      router.replace("/screens");
    } catch {
      setErr("Sunucuya ulaşılamadı — bağlantıyı kontrol et.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-wash px-4">
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col items-center gap-5">
        {/* Marka dili ana ürünle aynı: O-halkası ikonu + kısa ad ("FLOW" yalnız çatıda) */}
        <span className="inline-flex items-center gap-2" role="img" aria-label="FlowSign">
          <Image src="/logo.png" alt="" width={160} height={48} className="h-9 w-auto" priority />
          <span aria-hidden className="font-display font-semibold text-[34px] leading-none tracking-[0.03em] text-[#001e64]">SIGN</span>
        </span>
        <p className="text-muted text-sm text-center">Ekranları yönetmek için yönetici parolasını gir.</p>
        <input
          autoFocus
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Yönetici parolası"
          className="input-base"
        />
        {err && <p className="text-brand text-sm font-semibold">{err}</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="w-full btn-primary"
        >
          {busy ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
