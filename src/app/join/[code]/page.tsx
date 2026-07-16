"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { resolveJoinCode } from "@/lib/presentations";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveJoinCode(code)
      .then((presentationId) => {
        if (cancelled) return;
        if (presentationId) router.replace(`/p/${presentationId}`);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      {notFound ? (
        <>
          <p className="text-2xl font-semibold mb-2">Sunum bulunamadı</p>
          <p className="text-muted mb-6">
            <span className="font-mono">{code}</span> koduna ait aktif bir sunum yok.
          </p>
          <Link
            href="/"
            className="bg-ink hover:bg-black text-white font-medium px-5 py-3 rounded-2xl"
          >
            Kodu tekrar gir
          </Link>
        </>
      ) : (
        <p className="text-muted text-lg animate-pulse">Sunuma bağlanılıyor…</p>
      )}
    </main>
  );
}
