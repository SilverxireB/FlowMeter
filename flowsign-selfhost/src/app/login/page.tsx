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
    <main className="min-h-screen grid place-items-center bg-[#0d102f] text-white px-4">
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col items-center gap-5">
        <Image src="/logo.png" alt="FlowSign" width={160} height={48} className="h-10 w-auto" priority />
        <p className="text-white/50 text-sm text-center">Ekranları yönetmek için yönetici parolasını gir.</p>
        <input
          autoFocus
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Yönetici parolası"
          className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 focus:outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/30"
        />
        {err && <p className="text-rose-300 text-sm font-semibold">{err}</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="w-full rounded-xl bg-accent hover:bg-accent-dark text-white px-6 py-3 font-semibold disabled:opacity-50"
        >
          {busy ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </main>
  );
}
