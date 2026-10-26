/**
 * supervisisekolah.id - Supervisi Tenaga Kependidikan (Tendik) Module
 * Menyediakan 7 Instrumen Standar Kemendikbudristek & Ditjen GTK:
 * 1. Kepala Tenaga Administrasi Sekolah (KTAS)
 * 2. Pelaksana Urusan Administrasi Persuratan dan Pengarsipan
 * 3. Pelaksana Urusan Sarana dan Prasarana
 * 4. Petugas Layanan Khusus Tenaga Kebersihan (OB/Kebersihan)
 * 5. Kepala / Pengelola Perpustakaan Sekolah
 * 6. Kepala / Petugas Laboratorium Sekolah
 * 7. Petugas Layanan Khusus Keamanan / Penjaga Sekolah (Security)
 */

const KS_TENDIK = {
  // Definisi Lengkap 7 Instrumen Supervisi Tenaga Kependidikan
  INSTRUMENTS: {
    ktas: {
      key: 'ktas',
      title: 'Kepala Tenaga Administrasi Sekolah (KTAS)',
      subtitle: 'Standar Kompetensi Manajerial, Teknis Administrasi & Kepemimpinan TAS',
      roleBadge: 'Kepala TU / TAS',
      color: 'amber',
      items: [
        { no: 1, text: 'Memahami pokok-pokok peraturan kepegawaian berdasarkan standar pendidik dan tenaga kependidikan', evidence: 'Dokumen UU ASN, Permendiknas No. 24/2008, PP Manajemen Pegawai' },
        { no: 2, text: 'Melaksanakan administrasi kepegawaian secara tertib, mutakhir, dan akurat', evidence: 'Buku Induk Pegawai, DUK, Berkas Portofolio Pegawai, Arsip SK & Kenaikan Pangkat' },
        { no: 3, text: 'Melaksanakan administrasi keuangan secara transparan, akuntabel, dan tepat waktu', evidence: 'Buku Kas Umum (BKU), Buku Pembantu Kas/Bank, SPJ, LPJ Dana BOS/BOP' },
        { no: 4, text: 'Melaksanakan administrasi sarana dan prasarana sekolah', evidence: 'Buku Inventaris Barang (KIR), Buku Penerimaan/Pengeluaran Barang, Kartu Inventaris Ruangan' },
        { no: 5, text: 'Melaksanakan administrasi hubungan sekolah dengan masyarakat (Humas)', evidence: 'Buku Tamu Umum/Dinas, Notula Rapat Komite, Buku Kemitraan Lembaga Eksternal' },
        { no: 6, text: 'Melaksanakan administrasi persuratan dan pengarsipan terstruktur', evidence: 'Buku Agenda Surat Masuk/Keluar, Lembar Disposisi, Buku Ekspedisi, Filling Cabinet' },
        { no: 7, text: 'Melaksanakan administrasi kesiswaan secara terpadu', evidence: 'Buku Induk Siswa, Buku Klapper, Daftar Mutasi, Presensi Siswa, Dokumen PPDB' },
        { no: 8, text: 'Melaksanakan administrasi kurikulum dan pembelajaran', evidence: 'Kalender Pendidikan, Jadwal Pelajaran, Dokumen KSP/KTSP, Pembagian Jam Mengajar' },
        { no: 9, text: 'Melaksanakan administrasi layanan khusus (UKS, Kantin, Satpam, Kebersihan)', evidence: 'SOP Layanan Khusus, Jadwal Piket Pelayanan, Laporan Supervisi Internal' },
        { no: 10, text: 'Menerapkan Teknologi Informasi dan Komunikasi (TIK) dalam tata kelola administrasi', evidence: 'Pengelolaan Akun Dapodik, Portal Resmi, Aplikasi Persuratan/Office Digital' },
        { no: 11, text: 'Mendukung pengelolaan dan pemenuhan 8 Standar Nasional Pendidikan (SNP)', evidence: 'Dokumen EDS/PBD, Rencana Kerja Jangka Menengah (RKJM), RKT & RKAS' },
        { no: 12, text: 'Menyusun program kerja tahunan dan program semester Tenaga Administrasi Sekolah', evidence: 'Buku Program Kerja KTAS, Target Kinerja Tahunan, Jadwal Kegiatan Administrasi' },
        { no: 13, text: 'Mengorganisasikan dan membagi tugas staf administrasi secara proporsional', evidence: 'SK Pembagian Tugas Staf TAS, Job Description tertulis, Struktur Organisasi TU' },
        { no: 14, text: 'Mengembangkan dan membina kompetensi staf tata usaha', evidence: 'Program Pelatihan Internal/Diklat, Notula Rapat Pembinaan Rutin, Evaluasi Kinerja Staf' },
        { no: 15, text: 'Mengambil keputusan internal tata kelola kantor secara tepat dan bertanggung jawab', evidence: 'Notula Pengambilan Keputusan, Berita Acara Rapat Internal, SOP Penyelesaian Masalah' },
        { no: 16, text: 'Menciptakan iklim kerja kantor yang kondusif, harmonis, dan komunikatif', evidence: 'Suasana Ruang TU Nyaman, Tata Ruang 5R (Ringkas, Rapi, Resik, Rawat, Rajin)' },
        { no: 17, text: 'Mengoptimalkan pemanfaatan sumber daya kantor secara efisien dan hemat', evidence: 'Rekap Efisiensi ATK, Penggunaan Listrik & Internet, Jadwal Pemeliharaan Alat Kantor' },
        { no: 18, text: 'Menyusun laporan pertanggungjawaban pelaksanaan tugas berkala kepada Kepala Sekolah', evidence: 'Laporan Bulanan, Semesteran, dan Laporan Tahunan TAS resmi tertanda tangan' }
      ]
    },

    persuratan: {
      key: 'persuratan',
      title: 'Pelaksana Urusan Administrasi Persuratan dan Pengarsipan',
      subtitle: 'Standar Tertib Persuratan, Buku Kendali, Kearsipan & Dokumentasi SK Sekolah',
      roleBadge: 'Staf Administrasi / Arsiparis',
      color: 'blue',
      items: [
        { no: 1, text: 'Agenda Surat Masuk', evidence: 'Buku Agenda Surat Masuk terisi lengkap (No, Tgl Terima, Asal, Perihal, No Surat)' },
        { no: 2, text: 'Agenda Surat Keluar', evidence: 'Buku Agenda Surat Keluar tertata urut sesuai kode klasifikasi persuratan' },
        { no: 3, text: 'Buku Ekspedisi', evidence: 'Buku Ekspedisi tanda terima berkas/surat ke pihak internal maupun eksternal' },
        { no: 4, text: 'Buku Kendali Surat Masuk', evidence: 'Lembar/Buku Kendali pemantauan alur disposisi surat masuk dari Kepala Sekolah' },
        { no: 5, text: 'Buku Kendali Surat Keluar', evidence: 'Dokumen verifikasi paraf konsep surat sebelum penandatanganan Kepala Sekolah' },
        { no: 6, text: 'Arsip Surat Masuk', evidence: 'Map/Ordner arsip fisik surat masuk tersusun rapi sesuai tanggal/kode klasifikasi' },
        { no: 7, text: 'Arsip Surat Keluar', evidence: 'Map/Ordner arsip pertinggal/tembusan surat keluar lengkap dengan lampiran' },
        { no: 8, text: 'Buku Catatan Guru/TU Mengikuti Diklat/MGMP/Sejenisnya', evidence: 'Buku rekaman surat tugas, peserta diklat, waktu, dan penyerahan sertifikat/laporan' },
        { no: 9, text: 'Buku Catatan Lomba dan Kegiatan Sekolah', evidence: 'Buku dokumentasi surat undangan, delegasi lomba siswa/guru, dan perolehan prestasi' },
        { no: 10, text: 'Kumpulan SK Pembagian Tugas Guru dan Staf TU', evidence: 'Buku bundel SK Pembagian Jam Mengajar & Rincian Tugas Pegawai per semester' },
        { no: 11, text: 'Kumpulan SK Kepanitiaan Kegiatan Sekolah', evidence: 'SK Panitia Ujian/Asesmen, PPDB, Peringatan Hari Besar, Akreditasi, Study Tour' },
        { no: 12, text: 'Surat Izin Guru / Karyawan', evidence: 'Formulir surat izin/cuti/sakit resmi guru dan staf yang telah disetujui pimpinan' }
      ]
    },

    sarpras: {
      key: 'sarpras',
      title: 'Pelaksana Urusan Sarana dan Prasarana',
      subtitle: 'Standar Pemeliharaan Tanah, Gedung, Ruang Belajar, Lab, Sanitasi & Perlengkapan',
      roleBadge: 'Staf Urusan Sarpras',
      color: 'emerald',
      sections: [
        {
          group: 'A. Kepemilikan',
          items: [
            { no: 1, text: 'Tanah milik sendiri / legalitas sertifikat resmi', evidence: 'Sertifikat Hak Milik (SHM) / Hak Guna Bangunan / Hibah / Izin Pemanfaatan' },
            { no: 2, text: 'Gedung milik sendiri / status pemanfaatan sah', evidence: 'IMB/PBG, Berita Acara Serah Terima Gedung, Buku Induk Bangunan' },
            { no: 3, text: 'Tanah dan gedung dimanfaatkan optimal untuk kegiatan sekolah', evidence: 'Denah Tata Ruang Sekolah (Master Plan), Zonasi Area Belajar & Ekstrakurikuler' }
          ]
        },
        {
          group: 'B. Ruang Belajar',
          items: [
            { no: 4, text: 'Jumlah ruang belajar cukup untuk menampung semua rombongan belajar (rombel)', evidence: 'Data jumlah rombel setara dengan jumlah ruang kelas layak pakai' },
            { no: 5, text: 'Luas setiap ruang belajar sesuai dengan standar rasio per kelas', evidence: 'Ukuran ruang belajar proporsional (min. 2 m² per peserta didik)' },
            { no: 6, text: 'Kondisi ruang kelas terang, bersih, sirkulasi udara baik, dan nyaman', evidence: 'Ventilasi udara memadai, pencahayaan alami/buatan cukup, cat dinding bersih' },
            { no: 7, text: 'Kelengkapan perabot kelas (meja, kursi, papan tulis, lemari) baik dan terawat', evidence: 'Meja kursi siswa & guru kokoh, papan tulis bersih, ada tempat sampah di kelas' }
          ]
        },
        {
          group: 'C. Ruang dan Sarana Penunjang',
          items: [
            { no: 8, text: 'Ruang laboratorium (Komputer/IPA/Bahasa) berfungsi aktif', evidence: 'Ruang lab bersih, ada penanggung jawab, alat tertata, ada jadwal praktikum' },
            { no: 9, text: 'Ruang perpustakaan yang didayagunakan secara optimal', evidence: 'Kondisi perpus representatif, buku tertata, ruang baca bersih dan diminati siswa' },
            { no: 10, text: 'Ruang Kepala Sekolah dan Wakil Kepala Sekolah bersih dan terawat', evidence: 'Perabot pimpinan rapi, fasilitas kerja lengkap, papan data sekolah terpasang' },
            { no: 11, text: 'Ruang TU/Administrasi lengkap dengan komputer dan perlengkapan bersih terawat', evidence: 'Komputer/printer aktif, berkas tertata dalam rak/lemari, ruang kerja kondusif' },
            { no: 12, text: 'Ruang guru cukup luas, ada meja kerja, locker, bersih dan terawat', evidence: 'Setiap guru memiliki meja/kursi kerja pribadi, locker aman, ruang istirahat bersih' },
            { no: 13, text: 'Ruang BK memadai, privat, bersih, dan nyaman untuk konseling', evidence: 'Ruang konseling individual tertutup, ruang relaksasi, arsip kasus tersimpan rahasia' },
            { no: 14, text: 'Ruang ibadah (Musholla/Masjid/Kapel) dan perlengkapannya bersih terawat', evidence: 'Tempat wudhu mengalir, karpet bersih wangi, mukena/sarung/kitab suci tersusun rapi' },
            { no: 15, text: 'Ruang OSIS dengan perabot bersih dan terawat', evidence: 'Struktur pengurus terpajang, meja rapat pengurus ada, dokumen kegiatan rapi' },
            { no: 16, text: 'Ruang UKS dengan tempat tidur, obat-obatan standar, bersih dan terawat', evidence: 'Tempat tidur pasien bersih, timbangan/pengukur tinggi, kotak P3K lengkap exp date' },
            { no: 17, text: 'Aula / ruang serba guna untuk pertemuan dan kegiatan gabungan', evidence: 'Kapasitas memadai, sound system berfungsi, kursi lipat/tata panggung terawat' },
            { no: 18, text: 'Lapangan upacara dan lapangan olahraga yang memadai', evidence: 'Permukaan lapangan rata, tiang bendera kokoh, garis lapangan olahraga jelas' },
            { no: 19, text: 'Sarana dan peralatan olahraga serta seni budaya lengkap', evidence: 'Bola, net, matras, raket, alat musik sekolah tersimpan aman di gudang sarpras' },
            { no: 20, text: 'Media pembelajaran (Proyektor/LCD, Smart TV, Audio) memadai', evidence: 'LCD proyektor per ruang/mobile berfungsi normal, layar proyektor tersedia' }
          ]
        },
        {
          group: 'D. Sarana Lain',
          items: [
            { no: 21, text: 'Instalasi air bersih dan jaringan listrik aman serta stabil', evidence: 'Suplai air bersih mengalir lancar ke semua kran, meteran listrik & panel MCB aman' },
            { no: 22, text: 'Jaringan telepon dan akses internet (Wi-Fi) berkecepatan cukup', evidence: 'Router/Access Point terpasang di area strategis, bandwidth stabil untuk KBM' },
            { no: 23, text: 'Kantin sekolah bersih, higienis, dan tersedia tempat pembuangan sampah', evidence: 'Makanan tertutup aman, cuci piring higienis, tempat sampah organik/anorganik ada' },
            { no: 24, text: 'WC / Toilet jumlahnya cukup, terpisah siswa putra/putri/guru, bersih dan terawat', evidence: 'Air tidak berbau, closet bersih, sabun cuci tangan ada, kunci pintu berfungsi' }
          ]
        }
      ]
    },

    kebersihan: {
      key: 'kebersihan',
      title: 'Petugas Layanan Khusus Tenaga Kebersihan (OB/Kebersihan)',
      subtitle: 'Standar Pemeliharaan Kebersihan Ruang, Toilet, Halaman, & Alat Kerja',
      roleBadge: 'Petugas Kebersihan / Office Boy',
      color: 'teal',
      items: [
        { no: 1, text: 'Pendayagunaan peralatan kebersihan secara efektif dan tepat fungsi', evidence: 'Penggunaan sapu, alat pel, pembersih kaca, sikat toilet, vacum/mesin rumput sesuai SOP' },
        { no: 2, text: 'Pemeliharaan dan penyimpanan peralatan kebersihan secara tertib', evidence: 'Peralatan dibersihkan setelah pakai, disimpan pada gudang kebersihan khusus, tidak berserakan' },
        { no: 3, text: 'Mewujudkan kebersihan lingkungan sekolah (halaman, selokan, taman, lapangan)', evidence: 'Halaman bebas sampah daun/plastik, saluran air lancar tidak menggenang, tanaman terpangkas rapi' },
        { no: 4, text: 'Mewujudkan kebersihan ruangan, kamar mandi/toilet, koridor, dan sarana umum sekolah', evidence: 'Lantai kelas/guru berkilau, kaca bening, toilet harum tidak berkerak, tempat sampah dikosongkan tiap sore' }
      ]
    },

    perpustakaan: {
      key: 'perpustakaan',
      title: 'Kepala / Pengelola Perpustakaan Sekolah',
      subtitle: 'Standar Layanan Bahan Pustaka, Klasifikasi DDC, Katalog, Sirkulasi & Pelaporan',
      roleBadge: 'Kepala / Pengelola Perpus',
      color: 'indigo',
      sections: [
        {
          group: 'Aspek 1 - 3: Tata Kelola & Program',
          items: [
            { no: 1, text: 'Ketersediaan dan kelayakan Ruang Perpustakaan', evidence: 'Ruang ber-AC/ventilasi cukup, pencahayaan terang, tenang, dan kapasitas baca memadai' },
            { no: 2, text: 'Kualifikasi, kompetensi, dan komitmen Pengelola Perpustakaan', evidence: 'SK Penugasan Pengelola, sertifikat bimtek/diklat kepustakawanan, kehadiran aktif' },
            { no: 3, text: 'Program kerja tahunan dan program semester perpustakaan sekolah', evidence: 'Buku Rencana Kerja Perpus, target penambahan buku, jadwal jam literasi kelas' }
          ]
        },
        {
          group: 'Aspek 4: Perlengkapan Administrasi Perpustakaan',
          items: [
            { no: 4, text: 'a. Buku Induk Perpustakaan', evidence: 'Buku Induk Pustaka mencatat semua judul, pengarang, penerbit, sumber perolehan buku' },
            { no: 5, text: 'b. Klasifikasi Buku (Sistem DDC - Dewey Decimal Classification)', evidence: 'Buku diberi nomor panggil (call number) DDC pada punggung buku secara konsisten' },
            { no: 6, text: 'c. Katalog Perpustakaan (Katalog Manual / OPAC Digital)', evidence: 'Tersedia laci kartu katalog atau software sistem perpustakaan digital (SLiMS/e-perpus)' },
            { no: 7, text: 'd. Kartu Anggota / Kartu Peminjam Siswa dan Guru', evidence: 'Kartu perpustakaan berfoto/barcode terbagikan kepada seluruh warga sekolah' },
            { no: 8, text: 'e. Buku Peminjam dan Pengembalian (Buku Sirkulasi)', evidence: 'Pencatatan sirkulasi harian rapi, tertib tanggal batas kembali dan penanganan denda' },
            { no: 9, text: 'f. Daftar Pengunjung / Buku Kunjungan Harian', evidence: 'Buku presensi kunjungan perpus terisi harian oleh siswa dan guru per kelas' },
            { no: 10, text: 'g. Kartu Buku, Kantong Buku, dan Slip Tanggal Kembali', evidence: 'Kelengkapan fisik di bagian belakang dalam setiap buku pinjaman' }
          ]
        },
        {
          group: 'Aspek 5 - 8: Penyimpanan, Pemeliharaan & Pelaporan',
          items: [
            { no: 11, text: 'Tempat Penyimpanan: Lemari Buku Khusus / Koleksi Referensi', evidence: 'Lemari kaca terkunci untuk kamus, ensiklopedia, dan karya tandon referensi' },
            { no: 12, text: 'Tempat Penyimpanan: Rak Buku Terbuka dan Terlabel Jelas', evidence: 'Rak buku besi/kayu kuat, label kategori genre/nomor DDC terlihat jelas' },
            { no: 13, text: 'Tempat Penyimpanan: Meja Baca dan Kursi Nyaman', evidence: 'Meja baca kelompok, meja lesehan, dan kursi baca dalam kondisi bersih & terawat' },
            { no: 14, text: 'Pemeliharaan: Perawatan Fisik Ruang Perpustakaan', evidence: 'Bebas rayap, kelembaban terjaga, ada kapur barus/silica gel di sudut rak' },
            { no: 15, text: 'Pemeliharaan: Perawatan Fisik Koleksi Buku (Restorasi & Sampul)', evidence: 'Buku rusak segera dilem/dijilid ulang, sebagian besar buku tersampul rapi' },
            { no: 16, text: 'Pemeliharaan: Kebersihan Ruang dan Rak Buku', evidence: 'Rak bebas debu, lantai perpus bersih, dilarang membawa makanan/minuman' },
            { no: 17, text: 'Tata Tertib Perpustakaan Terpasang dan Ditegakkan', evidence: 'Papan tata tertib perpus terpasang di dinding, aturan denda/sanksi ditaati' },
            { no: 18, text: 'Laporan Berkala dan Statistik Sirkulasi Perpustakaan', evidence: 'Laporan statistik buku paling sering dipinjam, pengunjung terbanyak, laporan per semester' }
          ]
        }
      ]
    },

    laboratorium: {
      key: 'laboratorium',
      title: 'Kepala / Petugas Laboratorium Sekolah',
      subtitle: 'Standar Kesiapan Praktikum, Tata Tertib, SOP Bahan Kimia, K3, APAR & P3K',
      roleBadge: 'Kepala Lab / Laboran',
      color: 'rose',
      items: [
        { no: 1, text: 'Ruang Laboratorium (IPA/Komputer/Bahasa) layak, aman, dan memadai', evidence: 'Luas ruang cukup, meja praktikum berwashtafel/instalasi stopkontak aman, ventilasi luas' },
        { no: 2, text: 'Pengelolaan dan Struktur Organisasi Laboratorium', evidence: 'SK Kepala Lab & Teknisi/Laboran, pembagian tugas jelas, visi praktikum sekolah' },
        { no: 3, text: 'Jadwal Penggunaan Laboratorium Terkoordinasi', evidence: 'Bagan jadwal pemakaian lab per kelas terpasang di pintu lab, tidak terjadi tumpang tindih' },
        { no: 4, text: 'Tata Tertib Laboratorium Terpasang dan Ditaati', evidence: 'Plang Tata Tertib Siswa di Lab, kewajiban jas lab/larangan makan minum ditaati' },
        { no: 5, text: 'Daftar Ketersediaan dan Mutasi Bahan Praktikum', evidence: 'Buku inventaris bahan kimia/reagen/komponen habis pakai dengan tanggal kedaluwarsa' },
        { no: 6, text: 'Daftar Inventaris dan Kondisi Alat Laboratorium', evidence: 'Buku induk alat lab, kartu kontrol kondisi (Baik, Rusak Ringan, Rusak Berat)' },
        { no: 7, text: 'Daftar dan Laporan Hasil Pelaksanaan Praktikum Siswa', evidence: 'Buku jurnal praktikum harian guru, sampel laporan praktikum siswa tersimpan' },
        { no: 8, text: 'Penempatan dan Penyimpanan Alat serta Bahan sesuai SOP Keselamatan', evidence: 'Bahan kimia berbahaya dalam lemari asam/khusus bertanda bahaya (MSDS), alat gelas rapi' },
        { no: 9, text: 'Pemeliharaan Rutin Ruang Laboratorium dan Instrumen Alat', evidence: 'Mikroskop/komputer dibersihkan rutin, kalibrasi berkala, ruang bebas debu' },
        { no: 10, text: 'Ketersediaan dan Kesiapan Alat Pemadam Api Ringan (APAR)', evidence: 'Tabung APAR dalam masa berlaku aktif, terletak di posisi mudah dijangkau, instruksi jelas' },
        { no: 11, text: 'Ketersediaan dan Kelengkapan Kotak Pertolongan Pertama Pada Kecelakaan (PPPK)', evidence: 'Kotak P3K berisi kasa steril, antiseptik, plester, obat luka bakar ringan lengkap dan belum kedaluwarsa' }
      ]
    },

    keamanan: {
      key: 'keamanan',
      title: 'Pelaksana Urusan Layanan Khusus Keamanan / Penjaga Sekolah',
      subtitle: 'Standar Keamanan Lingkungan, Buku Tamu, Akses Gerbang, Patroli & Kamtibmas',
      roleBadge: 'Petugas Keamanan / Satpam',
      color: 'cyan',
      items: [
        { no: 1, text: 'Pemantauan dan penjaminan keamanan ketertiban lingkungan sekolah', evidence: 'Area sekolah terpantau kondusif, tidak ada gangguan orang luar/ancaman luar' },
        { no: 2, text: 'Pengelolaan Buku Tamu dan Identifikasi Tamu / Pengunjung Sekolah', evidence: 'Buku Tamu di Pos Satpam terisi identitas, keperluan, serta penukaran ID Card Tamu' },
        { no: 3, text: 'Pengawasan keluar masuk peserta didik, guru, karyawan, dan kendaraan', evidence: 'Pemeriksaan surat izin keluar siswa jam sekolah, pengawasan penjemputan anak' },
        { no: 4, text: 'Pelaksanaan tugas jaga dan patroli keliling berkala (siang/malam)', evidence: 'Buku Jurnal Mutasi Piket Satpam mencatat hasil patroli gedung ruang demi ruang' },
        { no: 5, text: 'Pemeriksaan dan penguncian gerbang, pintu gedung, jendela, dan fasilitas', evidence: 'Semua pintu ruang kelas/lab/kantor dipastikan terkunci setelah KBM berakhir' },
        { no: 6, text: 'Pemeliharaan pos keamanan, sarana komunikasi (HT), dan peralatan jaga', evidence: 'Pos Satpam bersih, senter, tongkat T, jas hujan, rompi reflektor siap pakai' },
        { no: 7, text: 'Koordinasi dengan pihak kepolisian, babinsa, dan lingkungan RT/RW sekitar', evidence: 'Nomor darurat Polsek/Babinsa/Damkar tertempel, komunikasi lingkungan terjalin' },
        { no: 8, text: 'Kesiapsiagaan dan ketanggapan penanganan keadaan darurat / bahaya', evidence: 'Mengetahui jalur evakuasi, titik kumpul aman, dan penanganan insiden awal' },
        { no: 9, text: 'Pengaturan kelancaran lalu lintas gerbang masuk dan keluar siswa', evidence: 'Penyeberangan siswa di depan gerbang pagi dan sore hari terkoordinasi aman' },
        { no: 10, text: 'Penataan area parkir kendaraan siswa/guru dan pencatatan kejadian harian', evidence: 'Sepeda motor/mobil terparkir rapi dalam batas garis, helm dan barang berharga aman' }
      ]
    }
  },

  // Mendapatkan flat list items untuk sebuah instrumen
  getFlatItems(instrumentKey) {
    const inst = this.INSTRUMENTS[instrumentKey];
    if (!inst) return [];
    if (inst.items) return inst.items;
    if (inst.sections) {
      let result = [];
      inst.sections.forEach(sec => {
        result = result.concat(sec.items);
      });
      return result;
    }
    return [];
  },

  // Hitung Skor & Predikat Ketercapaian
  calculateScore(scores, instrumentKey) {
    const items = this.getFlatItems(instrumentKey);
    const maxItemScore = 5;
    const maxScore = items.length * maxItemScore;
    
    let totalScore = 0;
    let filledCount = 0;

    items.forEach(item => {
      const val = parseInt(scores[item.no] || 0, 10);
      if (val > 0) {
        totalScore += val;
        filledCount++;
      }
    });

    const percentage = maxScore > 0 ? ((totalScore / maxScore) * 100).toFixed(1) : 0;
    const numPct = parseFloat(percentage);

    // Ketercapaian Predikat Sesuai Dokumen Resmi:
    // 86 - 100 % = A (Amat Baik)
    // 70 - 85 %  = B (Baik)
    // 55 - 69 %  = C (Cukup)
    // < 55 %     = D (Kurang)
    let predicate = 'D';
    let predicateLabel = 'Kurang';
    let badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';

    if (numPct >= 86) {
      predicate = 'A';
      predicateLabel = 'Amat Baik';
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (numPct >= 70) {
      predicate = 'B';
      predicateLabel = 'Baik';
      badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
    } else if (numPct >= 55) {
      predicate = 'C';
      predicateLabel = 'Cukup';
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
    }

    return {
      totalScore,
      maxScore,
      percentage: numPct,
      predicate,
      predicateLabel,
      badgeClass,
      filledCount,
      totalItems: items.length,
      isComplete: filledCount === items.length
    };
  },

  // Generator Catatan & Rekomendasi Pintar (Offline / Fallback AI)
  generateSmartRecommendation(instrumentKey, employeeName, percentage, predicate) {
    const inst = this.INSTRUMENTS[instrumentKey] || { title: 'Tenaga Kependidikan' };
    const name = employeeName || 'Petugas';

    const strengthsPool = {
      ktas: [
        `Saudara ${name} menunjukkan kepemimpinan manajerial yang sangat tertib dalam koordinasi administrasi sekolah. Portofolio kepegawaian, tata persuratan, dan penataan arsip digital terpelihara dengan rapi.`,
        `Kinerja ${name} sangat solid dalam mendukung ketercapaian 8 Standar Nasional Pendidikan (SNP) dan penyusunan laporan keuangan BOS/BOP yang akuntabel.`,
        `Komunikasi interpersonal antar-staf tata usaha dan koordinasi dengan kepala sekolah berjalan harmonis, tanggap, dan adaptif terhadap penggunaan TIK.`
      ],
      persuratan: [
        `Pengelolaan buku agenda surat masuk dan surat keluar oleh ${name} sangat terstruktur. Alur disposisi pimpinan tercatat dengan baik pada buku kendali.`,
        `Tertib pengarsipan surat keputusan (SK pembagian tugas guru dan staf) tersusun urut tahunan dan mudah ditelusuri saat dibutuhkan audit pengawas.`,
        `Pemberkasan surat keluar dan surat izin guru/karyawan didokumentasikan rapi secara fisik maupun digital.`
      ],
      sarpras: [
        `Inventarisasi sarana dan prasarana oleh ${name} sangat mutakhir. Kartu Inventaris Ruangan (KIR) terpasang di setiap ruang kelas dan laboratorium.`,
        `Pemeliharaan gedung, sanitasi toilet, dan instalasi air bersih/listrik ditangani dengan responsif dan selalu siap pakai untuk kegiatan belajar.`,
        `Pengelolaan aset dan bukti legalitas tanah/gedung sekolah terdokumentasi aman dan terpantau dengan baik.`
      ],
      kebersihan: [
        `Saudara ${name} memiliki etos kerja yang tinggi dalam menjaga higienitas dan keasrian lingkungan sekolah, toilet, serta ruang belajar.`,
        `Pendayagunaan dan perawatan alat kebersihan dilakukan dengan disiplin, lingkungan sekolah bersih bebas genangan air dan sampah.`,
        `Kedisiplinan waktu dalam membersihkan ruang guru dan kelas sebelum KBM dimulai patut diapresiasi.`
      ],
      perpustakaan: [
        `Pengelolaan bahan pustaka oleh ${name} sangat sistematis dengan penerapan klasifikasi DDC yang akurat pada setiap punggung buku.`,
        `Layanan sirkulasi peminjaman buku aktif, ruang baca nyaman, serta program pojok literasi berjalan dinamis meningkatkan minat baca siswa.`,
        `Pencatatan buku induk dan inventarisasi buku referensi terpelihara dengan sangat baik dan terhindar dari kerusakan.`
      ],
      laboratorium: [
        `Pengaturan jadwal praktikum dan penataan alat bahan laboratorium oleh ${name} memenuhi standar K3 yang aman dan higienis.`,
        `Daftar inventaris bahan praktikum lengkap dengan masa kedaluwarsa, dan kesiapsiagaan APAR serta kotak P3K dalam kondisi prima.`,
        `Pemeliharaan mikroskop dan instrumen praktikum dilakukan secara berkala sehingga praktikum siswa selalu terlaksana lancar.`
      ],
      keamanan: [
        `Kedisiplinan Saudara ${name} dalam pengawasan gerbang utama, pemeriksaan buku tamu, dan patroli lingkungan sangat memberikan rasa aman.`,
        `Penataan parkir kendaraan siswa/guru tertib, pengaturan lalu lintas saat jam masuk/pulang berjalan lancar dan ramah.`,
        `Koordinasi dengan aparat kamtibmas wilayah terjalin harmonis, serta kesiapsiagaan menghadapi kondisi darurat sangat baik.`
      ]
    };

    const recommendationsPool = {
      high: [
        `Pertahankan keunggulan kinerja saat ini dan jadikan praktik baik (best practices) ini sebagai rujukan bagi unit kerja lainnya di sekolah.`,
        `Tingkatkan digitalisasi sistem pencatatan berbasis cloud agar dokumen dapat diakses secara cepat dan terintegrasi dengan portal kepala sekolah.`,
        `Ikuti pelatihan pengayaan kompetensi lanjutan tingkat kabupaten/provinsi guna memperluas wawasan manajerial dan teknologi kerja.`
      ],
      medium: [
        `Perlu meningkatkan ketertiban pembukuan berkala dan penjadwalan pemeliharaan preventif secara lebih terdokumentasi.`,
        `Disarankan melengkapi bukti fisik pendukung yang masih berskala cukup, terutama pada aspek pengarsipan berkas dan SOP tertulis.`,
        `Lakukan koordinasi berkala dua mingguan bersama Kepala Sekolah untuk mengevaluasi hambatan teknis operasional di lapangan.`
      ],
      low: [
        `Wajib menyusun rencana aksi perbaikan (remedial action plan) dalam kurun waktu 30 hari ke depan dengan pendampingan langsung KTAS/Kepala Sekolah.`,
        `Perlu restrukturisasi tata kelola dan penataan ulang seluruh bukti fisik instrumen agar sesuai standar mutu yang ditentukan.`,
        `Akan dijadwalkan supervisi ulang untuk memverifikasi tindak lanjut perbaikan butir-butir yang bernilai di bawah standar.`
      ]
    };

    const instList = strengthsPool[instrumentKey] || strengthsPool.ktas;
    const strength = instList[Math.floor(Math.random() * instList.length)];

    let recList = recommendationsPool.medium;
    if (percentage >= 86) recList = recommendationsPool.high;
    else if (percentage < 70) recList = recommendationsPool.low;

    const followUp = recList[Math.floor(Math.random() * recList.length)];

    return {
      strength,
      followUp,
      combinedCatatan: `${strength}\n\nTindak Lanjut:\n${followUp}`
    };
  },

  // Resolusi Base URL API secara dinamis
  getApiUrl(action) {
    if (window.KS_AUTH && typeof window.KS_AUTH.getBaseUrl === 'function') {
      return window.KS_AUTH.getBaseUrl() + 'api.php?action=' + action;
    }
    const path = window.location.pathname;
    const base = path.includes('/tendik/') ? '../' : './';
    return base + 'api.php?action=' + action;
  },

  // Simpan Hasil Supervisi Tendik ke API Database (dengan fallback offline)
  async saveToApi(supervisionData) {
    const activeSid = (window.KS_AUTH && typeof window.KS_AUTH.getActiveSchoolId === 'function')
      ? window.KS_AUTH.getActiveSchoolId()
      : (supervisionData.school_id || supervisionData.schoolId || 'SCH-001');

    supervisionData.school_id = activeSid;
    supervisionData.schoolId = activeSid;

    const url = this.getApiUrl('save_supervisi_tendik');
    try {
      const resp = await (window.KS_AUTH && typeof window.KS_AUTH.fetchWithAuth === 'function'
        ? window.KS_AUTH.fetchWithAuth(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supervisionData)
          })
        : fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supervisionData)
          }));
      const res = await resp.json();
      if (res.success) {
        this.saveToLocalStorage(supervisionData, activeSid);
        return { success: true, id: res.id, data: res.supervisi_tendik };
      }
    } catch (e) {
      console.warn('[Tendik API Save] Gagal menyimpan ke server, menyimpan ke local storage:', e);
    }
    // Fallback simpan local
    this.saveToLocalStorage(supervisionData, activeSid);
    return { success: true, id: supervisionData.id, local: true, data: supervisionData };
  },

  // Ambil Data Supervisi Tendik dari API (dengan fallback local)
  async fetchFromApi(filters = {}) {
    const activeSid = (window.KS_AUTH && typeof window.KS_AUTH.getActiveSchoolId === 'function')
      ? window.KS_AUTH.getActiveSchoolId()
      : (filters.school_id || 'SCH-001');

    let url = this.getApiUrl('get_supervisi_tendik');
    const params = new URLSearchParams();
    params.append('school_id', activeSid);
    if (filters.academic_year) params.append('academic_year', filters.academic_year);
    if (filters.semester) params.append('semester', filters.semester);
    if (filters.all_cycles) params.append('all_cycles', '1');
    if (filters.employee_name) params.append('employee_name', filters.employee_name);
    if (filters.instrument_type) params.append('instrument_type', filters.instrument_type);

    url += '&' + params.toString();

    try {
      const resp = await (window.KS_AUTH && typeof window.KS_AUTH.fetchWithAuth === 'function'
        ? window.KS_AUTH.fetchWithAuth(url)
        : fetch(url));
      const res = await resp.json();
      if (res.success && Array.isArray(res.supervisi_tendik)) {
        return res.supervisi_tendik.filter(s => !s.school_id || s.school_id === activeSid);
      }
    } catch (e) {
      console.warn('[Tendik API Fetch] Gagal mengambil dari server, fallback local:', e);
    }

    return this.loadFromLocalStorage({ ...filters, school_id: activeSid });
  },

  // Hapus Data Supervisi Tendik dari API Database
  async deleteFromApi(id) {
    const activeSid = (window.KS_AUTH && typeof window.KS_AUTH.getActiveSchoolId === 'function')
      ? window.KS_AUTH.getActiveSchoolId()
      : 'SCH-001';

    const url = this.getApiUrl('delete_supervisi_tendik') + `&id=${encodeURIComponent(id)}&school_id=${encodeURIComponent(activeSid)}`;
    try {
      const resp = await (window.KS_AUTH && typeof window.KS_AUTH.fetchWithAuth === 'function'
        ? window.KS_AUTH.fetchWithAuth(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, school_id: activeSid })
          })
        : fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, school_id: activeSid })
          }));
      const res = await resp.json();
      if (res.success) {
        this.removeFromLocalStorage(id, activeSid);
        return true;
      }
    } catch (e) {
      console.warn('[Tendik API Delete] Gagal menghapus data dari server:', e);
    }
    this.removeFromLocalStorage(id, activeSid);
    return true;
  },

  // Local Storage Helpers (Scoped per School ID)
  getStorageKey(schoolId) {
    return schoolId ? `ks_supervisi_tendik_records_${schoolId}` : 'ks_supervisi_tendik_records';
  },

  saveToLocalStorage(data, schoolId) {
    try {
      const sid = schoolId || data.school_id || 'SCH-001';
      const key = this.getStorageKey(sid);
      const raw = localStorage.getItem(key) || '[]';
      let records = JSON.parse(raw);
      if (!Array.isArray(records)) records = [];
      const idx = records.findIndex(r => r.id === data.id);
      if (idx >= 0) {
        records[idx] = data;
      } else {
        records.unshift(data);
      }
      localStorage.setItem(key, JSON.stringify(records));
    } catch (e) {}
  },

  loadFromLocalStorage(filters = {}) {
    try {
      const sid = filters.school_id || (window.KS_AUTH && window.KS_AUTH.getActiveSchoolId ? window.KS_AUTH.getActiveSchoolId() : 'SCH-001');
      const key = this.getStorageKey(sid);
      let raw = localStorage.getItem(key);
      if (!raw) {
        raw = localStorage.getItem('ks_supervisi_tendik_records') || '[]';
      }
      let records = JSON.parse(raw || '[]');
      if (!Array.isArray(records)) return [];
      if (sid) {
        records = records.filter(r => !r.school_id || r.school_id === sid);
      }
      if (filters.employee_name) {
        records = records.filter(r => (r.employeeName || '').toLowerCase() === filters.employee_name.toLowerCase());
      }
      if (filters.instrument_type) {
        records = records.filter(r => (r.instrumentType || '') === filters.instrument_type);
      }
      return records;
    } catch (e) {
      return [];
    }
  },

  removeFromLocalStorage(id, schoolId) {
    try {
      const sid = schoolId || (window.KS_AUTH && window.KS_AUTH.getActiveSchoolId ? window.KS_AUTH.getActiveSchoolId() : 'SCH-001');
      const key = this.getStorageKey(sid);
      const raw = localStorage.getItem(key) || '[]';
      let records = JSON.parse(raw);
      if (Array.isArray(records)) {
        records = records.filter(r => r.id !== id);
        localStorage.setItem(key, JSON.stringify(records));
      }
    } catch (e) {}
  }
};

window.KS_TENDIK = KS_TENDIK;
