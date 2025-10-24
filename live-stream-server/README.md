# Canlı Yayın Sunucusu

Bu proje, WebRTC ve Mediasoup kullanarak gerçek zamanlı canlı yayın sunucusu kurulumunu sağlar.

## Kurulum

1. Node.js ve npm yüklü olduğundan emin olun
2. Projeyi klonlayın veya indirin
3. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

## Çalıştırma

Sunucuyu başlatmak için:
```bash
node server.js
```

Sunucu http://localhost:3001 adresinde çalışacaktır.

## Özellikler

- WebRTC tabanlı gerçek zamanlı yayın
- Mediasoup SFU (Selective Forwarding Unit) teknolojisi
- Ölçeklenebilir çoklu yayın desteği
- Video ve ses yayını
- Gerçek zamanlı izleyici bağlantısı

## Kullanım

1. Tarayıcıda http://localhost:3001 adresini açın
2. "Yayın Başlat" butonuna tıklayarak kamera ve mikrofon izni verin
3. Yayın başladıktan sonra başka bir sekmede "İzlemeye Başla" butonuna tıklayın

## Teknik Detaylar

- **Mediasoup**: WebRTC SFU sunucusu
- **Socket.IO**: Gerçek zamanlı iletişim
- **Express.js**: Web sunucusu
- **WebRTC**: Tarayıcı tabanlı gerçek zamanlı iletişim

## Güvenlik

Üretim ortamında kullanmadan önce:
- HTTPS sertifikası ekleyin
- Kimlik doğrulama sistemi entegre edin
- Yayın erişim kontrolü ekleyin
- Güvenlik duvarı ayarları yapın

## Sorun Giderme

- Port çakışması durumunda `server.js` dosyasındaki PORT değişkenini değiştirin
- Mediasoup hataları için logları kontrol edin
- Tarayıcı konsolu hatalarını inceleyin

## Lisans

Bu proje açık kaynak kodludur.
