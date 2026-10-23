/**
 * Pesan publik tetap untuk probe kesehatan (M16 / ACT-02).
 *
 * KENAPA dipusatkan: `/api/health` dan `/api/ready` adalah endpoint PUBLIK tanpa
 * auth. `err.message` dari driver PostgreSQL memuat nama host/port/user/database
 * (kadang string koneksi) — informasi yang berguna bagi penyerang, bukan bagi
 * probe. Detail lengkap tetap masuk log server terstruktur (sudah di-scrub).
 *
 * Dulu hanya `/api/health` yang memakai pesan generik; `/api/ready` masih
 * mengembalikan `err.message` mentah. Konstanta ini menutup jalur itu dan
 * mencegah keduanya menyimpang lagi.
 */
export const PUBLIC_DB_DOWN_MESSAGE = "Layanan basis data tidak tersedia.";
