/* =====================================================
   core.js — مؤتمر الشباب 2.0
   الدوال المشتركة لجميع الصفحات
   ===================================================== */

'use strict';

// تحميل ملفات الخدمات والخلفية ثلاثية الأبعاد ديناميكياً لتسريع استجابة وفتح الموقع
(function() {
    const prefix = location.pathname.includes('/pages/') ? '../' : '';
    
    // 1. تحميل config.js أولاً (يُضبط YC_CONFIG قبل DataService)
    if (!window.YC_CONFIG) {
        var cfg = document.createElement('script');
        cfg.src = prefix + 'assets/js/config.js?v=2026.07.31';
        cfg.async = false;
        cfg.defer = false;
        document.head ? document.head.appendChild(cfg) : document.write('<script src="' + cfg.src + '"><\/script>');
    }

    // 2. تحميل DataService (يقرأ YC_CONFIG عند التهيئة)
    if (!window.DataService) {
        var s = document.createElement('script');
        s.src = prefix + 'assets/js/data-service.js?v=2.8';
        s.async = false;
        s.defer = false;
        document.head ? document.head.appendChild(s) : document.write('<script src="' + s.src + '"><\/script>');
    }

    // ملاحظة: bg-3d.js لا يُحمَّل هنا — كل صفحة تحمّله مباشرةً بـ defer
    // لتجنب إرسال طلب شبكة مكرر
})();

/* ─── 1. حقن Partials ─────────────────────────────── */
async function loadPartials() {
    const prefix = location.pathname.includes('/pages/') ? '../' : '';
    const slots = [
        { id: 'app-navbar-slot',    file: prefix + 'partials/navbar.html' },
        { id: 'app-bottomnav-slot', file: prefix + 'partials/bottom-nav.html' }
    ];

    await Promise.all(slots.map(async ({ id, file }) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.children.length > 0) return;
        try {
            const cacheKey = 'partial_' + file;
            let html = sessionStorage.getItem(cacheKey);
            if (!html) {
                const res = await fetch(file);
                if (!res.ok) throw new Error(res.status);
                html = await res.text();
                sessionStorage.setItem(cacheKey, html);
            }
            el.innerHTML = html;
        } catch (e) {
            console.warn('loadPartials: فشل تحميل', file, e);
        }
    }));

    _fixPartialLinks();
    _highlightActiveTab();
    _setupBackButton();
    _setupDrawerNavigation();
}

function _fixPartialLinks() {
    const isPagesDir = location.pathname.includes('/pages/');
    const pageNavLinks = document.querySelectorAll('#app-navbar-slot a, #app-bottomnav-slot a, #nav-menu-overlay a');
    pageNavLinks.forEach(link => {
        let href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript')) return;
        
        const cleanHref = href.replace(/^(\.\.\/|pages\/)/, '');
        const isRootFile = (cleanHref === 'manage-passengers.html' || cleanHref === 'admin.html' || cleanHref === 'group-evaluation.html' || cleanHref === 'index.html');

        if (isPagesDir) {
            if (isRootFile) {
                link.setAttribute('href', '../' + cleanHref);
            } else {
                link.setAttribute('href', cleanHref);
            }
        } else {
            if (isRootFile) {
                link.setAttribute('href', cleanHref);
            } else {
                link.setAttribute('href', 'pages/' + cleanHref);
            }
        }
    });
}

function _setupDrawerNavigation() {
    const menuBtn = document.getElementById('nav-menu-btn');
    const closeBtn = document.getElementById('nav-overlay-close');
    const overlay = document.getElementById('nav-menu-overlay');

    if (!menuBtn || !overlay) return;

    function openOverlay() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeOverlay() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', openOverlay);
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

    overlay.querySelectorAll('.menu-item-card').forEach(item => {
        item.addEventListener('click', closeOverlay);
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeOverlay();
        }
    });
}

function _setupBackButton() {
    const path = location.pathname;
    const page = path.split('/').pop() || 'home.html';
    if (page !== 'home.html' && page !== 'index.html') {
        const backBtn = document.getElementById('nav-back-btn');
        if (backBtn) {
            backBtn.style.display = 'flex';
            backBtn.href = 'home.html';
        }
    }
}



