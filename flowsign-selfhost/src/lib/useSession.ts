"use client";

/**
 * Yönetici oturumu kancası — online sürümdeki `useAuthUser` karşılığı.
 * /api/auth/me çerezi doğrular; oturum yoksa sayfa /login'e yönlendirir.
 */
import { useEffect, useState } from "react";

export function useSession() {
  const [state, setState] = useState<{ loading: boolean; authed: boolean }>({ loading: true, authed: false });
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setState({ loading: false, authed: Boolean(d.ok) }))
      .catch(() => alive && setState({ loading: false, authed: false }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
