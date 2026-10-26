/**
 * supervisisekolah.id Auth & Navigation Manager
 * Modular authentication, session handling, profile settings, and clean URL routing.
 */

const KS_AUTH = {
    DEFAULT_PROFILE: {
        username: '',
        status: 'active',
        password: '',
        titlePrefix: '',
        firstName: '',
        lastName: '',
        titleSuffix: '',
        nickName: '',
        fullName: '',
        nip: '',
        nuptk: '',
        email: '',
        phone: '',
        role: 'Kepala Sekolah SMP',
        schoolName: '',
        npsn: '',
        schoolAddress: '',
        schoolEmail: '',
        schoolPhone: '',
        academicYear: '2026/2027',
        semester: 'Ganjil',
        schoolCode: '',
        modulAjarFolderUrl: '',
        dokumentasiObservasiFolderUrl: '',
        dokumentasiPascaFolderUrl: '',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
    },
    
    // Resolve base path dynamically whether running from root or subdirectory
    getBaseUrl() {
        const path = window.location.pathname;
        if (path.includes('/supervisisekolah.id/')) {
            return window.location.origin + '/supervisisekolah.id/';
        }
        if (path.includes('/ks.id/')) {
            return window.location.origin + '/ks.id/';
        }
        return window.location.origin + '/';
    },

    getDashboardUrl() {
        return this.getBaseUrl() + 'dashboard/';
    },

    getGuruUrl() {
        return this.getBaseUrl() + 'guru/';
    },

    getSupervisiUrl() {
        return this.getBaseUrl() + 'guru/supervisi/';
    },

    getToolkitUrl() {
        return this.getBaseUrl() + 'guru/toolkit/';
    },

    getToolkitModulAjarUrl() {
        return this.getBaseUrl() + 'guru/toolkit/generator-modul-ajar/';
    },

    getToolkitRppUrl() {
        return this.getBaseUrl() + 'guru/toolkit/generator-prompt-rpp/';
    },

    getLaporanSupervisiUrl() {
        return this.getBaseUrl() + 'guru/supervisi/laporan-supervisi/';
    },

    getEvaluasiUrl() {
        return this.getBaseUrl() + 'evaluasi/';
    },

    getObservasiUrl() {
        return this.getBaseUrl() + 'supak/observasi/';
    },

    getSupakUrl() {
        return this.getBaseUrl() + 'supak/';
    },

    getSupbkUrl() {
        return this.getBaseUrl() + 'supak/supbk/';
    },

    getTendikUrl() {
        return this.getBaseUrl() + 'tendik/';
    },

    getTendikPortalUrl() {
        return this.getBaseUrl() + 'tendik/portal/';
    },

    getPortalUrl() {
        return this.getBaseUrl() + 'portal/';
    },

    getGtkPortalUrl() {
        return this.getBaseUrl() + 'portal/';
    },

    getAuthUrl() {
        return this.getBaseUrl() + 'portal/';
    },

    getKaryawanUrl() {
        return this.getBaseUrl() + 'karyawan/';
    },

    getPengaturanUrl() {
        return this.getBaseUrl() + 'pengaturan/';
    },

    getHomeUrl() {
        return this.getBaseUrl();
    },

    getAdminUrl() {
        return this.getBaseUrl() + 'admin/';
    },

    getSchoolCode() {
        const p = this.getProfile();
        return p.schoolCode || '';
    },

    getActivePeriod() {
        const p = this.getProfile();
        return {
            academicYear: p.academicYear || '2026/2027',
            semester: p.semester || 'Ganjil',
            periodKey: `${(p.academicYear || '2026/2027').replace(/[^a-zA-Z0-9]/g, '_')}_${(p.semester || 'Ganjil').toLowerCase()}`
        };
    },

    getModulAjarFolderUrl() {
        const p = this.getProfile();
        return p.modulAjarFolderUrl || '';
    },

    getDokumentasiObservasiFolderUrl() {
        const p = this.getProfile();
        return p.dokumentasiObservasiFolderUrl || '';
    },

    getDokumentasiPascaFolderUrl() {
        const p = this.getProfile();
        return p.dokumentasiPascaFolderUrl || '';
    },

    getProfile() {
        const user = this.getUser();
        const saved = localStorage.getItem('supervisi_headmaster_profile') || localStorage.getItem('ks_headmaster_profile');
        let parsed = {};
        if (saved) {
            try { 
                parsed = JSON.parse(saved); 
            } catch (e) {}
        }

        // If user is logged in, align strictly with active user session
        if (user && user.isLoggedIn) {
            // If saved profile belongs to a different school or different user, discard it
            if ((parsed.username && user.username && parsed.username !== user.username) ||
                (parsed.schoolId && user.schoolId && parsed.schoolId !== user.schoolId)) {
                parsed = {};
            }
            return {
                ...this.DEFAULT_PROFILE,
                ...parsed,
                username: user.username || parsed.username || '',
                status: user.status || parsed.status || 'active',
                fullName: user.fullName || parsed.fullName || '',
                firstName: user.firstName || parsed.firstName || (user.fullName ? user.fullName.split(' ')[0] : ''),
                lastName: user.lastName || parsed.lastName || '',
                nickName: user.nickName || parsed.nickName || '',
                titlePrefix: user.titlePrefix || parsed.titlePrefix || '',
                titleSuffix: user.titleSuffix || parsed.titleSuffix || '',
                schoolName: user.schoolName || parsed.schoolName || '',
                schoolId: user.schoolId || parsed.schoolId || '',
                schoolCode: user.schoolCode || parsed.schoolCode || '',
                role: user.roleLabel || user.role || 'Kepala Sekolah SMP',
                nip: user.nip || parsed.nip || '',
                nuptk: user.nuptk || parsed.nuptk || '',
                email: user.email || parsed.email || '',
                phone: user.phone || parsed.phone || '',
                academicYear: parsed.academicYear || user.academicYear || this.DEFAULT_PROFILE.academicYear,
                semester: parsed.semester || user.semester || this.DEFAULT_PROFILE.semester,
                modulAjarFolderUrl: parsed.modulAjarFolderUrl || user.modulAjarFolderUrl || '',
                dokumentasiObservasiFolderUrl: parsed.dokumentasiObservasiFolderUrl || user.dokumentasiObservasiFolderUrl || '',
                dokumentasiPascaFolderUrl: parsed.dokumentasiPascaFolderUrl || user.dokumentasiPascaFolderUrl || ''
            };
        }

        // Unauthenticated or offline fallback
        return { ...this.DEFAULT_PROFILE, ...parsed };
    },

    saveProfile(updatedData) {
        const user = this.getUser();
        const current = this.getProfile();
        const merged = { ...current, ...updatedData };

        // Ensure tenant identity consistency with active session
        if (user && user.isLoggedIn) {
            if (user.schoolId) {
                merged.schoolId = user.schoolId;
                merged.school_id = user.schoolId;
            }
            if (updatedData.username) {
                merged.username = updatedData.username;
            } else if (user.username) {
                merged.username = user.username;
            }
        }

        if (updatedData.status) {
            merged.status = updatedData.status;
        }

        // Respect custom fullName or title if provided, otherwise compose naturally from names
        if (updatedData.fullName && updatedData.fullName.trim() !== '') {
            merged.fullName = updatedData.fullName.trim();
        } else if (merged.firstName || merged.lastName) {
            const titlePrefix = merged.titlePrefix ? `${merged.titlePrefix.trim()} ` : '';
            const titleSuffix = merged.titleSuffix ? `, ${merged.titleSuffix.trim()}` : '';
            const coreName = `${merged.firstName || ''} ${merged.lastName || ''}`.trim();
            merged.fullName = `${titlePrefix}${coreName}${titleSuffix}`.trim();
        }

        // 1. Instantly persist to localStorage for fast local responsiveness
        const profileJson = JSON.stringify(merged);
        localStorage.setItem('supervisi_headmaster_profile', profileJson);
        localStorage.setItem('ks_headmaster_profile', profileJson);

        // 2. Always sync active session
        if (this.isLoggedIn() || localStorage.getItem('supervisi_auth_session') || localStorage.getItem('ks_auth_session')) {
            const session = this.getUser() || {};
            const sessionData = {
                ...session,
                username: merged.username || session.username,
                fullName: merged.fullName || session.fullName,
                name: merged.fullName || session.fullName,
                nickName: merged.nickName || session.nickName,
                role: session.role || 'kepala_sekolah',
                school: merged.schoolName || session.schoolName,
                schoolName: merged.schoolName || session.schoolName,
                schoolId: merged.schoolId || session.schoolId,
                email: merged.email || session.email,
                nip: merged.nip || session.nip,
                nuptk: merged.nuptk || session.nuptk,
                phone: merged.phone || session.phone,
                academicYear: merged.academicYear || session.academicYear,
                semester: merged.semester || session.semester,
                isLoggedIn: true,
                lastUpdated: new Date().toISOString()
            };
            const sessJson = JSON.stringify(sessionData);
            localStorage.setItem('supervisi_auth_session', sessJson);
            localStorage.setItem('ks_auth_session', sessJson);
        }

        // 3. Immediately persist to Server-Side Database (MySQL)
        this.pushProfileToServer(merged);

        return merged;
    },

    async pushProfileToServer(profile) {
        try {
            const user = this.getUser();
            const token = localStorage.getItem('supervisi_auth_token') || localStorage.getItem('ks_auth_token') || (user ? user.token : '');
            const schoolId = (user && user.schoolId) ? user.schoolId : (profile.schoolId || profile.school_id || 'SCH-001');

            const payload = {
                ...profile,
                school_id: schoolId,
                schoolId: schoolId,
                token: token
            };

            const apiUrl = this.getBaseUrl() + `api.php?action=save_profile&school_id=${encodeURIComponent(schoolId)}&token=${encodeURIComponent(token)}`;
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.profile) {
                    const profJson = JSON.stringify(data.profile);
                    localStorage.setItem('supervisi_headmaster_profile', profJson);
                    localStorage.setItem('ks_headmaster_profile', profJson);
                }
            }
        } catch (e) {
            console.warn('Gagal menyimpan profil ke server MySQL:', e);
        }
    },

    /**
     * Automatic Bi-Directional Synchronization with MySQL Database
     * Ensures any browser / device always sees the exact same saved account & school data.
     * CRITICAL: Always sends auth token so server returns the CORRECT school's profile.
     */
    async initServerSync() {
        // Sync profile for kepala_sekolah and pengawas (to show active school profile in audit mode)
        const session = this.getUser();
        if (!session || !session.isLoggedIn) return;
        if (session.role !== 'kepala_sekolah' && session.role !== 'pengawas') return;

        const token = localStorage.getItem('supervisi_auth_token') || localStorage.getItem('ks_auth_token') || session.token || '';
        if (!token) return; // Can't identify which school without a token

        try {
            // Always send active school_id & token so server returns the correct school's profile
            const activeSid = this.getActiveSchoolId();
            const schoolParam = activeSid ? `&school_id=${encodeURIComponent(activeSid)}` : '';
            const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
            const apiUrl = this.getBaseUrl() + `api.php?action=get_profile${schoolParam}${tokenParam}`;
            const res = await fetch(apiUrl, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.success && data.profile) {
                    const serverProfile = data.profile;

                    // Server is always authoritative — overwrite stale localStorage
                    const pJson = JSON.stringify(serverProfile);
                    localStorage.setItem('supervisi_headmaster_profile', pJson);
                    localStorage.setItem('ks_headmaster_profile', pJson);

                    // Dispatch event for UI components to re-render dynamically
                    window.dispatchEvent(new CustomEvent('ks:profile-synced', { detail: serverProfile }));
                    window.dispatchEvent(new CustomEvent('supervisi:profile-synced', { detail: serverProfile }));
                    return serverProfile;
                }
            }
        } catch (err) {
            console.warn('Sync profile error:', err);
        }
    },

    isLoggedIn() {
        const authData = localStorage.getItem('supervisi_auth_session') || localStorage.getItem('ks_auth_session');
        if (!authData) return false;
        try {
            const session = JSON.parse(authData);
            return Boolean(session && session.isLoggedIn === true && session.username);
        } catch (e) {
            return false;
        }
    },

    getUser() {
        const authData = localStorage.getItem('supervisi_auth_session') || localStorage.getItem('ks_auth_session');
        if (!authData) {
            return null;
        }
        try {
            const session = JSON.parse(authData);
            return session;
        } catch (e) {
            return null;
        }
    },

    getCurrentUser() {
        const session = this.getUser();
        if (session) {
            return session;
        }
        const profile = this.getProfile();
        return {
            ...profile,
            name: profile.fullName,
            school: profile.schoolName,
            role: 'kepala_sekolah'
        };
    },

    getRole() {
        const u = this.getUser();
        return u && u.role ? u.role : null;
    },

    getRoleLabel(customRole = null) {
        const role = customRole || this.getRole();
        const map = {
            'super_admin': 'Super Admin',
            'kepala_sekolah': 'Kepala Sekolah',
            'guru': 'Guru',
            'pengawas': 'Pengawas Pembina'
        };
        return map[role] || (role ? role.replace(/_/g, ' ') : 'Tamu');
    },

    isSuperAdmin() {
        return this.getRole() === 'super_admin';
    },

    isKepalaSekolah() {
        return this.getRole() === 'kepala_sekolah';
    },

    isGuru() {
        return this.getRole() === 'guru';
    },

    isPengawas() {
        return this.getRole() === 'pengawas';
    },

    isReadOnly() {
        return this.getRole() === 'pengawas';
    },

    hasRole(roles) {
        if (!this.isLoggedIn()) return false;
        if (!roles) return true;
        const currentRole = this.getRole();
        if (Array.isArray(roles)) {
            return roles.includes(currentRole);
        }
        return currentRole === roles;
    },

    getAssignedSchools() {
        const u = this.getUser();
        return (u && u.assignedSchools && Array.isArray(u.assignedSchools)) ? u.assignedSchools : [];
    },

    getActiveSchoolId() {
        const role = this.getRole();
        if (role === 'pengawas') {
            const saved = localStorage.getItem('ks_pengawas_active_school');
            const assigned = this.getAssignedSchools();
            if (saved && assigned.some(s => s.id === saved)) {
                return saved;
            }
            return assigned.length > 0 ? assigned[0].id : (this.getUser()?.schoolId || 'SCH-001');
        }
        if (role === 'super_admin') {
            return localStorage.getItem('ks_admin_active_school') || (this.getUser()?.schoolId || 'SCH-001');
        }
        return this.getUser()?.schoolId || 'SCH-001';
    },

    setActiveSchoolId(schoolId) {
        const role = this.getRole();
        if (role === 'pengawas') {
            localStorage.setItem('ks_pengawas_active_school', schoolId);
        } else if (role === 'super_admin') {
            localStorage.setItem('ks_admin_active_school', schoolId);
        }
        window.dispatchEvent(new CustomEvent('ks:school-changed', { detail: { schoolId } }));
        return schoolId;
    },

    can(permission) {
        if (!this.isLoggedIn()) return false;
        const role = this.getRole();
        
        switch (permission) {
            case 'manage_system':
            case 'manage_all_schools':
            case 'manage_schools':
            case 'manage_users':
            case 'manage_rubrics':
            case 'assign_pengawas':
                return role === 'super_admin';
            case 'manage_school':
            case 'manage_employees':
            case 'edit_school_profile':
                return role === 'super_admin' || role === 'kepala_sekolah';
            case 'supervise':
            case 'evaluate':
            case 'edit_schedule':
            case 'approve_schedule':
            case 'reject_schedule':
                return role === 'super_admin' || role === 'kepala_sekolah';
            case 'request_schedule':
                return role === 'guru';
            case 'view_dashboard':
            case 'view_reports':
            case 'view_evaluasi':
            case 'view_observasi':
            case 'view_recap':
                return true; // All authenticated roles can view
            case 'edit_data':
                return role !== 'pengawas'; // Pengawas is 100% read-only
            default:
                return false;
        }
    },

    async login(username, password) {
        const cleanU = (username || '').trim();
        const cleanP = (password || '').trim();

        if (!cleanU || !cleanP) {
            return { success: false, message: 'Username dan kata sandi wajib diisi!' };
        }

        try {
            const apiUrl = this.getBaseUrl() + 'api.php?action=login';
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: cleanU, password: cleanP })
            });

            const data = await res.json();
            if (res.ok && data.success && data.user) {
                const u = data.user;
                const sch = data.school;
                const token = data.token;
                const assignedSchools = data.assigned_schools || [];

                const sessionData = {
                    token: token,
                    id: u.id,
                    username: u.username,
                    email: u.email || '',
                    fullName: u.full_name,
                    name: u.full_name,
                    nickName: u.username,
                    role: u.role, // 'super_admin' | 'kepala_sekolah' | 'pengawas'
                    roleLabel: this.getRoleLabel(u.role),
                    schoolId: u.school_id,
                    schoolName: sch ? sch.name : (u.school_id === 'SCH-002' ? 'SMP Fatahillah' : 'SMP Brighton'),
                    schoolCode: sch ? sch.code : (u.school_id === 'SCH-002' ? 'FAT-8M2X' : 'BRI-TF8U'),
                    schoolNpsn: sch ? sch.npsn : '',
                    assignedSchools: assignedSchools,
                    employeeId: u.employee_id || '',
                    nip: u.nip || '',
                    phone: u.phone || '',
                    avatarUrl: u.avatar_url || '',
                    mustChangePassword: u.must_change_password == 1 || u.must_change_password === true,
                    isLoggedIn: true,
                    loginTime: new Date().toISOString()
                };

                const sessJson = JSON.stringify(sessionData);
                localStorage.setItem('supervisi_auth_session', sessJson);
                localStorage.setItem('ks_auth_session', sessJson);
                if (token) {
                    localStorage.setItem('supervisi_auth_token', token);
                    localStorage.setItem('ks_auth_token', token);
                }
                if (assignedSchools.length > 0) {
                    localStorage.setItem('ks_pengawas_active_school', assignedSchools[0].id);
                }

                // If user is kepala_sekolah, store the school's profile as-is (NO merging with DEFAULT_PROFILE)
                if (u.role === 'kepala_sekolah' && sch && sch.profile_json) {
                    try {
                        const parsedP = typeof sch.profile_json === 'string'
                            ? JSON.parse(sch.profile_json)
                            : sch.profile_json;
                        parsedP.username = u.username;
                        parsedP.schoolId = u.school_id;
                        parsedP.schoolName = sch.name;
                        parsedP.fullName = u.full_name;
                        const profPayload = JSON.stringify(parsedP);
                        localStorage.setItem('supervisi_headmaster_profile', profPayload);
                        localStorage.setItem('ks_headmaster_profile', profPayload);
                    } catch(e) {}
                } else if (u.role !== 'kepala_sekolah') {
                    // Non-kepala roles: clear any stale headmaster profile to prevent cross-contamination
                    localStorage.removeItem('supervisi_headmaster_profile');
                    localStorage.removeItem('ks_headmaster_profile');
                }

                return {
                    success: true,
                    user: sessionData,
                    role: u.role,
                    redirect: data.redirect || 'dashboard',
                    message: data.message || 'Login berhasil!'
                };
            } else {
                return {
                    success: false,
                    isGuru: !!data.isGuru,
                    message: data.error || data.message || 'Username atau kata sandi tidak valid!'
                };
            }
        } catch (err) {
            console.warn('[KS_AUTH] Gagal menghubungi backend API, mencoba autentikasi lokal:', err);
            
            // Offline fallback for default headmaster account
            const profile = this.getProfile();
            if (cleanU === profile.username && cleanP === profile.password) {
                const sessionData = {
                    id: 'usr-ks-001',
                    username: profile.username,
                    fullName: profile.fullName,
                    name: profile.fullName,
                    nickName: profile.nickName,
                    role: 'kepala_sekolah',
                    roleLabel: 'Kepala Sekolah',
                    school: profile.schoolName,
                    schoolName: profile.schoolName,
                    schoolCode: profile.schoolCode,
                    email: profile.email,
                    nip: profile.nip,
                    nuptk: profile.nuptk,
                    phone: profile.phone,
                    academicYear: profile.academicYear,
                    semester: profile.semester,
                    isLoggedIn: true,
                    loginTime: new Date().toISOString()
                };
                const offSessJson = JSON.stringify(sessionData);
                localStorage.setItem('supervisi_auth_session', offSessJson);
                localStorage.setItem('ks_auth_session', offSessJson);
                return { success: true, user: sessionData, role: 'kepala_sekolah', redirect: 'dashboard' };
            }

            return { success: false, message: 'Gagal terhubung ke server autentikasi: ' + err.message };
        }
    },

    async logout() {
        const token = localStorage.getItem('supervisi_auth_token') || localStorage.getItem('ks_auth_token');
        if (token) {
            try {
                await fetch(this.getBaseUrl() + 'api.php?action=logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
            } catch (e) {
                console.warn('Logout network error:', e);
            }
        }
        localStorage.removeItem('supervisi_auth_session');
        localStorage.removeItem('ks_auth_session');
        localStorage.removeItem('supervisi_auth_token');
        localStorage.removeItem('ks_auth_token');
        window.location.href = this.getHomeUrl();
    },

    /**
     * Standardized multi-tenant API fetch:
     * Automatically attaches Bearer token and active school_id
     */
    async fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('supervisi_auth_token') || localStorage.getItem('ks_auth_token') || this.getUser()?.token || '';
        const activeSid = this.getActiveSchoolId();
        
        const headers = { ...(options.headers || {}) };
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }
        
        let finalUrl = url;
        if (activeSid && !finalUrl.includes('school_id=')) {
            const sep = finalUrl.includes('?') ? '&' : '?';
            finalUrl += `${sep}school_id=${encodeURIComponent(activeSid)}`;
        }
        
        return fetch(finalUrl, { ...options, headers });
    },

    requireAuth(allowedRoles = null) {
        if (!this.isLoggedIn()) {
            const currentPath = window.location.pathname;
            let targetDest = 'dashboard';
            if (currentPath.includes('/evaluasi')) targetDest = 'evaluasi';
            else if (currentPath.includes('/observasi')) targetDest = 'observasi';
            else if (currentPath.includes('/karyawan')) targetDest = 'karyawan';
            else if (currentPath.includes('/guru')) targetDest = 'guru';
            else if (currentPath.includes('/admin')) targetDest = 'admin';

            window.location.href = this.getHomeUrl() + '?loginRequired=1&dest=' + targetDest;
            return null;
        }

        if (allowedRoles && !this.hasRole(allowedRoles)) {
            console.warn(`[RBAC] Akses ditolak untuk role '${this.getRole()}'. Hak akses dibutuhkan:`, allowedRoles);
            
            // Redirect smoothly to their authorized dashboard
            if (this.isGuru()) {
                window.location.href = this.getGuruUrl();
            } else if (this.isSuperAdmin()) {
                window.location.href = this.getAdminUrl();
            } else {
                window.location.href = this.getDashboardUrl();
            }
            return null;
        }

        return this.getUser();
    },

    async checkSession() {
        const token = localStorage.getItem('ks_auth_token');
        if (!token) return null;
        try {
            const res = await fetch(this.getBaseUrl() + 'api.php?action=check_session&token=' + encodeURIComponent(token));
            const data = await res.json();
            if (res.ok && data.success) {
                const u = data.user;
                const session = this.getUser() || {};
                const updatedSession = {
                    ...session,
                    ...u,
                    assignedSchools: data.assigned_schools || session.assignedSchools || []
                };
                const sessJson = JSON.stringify(updatedSession);
                localStorage.setItem('supervisi_auth_session', sessJson);
                localStorage.setItem('ks_auth_session', sessJson);
                return u;
            } else {
                // Token expired / revoked
                this.logout();
                return null;
            }
        } catch (e) {
            return null;
        }
    }
};

window.KS_AUTH = KS_AUTH;
window.SUPERVISI_AUTH = KS_AUTH;

// Automatically synchronize with server database on page load
// initServerSync is safe: it checks login status and role before making any API call
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => KS_AUTH.initServerSync());
    window.addEventListener('pageshow', (e) => {
        // Re-sync on bfcache restore (back/forward navigation)
        if (e.persisted) KS_AUTH.initServerSync();
    });
}

