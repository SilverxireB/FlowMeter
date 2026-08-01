/** İzleyici yüzeyi dili — kokpit hep Türkçe; yalnız katılımcı ekranları çevrilir. */
export type AudienceLang = "tr" | "en";
let lang: AudienceLang = "tr";
export function setAudienceLang(l: AudienceLang | undefined): void {
  lang = l === "en" ? "en" : "tr";
}
/** t("Türkçe", "English") — çağrı anında aktif dile göre döner. */
export function t(tr: string, en: string): string {
  return lang === "en" ? en : tr;
}
