/* =====================================================
   identity.js — هوية المشارك طوال المؤتمر
   يحفظ اسم المشارك ومجموعته وغرفته محلياً ويعرضها في كل صفحات الموقع.
   ===================================================== */
(function () {
    'use strict';

    const STORAGE_KEY = 'yc_participant_profile_v1';
    const DATA_URL = (location.pathname.includes('/pages/') ? '../' : '') + 'assets/data/conference-data.json';

    function normalize(text) {
        return String(text || '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/ـ/g, '')
            .replace(/[\u064B-\u065F]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function readProfile() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const p = JSON.parse(raw);
            return p && p.name ? p : null;
        } catch (_) { return null; }
    }

    function saveProfile(profile) {
        const clean = {
            id: profile.id || '',
            name: String(profile.name || '').trim(),
            group: profile.group || '',
            groupId: profile.groupId || '',
            room: profile.room || '',
            roomName: profile.roomName || (profile.room ? 'غرفة ' + profile.room : ''),
            floor: profile.floor ?? null,
            busNumber: profile.busNumber ?? null,
            seatNumber: profile.seatNumber ?? null,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
        return clean;
    }

    function clearProfile() {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('entered');
    }

    async function loadLocalData() {
        const res = await fetch(DATA_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('local conference data ' + res.status);
        return await res.json();
    }

    function buildLocalProfiles(data) {
        const map = new Map();
        const groups = Array.isArray(data.groups) ? data.groups : [];
        const rooms = Array.isArray(data.rooms) ? data.rooms : [];

        const roomByPerson = new Map();
        rooms.forEach(room => {
            (room.persons || []).forEach(name => {
                const key = normalize(name);
                if (!key) return;
                roomByPerson.set(key, {
                    room: String(room.name || '').match(/\d+/)?.[0] || '',
                    roomName: room.name || '',
                    floor: room.floor ?? null
                });
            });
        });

        groups.forEach(group => {
            (group.members || []).forEach(name => {
                const key = normalize(name);
                if (!key) return;
                const room = roomByPerson.get(key) || {};
                const existing = map.get(key) || {};
                map.set(key, {
                    id: existing.id || ('local-' + key),
                    name: existing.name || String(name).trim(),
                    group: group.name || existing.group || '',
                    groupId: group.id || existing.groupId || '',
                    ...existing,
                    ...room,
                    group: group.name || existing.group || '',
                    groupId: group.id || existing.groupId || ''
                });
            });
        });

        // بعض الأسماء قد تكون موجودة في التسكين فقط؛ نضيفها حتى لا يضيع البحث.
        roomByPerson.forEach((room, key) => {
            if (!map.has(key)) {
                map.set(key, {
                    id: 'local-' + key,
                    name: key,
                    ...room,
                    group: '',
                    groupId: ''
                });
            }
        });

        return Array.from(map.values());
    }

    function mergeRemoteProfiles(localProfiles, participants) {
        const map = new Map(localProfiles.map(p => [normalize(p.name), { ...p }]));
        (participants || []).forEach(p => {
            if (!p || !p.name) return;
            const key = normalize(p.name);
            const base = map.get(key) || { id: p.id || ('remote-' + key), name: p.name.trim() };
            map.set(key, {
                ...base,
                id: p.id || base.id,
                name: p.name.trim() || base.name,
                group: p.group || base.group || '',
                groupId: p.groupId || base.groupId || '',
                room: p.room || base.room || '',
                roomName: p.room ? ('غرفة ' + String(p.room).replace(/^غرفة\s*/i, '')) : (base.roomName || ''),
                floor: p.floor ?? base.floor ?? null,
                busNumber: p.busNumber ?? base.busNumber ?? null,
                seatNumber: p.seatNumber ?? base.seatNumber ?? null
            });
        });
        return Array.from(map.values());
    }

    function formatRoom(profile) {
        if (profile.roomName) return profile.roomName;
        if (profile.room) return 'غرفة ' + profile.room;
        return 'غير محددة';
    }

    function profileDetailsHTML(profile) {
        const group = profile.group || 'غير محددة';
        const room = formatRoom(profile);
        const floor = profile.floor != null ? 'الدور ' + profile.floor : 'الدور غير محدد';
        const bus = profile.busNumber ? 'أتوبيس ' + profile.busNumber : '';
        return `
            <div class="yc-profile-name"><i class="bi bi-person-fill"></i><span>${escapeHTML(profile.name)}</span></div>
            <div class="yc-profile-chips">
                <span><i class="bi bi-people-fill"></i>${escapeHTML(group)}</span>
                <span><i class="bi bi-door-closed-fill"></i>${escapeHTML(room)}</span>
                <span><i class="bi bi-building"></i>${escapeHTML(floor)}</span>
                ${bus ? `<span><i class="bi bi-bus-front-fill"></i>${escapeHTML(bus)}</span>` : ''}
            </div>`;
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    }

    function injectIdentityBar() {
        if (document.getElementById('yc-identity-bar')) return;
        const slot = document.getElementById('app-navbar-slot');
        const nav = slot || document.querySelector('nav.app-navbar, body > nav, body nav');
        if (!nav) return;
        const profile = readProfile();
        const bar = document.createElement('div');
        bar.id = 'yc-identity-bar';
        bar.className = 'yc-identity-bar';
        bar.innerHTML = profile ? `
            <div class="yc-identity-inner">
                <div class="yc-identity-summary">${profileDetailsHTML(profile)}</div>
                <button type="button" class="yc-identity-change" id="yc-identity-change" title="تغيير بياناتك">
                    <i class="bi bi-pencil-square"></i><span>تغيير</span>
                </button>
            </div>` : `
            <div class="yc-identity-inner yc-identity-empty">
                <span><i class="bi bi-person-badge"></i> لم تحدد بياناتك بعد</span>
                <a href="${location.pathname.includes('/pages/') ? '../index.html' : 'index.html'}" class="yc-identity-change"><i class="bi bi-search"></i> حدد بياناتك</a>
            </div>`;
        nav.insertAdjacentElement('afterend', bar);
        const change = document.getElementById('yc-identity-change');
        if (change && profile) {
            change.addEventListener('click', () => {
                if (confirm('هل تريد تغيير الاسم والبيانات المحفوظة؟')) {
                    clearProfile();
                    window.location.href = location.pathname.includes('/pages/') ? '../index.html?change=1' : 'index.html?change=1';
                }
            });
        }
    }

    async function refreshProfileFromRemote() {
        if (!window.DataService) return;
        try {
            const data = await window.DataService.loadConference();
            const current = readProfile();
            if (!current || !Array.isArray(data.participants)) return;
            const key = normalize(current.name);
            const remote = data.participants.find(p => normalize(p.name) === key);
            if (!remote) return;
            const updated = saveProfile({
                ...current,
                name: remote.name || current.name,
                group: remote.group || current.group,
                groupId: remote.groupId || current.groupId,
                room: remote.room || current.room,
                roomName: remote.room ? 'غرفة ' + String(remote.room).replace(/^غرفة\s*/i, '') : current.roomName,
                floor: remote.floor ?? current.floor,
                busNumber: remote.busNumber ?? current.busNumber,
                seatNumber: remote.seatNumber ?? current.seatNumber
            });
            const bar = document.getElementById('yc-identity-bar');
            if (bar && updated) {
                const summary = bar.querySelector('.yc-identity-summary');
                if (summary) summary.innerHTML = profileDetailsHTML(updated);
            }
        } catch (err) {
            // لا نُظهر خطأ للمستخدم؛ البيانات المحلية تكفي للعرض.
            console.warn('Identity remote refresh skipped:', err.message);
        }
    }

    async function initBar() {
        if (location.pathname.endsWith('/index.html') || location.pathname === '/' || location.pathname.endsWith('/')) return;
        if (!document.getElementById('app-navbar-slot') && !document.querySelector('nav.app-navbar, body > nav, body nav')) return;
        injectIdentityBar();
        if (readProfile()) refreshProfileFromRemote();
    }

    async function getSearchProfiles() {
        let local = [];
        try { local = buildLocalProfiles(await loadLocalData()); } catch (e) { console.warn('Identity local data:', e); }

        // مهم: في شاشة الدخول نحتاج الأسماء الحقيقية من Google Sheets قبل إتاحة البحث.
        // لو الاتصال فشل، نرجع للبيانات المحلية بدل تعطيل الموقع بالكامل.
        if (window.DataService) {
            try {
                const data = await window.DataService.loadConference(true);
                const merged = mergeRemoteProfiles(local, data.participants || []);
                if (merged.length) return merged;
            } catch (e) {
                console.warn('Identity remote data unavailable:', e.message);
            }
        }
        return local;
    }

    function initWelcomeSearch() {
        const input = document.getElementById('participant-name-search');
        const results = document.getElementById('participant-search-results');
        const selected = document.getElementById('participant-selected');
        const continueBtn = document.getElementById('participant-confirm-btn');
        if (!input || !results || !selected || !continueBtn) return;

        let profiles = [];
        let selectedProfile = null;
        let timer = null;

        function renderResults(items) {
            if (!items.length) {
                results.innerHTML = '<div class="yc-search-empty"><i class="bi bi-person-x"></i> الاسم مش موجود عندنا. جرّب تكتبه بطريقة تانية.</div>';
                return;
            }
            results.innerHTML = items.slice(0, 8).map((p, idx) => `
                <button type="button" class="yc-search-result" data-index="${idx}">
                    <span class="yc-search-result-name"><i class="bi bi-person-fill"></i>${escapeHTML(p.name)}</span>
                    <span class="yc-search-result-meta">${p.group ? escapeHTML(p.group) : 'المجموعة غير محددة'}${p.room ? ' • ' + escapeHTML(formatRoom(p)) : ''}</span>
                </button>`).join('');
            results.querySelectorAll('.yc-search-result').forEach(btn => {
                btn.addEventListener('click', () => selectProfile(items[Number(btn.dataset.index)]));
            });
        }

        function selectProfile(profile) {
            selectedProfile = profile;
            input.value = profile.name;
            results.innerHTML = '';
            selected.classList.add('show');
            selected.innerHTML = `
                <div class="yc-selected-title"><i class="bi bi-patch-check-fill"></i> دي بياناتك</div>
                <div class="yc-selected-name">${escapeHTML(profile.name)}</div>
                <div class="yc-selected-grid">
                    <div><small>المجموعة</small><strong>${escapeHTML(profile.group || 'غير محددة')}</strong></div>
                    <div><small>الأوضة</small><strong>${escapeHTML(formatRoom(profile))}</strong></div>
                    <div><small>الدور</small><strong>${profile.floor != null ? escapeHTML(profile.floor) : 'غير محدد'}</strong></div>
                </div>`;
            continueBtn.disabled = false;
            continueBtn.classList.add('ready');
        }

        input.addEventListener('input', () => {
            selectedProfile = null;
            selected.classList.remove('show');
            continueBtn.disabled = true;
            continueBtn.classList.remove('ready');
            clearTimeout(timer);
            const q = normalize(input.value);
            if (q.length < 2) { results.innerHTML = ''; return; }
            const matches = profiles.filter(p => normalize(p.name).includes(q));
            renderResults(matches);
        });

        continueBtn.addEventListener('click', () => {
            if (!selectedProfile) return;
            saveProfile(selectedProfile);
            sessionStorage.setItem('entered', 'true');
            continueBtn.classList.add('loading');
            setTimeout(() => { window.location.href = 'pages/home.html'; }, 250);
        });

        getSearchProfiles().then(data => {
            profiles = data;
            input.disabled = false;
            input.placeholder = 'اكتب اسمك هنا...';
            const prefill = new URLSearchParams(location.search).get('name');
            if (prefill) {
                input.value = prefill;
                input.dispatchEvent(new Event('input'));
            }
        }).catch(() => {
            input.disabled = false;
            results.innerHTML = '<div class="yc-search-empty"><i class="bi bi-exclamation-triangle"></i> حصلت مشكلة في تحميل الأسماء. جرّب تحديث الصفحة.</div>';
        });

        window.addEventListener('yc:profiles-ready', event => {
            if (Array.isArray(event.detail)) profiles = event.detail;
            if (normalize(input.value).length >= 2) {
                const q = normalize(input.value);
                renderResults(profiles.filter(p => normalize(p.name).includes(q)));
            }
        });
    }

    window.YCIdentity = {
        STORAGE_KEY,
        readProfile,
        saveProfile,
        clearProfile,
        normalize,
        initBar,
        initWelcomeSearch,
        getSearchProfiles
    };

    document.addEventListener('DOMContentLoaded', () => {
        // index.html: البحث الخاص ببداية الرحلة.
        initWelcomeSearch();
        // باقي الصفحات: شريط الهوية.
        initBar();
        const slot = document.getElementById('app-navbar-slot');
        if (slot && !document.getElementById('yc-identity-bar')) {
            const observer = new MutationObserver(() => {
                if (document.getElementById('app-navbar-slot')?.children.length) {
                    injectIdentityBar();
                    observer.disconnect();
                    if (readProfile()) refreshProfileFromRemote();
                }
            });
            observer.observe(slot, { childList: true });
            setTimeout(() => observer.disconnect(), 8000);
        }
    });
})();
