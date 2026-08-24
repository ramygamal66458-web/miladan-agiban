/* ═══════════════════════════════════════════════════════════════════
   full-db-panel.js — لوحة قاعدة البيانات الشاملة
   التعديل المباشر في الخلايا + المزامنة الفورية مع Google Sheets
   ═══════════════════════════════════════════════════════════════════
   
   أعمدة الجدول (9 أعمدة — تطابق HTML thead):
   # | الاسم | المجموعة | الغرفة | الأتوبيس | المقعد | الرأي | الرحلة | إجراءات
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── ربط renderFullDbPanel بـ refreshAll عند تبديل القسم ─── */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var origRefreshAll = window.refreshAll;
        window.refreshAll = function() {
            if (typeof origRefreshAll === 'function') origRefreshAll.apply(this, arguments);
            if (window.currentSection === 'full-db') window.renderFullDbPanel();
        };
    });
})();

/* ─── رسم الجدول الكامل ─── */
window.renderFullDbPanel = function() {
    var dataObj = window.db || (typeof db !== 'undefined' ? db : null);
    if (!dataObj) return;
    var participants = dataObj.participants || [];
    var rooms        = dataObj.rooms        || [];
    var groups       = dataObj.groups       || [];

    // ── إصلاح أي groupId خاطئ في الذاكرة (يُزيل g1 الإجباري) ──
    _fdbFixGroupIds(participants, groups);

    // ── إحصائيات ──
    var groupAssigned = 0, roomAssigned = 0, busAssigned = 0;
    participants.forEach(function(p) {
        if (p.groupId) groupAssigned++;
        if (p.roomId)  roomAssigned++;
        if (p.busNumber) busAssigned++;
    });

    var elTotal  = document.getElementById('fullDbStatTotal');
    var elGroups = document.getElementById('fullDbStatPoints');
    var elRooms  = document.getElementById('fullDbStatRooms');
    var elBuses  = document.getElementById('fullDbStatBuses');
    if (elTotal)  elTotal.textContent  = participants.length;
    if (elGroups) elGroups.textContent = groupAssigned;
    if (elRooms)  elRooms.textContent  = roomAssigned;
    if (elBuses)  elBuses.textContent  = busAssigned;

    // ── فلترة البحث ──
    var inp = document.getElementById('fullDbSearchInput');
    var q   = inp ? inp.value.trim().toLowerCase() : '';
    var filtered = q ? participants.filter(function(p) {
        var gObj  = groups.find(function(g) { return g.id === p.groupId; });
        var gName = gObj ? gObj.name : (p.group || '');
        return (p.name     && p.name.toLowerCase().includes(q))     ||
               (gName      && gName.toLowerCase().includes(q))      ||
               (p.roomId   && String(p.roomId).toLowerCase().includes(q)) ||
               (p.busNumber && String(p.busNumber).includes(q))     ||
               (p.feedback && p.feedback.toLowerCase().includes(q)) ||
               (p.nextTrip && p.nextTrip.toLowerCase().includes(q));
    }) : participants;

    var tbody = document.getElementById('fullDbTableBody');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#64748b;">' +
            '<i class="bi bi-search" style="font-size:2rem;display:block;margin-bottom:8px;"></i>' +
            (q ? 'لا توجد نتائج مطابقة لـ "' + q + '"' : 'لا يوجد مشتركون بعد') +
            '</td></tr>';
        return;
    }

    // ── أنماط الخلايا القابلة للتعديل ──
    var SEL = 'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;border-radius:8px;padding:4px 6px;font-size:0.78rem;width:100%;cursor:pointer;font-family:Cairo,sans-serif;';
    var INP = 'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;border-radius:8px;padding:4px 6px;font-size:0.82rem;text-align:center;font-family:Cairo,sans-serif;';
    var BTN_SAVE = 'background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.5);color:#34d399;border-radius:8px;padding:5px 10px;font-size:0.78rem;cursor:pointer;margin-left:3px;';
    var BTN_EDIT = 'background:rgba(6,182,212,0.2);border:1px solid rgba(6,182,212,0.5);color:#22d3ee;border-radius:8px;padding:5px 10px;font-size:0.78rem;cursor:pointer;';
    var BTN_DEL  = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;border-radius:8px;padding:5px 10px;font-size:0.78rem;cursor:pointer;margin-right:3px;';

    // ── بناء الصفوف — 9 أعمدة تطابق thead ──
    var rows = filtered.map(function(p, idx) {
        var pid = p.id || ('idx-' + participants.indexOf(p));

        // خيارات المجموعة
        var grpVal = p.groupId || '';
        var grpHtml = '<option value=""' + (grpVal === '' ? ' selected' : '') + '>— بدون —</option>' + groups.map(function(g) {
            return '<option value="' + g.id + '"' + (g.id === grpVal ? ' selected' : '') + '>' + (g.name || g.id) + '</option>';
        }).join('');

        // خيارات الغرفة
        var roomVal = p.roomId ? String(p.roomId) : '';
        var roomHtml = '<option value="">— بدون —</option>' + rooms.map(function(r) {
            var v   = String(r.id || '');
            var lbl = r.gender === 'boys' ? '👦' : '👧';
            return '<option value="' + v + '"' + (v === roomVal ? ' selected' : '') + '>' + lbl + ' ' + (r.name || v) + '</option>';
        }).join('');

        // خيارات الأتوبيس
        var busVal  = p.busNumber ? String(p.busNumber) : '';
        var busHtml = '<option value="">— بدون —</option>' +
            '<option value="1"' + (busVal === '1' ? ' selected' : '') + '>أتوبيس 1</option>' +
            '<option value="2"' + (busVal === '2' ? ' selected' : '') + '>أتوبيس 2</option>';

        var seatVal = p.seatNumber || '';
        var feedbackText = (p.feedback || '—').length > 40 ? (p.feedback || '').substring(0, 37) + '...' : (p.feedback || '—');
        var nextTripText = p.nextTrip || '—';

        // 9 أعمدة: # | الاسم | المجموعة | الغرفة | الأتوبيس | المقعد | الرأي | الرحلة | إجراءات
        return '<tr data-pid="' + pid + '" style="border-bottom:1px solid rgba(255,255,255,0.04);" ' +
            'onmouseenter="this.style.background=\'rgba(6,182,212,0.06)\'" ' +
            'onmouseleave="this.style.background=\'\'">' +

            // 1. الترقيم
            '<td style="padding:8px;text-align:center;color:#64748b;font-size:0.8rem;">' + (idx + 1) + '</td>' +

            // 2. الاسم
            '<td style="padding:8px;font-weight:700;color:#f1f5f9;font-size:0.87rem;white-space:nowrap;">' + escapeHTML(p.name) + '</td>' +

            // 3. المجموعة (dropdown)
            '<td style="padding:6px 8px;min-width:110px;"><select onchange="fdbUpdateField(\'' + pid + '\',\'groupId\',this.value)" style="' + SEL + '">' + grpHtml + '</select></td>' +

            // 4. الغرفة (dropdown)
            '<td style="padding:6px 8px;min-width:130px;"><select onchange="fdbUpdateField(\'' + pid + '\',\'roomId\',this.value)" style="' + SEL + '">' + roomHtml + '</select></td>' +

            // 5. الأتوبيس (dropdown)
            '<td style="padding:6px 8px;min-width:100px;"><select onchange="fdbUpdateBus(\'' + pid + '\',this.value)" style="' + SEL + '">' + busHtml + '</select></td>' +

            // 6. المقعد — زر يفتح نافذة المقاعد البصرية
            '<td style="padding:6px;text-align:center;">' +
                '<button class="fdb-seat-pick-btn" onclick="fdbOpenSeatPicker(\'' + pid + '\')" ' +
                'id="fdb-seat-btn-' + pid + '" ' +
                'style="background:' + (seatVal ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)') + ';' +
                'border:1px solid ' + (seatVal ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)') + ';' +
                'color:' + (seatVal ? '#a78bfa' : '#64748b') + ';' +
                'border-radius:8px;padding:4px 10px;font-size:0.78rem;cursor:pointer;font-family:Cairo,sans-serif;' +
                'min-width:52px;transition:all 0.2s;">' +
                (seatVal ? '💈 ' + seatVal : '+ مقعد') +
                '</button>' +
            '</td>' +

            // 7. الرأي
            '<td style="padding:8px;font-size:0.75rem;color:#94a3b8;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHTML(p.feedback || '') + '">' + escapeHTML(feedbackText) + '</td>' +

            // 8. الرحلة
            '<td style="padding:8px;font-size:0.78rem;color:#f472b6;text-align:center;white-space:nowrap;">' + escapeHTML(nextTripText) + '</td>' +

            // 9. إجراءات
            '<td style="padding:6px;text-align:center;white-space:nowrap;">' +
                '<button data-pid="' + pid + '" onclick="fdbSaveRow(\'' + pid + '\')" title="حفظ في Sheets" style="' + BTN_SAVE + '"><i class="bi bi-cloud-arrow-up-fill"></i></button>' +
                '<button onclick="fdbOpenEdit(\'' + pid + '\')" title="تعديل كامل" style="' + BTN_EDIT + '"><i class="bi bi-pencil-fill"></i></button>' +
                '<button onclick="fdbDeleteRow(\'' + pid + '\')" title="حذف" style="' + BTN_DEL + '"><i class="bi bi-trash3"></i></button>' +
            '</td></tr>';
    }).join('');

    tbody.innerHTML = rows;
};

