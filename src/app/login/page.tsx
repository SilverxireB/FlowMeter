"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Giriş başarısız.");
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    withBusy(() =>
      mode === "signin"
        ? signInWithEmailAndPassword(auth(), email, password)
        : createUserWithEmailAndPassword(auth(), email, password)
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-center mb-1">FlowMeter</h1>
        <p className="text-slate-500 text-center text-sm mb-6">
          {mode === "signin" ? "Hesabına giriş yap" : "Yeni hesap oluştur"}
        </p>

        <button
          onClick={() => withBusy(() => signInWithPopup(auth(), new GoogleAuthProvider()))}
          disabled={busy}
          className="w-full border border-slate-300 hover:bg-slate-50 rounded-lg py-3 font-medium mb-4"
        >
          Google ile devam et
        </button>

        <div className="flex items-center gap-3 mb-4">
          <hr className="flex-1 border-slate-200" />
          <span className="text-slate-400 text-xs">veya</span>
          <hr className="flex-1 border-slate-200" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta"
            className="rounded-lg border border-slate-300 px-3 py-3 focus:outline-none focus:border-brand-blue"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            className="rounded-lg border border-slate-300 px-3 py-3 focus:outline-none focus:border-brand-blue"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-brand-blue hover:bg-blue-600 disabled:opacity-40 text-white font-semibold rounded-lg py-3"
          >
            {mode === "signin" ? "Giriş yap" : "Kayıt ol"}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm mt-3 text-center">{error}</p>}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-brand-blue text-sm mt-4"
        >
          {mode === "signin" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
        </button>
      </div>
    </main>
  );
}
