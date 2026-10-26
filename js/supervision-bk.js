/**
 * supervisisekolah.id - Specialized Module for Guidance & Counseling (Guru BK) Supervision
 * Instruments: Supervisi BK, Telaah RPL BK, Coaching BK (TIRTA), and Comprehensive Report
 * Fully supports multi-tenant isolation, dynamic active category filtering, and AI Assistance
 */

(function (window) {
  'use strict';

  const KS_BK_MANAGER = {
    STORAGE_KEY_ACTIVE: 'ks_bk_active_categories',
    STORAGE_KEY_CONFIG: 'ks_bk_config_cache',
    STORAGE_KEY_DATA: 'ks_supervisi_bk_records',
    _configCache: null,
    _recordsCache: [],

    getBaseUrl() {
      if (typeof window.KS_BASE_URL !== 'undefined') return window.KS_BASE_URL;
      const path = window.location.pathname;
      const segs = path.split('/').filter(Boolean);
      if (segs.length > 0 && (segs[0] === 'supervisisekolah.id' || segs[0] === 'app')) {
        return '/' + segs[0] + '/';
      }
      return '/';
    },

    getCurrentPeriod() {
      if (typeof window.KS_AUTH !== 'undefined') {
        const prof = window.KS_AUTH.getProfile();
        if (prof && prof.academicYear) {
          return {
            academicYear: prof.academicYear || '2026/2027',
            semester: prof.semester || 'Ganjil'
          };
        }
      }
      return { academicYear: '2026/2027', semester: 'Ganjil' };
    },

    getCategoryTheme(categoryName) {
      const name = String(categoryName || '').toLowerCase();
      if (name.includes('deep') || name.includes('learning')) {
        return {
          bg: 'bg-purple-50',
          text: 'text-purple-700',
          border: 'border-purple-200',
          badge: 'bg-purple-100 text-purple-800 border-purple-200',
          accent: 'from-purple-500 to-indigo-600',
          lightBg: 'bg-purple-50/50'
        };
      }
      if (name.includes('literasi') || name.includes('numerasi') || name.includes('litnum')) {
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-200',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          accent: 'from-amber-500 to-orange-600',
          lightBg: 'bg-amber-50/50'
        };
      }
      // Default: Indikator Dasar
      return {
        bg: 'bg-teal-50',
        text: 'text-teal-800',
        border: 'border-teal-200',
        badge: 'bg-teal-100 text-teal-800 border-teal-200',
        accent: 'from-teal-500 to-emerald-600',
        lightBg: 'bg-teal-50/50'
      };
    },

    /**
     * Load BK Configuration from MySQL API with fallback to local master JSON
     */
    async loadConfig(academicYear, semester, forceRefresh = false) {
      const period = this.getCurrentPeriod();
      const year = academicYear || period.academicYear;
      const sem = semester || period.semester;
      const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
      const cacheKey = `${this.STORAGE_KEY_CONFIG}_${sid}_${year}_${sem}`;

      if (!forceRefresh && this._configCache && this._configCache.academicYear === year && this._configCache.semester === sem) {
        return this._configCache;
      }

      try {
        const url = `${this.getBaseUrl()}api.php?action=get_supervision_bk_config&academicYear=${encodeURIComponent(year)}&semester=${encodeURIComponent(sem)}`;
        const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url) : fetch(url));

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this._configCache = data;
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data));
              localStorage.setItem(`${this.STORAGE_KEY_ACTIVE}_${sid}_${year}_${sem}`, JSON.stringify(data.active_categories || []));
            } catch (e) {}
            return data;
          }
        }
      } catch (e) {
        console.warn('[KS_BK_MANAGER] Gagal fetch config dari MySQL API:', e);
      }

      // Check LocalStorage cache
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.categories) {
            this._configCache = parsed;
            return parsed;
          }
        }
      } catch (e) {}

      // Fallback default structure
      return {
        success: false,
        school_id: sid,
        academicYear: year,
        semester: sem,
        active_categories: ['Indikator Dasar', 'Deep Learning', 'Literasi Numerasi'],
        categories: [],
        supervisi_indicators: [],
        rpl_indicators: [],
        coaching_tirta: [],
        coaching_examples: [],
        coaching_refleksi: []
      };
    },

    /**
     * Save Active Categories for BK to MySQL Server
     */
    async saveActiveCategories(academicYear, semester, activeCategoriesList) {
      const period = this.getCurrentPeriod();
      const year = academicYear || period.academicYear;
      const sem = semester || period.semester;
      const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
      const cacheKey = `${this.STORAGE_KEY_CONFIG}_${sid}_${year}_${sem}`;

      try {
        const url = `${this.getBaseUrl()}api.php?action=save_active_bk_categories`;
        const payload = {
          school_id: sid,
          academicYear: year,
          semester: sem,
          categories: activeCategoriesList
        };

        const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }) : fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }));

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (this._configCache) {
              this._configCache.active_categories = activeCategoriesList;
            }
            try {
              localStorage.setItem(`${this.STORAGE_KEY_ACTIVE}_${sid}_${year}_${sem}`, JSON.stringify(activeCategoriesList));
              const cached = localStorage.getItem(cacheKey);
              if (cached) {
                const cObj = JSON.parse(cached);
                cObj.active_categories = activeCategoriesList;
                localStorage.setItem(cacheKey, JSON.stringify(cObj));
              }
            } catch (e) {}

            window.dispatchEvent(new CustomEvent('ks:active-bk-categories-updated', {
              detail: { school_id: sid, academicYear: year, semester: sem, categories: activeCategoriesList }
            }));
            return data;
          }
        }
      } catch (e) {
        console.error('[KS_BK_MANAGER] Gagal menyimpan kategori BK aktif ke MySQL:', e);
        throw e;
      }

      return { success: false, error: 'Koneksi ke MySQL gagal.' };
    },

    getActiveCategoryNames() {
      if (this._configCache && Array.isArray(this._configCache.active_categories)) {
        return this._configCache.active_categories;
      }
      return ['Indikator Dasar', 'Deep Learning', 'Literasi Numerasi'];
    },

    /**
     * Filter Supervisi BK indicators based on active categories
     */
    getSupervisiIndicators(activeCats = null) {
      if (!this._configCache || !this._configCache.supervisi_indicators) return [];
      const cats = activeCats || this.getActiveCategoryNames();
      return this._configCache.supervisi_indicators.filter(ind => cats.includes(ind.category));
    },

    /**
     * Filter RPL BK indicators based on active categories
     */
    getRplIndicators(activeCats = null) {
      if (!this._configCache || !this._configCache.rpl_indicators) return [];
      const cats = activeCats || this.getActiveCategoryNames();
      return this._configCache.rpl_indicators.filter(ind => cats.includes(ind.category));
    },

    getCoachingTirta() {
      return (this._configCache && this._configCache.coaching_tirta) ? this._configCache.coaching_tirta : [];
    },

    getCoachingExamples(activeCats = null) {
      if (!this._configCache || !this._configCache.coaching_examples) return [];
      const cats = activeCats || this.getActiveCategoryNames();
      return this._configCache.coaching_examples.filter(ex => cats.includes(ex.kategori));
    },

    getReflectionIndicators() {
      if (this._configCache && this._configCache.reflection_indicators && this._configCache.reflection_indicators.length) {
        return this._configCache.reflection_indicators;
      }
      if (this._configCache && this._configCache.coaching_refleksi && this._configCache.coaching_refleksi.length) {
        return this._configCache.coaching_refleksi;
      }
      return [
        { number: 1, category: "Indikator Dasar", statement: "Saya memahami temuan supervisi tentang kelengkapan program, layanan, dan administrasi BK saya." },
        { number: 2, category: "Indikator Dasar", statement: "Saya memiliki langkah konkret dan jadwal untuk melengkapi dokumen atau layanan BK yang masih kurang." },
        { number: 3, category: "Indikator Dasar", statement: "Saya mengetahui bukti kerja yang perlu saya siapkan dan dokumentasikan." },
        { number: 4, category: "Deep Learning", statement: "Saya dapat menjelaskan cara membuat layanan BK saya lebih mindful, meaningful, dan joyful." },
        { number: 5, category: "Deep Learning", statement: "Saya memiliki rencana menggunakan pertanyaan pemantik dan kegiatan refleksi dalam layanan." },
        { number: 6, category: "Deep Learning", statement: "Saya terdorong mengaitkan topik layanan dengan kehidupan nyata peserta didik." },
        { number: 7, category: "Literasi Numerasi", statement: "Saya memahami cara memasukkan aktivitas literasi (membaca, menganalisis, merefleksikan informasi) ke dalam RPL BK." },
        { number: 8, category: "Literasi Numerasi", statement: "Saya memahami cara memanfaatkan data atau angka (asesmen, tabel, grafik) dalam layanan BK." },
        { number: 9, category: "Literasi Numerasi", statement: "Saya akan menggunakan Lembar Telaah RPL untuk memeriksa RPL yang saya susun." },
        { number: 10, category: "Proses Coaching", statement: "Saya merasa didengarkan dan dihargai selama proses coaching." },
        { number: 11, category: "Proses Coaching", statement: "Pertanyaan coach membantu saya berpikir dan menemukan solusi sendiri." },
        { number: 12, category: "Proses Coaching", statement: "Rencana tindak lanjut yang disepakati berasal dari gagasan dan komitmen saya." }
      ];
    },

    /**
     * Calculate Supervisi BK Stage 1 Score
     * Each item is rated 0-5 (0=Tidak Ada, 1=Sangat Kurang, 2=Kurang, 3=Cukup, 4=Baik, 5=Sangat Baik)
     */
    calculateSupervisiScore(scoresMap, activeIndicators = null) {
      const indicators = activeIndicators || this.getSupervisiIndicators();
      let totalEarned = 0;
      let totalMax = indicators.length * 5;
      const categoryBreakdown = {};

      indicators.forEach(ind => {
        const cat = ind.category || 'Indikator Dasar';
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { earned: 0, max: 0, count: 0, items: [] };
        }
        const val = parseInt(scoresMap[ind.number] !== undefined ? scoresMap[ind.number] : 0, 10) || 0;
        totalEarned += val;
        categoryBreakdown[cat].earned += val;
        categoryBreakdown[cat].max += 5;
        categoryBreakdown[cat].count += 1;
        categoryBreakdown[cat].items.push({ number: ind.number, score: val });
      });

      const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 1000) / 10 : 0;
      let predicate = 'Sangat Kurang (E)';
      let grade = 'E';
      if (percentage >= 86) {
        predicate = 'Sangat Baik (A)';
        grade = 'A';
      } else if (percentage >= 71) {
        predicate = 'Baik (B)';
        grade = 'B';
      } else if (percentage >= 56) {
        predicate = 'Cukup (C)';
        grade = 'C';
      } else if (percentage >= 41) {
        predicate = 'Kurang (D)';
        grade = 'D';
      }

      // Compute percentages for each category
      Object.keys(categoryBreakdown).forEach(k => {
        const c = categoryBreakdown[k];
        c.percentage = c.max > 0 ? Math.round((c.earned / c.max) * 1000) / 10 : 0;
      });

      return {
        totalEarned,
        totalMax,
        percentage,
        predicate,
        grade,
        count: indicators.length,
        categoryBreakdown
      };
    },

    /**
     * Calculate RPL BK Stage 2 Score
     * Each item is rated 1 (Ada) or 0 (Tidak Ada)
     */
    calculateRplScore(rplMap, activeRplIndicators = null) {
      const indicators = activeRplIndicators || this.getRplIndicators();
      let totalEarned = 0;
      let totalMax = indicators.length * 1;
      const categoryBreakdown = {};

      indicators.forEach(ind => {
        const cat = ind.category || 'Indikator Dasar';
        if (!categoryBreakdown[cat]) {
          categoryBreakdown[cat] = { earned: 0, max: 0, count: 0 };
        }
        const val = (rplMap[ind.number] === 1 || rplMap[ind.number] === '1' || rplMap[ind.number] === true) ? 1 : 0;
        totalEarned += val;
        categoryBreakdown[cat].earned += val;
        categoryBreakdown[cat].max += 1;
        categoryBreakdown[cat].count += 1;
      });

      const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 1000) / 10 : 0;
      let predicate = 'Sangat Kurang (E)';
      let grade = 'E';
      if (percentage >= 86) {
        predicate = 'Sangat Baik (A)';
        grade = 'A';
      } else if (percentage >= 71) {
        predicate = 'Baik (B)';
        grade = 'B';
      } else if (percentage >= 56) {
        predicate = 'Cukup (C)';
        grade = 'C';
      } else if (percentage >= 41) {
        predicate = 'Kurang (D)';
        grade = 'D';
      }

      Object.keys(categoryBreakdown).forEach(k => {
        const c = categoryBreakdown[k];
        c.percentage = c.max > 0 ? Math.round((c.earned / c.max) * 1000) / 10 : 0;
      });

      return {
        totalEarned,
        totalMax,
        percentage,
        predicate,
        grade,
        count: indicators.length,
        categoryBreakdown
      };
    },

    /**
     * Calculate Self Reflection Stage 3 Score
     * 12 items rated 1-4
     */
    calculateRefleksiScore(reflectionMap, reflectionIndicators = null) {
      const indicators = reflectionIndicators || this.getReflectionIndicators();
      let totalEarned = 0;
      let totalMax = indicators.length * 4;

      indicators.forEach(ind => {
        const val = parseInt(reflectionMap[ind.number] || 0, 10);
        totalEarned += val;
      });

      const average = indicators.length > 0 ? Math.round((totalEarned / indicators.length) * 100) / 100 : 0;
      const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 1000) / 10 : 0;

      return {
        totalEarned,
        totalMax,
        average,
        percentage,
        count: indicators.length
      };
    },

    /**
     * Fetch BK Supervision records for a cycle from MySQL Server
     */
    async fetchRecords(academicYear, semester) {
      const period = this.getCurrentPeriod();
      const year = academicYear || period.academicYear;
      const sem = semester || period.semester;
      const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';

      try {
        const url = `${this.getBaseUrl()}api.php?action=get_supervisi_bk&academic_year=${encodeURIComponent(year)}&semester=${encodeURIComponent(sem)}`;
        const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url) : fetch(url));

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.supervisi_bk)) {
            this._recordsCache = data.supervisi_bk;
            try {
              localStorage.setItem(`${this.STORAGE_KEY_DATA}_${sid}_${year}_${sem}`, JSON.stringify(data.supervisi_bk));
            } catch (e) {}
            return data.supervisi_bk;
          }
        }
      } catch (e) {
        console.warn('[KS_BK_MANAGER] Gagal fetch supervisi_bk dari server:', e);
      }

      // Check local storage fallback
      try {
        const cached = localStorage.getItem(`${this.STORAGE_KEY_DATA}_${sid}_${year}_${sem}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            this._recordsCache = parsed;
            return parsed;
          }
        }
      } catch (e) {}

      return [];
    },

    /**
     * Save a single BK Supervision record to MySQL Server
     */
    async saveRecord(record) {
      const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
      const year = record.academicYear || this.getCurrentPeriod().academicYear;
      const sem = record.semester || this.getCurrentPeriod().semester;

      if (!record.id) {
        record.id = 'BK-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100);
      }
      record.school_id = sid;
      record.academicYear = year;
      record.semester = sem;
      record.updatedAt = new Date().toISOString();

      try {
        const url = `${this.getBaseUrl()}api.php?action=save_supervisi_bk`;
        const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        }) : fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record)
        }));

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Update local records cache
            const idx = this._recordsCache.findIndex(r => r.id === record.id);
            if (idx >= 0) {
              this._recordsCache[idx] = record;
            } else {
              this._recordsCache.unshift(record);
            }
            try {
              localStorage.setItem(`${this.STORAGE_KEY_DATA}_${sid}_${year}_${sem}`, JSON.stringify(this._recordsCache));
            } catch (e) {}
            return data;
          }
        }
      } catch (e) {
        console.error('[KS_BK_MANAGER] Gagal save record ke MySQL:', e);
        throw e;
      }

      return { success: false, error: 'Gagal menyimpan ke server.' };
    },

    /**
     * Delete a single BK record from MySQL Server
     */
    async deleteRecord(id) {
      const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
      const period = this.getCurrentPeriod();

      try {
        const url = `${this.getBaseUrl()}api.php?action=delete_supervisi_bk&id=${encodeURIComponent(id)}`;
        const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url) : fetch(url));

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            this._recordsCache = this._recordsCache.filter(r => r.id !== id);
            try {
              localStorage.setItem(`${this.STORAGE_KEY_DATA}_${sid}_${period.academicYear}_${period.semester}`, JSON.stringify(this._recordsCache));
            } catch (e) {}
            return data;
          }
        }
      } catch (e) {
        console.error('[KS_BK_MANAGER] Gagal delete record di server:', e);
        throw e;
      }

      return { success: false, error: 'Gagal menghapus di server.' };
    }
  };

  /**
   * AI Assistant for Guidance & Counseling (Guru BK)
   * Offers automated scoring suggestions, RPL analysis, dynamic TIRTA coaching script generation,
   * and Lembar Laporan conclusions & recommendations.
   */
  const KS_BK_AI = {
    STORAGE_KEY_API: 'depok_gemini_api_key',
    STORAGE_KEY_MODEL: 'depok_gemini_model',
    DEFAULT_MODEL: 'gemini-1.5-flash',

    getApiKey() {
      return localStorage.getItem(this.STORAGE_KEY_API) || (typeof window.KS_AI !== 'undefined' ? window.KS_AI.getApiKey() : '');
    },

    getModel() {
      return localStorage.getItem(this.STORAGE_KEY_MODEL) || this.DEFAULT_MODEL;
    },

    async callGemini(prompt) {
      const apiKey = this.getApiKey();
      if (!apiKey) return null;
      const model = this.getModel();
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2048
            }
          })
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          return text ? text.trim() : null;
        }
      } catch (e) {
        console.warn('[KS_BK_AI] Gemini API error, falling back to smart heuristics:', e);
      }
      return null;
    },

    /**
     * AI Automated Scoring for Stage 1: Supervisi BK
     */
    async autoScoreSupervisi(notes, activeIndicators) {
      const textNotes = String(notes || '').toLowerCase();
      const prompt = `Anda adalah Asesor / Supervisor Ahli Bimbingan dan Konseling (BK) di Sekolah Menengah / Dasar.
Berdasarkan deskripsi temuan observasi / wawancara berikut:
"${notes}"

Berikan skor (0-5, di mana 0=Tidak Ada, 3=Cukup, 4=Baik, 5=Sangat Baik) untuk setiap butir indikator berikut:
${activeIndicators.map(i => `[Butir ${i.number}] ${i.title} (Kategori: ${i.category})`).join('\n')}

Format keluaran WAJIB JSON persis seperti ini:
{
  "scores": {
    "1": 4,
    "2": 3
  },
  "notes": {
    "1": "Alasan singkat skor",
    "2": "Alasan singkat skor"
  },
  "overallSummary": "Ringkasan umum ketercapaian guru BK"
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.scores) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {}
      }

      // Offline Smart Heuristic Fallback
      const scores = {};
      const indNotes = {};
      activeIndicators.forEach(ind => {
        let sc = 4; // Default baseline Baik
        const titleL = ind.title.toLowerCase();
        if (textNotes.includes('kurang') || textNotes.includes('belum ada') || textNotes.includes('tidak lengkap')) {
          if (titleL.includes('evaluasi') || titleL.includes('numerasi') || titleL.includes('literasi') || titleL.includes('angket')) {
            sc = 2;
          } else {
            sc = 3;
          }
        } else if (textNotes.includes('sangat baik') || textNotes.includes('lengkap') || textNotes.includes('inovatif')) {
          sc = 5;
        } else if (textNotes.includes('cukup') || textNotes.includes('standar')) {
          sc = 3;
        }
        scores[ind.number] = sc;
        indNotes[ind.number] = sc >= 4 ? 'Terpenuhi dengan bukti dokumentasi yang memadai.' : 'Perlu dilengkapi instrumen dan tindak lanjut mutakhir.';
      });

      return {
        scores,
        notes: indNotes,
        overallSummary: 'Penilaian awal berbasis catatan temuan menunjukkan kinerja administrasi dan layanan BK berjalan baik, dengan rekomendasi penguatan pada aspek reflektif dan pemanfaatan data peserta didik.',
        source: 'heuristic'
      };
    },

    /**
     * AI Review for Stage 2: Telaah RPL BK
     */
    async autoReviewRPL(rplDescription, activeRplIndicators) {
      const textDesc = String(rplDescription || '').toLowerCase();
      const prompt = `Anda adalah Supervisor Penelaah Rencana Pelaksanaan Layanan (RPL) Guru BK.
Telaah ringkasan isi RPL berikut:
"${rplDescription}"

Untuk setiap indikator berikut, tentukan status Ada (1) atau Tidak Ada (0) dan catatan keterangan perbaikan:
${activeRplIndicators.map(i => `[Butir ${i.number}] ${i.title} (${i.section} - ${i.category})`).join('\n')}

Format keluaran WAJIB format JSON:
{
  "rplChecklist": {
    "1": 1,
    "2": 0
  },
  "rplNotes": {
    "1": "Tujuan sudah terukur",
    "2": "Belum tampak penguatan literasi informasi"
  },
  "reviewSummary": "Ringkasan kualitas telaah RPL BK"
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.rplChecklist) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {}
      }

      // Offline Heuristic Fallback
      const checklist = {};
      const notes = {};
      activeRplIndicators.forEach(ind => {
        let has = 1;
        const titleL = ind.title.toLowerCase();
        if (textDesc.includes('belum memuat') || textDesc.includes('ceramah') || textDesc.includes('kurang spesifik')) {
          if (titleL.includes('numerasi') || titleL.includes('refleksi') || titleL.includes('grafik') || titleL.includes('pemantik')) {
            has = 0;
          }
        }
        checklist[ind.number] = has;
        notes[ind.number] = has === 1 ? 'Sudah tercantum dalam komponen RPL.' : 'Belum tampak secara eksplisit pada langkah layanan RPL.';
      });

      return {
        rplChecklist: checklist,
        rplNotes: notes,
        reviewSummary: 'RPL BK telah memenuhi struktur komponen utama layanan. Perlu pengayaan pada aktivitas interaktif, pertanyaan pemantik, serta integrasi data literasi/numerasi diri peserta didik.',
        source: 'heuristic'
      };
    },

    /**
     * AI Dynamic Coaching TIRTA Script Generator
     */
    async generateTirtaScenario(recordData) {
      const teacherName = recordData.teacherName || 'Guru BK';
      const supervisiResult = recordData.supervisiResult || {};
      const rplResult = recordData.rplResult || {};
      const activeCats = recordData.activeCategories || ['Indikator Dasar', 'Deep Learning', 'Literasi Numerasi'];

      // Gap analysis to find weakest categories
      const breakdown = supervisiResult.categoryBreakdown || {};
      let lowestCat = 'Indikator Dasar';
      let lowestPct = 100;

      Object.keys(breakdown).forEach(cat => {
        if (breakdown[cat].percentage < lowestPct) {
          lowestPct = breakdown[cat].percentage;
          lowestCat = cat;
        }
      });

      const prompt = `Anda adalah Coach Kepala Sekolah bersertifikat TIRTA (Tujuan, Identifikasi, Rencana Aksi, Tanggung Jawab).
Susun skenario dialog dan pertanyaan coaching interaktif untuk:
Nama Guru BK: ${teacherName}
Hasil Supervisi BK: Skor ${supervisiResult.percentage || 75}% (${supervisiResult.predicate || 'Baik'})
Hasil Telaah RPL: Skor ${rplResult.percentage || 80}% (${rplResult.predicate || 'Baik'})
Area Fokus Utama / Gap Terendah: Kategori "${lowestCat}" (Ketercapaian: ${lowestPct}%)
Kategori Aktif Supervisi: ${activeCats.join(', ')}

Susunkan 6 langkah dialog coaching berurutan lengkap:
1. Pembukaan (Membangun rasa aman dan kesepakatan)
2. T - Tujuan (Guru BK merumuskan sasaran coaching)
3. I - Identifikasi (Memetakan kondisi nyata, hambatan, dan aset)
4. R - Rencana Aksi (Langkah konkret jangka pendek & kolaborasi)
5. T - Tanggung Jawab (Komitmen waktu, bukti fisik, dan dukungan)
6. Penutup & Refleksi (Rangkuman dan jadwal temu lanjutan)

Juga sertakan 1 draf Rencana Tindak Lanjut (RTL) yang konkret.
Keluarkan dalam format JSON:
{
  "focusArea": "${lowestCat}",
  "dialogSteps": [
    {
      "step": "Pembukaan",
      "duration": "3 menit",
      "coachQuestion": "...",
      "expectedResponse": "..."
    },
    {
      "step": "Tujuan",
      "duration": "5 menit",
      "coachQuestion": "...",
      "expectedResponse": "..."
    },
    {
      "step": "Identifikasi",
      "duration": "10 menit",
      "coachQuestion": "...",
      "expectedResponse": "..."
    },
    {
      "step": "Rencana Aksi",
      "duration": "10 menit",
      "coachQuestion": "...",
      "expectedResponse": "..."
    },
    {
      "step": "Tanggung Jawab",
      "duration": "7 menit",
      "coachQuestion": "...",
      "expectedResponse": "..."
    },
    {
      "step": "Penutup & Refleksi",
      "duration": "5 menit",
      "coachQuestion": "...",
      "expectedResponse": "..."
    }
  ],
  "recommendedRTL": [
    {
      "fokus": "Penguatan RPL & Layanan BK",
      "tindakan": "Menyusun rekap angket kebutuhan dan menambahkan 2 pertanyaan pemantik serta jurnal refleksi pada RPL.",
      "sasaranWaktu": "Minggu ke-2 bulan depan",
      "buktiFisik": "RPL revisi dan lembar refleksi peserta didik",
      "dukungan": "Kolaborasi dengan Koordinator MGBK & Wali Kelas"
    }
  ]
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.dialogSteps) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {}
      }

      // Offline High-Standard TIRTA Template
      const dialogSteps = [
        {
          step: 'Pembukaan',
          duration: '3 menit',
          coachQuestion: `Bagaimana kabar Bapak/Ibu ${teacherName} hari ini? Terima kasih telah meluangkan waktu. Pertemuan kita sekitar 40 menit ini adalah ruang refleksi yang aman dan memberdayakan untuk kemajuan layanan BK, bukan penilaian ulang. Apa harapan Bapak/Ibu dari percakapan kita hari ini?`,
          expectedResponse: 'Guru merasa tenang, menyambut baik suasana kemitraan, dan berharap mendapatkan kejelasan strategi tindak lanjut layanan BK.'
        },
        {
          step: 'Tujuan (T)',
          duration: '5 menit',
          coachQuestion: `Melihat hasil supervisi program layanan dan telaah RPL sebelumnya, bagian mana yang paling ingin Bapak/Ibu perkuat terlebih dahulu? Seperti apa kondisi ideal layanan peserta didik yang Bapak/Ibu bayangkan 2-3 bulan ke depan?`,
          expectedResponse: `Guru BK merumuskan fokus pada penguatan ${lowestCat}, agar peserta didik merasakan layanan yang mindful, bermakna, dan berbasis data.`
        },
        {
          step: 'Identifikasi (I)',
          duration: '10 menit',
          coachQuestion: `Apa yang saat ini sudah berjalan sangat baik dalam layanan BK Bapak/Ibu? Apa tantangan nyata yang dirasakan ketika memfasilitasi peserta didik atau menyusun instrumen kebutuhan? Peluang apa yang bisa dioptimalkan?`,
          expectedResponse: 'Guru memetakan bahwa hubungan personal dengan siswa sudah dekat, namun waktu administrasi rekap asesmen dan penyusunan media bervariasi masih terkendala waktu.'
        },
        {
          step: 'Rencana Aksi (R)',
          duration: '10 menit',
          coachQuestion: `Dari beberapa opsi yang ada, langkah kecil dan konkret apa yang paling realistis Bapak/Ibu lakukan minggu ini untuk mengatasi hambatan tersebut? Siapa saja rekan guru atau pihak yang dapat diajak berkolaborasi?`,
          expectedResponse: 'Guru berencana memperbarui format asesmen kebutuhan peserta didik, berkonsultasi ke MGBK, dan menyelipkan aktivitas membaca data sederhana saat layanan klasikal.'
        },
        {
          step: 'Tanggung Jawab (T)',
          duration: '7 menit',
          coachQuestion: `Langkah pertama mana yang akan dieksekusi lebih dulu, kapan target selesainya, dan bukti apa yang akan kita lihat bersama? Dukungan spesifik apa yang Bapak/Ibu perlukan dari saya selaku Kepala Sekolah?`,
          expectedResponse: 'Guru berkomitmen menyelesaikan revisi 1 RPL dan instrumen asesmen dalam 10 hari ke depan, serta memohon izin koordinasi jam layanan dengan wali kelas.'
        },
        {
          step: 'Penutup & Refleksi',
          duration: '5 menit',
          coachQuestion: `Apa hal paling bermakna yang Bapak/Ibu dapatkan dari perbincangan kita hari ini? Mari kita sepakati tanggal pertemuan lanjutan untuk saling merayakan kemajuan langkah aksi ini.`,
          expectedResponse: 'Guru merasa tercerahkan, memiliki peta jalan yang terukur, dan bersemangat menerapkan rencana tindak lanjut.'
        }
      ];

      return {
        focusArea: lowestCat,
        dialogSteps,
        recommendedRTL: [
          {
            fokus: `Peningkatan Kualitas Layanan BK pada Elemen ${lowestCat}`,
            tindakan: `Menyempurnakan dokumen RPL dan instrumen layanan dengan menyisipkan pertanyaan pemantik, lembar refleksi diri, dan penafsiran data minat/bakat peserta didik.`,
            sasaranWaktu: '2 Minggu setelah supervisi',
            buktiFisik: 'Dokumen RPL yang disempurnakan, Lembar Refleksi Peserta Didik, dan Rekap Catatan Layanan Kumulatif',
            dukungan: 'Kepala Sekolah (fasilitasi jam layanan), Wali Kelas, dan Rekan Sejawat MGBK'
          }
        ],
        source: 'heuristic'
      };
    },

    /**
     * AI Synthesis: Kesimpulan, Rekomendasi & Tindak Lanjut Supervisi BK
     */
    async synthesizeSupervisiBkConclusions(record, scoresMap = {}, activeIndicators = null) {
      const teacherName = record.teacherName || 'Guru BK';
      const inds = activeIndicators || (window.KS_BK_MANAGER ? window.KS_BK_MANAGER.getSupervisiIndicators() : []);
      const scoreData = window.KS_BK_MANAGER ? window.KS_BK_MANAGER.calculateSupervisiScore(scoresMap, inds) : { percentage: 75, predicate: 'Baik (B)' };

      // Identify strengths and improvement areas
      const strongItems = [];
      const weakItems = [];
      inds.forEach(item => {
        const sc = parseInt(scoresMap[item.number] !== undefined ? scoresMap[item.number] : 0, 10);
        if (sc >= 4) {
          strongItems.push(`Butir ${item.number}: ${item.title}`);
        } else if (sc <= 2) {
          weakItems.push(`Butir ${item.number}: ${item.title}`);
        }
      });

      const prompt = `Anda adalah Pengawas / Kepala Sekolah Ahli Bimbingan dan Konseling.
Berdasarkan data instrumen Supervisi Pelaksanaan dan Administrasi Guru BK berikut:
Nama Guru BK: ${teacherName}
Kelas Binaan: ${record.targetClass || 'Semua Kelas'}
Skor Capaian: ${scoreData.percentage}% (${scoreData.predicate})
Total Skor: ${scoreData.totalEarned} / ${scoreData.totalMax}

Indikator Unggul (Skor 4-5):
${strongItems.slice(0, 5).join('\n') || '- Berjalan merata pada standar'}

Indikator Perlu Perbaikan (Skor 0-2):
${weakItems.slice(0, 5).join('\n') || '- Tidak ada kelemahan kritis'}

Tugas: Susun 3 bagian naratif profesional dalam bahasa Indonesia resmi dan konstruktif:
1. Kesimpulan Supervisi BK
2. Rekomendasi Supervisi BK
3. Rencana Aksi Tindak Lanjut Supervisi BK

Keluarkan HANYA format JSON:
{
  "kesimpulan": "Naskah kesimpulan...",
  "rekomendasi": "Naskah rekomendasi...",
  "tindakLanjut": "Naskah aksi tindak lanjut..."
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.kesimpulan) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {
          console.warn('[synthesizeSupervisiBkConclusions] Gemini error:', e);
        }
      }

      // Offline Heuristic Synthesis
      const kesimpulan = `Berdasarkan hasil supervisi pelaksanaan dan administrasi BK, kinerja Ibu/Bapak ${teacherName} meraih skor ${scoreData.percentage}% dengan predikat ${scoreData.predicate}. Administrasi pokok seperti program tahunan, program semester, dan catatan kumulatif siswa telah terkelola dengan tertib. Layanan bimbingan klasikal dan layanan responsif telah berjalan dengan dedikasi tinggi dalam mendampingi kebutuhan peserta didik.`;

      const rekomendasi = `1. Mengoptimalkan pemanfaatan data asesmen diagnostik non-kognitif dan angket kebutuhan sebagai rujukan utama perancangan materi layanan BK.\n2. Mengintegrasikan prinsip pembelajaran mendalam (mindful, meaningful, joyful) serta penguatan literasi dan numerasi data diri siswa dalam setiap layanan klasikal.\n3. Meningkatkan dokumentasi jurnal konseling dan evaluasi tindak lanjut secara berkala bersama wali kelas.`;

      const tindakLanjut = `1. Menyusun rekapitulasi kebutuhan peserta didik berbasis instrumen mutakhir dalam waktu 2 minggu ke depan.\n2. Melaksanakan kolaborasi terjadwal bersama wali kelas dan guru mata pelajaran untuk pemetaan terpadu perkembangan siswa.\n3. Mengikuti kegiatan pembinaan di MGBK terkait inovasi media layanan bimbingan digital dan asesmen psikologis.`;

      return {
        kesimpulan,
        rekomendasi,
        tindakLanjut,
        source: 'heuristic'
      };
    },

    /**
     * AI Synthesis: Kesimpulan, Rekomendasi & Tindak Lanjut Telaah RPL BK
     */
    async synthesizeTelaahRplConclusions(record, rplMap = {}, activeRplIndicators = null) {
      const teacherName = record.teacherName || 'Guru BK';
      const topic = record.tahap2Topic || 'Layanan BK';
      const serviceType = record.tahap2ServiceType || 'Bimbingan Klasikal';
      const inds = activeRplIndicators || (window.KS_BK_MANAGER ? window.KS_BK_MANAGER.getRplIndicators() : []);
      const rplScore = window.KS_BK_MANAGER ? window.KS_BK_MANAGER.calculateRplScore(rplMap, inds) : { percentage: 80, predicate: 'Baik (B)' };

      const unfulfilled = [];
      inds.forEach(item => {
        const val = (rplMap[item.number] === 1 || rplMap[item.number] === '1' || rplMap[item.number] === true) ? 1 : 0;
        if (val === 0) {
          unfulfilled.push(`[${item.section}] ${item.title}`);
        }
      });

      const prompt = `Anda adalah Supervisor Ahli Kurikulum dan Layanan BK.
Berdasarkan hasil telaah dokumen Rencana Pelaksanaan Layanan (RPL BK):
Nama Guru BK: ${teacherName}
Topik Layanan: ${topic}
Jenis Layanan: ${serviceType}
Capaian Keterpenuhan RPL: ${rplScore.percentage}% (${rplScore.predicate})
Total Butir Terpenuhi: ${rplScore.totalEarned} / ${rplScore.totalMax}

Poin Belum Terpenuhi:
${unfulfilled.slice(0, 6).join('\n') || '- Seluruh komponen inti telah terpenuhi'}

Tugas: Susun 3 bagian naratif profesional dalam bahasa Indonesia resmi dan konstruktif:
1. Kesimpulan Telaah Dokumen RPL BK
2. Rekomendasi Penyempurnaan RPL BK
3. Rencana Aksi Tindak Lanjut Perbaikan RPL

Keluarkan HANYA format JSON:
{
  "kesimpulan": "Naskah kesimpulan...",
  "rekomendasi": "Naskah rekomendasi...",
  "tindakLanjut": "Naskah aksi tindak lanjut..."
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.kesimpulan) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {
          console.warn('[synthesizeTelaahRplConclusions] Gemini error:', e);
        }
      }

      // Offline Heuristic Synthesis
      const kesimpulan = `Dokumen RPL BK topik "${topic}" (${serviceType}) yang disusun oleh Ibu/Bapak ${teacherName} memperoleh persentase kelayakan ${rplScore.percentage}% (${rplScore.predicate}). Struktur rancangan layanan telah mencakup identitas, tujuan layanan, langkah kegiatan, dan rencana evaluasi secara sistematis.`;

      const rekomendasi = `1. Mempertegas pertanyaan pemantik dan aktivitas eksplorasi bermakna agar peserta didik aktif merefleksikan pengalamannya.\n2. Menyisipkan media berbasis data (tabel/grafik peminatan atau teks bacaan inspiratif) guna memperkuat kompetensi literasi dan numerasi peserta didik.\n3. Melengkapi instrumen evaluasi proses dan kepuasan peserta didik terhadap layanan yang diberikan.`;

      const tindakLanjut = `1. Merevisi 1 dokumen RPL dengan menambahkan lembar kerja siswa dan rubrik penilaian proses dalam rentang waktu 1 minggu.\n2. Menguji coba penerapan instrumen refleksi diri peserta didik pada pertemuan layanan klasikal berikutnya.\n3. Mengunggah naskah final RPL yang telah disempurnakan ke bank perangkat ajar sekolah.`;

      return {
        kesimpulan,
        rekomendasi,
        tindakLanjut,
        source: 'heuristic'
      };
    },

    /**
     * AI Synthesis: Kesimpulan, Rekomendasi & Tindak Lanjut Coaching BK (TIRTA)
     */
    async synthesizeCoachingBkConclusions(record, tirtaNotes = {}, rtlList = []) {
      const teacherName = record.teacherName || 'Guru BK';
      const notesSummary = Object.entries(tirtaNotes).map(([k, v]) => `${k}: ${v}`).join('\n');
      const rtlSummary = rtlList.map((r, i) => `${i + 1}. Fokus: ${r.fokus} | Aksi: ${r.tindakan} | Target: ${r.sasaranWaktu}`).join('\n');

      const prompt = `Anda adalah Coach Kepala Sekolah bersertifikat TIRTA.
Berdasarkan hasil percakapan coaching supervisi Guru BK:
Nama Coachee (Guru BK): ${teacherName}
Catatan Percakapan 6 Langkah TIRTA:
${notesSummary || 'Percakapan berlangsung kondusif dengan kesadaran reflektif tinggi dari guru.'}

Komitmen Rencana Tindak Lanjut (RTL):
${rtlSummary || 'Rencana penyempurnaan dokumen layanan dan pendampingan siswa.'}

Tugas: Susun 3 bagian naratif profesional dalam bahasa Indonesia resmi dan konstruktif:
1. Kesimpulan Wawancara Coaching BK
2. Rekomendasi Pemberdayaan Coachee (Guru BK)
3. Rencana Aksi Tindak Lanjut Coaching

Keluarkan HANYA format JSON:
{
  "kesimpulan": "Naskah kesimpulan...",
  "rekomendasi": "Naskah rekomendasi...",
  "tindakLanjut": "Naskah aksi tindak lanjut..."
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.kesimpulan) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {
          console.warn('[synthesizeCoachingBkConclusions] Gemini error:', e);
        }
      }

      // Offline Heuristic Synthesis
      const kesimpulan = `Percakapan coaching alur TIRTA bersama Ibu/Bapak ${teacherName} berlangsung hangat, terbuka, dan memberdayakan. Coachee secara mandiri berhasil mengidentifikasi kekuatan dalam komunikasi empatik dengan murid, sekaligus menyadari area yang perlu penguatan dalam manajemen waktu administrasi serta penyajian data asesmen yang lebih interaktif.`;

      const rekomendasi = `1. Kepala Sekolah memberikan ruang dan kemudahan koordinasi jadwal layanan BK di kelas tanpa mengganggu jam pembelajaran utama.\n2. Memberikan dukungan fasilitas teknologi sederhana (akses proyektor dan formulir digital) untuk mempermudah survei kebutuhan murid.\n3. Melanjutkan sesi refleksi berkala (check-in coaching) setiap tengah semester untuk memantau keberlanjutan motivasi guru.`;

      const tindakLanjut = `1. Coachee melaksanakan langkah aksi prioritas yang telah disepakati sesuai jadwal pada tabel RTL.\n2. Mengisi Lembar Refleksi Diri Pasca-Coaching secara mandiri di Portal Guru.\n3. Menjadwalkan pertemuan evaluasi tindak lanjut bersama Kepala Sekolah 1 bulan pasca supervisi.`;

      return {
        kesimpulan,
        rekomendasi,
        tindakLanjut,
        source: 'heuristic'
      };
    },

    /**
     * Generate 6 AI Recommended Answers for Coaching TIRTA Interview Table
     */
    async generateCoachingRecommendations(record) {
      const teacherName = record.teacherName || 'Guru BK';
      const supPct = record.supervisiScore?.percentage || 78;
      const rplPct = record.rplScore?.percentage || 82;

      const prompt = `Anda adalah Asisten AI Coaching Akademik Kepala Sekolah.
Susunkan DRAF JAWABAN REKOMENDASI AI untuk 6 butir pertanyaan wawancara coaching model TIRTA supervisi Guru BK:
Nama Guru BK: ${teacherName}
Skor Supervisi: ${supPct}%
Skor RPL: ${rplPct}%

6 Butir Tahap TIRTA:
1. Pembukaan (Membangun rasa aman dan kesepakatan waktu)
2. T: Tujuan (Fokus penguatan layanan BK 3 bulan ke depan)
3. I: Identifikasi (Kekuatan nyata, hambatan, dan bukti asesmen yang ada)
4. R: Rencana Aksi (Opsi konkret langkah perbaikan dan kolaborasi)
5. T: Tanggung Jawab (Prioritas utama, tenggat waktu, bukti fisik, dukungan)
6. Penutup & Refleksi (Hal paling bermakna dan jadwal temu lanjutan)

Keluarkan HANYA format JSON:
{
  "recommendations": {
    "Pembukaan": "Rekomendasi jawaban guru yang diharapkan...",
    "T: Tujuan": "Rekomendasi jawaban guru yang diharapkan...",
    "I: Identifikasi": "Rekomendasi jawaban guru yang diharapkan...",
    "R: Rencana aksi": "Rekomendasi jawaban guru yang diharapkan...",
    "T: Tanggung jawab": "Rekomendasi jawaban guru yang diharapkan...",
    "Penutup dan refleksi": "Rekomendasi jawaban guru yang diharapkan..."
  }
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.recommendations) return parsed.recommendations;
          }
        } catch (e) {}
      }

      // Offline Heuristic Defaults
      return {
        "Pembukaan": `Kabar baik dan siap berdiskusi terbuka. Harapan utama adalah memperoleh sudut pandang yang membangun untuk meningkatkan efektivitas layanan bimbingan klasikal dan konseling individu tanpa merasa dihakimi.`,
        "T: Tujuan": `Fokus penguatan pada integrasi pembelajaran mendalam (mindful, meaningful, joyful) serta penguatan literasi dan numerasi data diri siswa dalam RPL, sehingga peserta didik lebih aktif dan antusias mengikuti bimbingan.`,
        "I: Identifikasi": `Hubungan interpersonal dengan siswa dan komunikasi dengan wali kelas sudah berjalan baik. Namun, rekapitulasi angket kebutuhan dan instrumen asesmen diri siswa masih perlu dibuat lebih variatif dan tidak monoton.`,
        "R: Rencana aksi": `Menyusun kembali 1-2 modul RPL dengan menambahkan 2 pertanyaan pemantik, media infografik karier, dan jurnal refleksi singkat. Berkolaborasi dengan koordinator MGBK sekolah dan wali kelas.`,
        "T: Tanggung jawab": `Langkah pertama merevisi RPL dalam 10 hari ke depan, melengkapi lembar evaluasi kepuasan peserta didik, serta memohon fasilitasi jam bimbingan kelas dari Kepala Sekolah.`,
        "Penutup dan refleksi": `Mendapatkan pencerahan dan keyakinan diri bahwa supervisi adalah kemitraan yang positif. Siap bertemu kembali 3 minggu mendatang untuk meninjau hasil implementasi RPL baru.`
      };
    },

    /**
     * Full Automated RPL Text Analysis with Gemini (Parity with analyzeRppTextWithGemini)
     */
    async analyzeRplTextWithGemini(rplText, meta = {}) {
      const teacherName = meta.teacherName || 'Guru BK';
      const criteria = meta.criteria || (window.KS_BK_MANAGER ? window.KS_BK_MANAGER.getRplIndicators() : []);
      const chars = rplText.length;

      const prompt = `Anda adalah Asesor / Supervisor Ahli Rencana Pelaksanaan Layanan Bimbingan dan Konseling (RPL BK).
Analisis teks dokumen RPL BK berikut secara objektif dan mendalam:
TEKS DOKUMEN RPL BK (${chars} karakter):
"""
${rplText.substring(0, 7000)}
"""

DAFTAR ${criteria.length} BUTIR KRITERIA TELAAH RPL BK:
${criteria.map(c => `[ID ${c.number}] (${c.section}) - ${c.title}`).join('\n')}

Tugas Anda:
1. Tentukan skor tiap butir kriteria: 1 (Ada/Memenuhi) atau 0 (Tidak Ada/Belum Memenuhi).
2. Tuliskan catatan ringkas per aspek (A s.d F):
   - commentsA (Tujuan Layanan BK)
   - commentsB (Pengalaman Layanan BK)
   - commentsC (Prinsip Pembelajaran Mendalam / Deep Learning)
   - commentsD (Penguatan Literasi dan Numerasi)
   - commentsE (Pemanfaatan Media & Teknologi)
   - commentsF (Perencanaan Penilaian / Evaluasi)
3. Tuliskan 4 aspek umpan balik komprehensif:
   - feedbackStrengths (Kekuatan & Praktik Baik)
   - feedbackImprovements (Area yang Perlu Ditingkatkan)
   - feedbackRecommendations (Rekomendasi Penyempurnaan)
   - feedbackFollowUp (Rencana Tindak Lanjut yang Disarankan)
4. Tuliskan kesimpulan, rekomendasi, dan aksi tindak lanjut naratif:
   - kesimpulan
   - rekomendasi
   - tindakLanjut

Format keluaran WAJIB JSON persis:
{
  "scores": {
    "1": 1,
    "2": 0
  },
  "categoryComments": {
    "A": "Catatan aspek A...",
    "B": "Catatan aspek B...",
    "C": "Catatan aspek C...",
    "D": "Catatan aspek D...",
    "E": "Catatan aspek E...",
    "F": "Catatan aspek F..."
  },
  "feedbackStrengths": "...",
  "feedbackImprovements": "...",
  "feedbackRecommendations": "...",
  "feedbackFollowUp": "...",
  "kesimpulan": "...",
  "rekomendasi": "...",
  "tindakLanjut": "..."
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.scores) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {
          console.warn('[analyzeRplTextWithGemini] Gemini call failed, falling back:', e);
        }
      }

      // Offline Smart Heuristic RPL Inspection
      const lower = rplText.toLowerCase();
      const scores = {};
      let totalMet = 0;

      criteria.forEach(item => {
        const titleL = item.title.toLowerCase();
        let val = 1;

        if (titleL.includes('literasi') && !(lower.includes('literasi') || lower.includes('baca') || lower.includes('teks') || lower.includes('artikel'))) {
          val = 0;
        } else if (titleL.includes('numerasi') && !(lower.includes('numerasi') || lower.includes('data') || lower.includes('angka') || lower.includes('tabel') || lower.includes('grafik') || lower.includes('skor'))) {
          val = 0;
        } else if (titleL.includes('pemantik') && !(lower.includes('pemantik') || lower.includes('pertanyaan') || lower.includes('tanya'))) {
          val = 0;
        } else if (titleL.includes('refleksi') && !(lower.includes('refleksi') || lower.includes('jurnal') || lower.includes('umpan balik'))) {
          val = 0;
        } else if (titleL.includes('multimodal') && !(lower.includes('video') || lower.includes('poster') || lower.includes('infografik') || lower.includes('canva') || lower.includes('digital'))) {
          val = 0;
        } else if (titleL.includes('rubrik') && !(lower.includes('rubrik') || lower.includes('kriteria') || lower.includes('pedoman skoring'))) {
          val = 0;
        }

        scores[item.number] = val;
        if (val === 1) totalMet++;
      });

      const pct = Math.round((totalMet / criteria.length) * 100);

      return {
        scores,
        categoryComments: {
          A: 'Tujuan layanan BK telah dirumuskan jelas dan selaras dengan tugas perkembangan peserta didik.',
          B: 'Alur kegiatan layanan sistematis mencakup tahap awal, tahap inti, dan tahap penutup.',
          C: 'Prinsip pembelajaran bermakna (meaningful) tampak baik, namun perlu penguatan pada sesi refleksi terbimbing.',
          D: 'Aktivitas penguatan literasi dan numerasi perlu disajikan melalui penafsiran data minat/karier riil.',
          E: 'Media yang dirancang cukup variatif dan kontekstual dengan sarana sekolah.',
          F: 'Rencana evaluasi proses dan hasil telah dicantumkan, disarankan melengkapi instrumen kepuasan layanan.'
        },
        feedbackStrengths: `RPL topik "${meta.topic || 'Layanan BK'}" telah memiliki komponen yang lengkap, tujuan layanan yang spesifik, dan skenario interaksi yang komunikatif dengan peserta didik.`,
        feedbackImprovements: `Penguatan pada penyisipan pertanyaan pemantik mendalam, lembar kerja siswa berbasis interpretasi data/grafik, serta rubrik penilaian evaluasi proses.`,
        feedbackRecommendations: `1. Tambahkan 2 pertanyaan pemantik di awal sesi inti.\n2. Siapkan instrumen refleksi singkat 3 menit di akhir layanan.\n3. Integrasikan tabel atau grafik data diri untuk memperkuat literasi numerasi.`,
        feedbackFollowUp: `Guru BK merevisi dan menyempurnakan dokumen RPL sebelum implementasi di kelas, lalu mengunggah versi mutakhir ke bank modul ajar sekolah.`,
        kesimpulan: `Berdasarkan telaah otomatis terhadap naskah RPL (${chars} karakter), dokumen memenuhi ${totalMet} dari ${criteria.length} butir (${pct}%) dengan kategori kelayakan yang baik dan siap diimplementasikan setelah penyempurnaan minor.`,
        rekomendasi: `Disarankan menambahkan aktivitas membaca data sederhana serta lembar refleksi diri siswa untuk memperkaya pengalaman belajar bermakna.`,
        tindakLanjut: `Guru BK menyempurnakan dokumen RPL dalam 1 minggu dan berkoordinasi dengan Kepala Sekolah untuk implementasi layanan terbimbing.`,
        source: 'heuristic'
      };
    },

    /**
     * AI Conclusions & Recommendations for Lembar Laporan Hasil Supervisi BK
     */
    async generateReportConclusions(record) {
      const teacherName = record.teacherName || 'Guru BK';
      const supScore = record.supervisiScore || {};
      const rplScore = record.rplScore || {};
      const refleksiScore = record.refleksiScore || {};

      const prompt = `Anda adalah Supervisor Ahli Kepala Sekolah.
Buatkan analisis kesimpulan dan rekomendasi resmi untuk "Lembar Laporan Hasil Supervisi Guru BK" dengan profil berikut:
Nama Guru BK: ${teacherName}
1. Tahap Supervisi BK: Skor ${supScore.percentage || 0}% (${supScore.predicate || '-'})
2. Tahap Telaah RPL BK: Skor ${rplScore.percentage || 0}% (${rplScore.predicate || '-'})
3. Tahap Refleksi Diri Guru BK: Rata-rata Skor ${refleksiScore.average || 0} dari skala 4.0

Format keluaran WAJIB JSON:
{
  "ringkasanEksekutif": "Paragraf ringkasan capaian...",
  "kekuatanGuru": ["Poin kelebihan 1", "Poin kelebihan 2", "Poin kelebihan 3"],
  "aspekPerbaikan": ["Poin area pengembangan 1", "Poin area pengembangan 2"],
  "rekomendasiKepalaSekolah": ["Rekomendasi strategis 1", "Rekomendasi strategis 2"],
  "rencanaTindakLanjut": "Ringkasan tindak lanjut yang disepakati..."
}`;

      if (this.getApiKey()) {
        try {
          const aiResponse = await this.callGemini(prompt);
          if (aiResponse) {
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (parsed && parsed.ringkasanEksekutif) return { ...parsed, source: 'gemini' };
          }
        } catch (e) {}
      }

      // Offline Heuristic Generator
      return {
        ringkasanEksekutif: `Berdasarkan seluruh rangkaian supervisi yang meliputi Tahap 1 (Supervisi Pelaksanaan & Administrasi BK) dengan capaian ${supScore.percentage || 0}% (${supScore.predicate || 'Baik'}), Tahap 2 (Telaah RPL BK) dengan capaian ${rplScore.percentage || 0}% (${rplScore.predicate || 'Baik'}), serta Tahap 3 (Coaching Model TIRTA dan Refleksi Diri) dengan rata-rata ${refleksiScore.average || 3.5} / 4.0, disimpulkan bahwa Guru BK telah menjalankan program layanan secara profesional dan berorientasi pada kebutuhan peserta didik.`,
        kekuatanGuru: [
          'Memiliki komitmen tinggi dalam pendampingan peserta didik dan membangun relasi konseling yang empatik.',
          'Administrasi program tahunan dan semester telah tersusun runtut dan terarsip dengan rapi.',
          'Terbuka terhadap masukan reflektif dan proaktif dalam merumuskan rencana aksi pengembangan keprofesian.'
        ],
        aspekPerbaikan: [
          'Penguatan integrasi penguatan literasi informasi dan numerasi data diri peserta didik ke dalam aktivitas RPL.',
          'Penyediaan instrumen evaluasi kepuasan layanan dan jurnal refleksi berkala peserta didik setelah sesi klasikal/kelompok.'
        ],
        rekomendasiKepalaSekolah: [
          'Memberikan keleluasaan waktu kolaborasi berkala antara Guru BK dengan Wali Kelas untuk sinkronisasi pemetaan karakter peserta didik.',
          'Mendukung keikutsertaan Guru BK dalam workshop penguatan Deep Learning dan asesmen psikologis terkini.',
          'Memfasilitasi digitalisasi instrumen asesmen kebutuhan siswa agar data rekapitulasi dapat dianalisis lebih cepat.'
        ],
        rencanaTindakLanjut: 'Guru BK menyepakati revisi RPL berorientasi aktivitas bermakna (mindful, meaningful, joyful) dalam rentang waktu 2 minggu serta melakukan pemantauan berkala bersama Kepala Sekolah.',
        source: 'heuristic'
      };
    }
  };

  // Expose to window
  window.KS_BK_MANAGER = KS_BK_MANAGER;
  window.KS_BK_AI = KS_BK_AI;

})(typeof window !== 'undefined' ? window : this);
