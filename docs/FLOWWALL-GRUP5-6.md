# FlowWall — Grup 5 & 6 Uygulama Spesifikasyonu (devir dokümanı)

> Bu dosya, FlowWall yol haritasının **Grup 5 (Hatıra çıktıları)** ve **Grup 6
> (Foto yarışması + oylama)** özelliklerini, başka bir geliştiricinin/AI'nın
> sıfırdan uygulayabileceği ayrıntıda tarifler. Mevcut kod desenlerine dayanır.
> Önce **"0. Bağlam & uyulacak kurallar"** bölümünü oku.

---

## 0. Bağlam & uyulacak kurallar (ZORUNLU)

**Mimari (mevcut, değiştirme):**
- **Medya byte'ları Cloudinary'de**, metadata/oturum/moderasyon/rules **Firebase
  Firestore**'da. Cloudinary yalnız FlowWall'a özel istisnadır (kurumsal FlowMeter'a
  sıçramaz).
- Gerçek zamanlı: **her zaman `onSnapshot`**, asla polling.
- **Dış servis yok** (CDN, 3. parti font/script). npm ile bundle edilen kütüphane
  (jsPDF, JSZip) serbest — o "dış servis" değildir. Cloudinary + firestore.googleapis.com
  + kendi domain dışına ağ isteği YOK.
- **Türkçe UI, İngilizce kod.**
- **Firestore rules değişince** kullanıcıya TAM `firestore.rules` metni verilir
  (konsola elle yapıştırıyor). Grup 5 rules gerektirmez; Grup 6 gerektirir.
- Push öncesi **`npm run build`** zorunlu (temiz geçmeli).
- Dosya haritası `docs/SITEMAP.md`, fazlar `docs/ROADMAP.md`, plan `docs/FLOWWALL.md`
  — değişince güncelle.

**Ölçek kuralı (KRİTİK — 500 kişi):** Misafir telefonları **büyük koleksiyonları
dinlemesin**. Perde (tek cihaz) her şeyi dinleyebilir; misafir yalnız kendi
verisini + gerekli minimumu dinler. Bkz. mevcut `watchWallMediaByVoter`,
`watchWallMediaRecent`. Grup 6'da oy koleksiyonunu **misafir DİNLEMEZ** (yalnız
perde + kokpit dinler); misafir sadece kendi oyunu yazar/okur.

**Yararlı mevcut yardımcılar:**
- `src/lib/cloudinary.ts`: `cldThumb(url,w,h)` (kare c_fill), `cldFit(url,w)`
  (oranı koru), `cldVideoPoster(url,w,h)` (video ilk kare jpg), `isCloudinaryConfigured()`.
- `src/lib/walls.ts`: setter/watcher desenleri (`updateDoc` + `serverTimestamp`,
  `onSnapshot` + `orderBy`), `getVoterId()` (responses.ts, localStorage UUID).
- `src/lib/hooks.ts`: `useWall`, `useWallMedia`, `useWallWishes`, `useWallMediaByVoter`
  desenleri.
- `src/lib/types.ts`: `Wall`, `WallMedia` (`likes`, `status`, `nickname`, `voterId`,
  `createdAt`), `WallWish`.
- **Canvas ile PNG üretimi örneği**: `src/components/WallQrCard.tsx` (2× ölçek,
  `document.fonts.ready`, roundRect, tema renkleri). Kolaj bunu birebir örnek alır.
- **ZIP örneği**: `src/app/wall/[id]/manage/page.tsx` içindeki `downloadAll` (JSZip).
- **Perde overlay örneği (periyodik + takeover)**: `WallTopLoved.tsx`, `WallMilestone.tsx`,
  `WallAnnouncement.tsx` (z-50 overlay, iç zamanlayıcı, `prefers-reduced-motion`).
- **Kokpit**: `/wall/[id]/manage/page.tsx` (kart deseni `.card p-5`, chip butonlar).
- **Misafir**: `/u/[id]/page.tsx` (sekme çubuğu: Yükle | Gez | Dilek — buna sekme
  eklenecek). **Reaksiyon çubuğu** `WallReactionBar` her sekmede altta sabit.
