#!/usr/bin/env bash
# ORTAK RAF — UÇTAN UCA SINAV (self-host, gerçek sunucu + gerçek dosyalar).
#
# Neden kabuk betiği: buradaki asıl güvence DOSYA SİSTEMİNDE gerçekleşiyor —
# "ekran silinince raf dosyası duruyor mu". Birim sınavı ancak niyeti ölçebilir;
# bu betik sunucuyu gerçekten ayağa kaldırıp dosyayı diskte arıyor.
#
# ÇALIŞTIRMA (flowsign-selfhost içinden):
#   npm run build
#   cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
#   SIGN_DATA_DIR=/tmp/rafdata SIGN_ADMIN_PASSWORD=admin123 PORT=3199 \
#     node .next/standalone/server.js &
#   VERI=/tmp/rafdata bash ../tests/ortak-raf-e2e.sh
#
# ÇİFT YÖNLÜ: son bölümde aynı ekranda paylaşılan VE paylaşılmayan iki dosya
# var. Ekran silinince biri DURMALI, diğeri GİTMELİ — yoksa "raf duruyor"
# sonucu, silmenin hiç çalışmamasından da geliyor olabilirdi.

set -u
B=${B:-http://localhost:3199}
VERI=${VERI:-/tmp/rafdata}
CALISMA=$(mktemp -d)
cd "$CALISMA"

jq(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1 if d else '')" 2>/dev/null; }
ok=0; bad=0
say(){ if [ "$2" = "$3" ]; then echo "✓ $1"; ok=$((ok+1)); else echo "✗ $1  (beklenen '$3', gelen '$2')"; bad=$((bad+1)); fi; }

# Hesaplar + çerezler
curl -s -c ay.txt -o /dev/null -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"name":"yonetici","password":"admin123"}'
curl -s -b ay.txt -o /dev/null -X POST $B/api/users -H 'Content-Type: application/json' -d '{"name":"ayse","password":"ayse1234","role":"user"}'
curl -s -c ku.txt -o /dev/null -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"name":"ayse","password":"ayse1234"}'

W=$(curl -s -b ku.txt -X POST $B/api/walls -H 'Content-Type: application/json' -d '{"name":"IK Foto 2","width":1920,"height":1080,"cols":1,"rows":1}' | jq "['id']")
printf '\xff\xd8\xffTESTJPEG' > bekofilmi.jpg
SRC=$(curl -s -b ku.txt -F "file=@bekofilmi.jpg;type=image/jpeg" "$B/api/upload?wall=$W" | jq "['url']")
echo "ekran=$W  dosya=$SRC"
say "dosya ekranin klasorunde" "$(ls $VERI/media/$W/ 2>/dev/null | wc -l)" "1"

# --- AYSE (yonetici DEGIL) rafa koyabilmeli ---
R=$(curl -s -b ku.txt -X POST $B/api/ortak-raf -H 'Content-Type: application/json' -d "{\"src\":\"$SRC\",\"kind\":\"image\",\"name\":\"bekofilmi\",\"fromWall\":\"IK Foto 2\"}")
RID=$(echo "$R" | jq "['oge']['id']"); RSRC=$(echo "$R" | jq "['oge']['src']"); RBY=$(echo "$R" | jq "['oge']['by']")
say "yonetici OLMAYAN rafa koyabiliyor" "$([ -n "$RID" ] && echo evet || echo hayir)" "evet"
say "denetim izi: rafa koyan yazildi" "$RBY" "ayse"
say "dosya raf klasorune TASINDI" "$(ls $VERI/media/_ortak/ 2>/dev/null | wc -l)" "1"
say "eski klasorden GITTI (kopya degil tasima)" "$(ls $VERI/media/$W/ 2>/dev/null | wc -l)" "0"

# --- ayni dosyayi ikinci kez rafa koyma ---
say "zaten raftaki dosya tekrar konamaz" "$(curl -s -o /dev/null -w '%{http_code}' -b ku.txt -X POST $B/api/ortak-raf -H 'Content-Type: application/json' -d "{\"src\":\"$RSRC\",\"kind\":\"image\",\"name\":\"x\"}")" "409"

