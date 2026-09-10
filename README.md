# Walisongo Domains Map

Walisongo Domains Map adalah sebuah projek yang memetakan keseluruhan subdomain walisongo.ac.id ke dalam visualisasi 3D interaktif. Projek ini bertujuan untuk memberikan gambaran menyeluruh mengenai infrastruktur web Universitas Islam Negeri (UIN) Walisongo Semarang, mulai dari sistem akademik, portal informasi, situs fakultas, hingga program studi yang tersebar di berbagai subdomain.

## Demo

Untuk melihat demo langsung di browser, silakan kunjungi:

https://cepot-xyz.github.io/walisongo-domains-map/

## Fitur

- **Visualisasi 3D Interaktif** - 260+ subdomain ditampilkan dalam bentuk sphere 3D yang bisa di-drag, di-rotate, dan di-zoom
- **Kategori Warna** - Setiap subdomain dikelompokkan berdasarkan kategori dengan warna yang berbeda:
  - Merah: Core Systems (akademik, sso, siremun, simahad)
  - Kuning: Information Systems
  - Ungu: Program Studi
  - Cyan: Fakultas
  - Hijau: Lainnya
  - Abu-abu: Dead / Error
- **Pencarian & Tracking** - Cari subdomain tertentu dan pantau posisinya secara real-time di sphere
- **Sidebar** - Legend, statistik, dan filter per kategori
- **Overlay Detail** - Klik node untuk melihat deskripsi dan status subdomain
- **Occlusion System** - Node yang berada di belakang root domain akan tersembunyi secara otomatis
- **Responsive** - Mendukung desktop maupun mobile dengan hamburger menu

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
| Total Subdomain | 260 |
| Active | 131 |
| Dead | 93 |
| Error | 36 |

## License

MIT
