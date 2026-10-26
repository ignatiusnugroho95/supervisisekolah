/**
 * supervisisekolah.id - Modul Telaah RPP & Modul Ajar Digital
 * Instrumen 42 Indikator Perencanaan Pembelajaran Mendalam (PM) Terintegrasi Literasi & Numerasi
 * Standar Supervisi Akademik Kepala Sekolah & Pengawas Sekolah
 */

const KS_TELAAH_RPP_DB = {
  STORAGE_KEY: 'ks_telaah_rpp_records_v1',

  CATEGORIES: [
    {
      id: 'A',
      title: 'A. KESELARASAN PERENCANAAN PEMBELAJARAN',
      maxScore: 20,
      count: 5,
      commentKey: 'commentsA',
      commentPlaceholder: 'Catatan kritis aspek A. KESELARASAN PERENCANAAN PEMBELAJARAN...'
    },
    {
      id: 'B',
      title: 'B. KERANGKA PEMBELAJARAN',
      maxScore: 16,
      count: 4,
      commentKey: 'commentsB',
      commentPlaceholder: 'Catatan kritis aspek B. KERANGKA PEMBELAJARAN...'
    },
    {
      id: 'C',
      title: 'C. PENGALAMAN BELAJAR (19 Indikator)',
      subtitle: 'Mencakup Tahap Memahami (C1), Mengaplikasi (C2), Merefleksi (C3), dan Prinsip Pembelajaran Mendalam (C4).',
      maxScore: 76,
      count: 19,
      commentKey: 'commentsC',
      commentPlaceholder: 'Tuliskan catatan khusus aspek Pengalaman Belajar (Langkah PM)...',
      subsections: [
        { id: 'C1', title: 'C1. Memahami (6 Indikator)', start: 10, end: 15 },
        { id: 'C2', title: 'C2. Mengaplikasi (5 Indikator)', start: 16, end: 20 },
        { id: 'C3', title: 'C3. Merefleksi (5 Indikator)', start: 21, end: 25 },
        { id: 'C4', title: 'C4. Prinsip Pembelajaran Mendalam (3 Indikator)', start: 26, end: 28 }
      ]
    },
    {
      id: 'D',
      title: 'D. PENGUATAN LITERASI DAN NUMERASI',
      maxScore: 32,
      count: 8,
      commentKey: 'commentsD',
      commentPlaceholder: 'Catatan kritis aspek D. PENGUATAN LITERASI DAN NUMERASI...'
    },
    {
      id: 'E',
      title: 'E. ASESMEN PEMBELAJARAN',
      maxScore: 24,
      count: 6,
      commentKey: 'commentsE',
      commentPlaceholder: 'Catatan kritis aspek E. ASESMEN PEMBELAJARAN...'
    }
  ],
  getCriteriaTemplate() {
    if (typeof window !== 'undefined' && window.KS_INDICATOR_MANAGER) {
      const dynamicList = window.KS_INDICATOR_MANAGER.getCriteriaTemplateForStage('1TelaahModulAjar');
      if (dynamicList && dynamicList.length > 0) {
        return JSON.parse(JSON.stringify(dynamicList));
      }
    }
    return [];
  },

  getStorageKey() {
    let sid = 'default';
    if (typeof KS_AUTH !== 'undefined') {
      sid = KS_AUTH.getActiveSchoolId() || 'SCH-001';
    }
    return `ks_telaah_rpp_${sid}_v2`;
  },

  getAll() {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      let list = data ? JSON.parse(data) : [];
      if (!Array.isArray(list)) list = [];

      // Pure MySQL database records: filter out any legacy sample records
      const sampleTelaahIds = new Set(['RPP-SAMPLE-001', 'RPP-1790828896112', 'RPP-1791003135097', 'RPP-1792051127208', 'RPP-1792415996467', 'RPP-1792416691860']);
      const cleaned = list.filter(item => item && !sampleTelaahIds.has(item.id) && !String(item.id).startsWith('RPP-SAMPLE-'));
      if (cleaned.length !== list.length) {
        this.saveAll(cleaned);
      }

      return cleaned;
    } catch (e) {
      console.error('Gagal membaca database Telaah RPP:', e);
      return [];
    }
  },

  saveAll(list) {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(list));
    } catch (e) {
      console.error('Gagal menyimpan database Telaah RPP:', e);
    }
  },

  /**
   * Fetch telaah RPP for active or specified cycle directly from server
   */
  async fetchFromServer(academicYear, semester) {
    if (typeof KS_AUTH === 'undefined') return this.getAll();
    try {
      const p = KS_AUTH.getProfile() || {};
      const ay = academicYear || p.academicYear || '2026/2027';
      const sem = semester || p.semester || 'Ganjil';
      const apiBase = KS_AUTH.getBaseUrl();
      const url = `${apiBase}api.php?action=get_telaah_rpp&all_cycles=1`;
      const res = await KS_AUTH.fetchWithAuth(url);
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && Array.isArray(d.telaah_rpp)) {
          this.saveAll(d.telaah_rpp);
          return d.telaah_rpp;
        }
      }
    } catch (e) {
      console.warn('[KS_TELAAH_RPP_DB] fetchFromServer error:', e);
    }
    return this.getAll();
  },

  getById(id) {
    const list = this.getAll();
    return list.find(x => x.id === id) || null;
  },

  getByTeacherName(teacherName, academicYear, semester) {
    const list = this.getAll();
    return list.find(x => {
      const matchName = x.teacherName && x.teacherName.toLowerCase().trim() === teacherName.toLowerCase().trim();
      if (!matchName) return false;
      if (academicYear && x.academicYear !== academicYear) return false;
      if (semester && x.semester !== semester) return false;
      return true;
    }) || null;
  },

  save(telaahData) {
    const list = this.getAll();
    if (!telaahData.id) {
      telaahData.id = 'RPP-' + Date.now();
      telaahData.createdAt = new Date().toISOString();
    }
    telaahData.updatedAt = new Date().toISOString();

    // Auto attach current active school_id, academic year and semester if not explicitly set
    let schoolId = telaahData.school_id;
    let academicYear = telaahData.academicYear;
    let semester = telaahData.semester;
    if (typeof KS_AUTH !== 'undefined') {
      const p = KS_AUTH.getProfile() || {};
      if (!schoolId) schoolId = KS_AUTH.getActiveSchoolId() || p.schoolId || 'SCH-001';
      if (!academicYear) academicYear = p.academicYear || '2026/2027';
      if (!semester) semester = p.semester || 'Ganjil';
      if (!telaahData.schoolName) telaahData.schoolName = p.schoolName || '';
    }
    telaahData.school_id = schoolId || 'SCH-001';
    telaahData.academicYear = academicYear || '2026/2027';
    telaahData.semester = semester || 'Ganjil';

    // Kalkulasi skor
    const calc = this.calculateScore(telaahData.criteria || []);
    telaahData.rawScore = calc.rawScore;
    telaahData.maxScore = calc.maxScore;
    telaahData.finalScore = calc.finalScore;
    telaahData.predicate = calc.predicate;
    telaahData.categoryScores = calc.categoryScores;

    const existingIdx = list.findIndex(x => x.id === telaahData.id);
    if (existingIdx >= 0) {
      list[existingIdx] = telaahData;
    } else {
      list.unshift(telaahData);
    }

    this.saveAll(list);

    // Sync to Server-Side MySQL Database
    if (typeof KS_AUTH !== 'undefined') {
      try {
        KS_AUTH.fetchWithAuth(KS_AUTH.getBaseUrl() + 'api.php?action=save_telaah_rpp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telaahData)
        }).catch(() => {});
      } catch (e) {}
    }

    return telaahData;
  },

  delete(id) {
    let list = this.getAll();
    list = list.filter(x => x.id !== id);
    this.saveAll(list);

    // Sync deletion to Server-Side MySQL Database
    if (typeof KS_AUTH !== 'undefined') {
      try {
        KS_AUTH.fetchWithAuth(KS_AUTH.getBaseUrl() + 'api.php?action=delete_telaah_rpp&id=' + encodeURIComponent(id), {
          method: 'POST'
        }).catch(() => {});
      } catch (e) {}
    }

    return true;
  },

  /**
   * Kalkulasi Skor Indikator Telaah RPP & Skor per Kategori
   * Skala Penilaian: 1 - 4
   * Total Skor Max: Jumlah Indikator x 4
   * Nilai Akhir: (rawScore / maxScore) * 100
   */
  calculateScore(criteriaList) {
    if (!Array.isArray(criteriaList) || criteriaList.length === 0) {
      return {
        rawScore: 0,
        maxScore: 40,
        finalScore: 0,
        predicate: 'Kurang',
        categoryScores: {}
      };
    }

    const categoryScores = {};
    let rawScore = 0;

    criteriaList.forEach(item => {
      const sc = Number(item.score) || 0;
      rawScore += sc;
      const catKey = item.category || item.categoryId || item.section || 'Lainnya';
      categoryScores[catKey] = (categoryScores[catKey] || 0) + sc;
    });

    const maxScore = criteriaList.length * 4;
    const finalScore = maxScore > 0 ? Number(((rawScore / maxScore) * 100).toFixed(1)) : 0;

    let predicate = 'Kurang';
    if (finalScore >= 86) predicate = 'Amat Baik';
    else if (finalScore >= 76) predicate = 'Baik';
    else if (finalScore >= 66) predicate = 'Cukup';
    else predicate = 'Kurang';

    return { rawScore, maxScore, finalScore, predicate, categoryScores };
  },

  /**
   * Analisis RPP Otomatis Menggunakan AI Gemini
   * Menerima teks RPP yang ditempelkan/diekstrak, lalu menghasilkan skor 1-4 untuk seluruh
   * indikator aktif dari elemen-elemen supervisi pilihan kepala sekolah di pengaturan,
   * catatan evaluasi kritis per elemen, serta 4 poin rekomendasi tindak lanjut.
   */
  async analyzeRppTextWithGemini(rppText, metadata = {}) {
    const apiKey = (window.KS_AI && typeof window.KS_AI.getApiKey === 'function') 
      ? window.KS_AI.getApiKey() 
      : (localStorage.getItem('depok_gemini_api_key') || '');
    const model = (window.KS_AI && typeof window.KS_AI.getModel === 'function') 
      ? window.KS_AI.getModel() 
      : (localStorage.getItem('depok_gemini_model') || 'gemini-1.5-flash');

    // Dapatkan daftar indikator aktif Tahap 1
    let criteriaList = metadata.criteria;
    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) {
      if (typeof window !== 'undefined' && window.KS_INDICATOR_MANAGER) {
        criteriaList = window.KS_INDICATOR_MANAGER.getCriteriaTemplateForStage('1TelaahModulAjar');
      }
    }
    if (!criteriaList || criteriaList.length === 0) {
      criteriaList = this.getCriteriaTemplate();
    }
    

    // Kelompokkan indikator per elemen/kategori untuk prompt yang terstruktur
    const categoryGroups = {};
    criteriaList.forEach(item => {
      const catName = item.category || item.categoryName || 'Elemen Dasar';
      if (!categoryGroups[catName]) {
        categoryGroups[catName] = {
          name: catName,
          code: item.categoryId || catName.substring(0, 3).toUpperCase(),
          items: []
        };
      }
      categoryGroups[catName].items.push(item);
    });

    let indicatorsPromptText = '';
    Object.keys(categoryGroups).forEach((catName, cIdx) => {
      const grp = categoryGroups[catName];
      indicatorsPromptText += `\n[ELEMEN ${cIdx + 1}: ${grp.name.toUpperCase()} (Kode: ${grp.code})]\n`;
      grp.items.forEach(ind => {
        const indNum = ind.number || '';
        const focusStr = ind.focus ? ` | Fokus: ${ind.focus}` : '';
        indicatorsPromptText += `• ID: "${ind.id}" (No. ${indNum}): ${ind.title}${focusStr}\n`;
      });
    });

    const sampleScoresJson = {};
    criteriaList.forEach(ind => {
      sampleScoresJson[String(ind.id)] = 3;
    });

    const sampleCategoryComments = {};
    Object.keys(categoryGroups).forEach(catName => {
      const grp = categoryGroups[catName];
      sampleCategoryComments[grp.code] = `Catatan evaluasi penelaah untuk aspek ${grp.name}...`;
    });

    if (apiKey) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const prompt = `Anda adalah seorang Pengawas Sekolah dan Ahli Telaah Dokumen Perencanaan Pembelajaran (RPP / Modul Ajar) tingkat SMP di Indonesia.
Lakukan telaah profesional komprehensif terhadap dokumen RPP berikut berdasarkan seluruh ${criteriaList.length} butir indikator dari elemen-elemen supervisi aktif pilihan Kepala Sekolah:

--- INFORMASI RPP ---
Guru: ${metadata.teacherName || '-'}
Mata Pelajaran: ${metadata.subject || '-'}

--- DOKUMEN RPP / MODUL AJAR ---
${rppText.substring(0, 15000)}
--- AKHIR DOKUMEN RPP ---

TUGAS EVALUASI ANDA:
1. Berikan penilaian skor angka 1 sampai 4 untuk setiap butir indikator berikut:
   1 = Kurang (komponen tidak ada / bukti belum tampak sama sekali)
   2 = Cukup (komponen ada namun kurang lengkap atau belum mengintegrasikan kriteria mendalam)
   3 = Baik (komponen lengkap, jelas, terintegrasi dan kontekstual)
   4 = Sangat Baik (sangat mendalam, kontekstual, diferensiatif, inovatif, dan berpusat pada murid)

DAFTAR SELURUH INDIKATOR PER ELEMEN/KATEGORI YANG DINILAI:
${indicatorsPromptText}

2. Tuliskan catatan evaluasi penelaah untuk setiap elemen/kategori di atas dalam objek "categoryComments" dengan key kode elemen (misal: "ELE", "PEM", "DIF", "KOM", dst).
3. Tuliskan 4 poin kesimpulan umum telaah RPP:
   - Kelebihan Perencanaan (feedbackStrengths)
   - Aspek Perlu Perbaikan (feedbackImprovements)
   - Rekomendasi Tindak Lanjut (feedbackRecommendations)
   - Rencana Pendampingan Lanjutan (feedbackFollowUp)

Format respon WAJIB berupa JSON valid murni tanpa awalan/akhiran markdown triple-backtick:
{
  "scores": ${JSON.stringify(sampleScoresJson)},
  "categoryComments": ${JSON.stringify(sampleCategoryComments)},
  "feedbackStrengths": "Uraian hal-hal positif dan poin keunggulan dokumen RPP ini...",
  "feedbackImprovements": "Uraian aspek-aspek yang masih memerlukan penyempurnaan...",
  "feedbackRecommendations": "Saran dan arahan konkret untuk meningkatkan kualitas RPP...",
  "feedbackFollowUp": "Rencana jadwal pendampingan lanjutan saat observasi pembelajaran di kelas..."
}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 3500
            }
          })
        });

        if (response.ok) {
          const resData = await response.json();
          let rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(rawText);
          if (parsed && parsed.scores) {
            return {
              ...parsed,
              source: 'gemini'
            };
          }
        }
      } catch (err) {
        console.warn('Gemini auto-analysis API error, using smart pedagogical heuristic parser:', err);
      }
    }

    // Heuristik Cerdas Berbasis Teks RPP (Offline / Fallback) yang dinamis untuk semua indikator aktif
    return this.generateSmartHeuristicFromText(rppText, criteriaList);
  },

  /**
   * Smart Pedagogical Heuristic Parser dari Teks RPP (Dinamis untuk semua indikator & elemen terpilih)
   */
  generateSmartHeuristicFromText(rppText, criteriaList = null) {
    const textLower = (rppText || '').toLowerCase();

    if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) {
      if (typeof window !== 'undefined' && window.KS_INDICATOR_MANAGER) {
        criteriaList = window.KS_INDICATOR_MANAGER.getCriteriaTemplateForStage('1TelaahModulAjar');
      }
    }
    if (!criteriaList || criteriaList.length === 0) {
      criteriaList = this.getCriteriaTemplate();
    }
    

    // Keyword detection
    const hasCP = textLower.includes('capaian pembelajaran') || textLower.includes(' cp ') || textLower.includes('tujuan pembelajaran');
    const hasLit = textLower.includes('literasi') || textLower.includes('membaca') || textLower.includes('teks') || textLower.includes('artikel');
    const hasNum = textLower.includes('numerasi') || textLower.includes('data') || textLower.includes('tabel') || textLower.includes('grafik') || textLower.includes('diagram');
    const hasKonsep = textLower.includes('konsep') || textLower.includes('nyata') || textLower.includes('kehidupan') || textLower.includes('kontekstual');
    const hasDigital = textLower.includes('digital') || textLower.includes('video') || textLower.includes('teknologi') || textLower.includes('aplikasi') || textLower.includes('link') || textLower.includes('online');
    const hasRefleksi = textLower.includes('refleksi') || textLower.includes('metakognisi') || textLower.includes('evaluasi diri');
    const hasAsesmenAwal = textLower.includes('asesmen awal') || textLower.includes('diagnostik') || textLower.includes('kesiapan');
    const hasFormatif = textLower.includes('formatif') || textLower.includes('lkpd') || textLower.includes('lembar kerja');
    const hasRubrik = textLower.includes('rubrik') || textLower.includes('kriteria') || textLower.includes('skor');
    const hasDiferensiasi = textLower.includes('diferensiasi') || textLower.includes('kelompok') || textLower.includes('minat') || textLower.includes('gaya belajar');
    const hasKSE = textLower.includes('sosial emosional') || textLower.includes('kse') || textLower.includes('kesadaran') || textLower.includes('empati') || textLower.includes('relasi');
    const hasEnglish = textLower.includes('english') || textLower.includes('vocabulary') || textLower.includes('language') || textLower.includes('bahasa inggris');
    const hasManajemen = textLower.includes('disiplin positif') || textLower.includes('keyakinan kelas') || textLower.includes('kesepakatan') || textLower.includes('restitusi');
    const hasSTEM = textLower.includes('stem') || textLower.includes('sains') || textLower.includes('rekayasa') || textLower.includes('desain') || textLower.includes('teknologi');

    const scores = {};
    const categoryComments = {};
    const categoryGroups = {};

    criteriaList.forEach(ind => {
      const catCode = ind.categoryId || ind.category_id || (ind.category || '').substring(0, 3).toUpperCase();
      const catName = ind.category || ind.categoryName || ind.category_name || 'Elemen Dasar';
      if (!categoryGroups[catCode]) categoryGroups[catCode] = { name: catName, code: catCode };

      let sc = 3; // Default baseline Baik
      const titleLower = (ind.title || '').toLowerCase();
      const focusLower = (ind.focus || '').toLowerCase();

      if ((titleLower.includes('capaian') || titleLower.includes('tujuan')) && hasCP) sc = 4;
      if ((titleLower.includes('literasi') || focusLower.includes('literasi')) && hasLit) sc = 4;
      if ((titleLower.includes('numerasi') || focusLower.includes('numerasi')) && hasNum) sc = 4;
      if ((titleLower.includes('kontekstual') || titleLower.includes('nyata') || titleLower.includes('kehidupan')) && hasKonsep) sc = 4;
      if ((titleLower.includes('digital') || titleLower.includes('teknologi')) && hasDigital) sc = 4;
      if ((titleLower.includes('refleksi') || titleLower.includes('metakognisi')) && hasRefleksi) sc = 4;
      if ((titleLower.includes('awal') || titleLower.includes('diagnostik')) && hasAsesmenAwal) sc = 4;
      if ((titleLower.includes('formatif') || titleLower.includes('proses')) && hasFormatif) sc = 4;
      if ((titleLower.includes('rubrik') || titleLower.includes('kriteria')) && hasRubrik) sc = 4;
      if ((catCode === 'DIF' || titleLower.includes('diferensiasi')) && hasDiferensiasi) sc = 4;
      if ((catCode === 'KOM' || titleLower.includes('emosional') || titleLower.includes('sosial')) && hasKSE) sc = 4;
      if ((catCode === 'ENG' || titleLower.includes('english') || titleLower.includes('bahasa')) && hasEnglish) sc = 4;
      if ((catCode === 'MAN' || titleLower.includes('disiplin') || titleLower.includes('kelas')) && hasManajemen) sc = 4;
      if ((catCode === 'STE' || titleLower.includes('stem') || titleLower.includes('rekayasa')) && hasSTEM) sc = 4;

      scores[ind.id] = sc;
      if (ind.number !== undefined) {
        scores[String(ind.number)] = sc;
      }
    });

    Object.keys(categoryGroups).forEach(catCode => {
      const grp = categoryGroups[catCode];
      categoryComments[catCode] = `Perencanaan pembelajaran pada aspek ${grp.name} telah tersusun sistematis, relevan dengan Capaian Pembelajaran, dan memfasilitasi keterlibatan bermakna bagi peserta didik.`;
    });

    return {
      source: 'heuristic',
      scores,
      categoryComments,
      commentsA: categoryComments['ELE'] || 'Tujuan dan langkah pembelajaran selaras dengan CP dan memuat nalar kritis.',
      commentsB: categoryComments['PEM'] || categoryComments['MAN'] || 'Kerangka dan lingkungan pembelajaran kolaboratif serta dialogis.',
      commentsC: categoryComments['PEM'] || categoryComments['DIF'] || 'Sintaks pengalaman belajar memfasilitasi tahapan mendalam dan berkesadaran.',
      commentsD: categoryComments['LIT'] || 'Penguatan literasi teks dan numerasi data terintegrasi nyata.',
      commentsE: categoryComments['ELE'] || 'Sistem asesmen formatif proses dan rubrik penilaian telah dirancang.',
      feedbackStrengths: '1. Perencanaan sangat kontekstual dan mengaitkan konsep materi dengan permasalahan riil kehidupan sehari-hari murid.\n2. Tahapan pembelajaran mendalam berpusat pada murid tampak berurutan secara logis dan dialogis.\n3. Integrasi instrumen dan penilaian autentik telah dirancang sesuai karakteristik modul ajar.',
      feedbackImprovements: '1. Perjelas diferensiasi proses dan produk bagi peserta didik yang memerlukan bimbingan khusus pada lembar kerja.\n2. Instrumen asesmen dapat diperkaya dengan variasi studi kasus pemecahan masalah dunia nyata.',
      feedbackRecommendations: '1. RPP / Modul Ajar dinyatakan LAYAK dan SIAP diimplementasikan dalam tahap observasi pembelajaran di kelas.\n2. Pastikan media stimulus digital dan lembar kerja terbimbing telah disiapkan sebelum sesi pembelajaran dimulai.\n3. Berikan ruang apresiasi murid dalam mempresentasikan temuan solutifnya.',
      feedbackFollowUp: 'Jadwal supervisi observasi kelas disepakati pada pekan pelaksanaan pembelajaran. Kepala Sekolah akan mendampingi implementasi refleksi metakognisi murid.'
    };
  },

  /**
   * Pure MySQL records: no sample data
   */
  seedSampleData() {
    return [];
  },

  exportToPdf(record) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Pustaka jsPDF belum siap. Silakan muat ulang halaman.');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const calc = this.calculateScore(record.criteria || []);

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('LEMBAR TELAAH RPP / MODUL AJAR DIGITAL', 105, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Instrumen Perencanaan Pembelajaran Mendalam (PM) Terintegrasi Literasi & Numerasi (42 Indikator)', 105, 21, { align: 'center' });
      doc.setLineWidth(0.5);
      doc.line(15, 24, 195, 24);

      // Info Table
      doc.setFontSize(9);
      doc.text(`Nama Guru: ${record.teacherName || '-'}`, 15, 30);
      doc.text(`NIP Guru: ${record.nip || '-'}`, 15, 35);
      doc.text(`Mata Pelajaran: ${record.subject || '-'}`, 15, 40);
      doc.text(`Kelas / Fase: ${record.gradeClass || '-'}`, 15, 45);

      doc.text(`Tanggal Telaah: ${record.reviewDate || '-'}`, 120, 30);
      doc.text(`Penelaah: ${record.reviewerName || '-'}`, 120, 35);
      doc.text(`NIP Penelaah: ${record.reviewerNip || '-'}`, 120, 40);
      doc.text(`Nilai Akhir: ${calc.finalScore} / 100 (${calc.predicate})`, 120, 45);

      // Rekap Kategori
      const rekapData = [
        ['A. KESELARASAN PERENCANAAN PEMBELAJARAN', `${calc.categoryScores.A} / 20`],
        ['B. KERANGKA PEMBELAJARAN', `${calc.categoryScores.B} / 16`],
        ['C. PENGALAMAN BELAJAR (C1 Memahami, C2 Mengaplikasi, C3 Merefleksi, C4 Prinsip PM)', `${calc.categoryScores.C} / 76`],
        ['D. PENGUATAN LITERASI DAN NUMERASI', `${calc.categoryScores.D} / 32`],
        ['E. ASESMEN PEMBELAJARAN', `${calc.categoryScores.E} / 24`],
        ['TOTAL SKOR MENTAH & NILAI AKHIR', `${calc.rawScore} / 168 (Nilai: ${calc.finalScore} - ${calc.predicate})`]
      ];

      doc.autoTable({
        startY: 50,
        head: [['Kategori Aspek Telaah', 'Capaian Skor']],
        body: rekapData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [217, 119, 6] }
      });

      // Umpan Balik
      let finalY = doc.lastAutoTable.finalY + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('UMPAN BALIK PENELAAH & REKOMENDASI TINDAK LANJUT:', 15, finalY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const feedbacks = [
        `Kelebihan RPP: ${record.feedbackStrengths || '-'}`,
        `Hal yang Perlu Ditingkatkan: ${record.feedbackImprovements || '-'}`,
        `Rekomendasi Perbaikan: ${record.feedbackRecommendations || '-'}`,
        `Tindak Lanjut / Revisi: ${record.feedbackFollowUp || '-'}`
      ];

      finalY += 4;
      feedbacks.forEach(f => {
        const splitText = doc.splitTextToSize(f, 180);
        doc.text(splitText, 15, finalY);
        finalY += (splitText.length * 4) + 2;
      });

      doc.save(`Telaah_RPP_${(record.teacherName || 'Guru').replace(/\s+/g, '_')}_42_Indikator.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
      alert('Gagal membuat PDF: ' + e.message);
    }
  },

  exportToExcel() {
    if (!window.XLSX) {
      alert('Pustaka SheetJS belum siap.');
      return;
    }
    const list = this.getAll();
    const rows = list.map((item, idx) => {
      const calc = this.calculateScore(item.criteria || []);
      return {
        'No': idx + 1,
        'Nama Guru': item.teacherName,
        'NIP': item.nip,
        'Mata Pelajaran': item.subject,
        'Kelas': item.gradeClass,
        'Tanggal Telaah': item.reviewDate,
        'Skor A (Keselarasan)': calc.categoryScores.A,
        'Skor B (Kerangka)': calc.categoryScores.B,
        'Skor C (Pengalaman Belajar)': calc.categoryScores.C,
        'Skor D (Lit-Num)': calc.categoryScores.D,
        'Skor E (Asesmen)': calc.categoryScores.E,
        'Total Skor Mentah (/168)': calc.rawScore,
        'Nilai Akhir (/100)': calc.finalScore,
        'Predikat': calc.predicate,
        'Kelebihan': item.feedbackStrengths || '',
        'Perlu Ditingkatkan': item.feedbackImprovements || '',
        'Rekomendasi': item.feedbackRecommendations || '',
        'Tindak Lanjut': item.feedbackFollowUp || ''
      };
    });

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(wb, ws, 'Rekap Telaah RPP 42 Indikator');
    window.XLSX.writeFile(wb, `Rekap_Telaah_RPP_42_Indikator_${Date.now()}.xlsx`);
  }
};

window.KS_TELAAH_RPP_DB = KS_TELAAH_RPP_DB;
window.SUPERVISI_TELAAH_RPP_DB = KS_TELAAH_RPP_DB;
