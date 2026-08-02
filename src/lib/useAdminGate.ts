"use client";

/**
 * Yönetici kapısı — prova/simülatör sayfaları için tek kaynak.
 *
 * Bu sayfalar eskiden `?k=<gizli anahtar>` ile korunuyordu; anahtar istemci
 * paketinin içinde olduğu için kapı değil, yalnızca bir yavaşlatıcıydı. Artık
 * gerçek kimlik kontrolü var: bootstrap e-posta VEYA users kaydında role=admin
 * (rules de sunucuda aynı kuralı uygular).
 */
import { useEffect, useState } from "react";
import { useAuthUser } from "./hooks";
import { ADMIN_EMAIL, getUserRecord, isAdminUser } from "./users";

/** null = henüz belli değil (ekranı bekletmek için), true/false = karar. */
export function useAdminGate(): boolean | null {
  const { user, loading } = useAuthUser();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setAllowed(false);
      return;
    }
    if (user.email === ADMIN_EMAIL) {
      setAllowed(true);
      return;
    }
    getUserRecord(user.uid)
      .then((r) => setAllowed(isAdminUser(user, r)))
      .catch(() => setAllowed(false));
  }, [user, loading]);

  return allowed;
}
