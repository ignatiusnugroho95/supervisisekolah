# SupervisiSekolah.id

Platform Digital Terpadu Supervisi Akademik & Tenaga Kependidikan (Tendik) Sekolah.

## 📌 Gambaran Umum
**SupervisiSekolah.id** dirancang untuk memfasilitasi Kepala Sekolah, Pengawas, Guru, dan Tenaga Kependidikan dalam pelaksanaan supervisi yang komprehensif, berbasis data objektif, serta terintegrasi dengan pembelajaran mendalam (*Deep Learning*), literasi, numerasi, dan analisis AI.

## 🚀 Fitur Utama
1. **Supervisi Akademik**:
   - **Supervisi Pembelajaran (Observasi Kelas)**: 3 Tahap Supervisi Klinis (Pra-Observasi, Observasi Inti, Pasca-Observasi & Coaching).
   - **Telaah Modul Ajar / RPP**: Instrumen penilaian perangkat ajar dengan dukungan analisis AI Gemini & integrasi repositori Google Drive.
   - **Supervisi BK (Bimbingan Konseling)**: Supervisi layanan konseling, asesmen kebutuhan, dan tindak lanjut.
2. **Supervisi Tendik (Tenaga Kependidikan)**:
   - Supervisi Kepala TU, Pengadministrasi, Tenaga Perpustakaan, Pengelola Laboratorium, Kebersihan, dan Satpam/Keamanan.
3. **Portal Mandiri GTK**:
   - Autentikasi 1 pintu untuk seluruh pendidik dan tenaga kependidikan.
4. **Dashboard Pimpinan (Kepala Sekolah & Pengawas)**:
   - Rekapitulasi nilai, grafik ketercapaian indikator, jadwal supervisi, dan ekspor laporan resmi (PDF & Excel).
5. **Manajemen Periode & Repositori**:
   - Pengaturan siklus tahun ajaran & semester, pemilihan kategori/indikator dinamis, serta integrasi folder Google Drive untuk bukti dokumen dan dokumentasi observasi.

## 🛠️ Arsitektur & Teknologi
- **Backend**: PHP (PDO MySQL / MariaDB)
- **Database**: MySQL / MariaDB (Multi-tenant & Single Source of Truth)
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS
- **Library & Integrasi**:
  - Google Gemini AI API
  - jsPDF & jsPDF-AutoTable (Ekspor PDF)
  - SheetJS / xlsx (Ekspor Excel)
  - SweetAlert2
  - FontAwesome & Material Symbols

## 📦 Instalasi & Menjalankan Lokal
1. Pindahkan atau clone repository ke folder web server Anda (misal: `c:/xampp/htdocs/supervisisekolah.id`).
2. Buat database di MySQL (misal: `supervisisekolah_id`).
3. Import file database `supervisisekolah_id.sql`.
4. Sesuaikan konfigurasi koneksi pada `config/database.php` bila diperlukan.
5. Akses website melalui peramban: `http://localhost/supervisisekolah.id/` atau port Apache Anda.

---
© SupervisiSekolah.id. All rights reserved.
