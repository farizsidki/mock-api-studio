import { el } from "../utils/dom.js";

export function createDocsView() {
  return {
    mount(container) {
      container.append(el("article", { attrs: { lang: "id" }, children: [
        el("h1", { text: "Dokumentasi" }),
        el("p", { text: "Mock API Studio adalah simulator perilaku backend di browser. Aplikasi ini bukan server, bukan REST API publik, dan tidak menerima panggilan dari Postman atau aplikasi lain." }),
        el("h2", { text: "Yang disimulasikan" }),
        el("p", { text: "Pencocokan method dan path, parameter dinamis, header, body JSON, autentikasi tiruan, delay, response static, serta CRUD collection berjalan di JavaScript lokal." }),
        el("h2", { text: "Autentikasi" }),
        el("p", { text: "Bearer dan API key hanya contoh yang terlihat di browser ini. Keduanya bukan rahasia dan bukan kontrol akses sungguhan." }),
        el("h2", { text: "Data" }),
        el("p", { text: "Workspace tersimpan di localStorage origin ini. Data tidak disinkronkan ke cloud dan tidak dikirim ke layanan analitik. Log sesi hanya ada di memori sampai halaman ditutup atau log dibersihkan." }),
        el("h2", { text: "Query" }),
        el("p", { text: "Query tidak mengubah route. Kunci duplikat mengikuti URLSearchParams: get mengembalikan nilai pertama, getAll mengembalikan semua nilai. Collection MVP tidak memfilter query." }),
        el("h2", { text: "Pintasan" }),
        el("p", { text: "Alt+1 Dashboard, Alt+2 Endpoints, Alt+3 Tester, Alt+4 Collections, Alt+5 Logs, Alt+6 Docs. Pintasan ini tidak jalan saat kursor ada di dalam field. Di Tester, Ctrl+Enter mengirim request." }),
        el("h2", { text: "Cara mencoba" }),
        el("p", { text: "Muat sample workspace dari Dashboard, buka Tester, lalu kirim GET /api/v1/users. Setelah itu coba buat, ubah, dan hapus data lewat endpoint sample." }),
      ] }));
    },
    unmount() {},
  };
}
