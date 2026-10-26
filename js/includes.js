/**
 * supervisisekolah.id Includes & Layout Component Renderer
 * Provides uniform header, footer, and mobile navigation across public pages and dashboard pages.
 */

const KS_INCLUDES = {
    /**
     * Render Header
     * @param {Object} options
     * @param {'public'|'dashboard'} options.type
     * @param {'home'|'dashboard'|'evaluasi'|'observasi'|'karyawan'|'pengaturan'} options.activeNav
     */
    renderHeader(options = {}) {
        const type = options.type || 'public';
        const activeNav = options.activeNav || 'home';
        const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : './';
        const dashboardUrl = window.KS_AUTH ? window.KS_AUTH.getDashboardUrl() : baseUrl + 'dashboard/';
        const supakUrl = window.KS_AUTH && window.KS_AUTH.getSupakUrl ? window.KS_AUTH.getSupakUrl() : baseUrl + 'supak/';
        const tendikUrl = window.KS_AUTH && window.KS_AUTH.getTendikUrl ? window.KS_AUTH.getTendikUrl() : baseUrl + 'tendik/';
        const tendikPortalUrl = window.KS_AUTH && window.KS_AUTH.getTendikPortalUrl ? window.KS_AUTH.getTendikPortalUrl() : baseUrl + 'tendik/portal/';
        const evaluasiUrl = window.KS_AUTH ? window.KS_AUTH.getEvaluasiUrl() : baseUrl + 'evaluasi/';
        const observasiUrl = window.KS_AUTH && window.KS_AUTH.getObservasiUrl ? window.KS_AUTH.getObservasiUrl() : baseUrl + 'supak/observasi/';
        const supbkUrl = window.KS_AUTH && window.KS_AUTH.getSupbkUrl ? window.KS_AUTH.getSupbkUrl() : baseUrl + 'supak/supbk/';
        const karyawanUrl = window.KS_AUTH ? window.KS_AUTH.getKaryawanUrl() : baseUrl + 'karyawan/';
        const pengaturanUrl = window.KS_AUTH ? window.KS_AUTH.getPengaturanUrl() : baseUrl + 'pengaturan/';
        const adminUrl = window.KS_AUTH ? window.KS_AUTH.getAdminUrl() : baseUrl + 'admin/';
        const guruUrl = window.KS_AUTH ? window.KS_AUTH.getGuruUrl() : baseUrl + 'guru/';
        const portalUrl = window.KS_AUTH && window.KS_AUTH.getPortalUrl ? window.KS_AUTH.getPortalUrl() : baseUrl + 'portal/';
        const homeUrl = baseUrl;
        const isLoggedIn = window.KS_AUTH ? window.KS_AUTH.isLoggedIn() : false;
        const user = window.KS_AUTH ? window.KS_AUTH.getUser() : null;
        const role = window.KS_AUTH ? window.KS_AUTH.getRole() : null;
        const profile = window.KS_AUTH ? window.KS_AUTH.getProfile() : null;
        const isPengawas = role === 'pengawas';
        const isSuperAdmin = role === 'super_admin';

        // Badge styling per role
        let roleBadgeHtml = '<span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase">KS</span>';
        if (role === 'super_admin') {
            roleBadgeHtml = '<span class="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-black tracking-wider">SUPER ADMIN</span>';
        } else if (role === 'kepala_sekolah') {
            roleBadgeHtml = '<span class="text-[10px] bg-amber-400 text-slate-900 px-1.5 py-0.5 rounded font-black tracking-wider">KS</span>';
        } else if (role === 'guru') {
            roleBadgeHtml = '<span class="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black tracking-wider">GURU</span>';
        } else if (role === 'pengawas') {
            roleBadgeHtml = '<span class="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-black tracking-wider flex items-center gap-0.5"><span class="material-symbols-outlined text-[11px]">visibility</span> AUDIT</span>';
        }

        const container = document.getElementById('app-header') || document.querySelector('header');
        if (!container) return;

        if (type === 'dashboard') {
            // Dashboard & Internal Pages Header
            container.className = "bg-surface dark:bg-surface-dim shadow-sm flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-3.5 max-w-container-max mx-auto hidden md:flex sticky top-0 z-50 transition-all border-b border-slate-200/60";
            container.innerHTML = `
                <a href="${homeUrl}" class="flex items-center gap-3 group">
                    <img alt="SupervisiSekolah.id Logo" class="w-9 h-9 object-contain group-hover:scale-105 transition-transform"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNTv4FAsIOr1hBEM5LAM0NnLPM-kUMfynR2mknlt4PfJiWY6mx-yCZhG5Ti36lafu9qTnwy8l2Qu6mSG_fpUPnN4ogGjhEpXpSQ4nkv9PHb3AnQl6YRXx2QdkNogHZENml34xg-kqJkOy62MgFDx60WdkjpZYnG4FhzRnjREYepiqzNVcgpn0EyeIp2pPkkOFF_S2-yGFBE3qhXnM3AFAS9a-ZHbCofVY2iNdwxJ7tIDqxJVike7z_hw" />
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-display-lg text-lg font-bold text-primary dark:text-primary-fixed block leading-tight">SupervisiSekolah<span class="text-secondary">.id</span></span>
                            ${roleBadgeHtml}
                        </div>
                        <span class="text-[10px] text-slate-500 block">${user && user.schoolName ? user.schoolName : (profile ? profile.schoolName : 'SMP Brighton')}</span>
                    </div>
                </a>
                <nav class="flex gap-3.5 lg:gap-5 items-center text-sm">
                    ${isSuperAdmin ? `
                        <a class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1 text-xs" href="${adminUrl}">
                            <span class="material-symbols-outlined text-sm">shield</span>
                            <span>Konsol Super Admin</span>
                        </a>
                    ` : ''}

                    <!-- 1. Dashboard -->
                    <a class="${activeNav === 'dashboard' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-slate-600 font-medium hover:text-primary transition-colors'}"
                        href="${dashboardUrl}">Dashboard</a>

                    <!-- 2. Hierarchical Unified Supervisi Dropdown (Supervisi -> Supervisi Akademik [Supervisi Pembelajaran, Supervisi BK] -> Supervisi Tendik) -->
                    <div class="relative group/supervisi py-1" id="nav-item-supervisi">
                        <button type="button" 
                            id="btn-nav-supervisi"
                            onclick="window.KS_INCLUDES.toggleSupervisiMenu(event)"
                            class="${(activeNav === 'supervisi' || activeNav === 'supak' || activeNav === 'observasi' || activeNav === 'supbk' || activeNav === 'tendik') ? 'text-blue-700 font-bold border-b-2 border-blue-600 pb-1' : 'text-slate-600 font-medium hover:text-blue-700 transition-colors'} flex items-center gap-1.5 cursor-pointer outline-none"
                            aria-haspopup="true" aria-expanded="false" title="Pusat Supervisi Sekolah (Akademik &amp; Tendik)">
                            <span class="material-symbols-outlined text-base text-blue-600">verified</span>
                            <span>Supervisi</span>
                            <span class="material-symbols-outlined text-xs text-slate-400 group-hover/supervisi:rotate-180 transition-transform duration-200" id="supervisi-chevron">expand_more</span>
                        </button>

                        <!-- Level 1 Dropdown: Opens on Hover or Click -->
                        <div id="supervisi-menu-level1"
                            class="absolute left-0 mt-1 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 hidden group-hover/supervisi:block z-50 transition-all">
                            
                            <!-- Header Info -->
                            <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                                <span>Pusat Supervisi</span>
                                <span class="text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.5 rounded">Hierarki Terpadu</span>
                            </div>

                            <!-- Supervisi Akademik (Branch with Sub-items: Pembelajaran & BK) -->
                            <div class="relative group/akademik my-0.5 rounded-xl transition">
                                <!-- Trigger / Header for Supervisi Akademik -->
                                <div class="flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800/80 transition ${(activeNav === 'supak' || activeNav === 'observasi' || activeNav === 'supbk') ? 'bg-blue-50/80 dark:bg-slate-800 text-blue-700 font-bold border border-blue-200/60' : 'text-slate-700 dark:text-slate-200'}"
                                    id="btn-nav-akademik"
                                    onclick="window.KS_INCLUDES.toggleAkademikMenu(event)"
                                    title="Buka Pilihan Supervisi Akademik (Pembelajaran &amp; BK)">
                                    <div class="flex items-center gap-2.5 flex-1 min-w-0">
                                        <span class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                            <span class="material-symbols-outlined text-base">school</span>
                                        </span>
                                        <div class="min-w-0 flex-1">
                                            <div class="font-bold text-xs truncate">Supervisi Akademik</div>
                                            <div class="text-[10px] text-slate-400 font-normal truncate">Pembelajaran &amp; BK</div>
                                        </div>
                                    </div>
                                    <span class="material-symbols-outlined text-sm text-slate-400 group-hover/akademik:translate-x-0.5 transition-transform ml-1" id="akademik-chevron">chevron_right</span>
                                </div>

                                <!-- Level 2 Submenu: Cascades to the right on desktop, or expands on touch -->
                                <div id="supervisi-menu-level2"
                                    class="md:absolute md:left-full md:top-0 md:ml-1.5 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 hidden group-hover/akademik:block z-50 transition-all before:absolute before:-left-3 before:top-0 before:w-3 before:h-full before:content-['']">
                                    
                                    <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                                        <span>Supervisi Akademik</span>
                                        <a href="${supakUrl}" class="text-blue-600 hover:underline normal-case font-semibold text-[10px] flex items-center gap-0.5" title="Buka Beranda Supervisi Akademik">
                                            <span>Pusat Supak</span>
                                            <span class="material-symbols-outlined text-[11px]">arrow_forward</span>
                                        </a>
                                    </div>

                                    <!-- Sub-item 1: Supervisi Pembelajaran -->
                                    <a href="${observasiUrl}" class="flex items-center gap-2.5 p-2 rounded-xl text-xs hover:bg-blue-50 dark:hover:bg-slate-800 transition ${activeNav === 'observasi' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60' : 'text-slate-700 dark:text-slate-200'}">
                                        <span class="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-base">visibility</span>
                                        </span>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-bold flex items-center justify-between gap-1">
                                                <span class="truncate">Supervisi Pembelajaran</span>
                                                <span class="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-semibold flex-shrink-0">Kelas</span>
                                            </div>
                                            <div class="text-[10px] text-slate-400 font-normal truncate">Guru Mapel &amp; Guru Kelas (/supak/observasi)</div>
                                        </div>
                                    </a>

                                    <!-- Sub-item 2: Supervisi BK -->
                                    <a href="${supbkUrl}" class="flex items-center gap-2.5 p-2 rounded-xl text-xs hover:bg-teal-50 dark:hover:bg-slate-800 transition mt-1 ${activeNav === 'supbk' ? 'bg-teal-50 text-teal-700 font-bold border border-teal-200/60' : 'text-slate-700 dark:text-slate-200'}">
                                        <span class="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-base">psychology</span>
                                        </span>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-bold flex items-center justify-between gap-1">
                                                <span class="truncate">Supervisi BK</span>
                                                <span class="text-[9px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded font-semibold flex-shrink-0">Konseling</span>
                                            </div>
                                            <div class="text-[10px] text-slate-400 font-normal truncate">Bimbingan &amp; Konseling (/supak/supbk)</div>
                                        </div>
                                    </a>
                                </div>
                            </div>

                            <div class="my-1 border-t border-slate-100 dark:border-slate-800"></div>

                            <!-- 2. Supervisi Tendik -->
                            <a href="${tendikUrl}" class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-amber-50 dark:hover:bg-slate-800 transition ${activeNav === 'tendik' ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200/60' : 'text-slate-700 dark:text-slate-200'}">
                                <span class="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                    <span class="material-symbols-outlined text-base">badge</span>
                                </span>
                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-xs flex items-center justify-between gap-1">
                                        <span class="truncate">Supervisi Tendik</span>
                                        <span class="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold flex-shrink-0">7 Tendik</span>
                                    </div>
                                    <div class="text-[10px] text-slate-400 font-normal truncate">7 Standar Instrumen Karyawan (/tendik)</div>
                                </div>
                            </a>
                        </div>
                    </div>

                    <!-- 3. Evaluasi Kinerja -->
                    <a class="${activeNav === 'evaluasi' ? 'text-secondary font-bold border-b-2 border-secondary pb-1' : 'text-slate-600 font-medium hover:text-primary transition-colors'} flex items-center gap-1.5"
                        href="${evaluasiUrl}">
                        <span class="material-symbols-outlined text-base text-secondary">assignment</span>
                        <span>Evaluasi Kinerja</span>
                    </a>

                    <!-- 4. Karyawan -->
                    <a class="${activeNav === 'karyawan' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-slate-600 font-medium hover:text-primary transition-colors'} flex items-center gap-1.5"
                        href="${karyawanUrl}">
                        <span class="material-symbols-outlined text-base">badge</span>
                        <span>Karyawan</span>
                    </a>
                </nav>
                <div class="flex items-center gap-2.5">
                    ${isPengawas ? `
                        <div class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                            <span class="material-symbols-outlined text-sm text-blue-600">visibility</span>
                            <span>Audit Mode (Read Only)</span>
                        </div>
                    ` : `
                        <!-- Notification Bell System for KS -->
                        <div class="relative" id="ks-notif-container">
                            <button type="button" id="ks-notif-bell-btn" onclick="window.KS_NOTIF ? window.KS_NOTIF.toggle() : null" 
                                class="relative w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
                                title="Notifikasi Pengajuan Jadwal Supervisi" aria-label="Notifikasi">
                                <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">notifications</span>
                                <span id="ks-notif-ping" class="hidden absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full animate-ping opacity-75"></span>
                                <span id="ks-notif-badge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900">0</span>
                            </button>
                            
                            <!-- Notification Dropdown Menu -->
                            <div id="ks-notif-dropdown" class="hidden absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-[120] overflow-hidden text-slate-800 dark:text-slate-100 transition-all duration-200 origin-top-right">
                            </div>
                        </div>
                    `}

                    ${!isPengawas ? `
                        <a href="${pengaturanUrl}" 
                            class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition cursor-pointer group shadow-2xs ${activeNav === 'pengaturan' ? 'bg-primary/10 border-primary text-primary font-bold ring-2 ring-primary/20' : 'bg-slate-100 hover:bg-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-primary'}" 
                            title="Buka Pengaturan Akun &amp; Profil (${user ? user.fullName : (profile ? profile.fullName : 'Pengguna')})">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span class="font-bold max-w-[130px] truncate group-hover:underline underline-offset-2">${user ? (user.nickName || user.fullName) : (profile ? profile.nickName || profile.username : 'Pengguna')}</span>
                            ${roleBadgeHtml}
                            <span class="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-primary transition-colors" style="font-variation-settings: 'FILL' 0;">manage_accounts</span>
                        </a>
                    ` : `
                        <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 text-xs">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span class="font-bold text-slate-700 dark:text-slate-200 max-w-[120px] truncate" title="${user ? user.fullName : (profile ? profile.fullName : 'Pengguna')}">${user ? (user.nickName || user.fullName) : (profile ? profile.nickName || profile.username : 'Pengguna')}</span>
                            ${roleBadgeHtml}
                        </div>
                    `}
                    <button onclick="window.KS_AUTH.logout()" class="px-2.5 py-1.5 text-rose-600 font-semibold text-xs border border-rose-200 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 cursor-pointer" title="Keluar dari sesi">
                        <span class="material-symbols-outlined text-sm">logout</span>
                        Keluar
                    </button>
                </div>
            `;

            // Auto-initialize KS Notification System
            if (!isPengawas) {
                if (typeof KS_NOTIF !== 'undefined') {
                    KS_NOTIF.init();
                } else {
                    const s = document.createElement('script');
                    s.src = baseUrl + 'js/notifications.js';
                    s.onload = () => {
                        if (window.KS_NOTIF) window.KS_NOTIF.init();
                    };
                    document.head.appendChild(s);
                }
            }
        } else {
            // Public / Homepage Header
            container.className = "bg-surface shadow-xs sticky top-0 z-[100] w-full border-b border-slate-200/60";
            container.innerHTML = `
                <nav class="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-3 max-w-container-max mx-auto">
                    <!-- Brand Identity -->
                    <a href="${homeUrl}" class="flex items-center gap-2.5 sm:gap-3 group">
                        <img alt="SupervisiSekolah.id Logo" class="h-8 w-8 sm:h-9 sm:w-9 object-contain group-hover:scale-105 transition-transform"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNTv4FAsIOr1hBEM5LAM0NnLPM-kUMfynR2mknlt4PfJiWY6mx-yCZhG5Ti36lafu9qTnwy8l2Qu6mSG_fpUPnN4ogGjhEpXpSQ4nkv9PHb3AnQl6YRXx2QdkNogHZENml34xg-kqJkOy62MgFDx60WdkjpZYnG4FhzRnjREYepiqzNVcgpn0EyeIp2pPkkOFF_S2-yGFBE3qhXnM3AFAS9a-ZHbCofVY2iNdwxJ7tIDqxJVike7z_hw" />
                        <div>
                            <span class="font-display-lg text-base sm:text-lg font-black text-primary block leading-tight">SupervisiSekolah<span class="text-secondary">.id</span></span>
                            <span class="text-[10px] text-slate-500 font-medium block truncate max-w-[130px] sm:max-w-xs">${user && user.schoolName ? user.schoolName : (profile ? profile.schoolName : 'Platform Supervisi Sekolah')}</span>
                        </div>
                    </a>

                    <!-- Action Buttons in Header -->
                    <div class="flex items-center gap-2 sm:gap-3" id="nav-auth-container">
                        ${isLoggedIn ? `
                            <div class="flex items-center gap-2">
                                <span class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>${user ? user.fullName : 'Pengguna'}</span>
                                    ${roleBadgeHtml}
                                </span>
                                ${isSuperAdmin ? `
                                    <a href="${adminUrl}" class="px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base">shield</span>
                                        <span>Konsol Admin</span>
                                    </a>
                                ` : isPengawas ? `
                                    <a href="${dashboardUrl}?view=pengawas" class="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base">visibility</span>
                                        <span>Portal Pengawas</span>
                                    </a>
                                ` : role === 'guru' ? `
                                    <a href="${guruUrl}" class="px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base">school</span>
                                        <span>Dashboard Guru</span>
                                    </a>
                                ` : `
                                    <a href="${dashboardUrl}" class="px-3 sm:px-4 py-2 bg-primary hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base text-amber-300">shield_person</span>
                                        <span>Dashboard KS</span>
                                    </a>
                                `}
                                <button onclick="window.KS_AUTH.logout()" class="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition border border-rose-200" title="Keluar">
                                    <span class="material-symbols-outlined text-lg">logout</span>
                                </button>
                            </div>
                        ` : `
                            <!-- Portal GTK (Guru & Tendik 1 Pintu) -->
                            <a href="${portalUrl}"
                                class="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 shadow-xs hover:shadow-sm transition active:scale-95">
                                <span class="material-symbols-outlined text-base sm:text-lg text-emerald-600">badge</span>
                                <span>Portal GTK</span>
                            </a>
                            <button onclick="handleGoToDashboard()"
                                class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-on-primary hover:bg-slate-800 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95">
                                <span class="material-symbols-outlined text-base sm:text-lg text-amber-300">lock_open</span>
                                <span>Universal Login</span>
                            </button>
                        `}
                    </div>
                </nav>
            `;
        }
    },

    /**
     * Render Footer
     * @param {Object} options
     */
    renderFooter(options = {}) {
        const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : './';
        const dashboardUrl = window.KS_AUTH ? window.KS_AUTH.getDashboardUrl() : baseUrl + 'dashboard/';
        const supakUrl = window.KS_AUTH && window.KS_AUTH.getSupakUrl ? window.KS_AUTH.getSupakUrl() : baseUrl + 'supak/';
        const tendikUrl = window.KS_AUTH && window.KS_AUTH.getTendikUrl ? window.KS_AUTH.getTendikUrl() : baseUrl + 'tendik/';
        const guruUrl = window.KS_AUTH ? window.KS_AUTH.getGuruUrl() : baseUrl + 'guru/';
        const portalUrl = window.KS_AUTH && window.KS_AUTH.getPortalUrl ? window.KS_AUTH.getPortalUrl() : baseUrl + 'portal/';
        const supervisiUrl = window.KS_AUTH ? window.KS_AUTH.getSupervisiUrl() : baseUrl + 'guru/supervisi/';
        const evaluasiUrl = window.KS_AUTH ? window.KS_AUTH.getEvaluasiUrl() : baseUrl + 'evaluasi/';
        const observasiUrl = window.KS_AUTH && window.KS_AUTH.getObservasiUrl ? window.KS_AUTH.getObservasiUrl() : baseUrl + 'supak/observasi/';
        const supbkUrl = window.KS_AUTH && window.KS_AUTH.getSupbkUrl ? window.KS_AUTH.getSupbkUrl() : baseUrl + 'supak/supbk/';
        const karyawanUrl = window.KS_AUTH ? window.KS_AUTH.getKaryawanUrl() : baseUrl + 'karyawan/';
        const pengaturanUrl = window.KS_AUTH ? window.KS_AUTH.getPengaturanUrl() : baseUrl + 'pengaturan/';
        const homeUrl = baseUrl;
        const profile = window.KS_AUTH ? window.KS_AUTH.getProfile() : null;

        const container = document.getElementById('app-footer') || document.querySelector('footer');
        if (!container) return;

        container.className = "bg-surface py-12 border-t border-outline-variant/10 w-full mt-auto";
        container.innerHTML = `
            <div class="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-8">
                <div class="flex flex-col items-center md:items-start gap-3">
                    <div class="flex items-center gap-2.5">
                        <img alt="SupervisiSekolah.id Logo" class="h-8 w-8 grayscale opacity-70"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNTv4FAsIOr1hBEM5LAM0NnLPM-kUMfynR2mknlt4PfJiWY6mx-yCZhG5Ti36lafu9qTnwy8l2Qu6mSG_fpUPnN4ogGjhEpXpSQ4nkv9PHb3AnQl6YRXx2QdkNogHZENml34xg-kqJkOy62MgFDx60WdkjpZYnG4FhzRnjREYepiqzNVcgpn0EyeIp2pPkkOFF_S2-yGFBE3qhXnM3AFAS9a-ZHbCofVY2iNdwxJ7tIDqxJVike7z_hw" />
                        <span class="font-bold text-primary">SupervisiSekolah.id</span>
                    </div>
                    <p class="text-on-surface-variant text-sm">Platform Terpadu Manajemen Supervisi Pembelajaran &amp; Tata Kelola Kinerja Sekolah.</p>
                    <p class="text-xs text-on-surface-variant/70">&copy; 2026 SupervisiSekolah.id &bull; ${profile ? profile.schoolName : 'SMP Brighton'}. Hak Cipta Dilindungi.</p>
                </div>
                <div class="flex flex-wrap gap-5 items-center text-xs">
                    <a class="text-slate-600 hover:text-primary transition-colors" href="${homeUrl}">Beranda</a>
                    <a class="text-slate-600 hover:text-primary transition-colors" href="${dashboardUrl}">Dashboard KS</a>
                    <a class="text-blue-700 font-bold hover:text-blue-900 transition-colors flex items-center gap-1" href="${supakUrl}"><span class="material-symbols-outlined text-sm">school</span>Supervisi Akademik</a>
                    <a class="text-amber-700 font-bold hover:text-amber-900 transition-colors flex items-center gap-1" href="${tendikUrl}"><span class="material-symbols-outlined text-sm">badge</span>Supervisi Tendik</a>
                    <a class="text-slate-600 hover:text-primary transition-colors" href="${evaluasiUrl}">Evaluasi Kinerja</a>
                    <a class="text-slate-600 hover:text-primary transition-colors" href="${karyawanUrl}">Data Karyawan</a>
                    <a class="text-slate-600 hover:text-primary transition-colors" href="${pengaturanUrl}">Pengaturan Akun</a>
                    <span class="text-slate-300">|</span>
                    <a class="text-emerald-700 font-bold hover:text-emerald-900 transition-colors flex items-center gap-1" href="${portalUrl}"><span class="material-symbols-outlined text-sm">badge</span>Portal GTK (1 Pintu)</a>
                    <a class="text-slate-600 hover:text-primary transition-colors" href="${guruUrl}">Portal Guru</a>
                    <a class="text-blue-700 font-bold hover:text-blue-900 transition-colors flex items-center gap-1" href="${supervisiUrl}"><span class="material-symbols-outlined text-sm">visibility</span>Laporan Supervisi</a>
                </div>
            </div>
        `;
    },

    /**
     * Render Mobile Bottom Navigation
     * @param {Object} options
     * @param {'home'|'dashboard'|'evaluasi'|'observasi'|'karyawan'|'pengaturan'|'guru'|'supervisi'|'supak'|'supbk'} options.activeNav
     */
    renderMobileNav(options = {}) {
        const type = options.type || 'public';
        const activeNav = options.activeNav || 'home';
        const baseUrl = window.KS_AUTH ? window.KS_AUTH.getBaseUrl() : './';
        const dashboardUrl = window.KS_AUTH ? window.KS_AUTH.getDashboardUrl() : baseUrl + 'dashboard/';
        const supakUrl = window.KS_AUTH && window.KS_AUTH.getSupakUrl ? window.KS_AUTH.getSupakUrl() : baseUrl + 'supak/';
        const guruUrl = window.KS_AUTH ? window.KS_AUTH.getGuruUrl() : baseUrl + 'guru/';
        const supervisiUrl = window.KS_AUTH ? window.KS_AUTH.getSupervisiUrl() : baseUrl + 'guru/supervisi/';
        const evaluasiUrl = window.KS_AUTH ? window.KS_AUTH.getEvaluasiUrl() : baseUrl + 'evaluasi/';
        const observasiUrl = window.KS_AUTH && window.KS_AUTH.getObservasiUrl ? window.KS_AUTH.getObservasiUrl() : baseUrl + 'supak/observasi/';
        const karyawanUrl = window.KS_AUTH ? window.KS_AUTH.getKaryawanUrl() : baseUrl + 'karyawan/';
        const pengaturanUrl = window.KS_AUTH ? window.KS_AUTH.getPengaturanUrl() : baseUrl + 'pengaturan/';
        const homeUrl = baseUrl;

        const container = document.getElementById('app-mobile-nav') || document.querySelector('nav.fixed.bottom-0');
        if (!container) return;

        container.className = "fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1.5 py-2 md:hidden bg-surface-container dark:bg-surface-container-highest shadow-lg rounded-t-xl border-t border-outline-variant/10";
        
        if (type === 'public' || activeNav === 'home' || activeNav === 'guru' || activeNav === 'supervisi') {
            container.innerHTML = `
                <a class="flex-1 flex items-center justify-center gap-2 py-2.5 mx-1 rounded-xl font-bold text-xs ${activeNav === 'guru' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-800 border border-emerald-300'} active:scale-95 transition-all text-center"
                    href="${guruUrl}">
                    <span class="material-symbols-outlined text-lg">school</span>
                    <span>Dashboard Guru</span>
                </a>
                <button onclick="handleGoToDashboard()" class="flex-1 flex items-center justify-center gap-2 py-2.5 mx-1 rounded-xl font-bold text-xs bg-primary text-white shadow-sm active:scale-95 transition-all text-center">
                    <span class="material-symbols-outlined text-lg text-amber-300">admin_panel_settings</span>
                    <span>Dashboard KS</span>
                </button>
            `;
        } else {
            const isSupervisiActive = activeNav === 'supervisi' || activeNav === 'supak' || activeNav === 'observasi' || activeNav === 'supbk' || activeNav === 'tendik';
            container.innerHTML = `
                <a class="flex flex-col items-center justify-center ${activeNav === 'dashboard' ? 'bg-secondary-container text-on-secondary-container rounded-xl px-2 py-1' : 'text-on-surface-variant'} active:scale-95 transition-all text-[10px]"
                    href="${dashboardUrl}">
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' ${activeNav === 'dashboard' ? 1 : 0};">dashboard</span>
                    <span>Dashboard</span>
                </a>
                <a class="flex flex-col items-center justify-center ${isSupervisiActive ? 'bg-secondary-container text-on-secondary-container rounded-xl px-2 py-1' : 'text-on-surface-variant'} active:scale-95 transition-all text-[10px]"
                    href="${supakUrl}">
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' ${isSupervisiActive ? 1 : 0};">verified</span>
                    <span>Supervisi</span>
                </a>
                <a class="flex flex-col items-center justify-center ${activeNav === 'evaluasi' ? 'bg-secondary-container text-on-secondary-container rounded-xl px-2 py-1' : 'text-on-surface-variant'} active:scale-95 transition-all text-[10px]"
                    href="${evaluasiUrl}">
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' ${activeNav === 'evaluasi' ? 1 : 0};">assignment</span>
                    <span>Evaluasi</span>
                </a>
                <a class="flex flex-col items-center justify-center ${activeNav === 'karyawan' ? 'bg-secondary-container text-on-secondary-container rounded-xl px-2 py-1' : 'text-on-surface-variant'} active:scale-95 transition-all text-[10px]"
                    href="${karyawanUrl}">
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' ${activeNav === 'karyawan' ? 1 : 0};">badge</span>
                    <span>Karyawan</span>
                </a>
                <a class="flex flex-col items-center justify-center ${activeNav === 'pengaturan' ? 'bg-secondary-container text-on-secondary-container rounded-xl px-2 py-1' : 'text-on-surface-variant'} active:scale-95 transition-all text-[10px]"
                    href="${pengaturanUrl}">
                    <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' ${activeNav === 'pengaturan' ? 1 : 0};">settings</span>
                    <span>Akun</span>
                </a>
            `;
        }
    },

    /**
     * Toggle Level 1 Supervisi menu on click / tap
     */
    toggleSupervisiMenu(event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        const lvl1 = document.getElementById('supervisi-menu-level1');
        const chevron = document.getElementById('supervisi-chevron');
        if (!lvl1) return;

        const isVisible = lvl1.classList.contains('!block');
        if (isVisible) {
            this.closeSupervisiMenu();
        } else {
            lvl1.classList.remove('hidden');
            lvl1.classList.add('!block');
            if (chevron) chevron.classList.add('rotate-180');
        }
    },

    /**
     * Toggle Level 2 Supervisi Akademik menu on click / tap
     */
    toggleAkademikMenu(event) {
        if (event) {
            event.stopPropagation();
        }
        const lvl2 = document.getElementById('supervisi-menu-level2');
        const chevron = document.getElementById('akademik-chevron');
        if (!lvl2) return;

        const isVisible = lvl2.classList.contains('!block');
        if (isVisible) {
            lvl2.classList.add('hidden');
            lvl2.classList.remove('!block');
            if (chevron) {
                chevron.classList.remove('rotate-90');
                chevron.textContent = 'chevron_right';
            }
        } else {
            lvl2.classList.remove('hidden');
            lvl2.classList.add('!block');
            if (chevron) {
                chevron.classList.add('rotate-90');
                chevron.textContent = 'expand_more';
            }
        }
    },

    /**
     * Close all open supervisi dropdown menus
     */
    closeSupervisiMenu() {
        const lvl1 = document.getElementById('supervisi-menu-level1');
        const lvl2 = document.getElementById('supervisi-menu-level2');
        const chevron = document.getElementById('supervisi-chevron');
        const akChevron = document.getElementById('akademik-chevron');

        if (lvl1) {
            lvl1.classList.add('hidden');
            lvl1.classList.remove('!block');
        }
        if (lvl2) {
            lvl2.classList.add('hidden');
            lvl2.classList.remove('!block');
        }
        if (chevron) chevron.classList.remove('rotate-180');
        if (akChevron) {
            akChevron.classList.remove('rotate-90');
            akChevron.textContent = 'chevron_right';
        }
    },

    /**
     * Bind click-outside and escape key listeners for menus
     */
    bindSupervisiEvents() {
        if (this._supervisiEventsBound) return;
        this._supervisiEventsBound = true;

        document.addEventListener('click', (e) => {
            const container = document.getElementById('nav-item-supervisi');
            if (container && !container.contains(e.target)) {
                this.closeSupervisiMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSupervisiMenu();
            }
        });
    },

    /**
     * Auto initialize layout on page load
     * @param {Object} config
     */
    init(config = {}) {
        this.renderHeader(config);
        this.renderFooter(config);
        this.renderMobileNav(config);
        this.bindSupervisiEvents();
    }
};

window.KS_INCLUDES = KS_INCLUDES;
window.SUPERVISI_INCLUDES = KS_INCLUDES;
