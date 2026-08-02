/**
 * KANTİN kural sınavı — kuralları Firebase Console'a yapıştırmadan ÖNCE çalıştır.
 *
 * Kurallar kullanıcıya elle yapıştırılıyor: yanlış kural üretim ortamında
 * "sipariş verilemiyor" olarak görünür ve sebebi ekranda yazmaz. Bu takım o
 * körlüğü kapatır — sipariş açma, mahremiyet, rol yükseltme, günlük tavan,
 * kuyruk sayacı ve gün tutarlılığı gerçek emülatörde sınanır.
 *
 * Çalıştırmak için (depoya bağımlılık EKLENMEDİ — geçici kurulum):
 *   mkdir -p /tmp/kr && cd /tmp/kr && npm init -y
 *   npm i firebase-tools @firebase/rules-unit-testing firebase
 *   cp <depo>/firestore.rules <depo>/tests/kantin-rules.test.mjs .
 *   echo '{"firestore":{"rules":"firestore.rules"},"emulators":{"firestore":{"port":8181},"ui":{"enabled":false}}}' > firebase.json
 *   echo '{"type":"module"}' > package.json
 *   npx firebase emulators:exec --project demo-kantin "node kantin-rules.test.mjs"
 *
 * Son durum: 47 sınav, hepsi geçiyor.
 */
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, increment, writeBatch } from "firebase/firestore";
import fs from "node:fs";

const env = await initializeTestEnvironment({
  projectId: "demo-kantin",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8181 },
});

const d = new Date();
const GUN = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DUN = (() => { const x = new Date(Date.now() - 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
const ESKI = "2020-03-04";

let gecti = 0, kaldi = 0;
const t = async (ad, fn) => {
  try { await fn(); console.log("  ok   " + ad); gecti++; }
  catch (e) { console.log("  FAIL " + ad + "  → " + (e.message || e).split("\n")[0]); kaldi++; }
};

// Seed: kişiler + kantin + menü (kurallar devre dışıyken)
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "kantinUsers/ali"), { ad: "Ali Yıldız", sicil: "1234", email: "ali@x.com", rol: "personel" });
  await setDoc(doc(db, "kantinUsers/veli"), { ad: "Veli Kaya", sicil: "5678", email: "veli@x.com", rol: "personel" });
  await setDoc(doc(db, "kantinUsers/gorevli"), { ad: "Gör Evli", sicil: "9", email: "g@x.com", rol: "kantinci", kantinId: "k1" });
  await setDoc(doc(db, "kantinUsers/yasakli"), {
    ad: "Yasak Lı", sicil: "77", email: "y@x.com", rol: "personel",
    yasakBitis: new Date(Date.now() + 3 * 864e5),
  });
  await setDoc(doc(db, "kantin/k1"), { ad: "A Kantini", acik: true });
  await setDoc(doc(db, "kantin/k2"), { ad: "B Kantini", acik: true });
  await setDoc(doc(db, "kantin/kapali"), { ad: "Kapalı", acik: false });
});

const ali = env.authenticatedContext("ali", { email: "ali@x.com" }).firestore();
const veli = env.authenticatedContext("veli", { email: "veli@x.com" }).firestore();
const gorevli = env.authenticatedContext("gorevli", { email: "g@x.com" }).firestore();
const yasakli = env.authenticatedContext("yasakli", { email: "y@x.com" }).firestore();
const admin = env.authenticatedContext("adm", { email: "doganbaharozu@gmail.com" }).firestore();
const misafir = env.unauthenticatedContext().firestore();

const siparis = (over = {}) => ({
  uid: "ali", ad: "Ali Yıldız", sicil: "1234",
  satirlar: [{ urunId: "u1", ad: "Tost", adet: 1, fiyat: 30 }],
  toplamAdet: 1, durum: "yeni", gun: GUN,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  ...over,
});

console.log("\nSİPARİŞ AÇMA");
await t("geçerli sipariş (bugünün tarihi — int('08') sınavı)", () =>
  assertSucceeds(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_1`), siparis())));
await t("aynı kimlik ikinci kez → create değil update sayılır, reddedilir", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_1`), siparis())));
await t("2. sipariş (tavan içinde) geçer", () =>
  assertSucceeds(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_2`), siparis())));
await t("6. sipariş → günlük tavan reddeder", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_6`), siparis())));
await t("başkasının kimliğiyle sipariş reddedilir", () =>
  assertFails(setDoc(doc(veli, `kantin/k1/siparisler/ali_${GUN}_3`), siparis())));