# --- yol disina cikma denemesi ---
say "klasor disina cikma denemesi reddediliyor" "$(curl -s -o /dev/null -w '%{http_code}' -b ku.txt -X POST $B/api/ortak-raf -H 'Content-Type: application/json' -d '{"src":"/media/../../etc/passwd","kind":"image","name":"x"}')" "400"

# --- AYSE raftan SILEMEZ ---
say "yonetici OLMAYAN raftan silemiyor" "$(curl -s -o /dev/null -w '%{http_code}' -b ku.txt -X DELETE "$B/api/ortak-raf?id=$RID")" "403"
say "  ...dosya duruyor" "$(ls $VERI/media/_ortak/ 2>/dev/null | wc -l)" "1"

# --- ASIL SINAV: ekran silinince raf duruyor mu ---
curl -s -o /dev/null -b ku.txt -X DELETE "$B/api/walls/$W"
say "ekran silindi" "$(ls $VERI/walls/ 2>/dev/null | grep -c "$W")" "0"
say "EKRAN SILINDI, RAF DOSYASI DURUYOR" "$(ls $VERI/media/_ortak/ 2>/dev/null | wc -l)" "1"
say "  ...raf kaydi da duruyor" "$(curl -s -b ku.txt $B/api/ortak-raf | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["raf"]))')" "1"

# --- YONETICI silebilir ---
say "yonetici raftan silebiliyor" "$(curl -s -o /dev/null -w '%{http_code}' -b ay.txt -X DELETE "$B/api/ortak-raf?id=$RID")" "200"
say "  ...dosya diskten gitti" "$(ls $VERI/media/_ortak/ 2>/dev/null | wc -l)" "0"

# --- girissiz erisim ---
say "girissiz okuma reddediliyor" "$(curl -s -o /dev/null -w '%{http_code}' $B/api/ortak-raf)" "401"
say "girissiz koyma reddediliyor" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/ortak-raf -H 'Content-Type: application/json' -d '{"src":"/media/x/y.jpg","kind":"image","name":"x"}')" "401"


# ÇİFT YÖNLÜ: aynı ekranda İKİ dosya — biri rafa konur, biri konmaz.
# Ekran silinince: raftaki DURMALI, diğeri GİTMELİ. İkisi birden ölçülmezse
# "raf duruyor" sonucu silmenin hiç çalışmamasından da gelebilirdi.
W=$(curl -s -b ku.txt -X POST $B/api/walls -H 'Content-Type: application/json' -d '{"name":"Cift Yonlu","width":1920,"height":1080,"cols":1,"rows":1}' | jq "['id']")
printf '\xff\xd8\xffPAYLASILAN' > paylasilan.jpg
printf '\xff\xd8\xffKALAN' > kalan.jpg
P=$(curl -s -b ku.txt -F "file=@paylasilan.jpg;type=image/jpeg" "$B/api/upload?wall=$W" | jq "['url']")
K=$(curl -s -b ku.txt -F "file=@kalan.jpg;type=image/jpeg"     "$B/api/upload?wall=$W" | jq "['url']")
say "ekranda iki dosya var" "$(ls $VERI/media/$W/ | wc -l)" "2"

curl -s -o /dev/null -b ku.txt -X POST $B/api/ortak-raf -H 'Content-Type: application/json' -d "{\"src\":\"$P\",\"kind\":\"image\",\"name\":\"paylasilan\"}"
say "biri rafa tasindi, ekranda bir dosya kaldi" "$(ls $VERI/media/$W/ | wc -l)" "1"
say "rafta bir dosya var" "$(ls $VERI/media/_ortak/ | wc -l)" "1"

curl -s -o /dev/null -b ku.txt -X DELETE "$B/api/walls/$W"
say "EKRAN SILINDI → raftaki dosya DURUYOR" "$(ls $VERI/media/_ortak/ 2>/dev/null | wc -l)" "1"
say "EKRAN SILINDI → paylasilmayan dosya GITTI (silme gercekten calisiyor)" "$([ -d $VERI/media/$W ] && echo var || echo yok)" "yok"


echo; echo "SONUC: $ok gecti, $bad kaldi"
rm -rf "$CALISMA"
[ "$bad" = "0" ] || exit 1
