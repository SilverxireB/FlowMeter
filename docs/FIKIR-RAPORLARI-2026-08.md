# Flow Studio — Fikir Üretim Raporları (4 Danışman)

*01.08.2026 — Dört ayrı bakış açısıyla üretilen tam raporlar. Özet ve önceliklendirme sohbette; burası ham malzeme.*

- **Rapor 1:** Yeni 5. ürün adayları (ürün stratejisti)
- **Rapor 2:** Mevcut ürünleri derinleştirme — rakip kıyaslı (ürün tasarımcısı)
- **Rapor 3:** FlowSign self-host / satılabilirlik denetimi (paketleme uzmanı)
- **Rapor 4:** Çapraz-ürün sinerjileri "1+1=3" (platform mimarı)

---

# RAPOR 1 — Yeni 5. Ürün Adayları

Suite'in yeniden kullanılabilir çekirdeği net: **(a)** 6 haneli kod / QR ile auth'suz katılım (`resolveCode` tek havuz), **(b)** perde/kiosk ekran disiplini (wake lock, PIN'li çıkış, `[color-scheme:dark]`, offline persistence), **(c)** onSnapshot realtime + günlük rollup kota deseni (Pulse `days/{yyyy-mm-dd}`), **(d)** create-only + rules ile anonim yazma güvenliği (Q&A upvote, wishes, votes desenleri), **(e)** moderasyon akışı, **(f)** "board'u Sign'a URL öğesi olarak göm" köprüsü (Pulse `/board` bunu kanıtladı), **(g)** profanity lib, ConfirmDialog, Logo variant sistemi. Yeni ürün bu çekirdeğin üstüne oturmalı; Sign'a kod bağı kurmamalı (yalnız URL embed serbest).

## 1. FlowQueue — Sıra/Çağrı Yönetimi
1. **Ad:** FlowQueue (O + "QUEUE")
2. **Ne:** QR/kioskla numara al, perdede "Sıradaki: 042 → Gişe 2" çağrısı; yönetici tek tuşla çağırır.
3. **Kim/ne zaman:** Fabrikada İK ofisi, revir, yemekhane ödeme noktası, sevkiyat rampasında şoför sırası; etkinlikte kayıt masası/foto kabini sırası. Şoför QR okutup kamyonunda bekler, perdede numarasını görür.
4. **Neden uyar:** Kiosk (numara al) = Pulse kiosk disiplini birebir; perde = Sign/Wall perde disiplini; ticket create = anonim create-only rules deseni; çağrı anı onSnapshot ile anında düşer. Board'u Sign'a URL olarak gömülür (rampa ekranı zaten Sign çalıştırıyorsa).
5. **MVP (1-2 gün):** `queues/{id}` + `tickets/{autoId}(no, status, createdAt)`; `/queue/[id]/kiosk` (Numara Al), `/queue/[id]/board` (public perde), `/queue/[id]/manage` (Çağır / Geldi / Gelmedi), telefonda `/queue/[id]/t/[no]` "kaç kişi önümde". Ses "ding" WebAudio (Meter'daki sentez deseni).
6. **Kota riski:** ÇOK DÜŞÜK. Ticket başına 1 create + 1-2 status update; 200 kişilik gün ≈ 600 yazma. Board dinleyicisi tek query (status=waiting/called, limit).
7. **Puan: 9/10** — küçük yüzey, net değer, her gün kullanılır.

## 2. FlowCheck — Denetim/Kontrol Listesi (5S, ekipman)
1. **Ad:** FlowCheck (O + "CHECK")
2. **Ne:** Ekipmana/alana yapıştırılan QR'dan telefonla doldurulan kontrol listesi; kokpitte eksikler ve günlük uyum trendi.
3. **Kim/ne zaman:** Forklift operatörü vardiya başı günlük kontrol; 5S saha turu; yangın tüpü aylık kontrol; etkinlikte kurulum checklist'i (sahne/ses/perde hazır mı).
4. **Neden uyar:** QR→auth'suz form = `/u` ve `/vote` deseni; günlük rollup = Pulse `days/` modeli kopyala-yapıştır; "başarısız madde" eşiği = Pulse threshold semantiği (yeşil/amber/gül); foto kanıt istenirse Cloudinary zaten var (ama MVP'de foto YOK — kota/kural sadeliği).
5. **MVP:** `checks/{id}(items[], schedule)` + `runs/{autoId}(answers, by?, createdAt)` + `days/` rollup; `/check/[id]/fill` (public), `/check/[id]/manage` (bugünkü durum + eksik listesi + 30g uyum %'si). İmza yerine ad-soyad serbest metin (anonim değil — Pulse'tan bilinçli fark).
6. **Kota riski:** DÜŞÜK. Run başına 1 create + 1 rollup increment. 50 ekipman × günde 3 vardiya = 300 yazma/gün.
7. **Puan: 9/10** — fabrikada regülasyon destekli gerçek ihtiyaç; kâğıt formun yerini alır. Risk: "kim doldurdu" kimlik doğrulaması zayıf (auth'suz), denetim kanıtı olarak hukuki değeri sınırlı — bunu bilerek "iç disiplin aracı" diye konumla.

## 3. FlowSpark — Öneri/Kaizen Kutusu
1. **Ad:** FlowSpark (O + "SPARK"; alternatif FlowIdea)
2. **Ne:** Dijital öneri kutusu: QR ile (anonim veya isimli) öneri gönder, yönetici durum atar (Alındı → Değerlendiriliyor → Uygulandı/Red), perde "bu ay uygulanan öneriler"i döndürür.
3. **Kim/ne zaman:** Fabrika kaizen programı — hat çalışanı molada QR okutup öneri yazar; ay sonunda yemekhane ekranında (Sign embed) uygulanan öneriler + teşekkür döner.
4. **Neden uyar:** Pulse'un anonim create-only + moderasyon + profanity (`lib/profanity.ts`) deseni birebir; durum akışı = Wall medya moderasyonu (pending/approved) genişletilmişi; perde bandı = Wall `WallWishes` dönen kart deseni.
5. **MVP:** `sparks/{id}` + `ideas/{autoId}(text, name?, area?, status, note)`; `/spark/[id]/send` (public form), `/spark/[id]/manage` (kanban-vari 4 kolon durum), `/spark/[id]/board` (uygulananlar perdesi, Sign'a gömülür). Ödül/puan sistemi MVP DIŞI.
6. **Kota riski:** İHMAL EDİLEBİLİR. Öneri hacmi düşüktür (günde birkaç adet).
7. **Puan: 8/10** — Pulse ile felsefi komşuluk var (ikisi de "sesini duyur") ama Pulse ölçer, Spark süreç yürütür; kanibalizasyon düşük. Zayıf yanı: değeri yönetimin gerçekten cevap vermesine bağlı — araç değil kültür sorunu.

## 4. FlowGate — Ziyaretçi Karşılama
1. **Ad:** FlowGate (O + "GATE")
2. **Ne:** Resepsiyon kiosku: ziyaretçi adını/firmasını/ev sahibini girer, KVKK onayı verir, kayıt düşer; lobide "Hoş geldiniz" perdesi; gün sonu ziyaretçi defteri.
3. **Kim/ne zaman:** Fabrika ana giriş — müşteri denetçisi gelir, kioskta kayıt olur, güvenlik manage ekranından görür; planlı ziyarette ev sahibi önceden kayıt açar, ziyaretçiye QR gider, gelince okutur.
4. **Neden uyar:** Kiosk = Pulse kiosk (PIN'li çıkış dahil); "Hoş geldiniz Sn. X" lobisi = Sign'a URL embed edilen board; beklenen ziyaretçi QR'ı = join-kod deseni. Tamamen Firebase, dış servis yok.
5. **MVP:** `gates/{id}` + `visits/{autoId}(name, company, host, status: expected|in|out, kvkkAt)`; kiosk self check-in + manage listesi (içeride kim var) + lobi board. **Ev sahibine bildirim MVP DIŞI** (push/e-posta = dış servis çizgisine takılır; manage ekranı onSnapshot ile yeter).
6. **Kota riski:** İHMAL EDİLEBİLİR (günde onlarca kayıt). Asıl risk kota değil **KVKK**: kişisel veri saklıyorsun — saklama süresi/otomatik silme (450'lik batch silme deseni hazır) MVP'ye dahil edilmeli.
7. **Puan: 8/10** — self-host Sign paketiyle birlikte satılabilir doğal ikinci ürün (fabrikalar ziyaretçi defteri zorunluluğunu sever).

## 5. FlowRoom — Toplantı Odası Panosu
1. **Ad:** FlowRoom (O + "ROOM")
2. **Ne:** Kapı yanı tablet: odanın şu an dolu/boş durumu + günün ajandası + kapıda 15dk hızlı rezervasyon.
3. **Kim/ne zaman:** Fabrika ofis katı — toplantıya girecek ekip kapıdan boş odayı görür; "şimdi 30 dk al" tuşuyla kapar.
4. **Neden uyar:** Kapı tableti = kiosk disiplini (wake lock, gece reload — Sign bekçileri deseni); rezervasyon = basit CRUD + onSnapshot; oda durumu Sign'a embed edilebilir (kat panosu).
5. **MVP:** `rooms/{id}` + `bookings/{autoId}(title, from, to, by)`; `/room/[id]/door` (public kapı ekranı: yeşil/kırmızı + sıradaki), `/room/manage` (haftalık basit grid). Çakışma kontrolü client + rules'ta zaman aralığı doğrulaması.
6. **Kota riski:** DÜŞÜK; kapı ekranı tek doküman + günün booking'leri dinler.
7. **Puan: 6/10** — **eleştirel not:** kurumda Outlook/Exchange/Google Calendar varsa bu ölü doğar (çift kayıt sorunu, entegrasyon dış-servis yasağına takılır). Yalnız takvim altyapısı OLMAYAN ortamda anlamlı. Düşük öncelik.

## 6. FlowMuster — Tatbikat/Acil Toplanma Yoklaması
1. **Ad:** FlowMuster (O + "MUSTER"; alternatif FlowDrill)
2. **Ne:** Tatbikat başlatılınca toplanma noktasındaki QR'ı okutan herkes sayılır; perdede canlı sayaç ve süre; sonunda tatbikat raporu (kaç kişi, kaç dakikada).
3. **Kim/ne zaman:** Fabrika İSG sorumlusu yılda 2 yangın tatbikatı yönetir; toplanma noktası A/B/C ayrı QR; perde/telefonda hangi noktada kaç kişi göründüğü canlı akar.
4. **Neden uyar:** QR check-in = auth'suz create-only oy deseni; canlı sayaç = Meter katılımcı sayacı; oturum/rapor = Meter `sessions` arşiv deseni; nokta karşılaştırma = Pulse liste görünümü.
5. **MVP:** `musters/{id}` + `drills/{drillId}` + `checkins/{autoId}(point, name?, createdAt)`; başlat/bitir + canlı sayaç board + geçmiş tatbikat listesi (süre, kişi).
6. **Kota riski:** DÜŞÜK ama **patlamalı**: 500 kişi 5 dakikada check-in = 500 yazma burst — Blaze'de sorun değil, rules'ta drill aktifken-yaz kapısı şart. **Asıl risk:** GERÇEK acil durumda internet/Vercel'e bağımlılık kabul edilemez — dürüstçe "tatbikat ölçüm aracı" olarak konumla, acil durum sistemi olarak DEĞİL.
7. **Puan: 7/10** — kullanım sıklığı düşük (yılda birkaç kez) ama İSG bütçesinden alıcısı net; yapımı ucuz.

## 7. FlowKudos — Takdir/Teşekkür Duvarı
1. **Ad:** FlowKudos (O + "KUDOS")
2. **Ne:** Çalışanlar birbirine kısa teşekkür kartı gönderir; moderasyondan geçen kartlar yemekhane ekranında döner; ay sonu "en çok takdir alanlar".
3. **Kim/ne zaman:** İK aylık motivasyon programı; etkinlikte de "sahnedekine mesaj at" olarak çalışır.
4. **Neden uyar:** Wall `wishes` (create-only + moderasyon + dönen kart perdesi) neredeyse birebir; profanity hazır; Sign embed ile yemekhane ekranı.
5. **MVP:** `kudos/{id}` + `cards/{autoId}(to, from?, text, status)`; gönderim formu + moderasyon + dönen perde. Sayım/lider tablosu v2.
6. **Kota riski:** İHMAL EDİLEBİLİR.
7. **Puan: 6/10** — **eleştirel:** Wall'un wishes özelliğine fazla yakın; "ayrı ürün" iddiası zayıf, suite'i sulandırma riski var. Ancak süreğen (etkinlik değil her gün) olması ve kişi-hedefli olması ayrıştırıyor. Spark ile birleştirilebilir bile.

## 8. FlowAgenda — Etkinlik Programı & Salon Yönlendirme
1. **Ad:** FlowAgenda (O + "AGENDA"; alternatif FlowPlan)
2. **Ne:** Çok oturumlu etkinlik için canlı program: telefonda QR ile ajanda, salon kapısı ekranında "Şimdi / Sıradaki" otomatik akış, gecikme olursa tek yerden kaydırma.
3. **Kim/ne zaman:** Şirket bayi toplantısı / iç konferans: 2 salon, 12 oturum; program 20 dk kayınca organizatör manage'dan kaydırır, tüm kapı ekranları ve telefonlar anında güncellenir.
4. **Neden uyar:** Kapı ekranı = kiosk/perde disiplini; telefon ajandası = auth'suz QR; onSnapshot canlı kayma tam realtime vitrin; oturuma Meter kodu iliştirilebilir ("bu oturumun oylamasına katıl") — suite'i ÇAPRAZ satan ilk ürün olur.
5. **MVP:** `agendas/{id}` + `sessions[](title, room, from, to, speaker)` tek dokümanda (dizi — küçük veri); `/agenda/[id]` (telefon), `/agenda/[id]/door/[room]` (kapı), manage'da saat kaydırma (+10dk tüm devamına).
6. **Kota riski:** ÇOK DÜŞÜK (tek doküman dinlenir).
7. **Puan: 7/10** — etkinlik tarafını güçlendirir; zayıflık: kullanım sıklığı etkinlik takvimine bağlı.

## 9. FlowLearn — Mikro-Eğitim + Sınav Kaydı (LMS-lite)
1. **Ad:** FlowLearn (O + "LEARN")
2. **Ne:** Kendi hızında geçilen kısa eğitim (slayt/video) + sonunda baraj puanlı sınav + isimli geçti/kaldı kaydı ve tarih.
3. **Kim/ne zaman:** İSG uzmanı yıllık zorunlu eğitimi yükler; çalışan QR ile telefondan izler, sınavı geçer; kokpitte "kim tamamladı/kim kalmış" listesi.
4. **Neden uyar:** Slayt/quiz motoru Meter'da mevcut (quiz-select/type, puanlama); fark canlı-senkron değil **asenkron + kayıt tutma**. Sunucu görsel sıkıştırma deseni içerik için hazır.
5. **MVP:** Ayrı `courses/{id}` + `attempts/{autoId}(name, sicil?, score, passed, at)`; içerik = mevcut slayt tiplerinin alt kümesi (content/image/video/quiz). 1-2 gün ancak Meter bileşenlerini paylaşırsa yeter — sıfırdan yazılırsa 3-4 gün.
6. **Kota riski:** DÜŞÜK-ORTA: attempt başına cevap yazmaları; cevapları tek attempt dokümanına gömerek (dizi) 1 yazmaya indir.
7. **Puan: 6/10** — **eleştirel:** Meter'ın "audience-pace" backlog maddesiyle çakışıyor; yanlış kurgulanırsa yeni ürün değil Meter özelliği. Ayrı ürün yapan tek şey isimli kayıt/sertifika — bu da anonimlik felsefesiyle (Pulse) bilinçli zıtlık, sorun değil ama net çizilmeli. MVP'si 1-2 güne zor sığar.

## 10. FlowLine — Hat Skorboardu (Andon-lite)
1. **Ad:** FlowLine (O + "LINE"; alternatif FlowAndon)
2. **Ne:** Üretim hattı başı ekran: vardiya hedefi vs gerçekleşen, duruş bildirimi butonu (kiosk), duruş olunca ekran kırmızı + süre sayar.
3. **Kim/ne zaman:** Hat lideri vardiya başında hedefi girer; operatör kioskta "+adet" veya "Duruş: malzeme yok" basar; hat üstü ekran (Sign embed veya kendi board'u) canlı sayar.
4. **Neden uyar:** Kiosk + board ikilisi = Pulse mimarisi birebir; increment rollup = Pulse `days/` deseni (rules'ta +1 kapısı dahil); skor renk semantiği (yeşil/amber/gül) hazır.
5. **MVP:** `lines/{id}(target, shift)` + `events/{autoId}(type: count|stopStart|stopEnd, reason?)` + saatlik rollup; kiosk (dev butonlar) + board (hedef/gerçek/sadece adet) + manage.
6. **Kota riski:** ORTA — **en riskli fikir**: adet başına yazma olursa (dakikada onlarca) kota yanar. Çözüm zorunlu: kioskta lokal biriktir + 30-60 sn'de bir toplu increment. Bu tasarım disiplini MVP'ye dahil.
7. **Puan: 7/10** — fabrika değeri çok yüksek ama manuel veri girişi (MES entegrasyonu dış-servis yasağıyla imkânsız) benimseme riskini büyütür: operatör basmazsa pano yalan söyler.

## İlk 3 Tercih

**1. FlowQueue (9/10).** Suite'teki en boş ve en evrensel kutu: mevcut dört ürünün hiçbiriyle çakışmıyor, her parçası (kiosk, perde, QR, create-only rules, onSnapshot) rafta hazır, MVP gerçekçi biçimde 1-2 gün. Fabrikada (rampa/revir/İK) ve etkinlikte (kayıt masası) aynı anda işe yarar; Pulse gibi tamamen Firebase olduğundan ileride self-host paketine bedavaya girer. Kota profili suite'in en temizi.

**2. FlowCheck (9/10).** Fabrika bağlamında en yüksek "her gün kullanılır" değeri: kâğıt kontrol formlarının dijitali, Pulse'un rollup + eşik + kiosk DNA'sının doğrudan yeniden kullanımı. Pulse "his" ölçer, Check "durum" ölçer — konumlandırma net, kanibalizasyon yok. Tek dikkat: auth'suz kimlik zayıflığını "iç disiplin aracı" diye dürüst konumlamak.

**3. FlowSpark (8/10).** Kaizen kutusu Türkiye imalat kültüründe bilinen, istenen bir şey; Pulse'un anonim moderasyonlu yazma altyapısı + Wall'un dönen kart perdesiyle neredeyse montaj işi. Pulse ile birlikte "çalışanın sesi" mini-paketi oluşturur (Pulse ölçer → Spark toplar → Sign yayınlar) — bu üçlü, self-host fabrika paketinin satış hikâyesini güçlendirir.

**Elenenlerin gerekçesi kısaca:** FlowRoom kurumsal takvim varlığında ölü doğar; FlowKudos ayrı ürün olamayacak kadar Wall-wishes'e yakın; FlowLearn Meter'ı kanibalize etme ve 1-2 günü aşma riski taşır; FlowLine değerli ama manuel giriş bağımlılığı ve kota disiplini gereksinimiyle "3. dalga" işi; FlowMuster ve FlowAgenda iyi ama kullanım sıklığı düşük — Queue/Check/Spark'tan sonra sıraya alınabilir.

---

# RAPOR 2 — Mevcut Ürünleri Derinleştirme (rakip kıyaslı)

Kod ve dokümanlar incelendi; birkaç yerde kod dokümanın önünde: FlowWall kota guard'ları (maxPerPerson/videoLimitSec) UYGULANMIŞ, FlowSign ekran-sağlık heartbeat'i CANLI, profanity süzgeci suite genelinde bağlı. Buna göre "gerçekte eksik olan"lar:

## FlowMeter (vs Mentimeter / Slido / AhaSlides)

**M1. Audience-pace anket modu** — Eğitim sonrası değerlendirme anketi: sunucu perde başında 8 slaytı elle ilerletmek zorunda; "linki atayım, herkes kendi hızında doldursun" diyemiyor. Menti'nin en çok kullanılan ikinci modu. `PresentationMode = "audience-pace"` tipi types.ts'te ZATEN VAR, hiçbir yerde kullanılmıyor. `/p/[id]`'ye yerel slayt gezinmesi + bitiş ekranı; rules oy kapıları aynen çalışır. **Efor: M · Kota: nötr/pozitif · Değer: 9/10**

**M2. Açık uçlu / kelime bulutu moderasyon kuyruğu** — Genel müdürlü toplantıda anonim izleyici küfür listesini aşan imalı/kişisel cümle yazar → perdeye ANINDA düşer. Q&A'da moderasyon var, asıl riskli tip olan open-ended/word-cloud'da yok. Rakiplerde standart. Q&A deseni birebir kopya: `ResponseDoc.status` + rules pending zorunlu + `/moderate`'e "Cevaplar" sekmesi. **Efor: M · Değer: 8/10**

**M3. Telefon kumandası (Mentimote) + konuşmacı notları** — Sunucu sahnede, laptop kürsüde; slayt ilerletmek için kürsüye yürüyor. `/remote/[id]` (owner-auth): setCurrentSlide + sıradaki slayt + notlar + bekleyen Q&A. **Efor: S · Değer: 7/10**

**M4. Görsel sonuç raporu (PDF)** — Organizatörün elinde yalnız ham CSV var; grafikli tek sayfalık özet yok. jspdf zaten bağımlılıkta (Pulse kullanıyor, Türkçe karakter çözülmüş). **Efor: M · Değer: 6/10**

**M5. Katılımcı gözünden prova (test modu)** — Canlı kullanım öncesi quiz akışını denemenin tek yolu gerçek koda katılıp veriyi kirletmek. Editörde local-state "Dene" paneli; yazma yok. **Efor: M · Değer: 6/10**

**M6. i18n — izleyici yüzeyi İngilizce** — Çok uluslu etkinlikte katılımcı Türkçe metinlerle karşılaşıyor. `presentation.language: "tr"|"en"` + izleyici yüzeyinde sözlük; kokpit Türkçe kalır. **Efor: M · Değer: 6/10**

## FlowWall (vs Walls.io vb.)

**W1. Etkinlik sonrası paylaşılabilir galeri linki** — Düğün ertesi sabah "Fotoğraflar nerede?" Bugün misafire verilecek link YOK; toplanan değer etkinlik bitince misafir için buharlaşıyor. `wall.galleryOpen` + read-only `/g/[id]`; rules zaten public. Cloudinary bandwidth için thumb transformları şart. **Efor: S-M · Değer: 9/10**

**W2. Anlık kamera (capture)** — "Şimdi çekip atayım" isteyen misafir dosya seçicide kayboluyor. `<input capture="environment">` → mevcut upload hattı aynen. **Efor: S · Değer: 8/10**

**W3. Öne çıkar / sabitle (pin)** — İlk dans fotoğrafını perdede tutmanın yolu yok, tüm modlar otomatik akıyor. `wall.pinnedMediaId` (announcement deseni); perde modlarında pinli medya öncelik alır. **Efor: S · Değer: 7/10**

**W4. Misafirin kendi yüklediğini silmesi** — Kötü çıkan fotoyu kaldırmanın tek yolu sahibini bulmak. Firebase anonymous auth → `voterId = auth.uid` → rules delete izni; Cloudinary tarafı için misafir-imzalı destroy yolu asıl maliyet. **Efor: M · Değer: 6/10**

**W5. Etkinlik çerçevesi / sticker overlay** — Kurumsal lansmanısında logolu çerçeve; yükleme sırasında canvas compose (küçültme adımı zaten canvas'ta) → Cloudinary kredisi yemez. **Efor: M · Değer: 6/10**

*Not: Walls.io'nun çekirdeği (hashtag ile sosyal medya toplama) dış-servis-yok kuralı nedeniyle bilinçli kapsam dışı.*

## FlowSign (vs Yodeck / ScreenCloud / OptiSigns)

**S1. Medya offline önbelleği (Service Worker)** — İnternet 10 dk koptu: Firestore config cache'ten dönüyor ama görsel/videolar Cloudinary'den her seferinde ağdan → alanlar siyaha düşer. Gece 04:0x reload'u ağ kesikken cache'siz açılırsa ekran tamamen boş kalır. Rakip player'ların tümü medyayı diske indirir — satın alma kararlarında 1 numaralı kriter. `play` rotalarına scope'lu SW: publish anında `live.zones` medyası Cache API'ye precache; fetch cache-first. **Efor: M-L · Kota: POZİTİF (Cloudinary bandwidth düşer) · Değer: 9/10**

**S2. Acil anons / ekran devralma (takeover)** — "Servis saati değişti" duyurusunu tüm ekranlara anında basmanın yolu yok (taslak bozup yayınlamak gerekiyor). `playMode` deseni hazır şablon: kök alan `override{title,text,bg,until}` → perde anında tam ekran basar, süre dolunca kalkar. Wall `announcement` kodu desen olarak birebir taşınır (import değil, kopya). **Efor: S · Değer: 8/10**

**S3. "Şu an ne oynuyor" — uzaktan doğrulama** — Yayının giriş holü ekranına gerçekten indiğini görmek için oraya YÜRÜMEK gerekiyor. Mevcut ~2dk heartbeat yazımına `nowPlaying` + `publishedAt` eşlemesi ekle (EK YAZMA YOK) → ScreensCard "Alan 1: kampanya.mp4 · yayın güncel". **Efor: S · Kota: sıfır ek · Değer: 7/10**

**S4. Ses desteği** — PlayerStage tüm videoları koşulsuz `muted` basıyor; kullanıcı bunu kurulum günü müşterinin önünde öğreniyor. `ZoneItem.sound?` + tam ekran tıklaması autoplay jesti + aynı anda tek sesli alan kuralı. **Efor: S-M · Değer: 6/10**

**S5. 90° dikey (portrait) rotasyon** — Ucuz Android box'larda OS döndürme yok/kırık; "dikey totem" talebi satış paketinde blocker. `videowall.rotation: 0|90|270` → play kökünde transform + width/height takası; preset'lere "dikey totem 1080×1920". **Efor: M · Değer: 6/10**

**S6. Ortak playlist / çoklu ekrana tek yerden içerik** — 5 şubede aynı kampanya → 5 ekranı tek tek düzenleyip 5 kez yayın. Ara adım: "Bu alanın içeriğini seçili ekranlara kopyala + yayınla" toplu aksiyonu; ileride gerçek `playlists/{id}`. **Efor: M/L · Değer: 7/10**

## FlowPulse (vs HappyOrNot)

**P1. "Neden?" takip sorusu (sebep çipleri)** — Skor 38'e düştü: kokpitte kırmızı sayı var ama SEBEP yok. Aksiyon üretmeyen ölçüm 2. ayda güven kaybeder — kiosk ürünlerinin tipik ölüm nedeni. HappyOrNot'un ana değer vaadi tam bu. `question.reasons?: string[]` + oy sonrası opsiyonel tek dokunuş ekranı (3 sn, atlanabilir) + `days.reasons.{i}: increment(1)` — mevcut tek-batch rollup'a SIFIR ek dokümanla oturur. **Efor: M · Kota: sıfır ek yazma · Değer: 9/10**

**P2. CSV / veri dışa aktarma** — İK ay sonu skorları Excel şablonuna alacak; elinde yalnız PDF var. `getRecentDays` mevcut; CSV deseni Meter'dan kopyalanır. **Efor: S · Değer: 7/10**

**P3. Eşik altı bildirim** — `threshold` var ama tek yaptığı kokpitte kırmızı göstermek; kokpiti açmayan yönetici düşüşü haftalar sonra görüyor. Yollar: (a) FCM web push (sunucusuz, hack'imsi), (b) dashboard hub'ına "dikkat gerektiren noktalar" rozeti (S, hemen yapılmalı). **Efor: (b) S / (a) M-L · Değer: 7/10**

**P4. Kiosk çoklu soru rotasyonu** — Tek tablet, iki soru → bugün iki tablet gerekiyor. Ucuz yol: kiosk'a `?ids=a,b` çoklu-nokta modu — model DEĞİŞMEZ, her oy kendi noktasına yazar. **Efor: M · Değer: 6/10**

**P5. Seri basma (burst) freni** — Çocuk kırmızı yüze 15 kez basıyor; cooldown yavaşlatır ama engellemez, gün skoru çöker. Client'ta seri basışı tek oy sayma + kokpitte saatlik anomali işareti. Rules zaten +1/+10 şişirmeyi kesiyor; bu davranışsal katman. **Efor: S-M · Kota: pozitif · Değer: 6/10**

## Suite geneli ilk 5 öncelik

1. **FlowSign — offline medya önbelleği (S1).** Sign satılacak tek ürün ve 7/24 güvenilirlik onun tek gerçek satış vaadi; bekçilere yapılan yatırım ağ kesintisinde medya kaybolunca boşa düşüyor.
2. **FlowPulse — "Neden?" sebep çipleri (P1).** Ölçüyor ama açıklamıyor; efor/değer oranı suite'in en iyisi.
3. **FlowMeter — audience-pace anket modu (M1).** Tip sistemde yeri hazır; ürünü "etkinlik anı"ndan "her toplantı sonrası" aracına genişletir.
4. **FlowWall — etkinlik sonrası galeri linki (W1).** Etkinlik ertesi sabah sorulan ilk soru.
5. **FlowMeter — açık metin moderasyon kuyruğu (M2).** Kurumsal sahnede tek kötü cümle ürünün o şirketteki geleceğini bitirir.

İkinci halka: S2 acil anons, W2 anlık kamera, P2 Pulse CSV — üçü de tek oturumluk işler.

---

# RAPOR 3 — FlowSign Self-Host / Satılabilirlik Denetimi

## 0) Ayrışma denetimi — kod gerçekte ne durumda?

Dokümandaki "kopabilir katman" ilkesi **kısmen retorik, kısmen gerçek**.

**İyi haberler:**
- Sign'ın veri erişimi tek dosyada: `src/lib/videowalls.ts` (527 satır, tüm CRUD + watch + heartbeat). Veri katmanı takası için gerçek tekil nokta var.
- Oynatıcı (`PlayerStage.tsx`) yalnız `itemInWindow` + `sendScreenBeat` + tipleri import ediyor; Cloudinary'ye doğrudan bağımlılığı yok. Offline persistence ve dayanıklı abonelik bekçileri yazılmış — kesintili iç ağda avantaj.
- Sign UI bileşenleri kendi klasöründe; Meter/Wall/Pulse bileşenlerine bağımlılık neredeyse sıfır.

**Kötü haberler (ayrışma iddiasının delikleri):**
1. **`src/lib/videowall/media.ts` HİÇ YOK.** Doküman medya soyutlama katmanını gösteriyor ama gerçekte upload `ZonePanel.tsx`'te doğrudan `uploadToCloudinary` ve `cloudinary.ts` FlowWall ile ortak. Plan yazılmış, katman yazılmamış.
2. **`@/lib/hooks.ts` kirli bağımlılık:** Sign sayfaları `useAuthUser`'ı buradan alıyor; aynı dosya Meter tiplerini ve `walls.ts`'i import ediyor. Sign'ı paketlediğinde Meter+Wall kodunu da sürüklersin.
3. **`@/lib/types.ts` tek dev dosya:** Videowall tipleri dört ürünün tipleriyle iç içe.
4. **Çapraz import:** `videowall/[id]/edit` → `@/components/present/QrCode` (Meter klasöründen).
5. **Ortak API rotası:** silme `/api/wall/destroy` (`mode:"sign"` parametresiyle) — pakette Wall dallarını da taşırsın.
6. **Yetki modeli fiilen kiracısız:** `listAllVideowalls()` herkesi herkese listeler, rules "read: if true". Tek-hesap için doğru; **satılan üründe kabul edilemez.**
7. `next.config.mjs` auth rewrite'ı `flowmeter-938a3.firebaseapp.com`'a sabit — proje kimliği koda sızmış.

Özet: ayrışma **~%60**. Oynatıcı ve CRUD temiz; medya katmanı, auth hook'u, tipler ve silme rotası suite'e yapışık.

## A) Satılabilirlik — eksik 10 şey

**A1. Veri katmanının gerçekten takas edilebilir olması — XL.** İç ağda Firestore YOK; Emulator "production için değildir". `videowalls.ts` imzasını `SignDataStore` arayüzüne çıkar; self-host adayı: **PocketBase** (tek binary, SQLite, realtime, auth dahili — solo geliştirici için biçilmiş kaftan). `Timestamp` → ms-number geçişi en sinsi iş.

**A2. Medya katmanı takası (Cloudinary → yerel) — L.** Önce vaat edilen `media.ts` arayüzünü GERÇEKTEN yarat; online impl = Cloudinary, self-host = diske yaz + statik servis. Video transcode YOK — "MP4 H.264 yükleyin" kuralı koy (solo geliştirici tuzağı).

**A3. Auth takası + roller — L.** Google girişi fabrikada genelde imkânsız. `useSignAuth` provider'ı; self-host'ta kullanıcı/parola (PocketBase bedavaya verir). Rol modeli minimal: `admin` / `editor` / izleyici=auth'suz play linki. Üçten fazla rol tanımlama.

**A4. Kurulum paketi (Docker + tek komut) — M.** `output: "standalone"`, docker-compose, ilk-açılış sihirbazı, air-gap için `docker save` tar + USB kurulum betiği. Kurulum 30 dk'yı aşarsa destek maliyeti kârı yer.

**A5. Lisanslama + kiracı izolasyonu — M.** Air-gap'te "telefon eden" lisans sunucusu çalışmaz → imzalı offline lisans dosyası (Ed25519: müşteri + ekran limiti + bitiş). Ekran limiti lisanstan okunur = "ekran başına fiyat"ın teknik dayanağı. Kırılabilir mi? Evet; fabrika müşterisi kırmaz — amaç faturalandırmayı meşrulaştırmak.

**A6. Güncelleme dağıtımı (air-gap uyumlu) — M.** Semver + CHANGELOG + offline update bundle (`update.sh`: migration + rollback). `schemaVersion` disiplinini ŞİMDİ başlat.

**A7. Yedekleme/geri yükleme — S/M.** Fabrika BT'sinin ilk üç sorusundan biri. SQLite/PocketBase = veri tek dosya; `backup.sh`/`restore.sh` + admin panelinde "yedek indir" (zip).

**A8. Beyaz etiket / müşteri markalama — S.** Fabrika kendi logosunu ister. `branding` config'i (logo, ad, aksan rengi); kurulum sihirbazına logo yükleme. Perde tarafında zaten marka yok; iş kokpitte.

**A9. Kiosk işletim rehberi + sağlık — M.** Kod büyük ölçüde hazır (wake lock, gece reload, heartbeat). Eksik: cihaz reçetesi (Chrome `--kiosk` + otomatik açılış, donanım listesi), heartbeat "X dk sessiz" alarmı. Park'taki 90° döndürmeyi bu pakete al (dikey totem talebi yaygın).

**A10. Fiyatlama önerisi — S (karar).** Kurulum bedeli (bir defalık) + **ekran başına yıllık lisans** (fabrikalar cihaz-başına-yıllık modele alışıktır) + destek/güncelleme lisansa GÖMÜLÜ. Yapma: kullanıcı-başına fiyat, "ömür boyu lisans" (7/24 ürün + solo geliştirici = ömür boyu bedava destek taahhüdü).

## B) Sıralı yol haritası (7 adım)

1. **Cerrahi ayrıştırma** (tipler, auth hook, QrCode, `/api/sign/destroy`, `media.ts` arayüzü; davranış SIFIR değişir). *Atlarsan: "Sign paketi" diye sattığın şey tüm suite olur.*
2. **Veri katmanı arayüzü + Timestamp→ms temizliği.** Henüz ikinci backend yok, dikiş yeri açılıyor. *Atlarsan: Adım 3'te Firestore çağrılarını 20 dosyada kovalarsın.*
3. **Self-host backend (PocketBase/SQLite+WS) + yerel medya + parola auth + roller.** En büyük yudum (XL); pilotu sınırla: 1 sunucu, ≤5 ekran, 2 kullanıcı. *Atlarsan: satacak şeyin yok.*
4. **Docker paketi + kurulum sihirbazı + markalama.** *Atlarsan: her kurulum senin mesain olur.*
5. **Lisans dosyası + ekran limiti + sürüm/migration iskeleti.** *Atlarsan: herkes sınırsız kurar; ilk güncellemede veri çarpışmasını sahada öğrenirsin.*
6. **Yedek/geri yükleme + offline update + kiosk işletim rehberi.** *Atlarsan: satış olur, İŞLETME olmaz; referans müşteri yanar.*
7. **Pilot kurulum (gerçek fabrika, indirimli) + 30 gün heartbeat gözlemi.** Kurulumu SEN değil ONLAR yapsın — dokümanın testi budur. Pulse'ı v1'e ALMA; v1.5 opsiyonu olarak fiyat listesine yaz. *Atlarsan: ilk gerçek müşteri = ilk test ortamın olur.*

**Kritik not:** En tehlikeli yanılsama "kod zaten %90 hazır" hissi. Kod tarafı gerçekten iyi; ama satılabilir paketi oluşturan şeylerin (A4–A7, A9) hiçbiri kod tabanında yok ve toplamı bugüne dek yazılmış Sign kodundan az iş değil. Gerçekçi takvim: solo, yarı zamanlıyla Adım 1–2 birkaç hafta; Adım 3 tek başına iki-üç katı; pilot dahil uçtan uca **aylar mertebesi**.

---

# RAPOR 4 — Çapraz-Ürün Sinerjileri ("1+1=3")

## Zemin: bugünkü köprü envanteri (kod-doğrulanmış)

**Auth'suz, iframe'lenebilir public rotalar:** `/pulse/[id]/board` (başlık yorumu zaten "FlowSign'a URL öğesi olarak gömülür" diyor), `/pulse/[id]/kiosk|vote`, `/wall/[id]` (perde), `/u/[id]`, `/flowsign/[slug]`, `/videowall/[id]/play`, `/p/[id]`, `/join/[code]`.

**Auth İSTEYEN (bugün Sign'a gömülemeyen):** `/present/[id]` ve `/results/[id]`. **Meter'ın chrome'suz public sonuç ekranı YOK — suite'in en büyük eksik köprüsü.**

**Sign'ın hazır kasları:** URL öğesi + zoom (%25–150) + saat aralığı + hafta günleri + kampanya tarihleri + sandbox + embed-check. Kendi ürünlerimiz aynı origin'de → X-Frame-Options derdi yok.

**Diğer kancalar:** `joinCodes` tek havuz (wall|deck), Wall çekiliş nonce tetiklemesi, Sign heartbeat, Pulse `threshold` alanı, `/p`'de "sunum bitti" ekranı.

## Fikirler (12)

**1. "Nabız Duvarda"** — Sign totemi köşe alanında bugünün memnuniyet skoru + oy QR'ı canlı. Bugün %100 çalışıyor (URL öğesi olarak board). Eksik: `?compact=1` / `?qr=0` cilası. **Efor S · Değer 9**

**2. "Perde-içinde-Perde"** — Şirket pikniği günü kalıcı Sign ekranları etkinliğin foto duvarına dönüşür (kampanya tarihleriyle otomatik girer-çıkar). %85 çalışıyor. Eksik: Wall perdesine `?embed=1` sade modu (QR bloğu küçült, ambient/emoji yağmuru kapat — iframe GPU yükü, tek `screenMode` zorla). **Efor S · Değer 8**

**3. Meter Sonuç Vitrini `/r/[id]`** — Fuaye TV'lerinde canlı kelime bulutu. %0 görünür, %90 altyapı: rules public, hook'lar ve tüm grafikler hazır; tek eksik chrome'suz rota (+ `?public=1` sahibinin açtığı bayrak). **Efor M · Değer 8**

**4. Tek QR, Üç Kapı — `/e/[code]` etkinlik kapısı** — Masada TEK QR: "📷 Duvar · 🎤 Oylama · 💌 Dilek". `joinCodes`'a `kind:"event"` + hafif `events/{id}` + seçim sayfası. **Efor M · Değer 9**

**5. "Işıklar Sönmesin" — sunum bitişi → çekiliş** — Sunucu "Bitir"e basınca telefonlardaki bitti ekranı "🎁 Çekilişe katıl / 📷 Foto yükle" butonlarına dönüşür. İki küçük dikiş: `afterEndWallId` alanı + "Bitir + çekilişi aç" butonu. **Efor M · Değer 8**

**6. Dashboard "Bugün" şeridi** — Hub kartlarına canlı mikro-rozetler: Pulse skor çipleri, "3/4 ekran çevrimiçi", "2 onay bekliyor". Veri katmanı komple hazır; kota-dostu (1-2 doküman/abonelik). **Efor S · Değer 7**

**7. Eşik Alarmı Panosu** — Skor eşik altına düşünce board `?alert=1` modunda "Bugün nabız düşük — 2 dk'nı ayır" kompozisyonuna geçer; Sign hiçbir şey bilmez, aynı URL'yi gösterir. **Efor S · Değer 7**

**8. Anı Filmi Arşiv Kanalı** — Piknikten 3 gün sonra öğle saatlerinde Sign'da Anı Filmi döner. Bugün %100, sıfır kod (MP4'ü Sign'a yükle + saat penceresi). Eksik: Wall manage'e tek satır ipucu. Otomatik köprü KURMA — dosya zaten en temiz gevşek bağ. **Efor ~0 · Değer 6**

**9. "Her Tabela Bir Kapı" — Sign'a QR öğesi** — `ZoneItem`'a `kind:"qr"` (hedef URL + başlık). DİKKAT: QrCode Meter klasöründe — Sign import edemez; QR çizimini Sign içinde bağımsız üret veya QrCode'u çekirdeğe taşı. **Efor M · Değer 7**

**10. Meter'a canlı Pulse slaytı** — Aylık toplantıda "Şirket Nabzı" slaytı: perdede o ayın trendi canlı, ardından Meter oylamasıyla "peki neden?" tartışması. Meter'a `url/embed` slayt tipi (Sign'daki safeSrc desenini kopyala — import değil). Bonus: herhangi bir sayfayı da gösterir. **Efor M · Değer 7**

**11. Çekiliş Kayıt Vitrini** — Koridor Sign ekranında "Çekiliş kaydı açık — şu an 143 katılımcı" canlı sayaç + QR. Wall'a mini public `/wall/{id}/raffle-board` rotası. **Efor M · Değer 6**

**12. Etkinlik Sonrası "Hatıra Paketi"** — Tek link epilog: read-only galeri + Anı Filmi + çekiliş kazananları + quiz podyumu. En büyük iş galeri UI'ı (Wall backlog'undaki galeri linkiyle birleşir). **Efor L · Değer 7**

## En az eforla en çok wow — ilk 3

1. **#2 Perde-içinde-Perde (`?embed=1`)** — neredeyse bedava; "kalıcı ekranlar etkinlik günü kendiliğinden partiye katılıyor" hissi demoda en çok "vay" dedirtecek olan.
2. **#1 Nabız Duvarda (compact/qr paramları)** — köprü zaten kurulmuş; iki query parametresiyle "her Sign ekranı aynı zamanda şirket nabzı" vaadi pazarlanabilir hale gelir.
3. **#3 Meter Sonuç Vitrini (`/r/[id]`)** — tek eksik public köprü bu; bir sayfalık işle Meter, Sign+lobi TV ekosistemine bağlanır ve #10'un ön koşulunu döşer.

*Stratejik not: orta vadede en yüksek bileşik getiri #4 Etkinlik Kapısı — tek QR, ürünleri "suite" yapan kavramsal çatıyı (events) beraberinde getiriyor; ilk 3'ten hemen sonra sıraya alınmalı.*
