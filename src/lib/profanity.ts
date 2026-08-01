/**
 * Küfür/hakaret süzgeci — TÜM açık uçlu metin girişlerinde (Meter sohbet/Q&A/
 * açık uçlu-kelime bulutu cevapları, Wall dilekleri, Pulse yorumları) gönderim
 * ANINDA istemcide uygulanır: uygunsuz kelime ilk harfi kalıp yıldızlanır
 * ("s***"). Engellemek yerine sansürlüyoruz — yanlış pozitif mesajı komple
 * yutmaz, akış durmaz; moderasyon (pending) ayrıca ikinci savunma hattı.
 * Türkçe ek aldığı için kökler ÖNEK olarak aranır; kısa/riskli olanlar tam
 * eşleşme listesinde (masum kelimeleri yakalamasın: "götürmek", "picture").
 */

// Tam eşleşme (token bazlı) — kısaltmalar ve ek almayan kalıplar
const EXACT = new Set([
  "amk", "aq", "amq", "awk", "oç", "mk", "sktr", "amkoyim", "göt",
  "piç", "yrrk",
]);

// Önek eşleşme — Türkçe ek alan kökler (≥4 harf; masum çakışma kontrol edildi)
const ROOTS = [
  "sikt", "sike", "siki", "sikm", "sikişt", "sikis", "sikiş",
  "orospu", "oruspu", "amcık", "amcik", "amcığ", "amcuk",
  "amına", "amina", "amını", "amini", "amınak",
  "yarak", "yarrak", "yarrağ", "yaraq",
  "pezeven", "kahpe", "kaltak", "gavat", "ibne", "ipne", "puşt",
  // DİKKAT: "götü"/"göte" önek OLMAZ — "götür(mek)" masum kelimesini yakalar.
  "yavşak", "yavsak", "götver", "götlek",
  "piçl", "piçk", "orosbu",
  "fuck", "bitch", "asshole", "motherf", "cunt", "nigg", "whore", "slut",
];

/** Leet/maskeleme normalizasyonu: s1kt1r, @mk, s!ktir vb. da yakalansın. */
function normalize(token: string): string {
  return token
    .toLocaleLowerCase("tr")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/(.)\1{2,}/g, "$1$1"); // "siiiiktir" → "siiktir" (abartı tekrar kırp)
}

function tokenBad(token: string): boolean {
  const n = normalize(token);
  const nn = n.replace(/(.)\1+/g, "$1"); // tüm tekrarları da tek harfe indir
  for (const t of [n, nn]) {
    if (EXACT.has(t)) return true;
    for (const r of ROOTS) if (t.startsWith(r)) return true;
  }
  return false;
}

/** Metindeki uygunsuz kelimeleri "ilk harf + yıldız" ile maskeler. */
export function censorText(text: string): string {
  // Harf gruplarını (Türkçe dahil) token kabul et; araya nokta/boşluk serpilmiş
  // maskeleme ("s.i.k.t.i.r") için birleşik hali de ayrıca kontrol edilir.
  const masked = text.replace(/\p{L}+/gu, (w) => (tokenBad(w) ? w[0] + "*".repeat(Math.max(2, w.length - 1)) : w));
  const glued = normalize(text.replace(/[^\p{L}]+/gu, ""));
  if (masked === text && glued.length <= 24 && tokenBad(glued)) {
    // Kısa mesajın tamamı harf-arası maskeli küfürse hepsini yıldızla
    return text.replace(/\p{L}/gu, "*");
  }
  return masked;
}

export function hasProfanity(text: string): boolean {
  return censorText(text) !== text;
}
