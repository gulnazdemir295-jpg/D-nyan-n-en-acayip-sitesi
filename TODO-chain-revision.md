# Satış Zinciri Revizyonu TODO

## Genel Plan
Yeni satış zinciri: Hammadeciler -> Üreticiler -> Toptancılar -> Satıcılar -> Müşteriler

Her panel bir üst seviyeden ürün alır, alt seviyeye satar. Müşteriler sadece alır.

## Adımlar
- [x] Ürün yönetimi sayfalarını zincire göre güncelle (urun-yonetimi.html)
- [x] Sipariş sistemi güncelle: Siparişler zincir boyunca akıyor, onay mekanizmaları ekle
- [x] Panel sayfalarını güncelle: Alım/satış butonları zincire göre
  - [x] hammadeciler-panel.html: Sadece satış (üreticilere)
  - [x] ureticiler-panel.html: Alım (hammadecilerden) + Satış (toptancılara)
  - [x] toptancilar-panel.html: Alım (üreticilerden) + Satış (satıcılara)
  - [x] saticilar-panel.html: Alım (toptancılardan) + Satış (müşterilere)
  - [x] musteriler-panel.html: Sadece alım (satıcılardan)
- [ ] Admin panelini güncelle: Tüm zinciri yönet, raporlar zincire göre
- [x] Sipariş takip sayfalarını güncelle (siparisler.html, siparislerim.html)
- [ ] Test: Zincir boyunca sipariş oluştur ve onay et
