/**
 * supervisisekolah.id - Supervision Indicators & Dynamic Category Manager
 * Pure MySQL Client - Single Database Architecture (supervisisekolah_id)
 * Fetches authoritative categories, active categories, and indicators strictly from MySQL via api.php
 * Stages:
 *  - 1TelaahModulAjar (Tahap 1: Telaah Modul Ajar / RPP)
 *  - 2PraObs          (Tahap 2: Wawancara Pra-Observasi)
 *  - 3Observasi       (Tahap 3: Observasi Pembelajaran Kelas)
 *  - 4PostObs         (Tahap 4: Wawancara Pasca-Observasi / Refleksi)
 */

const KS_INDICATOR_MANAGER = {
  STORAGE_KEY_CONFIG: 'ks_supervision_config_cache_v3',
  STORAGE_KEY_ACTIVE: 'ks_active_categories_v3',

  _configCache: null,

  getBaseUrl() {
    if (typeof window.KS_AUTH !== 'undefined' && typeof window.KS_AUTH.getBaseUrl === 'function') {
      return window.KS_AUTH.getBaseUrl();
    }
    const path = window.location.pathname;
    if (path.includes('/supervisisekolah.id/')) {
      return window.location.origin + '/supervisisekolah.id/';
    }
    if (path.includes('/ks.id/')) {
      return window.location.origin + '/ks.id/';
    }
    return window.location.origin + '/';
  },

  getCurrentPeriod() {
    if (typeof window.KS_AUTH !== 'undefined') {
      const p = window.KS_AUTH.getProfile();
      if (p && (p.academicYear || p.semester)) {
        return {
          academicYear: p.academicYear || '2026/2027',
          semester: p.semester || 'Ganjil'
        };
      }
    }
    return { academicYear: '2026/2027', semester: 'Ganjil' };
  },

  /**
   * Load Config strictly from MySQL Server via api.php
   */
  async loadConfig(academicYear, semester, forceRefresh = false) {
    const period = this.getCurrentPeriod();
    const year = academicYear || period.academicYear;
    const sem = semester || period.semester;
    const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
    const cacheKey = `${this.STORAGE_KEY_CONFIG}_${sid}_${year}_${sem}`;

    if (!forceRefresh && this._configCache && this._configCache.academicYear === year && this._configCache.semester === sem && this._configCache.school_id === sid) {
      return this._configCache;
    }

    try {
      const url = `${this.getBaseUrl()}api.php?action=get_supervision_config&school_id=${encodeURIComponent(sid)}&academicYear=${encodeURIComponent(year)}&semester=${encodeURIComponent(sem)}`;
      const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url) : fetch(url));
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.indicators)) {
          this._configCache = data;
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (e) {}
          return data;
        }
      }
    } catch (e) {
      console.warn('[KS_INDICATOR_MANAGER] Gagal fetch config dari MySQL API:', e);
    }

    // Secondary cached read (only if server network is temporarily disconnected)
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cData = JSON.parse(cached);
        if (cData && Array.isArray(cData.indicators) && cData.indicators.length > 0) {
          this._configCache = cData;
          return this._configCache;
        }
      } catch (err) {}
    }

    return {
      success: true,
      school_id: sid,
      academicYear: year,
      semester: sem,
      active_categories: [],
      categories: [],
      indicators: []
    };
  },

  /**
   * Save Active Categories directly to MySQL Server for a specific Academic Year & Semester
   */
  async saveActiveCategories(academicYear, semester, activeCategoriesList) {
    const period = this.getCurrentPeriod();
    const year = academicYear || period.academicYear;
    const sem = semester || period.semester;
    const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
    const cacheKey = `${this.STORAGE_KEY_CONFIG}_${sid}_${year}_${sem}`;

    try {
      const url = `${this.getBaseUrl()}api.php?action=save_active_categories`;
      const res = await (typeof window.KS_AUTH !== 'undefined' ? window.KS_AUTH.fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: sid,
          academicYear: year,
          semester: sem,
          categories: activeCategoriesList
        })
      }) : fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: sid,
          academicYear: year,
          semester: sem,
          categories: activeCategoriesList
        })
      }));

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (this._configCache) {
            this._configCache.active_categories = activeCategoriesList;
          }
          try {
            localStorage.setItem(this.STORAGE_KEY_ACTIVE + `_${sid}_${year}_${sem}`, JSON.stringify(activeCategoriesList));
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const cObj = JSON.parse(cached);
              cObj.active_categories = activeCategoriesList;
              localStorage.setItem(cacheKey, JSON.stringify(cObj));
            }
          } catch (e) {}

          window.dispatchEvent(new CustomEvent('ks:active-categories-updated', {
            detail: { school_id: sid, academicYear: year, semester: sem, categories: activeCategoriesList }
          }));
          return data;
        }
      }
    } catch (e) {
      console.error('[KS_INDICATOR_MANAGER] Gagal menyimpan kategori aktif ke MySQL:', e);
      throw e;
    }

    return { success: false, error: 'Koneksi ke MySQL gagal.' };
  },

  /**
   * Get filtered indicators for a stage based on active categories from MySQL
   */
  getIndicatorsForStage(stage, activeCategories = null) {
    if (!this._configCache || !Array.isArray(this._configCache.indicators)) {
      return [];
    }

    const activeList = activeCategories || this._configCache.active_categories || [];
    const allIndicators = this._configCache.indicators;
    const catsMeta = (this._configCache && Array.isArray(this._configCache.categories)) ? this._configCache.categories : [];

    // Filter strictly by stage and active category
    return allIndicators.filter(ind => {
      const indStage = ind.stage || '';
      const indCat = ind.category_name || ind.categoryName || '';
      return indStage === stage && (activeList.length === 0 || activeList.includes(indCat));
    }).sort((a, b) => {
      const catA = a.category_name || a.categoryName || '';
      const catB = b.category_name || b.categoryName || '';
      const metaA = catsMeta.find(c => c.name === catA);
      const metaB = catsMeta.find(c => c.name === catB);
      const orderA = metaA ? (parseInt(metaA.sort_order || 0) || 0) : (a.cat_sort_order || 99);
      const orderB = metaB ? (parseInt(metaB.sort_order || 0) || 0) : (b.cat_sort_order || 99);
      if (orderA !== orderB) return orderA - orderB;
      const numA = parseInt(a.number_order || a.numberOrder || 0);
      const numB = parseInt(b.number_order || b.numberOrder || 0);
      return numA - numB;
    });
  },

  /**
   * Helper to format Category Badge Colors (Tailwind classes)
   */
  getCategoryTheme(color) {
    const map = {
      blue:    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-600 text-white', accent: '#2563eb' },
      sky:     { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', badge: 'bg-sky-600 text-white', accent: '#0284c7' },
      amber:   { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-600 text-white', accent: '#d97706' },
      rose:    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-600 text-white', accent: '#e11d48' },
      indigo:  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-600 text-white', accent: '#4f46e5' },
      purple:  { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-600 text-white', accent: '#9333ea' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600 text-white', accent: '#059669' },
      teal:    { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-600 text-white', accent: '#0d9488' }
    };
    return map[color] || map['blue'];
  },

  /**
   * Generate Informational Banner HTML for Stage Header
   */
  generateStageHeaderBanner(stage, stageName, activeIndicators) {
    if (!this._configCache) return '';
    const activeCats = this._configCache.active_categories || [];
    const categoriesMeta = this._configCache.categories || [];

    // Group active indicators by category
    const catCounts = {};
    (activeIndicators || []).forEach(ind => {
      const cat = ind.category_name || ind.categoryName || ind.category || '';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });

    const activeBadges = Object.keys(catCounts).map(catName => {
      const meta = categoriesMeta.find(c => c.name === catName) || { color: 'blue', icon: 'bookmark' };
      const theme = this.getCategoryTheme(meta.color);
      return `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${theme.bg} ${theme.text} border ${theme.border}">
          <i class="fa-solid fa-check text-[10px]"></i>
          <span>${catName}</span>
          <span class="px-1.5 py-0.5 rounded-full bg-white/80 text-[10px] font-black">${catCounts[catName]} Butir</span>
        </span>
      `;
    }).join('');

    const period = this.getCurrentPeriod();
    const count = (activeIndicators || []).length;
    const maxScore = count * 4;

    return `
      <div class="mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-200/80 shadow-xs">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-blue-100">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm shadow-xs">
              <i class="fa-solid fa-layer-group"></i>
            </span>
            <div>
              <h4 class="text-xs md:text-sm font-bold text-slate-800">
                Kategori Supervisi Aktif: ${stageName}
              </h4>
              <p class="text-[11px] text-slate-500">
                Berlaku untuk Semester ${period.semester} Tahun Ajaran ${period.academicYear} • Ditetapkan oleh Kepala Sekolah
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="px-3 py-1 bg-white border border-blue-200 rounded-xl font-bold text-blue-700 shadow-2xs">
              Total: <strong>${count}</strong> Butir Indikator
            </span>
            ${stage.includes('Telaah') || stage.includes('Observasi') ? `
            <span class="px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-emerald-700 shadow-2xs">
              Skor Maksimal: <strong>${maxScore}</strong> (Skala 1 - 4)
            </span>` : ''}
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Elemen Terpilih:</span>
          ${activeBadges.length > 0 ? activeBadges : '<span class="text-xs text-amber-600 font-semibold italic">Belum ada kategori yang diaktifkan di Pengaturan.</span>'}
        </div>
      </div>
    `;
  },

  /**
   * Calculate Predicate
   */
  getPredicate(scorePercentage) {
    const s = parseFloat(scorePercentage);
    if (s >= 86) return 'Amat Baik';
    if (s >= 76) return 'Baik';
    if (s >= 66) return 'Cukup';
    return 'Kurang';
  },

  /**
   * Get formatted template criteria for specific stage strictly based on MySQL data
   */
  getCriteriaTemplateForStage(stage) {
    const indicators = this.getIndicatorsForStage(stage);
    if (!indicators || indicators.length === 0) {
      return [];
    }

    const categoriesMeta = (this._configCache && Array.isArray(this._configCache.categories)) ? this._configCache.categories : [];

    if (stage === '1TelaahModulAjar') {
      return indicators.map((ind, idx) => {
        const catName = ind.category_name || ind.categoryName || ind.category || 'Elemen Dasar';
        const catId = ind.category_id || ind.categoryId || 'ELE';
        const catMeta = categoriesMeta.find(c => c.name === catName || c.id === catId || c.code === catId);

        return {
          id: ind.id || (idx + 1),
          number: parseInt(ind.number_order || ind.numberOrder || (idx + 1)),
          title: ind.title || '',
          focus: ind.focus || '',
          category: catName,
          categoryName: catName,
          categoryId: catId,
          color: (catMeta && catMeta.color) || ind.cat_color || ind.color || 'blue',
          icon: (catMeta && catMeta.icon) || ind.cat_icon || ind.icon || 'layers',
          score: 3
        };
      });
    } else if (stage === '2PraObs') {
      return indicators.map((ind, idx) => {
        const catName = ind.category_name || ind.categoryName || ind.category || 'Elemen Dasar';
        const catId = ind.category_id || ind.categoryId || 'ELE';
        const catMeta = categoriesMeta.find(c => c.name === catName || c.id === catId || c.code === catId);

        return {
          id: ind.id || (idx + 1),
          number: parseInt(ind.number_order || ind.numberOrder || (idx + 1)),
          question: ind.title || '',
          focus: ind.focus || '',
          category: catName,
          categoryName: catName,
          categoryId: catId,
          color: (catMeta && catMeta.color) || ind.cat_color || ind.color || 'blue',
          icon: (catMeta && catMeta.icon) || ind.cat_icon || ind.icon || 'layers',
          aiAnswer: '',
          notes: ''
        };
      });
    } else if (stage === '3Observasi') {
      return indicators.map((ind, idx) => {
        const catName = ind.category_name || ind.categoryName || ind.category || 'Elemen Dasar';
        const catId = ind.category_id || ind.categoryId || 'ELE';
        const catMeta = categoriesMeta.find(c => c.name === catName || c.id === catId || c.code === catId);

        return {
          id: ind.id || (idx + 1),
          number: parseInt(ind.number_order || ind.numberOrder || (idx + 1)),
          section: catId,
          sectionTitle: catName,
          title: ind.title || '',
          description: ind.title || '',
          focus: ind.focus || '',
          category: catName,
          categoryName: catName,
          categoryId: catId,
          color: (catMeta && catMeta.color) || ind.cat_color || ind.color || 'blue',
          icon: (catMeta && catMeta.icon) || ind.cat_icon || ind.icon || 'layers',
          score: 4,
          comment: ''
        };
      });
    } else if (stage === '4PostObs') {
      return indicators.map((ind, idx) => {
        const catName = ind.category_name || ind.categoryName || ind.category || 'Elemen Dasar';
        const catId = ind.category_id || ind.categoryId || 'ELE';
        const catMeta = categoriesMeta.find(c => c.name === catName || c.id === catId || c.code === catId);

        return {
          id: ind.id || (idx + 1),
          number: parseInt(ind.number_order || ind.numberOrder || (idx + 1)),
          question: ind.title || '',
          focus: ind.focus || '',
          category: catName,
          categoryName: catName,
          categoryId: catId,
          color: (catMeta && catMeta.color) || ind.cat_color || ind.color || 'blue',
          icon: (catMeta && catMeta.icon) || ind.cat_icon || ind.icon || 'layers',
          aiAnswer: '',
          notes: ''
        };
      });
    }

    return indicators;
  },

  /**
   * Generate Report Categories Badge HTML
   */
  generateReportCategoriesSummary(activeCategoriesList = null, totalIndicators = null, maxScore = null) {
    if (!this._configCache) return '';
    const activeCats = activeCategoriesList || this._configCache.active_categories || [];
    const categoriesMeta = this._configCache.categories || [];

    const badges = activeCats.map(catName => {
      const meta = categoriesMeta.find(c => c.name === catName) || { color: 'blue', icon: 'check' };
      const theme = this.getCategoryTheme(meta.color);
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${theme.bg} ${theme.text} border ${theme.border} print:border-slate-400 print:text-slate-800">
        <i class="fa-solid fa-check text-[9px]"></i>
        <span>${catName}</span>
      </span>`;
    }).join(' ');

    return `
      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 print:bg-white print:border-slate-300">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            <i class="fa-solid fa-layer-group text-blue-600 mr-1"></i>
            Kategori Supervisi Terpilih (Semester Ini):
          </span>
          ${totalIndicators ? `<span class="font-bold text-slate-600">${totalIndicators} Indikator ${maxScore ? `• Skor Maks: ${maxScore}` : ''}</span>` : ''}
        </div>
        <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
          ${badges || '<span class="italic text-slate-400">Semua Kategori Aktif</span>'}
        </div>
      </div>
    `;
  },

  /**
   * Get Active Category Names Array strictly from MySQL config cache
   */
  getActiveCategoryNames() {
    if (this._configCache && Array.isArray(this._configCache.active_categories) && this._configCache.active_categories.length > 0) {
      return this._configCache.active_categories;
    }
    const sid = (typeof window.KS_AUTH !== 'undefined') ? window.KS_AUTH.getActiveSchoolId() : 'default';
    const period = this.getCurrentPeriod();
    const cachedKey = this.STORAGE_KEY_ACTIVE + `_${sid}_${period.academicYear}_${period.semester}`;
    const local = localStorage.getItem(cachedKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    if (this._configCache && Array.isArray(this._configCache.categories)) {
      return this._configCache.categories.map(c => c.name);
    }
    return [];
  },

  /**
   * Get Active Categories with Metadata strictly from MySQL
   */
  getActiveCategories() {
    const activeNames = this.getActiveCategoryNames();
    const categoriesMeta = (this._configCache && Array.isArray(this._configCache.categories)) ? this._configCache.categories : [];
    return categoriesMeta.filter(c => activeNames.includes(c.name));
  }
};

window.KS_INDICATOR_MANAGER = KS_INDICATOR_MANAGER;
window.SUPERVISI_INDICATOR_MANAGER = KS_INDICATOR_MANAGER;
