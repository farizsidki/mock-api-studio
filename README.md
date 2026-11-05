# Mock API Studio

Simulator REST API di browser. Bukan backend server, bukan API publik, dan tidak membutuhkan instalasi bagi pengunjung.

Tagline: Build, test, and inspect mock REST APIs — directly in your browser.

## Demo langsung

https://farizsidki.github.io/mock-api-studio/

## Masalah yang diselesaikan

Frontend sering butuh response API saat backend belum ada, saat ingin mencoba variasi response, atau saat ingin menunjukkan alur request tanpa menyiapkan server. Mock API Studio menyediakan workspace lokal untuk mendefinisikan endpoint, mengirim request tiruan, dan melihat log.

## Fitur MVP

- Dashboard, Endpoint Manager, Collection Manager, API Tester, log sesi, dan dokumentasi.
- Route persis dan route dinamis `/:id`.
- Response static dan CRUD collection yang tersimpan di browser.
- Simulasi Bearer token dan API key.
- Delay, import/export workspace, dan sample `users`.

## Arsitektur

```text
UI modules -> services -> localStorage
API Tester -> mock engine -> route matcher + middleware + collection service
```

Engine tidak mengakses DOM dan tidak memanggil jaringan. Semua request diproses oleh `simulateRequest()`.

## Teknologi

HTML, CSS, JavaScript ES Modules, `localStorage`, `node:test`, GitHub Actions, dan GitHub Pages. Tidak ada dependency runtime dan tidak ada bundler.

## Menjalankan secara lokal

Jangan membuka `index.html` lewat `file://`. ES Modules membutuhkan origin HTTP.

```bash
npm start
```

Server statis mendengarkan `http://127.0.0.1:4173`.

## Tes

```bash
npm test
```

Perintah itu menjalankan `node --test`. Tes mencakup route, auth, collection, storage, engine, dan larangan sink berbahaya. Tes tidak membuka browser.

## Data dan privasi

Workspace ada di `localStorage` origin browser. Tidak ada sinkronisasi antarperangkat, tidak ada akun, dan tidak ada telemetri. Autentikasi di aplikasi adalah simulasi. Jangan menyimpan token sungguhan. Log tidak ikut diekspor.

Query duplikat mengikuti `URLSearchParams`: `get` mengembalikan nilai pertama dan `getAll` mengembalikan seluruh nilai. Handler MVP tidak memakai query untuk filter.

## Batasan

- Bukan server HTTP dan tidak membuka port untuk klien lain.
- Tidak meniru seluruh perilaku HTTP atau seluruh fitur Postman.
- Kapasitas mengikuti kuota `localStorage` browser. Import ditolak di atas 2.097.152 byte.
- Jumlah request pada dashboard adalah jumlah log yang masih disimpan, maksimal 200.

## Peta jalan

Belum masuk MVP: pencarian endpoint, duplikasi, riwayat request, skenario response, validasi schema yang lebih kaya, merge import, dan tema terang.

## Lisensi
# MIT License

Copyright (c) 2026 farizsidki

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
