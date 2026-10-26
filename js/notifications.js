/**
 * supervisisekolah.id - Notification System for Kepala Sekolah
 * Handles supervision schedule approval alerts, badge counters, and interactive flyout dropdown.
 */

const KS_NOTIF = {
    schedules: [],
    pendingSchedules: [],
    isOpen: false,
    pollTimer: null,
    isInitialized: false,
    lastPendingCount: null,

    init() {
        if (this.isInitialized) {
            this.fetchNotifications();
            return;
        }
        this.isInitialized = true;

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const container = document.getElementById('ks-notif-container');
            const evalContainer = document.getElementById('ks-notif-container-eval');
            const dropdown = document.getElementById('ks-notif-dropdown');
            const evalDropdown = document.getElementById('ks-notif-dropdown-eval');

            const isInsideContainer = (container && container.contains(e.target)) || (evalContainer && evalContainer.contains(e.target));
            const isInsideDropdown = (dropdown && dropdown.contains(e.target)) || (evalDropdown && evalDropdown.contains(e.target));

            if (this.isOpen && !isInsideContainer && !isInsideDropdown) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Refetch when tab becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.fetchNotifications();
            }
        });

        // Initial fetch
        this.fetchNotifications();

        // Polling every 25 seconds for real-time awareness
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = setInterval(() => {
            this.fetchNotifications();
        }, 25000);
    },

    async fetchNotifications() {
        try {
            const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : '../';
            const apiUrl = baseUrl + 'api.php?action=get_schedules';
            const res = await fetch(apiUrl);
            const data = await res.json();
            if (data.success && Array.isArray(data.schedules)) {
                this.schedules = data.schedules;
                const newPending = data.schedules.filter(s => s.status === 'Pending');

                // Trigger toast notification if a new pending schedule arrived while page is open
                if (this.lastPendingCount !== null && newPending.length > this.lastPendingCount) {
                    const diff = newPending.length - this.lastPendingCount;
                    const latest = newPending[0];
                    this.showToastNotification(latest, diff);
                }

                this.lastPendingCount = newPending.length;
                this.pendingSchedules = newPending;
            } else {
                this.schedules = [];
                this.pendingSchedules = [];
                this.lastPendingCount = 0;
            }
        } catch (err) {
            console.warn('[KS_NOTIF] Gagal memuat notifikasi dari server:', err);
        }

        this.updateBadge();
        if (this.isOpen) {
            this.renderDropdown();
        }
    },

    showToastNotification(sch, countDiff = 1) {
        const teacherName = sch ? sch.teacherName : 'Guru';
        const subject = sch ? sch.subject : 'Supervisi';

        if (typeof Swal !== 'undefined' && Swal.mixin) {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 6000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });

            Toast.fire({
                icon: 'warning',
                title: '🔔 Jadwal Supervisi Masuk!',
                html: `<strong>${teacherName}</strong> mengajukan jadwal supervisi (${subject}) yang memerlukan persetujuan.`
            });
        }
    },

    updateBadge() {
        const badges = document.querySelectorAll('#ks-notif-badge, .ks-notif-badge');
        const pings = document.querySelectorAll('#ks-notif-ping, .ks-notif-ping');
        const count = this.pendingSchedules.length;

        badges.forEach(b => {
            if (count > 0) {
                b.textContent = count > 99 ? '99+' : count;
                b.classList.remove('hidden');
            } else {
                b.classList.add('hidden');
            }
        });

        pings.forEach(p => {
            if (count > 0) {
                p.classList.remove('hidden');
            } else {
                p.classList.add('hidden');
            }
        });

        // Style the bell button to indicate active pending items
        const btns = document.querySelectorAll('#ks-notif-bell-btn, .ks-notif-bell-btn');
        btns.forEach(btn => {
            if (count > 0) {
                btn.classList.add('text-amber-500', 'border-amber-300', 'dark:border-amber-700', 'bg-amber-50/80', 'dark:bg-amber-950/30');
                btn.classList.remove('text-slate-600', 'dark:text-slate-300');
            } else {
                btn.classList.remove('text-amber-500', 'border-amber-300', 'dark:border-amber-700', 'bg-amber-50/80', 'dark:bg-amber-950/30');
                btn.classList.add('text-slate-600', 'dark:text-slate-300');
            }
        });
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        this.isOpen = true;
        this.renderDropdown();
        const dropdowns = document.querySelectorAll('#ks-notif-dropdown, #ks-notif-dropdown-eval');
        dropdowns.forEach(d => d.classList.remove('hidden'));
        this.fetchNotifications();
    },

    close() {
        this.isOpen = false;
        const dropdowns = document.querySelectorAll('#ks-notif-dropdown, #ks-notif-dropdown-eval');
        dropdowns.forEach(d => d.classList.add('hidden'));
    },

    renderDropdown() {
        const dropdowns = document.querySelectorAll('#ks-notif-dropdown, #ks-notif-dropdown-eval');
        if (!dropdowns.length) return;

        const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : '../';
        const observasiUrl = window.KS_AUTH && window.KS_AUTH.getObservasiUrl ? window.KS_AUTH.getObservasiUrl() : baseUrl + 'observasi';
        const count = this.pendingSchedules.length;

        const escapeHtml = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const d = new Date(parts[0], parts[1] - 1, parts[2]);
                    return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
                }
            } catch(e) {}
            return dateStr;
        };

        let itemsHtml = '';
        if (count > 0) {
            itemsHtml = this.pendingSchedules.map(sch => {
                const teacherNameSafe = escapeHtml(sch.teacherName);
                const subjectSafe = escapeHtml(sch.subject);
                const classSafe = escapeHtml(sch.gradeClass || '-');
                const timeSlotSafe = escapeHtml(sch.timeSlot || 'Waktu Fleksibel');
                const rppDateStr = formatDate(sch.rppDate);
                const obsDateStr = formatDate(sch.obsDate);
                const escapedNameForJs = (sch.teacherName || '').replace(/'/g, "\\'");

                return `
                    <div class="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 rounded-xl transition space-y-2.5">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-start gap-2.5">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                                    <span class="material-symbols-outlined text-base">person</span>
                                </div>
                                <div>
                                    <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">${teacherNameSafe}</h4>
                                    <p class="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">${subjectSafe} &bull; Kelas ${classSafe}</p>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/90 text-amber-900 dark:bg-amber-800/60 dark:text-amber-200 border border-amber-300/80 flex items-center gap-1 flex-shrink-0 animate-pulse">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Perlu Persetujuan
                            </span>
                        </div>

                        <!-- Schedule dates -->
                        <div class="grid grid-cols-2 gap-2 text-[11px] bg-white/90 dark:bg-slate-800/90 p-2.5 rounded-lg border border-amber-100 dark:border-slate-700/60 font-mono shadow-2xs">
                            <div>
                                <span class="text-[10px] text-slate-400 block font-sans font-medium">1. Telaah Dokumen RPP</span>
                                <span class="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                                    <i class="fa-solid fa-file-signature text-[10px] text-amber-500"></i>
                                    ${rppDateStr}
                                </span>
                            </div>
                            <div>
                                <span class="text-[10px] text-slate-400 block font-sans font-medium">2. Observasi Kelas</span>
                                <span class="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                    <i class="fa-solid fa-chalkboard-user text-[10px] text-emerald-500"></i>
                                    ${obsDateStr}
                                </span>
                            </div>
                        </div>

                        <div class="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                            <span>Sesi / Jam: <strong class="text-slate-700 dark:text-slate-300 font-semibold">${timeSlotSafe}</strong></span>
                            <span class="text-amber-600 dark:text-amber-400 font-medium">Diajukan oleh Guru</span>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/30">
                            <button type="button" onclick="window.KS_NOTIF.approveSchedule('${sch.id}', '${escapedNameForJs}')" 
                                class="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer">
                                <span class="material-symbols-outlined text-sm">check</span>
                                <span>Setujui</span>
                            </button>
                            <button type="button" onclick="window.KS_NOTIF.rejectSchedule('${sch.id}', '${escapedNameForJs}')" 
                                class="py-1.5 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer">
                                <span class="material-symbols-outlined text-sm">close</span>
                                <span>Tolak</span>
                            </button>
                            <button type="button" onclick="window.KS_NOTIF.goToSchedule('${sch.id}')" 
                                class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer" title="Buka Halaman Observasi">
                                <span class="material-symbols-outlined text-sm">open_in_new</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            // Empty state: No pending requests
            const recentApproved = this.schedules.filter(s => s.status === 'Disetujui').slice(0, 2);
            let recentHtml = '';
            if (recentApproved.length > 0) {
                recentHtml = `
                    <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">Jadwal Disetujui Terbaru</p>
                        <div class="space-y-1.5">
                            ${recentApproved.map(s => `
                                <div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-left">
                                    <div class="truncate pr-2">
                                        <span class="font-bold text-slate-700 dark:text-slate-200 block truncate">${escapeHtml(s.teacherName)}</span>
                                        <span class="text-[10px] text-slate-400">${escapeHtml(s.subject)} &bull; Obs: ${formatDate(s.obsDate)}</span>
                                    </div>
                                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex-shrink-0">Disetujui</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            itemsHtml = `
                <div class="py-8 px-4 text-center">
                    <div class="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2.5">
                        <span class="material-symbols-outlined text-2xl">task_alt</span>
                    </div>
                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">Tidak Ada Pengajuan Menunggu</h4>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[240px] mx-auto">Semua pengajuan jadwal supervisi guru telah disetujui atau belum ada pengajuan baru.</p>
                    ${recentHtml}
                </div>
            `;
        }

        const content = `
            <!-- Header -->
            <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-amber-500 text-lg" style="font-variation-settings: 'FILL' 1;">notifications_active</span>
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-100">Notifikasi Supervisi Guru</span>
                    ${count > 0 ? `
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-2xs">${count} Baru</span>
                    ` : `
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">Clear</span>
                    `}
                </div>
                <button type="button" onclick="window.KS_NOTIF.fetchNotifications()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 rounded-lg hover:bg-slate-200/60 cursor-pointer" title="Muat Ulang Notifikasi">
                    <span class="material-symbols-outlined text-sm">refresh</span>
                </button>
            </div>

            <!-- List Body -->
            <div class="p-3 max-h-[380px] overflow-y-auto space-y-2.5">
                ${itemsHtml}
            </div>

            <!-- Footer -->
            <div class="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span class="text-[11px] text-slate-500">Perlu Persetujuan: <strong class="text-slate-800 dark:text-slate-200 font-bold">${count}</strong></span>
                <a href="${observasiUrl}" onclick="window.KS_NOTIF.close()" class="text-primary hover:text-blue-700 font-bold flex items-center gap-1 transition">
                    <span>Buka Jadwal Supervisi</span>
                    <span class="material-symbols-outlined text-sm">chevron_right</span>
                </a>
            </div>
        `;

        dropdowns.forEach(d => {
            d.innerHTML = content;
        });
    },

    async approveSchedule(schId, teacherName) {
        try {
            const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : '../';
            const apiUrl = baseUrl + 'api.php?action=approve_schedule';
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: schId })
            });
            const data = await res.json();
            if (data.success) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Jadwal Disetujui',
                        text: `Jadwal supervisi untuk ${teacherName || 'guru'} telah resmi disetujui.`,
                        timer: 2200,
                        showConfirmButton: false
                    });
                }
                await this.fetchNotifications();
                // If currently on observasi page, refresh the schedule table in real time
                if (typeof fetchScheduleData === 'function') {
                    fetchScheduleData();
                }
            } else {
                alert(data.error || 'Gagal menyetujui jadwal.');
            }
        } catch (err) {
            console.error('[KS_NOTIF] Gagal menyetujui:', err);
            alert('Gagal menghubungi server database.');
        }
    },

    async rejectSchedule(schId, teacherName) {
        let reason = '';
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Tolak / Minta Revisi Jadwal',
                text: `Berikan catatan revisi untuk guru: ${teacherName || ''}`,
                input: 'text',
                inputPlaceholder: 'Contoh: Mohon geser ke hari Kamis karena agenda asesmen sekolah.',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Tolak Jadwal',
                cancelButtonText: 'Batal',
                inputValidator: (v) => !v || !v.trim() ? 'Catatan revisi wajib diisi agar guru mengetahui hal yang perlu disesuaikan!' : null
            });
            if (!result.isConfirmed || !result.value) return;
            reason = result.value.trim();
        } else {
            reason = prompt(`Berikan catatan revisi untuk guru (${teacherName || ''}):`);
            if (!reason || !reason.trim()) return;
        }

        try {
            const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : '../';
            const apiUrl = baseUrl + 'api.php?action=reject_schedule';
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: schId, reason: reason })
            });
            const data = await res.json();
            if (data.success) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Jadwal Ditolak',
                        text: 'Pengajuan guru telah ditolak dan catatan revisi tersimpan.',
                        timer: 2200,
                        showConfirmButton: false
                    });
                }
                await this.fetchNotifications();
                if (typeof fetchScheduleData === 'function') {
                    fetchScheduleData();
                }
            } else {
                alert(data.error || 'Gagal memproses penolakan.');
            }
        } catch (err) {
            console.error('[KS_NOTIF] Gagal menolak:', err);
            alert('Gagal menghubungi server database.');
        }
    },

    goToSchedule(schId) {
        this.close();
        const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : '../';
        const observasiUrl = window.KS_AUTH && window.KS_AUTH.getObservasiUrl ? window.KS_AUTH.getObservasiUrl() : baseUrl + 'observasi';

        if (window.location.pathname.includes('/observasi')) {
            if (typeof switchTab === 'function') {
                switchTab('jadwal');
                const statusSelect = document.getElementById('filterScheduleStatus');
                if (statusSelect) {
                    statusSelect.value = 'Pending';
                    if (typeof renderScheduleTable === 'function') {
                        renderScheduleTable();
                    }
                }
                const tableCard = document.getElementById('scheduleTableBody');
                if (tableCard) {
                    tableCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } else {
            window.location.href = observasiUrl;
        }
    }
};

window.KS_NOTIF = KS_NOTIF;
window.SUPERVISI_NOTIF = KS_NOTIF;