/* ─── البحث عن مشترك بالـ ID ─── */
function _fdbFindParticipant(pid) {
    if (!window.db || !db.participants) return null;
    return db.participants.find(function(p) { return p.id === pid; }) || null;
}

/* ─── escapeHTML fallback ─── */
if (typeof window.escapeHTML !== 'function') {
    window.escapeHTML = function(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, function(c) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    };
}

/* ─── إصلاح groupId في الذاكرة — يُزيل g1 الإجباري من بدون مجموعة ─── */
function _fdbFixGroupIds(participants, groups) {
    if (!participants || !groups) return;
    var validIds = {};
    groups.forEach(function(g) { validIds[g.id] = true; });
    participants.forEach(function(p) {
        // إذا groupId موجود لكن غير موجود في القوائم → null
        if (p.groupId && !validIds[p.groupId]) {
            p.groupId = null;
            p.group   = '';
        }
        // إذا group فارغ لكن groupId موجود → نُصلح العكس أيضاً
        if (!p.group && p.groupId && validIds[p.groupId]) {
            var g = groups.find(function(x) { return x.id === p.groupId; });
            if (g) p.group = g.name;
        }
        // إذا كلاهما فارغ أو null → نضمن null
        if (!p.groupId) {
            p.groupId = null;
            p.group   = '';
        }
    });
}