await t("kendi uid'i ama başkasının adı/sicili reddedilir", () =>
  assertFails(setDoc(doc(veli, `kantin/k1/siparisler/veli_${GUN}_1`),
    siparis({ uid: "veli", ad: "Ali Yıldız", sicil: "1234" }))));
await t("kendi doğru kimliğiyle geçer", () =>
  assertSucceeds(setDoc(doc(veli, `kantin/k1/siparisler/veli_${GUN}_1`),
    siparis({ uid: "veli", ad: "Veli Kaya", sicil: "5678" }))));
await t("durum 'hazir' başlatılamaz", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_3`), siparis({ durum: "hazir" }))));
await t("cihaz saati kaymış → çok eski gün reddedilir", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${ESKI}_1`), siparis({ gun: ESKI }))));
await t("dün (±1 gün tolerans) kabul edilir", () =>
  assertSucceeds(setDoc(doc(ali, `kantin/k1/siparisler/ali_${DUN}_1`), siparis({ gun: DUN }))));
await t("createdAt elle atılamaz (sunucu damgası şart)", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_4`),
    siparis({ createdAt: new Date(2020, 1, 1) }))));
await t("kapalı kantine sipariş reddedilir", () =>
  assertFails(setDoc(doc(ali, `kantin/kapali/siparisler/ali_${GUN}_1`), siparis())));
await t("yasaklı kişi sipariş veremez", () =>
  assertFails(setDoc(doc(yasakli, `kantin/k1/siparisler/yasakli_${GUN}_1`),
    siparis({ uid: "yasakli", ad: "Yasak Lı", sicil: "77" }))));
await t("misafir (girişsiz) sipariş veremez", () =>
  assertFails(setDoc(doc(misafir, `kantin/k1/siparisler/x_${GUN}_1`), siparis())));
await t("fazla satır (11) reddedilir", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_5`),
    siparis({ satirlar: Array.from({ length: 11 }, () => ({ urunId: "u", ad: "x", adet: 1, fiyat: 1 })), toplamAdet: 11 }))));
await t("bilinmeyen alan reddedilir", () =>
  assertFails(setDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_5`), siparis({ odendi: true }))));

console.log("\nSİPARİŞ OKUMA (mahremiyet)");
await t("kişi kendi siparişini okur", () =>
  assertSucceeds(getDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_1`))));
await t("başkasının siparişini OKUYAMAZ", () =>
  assertFails(getDoc(doc(veli, `kantin/k1/siparisler/ali_${GUN}_1`))));
await t("kendi kantininin görevlisi okur", () =>
  assertSucceeds(getDoc(doc(gorevli, `kantin/k1/siparisler/ali_${GUN}_1`))));
await t("yönetici okur", () =>
  assertSucceeds(getDoc(doc(admin, `kantin/k1/siparisler/ali_${GUN}_1`))));

console.log("\nDURUM DEĞİŞTİRME");
await t("görevli durumu 'hazirlaniyor' yapar", () =>
  assertSucceeds(updateDoc(doc(gorevli, `kantin/k1/siparisler/ali_${GUN}_1`),
    { durum: "hazirlaniyor", updatedAt: serverTimestamp() })));
await t("görevli ad/sicil değiştiremez", () =>
  assertFails(updateDoc(doc(gorevli, `kantin/k1/siparisler/ali_${GUN}_1`),
    { durum: "hazir", ad: "Başkası", updatedAt: serverTimestamp() })));
await t("BAŞKA kantinin görevlisi dokunamaz", () =>
  assertFails(updateDoc(doc(gorevli, `kantin/k2/siparisler/x_${GUN}_1`), { durum: "hazir" })));
