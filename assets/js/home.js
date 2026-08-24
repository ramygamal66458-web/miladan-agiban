/* ═══════════════════════════════════════════════
   home.js — منطق الصفحة الرئيسية
   مؤتمر الشباب 2026
═══════════════════════════════════════════════ */
(async function () {
    'use strict';

    await YC.loadPartials();

    let program = [];
    try {
        if (typeof DataService !== 'undefined') {
            const data = await DataService.loadConference();
            program = (data && data.program) || [];
        }
    } catch (e) {
        console.warn('تعذر تحميل بيانات البرنامج في الصفحة الرئيسية:', e);
    }

    /* ─── 1. تحية ديناميكية ─── */
    var greetingEl = document.getElementById('main-greeting');
    var profile = JSON.parse(localStorage.getItem('yc2_user_profile') || 'null');
    if (greetingEl) {
        var hour = new Date().getHours();
        var greet = 'أهلاً بك في ميلادا عجيبًا ❤️';
        if      (hour >= 5  && hour < 12) greet = 'صباح الخير، منور المؤتمر ☀️';
        else if (hour >= 12 && hour < 17) greet = 'يومك سعيد، وقت مبارك 🌟';
        else if (hour >= 17 && hour < 22) greet = 'مساء النور، المؤتمر في انتظارك 🌙';
        else                              greet  = 'سهرة مباركة في ميلادا عجيبًا ✨';
        if (profile && profile.name) greet = 'مرحباً يا ' + profile.name.split(' ')[0] + ' 👋';
        greetingEl.textContent = greet;
    }

    /* ─── 2. شريط الفعالية الحية (مضغوط) ─── */
    function getDayDate(dayNum) {
        const year = 2026;
        const dates = {
            1: { d: 24, m: 8 },
            2: { d: 25, m: 8 },
            3: { d: 26, m: 8 }
        };
        const dt = dates[dayNum];
        if (!dt) return null;
        return new Date(year, dt.m - 1, dt.d);
    }

    function getConferenceState() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const day1Date = getDayDate(1);
        const day4Date = getDayDate(4);
        
        if (today < day1Date) {
            const diffTime = Math.abs(day1Date - today);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { status: 'before', daysRemaining: diffDays };
        } else if (today > day4Date) {
            return { status: 'after' };
        } else {
            for (let day = 1; day <= 3; day++) {
                const dDate = getDayDate(day);
                if (dDate && dDate.getTime() === today.getTime()) {
                    return { status: 'during', currentDay: day };
                }
            }
        }
        return { status: 'unknown' };
    }

    function updateLiveActivities() {
        var pill = document.getElementById('live-compact');
        if (!pill) return;

        const state = getConferenceState();

        if (state.status === 'before') {
            pill.style.display = 'flex';
            pill.className = "live-compact status-before";
            pill.innerHTML = `
                <div class="lc-countdown-wrapper">
                    <span class="lc-badge before"><i class="bi bi-calendar-event"></i> قريباً</span>
                    <span class="lc-title">ينطلق المؤتمر يوم 24 أغسطس 2026</span>
                    <span class="lc-time">باقي ${state.daysRemaining} يوم ⏳</span>
                </div>
            `;
            return;
        }

        if (state.status === 'after') {
            pill.style.display = 'flex';
            pill.className = "live-compact status-after";
            pill.innerHTML = `
                <div class="lc-countdown-wrapper">
                    <span class="lc-badge after"><i class="bi bi-check-circle"></i> ختام</span>
                    <span class="lc-title">انتهى المؤتمر بحمد الله 🕊️</span>
                    <span class="lc-time">نشوفكم في المؤتمر القادم!</span>
                </div>
            `;
            return;
        }

        if (program.length === 0) { pill.style.display = 'none'; return; }
        
        var now    = new Date();
        var nowMin = now.getHours() * 60 + now.getMinutes();
        var dayNum = state.currentDay || 1;

        var parseMin = function(t) {
            if (!t) return 0;
            var parts = t.split(':').map(Number);
            return parts[0] * 60 + parts[1];
        };

        var dayActs = program.filter(function(a) { return a.day === dayNum; });

        var currentAct = null, nextAct = null;
        for (var i = 0; i < dayActs.length; i++) {
            var a = dayActs[i];
            var s = parseMin(a.time);
            var e = parseMin(a.endTime || a.time);
            if (nowMin >= s && nowMin < e) { currentAct = a; nextAct = dayActs[i+1] || null; break; }
            else if (nowMin < s) { nextAct = a; break; }
        }

        if (!currentAct && !nextAct) { pill.style.display = 'none'; return; }
        pill.style.display = 'flex';
        pill.className = "live-compact status-during";

        var nowHtml = '';
        if (currentAct) {
            var rem = parseMin(currentAct.endTime) - nowMin;
            var remStr = rem > 0 ? 'متبقي ' + rem + ' د' : 'تنتهي الآن';
            nowHtml = `
                <div class="lc-section">
                    <span class="lc-badge now"><span class="blink-dot"></span> الآن</span>
                    <span class="lc-title">${currentAct.title}</span>
                    <span class="lc-time">${remStr}</span>
                </div>
            `;
        } else {
            nowHtml = `
                <div class="lc-section">
                    <span class="lc-badge now-free">🌴 وقت حر</span>
                    <span class="lc-title">وقت حر أو راحة</span>
                </div>
            `;
        }

        var nextHtml = '';
        if (nextAct) {
            var diff = parseMin(nextAct.time) - nowMin;
            var diffStr = diff > 0 ? 'بعد ' + diff + ' د' : 'قريباً';
            nextHtml = `
                <div class="lc-section next-section">
                    <span class="lc-badge next">بعد</span>
                    <span class="lc-title">${nextAct.title}</span>
                    <span class="lc-time">${diffStr}</span>
                </div>
            `;
        }

        pill.innerHTML = nowHtml + nextHtml;
    }

    updateLiveActivities();
    // حفظ مرجع الـ interval لإمكانية إلغائه
    let _liveInterval = setInterval(updateLiveActivities, 30000);

    // إيقاف التحديث عند إخفاء الصفحة وإعادته عند العودة لتوفير موارد المعالج
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            clearInterval(_liveInterval);
            _liveInterval = null;
        } else {
            updateLiveActivities(); // تحديث فوري عند العودة
            _liveInterval = setInterval(updateLiveActivities, 30000);
        }
    });

    /* ══════════════════════════════════════════════
       3. الدائرة التفاعلية
    ══════════════════════════════════════════════ */
    var dialWheel   = document.getElementById('dial-wheel');
    var dialNodes   = document.querySelectorAll('.dial-node');
    var dialDots    = document.querySelectorAll('.dial-dot');
    var dialWrapper = document.getElementById('dash-wheel-container');

    var nodeDetails = [
        { icon:'🎤', title:'المحاضرات الروحية',   desc:'محاضرات المؤتمر وأسئلة التحدي', href:'lectures.html' },
        { icon:'🛠', title:'ورش العمل',            desc:'ورش عملية وتفاعل جماعي', href:'workshops.html' },
        { icon:'🎵', title:'الألحان',             desc:'ألحان واستماع المؤتمر', href:'hymns.html' },
        { icon:'🎼', title:'لحن المؤتمر',          desc:'صورة اللحن والصوت والكلمات', href:'conference-hymn.html' },
        { icon:'🗓', title:'برنامج المؤتمر',       desc:'جدول أيام 24 و25 و26 أغسطس', href:'program.html' },
        { icon:'🛏', title:'التسكين والغرف',       desc:'توزيع الغرف والأسرّة', href:'accommodation.html' },
        { icon:'✨', title:'شعار المؤتمر',             desc:'الشعار وكلماته وترنيمته', href:'conference-hymn.html' },
        { icon:'🙏', title:'الصلوات',              desc:'صلوات ولقاءات روحية', href:'prayer.html' },
        { icon:'🎮', title:'الألعاب والمسابقات',  desc:'تحديات وألعاب المؤتمر', href:'games.html' },
        { icon:'💬', title:'شارك رأيك',            desc:'قولنا رأيك في المؤتمر', href:'feedback.html' },
        { icon:'👥', title:'المجموعات',            desc:'فريقك وترتيبه في المؤتمر', href:'groups.html' }
    ];

    var activeIndex     = 0;
    var isTransitioning = false;

    function navigateTo(href) {
        document.body.classList.add('page-transition-out');
        setTimeout(function() { window.location.href = href; }, 200);
    }

    /* ─── تحديث البادج ─── */
    function updateBadge(idx) {
        var nd  = nodeDetails[idx];
        var badge = document.getElementById('dial-active-badge');

        var setEl = function(id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setEl('dab-icon', nd.icon);
        setEl('dab-name', nd.title);
        setEl('dab-desc', nd.desc);

        if (badge) {
            badge.dataset.href = nd.href;
            badge.classList.remove('changing');
            requestAnimationFrame(function() {
                badge.classList.add('changing');
            });
        }
    }

    function rotateDialTo(index, instant) {
        if (isTransitioning && !instant) return;
        activeIndex = ((index % 11) + 11) % 11;

        var rotation = -90 - (activeIndex * (360 / 11));
        var ease     = 'transform 0.75s cubic-bezier(0.16, 1, 0.3, 1)';

        if (dialWheel) {
            dialWheel.style.transition = instant ? 'none' : ease;
            dialWheel.style.transform  = 'rotate(' + rotation + 'deg)';
        }

        dialNodes.forEach(function(node, idx) {
            node.classList.toggle('active', idx === activeIndex);
        });

        dialDots.forEach(function(dot, i) {
            dot.classList.toggle('active', i === activeIndex);
        });

        if (!instant) updateBadge(activeIndex);

        if (!instant) {
            isTransitioning = true;
            setTimeout(function() { isTransitioning = false; }, 480);
        }
    }

    /* ─── نقر على عقدة ─── */
    dialNodes.forEach(function(node, idx) {
        node.addEventListener('click', function() {
            if (idx === activeIndex) {
                navigateTo(node.dataset.href);
            } else {
                rotateDialTo(idx);
            }
        });
    });

    /* ─── نقر على البادج → دخول مباشر ─── */
    var badge = document.getElementById('dial-active-badge');
    if (badge) {
        badge.addEventListener('click', function() {
            navigateTo(nodeDetails[activeIndex].href);
        });
        badge.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateTo(nodeDetails[activeIndex].href);
            }
        });
    }

    /* ─── أزرار التنقل (أعلى / أسفل) ─── */
    var btnUp   = document.getElementById('dial-btn-up');
    var btnDown = document.getElementById('dial-btn-down');
    if (btnUp)   btnUp.addEventListener('click',   function() { if (!isTransitioning) rotateDialTo(activeIndex - 1); });
    if (btnDown) btnDown.addEventListener('click',  function() { if (!isTransitioning) rotateDialTo(activeIndex + 1); });

    /* ─── نقاط المؤشر ─── */
    dialDots.forEach(function(dot) {
        dot.addEventListener('click', function() {
            rotateDialTo(parseInt(this.dataset.index));
        });
    });

    /* ─── عجلة الماوس ─── */
    if (dialWrapper) {
        dialWrapper.addEventListener('wheel', function(e) {
            e.preventDefault();
            if (!isTransitioning) rotateDialTo(activeIndex + (e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
    }

    /* ─── سحب اللمس ─── */
    var tX = 0, tY = 0;
    if (dialWrapper) {
        dialWrapper.addEventListener('touchstart', function(e) {
            if (!e.touches.length) return;
            tX = e.touches[0].clientX;
            tY = e.touches[0].clientY;
        }, { passive: true });

        dialWrapper.addEventListener('touchmove', function(e) {
            if (isTransitioning || !e.touches.length) return;
            var dx = e.touches[0].clientX - tX;
            var dy = e.touches[0].clientY - tY;
            /* السحب العمودي يدور الدائرة */
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 25) {
                rotateDialTo(activeIndex + (dy > 0 ? 1 : -1));
                tX = e.touches[0].clientX;
                tY = e.touches[0].clientY;
            } else if (Math.abs(dx) > 28) {
                rotateDialTo(activeIndex + (dx > 0 ? -1 : 1));
                tX = e.touches[0].clientX;
                tY = e.touches[0].clientY;
            }
        }, { passive: true });
    }

    /* ─── تلميح السحب (يظهر مرة واحدة) ─── */
    if (!localStorage.getItem('yc2_hint_seen')) {
        var hint = document.querySelector('.dial-swipe-hint');
        if (hint) {
            setTimeout(function() { hint.classList.add('visible'); }, 1500);
            setTimeout(function() {
                hint.classList.remove('visible');
                localStorage.setItem('yc2_hint_seen', '1');
            }, 5000);
        }
    }

    /* ─── الحالة الابتدائية ─── */
    rotateDialTo(0, true);
    updateBadge(0);

})();
