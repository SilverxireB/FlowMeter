# FlowMeter / FlowWall — Teknik Denetim Raporu

> Tarih: 2026-07-22 · Kapsam: Next.js 14 + Firebase Firestore + Cloudinary katmanı,
> FlowWall (walls/*) ve FlowMeter oylama/quiz mantığı, `firestore.rules`, API route.
> Yöntem: statik kod okuması (çalıştırma/deploy yok). Satır numaraları inceleme
> anındaki dosya durumuna aittir.

---

## 1. Özet

Kod tabanı olgun, iyi yorumlanmış ve mimari açıdan tutarlı: realtime `onSnapshot`
her yerde doğru kullanılıyor, ölçek bilinci var (misafir telefonu tüm koleksiyonu
dinlemiyor), tasarım sistemi disiplinli. Ancak **anonim misafir modeli sunucu
tarafında neredeyse hiç doğrulanmıyor**: FlowWall'da 6 haneli kod kaba kuvvetle
bulunabilir ve kimlik doğrulaması olmadan Firestore'a doğrudan medya/oy/dilek
yazılabilir — bu, canlı bir etkinlikte perdenin ele geçirilmesi (defacement) ve
yarışma/quiz oy hilesi anlamına gelir. İkinci ağırlık merkezi **veri yaşam
döngüsü**: duvar silindiğinde Cloudinary dosyaları ve alt koleksiyonlar sızıyor.
Quiz puanlaması istemci saatine güveniyor ve mükerrer oy engeli yalnız istemcide.
Görsel katman (perde modları, PDF/kolaj) sağlam; kritik hatalar veri/güvenlik
katmanında yoğunlaşıyor.

Bulgu sayısı: **0 SHOWSTOPPER · 3 MAJOR · 4 HIGH · 7 MEDIUM.**

---

## 2. İyi Yönler

- **Realtime disiplini:** `hooks.ts` boyunca `onSnapshot`, hiçbir yerde polling
  yok; dinleyiciler `useEffect` cleanup ile düzgün sökülüyor.
- **Ölçek bilinci:** `watchWallMediaByVoter` / `watchWallMediaRecent(150)` ile
  misafir telefonu tüm medyayı değil yalnız kendi + son 150'yi dinliyor
  (`walls.ts:357-372`). Yarışma oylarını yalnız perde+kokpit dinliyor.
- **XSS'e karşı dayanıklı:** Kullanıcı metni (headline, dilek, nickname) her yerde
  JSX text olarak render ediliyor; `dangerouslySetInnerHTML` yok → React kaçışı
  koruyor. Cloudinary URL dönüşümleri `isCld()` guard'ı ile korunuyor.
- **Sunucu-taraflı quiz penceresi:** `firestore.rules:128-135` süresi dolmuş
  quize oy kabul etmiyor (istemci saati/kurcalama pencereyi açamıyor). Doğru
  tasarım.
- **Silme güvenliği:** `/api/wall/destroy` idToken → uid → ownerId zincirini
  doğru kuruyor; secret istemciye inmiyor; imzalı destroy (`route.ts:46-89`).
- **Hata yutma çoğunlukla bilinçli:** PDF/ZIP/kolaj `fetch` hataları yakalanıp
  atlanıyor, CORS taint durumunda `useDominantColor` null'a düşüyor — çökme yok.
- **Font gömme:** Türkçe karakterler için jsPDF'e Plus Jakarta Sans repo içinden
  gömülüyor, başarısızlıkta helvetica'ya düşüyor (`wallMemoryBook.ts:34-56`).

---

## 3. Bug Listesi

### [MAJOR] Kod kaba kuvvetiyle kimliksiz medya enjeksiyonu — perde ele geçirme
`firestore.rules:164-177` · `src/lib/walls.ts:156-177`
- **Belirti/senaryo:** `media` create kuralı yalnız alan whitelist + `type`,
  `url is string`, `likes==0`, `status` kontrol ediyor; **kimlik doğrulaması yok,
  `url`/`cloudinaryId`'nin gerçekten Cloudinary'ye ait olduğu doğrulanmıyor, adet/
  boyut/rate limiti yok.** 6 haneli `joinCode` uzayı yalnız 10⁶ ve `resolveCode`
  ile kod→id çözülüyor. Saldırgan kodu kaba kuvvetle bulup Firestore'a doğrudan
  (dosya yüklemeden) istediği `url` ile yüzlerce medya dokümanı yazabilir.
  Moderasyon kapalıysa görseller **anında perdeye** düşer → düğün/kurumsal
  etkinlikte ekran ele geçirme.
- **Önerilen düzeltme:** Anonim-auth (Firebase Anonymous) + `request.auth != null`
  şartı; `url` için `url.matches('https://res.cloudinary.com/<cloud>/.*')` regex
  guard'ı; duvar başına toplam medya tavanı için sayaç/Cloud Function; imzalı
  yükleme (park edilmiş madde) öne alınmalı. Kısa vadede en azından `url` domain
  kısıtı + `nickname is string && size()<=30` eklenmeli.

### [MAJOR] Duvar silinince Cloudinary dosyaları ve alt koleksiyonlar sızıyor
`src/lib/walls.ts:121-127`
- **Belirti/senaryo:** `deleteWall` yalnızca `media` alt koleksiyonunu, joinCode'u
  ve wall dokümanını siliyor. **`reactions`, `wishes`, `contestVotes` alt
  koleksiyonları Firestore'da yetim kalıyor; Cloudinary'deki foto/video byte'ları
  hiç silinmiyor** (`/api/wall/destroy` sadece tek tek `hardDelete`'ten çağrılıyor,
  toplu silmede değil). Her silinen etkinlik Cloudinary kotasını (asıl darboğaz,
  bkz. FLOWWALL.md) kalıcı yiyor.
- **Önerilen düzeltme:** `deleteWall`'da media listesini silmeden önce her
  `cloudinaryId` için destroy çağır (veya Cloudinary `delete_by_prefix
  walls/{id}/` API route'u — FLOWWALL.md'de "TODO" olarak duruyor). Yetim alt
  koleksiyonları da `deleteAllDocs` ile temizle (reactions/wishes/contestVotes).

### [MAJOR] Mükerrer oy engeli yalnızca istemcide — quiz/MC/beğeni hilesi
`src/lib/responses.ts:47-65` · `src/lib/quizScores.ts:77-114` · `firestore.rules:137-143`
- **Belirti/senaryo:** `responses` create-only ama **kişi başı teklik zorlanmıyor**
  (doc id auto, voterId istemci localStorage'ı). Aynı voterId aynı slayta pencere
  içinde defalarca yazabilir. `computeQuizScores` her doğru dokümanı ayrı işliyor:
  aynı kişi 2 doğru gönderirse streak +2 ve puan iki katı (`quizScores.ts:103-113`).
  MC sonuçlarında da oy şişirme. Beğeni de (`likeMedia`) rules'ta yalnız "+1" sınırı
  var ama farklı `mediaId`'lere sınırsız; contestVotes'ta doc id istemci kontrollü
  voterId olduğundan farklı voterId'lerle sınırsız oy stuffing.
- **Önerilen düzeltme:** Oyları `responses/{voterId_slideId}` deterministik id +
  create-only yaparak kişi başı tek dokümana zorla (quiz/MC için); `computeQuizScores`
  içinde voterId başına ilk cevabı al (dedup). contestVotes zaten doc id=voterId
  ama kimliksiz olduğu için anonim-auth şart.

### [HIGH] Quiz "time" puanı istemci saatiyle tamamen sahtelenebilir
`src/components/vote/QuizVote.tsx:59` · `src/lib/quizScores.ts:97-102`
- **Belirti/senaryo:** `elapsed = Date.now() - startedMs` istemcide hesaplanıp
  `value[1]` olarak gönderiliyor. Rules yalnız **pencereyi** doğruluyor, gönderilen
  `elapsed` değerini değil. Saati ileri alan / isteği elle atan istemci `elapsed=0`
  (hatta negatif) yollar; `quizScores.ts:102` `Math.max(0, …)` ile 0'a kırpar →
  **her zaman 1000 puan**. Yani "hıza göre puan" modu güvenilir değil.
- **Önerilen düzeltme:** Süreyi sunucuda türet: `createdAt` (serverTimestamp) −
  `quizStartedAt` ile geçen süreyi puanlamada kullan; istemci `elapsed`'ini
  yalnızca gösterim için tut. Tam çözüm için puanlama bir Cloud Function'a taşınabilir.

### [HIGH] `joinCodes` — herhangi bir oturum açmış kullanıcı başkasının kodunu silebilir
`firestore.rules:232-236`
- **Belirti/senaryo:** `allow create, delete: if request.auth != null` — sahiplik
  kontrolü YOK. Oturum açmış herhangi bir presenter, **başka birinin**
  presentation/wall joinCode dokümanını silebilir (kod→hedef eşlemesi kopar,
  canlı etkinlik katılımı çöker) veya boşalan koda yeni eşleme yazabilir. DoS.
- **Önerilen düzeltme:** create'te payload'ı doğrula ve delete'i yalnız hedef
  dokümanın sahibine bağla (ör. `get(presentations/$(resource.data.presentationId)).data.ownerId
  == request.auth.uid`, wall için benzer). En azından delete'i `isAdmin()` veya
  sahiplik ile sınırla.

### [HIGH] `media` create — nickname doğrulanmıyor, doküman boyutu/sayısı sınırsız
`firestore.rules:169-177`
- **Belirti/senaryo:** Whitelist `nickname`'i içeriyor ama `nickname is string &&
  size()<=30` guard'ı YOK (deck `participants`/`messages` kurallarının aksine).
  Devasa/yanlış tipte nickname veya çok sayıda doküman yazılabilir; aynı boşluk
  `wishes` kuralında da var (`nickname` whitelist'te ama tip/uzunluk kontrolü yok,
  `rules:204`). Firestore doküman/koleksiyon şişmesi + moderasyon listesini bozma.
- **Önerilen düzeltme:** media ve wishes create kurallarına
  `request.resource.data.get('nickname','') is string` ve `size()<=30`; `url`/
  `cloudinaryId` için `size()` üst sınırı ekle.

### [HIGH] Reaction/beğeni yazma patlaması — sunucu tarafı rate limit yok
`src/lib/reactions.ts:7-17` · `src/lib/walls.ts:197-208` · `firestore.rules:58-66,190-197`
- **Belirti/senaryo:** Tepki ve beğeni gönderiminde rate limit yalnızca istemci
  değişkeninde (`lastSent`/`lastReactionSent`); `addDoc`'u doğrudan çağıran bir
  script bunu tümüyle atlar. 500 misafirlik etkinlikte kasıtlı spam Firestore
  yazma+perde okuma maliyetini uçurabilir (FLOWWALL.md de tepkileri "ana maliyet
  sürücüsü" sayıyor). Rules'ta yazma hızını sınırlamak mümkün değil.
- **Önerilen düzeltme:** Anonim-auth + App Check; tepkileri istemcide birleştirip
  (debounce/batch) tek dokümanda sayaç olarak tutmak; ya da Cloud Function ile
  throttle. En azından App Check zorunlu kılınmalı.

### [MEDIUM] Aynı anda birden çok tam-ekran z-50 "takeover" çakışıyor
`src/app/wall/[id]/page.tsx:194-201` · `WallTopLoved.tsx:35` · `WallMilestone.tsx:46` · `WallAnnouncement.tsx:28` · `WallContest.tsx:36,67`
- **Belirti/senaryo:** En Sevilenler turu, milestone, anons, yarışma tablosu/kazanan
  ve `/u` "duvarda göründün" kutlaması hepsi `z-50` tam ekran overlay. Zamanlayıcıları
  bağımsız; ör. milestone (7 sn) + En Sevilenler (10 sn) + anons aynı anda tetiklenince
  perdede üst üste biner, okunmaz kaos olur. Koordinasyon yok.
- **Önerilen düzeltme:** Tek bir "overlay yöneticisi" (öncelik kuyruğu) ile aynı
  anda tek takeover göster; diğerlerini kuyruğa al veya bastır.

### [MEDIUM] `usePagedPlayback` — video hem `onEnded` hem 12 sn timer ile ilerliyor
`src/app/wall/[id]/page.tsx:329-334,408,723`
- **Belirti/senaryo:** Video için `VIDEO_CAP_MS=12000` timer'ı VE `<video onEnded=
  {advance}>` birlikte var. 12 sn'den kısa videoda önce `onEnded` ilerletir (timer
  temizlenir) — sorun yok; ama uzun videoda 12 sn'de kesilir. Asıl risk: `onError=
  {advance}` + timer + yeni-medya-jump'ın aynı anda `advance` çağırıp bir fotoğrafı
  atlaması (nadir yarış). Davranış çoğunlukla doğru ama kırılgan.
- **Önerilen düzeltme:** Tek bir "ilerlet" kaynağı belirle: video modunda timer'ı
  kaldırıp yalnız `onEnded`/`onError` + bir güvenlik üst sınırı kullan; `advance`
  içinde son ilerleme zamanını kontrol ederek çift ilerlemeyi engelle.

### [MEDIUM] contestVotes — kimliksiz oy stuffing (doc id istemci kontrollü)
`firestore.rules:218-228` · `src/lib/walls.ts:299-306`
- **Belirti/senaryo:** Oy dokümanı id'si `getVoterId()` (localStorage UUID).
  Kural yolu `{voterId}`'yi auth/istemci ile eşleştirmiyor; saldırgan sonsuz farklı
  voterId ile `contestVotes/*` yazıp yarışmayı manipüle edebilir. "Kişi başı tek"
  yanılsaması yalnız dürüst istemci için geçerli.
- **Önerilen düzeltme:** Anonim-auth + `voterId == request.auth.uid` zorunluluğu.

### [MEDIUM] `walls/{id}` ve alt koleksiyonlar herkese açık okuma — metadata sızıntısı
`firestore.rules:155-168`
- **Belirti/senaryo:** `walls` read `if true`. wallId auto-id (tahmin zor) ama
  `joinCode` üzerinden çözülebiliyor. Herkes duvar dokümanını (ownerId, tema base64
  arka plan görseli — büyük okuma), tüm medya metadata + Cloudinary URL'lerini
  okuyabilir. Etkinlik "özel" olsa bile kod bilinince tüm içerik+URL dışa açık.
- **Önerilen düzeltme:** Tasarım gereği kısmen kabul; ancak `theme.bgImage` gibi
  ağır alanları ayrı dokümana taşı ve okuma maliyetini/sızıntıyı azalt. Uzun
  vadede "özel duvar" için token'lı erişim.

### [MEDIUM] Beğeni/oy — localStorage başarısız yazımda kilitleniyor
`src/lib/walls.ts:337-341` · `src/app/u/[id]/page.tsx:499-509`
- **Belirti/senaryo:** `likeMedia` önce `localStorage.setItem(...,"1")` sonra
  `updateDoc`. `updateDoc` hata verirse UI `liked`'i geri alsa da localStorage "1"
  kalır → `hasLikedMedia` true → kullanıcı bir daha beğenemez. Aynı desen
  `castContestVote`'ta (`walls.ts:299-301`): localStorage önce yazılıyor.
- **Önerilen düzeltme:** localStorage'ı yazmayı başarılı `await`'ten SONRA yap.

### [MEDIUM] `deleteAllDocs` büyük koleksiyonda tüm dokümanı belleğe çekiyor
`src/lib/walls.ts:35-43`
- **Belirti/senaryo:** `getDocs(collection)` ile TÜM medya/oy dokümanları tek
  seferde okunuyor (sayfalama yok). 1500+ medyalı bir duvarda silme/temizleme
  büyük okuma patlaması + olası bellek/timeout. `startContest`/`clearContest` de
  her çağrıda tüm contestVotes'u okuyor.
- **Önerilen düzeltme:** `query(..., limit(450))` döngüsüyle sayfalı sil; büyük
  temizlikleri Cloud Function'a taşı.

### [MEDIUM] Test tohumu sayfası prod'da canlı — dış URL'li medya + secret
`src/app/dev/seed-wall/[code]/page.tsx`
- **Belirti/senaryo:** `/dev/seed-wall/[code]?k=<SIM_SECRET>` prod build'e dahil.
  `SIM_SECRET` istemci bundle'ına giriyor (`@/lib/sim` import client component'te)
  → bundle'dan okunup herhangi bir duvara picsum/google örnek videolarıyla 20
  medya enjekte edilebilir. Ayrıca dış-URL medya, "dış servis yok" ruhuna aykırı
  test verisi perdeye düşürür.
- **Önerilen düzeltme:** Dev sayfalarını prod'dan tümüyle çıkar (env guard veya
  build-time exclude); secret'i istemciye koyma.

### [MEDIUM] SSR/hydration — `useState(() => Date.now())` sunucu/istemci uyuşmazlığı
`src/components/vote/QuizVote.tsx:22` · `WallAnnouncement.tsx:12` · `wall/[id]/manage/page.tsx:90`
- **Belirti/senaryo:** Client component'ler SSR'da da render edildiğinden
  `Date.now()` ilk değeri sunucuda hesaplanıp HTML'e giriyor, istemcide farklı →
  hydration uyuşmazlığı uyarısı (geri sayım/anons metni). İşlevsel çökme değil ama
  gürültü + olası ilk-frame yanlış değeri.
- **Önerilen düzeltme:** Zaman bağımlı değerleri `useEffect`'te set et (ilk render
  sabit/placeholder), ya da bu bileşenleri `dynamic(..., { ssr:false })` ile yükle.

---

## 4. Güvenlik Özel Bölümü

**Ana tema: anonim misafir modeli sunucuda doğrulanmıyor.** FlowWall bilinçli
olarak auth istemiyor (Altın Kural 1) ama bunun bedeli, Firestore rules'un
yalnız alan-şekli doğrulaması yapıp kimlik/oran/köken doğrulaması yapmamasıdır.
6 haneli kod kaba kuvvetle bulunabildiğinden aşağıdakiler kimliksiz mümkündür:

1. **Perde defacement** — doğrudan `media` dokümanı yazıp keyfi `url` ile
   perdeye görsel düşürmek (MAJOR, §3.1).
2. **Yarışma/quiz oy hilesi** — sınırsız voterId ile oy stuffing, mükerrer quiz
   cevabıyla puan şişirme (MAJOR §3.3, HIGH §3.4, MEDIUM §3 contestVotes).
3. **Maliyet saldırısı** — rate limit istemcide olduğundan tepki/beğeni spam'i
   (HIGH §3.7).
4. **joinCode DoS** — oturum açmış herhangi bir kullanıcı başkasının kodunu siler
   (HIGH §3.5).

**Önerilen güvenlik sertleştirme sırası (yüksek getiri → düşük):**
- **Firebase App Check** (reCAPTCHA/Play Integrity) — tüm anonim yazımlara köken
  doğrulaması; en az kodla en büyük etki (spam, defacement, brute-force kaba
  kuvvetini kırar).
- **Anonymous Auth** — `request.auth.uid` ile media/wish/contestVote/reaction
  yazımlarını bağla; contestVotes doc id = uid, self-delete de mümkün olur
  (FLOWWALL.md'de park edilmiş "guest self-delete" bununla çözülür).
- **url domain regex guard** + nickname/url boyut kontrolü (rules).
- **joinCodes delete'i sahipliğe bağla.**
- **İmzalı yükleme** (`/api/wall/sign`) — unsigned preset kötüye kullanımına karşı.

**XSS:** Aktif bir XSS bulgusu YOK — kullanıcı metni React ile kaçışlıyor,
`dangerouslySetInnerHTML` yok, `img src` keyfi string alsa da `javascript:` URI
modern tarayıcıda çalışmaz. Yine de `url` guard'ı (§3.1) defacement için gerekli.

**Admin bootstrap:** `firestore.rules:6-12` hardcoded e-posta + `role=admin`.
Makul; `users` create'te kendi kendine admin olma engellenmiş (`rules:18-19`). OK.

---

## 5. Öncelikli Aksiyon Sırası

1. **App Check + Anonymous Auth'u FlowWall yazımlarına ekle** — §3.1, §3.3, §3.7,
   contestVotes ve reaction spam'inin çoğunu tek hamlede kapatır. (En yüksek
   getiri.)
2. **`joinCodes` delete'i sahipliğe bağla** — §3.5, küçük rules değişikliği, canlı
   etkinlik DoS'unu kapatır.
3. **Duvar silme yaşam döngüsünü tamamla** — §3.2: Cloudinary `delete_by_prefix`
   API route + yetim alt koleksiyon temizliği. Kota sızıntısı sürekli birikiyor.
4. **Quiz puanını sunucu zaman damgasından türet + kişi başı tek oy** — §3.3, §3.4;
   quiz/MC bütünlüğü.
5. **rules alan guard'ları** — media/wishes nickname & url boyut/domain (§3.1, §3.6).
6. **Dev/seed sayfalarını prod'dan çıkar** — §3 (test tohumu).
7. **Overlay çakışması + playback yarışları + localStorage-önce yazım** — §3 MEDIUM
   grubu; UX/kırılganlık cilası.

---

### Ek Not — Kod Kalitesi (kısa)

- **Tip güvenliği iyi:** `types.ts` kapsamlı; `ResponseValue` birleşik tipi net.
  `d.data() as Wall` gibi cast'ler realtime'da kaçınılmaz, kabul edilebilir.
- **Tekrar:** Kod→id çözümü (`/^\d{6}$/` + `resolveCode`) 3+ sayfada kopyalanmış
  (`wall/[id]`, `u/[id]`, `dev/seed-wall`) — ortak bir `useResolvedWallId` hook'una
  çıkarılabilir. `mediaPoster`/`cldFit`/`cldThumb` seçimi de bileşenler arası
  tekrar ediyor.
- **Ölü/park kod:** `images.ts` `compressImage` `_quality` parametresi kullanılmıyor.
  FlowMeter `reactions.ts` 3 emoji gönderiyor ama rules 5 emojiye izin veriyor
  (uyumsuz değil, sadece geniş).
- **Yorumlar:** Olağanüstü iyi — her modül niyetini açıklıyor, bakım kolaylaştırıcı.