await t("kişi hazırlanmaya başlanmış siparişi iptal edemez", () =>
  assertFails(updateDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_1`),
    { durum: "iptal", updatedAt: serverTimestamp() })));
await t("kişi 'yeni' siparişini iptal eder", () =>
  assertSucceeds(updateDoc(doc(ali, `kantin/k1/siparisler/ali_${GUN}_2`),
    { durum: "iptal", updatedAt: serverTimestamp() })));
await t("kişi kendini 'hazir' yapamaz", () =>
  assertFails(updateDoc(doc(veli, `kantin/k1/siparisler/veli_${GUN}_1`),
    { durum: "hazir", updatedAt: serverTimestamp() })));
await t("başkasının siparişini iptal edemez", () =>
  assertFails(updateDoc(doc(veli, `kantin/k1/siparisler/ali_${DUN}_1`),
    { durum: "iptal", updatedAt: serverTimestamp() })));

console.log("\nGÜN SAYACI (kuyruk)");
await t("sipariş + sayaç tek batch'te geçer", () => {
  const b = writeBatch(ali);
  b.set(doc(ali, `kantin/k1/siparisler/ali_${GUN}_5`), siparis());
  b.set(doc(ali, `kantin/k1/gunler/${GUN}`), { toplam: increment(1), acik: increment(1) }, { merge: true });
  return assertSucceeds(b.commit());
});
await t("sayaç bir yazımda +1'den fazla artırılamaz", () =>
  assertFails(setDoc(doc(veli, `kantin/k1/gunler/${GUN}`), { toplam: increment(50) }, { merge: true })));
await t("sayaç geri alınamaz (toplam düşürülemez)", () =>
  assertFails(setDoc(doc(veli, `kantin/k1/gunler/${GUN}`), { toplam: increment(-1) }, { merge: true })));
await t("teslimde açık sayısı -1 geçer", () =>
  assertSucceeds(setDoc(doc(gorevli, `kantin/k1/gunler/${GUN}`), { acik: increment(-1) }, { merge: true })));
await t("sayacı herkes okur (bekleme tahmini)", () =>
  assertSucceeds(getDoc(doc(veli, `kantin/k1/gunler/${GUN}`))));

console.log("\nKİŞİ KAYDI / ROL");
await t("kişi kendi kaydını personel olarak açar", () =>
  assertSucceeds(setDoc(doc(env.authenticatedContext("yeni", { email: "n@x.com" }).firestore(), "kantinUsers/yeni"),
    { ad: "Yeni Kişi", sicil: "42", email: "n@x.com", rol: "personel", createdAt: serverTimestamp() })));
await t("kişi kendini admin yapamaz", () =>
  assertFails(setDoc(doc(env.authenticatedContext("kotu", { email: "k@x.com" }).firestore(), "kantinUsers/kotu"),
    { ad: "Kötü", sicil: "1", email: "k@x.com", rol: "admin", createdAt: serverTimestamp() })));
await t("kişi rolünü sonradan yükseltemez", () =>
  assertFails(updateDoc(doc(ali, "kantinUsers/ali"), { rol: "admin" })));
await t("kişi kendi yasağını kaldıramaz", () =>
  assertFails(updateDoc(doc(yasakli, "kantinUsers/yasakli"), { yasakBitis: null })));
await t("kişi kendi adını düzeltebilir", () =>
  assertSucceeds(updateDoc(doc(ali, "kantinUsers/ali"), { ad: "Ali Yıldızlı" })));
await t("yönetici rol atar", () =>
  assertSucceeds(updateDoc(doc(admin, "kantinUsers/veli"), { rol: "kantinci", kantinId: "k2" })));
await t("kişi başkasının kaydını okuyamaz", () =>
  assertFails(getDoc(doc(ali, "kantinUsers/veli"))));
await t("yönetici kişileri okur", () =>
  assertSucceeds(getDoc(doc(admin, "kantinUsers/ali"))));

console.log("\nKANTİN / MENÜ");
await t("giriş yapan menüyü okur", () =>
  assertSucceeds(getDoc(doc(ali, "kantin/k1"))));
await t("girişsiz okuyamaz", () =>
  assertFails(getDoc(doc(misafir, "kantin/k1"))));
await t("personel menü yazamaz", () =>
  assertFails(setDoc(doc(ali, "kantin/k1/menu/u1"), { ad: "Bedava Tost", fiyat: 0 })));
await t("görevli menü yazar", () =>
  assertSucceeds(setDoc(doc(gorevli, "kantin/k1/menu/u1"), { ad: "Tost", fiyat: 30 })));
await t("görevli BAŞKA kantinin menüsünü yazamaz", () =>
  assertFails(setDoc(doc(gorevli, "kantin/k2/menu/u1"), { ad: "x", fiyat: 1 })));
await t("personel kantin açamaz", () =>
  assertFails(setDoc(doc(ali, "kantin/yeni"), { ad: "Sahte", acik: true })));
await t("yönetici kantin açar", () =>
  assertSucceeds(setDoc(doc(admin, "kantin/k3"), { ad: "C Kantini", acik: true })));

console.log(`\n${gecti} geçti, ${kaldi} kaldı\n`);
await env.cleanup();
process.exit(kaldi ? 1 : 0);