- **Perde**: `/wall/[id]/page.tsx` (mod dispatcher + overlay'ler + `WallEffectLayer`).

**CORS notu (kolaj + PDF için önemli):** Cloudinary görselleri canvas'a çizip
`toDataURL`/`getImageData` alınacaksa `img.crossOrigin = "anonymous"` şart, aksi
halde canvas "tainted" olur ve export patlar. Cloudinary CORS'a izin verir. Her
görsel yüklemesini `try/catch` + `onerror` ile sarmala; yüklenemeyeni atla.

---

## Grup 5 — Hatıra çıktıları

Rules **gerektirmez** (yalnız mevcut veriyi okur, client-side üretir, Firestore'a
yazmaz).

### 5A. Otomatik kolaj / kapak (PNG)

**Amaç:** Etkinliğin özetini tek görselde toplayan, sahibinin indirebileceği şık
bir kolaj/kapak (fotoğraf ızgarası + başlık + istatistik + marka).

**Dosyalar:**
- YENİ `src/components/WallCollage.tsx` → `export async function downloadCollage(wall: Wall, media: WallMedia[], opts?: { format?: "square"|"story"|"poster"; count?: number }): Promise<void>`
- DÜZENLE `src/app/wall/[id]/manage/page.tsx` → "🖼 Kolaj indir" butonu (+ opsiyonel format seçimi).

**Tasarım (canvas, WallQrCard'ı örnek al):**
1. Boyut (2× ölçek): `square` 2000×2000, `story` 1080×1920, `poster` 1600×2000.
   Başlangıç için `square` yeterli; format chip'i opsiyonel.
2. Arka plan: `getWallPreset(wall.theme?.preset)` renginden (bkz. themes.ts) veya
   koyu gradient. Tema-duyarlı (dark/light).
3. Üst şerit: etkinlik başlığı (`wall.headline || wall.title`) + küçük "FLOWWALL"
   eyebrow (WallQrCard'daki `drawSpaced` ile).
4. Fotoğraf ızgarası: `count` (varsayılan 24) foto. **Seçim:** önce en çok beğenilen
   (`likes` desc), sonra en yeniler ile doldur; tekrarsız. Yalnız `status==="approved"`.
5. Izgara yerleşimi: kare hücreler, `cldThumb(m.url, cell*2, cell*2)` (video ise
   `cldVideoPoster`). `crossOrigin="anonymous"` + `Promise.all` ile hepsini yükle,
   sonra `roundRect` clip + `drawImage` (c_fill zaten kare kırpar). Aralarında ~10px
   boşluk. Hücre sayısı foto sayısına göre uyum (ör. 24 foto → 4×6; az foto → 3×N).
6. Alt şerit: istatistik — `"{approvedCount} anı · {participants} kişi · ❤ {totalLikes}"`
   (kokpitteki `stats` hesabıyla aynı). + küçük "flowwall" marka.
7. `canvas.toBlob` → indir (`flowwall-kolaj-{joinCode}.png`). Dosya adı ve indirme
   WallQrCard'daki gibi.

**Edge:** foto yoksa buton disabled / "Henüz anı yok". Yüklenemeyen görsel → o hücre
boş/temaya uygun placeholder. `document.fonts.ready` beklenir.

**Kabul kriterleri:** Kokpitten tek tıkla, tema renginde, en sevilen+yeni fotoların
ızgarası + başlık + istatistik içeren keskin (2×) bir PNG iner; CORS hatasında
çökmez (eksik foto atlanır).

---

### 5B. Hatıra kitabı (PDF — "anı defteri")

**Amaç:** Tüm foto + dilekleri şık sayfalara dizen, paylaşılabilir bir A4 PDF.

**Bağımlılık:** `jspdf` (npm ile ekle: `package.json`). Bundle edilir, dış servis
değil. (JSZip zaten var; istersen büyük görselleri PDF'e gömmek için yeterli.)

**Dosyalar:**
- YENİ `src/lib/wallMemoryBook.ts` → `export async function generateMemoryBook(wall: Wall, media: WallMedia[], wishes: WallWish[], onProgress?: (done: number, total: number) => void): Promise<void>`
- DÜZENLE `/wall/[id]/manage/page.tsx` → "📖 Hatıra kitabı (PDF)" butonu + ilerleme metni (ZIP butonundaki `zipMsg` desenini örnek al).

**Tasarım (jsPDF, A4 portrait, birim mm; `new jsPDF({ unit:"mm", format:"a4" })`):**
1. **Kapak sayfası:** tema renginde dolgu (`doc.setFillColor` + `doc.rect(0,0,210,297,'F')`),
   ortada başlık, tarih (`wall.createdAt`), istatistik, "FLOWWALL". (Metin rengi
   tema dark/light'a göre.)
2. **Fotoğraf sayfaları:** sayfa başına 6 foto (2 sütun × 3 satır) grid; her fotonun
   altına yükleyen `nickname`. Foto verisi: `cldFit(m.url, 900)` (video → `cldVideoPoster`)
   → `fetch` → `blob` → `FileReader.readAsDataURL` → `doc.addImage(dataUrl,'JPEG',x,y,w,h)`.
   En-boy oranını koru (media.w/h varsa kullan; yoksa görseli yükleyip ölç).
   Yalnız `approved`. **Sınır:** performans/boyut için en fazla ~120 foto (en sevilen
   öncelik, sonra yeni). `onProgress` ile "12/120 hazırlanıyor…".
3. **Dilek sayfaları:** onaylı dilekler (`status==='approved'`) tipografik liste —
   "💌 {text} — {nickname}". Sayfa dolunca `doc.addPage()`.
4. **Arka sayfa:** "flowwall" marka + duvara QR (qrcode ile dataURL üretip addImage;
   WallQrCard'da QR üretimi mevcut).
5. `doc.save('flowwall-ani-defteri-{joinCode}.pdf')`.

**Edge:** görsel indirilemezse atla (say + logla). Büyük PDF uyarısı ("~50 foto
önerilir"). Bellek: object URL kullanılırsa `revokeObjectURL`. Buton çift tıklamaya
karşı `busy` state.

**Kabul kriterleri:** Kokpitten üretilir; kapak + foto sayfaları (nickname'li) +
dilek sayfaları + arka kapak içeren bir PDF iner; ilerleme gösterilir; birkaç
görsel yüklenemese de PDF tamamlanır.

---

## Grup 6 — Foto yarışması + oylama

**En kapsamlı özellik.** Yarışma **moderasyondan (kokpit) başlatılır**; misafirler
aday fotolara oy verir; kazanan perdede taçlanır. FlowMeter oylama fikrinin
FlowWall'a köprüsü.

### 6.0 Akış özeti
1. Sahip kokpitten yarışmayı başlatır (başlık/soru + opsiyonel süre). Adaylar =
   varsayılan tüm onaylı fotolar (dinamik).
2. Misafir `/u/[id]`'de **🏆 Yarışma** sekmesinde adayları görür, **bir** fotoya oy
   verir (oyunu değiştirebilir).
3. Perde, yarışma açıkken periyodik **canlı sıralama** (ilk 3) gösterir.
4. Sahip "Bitir & kazananı ilan et" der → perde **🏆 Kazanan** takeover'ı + kutlama.

### 6.1 Veri modeli

**Wall dokümanına** (owner-write, mevcut kural yeterli — `firestore.rules`'ta
`walls/{id}` update owner):
```ts
// types.ts → Wall arayüzüne ekle:
contest?: {
  id: string;              // her yeni yarışmada yeni (crypto.randomUUID) — eski oylar sayılmaz
  title: string;           // "En iyi kostüm" vb.
  status: "running" | "ended";
  startedAt: Timestamp | null;
  endedAt?: Timestamp | null;
  winnerMediaId?: string;  // bitişte sahip yazar
} | null;
```

**Oylar — ayrı alt koleksiyon** `walls/{id}/contestVotes/{voterId}`:
```ts
// types.ts:
export interface ContestVote {
  id: string;        // = voterId (doc id) → kişi başı tek oy
  mediaId: string;
  contestId: string; // yalnız aktif contest.id sayılır
  createdAt: Timestamp | null;
}
```
- Doc id = `voterId` → kişi başı tek oy (participants deseni). Oyu değiştirmek = aynı
  dokümanı update.
- `contestId` alanı: eski yarışmanın oyları yeni yarışmada sayılmaz (tally filtreler).

### 6.2 Firestore rules (DEĞİŞİR — tam metin kullanıcıya verilecek)

`walls/{wallId}` altına, `wishes` bloğunun yanına ekle:
```
// Yarışma oyları: misafir KENDİ oyunu yazar (doc id = voterId). Aktif yarışmanın
// contestId'si zorunlu. Silme (temizlik) sadece sahibinde.
match /contestVotes/{voterId} {
  function wall() { return get(/databases/$(database)/documents/walls/$(wallId)).data; }
  allow read: if true;
  allow create, update: if request.resource.data.keys().hasOnly(['mediaId','contestId','createdAt'])
    && request.resource.data.mediaId is string
    && wall().get('contest', null) != null
    && wall().contest.get('status','') == 'running'
    && request.resource.data.contestId == wall().contest.id;
  allow delete: if request.auth != null
    && get(/databases/$(database)/documents/walls/$(wallId)).data.ownerId == request.auth.uid;
}
```
> Not: kimlik anonim olduğundan "başkasının doc'unu yazma" tam engellenemez (tüm
> FlowWall anonim modeli böyle); doc-id = voterId dedup + contestId kapısı yeterli.
> Rules değişince `firestore.rules` TAM metni kullanıcıya ver.

### 6.3 walls.ts fonksiyonları
```ts
export async function startContest(id, title) →
  updateDoc(wall, { contest: { id: crypto.randomUUID(), title, status:"running",
    startedAt: serverTimestamp(), winnerMediaId: null } });
  // + eski oyları temizle: deleteAllDocs(["walls",id,"contestVotes"]) (mevcut helper)

export async function endContest(id, winnerMediaId) →
  updateDoc(wall, { "contest.status":"ended", "contest.endedAt": serverTimestamp(),
    "contest.winnerMediaId": winnerMediaId });

export async function clearContest(id) → updateDoc(wall, { contest: null });
  // + oyları temizle.

export async function castContestVote(id, contestId, mediaId) →
  setDoc(doc(walls,id,"contestVotes",getVoterId()),
    { mediaId, contestId, createdAt: serverTimestamp() }); // merge gerekmez (tam yaz)
  // localStorage'a da yaz ki misafir kendi oyunu anında bilsin: `flowwall.vote.{contestId}` = mediaId

export function watchContestVotes(id, cb) →
  onSnapshot(collection(walls,id,"contestVotes"), snap => cb(snap.docs.map(...)));
  // YALNIZ perde + kokpit kullanır. Misafir KULLANMAZ (ölçek).

export function getMyContestVote(contestId): string | null // localStorage'dan
```

### 6.4 hooks.ts
```ts
export function useContestVotes(id) // perde+kokpit; onSnapshot → ContestVote[]
```

### 6.5 Tally (ortak yardımcı)
```ts
// aktif contestId'ye ait oyları mediaId'ye göre say, azalan sırala:
function tallyVotes(votes: ContestVote[], contestId: string): { mediaId: string; count: number }[]
// eşitlik: yüksek oy; eşitse en eski createdAt'li media önce (deterministik).
```

### 6.6 Kokpit (`/wall/[id]/manage`) — Yarışma kartı
- Yarışma **yokken**: başlık input + "🏆 Yarışma başlat" (startContest). Kısa açıklama.
- Yarışma **running**: 
  - Canlı sıralama (tally, `useContestVotes` — kokpit tek cihaz, tüm oyları okuyabilir).
    İlk N media küçük thumbnail + oy sayısı.
  - "Bitir & kazananı ilan et" → `endContest(id, lider.mediaId)` (tally'den lider).
  - "İptal" → `clearContest`.
- Yarışma **ended**: kazanan gösterilir + "Yeni yarışma" / "Kapat".

### 6.7 Misafir (`/u/[id]`) — 🏆 Yarışma sekmesi
- Sekme yalnız `wall.contest?.status === "running"` iken görünür (Yükle | Gez | Dilek | 🏆 Yarışma).
- Adaylar: onaylı medya (mevcut `watchWallMediaRecent(id, 150)` ile — misafir zaten
  Gez için bunu kullanıyor; aynı sınırlı akış). Masonry/ızgara.
- Her fotoya "Oy ver" butonu; misafirin mevcut oyu (localStorage `getMyContestVote`)
  vurgulanır. Tıkla → `castContestVote(id, wall.contest.id, mediaId)`; oyu değiştir
  desteklenir. "✓ Oyun alındı" geri bildirimi.
- **Misafir tüm oyları DİNLEMEZ** (ölçek): sonuç/lider perdede. İstenirse yalnız
  kendi oyu gösterilir. (Canlı sonuç istenirse ayrı bir "sonuç" ekranı sadece perde.)

### 6.8 Perde (`/wall/[id]`) — yarışma gösterimi
İki parça, `WallContest.tsx` (z-50 overlay, WallTopLoved/WallAnnouncement deseni):
1. **running** iken periyodik **canlı sıralama interlude'u** (ör. 90 sn'de bir, 10 sn):
   "🏆 {title}" + ilk 3 foto (oy sayılarıyla, #1 büyük + 👑). Tally `useContestVotes`
   (perde tek cihaz). Yeterli oy yoksa ("henüz oy yok") gösterme.
2. **ended** olduğunda (winnerMediaId set): büyük **🏆 Kazanan!** takeover — kazanan
   foto ortada, konfeti (mevcut `Confetti` kullanılabilir), "{title} · {oy} oy",
   yükleyen nickname. Birkaç saniye/ kalıcı (sahip kapatana / yeni yarışmaya kadar).
- Perde ayrıca `wall.contest` üzerinden durumu bilir (zaten `useWall`).
- Katılımı teşvik için perdede küçük kalıcı rozet: "🏆 Yarışma açık — telefondan oy ver".

### 6.9 Edge case'ler
- Eşitlik: tally sırası deterministik (yüksek oy, sonra en eski media). Sahip
  bitişte lideri yazar; istenirse manuel kazanan seçimi de eklenebilir (v2).
- Oysuz bitiş: winnerMediaId boş → perde "yeterli oy olmadı".
- Yeni yarışma: `startContest` eski oyları siler + yeni `contestId` → eski oylar
  tally'de zaten filtrelenir (çift güvenlik).
- Aday foto silinirse: tally'de o mediaId kalır ama medya bulunamaz → gösterimde atla.
- Moderasyon: yalnız `approved` medya aday. Pending olan oy alamaz (misafir sekmesi
  onaylıları listeler).

### 6.10 Dosya listesi (Grup 6)
- DÜZENLE `src/lib/types.ts` (Wall.contest, ContestVote)
- DÜZENLE `src/lib/walls.ts` (start/end/clear/castVote/watch + `deleteAllDocs` reuse)
- DÜZENLE `src/lib/hooks.ts` (useContestVotes)
- YENİ `src/lib/contest.ts` (opsiyonel: tally + localStorage helper'ları)
- DÜZENLE `firestore.rules` (contestVotes bloğu) → **tam metin kullanıcıya**
- YENİ `src/components/wall/WallContest.tsx` (perde overlay)
- DÜZENLE `src/app/wall/[id]/page.tsx` (WallContest bağla)
- DÜZENLE `src/app/wall/[id]/manage/page.tsx` (Yarışma kartı)
- DÜZENLE `src/app/u/[id]/page.tsx` (🏆 Yarışma sekmesi)
- GÜNCELLE `docs/{SITEMAP,ROADMAP,FLOWWALL}.md`

### 6.11 Kabul kriterleri
- Sahip kokpitten yarışma başlatır; misafir sekmede aday fotoları görüp oy verir
  (kişi başı tek, değiştirilebilir); perde canlı ilk 3'ü periyodik gösterir; sahip
  bitirince perdede kazanan foto konfetiyle taçlanır.
- **Ölçek:** 500 misafirde misafir telefonları oy koleksiyonunu DİNLEMEZ (yalnız
  kendi oyunu yazar/localStorage okur); tally yalnız perde + kokpitte.
- `npm run build` temiz; rules tam metni kullanıcıya verildi.

---

## Genel sıra önerisi
1. **5A Kolaj** (en hızlı, rules yok, WallQrCard'ı kopyala-uyarla).
2. **5B PDF** (jsPDF ekle; kolajdaki görsel-yükleme mantığını yeniden kullan).
3. **6 Yarışma** (en büyük; rules + 3 yüzey + ölçek dikkati).

Her biri ayrı commit + ayrı push + (rules değişen) tam rules metni.
