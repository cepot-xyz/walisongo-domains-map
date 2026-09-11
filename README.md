# Walisongo Domains Map

Walisongo Domains Map adalah sebuah projek yang memetakan keseluruhan subdomain walisongo.ac.id ke dalam visualisasi 3D interaktif. Projek ini bertujuan untuk memberikan gambaran menyeluruh mengenai infrastruktur web Universitas Islam Negeri (UIN) Walisongo Semarang, mulai dari sistem akademik, portal informasi, situs fakultas, hingga program studi yang tersebar di berbagai subdomain, termasuk juga LPM Pers (lembaga pers mahasiswa) yang tinggal di domain eksternal.

## Demo

Untuk melihat demo langsung di browser, silakan kunjungi:

https://cepot-xyz.github.io/walisongo-domains-map/

## Fitur

- **Visualisasi 3D Interaktif** - 269 subdomain ditampilkan dalam bentuk sphere 3D yang bisa di-drag, di-rotate, dan di-zoom
- **Kategori Warna** - Setiap subdomain dikelompokkan berdasarkan kategori dengan warna yang berbeda:
  - Merah: Core Systems (akademik, sso, siremun, simahad)
  - Kuning: Information Systems
  - Ungu: Program Studi
  - Cyan: Fakultas
  - Pink: LPM Pers (domain eksternal: amanat.id, lpmedukasi.com, justisia.com, dll)
  - Hijau: Lainnya
  - Abu-abu: Dead / Error
- **Pencarian & Tracking** - Cari subdomain tertentu dan pantau posisinya secara real-time di sphere
- **Sidebar** - Legend, statistik, dan filter per kategori
- **Overlay Detail** - Klik node untuk melihat deskripsi naratif dan status subdomain
- **Occlusion System** - Node yang berada di belakang root domain akan tersembunyi secara otomatis
- **Responsive** - Mendukung desktop maupun mobile dengan hamburger menu

## Deskripsi Subdomain

Seluruh 260 subdomain (plus 9 LPM Pers) telah didokumentasikan dengan deskripsi naratif hasil reconnaissance mendalam: platform teknologi (framework/CMS/versi), status HTTP terbaru, layout, hingga temuan teknis seperti header server, cookie, dan API endpoint.

## Tech Stack

- [D3.js](https://d3js.org/) v7 - Library untuk manipulasi DOM dan visualisasi data
- Vanilla JavaScript - Tanpa framework, murni JS
- HTML5 & CSS3

## Cara Menjalankan

Buka `index.html` di browser, atau jalankan server lokal:

```bash
# Menggunakan Python
python -m http.server 8000

# Menggunakan Node.js
npx serve .
```

## Statistik

| Kategori | Jumlah |
|----------|--------|
| Total Subdomain | 269 |
| Active | 141 |
| Dead | 92 |
| Error | 36 |

## License

MIT