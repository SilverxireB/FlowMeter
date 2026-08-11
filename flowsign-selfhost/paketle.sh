#!/bin/sh
# FlowSign self-host TESLİM ARŞİVİ — yazılımcıya verilecek tek dosya.
# Kaynak + README + KURULUM-HARITASI + DEVIR-NOTU + .env.example girer; derleme çıktısı,
# bağımlılıklar, canlı veri ve gerçek .env GİRMEZ (parola sızmasın).
# Kullanım: ./paketle.sh  →  bir üst klasörde flowsign-selfhost-YYYYMMDD.tar.gz
set -e
cd "$(dirname "$0")"
AD="flowsign-selfhost-$(date +%Y%m%d).tar.gz"
tar -czf "../$AD" \
  --exclude="flowsign-selfhost/node_modules" \
  --exclude="flowsign-selfhost/.next" \
  --exclude="flowsign-selfhost/data" \
  --exclude="flowsign-selfhost/.env" \
  --exclude="flowsign-selfhost/tsconfig.tsbuildinfo" \
  -C .. flowsign-selfhost
echo "Hazır: $(cd .. && pwd)/$AD"