/* ─── تحديث حقل في الذاكرة + مزامنة فورية مع Google Sheets ─── */
window.fdbUpdateField = async function(pid, field, value) {
    var p = _fdbFindParticipant(pid);
    if (!p) return;

    // ── حفظ القيم السابقة للـ Rollback ──
    var prev = { roomId: p.roomId, room: p.room, groupId: p.groupId, group: p.group };

    // ── تحديث الذاكرة المحلية ──
    if (field === 'groupId') {
        var grp = (db.groups || []).find(function(g) { return g.id === value; });
        p.groupId = value || null;
        p.group   = grp ? grp.name : '';
    } else if (field === 'roomId') {
        if (!value) { p.roomId = null; p.room = ''; }
        else {
            p.roomId = value;
            var rm = (db.rooms || []).find(function(r) { return String(r.id) === String(value); });
            p.room = rm ? String(rm.name || '').replace(/\D/g, '') : value.replace('r', '');
        }
    } else if (field === 'seatNumber') {
        var s = parseInt(value);
        p.seatNumber = isNaN(s) ? null : s;
        p.seat = s ? String(s) : '';
    } else {
        p[field] = value;
    }

    var row = document.querySelector('tr[data-pid="' + pid + '"]');
    if (row) row.style.borderRight = '3px solid #f59e0b';
    if (typeof window.saveToStorage === 'function') window.saveToStorage();
    if (!window.DataService) return;

    // ── مزامنة فورية: غرفة ──
    if (field === 'roomId') {
        window.showToast('⏳ جاري حفظ الغرفة...', 'info');
        try {
            var res = !value
                ? await window.DataService.unassignRoom(p.name)
                : await window.DataService.assignRoom(p.name, value);
            if (res && res.status === 'success') {
                if (row) row.style.borderRight = '3px solid #22c55e';
                window.showToast(value ? '✅ تم تسكين ' + p.name + ' بنجاح' : '✅ تم إلغاء تسكين ' + p.name, 'success');
                setTimeout(function() { if (row) row.style.borderRight = ''; }, 2500);
            } else { throw new Error(res && res.message ? res.message : 'خطأ'); }
        } catch(err) {
            p.roomId = prev.roomId; p.room = prev.room;
            if (row) row.style.borderRight = '3px solid #ef4444';
            window.showToast('❌ فشل حفظ الغرفة: ' + err.message, 'error');
            setTimeout(function() { if (row) row.style.borderRight = ''; window.renderFullDbPanel(); }, 2000);
        }
        return;
    }

    // ── مزامنة فورية: مجموعة ──
    if (field === 'groupId') {
        window.showToast('⏳ جاري حفظ المجموعة...', 'info');
        try {
            var grpObj  = (db.groups || []).find(function(g) { return g.id === value; });
            var grpName = grpObj ? grpObj.name : '';
            var res2 = await window.DataService.updateField(p.name, 'group', grpName);
            if (res2 && res2.status === 'success') {
                if (row) row.style.borderRight = '3px solid #22c55e';
                window.showToast('✅ تم تحديث مجموعة ' + p.name, 'success');
                setTimeout(function() { if (row) row.style.borderRight = ''; }, 2500);
            } else { throw new Error(res2 && res2.message ? res2.message : 'خطأ'); }
        } catch(err) {
            p.groupId = prev.groupId; p.group = prev.group;
            if (row) row.style.borderRight = '3px solid #ef4444';
            window.showToast('❌ فشل حفظ المجموعة: ' + err.message, 'error');
            setTimeout(function() { if (row) row.style.borderRight = ''; }, 2000);
        }
    }
};


