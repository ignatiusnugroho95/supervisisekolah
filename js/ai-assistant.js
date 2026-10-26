/**
 * supervisisekolah.id - AI Assistant Module for Classroom Observation
 * Powered by Google Gemini API with smart heuristic fallback
 */

const KS_AI = {
  STORAGE_KEY_API: 'depok_gemini_api_key',
  STORAGE_KEY_MODEL: 'depok_gemini_model',
  DEFAULT_MODEL: 'gemini-1.5-flash',

  getApiKey() {
    return localStorage.getItem(this.STORAGE_KEY_API) || '';
  },

  setApiKey(key) {
    if (key) {
      localStorage.setItem(this.STORAGE_KEY_API, key.trim());
    } else {
      localStorage.removeItem(this.STORAGE_KEY_API);
    }
  },

  getModel() {
    return localStorage.getItem(this.STORAGE_KEY_MODEL) || this.DEFAULT_MODEL;
  },

  setModel(model) {
    localStorage.setItem(this.STORAGE_KEY_MODEL, model);
  },

  /**
   * Main function to analyze teacher observation data
   * Returns a promise resolving to:
   * {
   *   strengthsNotes: string,
   *   improvementsNotes: string,
   *   criticalNotes: string,
   *   recommendations: string,
   *   source: 'gemini' | 'heuristic'
   * }
   */
  async analyzeObservation(data) {
    const apiKey = this.getApiKey();

    if (apiKey) {
      try {
        const geminiResult = await this.callGeminiApi(apiKey, data);
        if (geminiResult) {
          return {
            ...geminiResult,
            source: 'gemini'
          };
        }
      } catch (err) {
        console.warn('Gemini API call failed, falling back to smart heuristic:', err);
      }
    }

    // Heuristic fallback (works 100% offline & without API key)
    return {
      ...this.generateSmartHeuristic(data),
      source: 'heuristic'
    };
  },

  /**
   * Call Gemini REST API directly
   */
  async callGeminiApi(apiKey, data) {
    const model = this.getModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Anda adalah Asesor / Supervisor Kepala Sekolah Ahli Pembelajaran Mendalam (Deep Learning) dan Literasi-Numerasi.
Tugas Anda adalah menganalisis hasil observasi pembelajaran kelas guru berikut:

IDENTITAS OBSERVASI:
- Nama Guru: ${data.teacherName || 'Guru'}
- Mata Pelajaran: ${data.subject || 'Mata Pelajaran'}
- Kelas: ${data.gradeClass || '-'}
- Sekolah: ${data.schoolName || '-'}
- Skor Total: ${data.totalScore}/56
- Nilai Akhir: ${data.finalScore} (Predikat: ${data.predicate})

Rincian Nilai Tiap Indikator (Skor 1-4):
${(data.criteria || []).map((c, i) => `${i + 1}. [Bagian ${c.section}] ${c.title}: Skor ${c.score}/4. Catatan Bukti: ${c.comment || 'Tidak ada catatan'}`).join('\n')}

TUGAS ANDA:
Berikan rekomendasi supervisi mendalam berfokus pada Penguatan Literasi, Numerasi, dan Pembelajaran Mendalam (Deep Learning).
Format respon HARUS berupa format JSON murni tanpa markdown wrapper lainnya, dengan struktur keys persis berikut:
{
  "strengthsNotes": "Uraian praktik baik, penguasaan materi, atau inovasi yang ditunjukkan guru (2-3 butir/paragraf)",
  "improvementsNotes": "Uraian aspek pembelajaran yang memerlukan pembinaan lebih lanjut (2-3 butir/paragraf)",
  "criticalNotes": "Kesimpulan umum pengawas mengenai kualitas proses pembelajaran",
  "recommendations": "Uraian rekomendasi tindak lanjut konkret secara keseluruhan",
  "followUpPrograms": [
    {
      "program": "Nama program pembinaan / kegiatan (misal: Coaching Klinis Diferensiasi Pembelajaran)",
      "target": "Target kompetensi / perubahan perilaku guru yang diharapkan",
      "timeframe": "Waktu pelaksanaan (misal: Minggu ke-2 Bulan Depan)",
      "pic": "Kepala Sekolah / Guru Pamong"
    }
  ]
}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const resJson = await response.json();
    const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) throw new Error('Empty response from Gemini API');

    // Parse JSON
    try {
      const parsed = JSON.parse(textOutput);
      return {
        strengthsNotes: parsed.strengthsNotes || '',
        improvementsNotes: parsed.improvementsNotes || '',
        criticalNotes: parsed.criticalNotes || '',
        recommendations: parsed.recommendations || '',
        followUpPrograms: Array.isArray(parsed.followUpPrograms) ? parsed.followUpPrograms : []
      };
    } catch (e) {
      // In case text returned has markdown backticks
      const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        strengthsNotes: parsed.strengthsNotes || '',
        improvementsNotes: parsed.improvementsNotes || '',
        criticalNotes: parsed.criticalNotes || '',
        recommendations: parsed.recommendations || '',
        followUpPrograms: Array.isArray(parsed.followUpPrograms) ? parsed.followUpPrograms : []
      };
    }
  },

  /**
   * Smart Rule-Based & Pedagogical Heuristic Generator
   * Deep learning, literacy, numeracy & 14 indicators aligned
   */
  generateSmartHeuristic(data) {
    const { teacherName = 'Guru', subject = 'Mata Pelajaran', criteria = [], finalScore = 0, predicate = 'Baik' } = data;

    // Categorize criteria scores
    const strengths = [];
    const improvements = [];
    const weakPoints = [];

    criteria.forEach(c => {
      if (c.score === 4) {
        strengths.push(c.title);
      } else if (c.score === 3) {
        // Satisfactory
      } else if (c.score === 2) {
        improvements.push(c.title);
      } else if (c.score === 1) {
        weakPoints.push(c.title);
      }
    });

    // 1. Strengths notes
    let strengthsText = '';
    if (strengths.length > 0) {
      strengthsText = `Berdasarkan observasi, Ibu/Bapak ${teacherName} menunjukkan praktik baik dan kelebihan utama terutama pada: ${strengths.slice(0, 2).join('; ')}. Guru mampu membangun keterlibatan aktif peserta didik, mengkondisikan kesiapan belajar, serta mengarahkan fokus pembelajaran secara terstruktur.`;
    } else {
      strengthsText = `Ibu/Bapak ${teacherName} telah melaksanakan proses pembelajaran ${subject} secara runtut mulai dari tahap pendahuluan, inti, hingga penutup dengan penguasaan materi yang memadai.`;
    }

    // 2. Improvements notes
    let improvementsText = '';
    if (weakPoints.length > 0 || improvements.length > 0) {
      const targetAreas = [...weakPoints, ...improvements];
      improvementsText = `Aspek pembelajaran yang memerlukan pembinaan lebih lanjut teridentifikasi pada: ${targetAreas.slice(0, 2).join('; ')}. Disarankan memperdalam stimulasi pertanyaan pemantik reflektif, penguatan literasi membaca data/teks multimoda, serta diferensiasi konten/proses sesuai kesiapan belajar murid.`;
    } else {
      improvementsText = `Secara umum implementasi pembelajaran sudah memenuhi standar yang baik. Untuk pengembangan berkesinambungan, disarankan guru mulai mengintegrasikan variasi teks multimoda digital serta asesmen formatif autentik.`;
    }

    // 3. Critical notes / Kesimpulan Supervisi
    let criticalText = '';
    if (finalScore >= 91) {
      criticalText = `Kualitas proses pembelajaran berkategori 'Amat Baik' (${finalScore}/100). Guru memfasilitasi pemahaman mendalam secara kontekstual dan iklim kelas interaktif kondusif. Patut menjadi model berbagi praktik baik (Kombel).`;
    } else if (finalScore >= 81) {
      criticalText = `Kualitas proses pembelajaran berkategori 'Baik' (${finalScore}/100). Struktur alur pembelajaran terlaksana dengan baik, namun penguatan eksplorasi mandiri dan nalar kritis siswa masih dapat ditingkatkan.`;
    } else if (finalScore >= 71) {
      criticalText = `Kualitas proses pembelajaran berkategori 'Cukup' (${finalScore}/100). Diperlukan penguatan pada variasi metode aktif dan penguatan literasi-numerasi agar siswa tidak pasif.`;
    } else {
      criticalText = `Kualitas proses pembelajaran berkategori 'Kurang' (${finalScore}/100). Guru memerlukan pendampingan intensif dan coaching klinis terkait perencanaan serta pengelolaan interaksi kelas.`;
    }

    // 4. Recommendations & Follow-up programs
    let recText = '';
    const followUpPrograms = [];

    if (finalScore >= 85) {
      recText = `1. Mempertahankan konsistensi praktik baik dan mendiseminasikannya dalam forum Komunitas Belajar (Kombel) Guru ${subject}.\n2. Mengembangkan modul ajar diferensiasi terintegrasi literasi teks multimoda.\n3. Mengikuti kegiatan open-class atau peer-coaching antarguru.`;
      followUpPrograms.push(
        {
          program: `Diseminasi Praktik Baik di Komunitas Belajar (Kombel) ${subject}`,
          target: 'Berbagi modul ajar inovatif dan teknik pemodelan kontekstual kepada rekan sejawat',
          timeframe: '1 Bulan setelah supervisi',
          pic: 'Kepala Sekolah & Guru Sasaran'
        },
        {
          program: 'Pengembangan Perangkat Pembelajaran Berdiferensiasi Lanjutan',
          target: 'Menghasilkan bahan ajar multimoda literasi/numerasi adaptif di PMM',
          timeframe: 'Semester Berjalan',
          pic: 'Guru Sasaran & Tim Kurikulum'
        }
      );
    } else {
      recText = `1. Melakukan coaching klinis bersama Kepala Sekolah / Pengawas terkait teknik memantik pertanyaan esensial.\n2. Mempelajari modul Pembelajaran Mendalam dan Asesmen Formatif pada Platform Merdeka Mengajar (PMM).\n3. Melakukan observasi kelas rekan sejawat (peer observation) untuk memperkaya variasi manajemen dinamika kelompok.`;
      followUpPrograms.push(
        {
          program: 'Coaching Klinis Teknik Bertanya Reflektif & Pembelajaran Aktif',
          target: 'Meningkatkan kemampuan guru menstimulasi pertanyaan eksploratif dan nalar kritis siswa',
          timeframe: '2 Minggu setelah observasi',
          pic: 'Kepala Sekolah / Observer'
        },
        {
          program: 'Pelatihan Mandiri PMM Topik Pembelajaran Terdiferensiasi',
          target: 'Menyelesaikan modul dan aksi nyata pemetaan kebutuhan belajar murid',
          timeframe: '1 Bulan ke depan',
          pic: 'Guru Sasaran'
        }
      );
    }

    return {
      strengthsNotes: strengthsText,
      improvementsNotes: improvementsText,
      criticalNotes: criticalText,
      recommendations: recText,
      followUpPrograms: followUpPrograms
    };
  },

  /**
   * Generate AI Recommended Answers for Step 1: Pra-Observasi
   * Grounded in teacher's Telaah RPP data (feedbackStrengths, feedbackImprovements, etc.)
   * @param {Object|null} rppData   - Telaah RPP record for the teacher
   * @param {Object}      teacherInfo - { teacherName, subject, gradeClass }
   * @param {Array}       existingQuestions - currentPraQuestions (preserves category/structure)
   */
  async generatePraObservationAnswers(rppData, teacherInfo = {}, existingQuestions = null) {
    // existingQuestions = current live questions (with correct category, question text, IDs)
    // defaultTemplate   = fallback static 11-item list
    const defaultTemplate = typeof KS_OBSERVATION_DB !== 'undefined' 
      ? KS_OBSERVATION_DB.getPraObservationTemplate() 
      : [];
    // Use existing questions if provided; otherwise fall back to defaultTemplate
    const baseQuestions = (existingQuestions && existingQuestions.length > 0)
      ? existingQuestions
      : defaultTemplate;

    const apiKey = this.getApiKey();
    if (apiKey && rppData) {
      try {
        const model = this.getModel();
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Build per-indicator score summary from telaah criteria
        let indicatorSummary = '';
        if (Array.isArray(rppData.criteria) && rppData.criteria.length > 0) {
          const byCategory = {};
          rppData.criteria.forEach(c => {
            const cat = c.category || c.categoryName || 'Elemen';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(`  • ${c.indicator || c.name || c.text || 'Indikator'}: Skor ${c.score || 0}/4`);
          });
          indicatorSummary = Object.entries(byCategory)
            .map(([cat, items]) => `${cat}:\n${items.join('\n')}`)
            .join('\n\n');
        }

        // Current question list for context — use baseQuestions (actual live questions with categories)
        const qList = baseQuestions.map((q, i) => `${i + 1}. [${q.category || q.categoryName || 'Pertanyaan'}] ${q.question || q.title || ''}`).join('\n');
        const questionCount = baseQuestions.length;
        const questionIds = baseQuestions.map(q => q.id);

        const prompt = `Anda adalah Asesor / Kepala Sekolah Ahli Pembelajaran Mendalam (Deep Learning), Literasi, dan Numerasi.

Tugas Anda adalah mensintesis data penilaian dan UMPAN BALIK PENELAAH hasil Telaah RPP guru menjadi jawaban rekomendatif otomatis untuk setiap butir pertanyaan wawancara pra-observasi coaching.

═══ DATA TELAAH RPP GURU (SUMBER UTAMA) ═══
• Nama Guru     : ${teacherInfo.teacherName || rppData.teacherName || 'Guru'}
• Mata Pelajaran: ${teacherInfo.subject || rppData.subject || '-'}
• Kelas/Level   : ${teacherInfo.gradeClass || rppData.gradeClass || '-'}
• Topik/Materi  : ${rppData.topic || '-'}
• Nilai Telaah  : ${rppData.finalScore || '-'}/100 (${rppData.predicate || '-'})
• Tanggal Telaah: ${rppData.reviewDate || '-'}

── UMPAN BALIK PENELAAH & REKOMENDASI TINDAK LANJUT ──
▸ Kelebihan Perencanaan:
${rppData.feedbackStrengths || rppData.strengths || '(Tidak tersedia)'}

▸ Aspek Perlu Perbaikan:
${rppData.feedbackImprovements || rppData.improvements || '(Tidak tersedia)'}

▸ Rekomendasi Tindak Lanjut:
${rppData.feedbackRecommendations || '(Tidak tersedia)'}

▸ Rencana Pendampingan Lanjutan:
${rppData.feedbackFollowUp || '(Tidak tersedia)'}

── SKOR PER ELEMEN / INDIKATOR ──
${indicatorSummary || '(Tidak tersedia)'}

── RINGKASAN RPP ──
${rppData.rawText ? rppData.rawText.substring(0, 600) : (rppData.telaahNotes || '(Tidak tersedia)')}

═══ DAFTAR PERTANYAAN PRA-OBSERVASI (${questionCount} BUTIR) ═══
${qList}

═══ INSTRUKSI ═══
Berdasarkan UMPAN BALIK PENELAAH (kelebihan, perbaikan, rekomendasi, tindak lanjut) dan skor per indikator telaah RPP di atas, susunlah jawaban rekomendatif yang:
1. Mengacu LANGSUNG pada umpan balik telaah — sebutkan aspek konkret yang dipuji atau perlu diperbaiki
2. Kontekstual terhadap topik, mata pelajaran, dan kelas guru
3. Memberi panduan coaching kepada Kepala Sekolah tentang apa yang perlu digali/dikonfirmasi
4. Menggunakan bahasa profesional pedagogis Indonesia yang hangat dan konstruktif
5. Setiap jawaban 2-4 kalimat, padat dan bermakna

Format respon HARUS JSON murni tanpa markdown wrapper:
{
  "answers": [
${questionIds.map(id => `    {"id": ${typeof id === 'string' ? `"${id}"` : id}, "aiAnswer": "..."}`).join(',\n')}
  ],
  "conclusion": "Kesimpulan dan rekomendasi pra-observasi berdasarkan telaah RPP guru..."
}`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
          })
        });

        if (res.ok) {
          const resJson = await res.json();
          const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            if (Array.isArray(parsed.answers)) {
              // Merge aiAnswer into baseQuestions (preserves category, question text, IDs)
              return {
                questions: baseQuestions.map(q => {
                  // Match strictly by q.id (e.g. "PEM201" or numeric id) or sequential array position
                  const match = parsed.answers.find(a => String(a.id).trim().toLowerCase() === String(q.id).trim().toLowerCase())
                    || parsed.answers[baseQuestions.indexOf(q)];
                  const aiAns = (match && match.aiAnswer && match.aiAnswer.trim()) 
                    ? match.aiAnswer.trim() 
                    : this.generateContextualPraAnswer(q, rppData, teacherInfo);
                  return {
                    ...q,
                    aiAnswer: aiAns
                  };
                }),
                conclusion: parsed.conclusion || '',
                source: 'gemini'
              };
            }
          }
        }
      } catch (err) {
        console.warn('Pra-observation Gemini generation failed, using pedagogical heuristic:', err);
      }
    }

    // Heuristic Contextual Generator — uses telaah feedback and question context dynamically
    const subject = teacherInfo.subject || rppData?.subject || 'Mata Pelajaran';
    const topic = (rppData?.topic && rppData.topic.trim()) || (teacherInfo.subject ? `Materi ${teacherInfo.subject}` : (rppData?.subject ? `Materi ${rppData.subject}` : 'Perencanaan Pembelajaran'));
    const teacherName = teacherInfo.teacherName || rppData?.teacherName || 'Guru';
    const strengths = rppData?.feedbackStrengths || rppData?.strengths || '';
    const improvements = rppData?.feedbackImprovements || rppData?.improvements || '';
    const telaahScore = rppData?.finalScore ? `${rppData.finalScore}/100 (${rppData.predicate || '-'})` : null;

    // Generate distinct, contextual answers matching each specific question and category
    const questions = baseQuestions.map(q => ({
      ...q,
      aiAnswer: this.generateContextualPraAnswer(q, rppData, teacherInfo) || q.aiAnswer || ''
    }));

    const telaahRef = telaahScore ? ` Telaah RPP guru mendapat nilai ${telaahScore}.${strengths ? ' Kelebihan: ' + strengths.substring(0, 100) + '.' : ''}${improvements ? ' Perlu ditingkatkan: ' + improvements.substring(0, 100) + '.' : ''}` : '';
    const conclusion = `Berdasarkan telaah perangkat ajar dan dialog pra-observasi bersama Ibu/Bapak ${teacherName}, perencanaan pembelajaran untuk mata pelajaran ${subject} pada topik ${topic} telah tersusun secara sistematis dan selaras dengan prinsip Pembelajaran Mendalam (Deep Learning).${telaahRef} Guru siap diobservasi dengan fokus pengamatan pada diferensiasi pendampingan kelompok serta efektivitas pertanyaan pemantik pemahaman kontekstual.`;

    return {
      questions,
      conclusion,
      source: 'heuristic'
    };
  },

  /**
   * Generates a context-aware pedagogical recommendation answer for an individual pra-observation question
   * Tailored to the teacher's Telaah RPP data, the specific element/category, and question focus
   */
  generateContextualPraAnswer(q, rppData = {}, teacherInfo = {}) {
    const teacherName = teacherInfo.teacherName || rppData?.teacherName || 'Guru';
    const subject = teacherInfo.subject || rppData?.subject || 'Mata Pelajaran';
    const topic = (rppData?.topic && rppData.topic.trim()) || (teacherInfo.subject ? `Materi ${teacherInfo.subject}` : (rppData?.subject ? `Materi ${rppData.subject}` : 'Perencanaan Pembelajaran'));
    const gradeClass = teacherInfo.gradeClass || rppData?.gradeClass || 'Kelas';
    const strengths = rppData?.feedbackStrengths || rppData?.strengths || '';
    const improvements = rppData?.feedbackImprovements || rppData?.improvements || '';
    const recommendations = rppData?.feedbackRecommendations || '';
    const followUp = rppData?.feedbackFollowUp || '';
    const telaahScore = rppData?.finalScore ? `${rppData.finalScore}/100 (${rppData.predicate || '-'})` : '';

    const qid = String(q.id || '').toUpperCase().trim();
    const focus = String(q.focus || '').toLowerCase();
    const text = String((q.question || q.title || '') + ' ' + (q.focus || '')).toLowerCase();
    const cat = String(q.category || q.categoryName || '').toLowerCase();
    const catId = String(q.categoryId || '').toUpperCase();

    // ─────────────────────────────────────────────────────────────
    // 1. ELEMEN DASAR (ELE)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'ELE201' || focus.includes('pembuka wawancara') || (text.includes('salam') && text.includes('suasana'))) {
      return `Membuka percakapan coaching dengan hangat dan apresiatif: "Selamat pagi/siang Ibu/Bapak ${teacherName}, bagaimana kabar dan kesiapan mengajar hari ini?" Saya telah menelaah RPP/Modul Ajar Anda untuk topik ${topic} (${subject})${telaahScore ? ` dan memberikan nilai ${telaahScore}` : ''} — mari kita bahas bersama persiapannya.`;
    }

    if (qid === 'ELE202' || (text.includes('tujuan pembelajaran') && text.includes('materi apa')) || focus.includes('identifikasi materi')) {
      const strSnippet = strengths ? ` Catatan telaah RPP: ${strengths.substring(0, 110)}` : '';
      return `Materi yang disajikan adalah ${topic} pada mata pelajaran ${subject} (${gradeClass}). Berdasarkan telaah modul ajar, tujuan pembelajaran diarahkan agar murid memahami konsep esensial secara bermakna dan mampu menerapkannya dalam konteks nyata.${strSnippet}`;
    }

    if (qid === 'ELE203' || (text.includes('pendekatan') && text.includes('model pembelajaran') && !text.includes('alasan'))) {
      return `Menggunakan Pendekatan Saintifik berbasis Pembelajaran Mendalam (Deep Learning) dengan Model Problem Based Learning (PBL) atau Inkuiri/Discovery, agar pembelajaran berpusat pada murid dan mendorong eksplorasi aktif terkait topik ${topic}.`;
    }

    if (qid === 'ELE204' || focus.includes('alur dan tahapan') || (text.includes('tahapan pembelajaran') && text.includes('sajikan'))) {
      return `Tahapan pembelajaran tersusun dalam 3 fase terpadu: 1) Pendahuluan (10-15'): Salam pembuka, apersepsi kontekstual, pertanyaan pemantik. 2) Inti (50-60'): Eksplorasi konsep ${topic}, kerja kelompok kolaboratif, pengolahan LKPD dan presentasi hasil. 3) Penutup (10-15'): Refleksi terbimbing, penguatan konsep, dan tindak lanjut.`;
    }

    if (qid === 'ELE205' || focus.includes('kelengkapan modul') || text.includes('persiapan tertulis')) {
      return `Perangkat tertulis yang telah disiapkan mencakup: Modul Ajar/RPP lengkap yang selaras dengan Capaian Pembelajaran, Lembar Kerja Peserta Didik (LKPD) kontekstual, instrumen asesmen formatif (keterampilan & sikap), serta lembar refleksi murid.`;
    }

    if (qid === 'ELE206' || focus.includes('catatan khusus fokus') || text.includes('perhatian khusus')) {
      const recPart = recommendations ? ` Rekomendasi penelaah RPP: ${recommendations.substring(0, 100)}.` : '';
      const impPart = improvements ? ` Catatan perbaikan: ${improvements.substring(0, 90)}.` : '';
      return `Perhatian khusus difokuskan pada manajemen waktu saat kerja kelompok, pemberian bimbingan terarah (scaffolding) bagi kelompok murid yang membutuhkan pendampingan, serta memastikan partisipasi aktif seluruh peserta didik.${recPart}${impPart}`;
    }

    if (qid === 'ELE207' || (focus.includes('kesiapan media') || (text.includes('alat dan bahan') && text.includes('sumber belajar')) && catId !== 'ENG')) {
      return `Menyiapkan LKPD terstruktur kontekstual, media visual/digital interaktif, bahan tayang presentasi, dan set alat peraga/stimulus konkret untuk materi ${topic} agar seluruh modalitas dan gaya belajar murid terfasilitasi secara optimal.`;
    }

    if (qid === 'ELE208' || focus.includes('target ketercapaian') || text.includes('kompetensi apa yang bisa dimiliki')) {
      return `Murid diharapkan menguasai kompetensi pemahaman konseptual dan aplikatif materi ${topic}, memiliki nalar kritis dalam menganalisis data, berkolaborasi dengan gotong royong dalam tim, serta mampu mengomunikasikan gagasannya secara mandiri dan percaya diri.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PEMBELAJARAN MENDALAM (PEM)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'PEM201' || focus.includes('justifikasi pedagogis') || (text.includes('alasan') && text.includes('model pembelajaran'))) {
      return `Model pembelajaran berbasis masalah/inkuiri pada materi ${topic} ini dipilih agar murid tidak sekadar menghafal rumus atau teori, melainkan mengalami proses penyelidikan langsung, berpikir kritis tingkat tinggi, berkolaborasi memecahkan masalah nyata, serta mengonstruksi pemahaman mandiri sesuai prinsip Pembelajaran Mendalam (Deep Learning).`;
    }

    if (qid === 'PEM202' || focus.includes('miskonsepsi') || (text.includes('materi apa yang dianggap sulit') || (text.includes('sulit') && text.includes('materi')))) {
      const impPart = improvements ? ` Catatan telaah RPP: ${improvements.substring(0, 100)}.` : '';
      return `Bagian yang diprediksi menantang bagi murid adalah analisis konsep abstrak dan penarikan simpulan logis dari data konkret pada materi ${topic}, di mana murid masih dalam tahap pembiasaan menarasikan temuan data menjadi kesimpulan ilmiah.${impPart}`;
    }

    if (qid === 'PEM203' || focus.includes('diagnostik awal') || text.includes('sumber kesulitan') || (text.includes('dugaan') && text.includes('kesulitan'))) {
      return `Dugaan sumber kesulitan murid: Kosakata teknis/literasi sains yang masih berkembang dan pembiasaan membaca data grafik/tabel yang belum merata antarmurid, sehingga guru menyiapkan scaffolding berupa panduan bertahap pada LKPD.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. DIFERENSIASI (DIF)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'DIF201' || focus.includes('pemetaan kebutuhan') || text.includes('memetakan kebutuhan')) {
      return `Pemetaan dilakukan melalui asesmen diagnostik non-kognitif awal semester dan kuis diagnostik kognitif singkat terkait kesiapan materi ${topic}, untuk mengelompokkan murid berdasarkan tingkat kesiapan belajar (perlu bimbingan, cukup, dan mahir).`;
    }

    if (qid === 'DIF202' || focus.includes('strategi diferensiasi') || text.includes('bentuk diferensiasi')) {
      const impPart = improvements ? ` Catatan telaah RPP: ${improvements.substring(0, 100)}.` : '';
      return `Menerapkan diferensiasi proses dan konten: menyediakan sumber bacaan dan media bertingkat (teks sederhana hingga studi kasus kontekstual) serta pembagian kelompok fleksibel dengan intensitas pendampingan guru yang disesuaikan.${impPart}`;
    }

    if (qid === 'DIF203' || (catId === 'DIF' && (focus.includes('keberagaman') || text.includes('scaffolding') || text.includes('bantuan lebih')))) {
      return `Bagi murid yang memerlukan bantuan lebih, disediakan LKPD dengan petunjuk langkah berurutan (guided steps) dan pendampingan tutor sebaya; sedangkan bagi murid mahir diberikan penugasan pengayaan berbasis studi kasus nyata yang menantang nalar kritis.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 4. KOMPETENSI SOSIAL EMOSIONAL (KOM)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'KOM201' || focus.includes('target kse') || text.includes('kse apa saja') || (text.includes('sosial emosional') && text.includes('tumbuhkan'))) {
      return `KSE utama yang ditumbuhkan adalah Kesadaran Diri (mengenali kesiapan dan fokus belajar), Keterampilan Berelasi (kolaborasi saling menghargai saat kerja kelompok), serta Pengambilan Keputusan Bertanggung Jawab saat menyusun simpulan materi ${topic}.`;
    }

    if (qid === 'KOM202' || focus.includes('teknik kse') || text.includes('teknik stop') || text.includes('pengelolaan emosi') || text.includes('check-in emosi')) {
      return `Menerapkan teknik check-in emosi atau latihan pernapasan berkesadaran (teknik STOP) di awal pembelajaran untuk memusatkan konsentrasi murid, serta memperkuat kesepakatan kelas yang mengutamakan sikap saling menghargai dan empati.`;
    }

    if (qid === 'KOM203' || (catId === 'KOM' && (focus.includes('dinamika interaksi') || (text.includes('kegiatan kelompok') && (text.includes('empati') || text.includes('relasi')))))) {
      return `Membentuk kelompok heterogen dengan pembagian peran kerja yang terdefinisi jelas (koordinator, pencatat data, presenter, pengatur waktu) dan menyisipkan rubrik refleksi antarteman agar murid melatih empati dan komunikasi yang konstruktif.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 5. ENGLISH AND GLOBAL FRAMEWORK (ENG)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'ENG201' || focus.includes('penyampaian bahasa inggris') || text.includes('medium of instruction') || text.includes('academic vocabulary')) {
      return `Menggunakan instruksi bilingual pada istilah-istilah kunci materi ${topic}, memperkenalkan kartu glosarium kosa kata akademik bahasa Inggris (academic vocabulary), serta membimbing pelafalan dan penggunaannya dalam konteks kalimat ilmiah.`;
    }

    if (qid === 'ENG202' || focus.includes('sumber belajar internasional') || text.includes('cambridge') || text.includes('ib') || text.includes('kurikulum internasional')) {
      return `Mengintegrasikan sumber belajar berstandar internasional (seperti diagram dan teks sains otentik) yang diselaraskan dengan Capaian Pembelajaran nasional, guna memperluas literasi global dan wawasan kontekstual peserta didik.`;
    }

    if (qid === 'ENG203' || (catId === 'ENG' && (focus.includes('dukungan bahasa') || text.includes('language scaffolding') || text.includes('berbahasa inggris')))) {
      return `Menyediakan petunjuk visual (visual cues), padanan kata dwibahasa, serta memberikan waktu berpikir dan berdiskusi konsep dalam bahasa Indonesia sebelum peserta didik mempresentasikan istilah intinya dalam bahasa Inggris.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 6. MANAJEMEN KELAS & DISIPLIN POSITIF (MAN)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'MAN201' || focus.includes('keyakinan kelas') || text.includes('kesepakatan atau keyakinan')) {
      return `Mengingatkan keyakinan kelas yang telah disepakati bersama (seperti: aktif menyimak saat rekan berbicara, menjaga kebersihan ruang kerja, dan berkolaborasi secara adil) serta memantaunya melalui apresiasi verbal sepanjang pembelajaran.`;
    }

    if (qid === 'MAN202' || focus.includes('respon perilaku') || (text.includes('disiplin positif') && text.includes('perilaku')) || text.includes('non-punitif')) {
      return `Menerapkan pendekatan disiplin positif non-punitif (restitusi): mengajak murid berdialog secara personal tanpa mempermalukan di depan kelas, menanyakan kendala yang dirasakan, dan membimbing murid mengembalikan fokus belajarnya ke aktivitas kelas.`;
    }

    if (qid === 'MAN203' || focus.includes('lingkungan aman') || text.includes('ruang aman') || (text.includes('student-centered') && text.includes('aman'))) {
      return `Menciptakan iklim kelas yang aman secara psikologis di mana setiap murid merasa nyaman berpendapat tanpa takut salah, memberikan apresiasi pada proses berpikir murid, dan memfasilitasi partisipasi yang setara dalam setiap kelompok.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 7. STEM (STE)
    // ─────────────────────────────────────────────────────────────
    if (qid === 'STE201' || focus.includes('integrasi antardisiplin stem') || text.includes('sains, teknologi, rekayasa')) {
      return `Mengintegrasikan pemahaman konsep Sains pada topik ${topic} dengan pengukuran data matematis serta proses rekayasa sederhana (Engineering Design Process) untuk merumuskan solusi atas permasalahan nyata di lingkungan sekitar.`;
    }

    if (qid === 'STE202' || focus.includes('desain rekayasa') || text.includes('engineering challenge') || text.includes('tantangan rekayasa')) {
      return `Memberikan tantangan proyek nyata (Engineering Challenge) terkait topik ${topic}, di mana murid merancang ide/alat sederhana, menguji kinerjanya, mencatat data hasil uji, dan menyempurnakan solusinya secara kolaboratif.`;
    }

    // ─────────────────────────────────────────────────────────────
    // 8. LITERASI & NUMERASI (LIT)
    // ─────────────────────────────────────────────────────────────
    if (catId === 'LIT' || cat.includes('literasi') || focus.includes('litnum')) {
      return `Mengintegrasikan stimulus teks artikel ilmiah/multimoda dan aktivitas interpretasi data numerik (grafik/tabel) terkait materi ${topic}, melatih murid bernalar kritis mengubah data angka menjadi argumentasi solutif yang terpercaya.`;
    }

    // ─────────────────────────────────────────────────────────────
    // LEGACY NUMERIC IDs FALLBACK (1 .. 11)
    // ─────────────────────────────────────────────────────────────
    if (qid === '1') {
      return `Membuka percakapan coaching dengan hangat dan apresiatif: "Selamat pagi/siang Ibu/Bapak ${teacherName}, bagaimana kabar dan kesiapan mengajar hari ini?"${telaahScore ? ` Saya telah menelaah RPP Anda dan memberikan nilai ${telaahScore} — mari kita bahas bersama.` : ''}`;
    }
    if (qid === '2') {
      return `Fokus pada pencapaian tujuan pembelajaran topik ${topic}, mendorong murid memahami esensi materi melalui aktivitas langsung dan menghubungkannya dengan fenomena nyata.${strengths ? ` Kelebihan telaah: ${strengths.substring(0, 110)}` : ''}`;
    }
    if (qid === '3') {
      return `Pendekatan Saintifik berbasis Pembelajaran Mendalam (Deep Learning) berorientasi Meaningful Learning dengan Model Pembelajaran Berbasis Masalah (Problem Based Learning) atau Penyelidikan/Eksperimen (Inquiry/Discovery).`;
    }
    if (qid === '4') {
      return `Model ini dipilih agar murid tidak sekadar menghafal rumus atau teori, melainkan aktif berkolaborasi, meneliti, berpikir kritis, serta mengonstruksi pemahaman mandiri sesuai prinsip Pembelajaran Mendalam.`;
    }
    if (qid === '5') {
      return `Menyiapkan Lembar Kerja Peserta Didik (LKPD) kontekstual berjenjang, modul referensi teks multimoda, media visual/alat peraga, serta rubrik observasi proses agar murid terfasilitasi sesuai gaya dan kesiapan belajarnya.`;
    }
    if (qid === '6') {
      return `1) Pendahuluan (10-15'): Mengondisikan fisik-psikis murid, apersepsi kontekstual, pertanyaan pemantik esensial. 2) Inti (50-60'): Eksplorasi konsep, kerja kelompok kolaboratif, pengolahan data & presentasi hasil. 3) Penutup (10-15'): Refleksi terbimbing, penguatan konsep, dan tindak lanjut.`;
    }
    if (qid === '7') {
      return `Modul Ajar / RPP lengkap yang telah diselaraskan dengan Capaian Pembelajaran, LKPD aktivitas kolaboratif, instrumen asesmen formatif (keterampilan dan sikap), serta lembar jurnal refleksi murid.`;
    }
    if (qid === '8') {
      return `Bagian analisis konsep abstrak dan penarikan simpulan matematis/logis pada topik ${topic}, karena murid kerap mengalami hambatan saat menghubungkan data konkret dengan formulasi konsep ilmiah.${improvements ? ` Catatan telaah: ${improvements.substring(0, 100)}` : ''}`;
    }
    if (qid === '9') {
      return `Dugaan sumber kesulitan: Kosakata teknis/literasi murid yang masih berkembang serta pembiasaan menganalisis data grafik/tabel yang belum merata antarmurid.`;
    }
    if (qid === '10') {
      return `Murid mampu menguasai kompetensi dasar topik ${topic}, terbiasa bernalar kritis dalam menyelesaikan masalah nyata, mandiri, serta mampu berkolaborasi aktif dengan rekan sejawat.`;
    }
    if (qid === '11') {
      return `Manajemen alokasi waktu saat kerja kelompok, pemberian scaffolding (bimbingan terarah) bagi kelompok murid yang tertinggal, serta memastikan seluruh murid aktif berpartisipasi.${recommendations ? ` Rekomendasi: ${recommendations.substring(0, 100)}` : ''}${followUp ? ` Tindak lanjut: ${followUp.substring(0, 80)}` : ''}`;
    }

    // ─────────────────────────────────────────────────────────────
    // GENERAL CONTEXTUAL FALLBACK
    // ─────────────────────────────────────────────────────────────
    const focusLabel = q.focus ? `fokus pengamatan pada ${q.focus}` : `aspek ${q.question || q.title || 'pembelajaran'}`;
    return `Menyiapkan strategi pembelajaran berpusat pada murid untuk topik ${topic} (${subject}) dengan ${focusLabel}, pendampingan terarah, pemanfaatan instrumen kontekstual, dan penguatan keterlibatan aktif seluruh peserta didik.${improvements ? ` Catatan telaah: ${improvements.substring(0, 90)}.` : ''}`;
  },

  /**
   * Synthesize Pra-Observation Conclusion combining AI recommendations and Headmaster's notes
   */
  synthesizePraConclusion(praQuestions, teacherName = 'Guru') {
    const filledNotes = (praQuestions || []).filter(q => q.notes && q.notes.trim() !== '');
    if (filledNotes.length === 0) {
      return `Berdasarkan hasil wawancara pra-observasi, kesiapan Ibu/Bapak ${teacherName} dinilai sangat baik. Rencana pelaksanaan pembelajaran telah selaras dengan capaian kompetensi dan strategi diferensiasi kelas.`;
    }

    const keyPoints = filledNotes.map(q => {
      const qText = (q.question || q.title || '').trim() || `Pertanyaan ${q.id}`;
      return `Pertanyaan "${qText}": "${q.notes.trim()}"`;
    }).join('; ');

    return `Berdasarkan wawancara pra-observasi bersama Ibu/Bapak ${teacherName}, disimpulkan bahwa guru memiliki kesiapan yang matang. Poin-poin penting hasil kesepakatan coaching mencakup: ${keyPoints}. Observasi kelas difokuskan pada penguatan aspek interaksi aktif murid dan efektivitas alur pembelajaran.`;
  },

  /**
   * Generate AI Recommended Answers for Step 3: Pasca-Observasi (10 Questions)
   * Grounded in Telaah RPP + Pra-Observasi Answers + Core Observation (14 Criteria Scores)
   */
  /**
   * Generate AI Recommended Answers for Step 3: Pasca-Observasi (Dynamic Indicators or Standard Questions)
   * Grounded in full synthesis of Telaah RPP + Pra-Observasi (Q&A + Notes) + Observasi Inti (Scores, Strengths, Improvements)
   */
  async generatePascaObservationAnswers(rppData, praObsData, coreObsData, teacherInfo = {}, existingQuestions = null) {
    const defaultTemplate = typeof KS_OBSERVATION_DB !== 'undefined' 
      ? KS_OBSERVATION_DB.getPascaObservationTemplate() 
      : [];

    const baseQuestions = (Array.isArray(existingQuestions) && existingQuestions.length > 0)
      ? existingQuestions
      : defaultTemplate;

    const apiKey = this.getApiKey();
    const finalScore = coreObsData?.finalScore ?? 85;
    const predicate = coreObsData?.predicate || 'Baik';
    const totalScore = coreObsData?.totalScore || 0;
    const maxScore = coreObsData?.maxScore || (coreObsData?.criteria ? coreObsData.criteria.length * 4 : 56);
    const teacherName = teacherInfo.teacherName || coreObsData?.teacherName || rppData?.teacherName || 'Guru';
    const subject = teacherInfo.subject || coreObsData?.subject || rppData?.subject || 'Mata Pelajaran';
    const gradeClass = teacherInfo.gradeClass || coreObsData?.gradeClass || rppData?.gradeClass || 'Kelas';
    const topic = teacherInfo.topic || rppData?.topic || 'Pembelajaran';

    // 1. Ekstrak data RPP
    const rppScore = rppData?.finalScore ? `${rppData.finalScore}/100 (${rppData.predicate || 'Baik'})` : 'Belum dinilai';
    const rppStrengths = rppData?.feedbackStrengths || rppData?.strengthsNotes || rppData?.strengths || '';
    const rppImprovements = rppData?.feedbackImprovements || rppData?.improvementsNotes || rppData?.improvements || '';
    const rppRecommendations = rppData?.feedbackRecommendations || rppData?.recommendations || '';
    const rppFollowUp = rppData?.feedbackFollowUp || '';

    // 2. Ekstrak data Pra-Observasi
    const praConclusion = praObsData?.conclusion || '';
    const praNotesList = (praObsData?.questions || []).filter(q => q.notes && q.notes.trim()).map(q => {
      const qText = q.question || q.title || `Poin ${q.id}`;
      return `  - [${q.id}] ${qText}: Catatan KS "${q.notes.trim()}"`;
    }).join('\n');

    // 3. Ekstrak data Observasi Inti
    const strengthsNotes = coreObsData?.strengthsNotes || '';
    const improvementsNotes = coreObsData?.improvementsNotes || '';
    const criticalNotes = coreObsData?.criticalNotes || '';

    // Analisis kekuatan dan kelemahan indikator observasi inti
    let coreIndicatorsSummary = '';
    if (Array.isArray(coreObsData?.criteria) && coreObsData.criteria.length > 0) {
      const highScored = coreObsData.criteria.filter(c => Number(c.score) >= 3);
      const lowScored = coreObsData.criteria.filter(c => Number(c.score) > 0 && Number(c.score) < 3);

      const highList = highScored.map(c => `  • [${c.id}] ${c.title || c.indicator || c.name} (Skor ${c.score}/4)${c.comment ? ` - Bukti: ${c.comment}` : ''}`).slice(0, 8);
      const lowList = lowScored.map(c => `  • [${c.id}] ${c.title || c.indicator || c.name} (Skor ${c.score}/4)${c.comment ? ` - Catatan: ${c.comment}` : ''}`).slice(0, 8);

      coreIndicatorsSummary = `▸ Aspek Pembelajaran Bernilai Tinggi (Skor 3-4):\n${highList.length ? highList.join('\n') : '  (Semua indikator merata)'}\n\n▸ Aspek Pembelajaran Perlu Peningkatan (Skor 1-2):\n${lowList.length ? lowList.join('\n') : '  (Tidak ada indikator bernilai rendah/kurang)'}`;
    }

    if (apiKey) {
      try {
        const model = this.getModel();
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const qList = baseQuestions.map((q, i) => `${i + 1}. [ID: ${q.id}] [Kategori: ${q.category || q.categoryName || 'Refleksi'}] ${q.question || q.title || ''}`).join('\n');

        const prompt = `Anda adalah Asesor Kepala Sekolah Ahli Supervisi Klinis, Coaching Akademik, dan Pembelajaran Mendalam (Deep Learning).

Tugas Anda:
Mensintesiskan rangkaian bukti penilaian supervisi 3 langkah milik guru terpilih (Telaah RPP + Wawancara Pra-Observasi + Observasi Kelas Inti) menjadi DRAF JAWABAN REKOMENDASI AI untuk setiap butir pertanyaan wawancara pasca-observasi (coaching), serta kesan umum dan kesimpulan tindak lanjut menyeluruh.

═══ DATA PROFIL & KONTEKS PEMBELAJARAN ═══
• Nama Guru      : ${teacherName}
• Mata Pelajaran : ${subject}
• Kelas / Rombel : ${gradeClass}
• Topik / Materi : ${topic}

═══ TAHAP 1: TELAAH PERENCANAAN (RPP / MODUL AJAR) ═══
• Nilai Telaah RPP     : ${rppScore}
• Kelebihan RPP        : ${rppStrengths || 'Rancangan modul ajar runtut dan kontekstual'}
• Perbaikan RPP        : ${rppImprovements || 'Penajaman diferensiasi dan asesmen formatif'}
• Rekomendasi RPP      : ${rppRecommendations || 'Laksanakan di kelas sesuai skenario bertahap'}
• Tindak Lanjut RPP    : ${rppFollowUp || 'Pendampingan implementasi asesmen otentik'}

═══ TAHAP 2: WAWANCARA PRA-OBSERVASI (KESEPAKATAN AWAL) ═══
• Kesimpulan Pra-Observasi : ${praConclusion || 'Guru telah siap melaksanakan pembelajaran dengan fokus keaktifan dan diferensiasi murid.'}
• Catatan Kesepakatan Pra :
${praNotesList || '  (Percakapan pra-observasi menyepakati observasi iklim kelas dan interaksi murid)'}

═══ TAHAP 3: OBSERVASI KELAS INTI (PELAKSANAAN NYATA) ═══
• Skor Observasi Kelas : ${totalScore}/${maxScore} (Nilai Akhir: ${finalScore} - Predikat: ${predicate})
• Hal Positif / Kelebihan: ${strengthsNotes || 'Suasana kelas kondusif, interaksi dialogis terbangun aktif, dan penguasaan materi baik.'}
• Hal Perlu Ditingkatkan : ${improvementsNotes || 'Pengelolaan alokasi waktu dan pemberian ruang refleksi mandiri murid di penutup.'}
• Catatan Pengawas       : ${criticalNotes || 'Pembelajaran telah mencerminkan proses pembelajaran bermakna.'}
${coreIndicatorsSummary}

═══ DAFTAR PERTANYAAN WAWANCARA PASCA-OBSERVASI (${baseQuestions.length} BUTIR) ═══
${qList}

═══ INSTRUKSI ANALISIS & SINTESIS ═══
1. Untuk SETIAP butir pertanyaan di atas, rumuskan "aiAnswer" yang merupakan sintesis logis:
   - Bagaimana apa yang dirancang di RPP & disepakati di Pra-observasi terbukti nyata dalam Observasi Inti.
   - Bersikap empatik, konstruktif, dan berbasis data/fakta nyata di kelas (sebutkan mata pelajaran, topik materi, skor ${finalScore}, kelebihan, atau tantangannya).
   - Kalimat draf jawaban ditulis dari sudut pandang reflektif guru saat diajak berdialog coaching oleh Kepala Sekolah (2-3 kalimat padat, lugas, bernada reflektif profesional).
2. Susun "generalImpression" (kesan umum dan apresiasi Kepala Sekolah).
3. Susun "conclusion" (kesimpulan supervisi menyeluruh dan aksi tindak lanjut konkret).

Format respon HARUS JSON murni tanpa markdown wrapper:
{
  "answers": [
${baseQuestions.map(q => `    {"id": ${typeof q.id === 'string' ? `"${q.id}"` : q.id}, "aiAnswer": "..."}`).join(',\n')}
  ],
  "generalImpression": "Kesan umum dan saran...",
  "conclusion": "Kesimpulan komprehensif, rekomendasi, dan rencana tindak lanjut supervisi..."
}`;

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
          })
        });

        if (res.ok) {
          const resJson = await res.json();
          const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            if (Array.isArray(parsed.answers)) {
              return {
                questions: baseQuestions.map(q => {
                  const match = parsed.answers.find(a => String(a.id).trim().toLowerCase() === String(q.id).trim().toLowerCase());
                  return {
                    ...q,
                    aiAnswer: match ? match.aiAnswer : (q.aiAnswer || '')
                  };
                }),
                generalImpression: parsed.generalImpression || '',
                conclusion: parsed.conclusion || '',
                source: 'gemini'
              };
            }
          }
        }
      } catch (err) {
        console.warn('Pasca-observation Gemini generation failed, using pedagogical heuristic:', err);
      }
    }

    // ═══ FALLBACK HEURISTIK PEDAGOGIS CERDAS (SMART HEURISTIC) ═══
    // Mensintesiskan RPP + Pra + Observasi Inti untuk semua ID pertanyaan (baik numeric 1-10 maupun ID string ELE401, PEM401, DIF401, dll)
    const topicText = topic && topic !== 'Pembelajaran' ? `pada topik ${topic}` : '';
    const strengthsDesc = strengthsNotes || rppStrengths || 'antusiasme murid dan penguasaan materi yang baik';
    const improveDesc = improvementsNotes || rppImprovements || 'efisiensi alokasi waktu dan penguatan refleksi mandiri';

    function generateHeuristicAnswer(q) {
      const qId = String(q.id).toUpperCase();
      const cat = (q.category || q.categoryName || '').toLowerCase();
      const focus = (q.focus || '').toLowerCase();
      const text = (q.question || q.title || '').toLowerCase();

      // Elemen Dasar / Pertanyaan 1 - 10
      if (qId === '1' || qId === 'ELE401' || text.includes('salam') || text.includes('pembuka')) {
        return `Menyampaikan apresiasi tulus kepada Ibu/Bapak ${teacherName} atas keterbukaan, persiapan matang, dan dedikasi tinggi dalam melaksanakan pembelajaran ${subject} ${topicText} dengan perolehan nilai observasi ${finalScore}/100 (${predicate}).`;
      }
      if (qId === '2' || qId === 'ELE402' || text.includes('kesan') || text.includes('perasaan')) {
        return `Guru merasa lega, bersyukur, dan bangga menyaksikan murid aktif terlibat dalam pembelajaran ${subject}. Meskipun terdapat sedikit tantangan dalam ${improveDesc}, dinamika kelas tetap berjalan positif sesuai rencana.`;
      }
      if (qId === '3' || qId === 'ELE403' || text.includes('sesuai') || text.includes('direncanakan')) {
        return `Secara umum tahapan pembelajaran telah selaras dengan perencanaan Modul Ajar/RPP yang ditelaah (Nilai Telaah RPP: ${rppScore}). Penyesuaian tempo dilakukan secara wajar di kelas untuk merespons kebutuhan belajar murid secara langsung.`;
      }
      if (qId === '4' || qId === 'ELE405' || text.includes('memuaskan') || text.includes('kurang memuaskan')) {
        return `Hal memuaskan: ${strengthsDesc}. Hal yang masih perlu disempurnakan: ${improveDesc}, khususnya memberi kesempatan lebih luas bagi murid untuk mengutarakan simpulan belajar mereka.`;
      }
      if (qId === '5' || qId === 'PEM401' || text.includes('ketercapaian kompetensi')) {
        return `Diperkirakan sekitar 85% - 90% murid telah tuntas mencapai indikator pemahaman ${topicText}. Bagi murid yang masih memerlukan pendampingan, guru akan memberikan penguatan bertahap melalui latihan terarah.`;
      }
      if (qId === '6' || qId === 'PEM402' || text.includes('kesulitan siswa')) {
        return `Kesulitan siswa terutama pada saat mengabstraksikan konsep materi dan menuangkannya ke dalam pemecahan masalah mandiri, serta menyampaikan argumen runtut saat kegiatan penutup.`;
      }
      if (qId === '7' || qId === 'ELE404' || text.includes('kesulitan saudara')) {
        return `Kesulitan yang dirasakan guru adalah ${improveDesc}, serta membagi perhatian bimbingan secara berimbang antara murid yang cepat tanggap dan murid yang memerlukan scaffolding lebih intensif.`;
      }
      if (qId === '8' || qId === 'PEM403' || text.includes('alternatif') || text.includes('mengatasi kesulitan')) {
        return `Mengoptimalkan strategi tutor sebaya dalam kelompok belajar, menyediakan panduan lembar kerja berjenjang (scaffolding visual), dan memberikan stimulus pertanyaan pemantik berjenjang pada pertemuan berikutnya.`;
      }
      if (qId === '9' || qId === 'PEM404' || text.includes('mantap') || text.includes('peningkatan')) {
        return `Hal mantap teridentifikasi: ${strengthsDesc}. Hal yang disepakati untuk ditingkatkan: ${improveDesc}, didukung penguatan asesmen formatif berkelanjutan saat proses pembelajaran berlangsung.`;
      }
      if (qId === '10' || qId === 'ELE406' || text.includes('pertemuan berikutnya') || text.includes('saran')) {
        return `Kesan Umum: Pembelajaran berlangsung kondusif dan mencerminkan pembelajaran bermakna (Deep Learning).\nSaran: Pada pertemuan berikutnya, terapkan metode galeri karya (gallery walk) untuk saling memberi umpan balik antar-murid dan alokasikan waktu refleksi mandiri minimal 10 menit di akhir sesi.`;
      }

      // Kategori Diferensiasi (DIF)
      if (qId.startsWith('DIF') || cat.includes('diferensiasi')) {
        if (text.includes('strategi') || text.includes('efektif')) {
          return `Penerapan diferensiasi proses melalui variasi pendampingan kelompok telah membantu menjembatani keragaman kesiapan belajar murid, didukung bahan ajar kontekstual yang dirancang dalam RPP.`;
        }
        if (text.includes('respon') || text.includes('pemahaman')) {
          return `Murid dengan kesiapan belajar lebih tinggi tampak antusias membantu rekannya, sementara kelompok murid yang membutuhkan bimbingan menunjukkan peningkatan keaktifan saat diberikan pendampingan terarah.`;
        }
        return `Rencana tindak lanjut: Menyiapkan lembar tugas berjenjang (tiering tasks) untuk program remedial terfokus serta materi pengayaan berbasis pemecahan masalah bagi murid yang telah melampaui target.`;
      }

      // Kategori Manajemen Kelas & Disiplin Positif (MAN)
      if (qId.startsWith('MAN') || cat.includes('manajemen') || cat.includes('disiplin')) {
        if (text.includes('disiplin positif') || text.includes('suasana')) {
          return `Penerapan kesepakatan kelas di awal kegiatan terbukti efektif menjaga iklim belajar yang tertib, saling menghargai, dan kondusif tanpa pendekatan punitif.`;
        }
        if (text.includes('percaya diri') || text.includes('psikologis')) {
          return `Lingkungan belajar yang aman secara psikologis mendorong murid berani mengemukakan pendapat dan mengajukan pertanyaan tanpa rasa cemas atau takut salah.`;
        }
        return `Konsisten menerapkan apresiasi berbasis proses (growth mindset feedback) dan mengingatkan keyakinan kelas secara berkala untuk memperkuat budaya positif sekolah.`;
      }

      // Kategori Kompetensi Sosial Emosional (KOM)
      if (qId.startsWith('KOM') || cat.includes('emosional') || cat.includes('kse')) {
        return `Penerapan teknik kesadaran penuh (mindfulness/STOP) dan refleksi emosi berhasil meredakan ketegangan murid, sehingga mereka mampu berkolaborasi secara empati dan bertanggung jawab.`;
      }

      // Kategori English and Global Framework (ENG)
      if (qId.startsWith('ENG') || cat.includes('english') || cat.includes('global')) {
        return `Pemanfaatan bahasa Inggris instruksional sederhana dan sumber belajar global mampu memantik wawasan kontekstual murid, dengan rekomendasi penambahan glosarium kosakata kunci pada pertemuan berikutnya.`;
      }

      // Kategori STEM (STE)
      if (qId.startsWith('STE') || cat.includes('stem')) {
        return `Integrasi siklus perancangan rekayasa (Engineering Design Process) berjalan dinamis saat pembuatan model/solusi, dengan tindak lanjut memperkuat aspek pencatatan data dan analisis akurasi hasil uji coba.`;
      }

      // Generic Default Fallback
      return `Berdasarkan perpaduan Telaah RPP, konfirmasi Pra-Observasi, dan bukti pelaksanaan di kelas (Skor: ${finalScore}/100 - ${predicate}), guru menunjukkan komitmen kuat pada ${strengthsDesc}, dengan fokus peningkatan berkelanjutan pada ${improveDesc}.`;
    }

    const questions = baseQuestions.map(q => ({
      ...q,
      aiAnswer: generateHeuristicAnswer(q)
    }));

    const generalImpression = `Kesan Umum: Pembelajaran yang disajikan Ibu/Bapak ${teacherName} pada mata pelajaran ${subject} telah berlangsung dengan sangat baik (Skor: ${finalScore}/100 - Predikat: ${predicate}). Guru berhasil membangun suasana kelas yang humanis, partisipatif, dan kontekstual.\nSaran: Perkuat teknik scaffolding diferensiasi untuk murid yang membutuhkan pendampingan khusus serta sediakan ruang refleksi mandiri tertulis di akhir kegiatan pembelajaran.`;

    const conclusion = `Berdasarkan sintesis menyeluruh dari Telaah RPP (Tahap 1), Wawancara Pra-Observasi (Tahap 2), Penilaian Indikator Observasi Kelas (Tahap 3 - Nilai: ${finalScore}/100, ${predicate}), serta percakapan Pasca-Observasi, pembelajaran ${subject} oleh Ibu/Bapak ${teacherName} dinyatakan berhasil dan bermakna.\n\nRencana Aksi Tindak Lanjut:\n1. Pengimbasan praktik baik penguasaan kelas dan interaksi dialogis kepada rekan guru di Komunitas Belajar (Kombel) sekolah.\n2. Optimalisasi asesmen formatif berkelanjutan dan lembar kerja berjenjang (scaffolding diferensiasi).\n3. Pelaksanaan siklus supervisi berkala untuk memantau keberlanjutan hasil coaching akademik ini.`;

    return {
      questions,
      generalImpression,
      conclusion,
      source: 'heuristic'
    };
  },

  /**
   * Synthesize Pasca-Observation Overall Conclusion & Follow-up combining all 3 stages
   */
  synthesizePascaConclusion(praData, coreData, pascaQuestions, teacherName = 'Guru') {
    const score = coreData?.finalScore ?? 85;
    const predicate = coreData?.predicate || 'Baik';
    const notesWithContent = (pascaQuestions || []).filter(q => q.notes && q.notes.trim() !== '');

    let userPoints = '';
    if (notesWithContent.length > 0) {
      userPoints = ' Catatan kesepakatan tindak lanjut kepala sekolah: ' + 
        notesWithContent.map(q => {
          const qText = (q.question || q.title || '').trim() || `Poin ${q.id}`;
          return `Pertanyaan "${qText}": "${q.notes.trim()}"`;
        }).join('; ') + '.';
    }

    return `Supervisi Pembelajaran 3 Langkah telah selesai dilaksanakan secara komprehensif. Berdasarkan Telaah RPP, Observasi Kelas (Skor: ${score}/100 - Predikat: ${predicate}), dan Wawancara Refleksi Pasca-Observasi, Ibu/Bapak ${teacherName} dinilai berhasil mewujudkan iklim belajar yang bermakna, kontekstual, dan berpusat pada murid.${userPoints}\n\nRencana Aksi Tindak Lanjut:\n1. Mempertahankan dan mengimbaskan praktik baik kepada rekan sejawat di Kombel sekolah.\n2. Mengoptimalkan teknik scaffolding diferensiasi dan asesmen formatif mandiri murid.\n3. Melakukan evaluasi progres pada siklus pembinaan akademik berikutnya.`;
  }
};

window.KS_AI = KS_AI;
window.SUPERVISI_AI = KS_AI;

