"use client";

/**
 * Oturum kancası — online sürümdeki `useAuthUser` karşılığı. /api/auth/me
 * çerezi doğrular VE oturum sahibini döndürür (yetki düğmeleri buna bakar);
 * oturum yoksa sayfa /login'e yönlendirir.
 */
import { useEffect, useState } from "react";
import { PublicUser } from "./types";

export function useSession() {
  const [state, setState] = useState<{ loading: boolean; authed: boolean; me: PublicUser | null }>({
    loading: true,
    authed: false,
    me: null,
  });
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; user?: PublicUser | null }) => alive && setState({ loading: false, authed: Boolean(d.ok), me: d.user ?? null }))
      .catch(() => alive && setState({ loading: false, authed: false, me: null }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
