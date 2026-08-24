/* workshops.js — منطق ورش العمل مع 3 مهام مقفلة تماماً بعداد تنازلي حقيقي يُفتح تلقائياً فقط قبل النهاية بـ 15 دقيقة والتخزين محلياً */
(function () {
    'use strict';

    const modal      = document.getElementById('workshopModal');
    const modalTitle = document.getElementById('ws-modal-title');
    const modalBody  = document.getElementById('ws-modal-body');
    let bsModal;
    let countdownTimerInterval = null;

    // البيانات الثابتة والمضمونة لورش العمل مع الـ 3 مهام وتوقيت الفتح والتاريخ المحدد
    const workshopsData = {
        1: {
            day: 1,
            date: "2026-08-10",
            dateLabel: "الاثنين 10 أغسطس 2026",
            title: "فك الشفرة: من يقود فكرك؟ 🧠",
            speaker: "فريق الورش والتدريب",
            time: "6:30 pm - 8:30 pm",
            startTimeStr: "18:30",
            endTimeStr: "20:30",
            unlockTimeStr: "20:15", // فتح التقييم والمهام الـ 15 دقيقة الأخيرة (8:15 م)
            place: "قاعة ورش العمل",
            summary: "اكتشف المؤثرات الخفية التي تشكل أفكارك اليومية وقراراتك الشخصية في جلسة تفاعلية شيقة.",
            objectives: [
                "مصادر المؤثرة علي فكر الشباب",
                "الفرق بين صوت المجتمع و صوت الله",
                "ليس كل ماهو منتشر صحيح"
            ],
            tasks: [
                "صورة بالأشخاص 📸",
                "بناء جسر يتحمل أقصى وزن 🌉",
                "مين الشخص اللي بنتكلم عنه؟ 👤"
            ]
        },
        2: {
            day: 2,
            date: "2026-08-11",
            dateLabel: "الثلاثاء 11 أغسطس 2026",
            title: "البوصلة والذكاء الاصطناعي: من القائد؟ 🧭🤖",
            speaker: "فريق الورش والتدريب",
            time: "7:30 pm - 9:30 pm",
            startTimeStr: "19:30",
            endTimeStr: "21:30",
            unlockTimeStr: "21:15", // فتح التقييم والمهام الـ 15 دقيقة الأخيرة (9:15 م)
            place: "قاعة ورش العمل",
            summary: "رحلة ممتعة لمعرفة ما يقود حياتك، وكيف تكون قائداً متميزاً في عصر التكنولوجيا والذكاء الاصطناعي.",
            objectives: [
                "اكتشاف ما يقود حياتي",
                "فهم الفرق بين القيادي و المسيطر",
                "التعامل الصحيح مع التكنولوجيا و AI"
            ],
            tasks: [
                "تحديد البوصلة الشخصية والهدف الرئيسي من الورشة 🧭",
                "مراجعة الاستخدام المتزن للذكاء الاصطناعي في حياتك 🤖",
                "مشاركة التجربة والعمل الجماعي مع قائد المجموعة 👥"
            ]
        },
        3: {
            day: 3,
            date: "2026-08-12",
            dateLabel: "الأربعاء 12 أغسطس 2026",
            title: "خريطة الطريق والشخصيات السبعة 🗺️👤",
            speaker: "فريق الورش والتدريب",
            time: "2:00 pm - 4:00 pm",
            startTimeStr: "14:00",
            endTimeStr: "16:00",
            unlockTimeStr: "15:45", // فتح التقييم والمهام الـ 15 دقيقة الأخيرة (3:45 عصراً)
            place: "قاعة ورش العمل",
            summary: "تعلم المعايير الذهبية لتقييم مسارك الشخصي والروحي، واكتشف أسرار الشخصيات السبعة.",
            objectives: [
                "أزاي أعرف اني ماشي صح",
                "شخصيات السابعة"
            ],
            tasks: [
                "تقييم مسارك الشخصي بناءً على خريطة الطريق 🗺️",
                "تحديد النمط الأقرب لك من الشخصيات السبعة 👤",
                "كتابة الهدف الروحي والعملي للأسبوع القادم 🎯"
            ]
        }
    };

    function getUnlockTargetTime(ws) {
        const now = new Date();
        const [uH, uM] = ws.unlockTimeStr.split(':').map(Number);

        if (ws.date) {
            const [y, m, d] = ws.date.split('-').map(Number);
            const target = new Date(y, m - 1, d, uH, uM, 0, 0);
            // إذا كان اليوم الحالي هو تاريخ الورشة أو بعده
            return target.getTime();
        } else {
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), uH, uM, 0, 0);
            return target.getTime();
        }
    }

    function checkUnlockStatus(ws) {
        const now = new Date();
        const targetMs = getUnlockTargetTime(ws);
        const diffMs = targetMs - now.getTime();

        if (diffMs <= 0) {
            // تفتح المهام ولا تغلق مرة أخرى أبداً من بعد هذا الوقت
            return { isUnlocked: true, label: "المهام مفتوحة الآن" };
        } else {
            return {
                isUnlocked: false,
                diffMs: diffMs
            };
        }
    }

    function formatCountdownString(diffMs) {
        if (diffMs <= 0) return "00:00:00";
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        const hh = String(hours).padStart(2, '0');
        const mm = String(mins).padStart(2, '0');
        const ss = String(secs).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    function startLiveCountdown(ws) {
        if (countdownTimerInterval) clearInterval(countdownTimerInterval);

        countdownTimerInterval = setInterval(() => {
            const timerEl = document.getElementById(`ws-live-countdown-${ws.day}`);
            const status = checkUnlockStatus(ws);

            if (status.isUnlocked) {
                clearInterval(countdownTimerInterval);
                const tasksContainer = document.getElementById(`ws-tasks-container-${ws.day}`);
                if (tasksContainer) {
                    tasksContainer.innerHTML = renderTasksContent(ws, true);
                }
            } else if (timerEl) {
                timerEl.textContent = formatCountdownString(status.diffMs);
            }
        }, 1000);
    }

    function renderTasksContent(ws, isUnlocked) {
        const savedCompleted = JSON.parse(localStorage.getItem(`ws_completed_tasks_${ws.day}`) || '[]');

        if (isUnlocked) {
            const tasksListHtml = ws.tasks.map((taskText, idx) => {
                const isDone = savedCompleted.includes(idx);
                return `
                    <div class="ws-task-item ${isDone ? 'completed' : ''}" onclick="toggleTask(${ws.day}, ${idx}, this)">
                        <div class="ws-task-checkbox">
                            ${isDone ? '<i class="bi bi-check-lg"></i>' : ''}
                        </div>
                        <div class="ws-task-text">${taskText}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <div class="fw-bold" style="color:#10b981; font-size:1rem;">
                        <i class="bi bi-check2-square me-1"></i> المهام والتقييمات التفاعلية للورشة
                    </div>
                    <span class="badge bg-success-subtle text-success border border-success" style="font-size:0.75rem;">
                        <i class="bi bi-unlock-fill me-1"></i> مفتوحة للتقييم
                    </span>
                </div>
                ${tasksListHtml}
                <div style="font-size:0.75rem; color:#64748b; margin-top:8px; text-align:center;">
                    اضغط على علامة الصح ✓ لإتمام المهمة (تُحفظ محلياً على هاتفك)
                </div>
            `;
        } else {
            const status = checkUnlockStatus(ws);
            const initialTimerStr = formatCountdownString(status.diffMs);

            return `
                <div class="ws-countdown-wrap mb-3">
                    <i class="bi bi-lock-fill text-warning fs-3 mb-2 d-block"></i>
                    <div style="color:#fde68a; font-weight:800; font-size:0.95rem;">🔒 مقفلة بانتظار التقييم والمهام الختامية للورشة</div>
                    <div class="ws-countdown-timer" id="ws-live-countdown-${ws.day}">${initialTimerStr}</div>
                    <div style="font-size:0.78rem; color:#94a3b8; margin-top:4px;">تُفتح المهام والتقييم تلقائياً مع نهاية الورشة</div>
                </div>
            `;
        }
    }

    function renderTasksHtml(ws) {
        const status = checkUnlockStatus(ws);
        if (!status.isUnlocked) {
            startLiveCountdown(ws);
        }

        return `
            <div class="ws-tasks-wrap" id="ws-tasks-container-${ws.day}">
                ${renderTasksContent(ws, status.isUnlocked)}
            </div>
        `;
    }

    function openModal(dayNum) {
        const ws = workshopsData[dayNum];
        if (!ws || !modal) return;

        modalTitle.innerHTML = `<span style="color:#fb7185">${ws.title}</span>`;
        
        const objectivesHtml = (ws.objectives || []).map((obj, idx) => `
            <div class="objective-item">
                <div class="objective-num">${idx + 1}</div>
                <div class="objective-text">${obj}</div>
            </div>
        `).join('');

        const tasksHtml = renderTasksHtml(ws);

        modalBody.innerHTML = `
            <div class="d-flex flex-wrap gap-2 mb-4">
                <span class="meta-chip"><i class="bi bi-person-fill text-warning"></i>${ws.speaker}</span>
                <span class="meta-chip"><i class="bi bi-clock-fill text-danger"></i>${ws.time}</span>
                <span class="meta-chip"><i class="bi bi-geo-alt-fill text-info"></i>${ws.place}</span>
            </div>
            
            ${ws.summary ? `<p class="mb-4" style="color:var(--text-secondary);font-size:.9rem;line-height:1.6;text-align:justify;">${ws.summary}</p>` : ''}
            
            ${objectivesHtml ? `
                <div class="mb-4">
                    <div class="section-label mb-3" style="color:#fbbf24; font-size:0.95rem; font-weight:800;"><i class="bi bi-bullseye me-1"></i> أهداف الورشة الأساسية</div>
                    <div class="objectives-list">${objectivesHtml}</div>
                </div>
            ` : ''}

            ${tasksHtml}
        `;
        
        if (!bsModal) bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }

    // دالة تفاعلية لتبديل حالة المهمة وحفظها محلياً على الهاتف
    window.toggleTask = function(dayNum, idx, el) {
        if (!el) return;
        const savedCompleted = JSON.parse(localStorage.getItem(`ws_completed_tasks_${dayNum}`) || '[]');
        
        let newSaved;
        if (savedCompleted.includes(idx)) {
            newSaved = savedCompleted.filter(i => i !== idx);
            el.classList.remove('completed');
            const chk = el.querySelector('.ws-task-checkbox');
            if (chk) chk.innerHTML = '';
        } else {
            newSaved = [...savedCompleted, idx];
            el.classList.add('completed');
            const chk = el.querySelector('.ws-task-checkbox');
            if (chk) chk.innerHTML = '<i class="bi bi-check-lg"></i>';
            
            if (window.showToast) {
                window.showToast('أحسنت! تم حفظ إتمام المهمة على هاتفك بنجاح 🎉', 'success');
            }
        }
        localStorage.setItem(`ws_completed_tasks_${dayNum}`, JSON.stringify(newSaved));
    };

    window.openWorkshopModal = openModal;

    // ربط التنقل بالتبويبات
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(`ws-panel-day-${this.dataset.day}`)?.classList.add('active');
        });
    });

    // التوجيه المباشر بالرابط
    const params = new URLSearchParams(location.search);
    const directId = params.get('id');
    if (directId) {
        let targetDay = null;
        if (directId === 'd1-w1') targetDay = 1;
        else if (directId === 'd2-w1') targetDay = 2;
        else if (directId === 'd3-w1') targetDay = 3;

        if (targetDay) {
            document.querySelector(`.day-tab[data-day="${targetDay}"]`)?.click();
            setTimeout(() => openModal(targetDay), 200);
        }
    }
})();