/* ─── تحديث الأتوبيس ─── */
window.fdbUpdateBus = function(pid, value) {
    var p = _fdbFindParticipant(pid);
    if (!p) return;
    var n = parseInt(value);
    if (!isNaN(n) && n > 0) {
        p.busNumber = n;
        p.bus = 'أتوبيس ' + n;
    } else {
        p.busNumber = null; p.bus = ''; p.seat = ''; p.seatNumber = null;
        // تحديث زر المقعد
        var seatBtn = document.getElementById('fdb-seat-btn-' + pid);
        if (seatBtn) {
            seatBtn.textContent = '+ مقعد';
            seatBtn.style.background = 'rgba(255,255,255,0.05)';
            seatBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            seatBtn.style.color = '#64748b';
        }
    }
    var row = document.querySelector('tr[data-pid="' + pid + '"]');
    if (row) row.style.borderRight = '3px solid #fbbf24';
    if (typeof window.saveToStorage === 'function') window.saveToStorage();
};

/* ─── نافذة اختيار المقعد البصرية ─── */
var _fdbSeatPickerPid = null;

window.fdbOpenSeatPicker = function(pid) {
    var p = _fdbFindParticipant(pid);
    if (!p) return;
    if (!p.busNumber) {
        window.showToast('اختر الأتوبيس أولاً ثم اختر المقعد ⚛️', 'warning');
        return;
    }
    _fdbSeatPickerPid = pid;
    var modal = document.getElementById('fdbSeatPickerModal');
    if (!modal) { _fdbCreateSeatPickerModal(); modal = document.getElementById('fdbSeatPickerModal'); }
    document.getElementById('fdbSeatPickerBusLabel').textContent = 'أتوبيس ' + p.busNumber + ' — ' + (p.name || '');
    _fdbRenderSeatPickerGrid(p.busNumber, p.seatNumber);
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.fdbCloseSeatPicker = function() {
    var modal = document.getElementById('fdbSeatPickerModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    _fdbSeatPickerPid = null;
};

window.fdbPickSeat = async function(seatNum, isBooked, isMine) {
    if (isBooked && !isMine) {
        window.showToast('هذا المقعد محجوز لشخص آخر!', 'warning');
        return;
    }
    var pid = _fdbSeatPickerPid;
    if (!pid) return;
    var p = _fdbFindParticipant(pid);
    if (!p) return;

    var prevSeat    = p.seatNumber;
    var prevSeatStr = p.seat;
    var prevBus     = p.busNumber;

    // ── 1. تحديث فوري في الذاكرة ──
    if (isMine) {
        p.seatNumber = null; p.seat = '';
    } else {
        p.seatNumber = seatNum; p.seat = String(seatNum);
    }

    // ── 2. تحديث الزر بصرياً ──
    var seatBtn = document.getElementById('fdb-seat-btn-' + pid);
    if (seatBtn) {
        if (isMine) {
            seatBtn.textContent = '+ مقعد';
            seatBtn.style.background = 'rgba(255,255,255,0.05)';
            seatBtn.style.borderColor = 'rgba(255,255,255,0.15)';
            seatBtn.style.color = '#64748b';
        } else {
            seatBtn.textContent = '💈 ' + seatNum;
            seatBtn.style.background = 'rgba(139,92,246,0.2)';
            seatBtn.style.borderColor = 'rgba(139,92,246,0.5)';
            seatBtn.style.color = '#a78bfa';
            seatBtn.disabled = true;
            seatBtn.title = '⏳ جاري الحفظ...';
        }
    }

    var row = document.querySelector('tr[data-pid="' + pid + '"]');
    if (row) row.style.borderRight = '3px solid #f59e0b';
    if (typeof window.saveToStorage === 'function') window.saveToStorage();
    window.fdbCloseSeatPicker();

    window.showToast(isMine ? 'جاري إلغاء المقعد...' : '⏳ جاري الحفظ في Google Sheets...', 'info');

    // ── 3. مزامنة فورية مع Google Sheets ──
    try {
        var res;
        if (isMine) {
            res = await window.DataService.unassignSeat(p.name);
        } else {
            res = await window.DataService.assignSeat(p.name, prevBus, seatNum);
        }

        if (res && res.status === 'success') {
            if (row) row.style.borderRight = '3px solid #22c55e';
            window.showToast(
                isMine
                    ? '✅ تم إلغاء تعيين مقعد ' + p.name
                    : '✅ تم حفظ مقعد ' + seatNum + ' لـ ' + p.name + ' في Google Sheets',
                'success'
            );
            setTimeout(function() { if (row) row.style.borderRight = ''; }, 2500);
        } else {
            throw new Error(res && res.message ? res.message : 'خطأ غير معروف');
        }
    } catch (err) {
        // ── Rollback عند الفشل ──
        p.seatNumber = prevSeat;
        p.seat = prevSeatStr;
        if (seatBtn) {
            if (prevSeat) {
                seatBtn.textContent = '💈 ' + prevSeat;
                seatBtn.style.background = 'rgba(139,92,246,0.2)';
                seatBtn.style.borderColor = 'rgba(139,92,246,0.5)';
                seatBtn.style.color = '#a78bfa';
            } else {
                seatBtn.textContent = '+ مقعد';
                seatBtn.style.background = 'rgba(255,255,255,0.05)';
                seatBtn.style.borderColor = 'rgba(255,255,255,0.15)';
                seatBtn.style.color = '#64748b';
            }
        }
        if (row) row.style.borderRight = '3px solid #ef4444';
        window.showToast('❌ فشل الحفظ في Google Sheets: ' + err.message, 'error');
        setTimeout(function() { if (row) row.style.borderRight = ''; }, 3000);
    } finally {
        if (seatBtn) { seatBtn.disabled = false; seatBtn.title = ''; }
    }
};


function _fdbRenderSeatPickerGrid(busNum, myCurrentSeat) {
    var container = document.getElementById('fdbSeatPickerGrid');
    if (!container) return;
    var SEATS = 49;
    // المقاعد المحجوزة من غير المشترك الحالي
    var takenSeats = (db.participants || []).filter(function(x) {
        return x.busNumber === busNum && x.seatNumber && x.seatNumber !== myCurrentSeat;
    }).map(function(x) { return Number(x.seatNumber); });

    // مخطط جلوس الأتوبيس — نفس ترتيب getSeatLayout() تماماً
    // direction:rtl في CSS يعكس العرض بصرياً بدون تعديل الأرقام
    var layout = [];
    var s = 1;
    // 5 صفوف أمامية
    for (var r = 0; r < 5; r++) { layout.push([s++, s++, 'aisle', s++, s++]); }
    // باب
    layout.push(['door', 'door', 'aisle', s++, s++]);
    // صف فارغ
    layout.push([null, null, 'aisle', s++, s++]);
    // 5 صفوف وسط
    for (var r = 0; r < 5; r++) { layout.push([s++, s++, 'aisle', s++, s++]); }
    // صف خلفية 5 مقاعد
    layout.push([s++, s++, s++, s++, s++]);



    var html = '';
    html += '<div style="font-size:0.7rem;color:#64748b;text-align:center;margin-bottom:8px;">' +
        '<span style="display:inline-block;width:14px;height:14px;background:rgba(16,185,129,0.3);border:1px solid #10b981;border-radius:4px;margin-left:4px;"></span> فارغ &nbsp;&nbsp;' +
        '<span style="display:inline-block;width:14px;height:14px;background:rgba(139,92,246,0.3);border:1px solid #8b5cf6;border-radius:4px;margin-left:4px;"></span> مقعدك &nbsp;&nbsp;' +
        '<span style="display:inline-block;width:14px;height:14px;background:rgba(239,68,68,0.2);border:1px solid #ef4444;border-radius:4px;margin-left:4px;"></span> محجوز</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;direction:rtl;">';
    layout.forEach(function(row) {
        row.forEach(function(cell) {
            if (cell === 'aisle') {
                html += '<div style="width:100%;background:transparent;"></div>';
            } else if (cell === 'door') {
                html += '<div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:6px;text-align:center;font-size:0.6rem;color:#475569;">🚪</div>';
            } else if (!cell) {
                html += '<div></div>';
            } else {
                var sn = cell;
                var isMine = (myCurrentSeat && Number(myCurrentSeat) === sn);
                var isBooked = takenSeats.indexOf(sn) !== -1;
                var bg, border, color, cursor, title;
                if (isMine) {
                    bg='rgba(139,92,246,0.35)'; border='#8b5cf6'; color='#c4b5fd'; cursor='pointer'; title='مقعدك — اضغط لإلغاء التعيين';
                } else if (isBooked) {
                    bg='rgba(239,68,68,0.18)'; border='rgba(239,68,68,0.5)'; color='#f87171'; cursor='not-allowed'; title='محجوز';
                } else {
                    bg='rgba(16,185,129,0.12)'; border='rgba(16,185,129,0.4)'; color='#34d399'; cursor='pointer'; title='مقعد ' + sn + ' — اضغط للتعيين';
                }
                html += '<div onclick="fdbPickSeat(' + sn + ',' + isBooked + ',' + isMine + ')" title="' + title + '" ' +
                    'style="background:' + bg + ';border:1.5px solid ' + border + ';color:' + color + ';' +
                    'border-radius:8px;padding:5px 2px;text-align:center;cursor:' + cursor + ';' +
                    'transition:all 0.15s;font-size:0.72rem;font-weight:800;">' + sn + '</div>';
            }
        });
    });
    html += '</div>';
    container.innerHTML = html;
}

function _fdbCreateSeatPickerModal() {
    var modal = document.createElement('div');
    modal.id = 'fdbSeatPickerModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);display:none;' +
        'align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);';
    modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border:1.5px solid rgba(139,92,246,0.4);border-radius:20px;
            width:100%;max-width:420px;max-height:90vh;overflow-y:auto;padding:20px;position:relative;
            box-shadow:0 20px 60px rgba(0,0,0,0.8);">
            <button onclick="fdbCloseSeatPicker()" style="position:absolute;top:12px;left:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:1rem;line-height:1;">✕</button>
            <div style="text-align:center;margin-bottom:14px;">
                <div style="font-size:1.4rem;margin-bottom:4px;">🚍</div>
                <div id="fdbSeatPickerBusLabel" style="font-weight:900;color:#fff;font-size:0.95rem;"></div>
                <div style="font-size:0.72rem;color:#64748b;margin-top:2px;">انقر على أي مقعد أخضر لتعيينه</div>
            </div>
            <div id="fdbSeatPickerGrid"></div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) window.fdbCloseSeatPicker(); });
}

