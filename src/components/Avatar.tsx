"use client";

import { adventurer } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import { useMemo } from "react";

/** Seed'den deterministik SVG avatar üretir — tamamen client-side, dış servis yok. */
export function avatarUri(seed: string): string {
  const svg = createAvatar(adventurer, {
    seed,
    backgroundColor: ["ffe4e6", "dbeafe", "fef3c7", "dcfce7", "ede9fe", "cffafe"],
  }).toString();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function Avatar({
  seed,
  size = 32,
  className = "",
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const uri = useMemo(() => avatarUri(seed), [seed]);
  // eslint-disable-next-line @next/next/no-img-element -- data URI, next/image gereksiz
  return (
    <img
      src={uri}
      width={size}
      height={size}
      alt=""
      aria-hidden
      className={`rounded-full ${className}`}
    />
  );
}
