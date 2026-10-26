/**
 * supervisisekolah.id - Classroom Observation Module
 * Based on 14 Indicators for Junior High School (SMP Kota Depok Model)
 * Integrating Deep Learning, Literacy & Numeracy
 */

const KS_OBSERVATION_DB = {
  STORAGE_KEY_OBS: 'depok_observations_v1',
  STORAGE_KEY_SCHOOLS: 'depok_schools_v1',
  STORAGE_KEY_CONFIG: 'depok_obs_config_v1',
  getCriteriaTemplate() {
    if (typeof window !== 'undefined' && window.KS_INDICATOR_MANAGER) {
      const dynamicList = window.KS_INDICATOR_MANAGER.getCriteriaTemplateForStage('3Observasi');
      if (dynamicList && dynamicList.length > 0) {
        return JSON.parse(JSON.stringify(dynamicList));
      }
    }
    return [];
  },

  getPraObservationTemplate() {
    if (typeof window !== 'undefined' && window.KS_INDICATOR_MANAGER) {
      const dynamicList = window.KS_INDICATOR_MANAGER.getCriteriaTemplateForStage('2PraObs');
      if (dynamicList && dynamicList.length > 0) {
        return JSON.parse(JSON.stringify(dynamicList));
      }
    }
    return [];
  },

  getPascaObservationTemplate() {
    if (typeof window !== 'undefined' && window.KS_INDICATOR_MANAGER) {
      const dynamicList = window.KS_INDICATOR_MANAGER.getCriteriaTemplateForStage('4PostObs');
      if (dynamicList && dynamicList.length > 0) {
        return JSON.parse(JSON.stringify(dynamicList));
      }
    }
    return [];
  },

  calculateScores(criteria) {
    if (!Array.isArray(criteria) || criteria.length === 0) {
      return { totalScore: 0, maxScore: 0, finalScore: 0, predicate: 'Kurang' };
    }
    const totalScore = criteria.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
    // Skala N indikator x 4
    const maxScore = criteria.length * 4;
    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    let predicate = 'Kurang';
    if (finalScore >= 86) predicate = 'Amat Baik';
    else if (finalScore >= 76) predicate = 'Baik';
    else if (finalScore >= 66) predicate = 'Cukup';
    else predicate = 'Kurang';

    return { totalScore, maxScore, finalScore, predicate };
  },

  getSchools() {
    let list = [];
    try {
      const data = localStorage.getItem(this.STORAGE_KEY_SCHOOLS);
      if (data) list = JSON.parse(data);
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      console.error('Error reading schools:', e);
      list = [];
    }

    // Always ensure current headmaster school profile is injected and updated
    if (typeof KS_AUTH !== 'undefined') {
      const p = KS_AUTH.getProfile();
      if (p && p.schoolName) {
        let sch = list.find(s => s.id === 'sch-primary' || s.name === p.schoolName);
        if (sch) {
          sch.name = p.schoolName;
          sch.npsn = p.npsn || sch.npsn || '20100123';
          sch.principalName = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Kepala Sekolah';
          sch.address = p.schoolAddress || sch.address || '-';
        } else {
          list.unshift({
            id: 'sch-primary',
            name: p.schoolName,
            npsn: p.npsn || '20100123',
            principalName: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Kepala Sekolah',
            supervisorName: 'Pengawas Pembina Disdik',
            address: p.schoolAddress || '-'
          });
        }
      }
    }

    if (list.length === 0) {
      list = [{
        id: 'sch-primary',
        name: 'SMP Brighton Junior',
        npsn: '20100123',
        principalName: 'Eagen Widi, M.Pd.',
        supervisorName: 'Pengawas Pembina Disdik',
        address: 'Jl. Raya Pendidikan No. 45'
      }];
    }

    return list;
  },

  saveSchools(schools) {
    localStorage.setItem(this.STORAGE_KEY_SCHOOLS, JSON.stringify(schools));
  },

  addSchool(school) {
    const schools = this.getSchools();
    const newSchool = {
      ...school,
      id: school.id || 'sch-' + Date.now()
    };
    schools.push(newSchool);
    this.saveSchools(schools);
    return newSchool;
  },

  getStorageKey() {
    let sid = 'default';
    if (typeof KS_AUTH !== 'undefined') {
      sid = KS_AUTH.getActiveSchoolId() || 'SCH-001';
    }
    return `ks_observations_${sid}_v2`;
  },

  getAll() {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      if (data) {
        let list = JSON.parse(data);
        if (Array.isArray(list)) {
          // Filter out any obsolete legacy seed/sample data
          const sampleObsIds = new Set(['obs-1790863106751', 'obs-1789006861349', 'obs-1791003221482', 'obs-1792051182944']);
          const cleaned = list.filter(item => item && !sampleObsIds.has(item.id) && !String(item.id).startsWith('obs-seed-'));
          if (cleaned.length !== list.length) {
            this.saveAll(cleaned);
          }
          return cleaned;
        }
      }
    } catch (e) {
      console.error('Error reading observations:', e);
    }

    // Pure MySQL database records: no seeds
    return [];
  },

  /**
   * Retrieve observations segregated by academic year & semester
   * @param {string} [academicYear]
   * @param {string} [semester]
   */
  getByPeriod(academicYear, semester) {
    const list = this.getAll();
    if (!academicYear && !semester) {
      if (typeof KS_AUTH !== 'undefined') {
        const p = KS_AUTH.getProfile();
        academicYear = p.academicYear;
        semester = p.semester;
      }
    }
    return list.filter(item => {
      const matchYear = !academicYear || item.academicYear === academicYear;
      const matchSem = !semester || item.semester === semester;
      return matchYear && matchSem;
    });
  },

  /**
   * Get all distinct academic year and semester pairs in database
   */
  getDistinctPeriods() {
    const list = this.getAll();
    const map = new Map();
    list.forEach(item => {
      if (item.academicYear && item.semester) {
        const key = `${item.academicYear} - Semester ${item.semester}`;
        if (!map.has(key)) {
          map.set(key, { academicYear: item.academicYear, semester: item.semester, label: key });
        }
      }
    });
    return Array.from(map.values());
  },

  saveAll(observations) {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(observations));
  },

  /**
   * Fetch observations for the active or specified cycle directly from server
   */
  async fetchFromServer(academicYear, semester) {
    if (typeof KS_AUTH === 'undefined') return this.getAll();
    try {
      const p = KS_AUTH.getProfile() || {};
      const ay = academicYear || p.academicYear || '2026/2027';
      const sem = semester || p.semester || 'Ganjil';
      const apiBase = KS_AUTH.getBaseUrl();
      const url = `${apiBase}api.php?action=get_observations&all_cycles=1`;
      const res = await KS_AUTH.fetchWithAuth(url);
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && Array.isArray(d.observations)) {
          this.saveAll(d.observations);
          return d.observations;
        }
      }
    } catch (e) {
      console.warn('[KS_OBSERVATION_DB] fetchFromServer error:', e);
    }
    return this.getAll();
  },

  getById(id) {
    const list = this.getAll();
    return list.find(item => item.id === id) || null;
  },

  save(observation) {
    const list = this.getAll();
    const { totalScore, maxScore, finalScore, predicate } = this.calculateScores(observation.criteria || this.getCriteriaTemplate());
    
    // Auto attach current active school_id, academic year and semester if not explicitly set
    let schoolId = observation.school_id;
    let academicYear = observation.academicYear;
    let semester = observation.semester;
    if (typeof KS_AUTH !== 'undefined') {
      const p = KS_AUTH.getProfile() || {};
      if (!schoolId) schoolId = KS_AUTH.getActiveSchoolId() || p.schoolId || 'SCH-001';
      if (!academicYear) academicYear = p.academicYear || '2026/2027';
      if (!semester) semester = p.semester || 'Ganjil';
      if (!observation.schoolName) observation.schoolName = p.schoolName || '';
    }

    const prepared = {
      ...observation,
      school_id: schoolId || 'SCH-001',
      academicYear: academicYear || '2026/2027',
      semester: semester || 'Ganjil',
      totalScore,
      maxScore,
      finalScore,
      predicate,
      updatedAt: new Date().toISOString()
    };

    if (prepared.id) {
      const idx = list.findIndex(item => item.id === prepared.id);
      if (idx !== -1) {
        list[idx] = prepared;
      } else {
        list.unshift(prepared);
      }
    } else {
      prepared.id = 'obs-' + Date.now();
      prepared.createdAt = new Date().toISOString();
      list.unshift(prepared);
    }

    this.saveAll(list);

    // Sync to Server-Side MySQL Database
    if (typeof KS_AUTH !== 'undefined') {
      try {
        KS_AUTH.fetchWithAuth(KS_AUTH.getBaseUrl() + 'api.php?action=save_observation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prepared)
        }).catch(() => {});
      } catch (e) {}
    }

    return prepared;
  },

  delete(id) {
    const list = this.getAll().filter(item => item.id !== id);
    this.saveAll(list);

    // Sync deletion to Server-Side MySQL Database
    if (typeof KS_AUTH !== 'undefined') {
      try {
        KS_AUTH.fetchWithAuth(KS_AUTH.getBaseUrl() + 'api.php?action=delete_observation&id=' + encodeURIComponent(id), {
          method: 'POST'
        }).catch(() => {});
      } catch (e) {}
    }

    return true;
  },

  deleteMultiple(ids) {
    const idSet = new Set(ids);
    const list = this.getAll().filter(item => !idSet.has(item.id));
    this.saveAll(list);
    return true;
  },

  /**
   * Pure MySQL records: no seed observations
   */
  generateInitialData() {
    return [];
  },

  /**
   * Export single observation to official PDF sheet
   */
  exportToPdf(observation) {
    if (typeof window.jspdf === 'undefined') {
      alert('Library jsPDF belum selesai dimuat. Silakan periksa koneksi internet Anda.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [30, 58, 138]; // Blue 900
    const secondaryColor = [71, 85, 105]; // Slate 600

    // Header KOP
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('LEMBAR HASIL OBSERVASI PEMBELAJARAN', 105, 18, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('SUPERVISI AKADEMIK SMP KOTA DEPOK - TAHUN AJARAN ' + (observation.academicYear || '2025/2026'), 105, 24, { align: 'center' });
    doc.text('Fokus: Pembelajaran Mendalam (Deep Learning), Literasi, dan Numerasi', 105, 29, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 33, 196, 33);

    // Identitas Info Table
    const metaData = [
      ['Nama Sekolah', ': ' + (observation.schoolName || '-'), 'Tanggal Observasi', ': ' + (observation.observationDate || '-')],
      ['Nama Guru', ': ' + (observation.teacherName || '-'), 'Mata Pelajaran', ': ' + (observation.subject || '-')],
      ['NIP Guru', ': ' + (observation.nip || '-'), 'Kelas / Semester', ': ' + (observation.gradeClass || '-') + ' / ' + (observation.semester || '-')],
      ['Nama Observer', ': ' + (observation.observerName || '-'), 'Nilai Akhir / Predikat', ': ' + observation.finalScore + ' (' + observation.predicate + ')']
    ];

    doc.autoTable({
      startY: 36,
      body: metaData,
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 1.5,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { cellWidth: 63 },
        2: { fontStyle: 'bold', cellWidth: 32 },
        3: { cellWidth: 55 }
      }
    });

    // Indikator Observasi Table
    const tableRows = (observation.criteria || []).map((c, i) => [
      i + 1,
      `[${c.section}] ${c.title}\n${c.description}`,
      c.score,
      c.comment || '-'
    ]);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 3,
      head: [['No', 'Indikator Observasi (14 Aspek Standar)', 'Skor (1-4)', 'Catatan / Deskripsi Fakta Teramati']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 72 }
      },
      didDrawPage: (data) => {
        // Footer page number
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Halaman ' + doc.internal.getNumberOfPages() + ' | Lembar Resmi Supervisi Pembelajaran SupervisiSekolah.id', 105, 290, { align: 'center' });
      }
    });

    // Score Summary Box & AI Recommendations
    let currentY = doc.lastAutoTable.finalY + 5;
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('RINGKASAN SKOR & ANALISIS KUALITATIF PEMBELAJARAN', 14, currentY);

    const summaryData = [
      ['Total Skor Perolehan', `${observation.totalScore} / 56`, 'Nilai Konversi (Skala 100)', `${observation.finalScore}`],
      ['Predikat Capaian', `${observation.predicate}`, 'Status Verifikasi', observation.isVerified ? 'Terverifikasi' : 'Draf']
    ];

    doc.autoTable({
      startY: currentY + 3,
      body: summaryData,
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { cellWidth: 45, halign: 'center', fontStyle: 'bold' },
        2: { fontStyle: 'bold', cellWidth: 45 },
        3: { cellWidth: 47, halign: 'center', fontStyle: 'bold' }
      }
    });

    // Analisis Hasil & Rekomendasi Tindak Lanjut Table
    let recDisplay = observation.recommendations || '';
    if (Array.isArray(observation.followUpPrograms) && observation.followUpPrograms.length > 0) {
      const progLines = observation.followUpPrograms.map((p, i) => `${i + 1}. ${p.program} (Sasaran: ${p.target || '-'} | Waktu: ${p.timeframe || '-'} | PIC: ${p.pic || '-'})`);
      recDisplay = progLines.join('\n');
    }
    if (!recDisplay) recDisplay = 'Konsultasi lanjutan dan pembinaan berkala di komunitas belajar.';

    const notesData = [
      ['Hal-hal Positive / Kelebihan Utama', observation.strengthsNotes || 'Menunjukkan praktik baik dan penguasaan pembelajaran yang terstruktur.'],
      ['Hal yang Perlu Ditingkatkan', observation.improvementsNotes || 'Pengayaan aspek pembelajaran dan keterlibatan aktif peserta didik.'],
      ['Catatan Umum Pengawas / Kesimpulan Supervisi', observation.criticalNotes || 'Kualitas proses pembelajaran berlangsung baik dan kondusif.'],
      ['Program & Rekomendasi Tindak Lanjut', recDisplay]
    ];

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 3,
      head: [['Aspek Analisis Hasil Supervisi', 'Uraian Catatan Pembelajaran & Program Tindak Lanjut']],
      body: notesData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 132 }
      }
    });

    // Signature Area for Observasi Inti
    let sigY = doc.lastAutoTable.finalY + 12;
    if (sigY > 245) {
      doc.addPage();
      sigY = 25;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    const cityDate = `Depok, ${observation.observationDate || new Date().toISOString().split('T')[0]}`;
    doc.text(cityDate, 140, sigY);
    
    doc.text('Guru yang Diobservasi,', 25, sigY + 6);
    doc.text('Kepala Sekolah / Observer,', 140, sigY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text(observation.teacherName || 'Guru', 25, sigY + 28);
    doc.text(observation.observerName || 'Kepala Sekolah', 140, sigY + 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('NIP. ' + (observation.nip || '-'), 25, sigY + 32);
    doc.text('NIP. ' + (observation.observerNip || '-'), 140, sigY + 32);

    // --- HALAMAN LAMPIRAN: TELAAH RPP (BAGIAN A) ---
    let telaah = observation.telaahData;
    if (!telaah && observation.telaahId && typeof KS_TELAAH_RPP_DB !== 'undefined') {
      telaah = KS_TELAAH_RPP_DB.getById(observation.telaahId);
    }
    if (!telaah && typeof KS_TELAAH_RPP_DB !== 'undefined') {
      telaah = KS_TELAAH_RPP_DB.getByTeacherName(observation.teacherName);
    }

    if (telaah) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('BAGIAN A: HASIL TELAAH RPP / MODUL AJAR', 105, 18, { align: 'center' });
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Tahap 1 Supervisi: Penelaahan Perencanaan Pembelajaran Mendalam', 105, 24, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(14, 27, 196, 27);

      const telaahMeta = [
        ['Topik / Materi Pokok', ': ' + (telaah.topic || observation.subject || '-'), 'Tanggal Telaah', ': ' + (telaah.reviewDate || telaah.date || observation.observationDate || '-')],
        ['Nama Penelaah', ': ' + (telaah.reviewerName || observation.observerName || '-'), 'Skor / Nilai RPP', ': ' + (telaah.finalScore !== undefined ? telaah.finalScore : '-') + ' / 100 (' + (telaah.rawScore || 0) + '/' + (telaah.maxScore || 168) + ')'],
        ['Predikat Kelayakan', ': ' + (telaah.predicate || '-'), 'Status Dokumen', ': Layak Diimplementasikan']
      ];

      doc.autoTable({
        startY: 31,
        body: telaahMeta,
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35 },
          1: { cellWidth: 60 },
          2: { fontStyle: 'bold', cellWidth: 35 },
          3: { cellWidth: 52 }
        }
      });

      const telaahFeedback = [
        ['1. Kelebihan Perencanaan (Praktik Baik RPP)', telaah.feedbackStrengths || telaah.commentsA || 'Perencanaan terstruktur dengan baik sesuai Capaian Pembelajaran dan memuat nalar kritis.'],
        ['2. Aspek yang Perlu Perbaikan', telaah.feedbackImprovements || telaah.commentsB || 'Perjelas diferensiasi proses dan instrumen asesmen autentik.'],
        ['3. Rekomendasi Tindak Lanjut Penelaah', telaah.feedbackRecommendations || telaah.commentsC || 'RPP / Modul Ajar layak diimplementasikan pada observasi kelas.'],
        ['4. Rencana Pendampingan Lanjutan', telaah.feedbackFollowUp || 'Pendampingan langsung pada tahapan pelaksanaan pembelajaran di kelas.']
      ];

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 4,
        head: [['Aspek Umpan Balik Telaah RPP', 'Uraian Catatan Penelaah & Rekomendasi Tindak Lanjut']],
        body: telaahFeedback,
        theme: 'grid',
        headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 132 }
        }
      });

      if (Array.isArray(telaah.criteria) && telaah.criteria.length > 0) {
        const telaahRows = telaah.criteria.map((c, idx) => [
          idx + 1,
          (c.category ? `[${c.category}] ` : '') + (c.name || c.title || '-'),
          c.score !== undefined ? String(c.score) : '-',
          c.notes || c.catatan || '-'
        ]);

        doc.autoTable({
          startY: doc.lastAutoTable.finalY + 6,
          head: [['No', 'Komponen / Indikator Telaah RPP', 'Skor', 'Catatan Penelaah']],
          body: telaahRows,
          theme: 'grid',
          headStyles: { fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
          styles: { fontSize: 7.5, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 105 },
            2: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
            3: { cellWidth: 52 }
          }
        });
      }
    }

    // --- HALAMAN LAMPIRAN: WAWANCARA PRA-OBSERVASI (BAGIAN B / LANGKAH 1) ---
    if (observation.praObservation && Array.isArray(observation.praObservation.questions)) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('BAGIAN B: WAWANCARA PRA-OBSERVASI', 105, 18, { align: 'center' });
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Langkah 1 Supervisi: Percakapan Awal / Coaching Klinis Perencanaan Pembelajaran', 105, 24, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(14, 27, 196, 27);

      const praRows = observation.praObservation.questions.map(q => [
        q.id,
        q.question,
        q.aiAnswer || '-',
        q.notes || '-'
      ]);

      doc.autoTable({
        startY: 31,
        head: [['No', 'Pertanyaan Wawancara Coaching', 'Jawaban Rekomendasi (Analisa RPP)', 'Catatan Wawancara Kepala Sekolah']],
        body: praRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 58 },
          2: { cellWidth: 62 },
          3: { cellWidth: 54 }
        }
      });

      if (observation.praObservation.conclusion) {
        let praConclY = doc.lastAutoTable.finalY + 4;
        if (praConclY > 250) {
          doc.addPage();
          praConclY = 20;
        }
        doc.autoTable({
          startY: praConclY,
          head: [['Kesimpulan dan Rekomendasi Pra-Observasi']],
          body: [[observation.praObservation.conclusion]],
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2.5 }
        });
      }
    }

    // --- HALAMAN LAMPIRAN: WAWANCARA PASCA-OBSERVASI (BAGIAN D / LANGKAH 3) ---
    if (observation.pascaObservation && Array.isArray(observation.pascaObservation.questions)) {
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('BAGIAN D: WAWANCARA PASCA-OBSERVASI', 105, 18, { align: 'center' });
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Refleksi Pembelajaran, Kesan Umum, dan Rencana Aksi Tindak Lanjut Menyeluruh', 105, 24, { align: 'center' });

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.line(14, 27, 196, 27);

      const pascaRows = observation.pascaObservation.questions.map(q => [
        q.id,
        q.question,
        q.aiAnswer || '-',
        q.notes || '-'
      ]);

      doc.autoTable({
        startY: 31,
        head: [['No', 'Pertanyaan Panduan Wawancara Coaching', 'Jawaban Rekomendasi (Sintesis AI)', 'Catatan Wawancara Kepala Sekolah']],
        body: pascaRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 58 },
          2: { cellWidth: 62 },
          3: { cellWidth: 54 }
        }
      });

      const pascaNotes = [];
      if (observation.pascaObservation.generalImpression) {
        pascaNotes.push(['Kesan Umum & Saran Pertemuan Berikutnya', observation.pascaObservation.generalImpression]);
      }
      if (observation.pascaObservation.conclusion) {
        pascaNotes.push(['Kesimpulan, Rekomendasi Observasi & Aksi Tindak Lanjut', observation.pascaObservation.conclusion]);
      }

      if (pascaNotes.length > 0) {
        let pascaConclY = doc.lastAutoTable.finalY + 4;
        if (pascaConclY > 240) {
          doc.addPage();
          pascaConclY = 20;
        }
        doc.autoTable({
          startY: pascaConclY,
          head: [['Aspek Kesimpulan Pasca-Observasi', 'Uraian Hasil Coaching & Aksi Tindak Lanjut']],
          body: pascaNotes,
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2.5 },
          columnStyles: {
            0: { cellWidth: 60, fontStyle: 'bold' },
            1: { cellWidth: 122 }
          }
        });
      }
    }

    // Save PDF
    const filename = `Observasi_${(observation.teacherName || 'Guru').replace(/[^a-zA-Z0-9]/g, '_')}_${observation.observationDate || '2026'}.pdf`;
    doc.save(filename);
  },

  /**
   * Export all observations to Excel (XLSX)
   */
  exportToExcel(observations = null) {
    if (typeof window.XLSX === 'undefined') {
      alert('Library SheetJS XLSX belum selesai dimuat. Silakan periksa koneksi internet Anda.');
      return;
    }

    const data = observations || this.getAll();

    // 1. Rekap sheet
    const summaryRows = data.map((item, index) => ({
      'No': index + 1,
      'Tanggal Observasi': item.observationDate || '-',
      'Nama Guru': item.teacherName || '-',
      'NIP Guru': item.nip || '-',
      'Mata Pelajaran': item.subject || '-',
      'Kelas': item.gradeClass || '-',
      'Sekolah': item.schoolName || '-',
      'Observer / KS': item.observerName || '-',
      'Total Skor (Max 56)': item.totalScore || 0,
      'Nilai Akhir (100)': item.finalScore || 0,
      'Predikat': item.predicate || '-',
      'Status Verifikasi': item.isVerified ? 'Terverifikasi' : 'Draf',
      'Kekuatan Guru': item.strengthsNotes || '-',
      'Area Perbaikan': item.improvementsNotes || '-',
      'Rekomendasi Tindak Lanjut': item.recommendations || '-'
    }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekapitulasi Observasi');

    // 2. Detail 14 Indikator sheet
    const detailRows = [];
    data.forEach((item, oIdx) => {
      (item.criteria || []).forEach(c => {
        detailRows.push({
          'ID Observasi': item.id,
          'Nama Guru': item.teacherName,
          'Mata Pelajaran': item.subject,
          'Kelas': item.gradeClass,
          'No Indikator': c.id,
          'Bagian': c.section,
          'Nama Indikator': c.title,
          'Skor (1-4)': c.score,
          'Catatan Pengamatan': c.comment || '-'
        });
      });
    });

    const wsDetails = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Rincian 14 Indikator');

    // Download file
    const filename = `Rekap_Observasi_Guru_SMP_Depok_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  }
};

window.KS_OBSERVATION_DB = KS_OBSERVATION_DB;
window.SUPERVISI_OBSERVATION_DB = KS_OBSERVATION_DB;
