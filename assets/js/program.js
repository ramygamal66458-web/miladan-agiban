/* program.js — منطق عرض البرنامج والتايم لاين المطور (v2.1) */
(function () {
    'use strict';

    const TYPE_ICONS = {
        prayer:   { icon: 'bi bi-book-fill',          color: 'var(--gold-light)' },
        lecture:  { icon: 'bi bi-mic-fill',            color: '#34d399' },
        workshop: { icon: 'bi bi-tools',               color: '#fb7185' },
        meal:     { icon: 'bi bi-cup-hot-fill',        color: '#fbbf24' },
        free:     { icon: 'bi bi-emoji-smile-fill',    color: '#818cf8' },
        travel:   { icon: 'bi bi-bus-front-fill',      color: 'var(--primary-light)' },
        other:    { icon: 'bi bi-circle-fill',         color: 'var(--text-muted)' }
    };

    let currentActivity = null;
    let activeFilter = 'all';
    let selectedDay = '1';
    let program = [];
    let currentConferenceDay = null;
    let dataMeta = null;

    /* ─── ذاكرة مؤقتة للنجمات (تُجنّب تكرار JSON.parse في كل بطاقة) ─── */
    let _starredCache = null;
    function getStarred() {
        if (_starredCache) return _starredCache;
        try { _starredCache = new Set(JSON.parse(localStorage.getItem('yc2_starred_activities') || '[]')); }
        catch(e) { _starredCache = new Set(); }
        return _starredCache;
    }
    function saveStarred(set) {
        _starredCache = set;
        localStorage.setItem('yc2_starred_activities', JSON.stringify([...set]));
    }

    function formatArabicTimeSingle(timeStr) {
        if (!timeStr) return '';
        const parts = timeStr.split(':');
        if (parts.length !== 2) return timeStr;
        
        let h = parseInt(parts[0]);
        const m = parts[1];
        const origH = h;
        
        if (h > 12) {
            h -= 12;
        } else if (h === 0) {
            h = 12;
        }
        
        let suffix = 'ص';
        if (origH >= 12 && origH < 14) suffix = 'ظ';
        else if (origH >= 14) suffix = 'م';
        
        return `${h}:${m} ${suffix}`;
    }

    function formatArabicTimeRange(startTime, endTime) {
        const formatTime = (timeStr) => {
            if (!timeStr) return null;
            const parts = timeStr.split(':');
            if (parts.length !== 2) return null;
            
            let h = parseInt(parts[0]);
            const m = parts[1];
            const origH = h;
            
            if (h > 12) {
                h -= 12;
            } else if (h === 0) {
                h = 12;
            }
            
            let suffix = 'ص';
            if (origH >= 12 && origH < 14) suffix = 'ظ';
            else if (origH >= 14) suffix = 'م';
            
            return { formatted: `${h}:${m}`, ampm: suffix };
        };

        const start = formatTime(startTime);
        const end = formatTime(endTime);

        if (start && end) {
            if (startTime === endTime) {
                return `
                    <div class="time-block single">
                        <span class="time-digit">${start.formatted}</span>
                        <span class="time-label">${start.ampm}</span>
                    </div>
                `;
            }
            return `
                <div class="time-block start">
                    <span class="time-digit">${start.formatted}</span>
                    <span class="time-label">${start.ampm}</span>
                </div>
                <div class="time-divider"><i class="bi bi-arrow-down-short"></i></div>
                <div class="time-block end">
                    <span class="time-digit">${end.formatted}</span>
                    <span class="time-label">${end.ampm}</span>
                </div>
            `;
        } else if (start) {
            return `
                <div class="time-block single">
                    <span class="time-digit">${start.formatted}</span>
                    <span class="time-label">${start.ampm}</span>
                </div>
            `;
        }
        return '';
    }

    function getMealImage(act) {
        if (!act) return null;
        const title = (act.title || '').toLowerCase();
        const type  = (act.type  || '').toLowerCase();
        const day   = act.day || 1;

        let mealKey = null;
        if (title.includes('فطار') || title.includes('إفطار') || title.includes('فطور')) {
            mealKey = 'breakfast';
        } else if (title.includes('غداء') || title.includes('الغداء')) {
            mealKey = 'lunch';
        } else if (title.includes('عشاء') || title.includes('العشاء')) {
            mealKey = 'dinner';
        } else if (type === 'meal') {
            const h = parseInt(act.time || '12', 10);
            if (h < 11) mealKey = 'breakfast';
            else if (h < 18) mealKey = 'lunch';
            else mealKey = 'dinner';
        }

        // بيانات الوجبات تُحدد من برنامج المؤتمر الجديد
        if (mealKey) {
            return `../assets/img/meals/${mealKey}_day${day}.jpg`;
        }
        return null;
    }

    /* ─── 1. رسم بطاقة نشاط ─── */
    function renderActivity(act, starredSet) {
        const t   = TYPE_ICONS[act.type] || TYPE_ICONS.other;
        const div = document.createElement('div');
        div.className = `activity-item type-${act.type}`;
        div.id = act.id;

        const timeStr = formatArabicTimeRange(act.time, act.endTime);

        let linkedPage = 'lectures.html';
        if (act.type === 'workshop') {
            linkedPage = 'workshops.html';
        }
        const linkHref = act.linkedPage
            ? act.linkedPage
            : (act.linkedId ? `${linkedPage}?id=${act.linkedId}` : null);
        const linkLabel = act.linkedLabel || '<i class="bi bi-link-45deg"></i>تفاصيل';
        const linkHtml = linkHref
            ? `<a href="${linkHref}" class="activity-chip prayer-link" style="color:var(--primary);text-decoration:none">${linkLabel}</a>`
            : '';

        /* نستخدم الـ Set المُمرَّر بدل قراءة localStorage في كل مرة */
        const isStarred = starredSet.has(act.id);

        const timeHtml = timeStr
            ? `<div class="activity-time">
                <div class="time-clock-icon"><i class="bi bi-clock-fill"></i></div>
                ${timeStr}
               </div>`
            : '';

        div.innerHTML = `
            <button class="activity-star-btn ${isStarred ? 'active' : ''}" data-id="${act.id}" title="أضف لجدولي">
                <i class="bi ${isStarred ? 'bi-star-fill' : 'bi-star'}"></i>
            </button>
            ${timeHtml}
            <div class="activity-content">
                <div class="activity-watermark-icon"><i class="${t.icon}"></i></div>
                <div class="activity-title"><i class="${t.icon}" style="color:${t.color};margin-left:.4rem;"></i>${escapeHTML(act.title)}</div>
                <div class="activity-meta">
                    ${act.place ? `<span class="activity-chip"><i class="bi bi-geo-alt-fill"></i>${escapeHTML(act.place)}</span>` : ''}
                    ${act.notes ? `<span class="activity-chip"><i class="bi bi-chat-text-fill"></i>${escapeHTML(act.notes)}</span>` : ''}
                    ${linkHtml}
                </div>
            </div>
        `;

        const starBtn = div.querySelector('.activity-star-btn');
        starBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const stars = getStarred();
            let nowStarred = false;
            if (stars.has(act.id)) {
                stars.delete(act.id);
            } else {
                stars.add(act.id);
                nowStarred = true;
            }
            saveStarred(stars);
            starBtn.classList.toggle('active', nowStarred);
            starBtn.querySelector('i').className = `bi bi-star${nowStarred ? '-fill' : ''}`;
            if (activeFilter === 'starred') applyFilter();
        });

        return div;
    }

    function escapeHTML(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    /* ─── 2. رسم كل الأيام (يستخدم DocumentFragment لتجنب Reflow متعدد) ─── */
    function renderAll() {
        /* نقرأ starred مرة واحدة فقط للكل */
        const starredSet = getStarred();

        [1, 2, 3, 4].forEach(day => {
            const timeline = document.getElementById(`timeline-day-${day}`);
            if (!timeline) return;

            const acts = program.filter(a => a.day === day)
                .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

            if (acts.length === 0) {
                const dayLabel = day === 1 ? 'الأول' : day === 2 ? 'الثاني' : day === 3 ? 'الثالث' : 'الرابع';
                timeline.innerHTML = `<div class="empty-state"><i class="bi bi-calendar-x"></i><p>هيتم إضافة برنامج اليوم ${dayLabel} قريباً</p></div>`;
                return;
            }

            /* DocumentFragment: نبني كل البطاقات خارج الـ DOM ثم ندرجها دفعة واحدة */
            const frag = document.createDocumentFragment();
            acts.forEach(act => frag.appendChild(renderActivity(act, starredSet)));
            timeline.innerHTML = '';
            timeline.appendChild(frag);
        });
    }

    /* ─── 3. تمييز النشاط الحالي وتفعيل تبويبه ─── */
    function highlightNow() {
        // تنظيف الشارات السابقة
        document.querySelectorAll('.now-badge, .next-badge').forEach(b => b.remove());
        
        // إذا كنا خارج أيام المؤتمر، لا نميز أي فقرات بـ "الآن" أو "التالية" في الجدول
        if (currentConferenceDay === null) {
            YC.highlightCurrentActivity(program, { currentDay: null });
            return;
        }
        
        currentActivity = YC.highlightCurrentActivity(program, { currentDay: currentConferenceDay });

        // إضافة شارة "الآن" للنشاط الحالي وتفعيل تبويبه
        if (currentActivity) {
            const el = document.getElementById(currentActivity.id);
            if (el) {
                const badge = document.createElement('span');
                badge.className = 'now-badge';
                badge.innerHTML = '<span class="now-dot"></span> الآن';
                el.querySelector('.activity-title')?.prepend(badge);
            }
        }

        // حساب وإضافة شارة "التالية" للنشاط التالي لليوم المختار حالياً
        const targetDay = currentActivity ? currentActivity.day : parseInt(selectedDay);
        
        // نظهر شارة "التالية" فقط إذا كان التبويب المختار هو اليوم الحالي الفعلي للمؤتمر
        if (targetDay !== currentConferenceDay) return;

        const dayActs = program.filter(a => a.day === targetDay)
            .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
        
        let nextActivity = null;
        if (currentActivity && currentActivity.day === targetDay) {
            const idx = dayActs.findIndex(a => a.id === currentActivity.id);
            if (idx !== -1 && idx + 1 < dayActs.length) {
                nextActivity = dayActs[idx + 1];
            }
        } else {
            // إذا لم يكن هناك نشاط جاري، نبحث عن أول نشاط قادم اليوم
            const now = new Date();
            const currentTotalMins = now.getHours() * 60 + now.getMinutes();
            const toMin = (str) => {
                if (!str) return null;
                const [h, m] = str.split(':').map(Number);
                return h * 60 + m;
            };
            for (let i = 0; i < dayActs.length; i++) {
                const start = toMin(dayActs[i].time);
                if (start > currentTotalMins) {
                    nextActivity = dayActs[i];
                    break;
                }
            }
        }

        if (nextActivity) {
            const nextEl = document.getElementById(nextActivity.id);
            if (nextEl) {
                const nextBadge = document.createElement('span');
                nextBadge.className = 'next-badge';
                nextBadge.innerHTML = '<span class="next-dot"></span> التالية';
                nextEl.querySelector('.activity-title')?.prepend(nextBadge);
            }
        }
    }

    function getDayDate(dayNum, meta) {
        if (!meta || !meta.days) return null;
        const found = meta.days.find(d => d.day === dayNum);
        if (!found) return null;
        
        const year = meta.year || 2026;
        const [d, m] = found.date.split('/').map(Number);
        return new Date(year, m - 1, d);
    }

    function getConferenceState(meta) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const day1Date = getDayDate(1, meta);
        const lastDayNum = meta?.days?.length || 1;
        const lastDayDate = getDayDate(lastDayNum, meta);
        
        if (!day1Date || !lastDayDate) return { status: 'unknown' };
        
        if (today < day1Date) {
            const diffTime = Math.abs(day1Date - today);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { status: 'before', daysRemaining: diffDays };
        } else if (today > lastDayDate) {
            return { status: 'after' };
        } else {
            for (let day = 1; day <= lastDayNum; day++) {
                const dDate = getDayDate(day, meta);
                if (dDate && dDate.getTime() === today.getTime()) {
                    return { status: 'during', currentDay: day };
                }
            }
        }
        return { status: 'unknown' };
    }

    /* ─── 4. تحديث بطاقة الـ Widget للنشاط الجاري (Live Status) ─── */
    function updateLiveWidget() {
        const widget = document.getElementById('live-status-widget');
        if (!widget) return;

        const state = getConferenceState(dataMeta);

        // إعادة تعيين أنماط بادج الحالة الافتراضية
        const badge = widget.querySelector('.live-badge-now');
        if (badge) {
            badge.innerHTML = '<span class="blink-dot"></span> الآن';
            badge.style.background = '';
            badge.style.borderColor = '';
            badge.style.color = '';
        }

        // الحالة أ: قبل بدء المؤتمر
        if (state.status === 'before') {
            widget.style.display = 'block';
            if (badge) {
                badge.innerHTML = '⏳ قريباً';
                badge.style.background = 'rgba(245, 158, 11, 0.15)';
                badge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
                badge.style.color = '#fbbf24';
            }
            
            document.getElementById('live-activity-title').innerHTML = `
                <i class="bi bi-calendar-event-fill me-1" style="color:#fbbf24"></i> المؤتمر لم يبدأ بعد
            `;
            document.getElementById('live-time-left').textContent = `ينطلق المؤتمر يوم 10 أغسطس 2026`;
            document.getElementById('live-progress-percent').textContent = `باقي ${state.daysRemaining} يوم`;
            document.getElementById('live-progress-bar-fill').style.width = '0%';
            
            const nextTeaser = document.getElementById('live-next-teaser');
            if (nextTeaser) {
                nextTeaser.style.display = 'flex';
                document.getElementById('live-next-activity-text').textContent = 'النشاط الأول: التجمع والانطلاق (06:00 ص)';
            }
            return;
        }

        // الحالة ب: بعد انتهاء المؤتمر
        if (state.status === 'after') {
            widget.style.display = 'block';
            if (badge) {
                badge.innerHTML = '🕊️ ختام';
                badge.style.background = 'rgba(16, 185, 129, 0.15)';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.35)';
                badge.style.color = '#34d399';
            }
            
            document.getElementById('live-activity-title').innerHTML = `
                <i class="bi bi-check-circle-fill me-1" style="color:#34d399"></i> انتهى المؤتمر بحمد الله
            `;
            document.getElementById('live-time-left').textContent = `نشوفكم في المؤتمر القادم!`;
            document.getElementById('live-progress-percent').textContent = `100%`;
            document.getElementById('live-progress-bar-fill').style.width = '100%';
            
            const nextTeaser = document.getElementById('live-next-teaser');
            if (nextTeaser) nextTeaser.style.display = 'none';
            return;
        }

        // الحالة ج: أثناء المؤتمر (نلتزم باليوم الحالي الفعلي)
        const now = new Date();
        const currentTotalMins = now.getHours() * 60 + now.getMinutes();

        const toMin = (str) => {
            if (!str) return null;
            const [h, m] = str.split(':').map(Number);
            return h * 60 + m;
        };

        const todayDay = state.currentDay;
        const viewingDay = parseInt(selectedDay);
        
        // إخفاء كارت البث المباشر للأنشطة إذا كان المستخدم يستعرض جدول يوم آخر غير اليوم الفعلي
        if (viewingDay !== todayDay) {
            widget.style.display = 'none';
            return;
        }

        const dayActivities = program.filter(a => a.day === todayDay)
            .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
        
        let currentAct = null;
        let nextAct = null;

        for (let i = 0; i < dayActivities.length; i++) {
            const act = dayActivities[i];
            const start = toMin(act.time);
            const end = toMin(act.endTime) || (start + 60);

            if (currentTotalMins >= start && currentTotalMins < end) {
                currentAct = act;
                nextAct = dayActivities[i + 1] || null;
                break;
            }
        }

        if (!currentAct) {
            for (let i = 0; i < dayActivities.length; i++) {
                const start = toMin(dayActivities[i].time);
                if (start > currentTotalMins) {
                    nextAct = dayActivities[i];
                    break;
                }
            }
        }

        if (currentAct) {
            widget.style.display = 'block';
            document.getElementById('live-activity-title').innerHTML = `
                <i class="bi bi-play-circle-fill me-1" style="color:var(--primary-light)"></i> ${currentAct.title}
            `;
            
            const start = toMin(currentAct.time);
            const end = toMin(currentAct.endTime) || (start + 60);
            const duration = end - start;
            const elapsed = currentTotalMins - start;
            const percent = Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100)));
            const minsLeft = end - currentTotalMins;

            document.getElementById('live-progress-percent').textContent = `${percent}%`;
            document.getElementById('live-progress-bar-fill').style.width = `${percent}%`;
            
            if (minsLeft > 60) {
                const h = Math.floor(minsLeft / 60);
                const m = minsLeft % 60;
                document.getElementById('live-time-left').textContent = `متبقي ${h} ساعة و ${m} دقيقة`;
            } else {
                document.getElementById('live-time-left').textContent = `متبقي ${minsLeft} دقيقة`;
            }

            const nextTeaser = document.getElementById('live-next-teaser');
            if (nextAct) {
                nextTeaser.style.display = 'flex';
                document.getElementById('live-next-activity-text').textContent = `النشاط التالي: ${nextAct.title} (${formatArabicTimeSingle(nextAct.time)})`;
            } else {
                nextTeaser.style.display = 'none';
            }
        } else if (nextAct) {
            widget.style.display = 'block';
            document.getElementById('live-activity-title').textContent = "لا توجد فعاليات جارية حالياً";
            
            const start = toMin(nextAct.time);
            const minsToStart = start - currentTotalMins;
            
            if (minsToStart > 60) {
                const h = Math.floor(minsToStart / 60);
                const m = minsToStart % 60;
                document.getElementById('live-time-left').textContent = `الفعالية التالية تبدأ بعد ${h} ساعة و ${m} دقيقة`;
            } else {
                document.getElementById('live-time-left').textContent = `الفعالية التالية تبدأ بعد ${minsToStart} دقيقة`;
            }

            document.getElementById('live-progress-percent').textContent = `0%`;
            document.getElementById('live-progress-bar-fill').style.width = `0%`;

            const nextTeaser = document.getElementById('live-next-teaser');
            nextTeaser.style.display = 'flex';
            document.getElementById('live-next-activity-text').textContent = `النشاط القادم: ${nextAct.title} (${formatArabicTimeSingle(nextAct.time)})`;
        } else {
            widget.style.display = 'none';
        }
    }

    /* ─── 5. تصفية وفلترة الأنشطة ─── */
    function applyFilter() {
        const starredIds = JSON.parse(localStorage.getItem('yc2_starred_activities') || '[]');
        const items = document.querySelectorAll('.activity-item');
        items.forEach(el => {
            let matchFilter = false;
            if (activeFilter === 'all') {
                matchFilter = true;
            } else if (activeFilter === 'starred') {
                matchFilter = starredIds.includes(el.id);
            } else {
                matchFilter = el.classList.contains(`type-${activeFilter}`);
            }

            if (matchFilter) {
                el.style.display = 'flex';
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 10);
            } else {
                el.style.opacity = '0';
                el.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    el.style.display = 'none';
                }, 200);
            }
        });
    }

    /* ─── 6. ربط التبويبات (Days) عن طريق تفويض الأحداث (Vanilla JS) ─── */
    document.addEventListener('click', function(e) {
        const tab = e.target.closest('.day-tab');
        if (!tab) return;
        
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        selectedDay = tab.getAttribute('data-day');
        
        const panel = document.getElementById(`prog-panel-day-${selectedDay}`);
        if (panel) panel.classList.add('active');
        
        // تحديث كارت الحالة والفلتر فوراً
        highlightNow();
        updateLiveWidget();
        applyFilter();
    });

    function formatArabicDate(dateStr) {
        if (!dateStr) return '';
        const months = {
            '1': 'يناير', '2': 'فبراير', '3': 'مارس', '4': 'أبريل',
            '5': 'مايو', '6': 'يونيو', '7': 'يوليو', '8': 'أغسطس',
            '9': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
        };
        const parts = dateStr.split('/');
        if (parts.length === 2) {
            const day = parts[0];
            const month = months[parts[1]] || parts[1];
            return `${day} ${month}`;
        }
        return dateStr;
    }

    function renderDayTabs(days) {
        const container = document.querySelector('.day-tabs');
        if (!container || !days || !days.length) return;
        
        const defaultDay = currentConferenceDay || 1;
        selectedDay = String(defaultDay); // تحديث selectedDay الافتراضي
        
        container.innerHTML = days.map(d => {
            const activeCls = d.day === defaultDay ? 'active' : '';
            const departureCls = d.day === days.length ? 'day-tab-departure' : '';
            const labelSub = d.day === days.length ? 'اليوم الأخير' : d.label;
            const beautifulDate = formatArabicDate(d.date);
            return `<button class="day-tab ${activeCls} ${departureCls}" data-day="${d.day}" role="tab">${beautifulDate}<span class="day-tab-sub">${labelSub}</span></button>`;
        }).join('');
        
        // تفعيل لوحة اليوم الافتراضي المناسب وإلغاء البقية
        document.querySelectorAll('.day-panel').forEach(p => {
            if (p.id === `prog-panel-day-${defaultDay}`) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
    }

    /* ─── 7. ربط الفلاتر (Filter Pills) ─── */
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', function() {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            activeFilter = this.dataset.filter;
            applyFilter();
        });
    });

    /* ─── 8. زر الانتقال للنشاط الحالي ─── */
    document.getElementById('jump-now-btn')?.addEventListener('click', () => {
        if (currentActivity) {
            // تفعيل يوم النشاط الحالي أولاً
            const dayTab = document.querySelector(`.day-tab[data-day="${currentActivity.day}"]`);
            if (dayTab) dayTab.click();
            
            const el = document.getElementById(currentActivity.id);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 250);
            }
        }
    });

    function startApp() {
        if (!window.DataService) {
            setTimeout(startApp, 50);
            return;
        }

        (DataService.loadStructure ? DataService.loadStructure() : DataService.loadConference()).then(data => {
            program = data.program || [];
            dataMeta = data.meta;
            
            // حساب اليوم الحالي الفعلي وتحديد التبويب الافتراضي
            if (dataMeta) {
                const state = getConferenceState(dataMeta);
                if (state.status === 'during') {
                    currentConferenceDay = state.currentDay;
                } else if (state.status === 'after') {
                    currentConferenceDay = dataMeta.days?.length || 1; // اليوم الأخير
                } else {
                    currentConferenceDay = null; // قبل المؤتمر
                }
            }

            // رسم تابات الأيام ديناميكياً من الميتا (تتأثر باليوم الحالي الفعلي)
            if (dataMeta && dataMeta.days) {
                renderDayTabs(dataMeta.days);
                
                // تحديث العنوان الفرعي بذكر تاريخ ونطاق المؤتمر
                const subtitle = document.querySelector('.page-header-sub');
                if (subtitle && dataMeta.year) {
                    const firstDate = formatArabicDate(dataMeta.days[0].date);
                    const lastDate = formatArabicDate(dataMeta.days[dataMeta.days.length - 1].date);
                    subtitle.textContent = `مؤتمر الشباب ${dataMeta.year} — من ${firstDate} إلى ${lastDate}`;
                }
            }
            
            // تشغيل الرسم الأولي لجميع الأيام
            renderAll();
            
            // تأخير التمييز ليعمل الفلتر وحفظ التبويب
            setTimeout(() => {
                highlightNow();
                updateLiveWidget();
                applyFilter();
            }, 200);

            // تحديثات الحالة الحية كل 10 ثواني لمزامنة أفضل لـ Progress Bar والجدول
            setInterval(() => {
                updateLiveWidget();
                highlightNow();
            }, 10000);
        }).catch(err => {
            console.error('Failed to load conference-data in program page:', err);
        });
    }

    // إطلاق التطبيق عند جاهزية الصفحة
    window.openMealModal = function (imgSrc, title) {
        const modalEl = document.getElementById('mealCardModal');
        const modalImg = document.getElementById('mealModalImg');
        const modalTitle = document.getElementById('mealModalTitle');
        if (modalImg) modalImg.src = imgSrc;
        if (modalTitle) modalTitle.textContent = `🍽️ كارت وجبة ${title || 'المخصصة'}`;
        if (modalEl && window.bootstrap && bootstrap.Modal) {
            const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            bsModal.show();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
})();
