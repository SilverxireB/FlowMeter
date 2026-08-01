"use client";

/**
 * İskelet (yükleniyor) yüzeyleri. Eskiden her kokpit ortada tek bir
 * "Yükleniyor…" yazısıyla bekletiyordu: sayfa bir anda boştan doluya
 * sıçradığı için hem beklerken ne geleceği belirsizdi hem de içerik gelince
 * düzen zıplıyordu. İskelet, gelecek düzenin ölçüsünü baştan ayırır.
 *
 * `prefers-reduced-motion` açıkken parıltı animasyonu global CSS kuralıyla
 * zaten duruyor (globals.css).
 */

/** Tek gri blok. */
export function SkelBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink/[0.07] ${className}`} />;
}

/** Koyu yüzeyler (Sign/Wall perde kokpiti) için. */
export function SkelBoxDark({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />;
}

/** Kart ızgarası iskeleti (hub sunum/duvar listeleri). */
export function SkelCards({ count = 4, dark = false }: { count?: number; dark?: boolean }) {
  const Box = dark ? SkelBoxDark : SkelBox;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl border ${dark ? "border-white/10" : "border-line bg-white"} overflow-hidden`}>
          <Box className="!rounded-none aspect-video w-full" />
          <div className="p-4 flex flex-col gap-2.5">
            <Box className="h-4 w-2/3" />
            <Box className="h-3 w-1/3" />
            <div className="flex gap-2 pt-1">
              <Box className="h-9 w-20 !rounded-full" />
              <Box className="h-9 w-24 !rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Kokpit iskeleti: başlık + birkaç kart bloğu. */
export function SkelCockpit({ dark = false }: { dark?: boolean }) {
  const Box = dark ? SkelBoxDark : SkelBox;
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
      <Box className="h-8 w-56" />
      <Box className="h-24 w-full !rounded-2xl" />
      <Box className="h-40 w-full !rounded-2xl" />
      <Box className="h-32 w-full !rounded-2xl" />
    </div>
  );
}
