"use client";

/**
 * Giriş ekranındaki canlı sahne.
 *
 * NEDEN VAR: Giriş, çoğu kişinin uygulamayı ilk gördüğü yer. Boş bir form
 * "bu ne işe yarıyor?" sorusunu cevaplamıyordu. Sahne tek bir şeyi anlatır ve
 * bunu METİNLE DEĞİL, göstererek yapar: sipariş verilir → hazırlanır → hazır olur.
 * Döngü ~7 saniye; molanın kendisi kadar kısa.
 *
 * Kurallar: dış servis yok, resim yok — hepsi CSS. `prefers-reduced-motion`
 * açıkken tüm hareket durur ve sahne son karede (hazır) durur; animasyona
 * duyarlı kullanıcı için bilgi kaybı olmaz.
 *
 * Stil `dangerouslySetInnerHTML` ile basılır: React, `<style>` içindeki
 * kesme işaretini `&#x27;` diye kaçırıyor, tarayıcı ham metinde bunu ÇÖZMÜYOR
 * ve sunucu/istemci metni ayrıştığı için hidrasyon çöküyordu (aynı ders
 * StudioHero'da alındı).
 */

const CSS = `
@keyframes k-adim {
  0%, 22%   { --p: 0%;   }
  30%, 52%  { --p: 55%;  }
  60%, 92%  { --p: 100%; }
  100%      { --p: 0%;   }
}
@keyframes k-bar   { 0%,22%{width:6%} 30%,52%{width:55%} 60%,100%{width:100%} }
@keyframes k-rozet { 0%,55%{opacity:0;transform:translateY(5px)} 62%,92%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes k-yaz1  { 0%,26%{opacity:1} 30%,100%{opacity:0} }
@keyframes k-yaz2  { 0%,26%{opacity:0} 30%,56%{opacity:1} 60%,100%{opacity:0} }
@keyframes k-yaz3  { 0%,56%{opacity:0} 62%,92%{opacity:1} 100%{opacity:0} }
@keyframes k-buhar { 0%{opacity:0;transform:translateY(0) scaleX(1)} 25%{opacity:.55} 100%{opacity:0;transform:translateY(-26px) scaleX(1.5)} }
@keyframes k-sek   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }

.k-bar    { animation: k-bar 7s ease-in-out infinite; }
.k-rozet  { animation: k-rozet 7s ease-in-out infinite; }
.k-yaz1   { animation: k-yaz1 7s ease-in-out infinite; }
.k-yaz2   { animation: k-yaz2 7s ease-in-out infinite; }
.k-yaz3   { animation: k-yaz3 7s ease-in-out infinite; }
.k-buhar  { animation: k-buhar 3.2s ease-out infinite; }
.k-sek    { animation: k-sek 3.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .k-bar   { animation: none; width: 100%; }
  .k-rozet { animation: none; opacity: 1; transform: none; }
  .k-yaz1, .k-yaz2 { animation: none; opacity: 0; }
  .k-yaz3  { animation: none; opacity: 1; }
  .k-buhar, .k-sek { animation: none; opacity: .35; }
}
`;

export default function KantinHero() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#001e64] to-[#4f46e5] text-white p-6 sm:p-7">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Arka plan halkaları — derinlik, dikkat çalmadan */}
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 w-52 h-52 rounded-full border border-white/10" />
      <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 w-44 h-44 rounded-full border border-white/8" />

      <p className="uppercase tracking-[0.2em] text-[11px] text-white/60">Kantin</p>
      <h2 className="font-display text-2xl sm:text-3xl font-semibold leading-tight mt-1">
        Molada sıra bekleme
      </h2>
      <p className="text-white/70 text-sm mt-1.5 max-w-xs">
        Siparişini telefondan ver, hazır olunca haber gelsin.
      </p>

      {/* Sahne: sipariş kartı + fincan */}
      <div className="relative mt-5 flex items-end gap-3">
        <div className="flex-1 min-w-0 rounded-2xl bg-white/12 border border-white/15 backdrop-blur px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate">Tost + 2 çay</span>
            <span className="relative w-20 h-5 shrink-0">
              <span className="k-yaz1 absolute inset-0 text-[11px] text-white/70 text-right leading-5">Alındı</span>
              <span className="k-yaz2 absolute inset-0 text-[11px] text-[#ffd88a] text-right leading-5">Hazırlanıyor</span>
              <span className="k-yaz3 absolute inset-0 text-[11px] text-[#7ef0c2] font-semibold text-right leading-5">Hazır</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/15 mt-2.5 overflow-hidden">
            <div className="k-bar h-full rounded-full bg-gradient-to-r from-white/70 to-[#7ef0c2]" style={{ width: "6%" }} />
          </div>
          {/* YÜKSEKLİK SABİT: rozet yalnız görünürlük değiştirir. Akışa girip
              çıksaydı kart her döngüde büyüyüp altındaki formu zıplatırdı. */}
          <div className="h-7 mt-2 flex items-center">
            <span className="k-rozet inline-flex items-center gap-1.5 rounded-full bg-[#1baf7a]/25 border border-[#7ef0c2]/40 px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7ef0c2]" />
              <span className="text-[11px] font-semibold text-[#7ef0c2]">Tezgâhtan alabilirsin</span>
            </span>
          </div>
        </div>

        {/* Fincan — buharı yükselir */}
        <div aria-hidden className="relative w-14 shrink-0 k-sek">
          <div className="absolute -top-6 left-0 right-0 flex justify-center gap-1.5">
            {[0, 0.9, 1.8].map((g, i) => (
              <span
                key={i}
                className="k-buhar block w-[3px] h-5 rounded-full bg-white/60"
                style={{ animationDelay: `${g}s` }}
              />
            ))}
          </div>
          <div className="relative">
            <div className="h-10 w-11 rounded-b-2xl rounded-t-md bg-white/85" />
            <span className="absolute right-[-7px] top-1.5 w-3.5 h-4 rounded-r-full border-[3px] border-l-0 border-white/85" />
          </div>
          <div className="h-1 w-14 rounded-full bg-white/40 mt-1" />
        </div>
      </div>
    </div>
  );
}