function _highlightActiveTab() {
    const path = location.pathname;
    const map = {
        'home.html':             'home',
        'program.html':          'program',
        'groups.html':           'groups',
        'prayer.html':           'prayer',
        'prayer-morning.html':   'prayer',
        'prayer-night.html':     'prayer',
        'games.html':            'more',
        'lectures.html':         'more',
        'workshops.html':        'more',
        'hymns.html':            'more',
        'accommodation.html':    'more',
    };

    const page = path.split('/').pop() || 'home.html';
    const active = map[page];
    if (!active) return;

    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === active);
    });
}

/* ─── 2. تطبيع النصوص العربية ────────────────────── */
function normalizeArabic(text) {
    if (!text) return '';
    return text
        .replace(/أ|إ|آ/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/* ─── 3. مكوّن بحث قابل لإعادة الاستخدام ─────────── */
function createSearchWidget(config) {
    /*
     * config = {
     *   inputEl:    HTMLInputElement,
     *   data:       Array,
     *   matchField: string | string[],   // حقل/حقول للبحث
     *   onResult:   function(results),   // callback بالنتائج
     *   onEmpty:    function(),           // callback عند لا نتيجة
     * }
     */
    if (!config || !config.inputEl || !config.data) return;

    const { inputEl, data, onResult, onEmpty } = config;
    const fields = Array.isArray(config.matchField) ? config.matchField : [config.matchField];

    inputEl.addEventListener('input', function () {
        const q = normalizeArabic(this.value);
        if (!q) { if (onResult) onResult(data); return; }

        const results = data.filter(item =>
            fields.some(f => normalizeArabic(String(item[f] ?? '')).includes(q))
        );

        if (results.length === 0 && onEmpty) onEmpty();
        else if (onResult) onResult(results);
    });
}

/* ─── 4. التحكم بحجم الخط ────────────────────────── */
const FontSizeControl = {
    STORAGE_KEY: 'yc2_reading_font_scale',
    STEPS:  [0.85, 1.0, 1.15, 1.3],
    _idx:   1,

    init(targetSelector = 'body') {
        this._target = document.querySelector(targetSelector) || document.body;
        const saved = parseFloat(localStorage.getItem(this.STORAGE_KEY));
        if (!isNaN(saved)) {
            const idx = this.STEPS.indexOf(saved);
            if (idx !== -1) this._idx = idx;
        }
        this._apply();
    },

    _apply() {
        const scale = this.STEPS[this._idx];
        this._target.style.setProperty('--reading-scale', scale);
        localStorage.setItem(this.STORAGE_KEY, scale);
    },

    increase() {
        if (this._idx < this.STEPS.length - 1) { this._idx++; this._apply(); }
    },

    decrease() {
        if (this._idx > 0) { this._idx--; this._apply(); }
    },

    current() { return this.STEPS[this._idx]; }
};

/* ─── 5. وضع القراءة المريحة ─────────────────────── */
const ReadingModeToggle = {
    STORAGE_KEY: 'yc2_reading_mode_enabled',

    init() {
        const enabled = localStorage.getItem(this.STORAGE_KEY) === 'true';
        document.body.classList.toggle('reading-mode', enabled);
        this._updateBtn(enabled);
    },

    toggle() {
        const enabled = document.body.classList.toggle('reading-mode');
        localStorage.setItem(this.STORAGE_KEY, enabled);
        this._updateBtn(enabled);
        return enabled;
    },

    _updateBtn(enabled) {
        const btns = document.querySelectorAll('[data-reading-toggle]');
        btns.forEach(btn => {
            btn.classList.toggle('active', enabled);
            btn.setAttribute('aria-pressed', enabled);
            const icon = btn.querySelector('i');
            if (icon) {
                icon.className = enabled ? 'bi bi-moon-stars-fill' : 'bi bi-moon-stars';
            }
        });
    }
};

/* ─── 6. إدارة المفضلة (مع in-memory cache) ─── */
const FavoritesManager = {
    STORAGE_KEY: 'yc2_favorite_hymns',
    _cache: null,   // تخزين في الذاكرة لتجنب قراءة localStorage في كل مرة

    _load() {
        if (this._cache !== null) return this._cache;
        try { this._cache = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
        catch { this._cache = []; }
        return this._cache;
    },

    _save(list) {
        this._cache = list;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    },

    isFavorite(id) { return this._load().indexOf(id) > -1; },

    toggle(id) {
        let list = this._load().slice();  // clone
        const idx = list.indexOf(id);
        if (idx > -1) list.splice(idx, 1);
        else list.push(id);
        this._save(list);
        return list.indexOf(id) > -1;
    },

    getAll() { return this._load().slice(); }
};


/* ─── 7. حفظ موضع القراءة ────────────────────────── */
const ScrollPositionSaver = {
    _KEY: (pageId) => `yc2_scroll_pos_${pageId}`,
    _timer: null,

    save(pageId) {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            localStorage.setItem(this._KEY(pageId), window.scrollY);
        }, 500);
    },

    restore(pageId, options = {}) {
        const pos = parseInt(localStorage.getItem(this._KEY(pageId)));
        if (!pos || pos < 200) return; // لا قيمة أو في الأعلى أصلاً

        const { prompt = true, threshold = 200 } = options;
        // استعادة الموضع بدون إزعاج المستخدم
        if (!prompt) { window.scrollTo({ top: pos, behavior: 'smooth' }); return; }

        // استعادة تلقائية صامتة بدل window.confirm (كان يُوقف Main Thread)
        window.scrollTo({ top: pos, behavior: 'smooth' });
    },

    startAutoSave(pageId) {
        window.addEventListener('scroll', () => this.save(pageId), { passive: true });
    }
};

/* ─── 8. تمييز النشاط الحالي في الجدول ──────────── */
function highlightCurrentActivity(programArray, options = {}) {
    /*
     * programArray: مصفوفة أنشطة كل منها { time, endTime, id, ... }
     * options: { currentDay } الفهرس الرقمي لليوم الفعلي للمؤتمر (1, 2, 3, 4)
     */
    if (!Array.isArray(programArray)) return null;

    const now   = new Date();
    const toMin = (str) => {
        if (!str) return null;
        const [h, m] = str.split(':').map(Number);
        return h * 60 + m;
    };
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let current = null;
    const currentDay = options.currentDay; // يمكن أن يكون 1، 2، 3، 4، أو null إذا كنا خارج فترة المؤتمر

    programArray.forEach(activity => {
        const start = toMin(activity.time);
        const end   = toMin(activity.endTime);
        if (start === null) return;

        // التحقق مما إذا كان النشاط ينتمي لليوم الحالي الفعلي للمؤتمر
        // إذا لم يتم تمرير currentDay، نعتبر كل الأيام متاحة (لأغراض التطوير أو التوافق)
        const isTargetDay = currentDay !== undefined ? (activity.day === currentDay) : true;

        const isNow = isTargetDay && (end !== null
            ? (nowMin >= start && nowMin < end)
            : (nowMin >= start && nowMin < start + 60));

        const el = document.getElementById(activity.id);
        if (el) {
            el.classList.toggle('activity-now', isNow);
            el.classList.toggle('activity-past', isTargetDay && !isNow && nowMin >= (end ?? start + 60));
        }

        if (isNow) current = activity;
    });

    // تمرير للنشاط الحالي
    if (current) {
        const el = document.getElementById(current.id);
        if (el) {
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
        }
    }

    return current;
}

/* ─── Exports (للاستخدام في الصفحات) ──────────────── */
window.YC = {
    loadPartials,
    normalizeArabic,
    createSearchWidget,
    FontSizeControl,
    ReadingModeToggle,
    FavoritesManager,
    ScrollPositionSaver,
    highlightCurrentActivity,
    loadConferenceData,
    renderEmptyState,
    searchParticipant
};

/* ─── 5. نظام تحميل وإدارة بيانات المؤتمر الموحّد ──── */
let cachedConferenceDataPromise = null;

function loadLoadingOverlay() {
    if (document.getElementById('app-loading-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'app-loading-overlay';
    overlay.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.85);z-index:9999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(8px);transition:opacity 0.3s;';
    overlay.innerHTML = `
        <div style="text-align:center;">
            <div class="spinner-border" style="color:#06b6d4;width:3rem;height:3rem;" role="status"></div>
            <div style="margin-top:15px;color:#f8fafc;font-weight:600;font-size:0.95rem;">جاري تحميل بيانات المؤتمر...</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('app-loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }
}

function showConferenceErrorState(message) {
    hideLoadingOverlay();
    const errorDiv = document.createElement('div');
    errorDiv.style = 'position:fixed;top:20px;left:20px;right:20px;background:rgba(239,68,68,0.95);color:#fff;padding:16px;border-radius:12px;z-index:10000;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.45);backdrop-filter:blur(4px);direction:rtl;';
    errorDiv.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px;font-size:1.05rem;">⚠️ تعذر تحميل بيانات المؤتمر</div>
        <div style="font-size:0.85rem;opacity:0.9;">${message}</div>
        <button onclick="location.reload()" style="margin-top:12px;background:#fff;color:#ef4444;border:none;padding:6px 20px;border-radius:8px;font-weight:700;font-size:0.8rem;cursor:pointer;box-shadow:0 3px 6px rgba(0,0,0,0.15);">إعادة المحاولة</button>
    `;
    document.body.appendChild(errorDiv);
}

function loadConferenceData() {
    if (window.DataService) {
        loadLoadingOverlay();
        return window.DataService.loadConference()
            .then(data => {
                hideLoadingOverlay();
                return data;
            })
            .catch(err => {
                showConferenceErrorState(err.message || 'خطأ في الشبكة أو ملف تالف');
                throw err;
            });
    }
}

function renderEmptyState(container, message = "لا توجد بيانات بعد") {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    el.innerHTML = `
        <div style="text-align:center;padding:50px 20px;color:#94a3b8;font-size:0.9rem;">
            <i class="bi bi-inbox" style="font-size:2.5rem;display:block;margin-bottom:12px;color:rgba(255,255,255,0.12)"></i>
            ${message}
        </div>
    `;
}

function searchParticipant(query) {
    if (!window.conferenceData || !window.conferenceData.participants) return [];
    const normalizedQuery = YC.normalizeArabic(query.trim());
    if (!normalizedQuery) return [];

    return window.conferenceData.participants.filter(p => 
        YC.normalizeArabic(p.name).includes(normalizedQuery)
    ).map(p => {
        const room = window.conferenceData.rooms.find(r => r.id === p.roomId);
        const bus = window.conferenceData.buses.find(b => b.busNumber === p.busNumber);
        const group = window.conferenceData.groups.find(g => g.id === p.groupId);

        return {
            id: p.id,
            name: p.name,
            groupName: group ? group.name : '—',
            roomName: room ? room.name : '—',
            floor: room ? room.floor : null,
            bedNumber: p.bedNumber,
            busNumber: p.busNumber,
            seatNumber: p.seatNumber,
            supervisorName: bus ? bus.supervisorName : '—'
        };
    });
}

// إزالة كلاسات الانتقال للخارج والتحميل عند استعادة الصفحة من ذاكرة المتصفح الخلفية (bfcache) لتجنب الشاشة الفارغة
window.addEventListener('pageshow', (event) => {
    document.body.classList.remove('page-transition-out');
    document.body.classList.remove('page-exit');
    
    document.body.classList.add('page-transition-in');
    setTimeout(() => {
        document.body.classList.remove('page-transition-in');
    }, 150);
});

document.addEventListener('DOMContentLoaded', () => {

    document.body.classList.add('page-transition-in');
    setTimeout(() => {
        document.body.classList.remove('page-transition-in');
    }, 150); // تقليص وقت الدخول من 300ms إلى 150ms لتسريع التفاعل

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link || link.target === '_blank') return;
        
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
        
        e.preventDefault();
        document.body.classList.add('page-transition-out');
        setTimeout(() => {
            window.location.href = href;
        }, 80); // تقليص وقت الخروج من 200ms إلى 80ms لتسريع الانتقال الفعلي
    });

    // جلب الصفحات مسبقاً (Prefetch) عند التحويم أو اللمس لتوفير زمن استجابة الشبكة بالكامل على GitHub Pages
    setupLinkPrefetch();
});

function setupLinkPrefetch() {
    const prefetchMap = new Set();
    const prefetch = (url) => {
        if (prefetchMap.has(url)) return;
        prefetchMap.add(url);
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    };

    // التحويم للفأرة (أجهزة المكتب)
    document.addEventListener('mouseover', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('tel') && !href.startsWith('mailto')) {
            prefetch(href);
        }
    });

    // اللمس بالأصابع (أجهزة الموبايل)
    document.addEventListener('touchstart', (e) => {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('tel') && !href.startsWith('mailto')) {
            prefetch(href);
        }
    }, { passive: true });
}