/* ─── حفظ صف واحد في Google Sheets ─── */
window.fdbSaveRow = async function(pid) {
    var p = _fdbFindParticipant(pid);
    if (!p) return;

    var btn = document.querySelector('button[data-pid="' + pid + '"]');
    if (btn) { btn.innerHTML = '<i class="bi bi-hourglass-split"></i>'; btn.disabled = true; }
    var row = document.querySelector('tr[data-pid="' + pid + '"]');

    try {
        var groupObj = (db.groups || []).find(function(g) { return g.id === p.groupId; });
        var groupName = groupObj ? groupObj.name : (p.group || '');

        /* ★ نستخدم action: 'update' مع حماية الحقول الفارغة:
           لو كانت قيمة الحقل فارغة في الكائن لكن موجودة في الشيت —
           نحميها بإرسال علامة خاصة للحفاظ على القيمة الموجودة */
        var payload = {
            action  : 'update',
            name    : p.name    || '',
            group   : groupName,
            room    : p.roomId  ? String(p.roomId).replace(/^r/, '') : '',
            bus     : p.busNumber  ? ('\u0623\u062a\u0648\u0628\u064a\u0633 ' + p.busNumber) : '',
            seat    : p.seatNumber ? String(p.seatNumber) : '',
            gender  : p.gender  || '',
            /* إشارة للسيرفر: حقول فارغة = احتفظ بالقيمة الموجودة في الشيت */
            preserveEmpty: true
        };

        var res = await window.DataService.sendToGAS(payload);

        if (res && (res.status === 'success' || res.status === 'offline')) {
            window.showToast('✅ تم حفظ "' + p.name + '" في Google Sheets', 'success');
            if (btn) btn.innerHTML = '<i class="bi bi-check-circle-fill" style="color:#34d399"></i>';
            if (row) row.style.borderRight = '3px solid #34d399';
            setTimeout(function() {
                if (btn) { btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill"></i>'; btn.disabled = false; }
                if (row) row.style.borderRight = '';
            }, 2500);
        } else {
            throw new Error(res && res.message ? res.message : 'خطأ غير معروف');
        }
    } catch(e) {
        window.showToast('❌ فشل حفظ "' + p.name + '": ' + e.message, 'error');
        if (btn) { btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill"></i>'; btn.disabled = false; }
        if (row) row.style.borderRight = '3px solid #ef4444';
    }
};

/* ─── حذف مشترك ─── */
window.fdbDeleteRow = function(pid) {
    var p = _fdbFindParticipant(pid);
    if (!p) return;
    if (typeof window.deleteParticipant === 'function') {
        window.deleteParticipant(pid);
    } else {
        if (!confirm('هل تريد حذف "' + p.name + '" نهائياً؟')) return;
        var idx = db.participants.findIndex(function(x) { return x.id === pid; });
        if (idx !== -1) {
            db.participants.splice(idx, 1);
            if (typeof window.saveToStorage === 'function') window.saveToStorage();
            window.renderFullDbPanel();
            window.showToast('تم حذف "' + p.name + '"', 'info');
        }
    }
};

/* ─── فتح نافذة تعديل كامل ─── */
window.fdbOpenEdit = function(pid) {
    if (typeof window.openEdit === 'function') {
        window.openEdit(pid);
    } else {
        // fallback
        var p = _fdbFindParticipant(pid);
        if (!p) return;
        window.editingParticipantId = pid;
        if (typeof window.populateDropdowns === 'function') window.populateDropdowns();
        $('#editName').val(p.name || '');
        $('#editGroup').val(p.groupId || 'none');
        $('#editBus').val(p.busNumber ? String(p.busNumber) : 'none');
        $('#editSeat').val(p.seatNumber || '');
        $('#editRoom').val(p.roomId || 'none');
        $('#editGender').val(p.gender || '');
        $('#editSeatInfo').text('المشترك: ' + (p.name || '—'));
        $('#editTitle').text('تعديل بيانات المشترك');
        $('#editOverlay').addClass('show');
    }
};

/* ─── رفع الكل لـ Google Sheets (bulk) ─── */
window.pushAllToSheetFromMaster = async function() {
    if (!window.db || !db.participants || db.participants.length === 0) {
        window.showToast('لا توجد بيانات للرفع', 'error'); return;
    }
    var btn   = document.getElementById('fullDbSyncBtn');
    var icon  = document.getElementById('fullDbSyncIcon');
    var label = document.getElementById('fullDbSyncLabel');
    if (btn) btn.disabled = true;
    if (icon) icon.className = 'bi bi-hourglass-split';
    if (label) label.textContent = 'جاري الرفع...';

    var items = db.participants.map(function(p) {
        var groupObj = (db.groups || []).find(function(g) { return g.id === p.groupId; });
        return {
            name:     p.name     || '',
            group:    groupObj ? groupObj.name : (p.group || ''),
            bus:      p.busNumber ? ('أتوبيس ' + p.busNumber) : '',
            seat:     p.seatNumber ? String(p.seatNumber) : '',
            room:     p.roomId ? String(p.roomId).replace(/^r/, '') : '',
            gender:   p.gender   || '',
            feedback: p.feedback || '',
            nextTrip: p.nextTrip || ''
        };
    });

    try {
        var res = await window.DataService.sendToGAS({ action: 'bulkImport', items: items });
        if (res && (res.status === 'success' || res.status === 'offline')) {
            window.showToast('✅ تم رفع ' + (res.count || items.length) + ' مشترك بنجاح!', 'success');
            if (icon) icon.className = 'bi bi-check-circle-fill';
            if (label) label.textContent = 'تم الرفع ✅';
            setTimeout(function() {
                if (icon) icon.className = 'bi bi-cloud-arrow-up-fill';
                if (label) label.textContent = 'رفع للشيت';
                if (btn) btn.disabled = false;
            }, 3000);
        } else { throw new Error(res && res.message ? res.message : 'فشل'); }
    } catch(e) {
        window.showToast('❌ ' + e.message, 'error');
        if (icon) icon.className = 'bi bi-cloud-arrow-up-fill';
        if (label) label.textContent = 'رفع للشيت';
        if (btn) btn.disabled = false;
    }
};
