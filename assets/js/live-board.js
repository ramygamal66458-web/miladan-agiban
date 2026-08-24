/* ✈️ live-board.js — محرك تتبع الوقت والرميات التقويمية الحية المنطقية 100% قبل وفي أثناء وبعد المؤتمر */

(function () {
    'use strict';

    // ═══ 1. معرض الصور الواقعية عالية الجودة لكل نوع فقرة ═══
    const CATEGORY_IMAGES = {
        prayer:   'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?q=80&w=1600&auto=format&fit=crop', // قداس وصلاة روحية
        lecture:  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1600&auto=format&fit=crop', // قاعة المحاضرات
        workshop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1600&auto=format&fit=crop', // ورش عمل تفاعلية
        free:     'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?q=80&w=1600&auto=format&fit=crop', // المسبح والبيسين
        meal:     'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1600&auto=format&fit=crop', // مطعم المؤتمر والوجبات
        travel:   'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1600&auto=format&fit=crop', // أتوبيس الانتقالات
        hymn:     'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1600&auto=format&fit=crop', // سهرة ترانيم وتسبيح
        other:    'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=1600&auto=format&fit=crop'
    };

    const TYPE_LABELS = {
        prayer:   'صلوات وعبادة',
        lecture:  'محاضرة روحية',
        workshop: 'ورشة عمل تفاعلية',
        meal:     'وجبات ومقصف',
        free:     'أنشطة ترفيهية وسباحة',
        travel:   'سفر وانتقالات الأتوبيس',
        hymn:     'ترانيم وسهرة تسبيح',
        other:    'فعاليات عامة'
    };

    const DAYS_ARABIC   = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const MONTHS_ARABIC = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    let fullProgramData  = [];
    let conferenceMeta    = {};
    let allParticipants   = [];

    let currentActiveId   = null;
    let audioEnabled      = true;

    // 🟢 الإعداد الافتراضي: الوقت الحقيقي المباشر واليوم الحقيقي
    let simMode = false;
    let simDay = 1;
    let simTimeStr = '07:30';

    function escapeHTML(str) {
        if (!str) return '';
        if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function playAirportChime() {
        if (!audioEnabled) return;
        
        try {
            const chimeAudio = new Audio('../assets/audio/airport_chime.mp3');
            let playsLeft = 2; // يكرر نداء المطار مرتين!
            
            const playTwice = () => {
                chimeAudio.play().then(() => {
                    playsLeft--;
                    if (playsLeft > 0) {
                        setTimeout(() => {
                            chimeAudio.currentTime = 0;
                            chimeAudio.play().catch(() => {});
                        }, 1200);
                    }
                }).catch(() => {
                    // في حالة حظر المتصفح، يتم التشغيل عبر Web Audio API مرتين متتاليتين
                    playSynthesizedChimeTwice();
                });
            };

            playTwice();
        } catch (e) {
            playSynthesizedChimeTwice();
        }
    }

    /* 🔊 نداء المطار الصوتي عبر Web Audio API (يكرر مرتين متتاليتين) */
    function playSynthesizedChimeTwice() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            const playNote = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
                gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
                gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + startTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + startTime);
                osc.stop(ctx.currentTime + startTime + duration);
            };

            // 🔔 التكرار الأول (First Chime Sequence)
            playNote(523.25, 0.0, 0.7);  // Do
            playNote(659.25, 0.28, 0.7); // Mi
            playNote(783.99, 0.56, 1.1); // Sol

            // 🔔 التكرار الثاني بعد 1.5 ثانية (Second Chime Sequence)
            playNote(523.25, 1.6, 0.7);  // Do
            playNote(659.25, 1.88, 0.7); // Mi
            playNote(783.99, 2.16, 1.2); // Sol
        } catch (err) {
            console.log('Chime playback error:', err);
        }
    }

    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60) + (m || 0);
    }

    function formatTime12(timeStr) {
        if (!timeStr) return '';
        let [h, m] = timeStr.split(':').map(Number);
        let suffix = 'ص';
        if (h >= 12 && h < 14) suffix = 'ظ';
        else if (h >= 14) suffix = 'م';
        if (h > 12) h -= 12;
        else if (h === 0) h = 12;
        return `${h}:${m < 10 ? '0' + m : m} ${suffix}`;
    }

    function getGateCode(placeStr) {
        if (!placeStr) return 'GATE A1 — القاعة الرئيسية';
        if (placeStr.includes('ورش')) return 'GATE B2 — قاعة الورش';
        if (placeStr.includes('مطعم')) return 'GATE C1 — المطعم المركزي';
        if (placeStr.includes('سباحة') || placeStr.includes('بيسين')) return 'GATE D4 — منطقة المسبح';
        if (placeStr.includes('كنيسة')) return 'GATE A0 — الكنيسة';
        return `GATE A1 — ${placeStr}`;
    }

    /* ─── 🕒 تحديث الساعة الحائط العقربية المربعة واليوم الحقيقي ─── */
    function updateAnalogClock() {
        const now = new Date();
        let h = now.getHours();
        let m = now.getMinutes();
        let s = now.getSeconds();

        if (simMode) {
            const parts = simTimeStr.split(':').map(Number);
            h = parts[0];
            m = parts[1];
            s = 0;
        }

        const secDeg  = (s / 60) * 360;
        const minDeg  = ((m + s / 60) / 60) * 360;
        const hourDeg = (((h % 12) + m / 60) / 12) * 360;

        const secHand  = document.getElementById('secHand');
        const minHand  = document.getElementById('minHand');
        const hourHand = document.getElementById('hourHand');

        if (secHand)  secHand.setAttribute('transform', `rotate(${secDeg} 100 100)`);
        if (minHand)  minHand.setAttribute('transform', `rotate(${minDeg} 100 100)`);
        if (hourHand) hourHand.setAttribute('transform', `rotate(${hourDeg} 100 100)`);

        const digitalText = document.getElementById('squareClockDigitalText');
        const dateText    = document.getElementById('squareClockDateText');

        if (digitalText) {
            const h12 = h % 12 === 0 ? 12 : h % 12;
            const ampm = h >= 12 ? 'م' : 'ص';
            const hStr = String(h12).padStart(2, '0');
            const mStr = String(m).padStart(2, '0');
            const sStr = String(s).padStart(2, '0');
            digitalText.innerHTML = `<span>${hStr}:${mStr}:${sStr}</span> <span style="color:var(--retro-amber); font-size:1rem; margin-right:4px;">${ampm}</span>`;
        }

        if (dateText) {
            if (!simMode) {
                const dayName   = DAYS_ARABIC[now.getDay()];
                const dayNum    = now.getDate();
                const monthName = MONTHS_ARABIC[now.getMonth()];
                dateText.textContent = `📅 ${dayName} ${dayNum} ${monthName}`;
            } else {
                dateText.textContent = `🧪 محاكاة اليوم ${simDay}`;
            }
        }
    }

    /* ─── 👥 جلب ورسم جميع المشتركين من الشيت مباشرة ─── */
    async function loadParticipants() {
        try {
            if (window.DataService && typeof DataService.loadConference === 'function') {
                const confData = await DataService.loadConference();
                if (confData && Array.isArray(confData.participants) && confData.participants.length > 0) {
                    allParticipants = confData.participants;
                }
            }
        } catch (e) {
            console.warn('DataService fetch error:', e);
        }

        if (!allParticipants || allParticipants.length === 0) {
            if (window.db && Array.isArray(window.db.passengers) && window.db.passengers.length > 0) {
                allParticipants = window.db.passengers;
            }
        }

        renderParticipantsList(allParticipants);
    }

    function renderParticipantsList(list) {
        const listWrap = document.getElementById('participantsListWrap');
        const countBadge = document.getElementById('participantsCountBadge');
        if (!listWrap) return;

        if (countBadge) countBadge.textContent = `[${list.length} PASSENGERS]`;

        if (!list || list.length === 0) {
            listWrap.innerHTML = '<div style="font-size:0.82rem; color:var(--retro-amber); text-align:center; padding:15px;">جارِ جلب أسماء المشتركين من الشيت...</div>';
            return;
        }

        let html = '';
        list.forEach((p, idx) => {
            const name = p.name || p.fullName || `مشترك ${idx + 1}`;
            const numStr = String(idx + 1).padStart(2, '0');

            html += `
            <div class="split-passenger-btn">
                <div class="split-btn-name">${escapeHTML(name)}</div>
                <div class="split-btn-badge">#${numStr}</div>
            </div>`;
        });

        listWrap.innerHTML = html;
    }

    let userSelectedDay = null;

    function parseMetaDate(dStr, year = 2026) {
        if (!dStr) return null;
        if (typeof dStr === 'string' && dStr.includes('/')) {
            const [d, m] = dStr.split('/').map(Number);
            return new Date(year, m - 1, d);
        }
        return new Date(dStr);
    }

    function detectTodayConferenceDay() {
        const now = new Date();
        const curD = now.getDate();
        const curM = now.getMonth() + 1;

        if (conferenceMeta && Array.isArray(conferenceMeta.days)) {
            for (let i = 0; i < conferenceMeta.days.length; i++) {
                const dayObj = conferenceMeta.days[i];
                if (!dayObj.date) continue;
                if (typeof dayObj.date === 'string' && dayObj.date.includes('/')) {
                    const [d, m] = dayObj.date.split('/').map(Number);
                    if (d === curD && m === curM) {
                        return Number(dayObj.day);
                    }
                } else {
                    const parsed = new Date(dayObj.date);
                    if (!isNaN(parsed) && parsed.getDate() === curD && (parsed.getMonth() + 1) === curM) {
                        return Number(dayObj.day);
                    }
                }
            }
        }
        return null;
    }

    /* ─── 🖥️ المحرك المنطقي 100% لتتبع أوقات وأيام المؤتمر ─── */
    function computeTelemetry() {
        if (!fullProgramData || fullProgramData.length === 0) return;

        const now = new Date();
        const detectedDay = detectTodayConferenceDay();
        
        let activeDay;
        let activeNowMin;
        let isPreConferenceDate = false;
        let daysUntilConference = 0;

        if (simMode) {
            activeDay = simDay;
            activeNowMin = timeToMinutes(simTimeStr);
        } else {
            activeNowMin = (now.getHours() * 60) + now.getMinutes();

            if (userSelectedDay) {
                activeDay = userSelectedDay;
            } else if (detectedDay) {
                activeDay = detectedDay;
                simDay = detectedDay;
            } else {
                activeDay = simDay || 1;
                const startDate = parseMetaDate(conferenceMeta.startDate || (conferenceMeta.days && conferenceMeta.days[0] && conferenceMeta.days[0].date) || '10/8');
                if (startDate && now < startDate) {
                    const diffTime = startDate - now;
                    daysUntilConference = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                    isPreConferenceDate = true;
                }
            }
        }

        // تحديث حالة الأزرار العلوية للأيام
        document.querySelectorAll('.day-tab-btn').forEach(btn => {
            const d = Number(btn.getAttribute('data-day'));
            btn.classList.toggle('active', d === Number(activeDay));
        });

        const dayActivities = fullProgramData.filter(a => Number(a.day) === Number(activeDay));
        if (dayActivities.length === 0) return;

        dayActivities.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

        let prevAct = null;
        let currAct = null;
        let nextAct = null;

        const firstStart = timeToMinutes(dayActivities[0].time);
        const lastEnd    = timeToMinutes(dayActivities[dayActivities.length - 1].endTime || dayActivities[dayActivities.length - 1].time);

        // 1. قبل بداية أول فعالية في هذا اليوم
        if (activeNowMin < firstStart) {
            prevAct = null;
            currAct = null;
            nextAct = dayActivities[0];
        } 
        // 2. بعد انتهاء آخر فعالية في هذا اليوم
        else if (activeNowMin >= lastEnd) {
            prevAct = dayActivities[dayActivities.length - 1];
            currAct = null;
            const nextDayActivities = fullProgramData.filter(a => Number(a.day) === Number(activeDay + 1));
            nextAct = (nextDayActivities && nextDayActivities.length > 0) ? nextDayActivities[0] : null;
        } 
        // 3. أثناء فعاليات هذا اليوم
        else {
            for (let i = 0; i < dayActivities.length; i++) {
                const act = dayActivities[i];
                const startMin = timeToMinutes(act.time);
                const endMin   = timeToMinutes(act.endTime || act.time);

                if (activeNowMin >= startMin && activeNowMin < endMin) {
                    currAct = act;
                    prevAct = dayActivities[i - 1] || null;
                    nextAct = dayActivities[i + 1] || null;
                    break;
                } else if (activeNowMin < startMin) {
                    nextAct = act;
                    prevAct = dayActivities[i - 1] || null;
                    break;
                }
            }
        }

        // رسم العمود الأيسر (الفقرة السابقة، الحالية، والقادمة)
        renderLeftStack(prevAct, currAct, nextAct, isPreConferenceDate, daysUntilConference);

        // رسم الشاشة الكبيرة بالمنتصف
        renderCenterHeroStage(currAct, prevAct, nextAct, activeNowMin, activeDay, isPreConferenceDate, daysUntilConference);

        // 🔔 التنبيه الصوتي عند تبديل الفقرة النشطة تلقائياً!
        if (currAct && currAct.id !== currentActiveId) {
            currentActiveId = currAct.id;
            playAirportChime();
        }
    }

    /* ─── 1. رسم أقصى اليسار فوق الساعة ─── */
    function renderLeftStack(prevAct, currAct, nextAct, isPreConferenceDate, daysUntilConference) {
        const stackWrap = document.getElementById('leftActivitiesStack');
        if (!stackWrap) return;

        let html = '';

        // السابقة
        if (prevAct) {
            html += `
            <div class="timeline-activity-card">
                <span class="timeline-card-tag prev">DEPARTED — الفقرة السابقة ✅</span>
                <div style="font-size:0.95rem; font-weight:900; color:#ffffff; margin-bottom:4px;">${escapeHTML(prevAct.title)}</div>
                <div style="font-size:0.75rem; color:#94a3b8;"><i class="bi bi-clock me-1" style="color:var(--retro-amber)"></i>${formatTime12(prevAct.time)} - ${formatTime12(prevAct.endTime)}</div>
            </div>`;
        } else {
            html += `
            <div class="timeline-activity-card" style="opacity:0.8;">
                <span class="timeline-card-tag prev">معاينة الرحلة 📅</span>
                <div style="font-size:0.85rem; color:#cbd5e1; font-weight:800;">
                    ${isPreConferenceDate ? `متبقي ${daysUntilConference} أيام على الانطلاق` : 'بداية جدول اليوم'}
                </div>
            </div>`;
        }

        // الحالية
        if (currAct) {
            html += `
            <div class="timeline-activity-card current-active">
                <span class="timeline-card-tag curr">🔴 IN FLIGHT — الفقرة الجارية الآن</span>
                <div style="font-size:1.05rem; font-weight:900; color:#ffffff; margin-bottom:4px;">${escapeHTML(currAct.title)}</div>
                <div style="font-size:0.8rem; color:var(--retro-green); font-weight:800;"><i class="bi bi-geo-alt me-1"></i>${escapeHTML(currAct.place || 'القاعة')}</div>
            </div>`;
        } else {
            html += `
            <div class="timeline-activity-card">
                <span class="timeline-card-tag curr">صالة الاستعداد ✈️</span>
                <div style="font-size:0.88rem; color:var(--retro-amber); font-weight:800;">
                    ${isPreConferenceDate ? 'استعراض فعاليات وتوقيت المؤتمر' : 'استراحة أو انتظار الانطلاق'}
                </div>
            </div>`;
        }

        // التالية
        if (nextAct) {
            html += `
            <div class="timeline-activity-card">
                <span class="timeline-card-tag next">NEXT BOARDING — الفقرة التالية 🟡</span>
                <div style="font-size:0.95rem; font-weight:900; color:#ffffff; margin-bottom:4px;">${escapeHTML(nextAct.title)}</div>
                <div style="font-size:0.75rem; color:var(--retro-amber);"><i class="bi bi-clock me-1"></i>تبدأ: ${formatTime12(nextAct.time)} (اليوم ${nextAct.day})</div>
            </div>`;
        } else {
            html += `<div class="timeline-activity-card" style="opacity:0.6;"><span class="timeline-card-tag next">الفقرة التالية</span><div style="font-size:0.8rem; color:#94a3b8;">انتهى برنامج المؤتمر ✅</div></div>`;
        }

        stackWrap.innerHTML = html;
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

        // الفطار أيام 11 و 12 و 13 (الأيام 2، 3، 4) فقط - اليوم الأول (10/8) ليس به فطار
        if (mealKey === 'breakfast' && day === 1) {
            return null;
        }

        if (mealKey) {
            return `../assets/img/meals/${mealKey}_day${day}.jpg`;
        }
        return null;
    }

    /* ─── 2. رسم المنتصف: الشاشة الكبيرة بالصور الواقعية ─── */
    function renderCenterHeroStage(currAct, prevAct, nextAct, activeNowMin, activeDay, isPreConferenceDate, daysUntilConference) {
        const stageWrap = document.getElementById('centerHeroStageWrap');
        if (!stageWrap) return;

        const displayAct = currAct || nextAct || prevAct || (fullProgramData && fullProgramData[0]);

        if (displayAct) {
            const isLive   = displayAct === currAct;
            const mealImg  = getMealImage(displayAct);
            const bgImg    = mealImg || CATEGORY_IMAGES[displayAct.type] || CATEGORY_IMAGES.other;
            const startMin = timeToMinutes(displayAct.time);
            const endMin   = timeToMinutes(displayAct.endTime);
            const totalDur = Math.max(1, endMin - startMin);
            const elapsed  = Math.max(0, activeNowMin - startMin);

            let remain = 0;
            if (isLive) {
                remain = Math.max(0, endMin - activeNowMin);
            } else if (nextAct && displayAct === nextAct) {
                remain = Math.max(0, startMin - activeNowMin);
            }

            const pct = isLive ? Math.min(100, Math.round((elapsed / totalDur) * 100)) : 0;
            const isExpiringSoon = isLive && remain <= 5 && remain > 0;

            let stageBadgeText = isLive 
                ? `LIVE STAGE — العرض الرئيسي الجاري (اليوم ${activeDay})` 
                : (isPreConferenceDate 
                    ? `PRE-FLIGHT PREVIEW — معاينة فعاليات اليوم ${activeDay} (متبقي ${daysUntilConference} أيام)` 
                    : `NEXT FEATURE — العرض المقرّر القادم (اليوم ${displayAct.day})`);

            stageWrap.innerHTML = `
            <div class="hero-backdrop-image" style="background-image:url('${bgImg}')"></div>
            <div class="hero-stage-content">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                    <span class="hero-meta-badge">
                        <i class="bi ${isLive ? 'bi-broadcast text-success' : 'bi-calendar-event text-warning'} me-1"></i>
                        ${stageBadgeText}
                    </span>
                    <div class="d-flex align-items-center gap-2">
                        <span class="hero-meta-badge" style="border-color:var(--retro-amber); color:var(--retro-amber);">${getGateCode(displayAct.place)}</span>
                    </div>
                </div>

                <div class="hero-title-main">${escapeHTML(displayAct.title)}</div>

                ${mealImg ? `
                <div class="d-flex align-items-center gap-3 p-3 my-3" onclick="openMealModal('${mealImg}', '${escapeHTML(displayAct.title)}')" style="background:rgba(15,23,42,0.85); border:1.5px solid rgba(251,191,36,0.5); border-radius:16px; backdrop-filter:blur(10px); cursor:pointer; box-shadow:0 0 20px rgba(0,0,0,0.6); transition:transform 0.2s ease;" onmouseover="this.style.transform='scale(1.01)'" onmouseout="this.style.transform='scale(1)'">
                    <div style="width:110px; height:75px; border-radius:12px; overflow:hidden; border:1.5px solid #fbbf24; flex-shrink:0; position:relative;">
                        <img src="${mealImg}" alt="${escapeHTML(displayAct.title)}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div>
                        <div style="font-size:0.75rem; color:var(--retro-amber); font-weight:800; letter-spacing:1px;"><i class="bi bi-journal-check me-1"></i>منيو الوجبة المعتمد 🍽️</div>
                        <div style="font-size:1.05rem; font-weight:900; color:#ffffff; margin:2px 0;">اضغط هنا لتكبير وعرض المنيو كاملاً HD</div>
                        <div style="font-size:0.78rem; color:#94a3b8;">معاينة المنيو دون التأثير على أبعاد الشاشة</div>
                    </div>
                </div>` : ''}

                ${displayAct.speaker ? `
                <div class="d-flex align-items-center gap-3 p-3 my-3" style="background:rgba(15,23,42,0.85); border:1.5px solid rgba(251,191,36,0.5); border-radius:16px; backdrop-filter:blur(10px); box-shadow:0 0 20px rgba(0,0,0,0.6);">
                    <img src="${displayAct.speakerImg || '../assets/img/fr_anianous.png'}" alt="${displayAct.speaker}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:2.5px solid var(--retro-amber); box-shadow:0 0 15px rgba(251,191,36,0.6); flex-shrink:0;">
                    <div>
                        <div style="font-size:0.75rem; color:var(--retro-amber); font-weight:800; letter-spacing:1px;">🎙️ المحاضر الرئيسي</div>
                        <div style="font-size:1.2rem; font-weight:900; color:#ffffff; margin:2px 0;">${escapeHTML(displayAct.speaker)}</div>
                        <div style="font-size:0.8rem; color:#94a3b8;">دراسة كتابية وروحية لأسفار الكتاب المقدس</div>
                    </div>
                </div>` : ''}

                ${Array.isArray(displayAct.points) && displayAct.points.length > 0 ? `
                <div class="my-3">
                    <div style="font-size:0.85rem; color:var(--retro-cyan); font-weight:900; margin-bottom:8px;"><i class="bi bi-bookmarks-fill me-1"></i>المفاهيم والنقاط الرئيسية للمحاضرة:</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
                        ${displayAct.points.map(pt => `
                            <div style="background:rgba(0,255,136,0.08); border:1px solid rgba(0,255,136,0.3); border-radius:10px; padding:8px 12px; font-size:0.82rem; color:#e2e8f0; font-weight:700; display:flex; align-items:center; gap:6px;">
                                <span style="color:var(--retro-green);">✨</span> ${escapeHTML(pt)}
                            </div>
                        `).join('')}
                    </div>
                </div>` : (!mealImg ? `
                <div style="font-size:0.95rem; color:#cbd5e1; margin-bottom:16px; font-weight:600; line-height:1.5;">
                    ${escapeHTML(displayAct.notes || TYPE_LABELS[displayAct.type] || 'الفقرة الرئيسية المعتمدة في القاعة')}
                </div>` : '')}

                <!-- شريط الإنجاز والمتبقي -->
                <div class="d-flex align-items-center justify-content-between" style="font-size:0.9rem; font-weight:900;">
                    <span style="color:var(--retro-green);"><i class="bi bi-speedometer2 me-1"></i>${isLive ? 'تقدم الفقرة: ' + pct + '%' : 'في انتظار الانطلاق'}</span>
                    <span style="color:var(--retro-amber);"><i class="bi bi-hourglass-split me-1"></i>${isLive ? 'متبقي على الانتهاء: ' + remain + ' دقيقة' : (isPreConferenceDate ? 'تبدأ يوم ' + (displayAct.day === 1 ? '10 أغسطس' : (displayAct.day === 2 ? '11 أغسطس' : '12 أغسطس')) + ' الساعة ' + formatTime12(displayAct.time) : (remain > 0 ? 'تبدأ بعد: ' + remain + ' دقيقة' : 'موعد الفعالية: ' + formatTime12(displayAct.time)))}</span>
                </div>
                <div style="height:12px; border-radius:4px; background:rgba(255,255,255,0.1); overflow:hidden; margin:10px 0 14px; border:1px solid var(--retro-green);">
                    <div style="height:100%; width:${isLive ? pct : 5}%; background:linear-gradient(90deg,#00ff88,#00e5ff); transition:width 0.5s ease; box-shadow:0 0 15px rgba(0,255,136,0.8);"></div>
                </div>

                <!-- ⏳ أنيميشن الساعة الرملية قبل 5 دقائق -->
                <div class="hourglass-center-alert ${isExpiringSoon ? 'active' : ''}">
                    <div class="hourglass-spinning-icon">⏳</div>
                    <div>
                        <div style="font-weight:900; font-size:1rem; color:#ffffff;">تنبيه اقتراب النهاية! متبقي <span style="color:var(--retro-red); font-size:1.1rem;">${remain} دقائق فقط</span>!</div>
                        <div style="font-size:0.8rem; color:#e2e8f0; margin-top:2px;">يرجى الإنهاء والتأهب للانتقال للفقرة التالية في الجدول.</div>
                    </div>
                </div>

                <div class="d-flex align-items-center justify-content-between mt-3 pt-2" style="border-top:1px dashed rgba(255,255,255,0.15); font-size:0.85rem;">
                    <span style="color:#cbd5e1; font-weight:800;"><i class="bi bi-clock-fill me-1" style="color:var(--retro-amber)"></i>التوقيت: من ${formatTime12(displayAct.time)} إلى ${formatTime12(displayAct.endTime)}</span>
                    <span style="color:var(--retro-cyan); font-weight:900;">YOUTH CONF SYSTEM</span>
                </div>
            </div>`;
        }
    }

    /* ─── ⚙️ تهيئة نافذة الإعدادات وتبديل الأيام ─── */
    function initControls() {
        const chimeBtn = document.getElementById('testChimeBtn');
        if (chimeBtn) chimeBtn.addEventListener('click', playAirportChime);

        // أزرار التبديل بين الأيام (اليوم 1، 2، 3، 4)
        document.querySelectorAll('.day-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetDay = Number(e.currentTarget.getAttribute('data-day') || e.target.getAttribute('data-day'));
                userSelectedDay = targetDay;
                simDay = targetDay;
                document.querySelectorAll('.day-tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                computeTelemetry();
            });
        });

        const modeRealRadio = document.getElementById('modeRealRadio');
        const modeSimRadio  = document.getElementById('modeSimRadio');
        const simInputsWrap = document.getElementById('simInputsWrap');

        const simDaySel = document.getElementById('modalSimDaySelect');
        const simTimeIn = document.getElementById('modalSimTimeInput');

        if (modeRealRadio) {
            modeRealRadio.addEventListener('change', () => {
                simMode = false;
                if (simInputsWrap) simInputsWrap.style.display = 'none';
                computeTelemetry();
            });
        }

        if (modeSimRadio) {
            modeSimRadio.addEventListener('change', () => {
                simMode = true;
                if (simInputsWrap) simInputsWrap.style.display = 'block';
                computeTelemetry();
            });
        }

        if (simDaySel) simDaySel.addEventListener('change', (e) => { simDay = Number(e.target.value); simMode = true; computeTelemetry(); });
        if (simTimeIn) simTimeIn.addEventListener('input', (e) => { simTimeStr = e.target.value; simMode = true; computeTelemetry(); });
    }

    /* ─── إطلاق التطبيق ─── */
    function startApp() {
        if (!window.DataService) {
            setTimeout(startApp, 50);
            return;
        }

        const loader = DataService.loadConference ? DataService.loadConference() : DataService.loadStructure();
        loader.then(data => {
            fullProgramData = data.program || [];
            conferenceMeta   = data.meta || {};
            if (data.participants && data.participants.length > 0) {
                allParticipants = data.participants;
            }

            initControls();
            loadParticipants();
            computeTelemetry();
            updateAnalogClock();

            setInterval(() => {
                updateAnalogClock();
                computeTelemetry();
            }, 1000);
        }).catch(err => console.error('Error loading data for retro live board:', err));
    }

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
