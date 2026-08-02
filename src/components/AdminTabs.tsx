"use client";

/** Yönetici paneli sekmeleri — sayfalar arası tek gezinme çubuğu. */
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Kullanıcılar" },
  { href: "/admin/sign", label: "Sign yetkileri" },
  { href: "/admin/stats", label: "İstatistikler" },
  { href: "/admin/prova", label: "Prova & sağlık" },
] as const;

export default function AdminTabs() {
  const path = usePathname();
  return (
    <div className="flex gap-1.5 mb-6 overflow-x-auto">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`chip !py-1.5 shrink-0 whitespace-nowrap ${
              active ? "!bg-ink !text-white !border-ink" : "text-muted hover:border-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
