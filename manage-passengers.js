/* ========================================================
   manage-passengers.js — مؤتمر الشباب 2026
   لوحة الإدارة الشاملة (أتوبيسات / غرف وسكن / مجموعات)
   يرتبط بالكامل بـ conference-data.json ويحفظ المسودات محلياً
   ======================================================== */

'use strict';

const SEATS_PER_BUS = 49;
let db = null; // قاعدة البيانات الكاملة للمؤتمر

let currentSection = 'buses'; // الأقسام: buses, rooms, groups
let currentBus = 1; // الأتوبيس النشط
let currentGender = 'boys'; // الجنس النشط للغرف: boys, girls
let currentFloor = null; // الدور النشط للغرف

let editingParticipantId = null; // معرف المشترك الجاري تعديله
let hasUnsavedChanges = false; // هل توجد تغييرات محلية لم تُصدر كملف بعد
let hasExported = false; // هل تم تصدير الملف في الجلسة الحالية

/* ========================================================
   أدوات الحماية والأمان والـ Helper Functions
   ======================================================== */
function escapeHTML(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function showToast(msg, type = 'info') {
    const cls = 'toast-msg toast-' + type;
    const $toast = $('<div class="' + cls + '">' + msg + '</div>');
    $('body').append($toast);
    setTimeout(() => $toast.addClass('show'), 50);
    setTimeout(() => {
        $toast.removeClass('show');
        setTimeout(() => $toast.remove(), 400);
    }, 2500);
}

function showConfirm(title, text, onConfirm) {
    $('#confirmTitle').text(title);
    $('#confirmText').html(text);
    $('#confirmOverlay').addClass('show');

    $('#confirmYes').off('click').on('click', function() {
        closeConfirm();
        onConfirm();
    });
}

function closeConfirm() {
    $('#confirmOverlay').removeClass('show');
}

/* ========================================================
   إدارة البيانات — Google Sheets هو المصدر الوحيد
   لا يتم تخزين المشتركين في localStorage بعد الآن
   ======================================================= */
function saveToStorage() {
    if (!db) return;
    try {
        // تحديث cache الذاكرة فقط (DataService + window.conferenceData)
        if (window.DataService) {
            window.DataService.cachedData = db;
            window.DataService.lastFetchTime = Date.now();
        }
        window.conferenceData = db;
        updateSaveIndicator();
    } catch (e) {
        console.error('Error updating DataService cache:', e);
    }
}

function loadFromStorage() {
    // لا يتم التحميل من localStorage — Google Sheets هو المصدر الوحيد
    return false;
}

function updateSaveIndicator() {
    const $dot    = $('#saveDot');
    const $status = $('#saveStatus');
    if (hasUnsavedChanges) {
        $dot.addClass('unsaved');
        $status.text('جاري الحفظ في Google Sheets...');
    } else {
        $dot.removeClass('unsaved');
        $status.text('متزامن مع Google Sheets ✅');
    }
}

function markUnsaved() {
    hasUnsavedChanges = true;
    hasExported = false;
    updateSaveIndicator();
}

/* ========================================================
   بناء شريط الإحصائيات الديناميكي
   ======================================================== */
function renderStatsBar() {
    if (!db) return;
    const participants = db.participants || [];
    const rooms = db.rooms || [];
    const buses = db.buses || [];
    const groups = db.groups || [];

    if (currentSection === 'buses') {
        $('#statLabel1').text('الركاب');
        $('#statLabel2').text('المقاعد الفاضية');
        $('#statLabel3').text('إجمالي المقاعد');

        const totalPassengers = participants.filter(p => p.busNumber != null).length;
        const totalSeats = buses.reduce((acc, b) => acc + (b.capacity || 0), 0);
        const totalEmpty = totalSeats - totalPassengers;

        $('#statVal1').text(totalPassengers).removeClass().addClass('stat-value purple');
        $('#statVal2').text(totalEmpty).removeClass().addClass('stat-value green');
        $('#statVal3').text(totalSeats).removeClass().addClass('stat-value cyan');
    } else if (currentSection === 'rooms') {
        $('#statLabel1').text('إجمالي المقيمين');
        $('#statLabel2').text('الأسرّة الفاضية');
        $('#statLabel3').text('إجمالي الأسرّة');

        const totalResidents = participants.filter(p => p.roomId != null).length;
        const totalBeds = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
        const totalEmpty = totalBeds - totalResidents;

        $('#statVal1').text(totalResidents).removeClass().addClass('stat-value purple');
        $('#statVal2').text(totalEmpty).removeClass().addClass('stat-value green');
        $('#statVal3').text(totalBeds).removeClass().addClass('stat-value cyan');
    } else if (currentSection === 'groups') {
        $('#statLabel1').text('إجمالي المشتركين');
        $('#statLabel2').text('مجموع نقاط المجموعات');
        $('#statLabel3').text('عدد المجموعات');

        const totalParticipants = participants.length;
        const totalPoints = groups.reduce((acc, g) => acc + calcGroupGrandTotal(g.id), 0);

        $('#statVal1').text(totalParticipants).removeClass().addClass('stat-value purple');
        $('#statVal2').text(totalPoints).removeClass().addClass('stat-value green');
        $('#statVal3').text(groups.length).removeClass().addClass('stat-value cyan');
    } else if (currentSection === 'schedule') {
        $('#statLabel1').text('اليوم النشط');
        $('#statLabel2').text('عدد الفعاليات');
        $('#statLabel3').text('إجمالي الأيام');

        const activeDayEvents = (db.schedule && db.schedule[`day${currentScheduleDay}`]) ? db.schedule[`day${currentScheduleDay}`].length : 0;

        $('#statVal1').text('اليوم ' + currentScheduleDay).removeClass().addClass('stat-value purple');
        $('#statVal2').text(activeDayEvents).removeClass().addClass('stat-value green');
        $('#statVal3').text('4 أيام').removeClass().addClass('stat-value cyan');
    } else if (currentSection === 'cloud') {
        $('#statLabel1').text('حالة المزامنة');
        $('#statLabel2').text('إجمالي المشتركين');
        $('#statLabel3').text('التقييمات المسجلة');

        const isCloudConnected = window.DataService && window.DataService.getGasUrl();

        $('#statVal1').text(isCloudConnected ? 'متصل ✅' : 'محلي ⚠️').removeClass().addClass(isCloudConnected ? 'stat-value green' : 'stat-value purple');
        $('#statVal2').text(participants.length).removeClass().addClass('stat-value cyan');
        
        let feedbacksCount = 0;
        try {
            feedbacksCount = JSON.parse(localStorage.getItem('yc2_user_feedbacks') || '[]').length;
        } catch (e) {}
        $('#statVal3').text(feedbacksCount).removeClass().addClass('stat-value green');
    }
}

let currentScheduleDay = 1;

function switchSection(section) {
    currentSection = section;

    $('.section-tab').removeClass('active');
    $(`.section-tab[data-section="${section}"]`).addClass('active');

    $('#buses-panel').toggle(section === 'buses');
    $('#rooms-panel').toggle(section === 'rooms');
    $('#groups-panel').toggle(section === 'groups');
    $('#admin-scores-panel').toggle(section === 'admin-scores');
    $('#games-leaderboard-panel').toggle(section === 'games-leaderboard');
    $('#full-db-panel').toggle(section === 'full-db');
    $('#schedule-panel').toggle(section === 'schedule');
    $('#cloud-panel').toggle(section === 'cloud');

    // إظهار البحث وحالة الحفظ وأزرار التحكم فقط في تبويبي الأتوبيسات والغرف
    const showControls = (section === 'buses' || section === 'rooms');
    $('.search-box').toggle(showControls);
    $('#saveIndicator').toggle(showControls);
    $('.action-bar').toggle(showControls);
    if (!showControls) {
        $('#importSection').hide();
    }

    $('#searchInput').val('');

    renderStatsBar();
    refreshAll();

    // عند فتح لوحة السحابة — تحديث حالة الاتصال تلقائياً
    if (section === 'cloud') {
        setTimeout(updateMasterCloudStatus, 300);
    }

    // عند فتح قسم المجموعات — تحميل نقاط المجموعات تلقائياً
    if (section === 'groups') {
        setTimeout(function() {
            if (typeof window.renderGroupsPanel === 'function') window.renderGroupsPanel();
        }, 200);
    }

    // عند فتح قاعدة البيانات الشاملة — تحديث الجدول تلقائياً
    if (section === 'full-db') {
        setTimeout(function() {
            if (typeof window.renderFullDbPanel === 'function') window.renderFullDbPanel();
        }, 200);
    }
}

function populateDropdowns() {
    if (!db) return;

    // المجموعات
    let groupHtml = '<option value="none">بدون مجموعة</option>';
    if (db.groups) {
        db.groups.forEach(g => {
            groupHtml += `<option value="${g.id}">${escapeHTML(g.name)}</option>`;
        });
    }
    $('#editGroup, #addGroup').html(groupHtml);

    // الغرف
    let roomHtml = '<option value="none">بدون تسكين</option>';
    if (db.rooms) {
        db.rooms.forEach(r => {
            const genderLbl = r.gender === 'boys' ? '👦 أولاد' : '👧 بنات';
            roomHtml += `<option value="${r.id}">${escapeHTML(r.name)} (${genderLbl} - دور ${r.floor})</option>`;
        });
    }
    $('#editRoom, #addRoom').html(roomHtml);
}

function refreshAll() {
    if (currentSection === 'buses') {
        renderBusSubTabs();
        renderSeatsGrid();
        renderPassengerList();
    } else if (currentSection === 'rooms') {
        renderFloorTabs();
        renderRoomsGrid();
        renderRoomsPassengerList();
    } else if (currentSection === 'groups') {
        renderGroupsBoard();
    } else if (currentSection === 'admin-scores') {
        renderAdminScoresPanel();
    } else if (currentSection === 'games-leaderboard') {
        renderGamesLeaderboardPanel();
    } else if (currentSection === 'full-db') {
        renderFullDbPanel();
    } else if (currentSection === 'schedule') {
        renderSchedulePanel();
    } else if (currentSection === 'cloud') {
        renderMasterFeedbacks();
        updateMasterCloudStatus();
    }
}

/* ========================================================
   دالة بناء العنصر الموحد للمشترك
   ======================================================== */
function passengerItemHtml(p, badgeText) {
    const groupObj = db.groups && p.groupId ? db.groups.find(g => g.id === p.groupId) : null;
    const groupName = groupObj ? groupObj.name : '';
    const roomName = db.rooms && p.roomId ? (db.rooms.find(r => r.id === p.roomId)?.name || '') : '';
    const busLbl = p.busNumber ? `أتوبيس ${p.busNumber}` : '';
    const seatLbl = p.seatNumber ? `مقعد ${p.seatNumber}` : '';

    let details = [];
    if (groupName) details.push(`👥 ${groupName}`);
    if (busLbl) details.push(`🚍 ${busLbl} ${seatLbl ? `(م ${p.seatNumber})` : ''}`);
    if (roomName) details.push(`🏠 ${roomName}`);
    const detailsStr = details.join(' · ') || 'لا يوجد تخصيص';

    const dragAttr = currentSection === 'groups' ? `draggable="true" ondragstart="onDragStartParticipant(event, '${p.id}')"` : '';

    return `<div class="passenger-item" ${dragAttr} onclick="openEdit('${p.id}')">
        <div class="p-seat-badge">${badgeText}</div>
        <div class="p-info">
            <div class="p-name">
                <span>${escapeHTML(p.name)}</span>
            </div>
            <div class="p-details">${escapeHTML(detailsStr)}</div>
        </div>
        <div class="p-edit-btn" onclick="event.stopPropagation(); openEdit('${p.id}')" title="تعديل"><i class="bi bi-pencil"></i></div>
        <div class="p-delete-btn" onclick="event.stopPropagation(); deleteParticipant('${p.id}')" title="حذف"><i class="bi bi-trash3"></i></div>
    </div>`;
}

/* ========================================================
   المرحلة 2 — وحدة الأتوبيسات (Bus Grid & List)
   ======================================================== */
function getSeatLayout() {
    const rows = [];
    let seatNum = 1;

    for (let r = 0; r < 5; r++) {
        rows.push([
            { type: 'seat', seatNum: seatNum++ },
            { type: 'seat', seatNum: seatNum++ },
            { type: 'aisle', seatNum: null },
            { type: 'seat', seatNum: seatNum++ },
            { type: 'seat', seatNum: seatNum++ }
        ]);
    }

    rows.push([
        { type: 'door', seatNum: null },
        { type: 'door', seatNum: null },
        { type: 'aisle', seatNum: null },
        { type: 'seat', seatNum: seatNum++ },
        { type: 'seat', seatNum: seatNum++ }
    ]);

    rows.push([
        { type: 'empty', seatNum: null },
        { type: 'empty', seatNum: null },
        { type: 'aisle', seatNum: null },
        { type: 'seat', seatNum: seatNum++ },
        { type: 'seat', seatNum: seatNum++ }
    ]);

    for (let r = 0; r < 5; r++) {
        rows.push([
            { type: 'seat', seatNum: seatNum++ },
            { type: 'seat', seatNum: seatNum++ },
            { type: 'aisle', seatNum: null },
            { type: 'seat', seatNum: seatNum++ },
            { type: 'seat', seatNum: seatNum++ }
        ]);
    }

    rows.push([
        { type: 'seat', seatNum: seatNum++, backRow: true },
        { type: 'seat', seatNum: seatNum++, backRow: true },
        { type: 'seat', seatNum: seatNum++, backRow: true },
        { type: 'seat', seatNum: seatNum++, backRow: true },
        { type: 'seat', seatNum: seatNum++, backRow: true }
    ]);

    return rows;
}

function renderBusSubTabs() {
    if (!db || !db.buses) return;
    
    if (db.buses.length > 0) {
        if (!db.buses.some(b => b.busNumber === currentBus)) {
            currentBus = db.buses[0].busNumber;
        }
    }

    let html = '';
    db.buses.forEach(b => {
        const activeCls = b.busNumber === currentBus ? 'active' : '';
        html += `<div class="bus-tab ${activeCls}" data-bus="${b.busNumber}" onclick="switchBus(${b.busNumber})">🚍 أتوبيس ${b.busNumber}</div>`;
    });
    $('#busSubTabs').html(html);
}

function switchBus(busNum) {
    currentBus = busNum;
    $('#busSubTabs .bus-tab').removeClass('active');
    $(`#busSubTabs .bus-tab[data-bus="${busNum}"]`).addClass('active');
    renderSeatsGrid();
    renderPassengerList();
}

function renderSeatsGrid() {
    if (!db) return;
    const layout = getSeatLayout();
    const busPassengers = db.participants.filter(p => p.busNumber === currentBus);
    let html = `<div class="bus-section-title">🚍 أتوبيس ${currentBus}</div>`;
    html += '<div class="seats-grid">';

    for (const row of layout) {
        for (const cell of row) {
            if (cell.type === 'seat') {
                const passenger = busPassengers.find(p => p.seatNumber === cell.seatNum);
                const isBooked = !!passenger;
                const name = isBooked ? passenger.name : 'فاضي';
                const cls = isBooked ? 'booked' : 'empty';
                const backCls = cell.backRow ? ' back-row-cell' : '';
                html += `<div class="seat-cell ${cls}${backCls}" onclick="openBusSeatClick(${currentBus}, ${cell.seatNum}, event)" title="${isBooked ? escapeHTML(passenger.name) : 'مقعد فاضي - ' + cell.seatNum}">
                    <span class="seat-number">${cell.seatNum}</span>
                    <span class="seat-name">${escapeHTML(name)}</span>
                </div>`;
            } else if (cell.type === 'aisle') {
                html += '<div class="aisle-cell"></div>';
            } else if (cell.type === 'door') {
                if (cell === row[0]) {
                    html += '<div class="door-cell">🪜🚪 سلم</div>';
                }
            } else if (cell.type === 'empty') {
                html += '<div class="seat-cell empty" style="opacity:0.3;cursor:default;border-style:dashed;"></div>';
            }
        }
    }

    html += '</div>';
    $('#seatsContainer').html(html);
}

function renderPassengerList() {
    if (!db) return;
    const searchTerm = $('#searchInput').val().trim().toLowerCase();
    let filtered = db.participants.filter(p => p.busNumber === currentBus);

    if (searchTerm) {
        filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
    }

    filtered.sort((a, b) => a.seatNumber - b.seatNumber);

    let html = '';
    if (filtered.length === 0) {
        html = '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:0.9rem;">لا يوجد ركاب' + (searchTerm ? ' مطابقين للبحث' : ' في هذا الأتوبيس') + '</div>';
    } else {
        for (const p of filtered) {
            html += passengerItemHtml(p, p.seatNumber);
        }
    }

    $('#passengerList').html(html);
    $('#listCount').text(filtered.length + ' راكب');
}

function openBusSeatClick(busNum, seatNum, event) {
    $('.seat-popover').hide();
    const p = db.participants.find(x => x.busNumber === busNum && x.seatNumber === seatNum);
    if (p) {
        openSeatOptionsPopover(p.id, event);
    } else {
        openSeatAssignPopover(busNum, seatNum, event);
    }
}

/* ========================================================
   المرحلة 3 — وحدة الغرف والتسكين (Rooms Module)
   ======================================================== */
function switchGender(gender) {
    currentGender = gender;
    $('#genderTabs .bus-tab').removeClass('active');
    $(`#genderTabs .bus-tab[data-gender="${gender}"]`).addClass('active');

    currentFloor = null;

    renderFloorTabs();
    renderRoomsGrid();
    renderRoomsPassengerList();
}

function switchFloor(floor) {
    currentFloor = floor;
    $('#floorTabs .bus-tab').removeClass('active');
    $(`#floorTabs .bus-tab[data-floor="${floor}"]`).addClass('active');

    renderRoomsGrid();
    renderRoomsPassengerList();
}

function renderFloorTabs() {
    if (!db || !db.rooms) return;

    const genderRooms = db.rooms.filter(r => r.gender === currentGender);
    const floors = [...new Set(genderRooms.map(r => r.floor))].sort((a, b) => a - b);

    if (floors.length > 0) {
        if (currentFloor === null || !floors.includes(currentFloor)) {
            currentFloor = floors[0];
        }
    } else {
        currentFloor = null;
    }

    let html = '';
    floors.forEach(f => {
        const activeCls = f === currentFloor ? 'active' : '';
        html += `<div class="bus-tab ${activeCls}" data-floor="${f}" onclick="switchFloor(${f})">🏢 الدور ${f}</div>`;
    });
    $('#floorTabs').html(html);
}

function renderRoomsGrid() {
    if (!db || !db.rooms) return;
    const rooms = db.rooms.filter(r => r.gender === currentGender && r.floor === currentFloor);
    let html = '';

    if (rooms.length === 0) {
        html = '<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:40px;">لا توجد غرف في هذا الدور</div>';
        $('#roomsContainer').html(html);
        return;
    }

    // ─── إحصائيات سريعة أعلى الشبكة ───
    const totalBeds = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
    const totalOccupied = db.participants.filter(p => rooms.some(r => r.id === p.roomId)).length;
    const unassignedCount = db.participants.filter(p => !p.roomId && (currentGender === 'boys' ? p.gender !== 'أنثى' : p.gender === 'أنثى')).length;
    html += `
    <div style="grid-column:1/-1; display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
        <span style="background:rgba(6,182,212,0.15); border:1px solid rgba(6,182,212,0.3); color:#22d3ee; padding:4px 12px; border-radius:10px; font-size:0.78rem; font-weight:800;">
            🛏️ ${totalOccupied} / ${totalBeds} سرير مشغول
        </span>
        <span style="background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#34d399; padding:4px 12px; border-radius:10px; font-size:0.78rem; font-weight:800;">
            ✅ ${totalBeds - totalOccupied} سرير فارغ
        </span>
        ${unassignedCount > 0 ? `<span style="background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); color:#fbbf24; padding:4px 12px; border-radius:10px; font-size:0.78rem; font-weight:800;">
            ⚠️ ${unassignedCount} بانتظار التسكين
        </span>` : ''}
    </div>`;

    rooms.forEach(room => {
        const capacity = room.capacity || 6;
        const isFull = db.participants.filter(p => p.roomId === room.id).length >= capacity;

        let bedsHtml = '';
        for (let bedNum = 1; bedNum <= capacity; bedNum++) {
            // أوجد من يشغل هذا السرير تحديداً
            const occupant = db.participants.find(p =>
                p.roomId === room.id && (Number(p.bedNumber) === bedNum || Number(p.bed) === bedNum)
            );
            // إذا لم يكن له رقم سرير محدد، خذ المشتركين بالترتيب
            const residentsOrdered = db.participants
                .filter(p => p.roomId === room.id)
                .sort((a, b) => (Number(a.bedNumber) || 99) - (Number(b.bedNumber) || 99));
            const person = occupant || residentsOrdered[bedNum - 1] || null;

            if (person) {
                bedsHtml += `
                <div class="room-bed-slot bed-occupied"
                     onclick="openRoomSlotClick('${person.id}', '${room.id}', event)"
                     title="${escapeHTML(person.name)} — انقر للخيارات">
                    <span class="bed-num-label">${bedNum}</span>
                    <span class="bed-icon">🛏️</span>
                    <span class="bed-person-name">${escapeHTML(person.name.split(' ')[0])}</span>
                </div>`;
            } else {
                bedsHtml += `
                <div class="room-bed-slot bed-empty"
                     onclick="openRoomSlotClick(null, '${room.id}', event)"
                     title="سرير ${bedNum} فارغ — انقر لتسكين">
                    <span class="bed-num-label">${bedNum}</span>
                    <span class="bed-icon">🛌</span>
                    <span class="bed-person-name" style="color:#64748b;">فارغ</span>
                </div>`;
            }
        }

        const bookedCount = db.participants.filter(p => p.roomId === room.id).length;
        const pct = Math.round((bookedCount / capacity) * 100);
        const barColor = isFull ? '#ef4444' : bookedCount > 0 ? '#f59e0b' : '#22c55e';

        html += `
        <div class="room-card ${isFull ? 'room-full' : ''}" style="padding:0; overflow:hidden;">
            <div class="room-header" style="padding:8px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                <span style="font-weight:900; font-size:0.9rem;">🔑 ${escapeHTML(room.name)}</span>
                <span class="room-count" style="font-size:0.78rem;">👥 ${bookedCount}/${capacity}</span>
            </div>
            <div style="height:3px; background:rgba(255,255,255,0.06);">
                <div style="height:100%; width:${pct}%; background:${barColor}; transition:width 0.4s ease;"></div>
            </div>
            <div class="room-beds-grid" style="display:grid; grid-template-columns:repeat(${capacity <= 4 ? capacity : Math.ceil(capacity/2)}, 1fr); gap:4px; padding:8px;">
                ${bedsHtml}
            </div>
        </div>`;
    });

    $('#roomsContainer').html(html);

    const totalAssigned = db.participants.filter(p => p.roomId && db.rooms.some(r => r.id === p.roomId && r.gender === currentGender)).length;
    $('#roomOccupancyBadge').text(`${totalAssigned} مسكّن (${currentGender === 'boys' ? 'أولاد' : 'بنات'})`);
}

function openRoomSlotClick(participantId, roomId, event) {
    $('.seat-popover').hide();
    if (participantId) {
        openRoomOptionsPopover(participantId, event);
    } else {
        openRoomAssignPopover(roomId, event);
    }
}

let currentRoomsListFilter = 'assigned'; // 'assigned' or 'unassigned'

function switchRoomsListFilter(mode) {
    currentRoomsListFilter = mode;
    if (mode === 'assigned') {
        $('#btnRoomsAssigned').removeClass('secondary').addClass('primary');
        $('#btnRoomsUnassigned').removeClass('primary').addClass('secondary');
    } else {
        $('#btnRoomsUnassigned').removeClass('secondary').addClass('primary');
        $('#btnRoomsAssigned').removeClass('primary').addClass('secondary');
    }
    renderRoomsPassengerList();
}

function findFirstAvailableBed(roomId, excludeId = null) {
    if (!db || !db.rooms || !roomId) return null;
    const room = db.rooms.find(r => r.id === roomId);
    if (!room) return null;

    const residents = db.participants.filter(p => p.id !== excludeId && p.roomId === room.id);
    for (let b = 1; b <= room.capacity; b++) {
        const taken = residents.some(p => Number(p.bedNumber) === b);
        if (!taken) return b;
    }
    return null;
}

function renderRoomsPassengerList() {
    if (!db || !db.rooms) return;
    const searchTerm = $('#searchInput').val().trim().toLowerCase();
    let filtered = [];

    if (currentRoomsListFilter === 'assigned') {
        const roomIds = db.rooms.filter(r => r.gender === currentGender && r.floor === currentFloor).map(r => r.id);
        filtered = db.participants.filter(p => p.roomId && roomIds.includes(p.roomId));
        if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));

        filtered.sort((a, b) => {
            const roomA = db.rooms.find(r => r.id === a.roomId)?.name || '';
            const roomB = db.rooms.find(r => r.id === b.roomId)?.name || '';
            return roomA.localeCompare(roomB);
        });
        $('#roomsListCount').text(filtered.length + ' مقيم بالدور');
    } else {
        filtered = db.participants.filter(p => !p.roomId);
        
        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm));
        }

        $('#roomsListCount').text(filtered.length + ' غير مسكّن');
    }

    let html = '';
    if (filtered.length === 0) {
        html = '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:0.9rem;">' +
            (currentRoomsListFilter === 'assigned' ? 'لا يوجد مقيمين في هذا الدور' : '🎉 جميع المشتركين تم تسكينهم بنجاح!') +
            '</div>';
    } else {
        filtered.forEach(p => {
            if (currentRoomsListFilter === 'assigned') {
                const roomName = db.rooms.find(r => r.id === p.roomId)?.name || '';
                const badge = roomName ? roomName.replace('غرفة ', '') : '🏠';
                html += passengerItemHtml(p, badge);
            } else {
                html += unassignedPassengerItemHtml(p);
            }
        });
    }

    $('#roomsPassengerList').html(html);
}

function unassignedPassengerItemHtml(p) {
    const groupName = db && db.groups ? (db.groups.find(g => g.id === p.groupId)?.name || 'بدون مجموعة') : '';
    const hasBus = !!p.busNumber;
    const hasRoom = !!p.roomId;

    // أيقونة الحالة
    let statusIcon = '<i class="bi bi-person-plus-fill"></i>';
    let badgeBg = 'linear-gradient(135deg, var(--gold-dark), var(--gold))';
    if (hasBus && !hasRoom) { statusIcon = '🚍'; badgeBg = 'linear-gradient(135deg,#0891b2,#06b6d4)'; }
    if (!hasBus && hasRoom) { statusIcon = '🏠'; badgeBg = 'linear-gradient(135deg,#7c3aed,#8b5cf6)'; }

    // أزرار التسكين السريع
    let busButtons = '';
    if (!hasBus && db.buses) {
        db.buses.forEach(b => {
            busButtons += `<button class="action-btn secondary" style="padding:3px 9px; font-size:0.72rem; border-color:rgba(6,182,212,0.4); color:#22d3ee;"
                onclick="event.stopPropagation(); quickAssignBus('${p.id}', ${b.busNumber})">
                <i class="bi bi-bus-front-fill me-1"></i>أتوبيس ${b.busNumber}
            </button>`;
        });
    }

    let roomButton = '';
    if (!hasRoom) {
        roomButton = `<button class="action-btn primary" style="padding:3px 9px; font-size:0.72rem;"
            onclick="event.stopPropagation(); quickAssignRoom('${p.id}')">
            <i class="bi bi-house-add-fill me-1"></i>سكّن
        </button>`;
    }

    return `
        <div class="passenger-item" onclick="openEdit('${p.id}')">
            <div class="p-seat-badge" style="background:${badgeBg}; box-shadow:0 2px 8px var(--gold-glow); font-size:1rem;">
                ${statusIcon}
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:800; color:#fff; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(p.name)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:1px;">${escapeHTML(groupName)}
                    ${hasBus ? `<span style="color:#22d3ee;"> • 🚍${p.busNumber}م${p.seatNumber||''}</span>` : '<span style="color:#f59e0b;"> • بدون أتوبيس</span>'}
                    ${hasRoom ? `<span style="color:#a78bfa;"> • 🏠${p.room||''}</span>` : '<span style="color:#f87171;"> • بدون غرفة</span>'}
                </div>
                ${(busButtons || roomButton) ? `<div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:5px;">${busButtons}${roomButton}</div>` : ''}
            </div>
            <div class="p-edit-btn" onclick="event.stopPropagation(); openEdit('${p.id}')" title="تعديل"><i class="bi bi-pencil"></i></div>
        </div>
    `;
}

function quickAssignRoom(participantId) {
    openEdit(participantId);
    if (currentGender && currentFloor && db.rooms) {
        const targetRoom = db.rooms.find(r => r.gender === currentGender && r.floor === currentFloor);
        if (targetRoom) {
            $('#editRoom').val(targetRoom.id);
        }
    }
}

// تسكين أتوبيس بضغطة واحدة مع مزامنة Google Sheets
async function quickAssignBus(participantId, busNum) {
    const p = db.participants.find(x => x.id === participantId);
    if (!p) return;

    // أوجد أول مقعد فارغ في الأتوبيس
    const takenSeats = db.participants
        .filter(x => x.busNumber === busNum && x.id !== participantId)
        .map(x => Number(x.seatNumber));
    let freeSeat = null;
    for (let s = 1; s <= SEATS_PER_BUS; s++) {
        if (!takenSeats.includes(s)) { freeSeat = s; break; }
    }
    if (!freeSeat) {
        showToast(`❌ أتوبيس ${busNum} ممتلئ!`, 'error');
        return;
    }

    const prevBus = p.busNumber;
    const prevSeat = p.seatNumber;

    p.busNumber = busNum;
    p.seatNumber = freeSeat;
    p.bus = 'أتوبيس ' + busNum;
    p.seat = String(freeSeat);

    renderRoomsPassengerList();
    renderStatsBar();
    showToast(`✅ تم تعيين ${p.name} في أتوبيس ${busNum} مقعد ${freeSeat}`, 'success');

    try {
        const res = await window.DataService.assignSeat(p.name, busNum, freeSeat);
        if (res.status !== 'success') throw new Error(res.message);
    } catch (err) {
        p.busNumber = prevBus; p.seatNumber = prevSeat;
        p.bus = prevBus ? 'أتوبيس ' + prevBus : '';
        p.seat = prevSeat ? String(prevSeat) : '';
        renderRoomsPassengerList();
        renderStatsBar();
        showToast(`❌ فشل الحفظ السحابي: ${err.message}`, 'error');
    }
}

/* ========================================================
   بوابات وخيارات التعديل التفاعلية (Popovers)
   ======================================================== */
let currentAssignBus = null;
let currentAssignSeat = null;
let currentAssignRoom = null;
let selectedCandidateName = null;
let selectedRoomCandidateName = null;
let currentOptionsParticipantId = null;

// --- Seat Assignment Popover functions ---
function openSeatAssignPopover(busNum, seatNum, event) {
    currentAssignBus = busNum;
    currentAssignSeat = seatNum;
    $('#popoverSeatDesc').text(`${busNum} - مقعد ${seatNum}`);
    $('#seatSearchInput').val('');
    selectedCandidateName = null;

    const unassigned = db.participants.filter(p => !p.busNumber);
    renderSeatCandidates(unassigned);

    positionPopover('#seatAssignPopover', event);
    $('#seatAssignPopover').fadeIn(200);
    $('#seatSearchInput').focus();
}

function filterSeatCandidates() {
    const query = $('#seatSearchInput').val().trim().toLowerCase();
    const unassigned = db.participants.filter(p => !p.busNumber);
    const filtered = unassigned.filter(p => p.name.toLowerCase().includes(query));
    renderSeatCandidates(filtered);
}

function renderSeatCandidates(list) {
    let html = '';
    if (list.length === 0) {
        html = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:8px;">لا يوجد مشتركين غير محجوزين</div>';
    } else {
        list.forEach(p => {
            const grpName = p.group || 'بدون مجموعة';
            html += `<div class="popover-candidate" onclick="selectSeatCandidate('${escapeHTML(p.name)}', this)">
                ${escapeHTML(p.name)} <span style="font-size:0.65rem; color:var(--text-muted)">(${escapeHTML(grpName)})</span>
            </div>`;
        });
    }
    $('#seatCandidatesList').html(html);
}

function selectSeatCandidate(name, element) {
    selectedCandidateName = name;
    $('#seatCandidatesList .popover-candidate').css('background', 'none').css('color', 'var(--text-secondary)');
    $(element).css('background', 'rgba(6, 182, 212, 0.25)').css('color', '#fff');
}

function closeSeatPopover() {
    $('#seatAssignPopover').fadeOut(150);
}

async function confirmSeatAssign() {
    if (!selectedCandidateName) {
        showToast('يرجى اختيار مشترك أولاً!', 'warning');
        return;
    }
    const name = selectedCandidateName;
    const p = db.participants.find(x => x.name === name);
    if (!p) return;

    const prevBus = p.busNumber;
    const prevSeat = p.seatNumber;

    p.busNumber = currentAssignBus;
    p.seatNumber = currentAssignSeat;
    p.bus = 'أتوبيس ' + currentAssignBus;
    p.seat = String(currentAssignSeat);

    closeSeatPopover();
    renderSeatsGrid();
    renderPassengerList();
    renderStatsBar();
    showToast(`تم تعيين ${name} في مقعد ${currentAssignSeat} بنجاح ✅`, 'success');

    try {
        const res = await window.DataService.assignSeat(name, currentAssignBus, currentAssignSeat);
        if (res.status !== 'success') throw new Error(res.message);
    } catch (err) {
        p.busNumber = prevBus;
        p.seatNumber = prevSeat;
        p.bus = prevBus ? 'أتوبيس ' + prevBus : '';
        p.seat = prevSeat ? String(prevSeat) : '';
        renderSeatsGrid();
        renderPassengerList();
        renderStatsBar();
        showToast(`❌ فشل الحفظ السحابي: ${err.message}`, 'error');
    }
}

// --- Seat Options Popover functions ---
function openSeatOptionsPopover(participantId, event) {
    currentOptionsParticipantId = participantId;
    const p = db.participants.find(x => x.id === participantId);
    if (!p) return;

    $('#optionsParticipantName').text(p.name);
    positionPopover('#seatOptionsPopover', event);
    $('#seatOptionsPopover').fadeIn(200);
}

function closeSeatOptionsPopover() {
    $('#seatOptionsPopover').fadeOut(150);
}

function openSeatChangeFlow() {
    const pId = currentOptionsParticipantId;
    closeSeatOptionsPopover();
    openEdit(pId);
}

async function confirmUnassignSeat() {
    const p = db.participants.find(x => x.id === currentOptionsParticipantId);
    if (!p) return;

    const name = p.name;
    const prevBus = p.busNumber;
    const prevSeat = p.seatNumber;

    p.busNumber = null;
    p.seatNumber = null;
    p.bus = '';
    p.seat = '';

    closeSeatOptionsPopover();
    renderSeatsGrid();
    renderPassengerList();
    renderStatsBar();
    showToast(`تم إخلاء المقعد للمشترك ${name} ✅`, 'info');

    try {
        const res = await window.DataService.unassignSeat(name);
        if (res.status !== 'success') throw new Error(res.message);
    } catch (err) {
        p.busNumber = prevBus;
        p.seatNumber = prevSeat;
        p.bus = 'أتوبيس ' + prevBus;
        p.seat = String(prevSeat);
        renderSeatsGrid();
        renderPassengerList();
        renderStatsBar();
        showToast(`❌ فشل الحفظ السحابي`, 'error');
    }
}

// --- Room Assignment Popover functions ---
function openRoomAssignPopover(roomId, event) {
    currentAssignRoom = roomId;
    const room = db.rooms.find(r => r.id === roomId);
    if (!room) return;

    $('#popoverRoomDesc').text(room.name);
    $('#roomSearchInput').val('');
    selectedRoomCandidateName = null;

    const candidates = db.participants.filter(p => !p.roomId && (room.gender === 'boys' ? p.gender !== 'أنثى' : p.gender === 'أنثى'));
    renderRoomCandidates(candidates);

    positionPopover('#roomAssignPopover', event);
    $('#roomAssignPopover').fadeIn(200);
    $('#roomSearchInput').focus();
}

function filterRoomCandidates() {
    const query = $('#roomSearchInput').val().trim().toLowerCase();
    const room = db.rooms.find(r => r.id === currentAssignRoom);
    if (!room) return;
    const candidates = db.participants.filter(p => !p.roomId && (room.gender === 'boys' ? p.gender !== 'أنثى' : p.gender === 'أنثى'));
    const filtered = candidates.filter(p => p.name.toLowerCase().includes(query));
    renderRoomCandidates(filtered);
}

function renderRoomCandidates(list) {
    let html = '';
    if (list.length === 0) {
        html = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:8px;">لا يوجد مشتركين مطابقين</div>';
    } else {
        list.forEach(p => {
            const grpName = p.group || 'بدون مجموعة';
            const genderTag = p.gender === 'ذكر' ? '👦' : p.gender === 'أنثى' ? '👧' : '';
            html += `<div class="popover-candidate" onclick="selectRoomCandidate('${escapeHTML(p.name)}', this)">
                ${genderTag} ${escapeHTML(p.name)} <span style="font-size:0.65rem; color:var(--text-muted)">(${escapeHTML(grpName)})</span>
            </div>`;
        });
    }
    $('#roomCandidatesList').html(html);
}

function selectRoomCandidate(name, element) {
    selectedRoomCandidateName = name;
    $('#roomCandidatesList .popover-candidate').css('background', 'none').css('color', 'var(--text-secondary)');
    $(element).css('background', 'rgba(192, 132, 252, 0.25)').css('color', '#fff');
}

function closeRoomPopover() {
    $('#roomAssignPopover').fadeOut(150);
}

async function confirmRoomAssign() {
    if (!selectedRoomCandidateName) {
        showToast('يرجى اختيار مشترك أولاً!', 'warning');
        return;
    }
    const name = selectedRoomCandidateName;
    const p = db.participants.find(x => x.name === name);
    if (!p) return;

    const prevRoom = p.roomId;

    p.roomId = currentAssignRoom;
    p.room = currentAssignRoom.replace(/^r/, '');

    closeRoomPopover();
    renderRoomsGrid();
    renderRoomsPassengerList();
    renderStatsBar();
    showToast(`تم تسكين ${name} في ${currentAssignRoom.replace(/^r/, 'غرفة ')} بنجاح ✅`, 'success');

    try {
        const res = await window.DataService.assignRoom(name, currentAssignRoom);
        if (res.status !== 'success') throw new Error(res.message);
    } catch (err) {
        p.roomId = prevRoom;
        p.room = prevRoom ? prevRoom.replace(/^r/, '') : '';
        renderRoomsGrid();
        renderRoomsPassengerList();
        renderStatsBar();
        showToast(`❌ فشل الحفظ السحابي: ${err.message}`, 'error');
    }
}

// --- Room Options Popover functions ---
let currentRoomOptionsParticipantId = null;
function openRoomOptionsPopover(participantId, event) {
    currentRoomOptionsParticipantId = participantId;
    const p = db.participants.find(x => x.id === participantId);
    if (!p) return;

    $('#roomOptionsParticipantName').text(p.name);
    positionPopover('#roomOptionsPopover', event);
    $('#roomOptionsPopover').fadeIn(200);
}

function closeRoomOptionsPopover() {
    $('#roomOptionsPopover').fadeOut(150);
}

function openRoomChangeFlow() {
    const pId = currentRoomOptionsParticipantId;
    closeRoomOptionsPopover();
    openEdit(pId);
}

async function confirmUnassignRoom() {
    const p = db.participants.find(x => x.id === currentRoomOptionsParticipantId);
    if (!p) return;

    const name = p.name;
    const prevRoom = p.roomId;

    p.roomId = null;
    p.room = '';

    closeRoomOptionsPopover();
    renderRoomsGrid();
    renderRoomsPassengerList();
    renderStatsBar();
    showToast(`تم إلغاء تسكين المشترك ${name} ✅`, 'info');

    try {
        const res = await window.DataService.unassignRoom(name);
        if (res.status !== 'success') throw new Error(res.message);
    } catch (err) {
        p.roomId = prevRoom;
        p.room = prevRoom ? prevRoom.replace(/^r/, '') : '';
        renderRoomsGrid();
        renderRoomsPassengerList();
        renderStatsBar();
        showToast(`❌ فشل الحفظ السحابي`, 'error');
    }
}

function positionPopover(selector, event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    let top = rect.bottom + scrollTop + 6;
    let left = rect.left + scrollLeft;

    const popoverWidth = 240;
    if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 10;
    }

    $(selector).css({
        top: top + 'px',
        left: Math.max(10, left) + 'px'
    });
}

/* ========================================================
   المرحلة 4 — وحدة المجموعات (Groups Board)
   ======================================================== */
function renderGroupsBoard() {
    if (!db || !db.groups) return;
    const searchTerm = $('#searchInput').val().trim().toLowerCase();
    const board = document.getElementById('groupsBoard');

    const groups = [...db.groups];
    groups.push({ id: 'none', name: '👥 غير محدد' });

    let html = '';
    groups.forEach(g => {
        let members = db.participants.filter(p => {
            if (g.id === 'none') return !p.groupId;
            return p.groupId === g.id;
        });

        if (searchTerm) {
            members = members.filter(p => p.name.toLowerCase().includes(searchTerm));
        }

        let membersHtml = members.map((p, idx) => passengerItemHtml(p, idx + 1)).join('');
        if (!membersHtml) {
            membersHtml = '<div style="text-align:center;color:var(--text-muted);font-size:.75rem;padding:20px 0;">لا يوجد أعضاء</div>';
        }

        // ── نقاط المجموعة من النظام الجديد ──
        const grand = g.id !== 'none' ? calcGroupGrandTotal(g.id) : 0;
        const day1  = g.id !== 'none' ? calcGroupDayTotal(g.id, '1') : 0;
        const day2  = g.id !== 'none' ? calcGroupDayTotal(g.id, '2') : 0;
        const day3  = g.id !== 'none' ? calcGroupDayTotal(g.id, '3') : 0;
        const pct   = Math.min(100, Math.round(grand / TOTAL_MAX_PTS * 100));

        html += `<div class="group-column" data-group="${g.id}" 
            ondragover="event.preventDefault(); this.classList.add('drag-over')" 
            ondragleave="this.classList.remove('drag-over')"
            ondrop="this.classList.remove('drag-over'); onDropInGroup(event, '${g.id}')">
            <div class="group-column-title" style="flex-direction: column; align-items: stretch; gap: 6px;">
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span style="font-weight: 900; font-size: 0.95rem;">${escapeHTML(g.name)}</span>
                    <span class="count-badge">${members.length} عضو</span>
                </div>
                ${g.id !== 'none' ? `
                <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(251,191,36,0.2); border-radius:10px; padding:8px; margin-top:2px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-size:0.72rem; color:#fbbf24; font-weight:800;"><i class="bi bi-trophy-fill me-1"></i>الإجمالي الكلي:</span>
                        <span style="font-size:0.9rem; color:#fbbf24; font-weight:900;">${grand} / ${TOTAL_MAX_PTS}</span>
                    </div>
                    <div style="height:5px; background:rgba(255,255,255,0.07); border-radius:4px; overflow:hidden; margin-bottom:6px;">
                        <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#fbbf24,#06b6d4); border-radius:4px; transition:width 0.5s;"></div>
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; font-size:0.65rem; font-weight:700;">
                        <span style="background:rgba(250,204,21,0.1); border:1px solid rgba(250,204,21,0.2); border-radius:6px; padding:1px 6px; color:#fde68a;">ي1: ${day1}/100</span>
                        <span style="background:rgba(250,204,21,0.1); border:1px solid rgba(250,204,21,0.2); border-radius:6px; padding:1px 6px; color:#fde68a;">ي2: ${day2}/100</span>
                        <span style="background:rgba(250,204,21,0.1); border:1px solid rgba(250,204,21,0.2); border-radius:6px; padding:1px 6px; color:#fde68a;">ي3: ${day3}/100</span>
                    </div>
                </div>
                ` : ''}
            </div>
            ${g.id !== 'none' ? `<div class="group-column-add" onclick="openAddModalForGroup('${g.id}')"><i class="bi bi-plus-lg me-1"></i> إضافة للمجموعة</div>` : ''}
            <div class="group-members-list">
                ${membersHtml}
            </div>
        </div>`;
    });

    board.innerHTML = html;
}

// ── الاستماع للحدث من نظام النقاط — تحديث فوري ──
window.addEventListener('yc_group_scores_updated', function() {
    if (currentSection === 'groups') {
        renderGroupsBoard();
    }
});



function updateGroupPoints(groupId, val) {
    // هذه الدالة تُرسل النقاط لورقة GroupPoints في Google Sheets — لا تُحدّث نقاط الأفراد
    if (!db || !db.groups) return;
    const group = db.groups.find(g => g.id === groupId);
    if (!group) return;

    const newPts = Math.max(0, parseInt(val) || 0);

    if (window.DataService && window.DataService.getGasUrl()) {
        window.DataService.sendToGAS({
            action    : 'updateGroupPoints',
            group     : group.name,
            points    : newPts
        }).then(res => {
            if (res && res.status === 'success') {
                showToast(`✅ تم تحديث نقاط ${group.name} إلى ${newPts} في Google Sheets`, 'success');
                // تحديث محلي لعرض القيمة فوراً في الواجهة
                if (typeof loadGroupScoresFromGAS === 'function') loadGroupScoresFromGAS();
            } else {
                showToast('⚠ف️ فشل تحديث النقاط: ' + (res && res.message || ''), 'error');
            }
        });
    } else {
        showToast('لم يتم ضبط رابط Google Apps Script بعد', 'error');
    }
}

function adjustGroupPoints(groupId, delta) {
    // لا يمكن تعديل نقط المجموعة من هنا بدون معرفة القيمة الحالية — استخدم قسم تقييم الأيام بدلاً
    showToast('استخدم قسم تقييم المجموعات لتعديل النقاط التفصيلية لكل يوم', 'info');
}

function openAddModalForGroup(groupId) {
    openAddModal();
    $('#addGroup').val(groupId);
}

// updateGroupScore — تم حذفها. استخدم updateGroupPoints بدلاً.


/* drag & drop support */
function onDragStartParticipant(event, participantId) {
    event.dataTransfer.setData('text/plain', participantId);
}

function onDropInGroup(event, groupId) {
    event.preventDefault();
    const participantId = event.dataTransfer.getData('text/plain');
    if (!participantId) return;
    const p = db.participants.find(x => x.id === participantId);
    if (p) {
        const targetGroupId = groupId === 'none' ? null : groupId;
        if (p.groupId !== targetGroupId) {
            p.groupId = targetGroupId;
            markUnsaved();
            saveToStorage();
            renderGroupsBoard();
            showToast(`تم نقل "${p.name}" بنجاح ✅`, 'success');
        }
    }
}

/* ========================================================
   المرحلة 5 — نافذة التعديل الموحدة
   ======================================================== */
function openEdit(participantId) {
    editingParticipantId = participantId;
    const p = db.participants.find(x => x.id === participantId);
    if (!p) return;

    $('#editTitle').text('تعديل بيانات المشترك');
    $('#editSeatInfo').text(`معرف المشترك: ${p.id}`);
    $('#editName').val(p.name);
    $('#editGroup').val(p.groupId || 'none');
    // لا نُعبئ نقاطاً — النقاط خاصة بالمجموعات في ورقة GroupPoints

    $('#editBus').val(p.busNumber != null ? p.busNumber.toString() : 'none');
    $('#editSeat').val(p.seatNumber != null ? p.seatNumber : '');
    
    // الغرف والتسكين
    $('#editRoom').val(p.roomId || 'none');
    $('#editGender').val(p.gender || '');

    $('#editOverlay').addClass('show');

    if (currentSection === 'buses') {
        $('#clearBtn').html('<i class="bi bi-x-circle me-1"></i> إخلاء المقعد (إلغاء ركوب الأتوبيس)');
    } else if (currentSection === 'rooms') {
        $('#clearBtn').html('<i class="bi bi-x-circle me-1"></i> إلغاء التسكين (إخلاء الغرفة)');
    } else {
        $('#clearBtn').html('<i class="bi bi-x-circle me-1"></i> إزالة من المجموعة');
    }

    setTimeout(() => $('#editName').focus(), 300);
}

// adjustEditPoints — تم حذفها. لا توجد نقاط فردية.


// adjustParticipantPoints — تم حذفها. لا توجد نقاط فردية — النقاط خاصة بالمجموعات.


function awardGroupPoints(groupId, delta) {
    // تُضيف نقاطاً لمجموعة كاملة في GroupPoints — لا تتعامل مع نقاط الأفراد
    if (!db || !groupId) return;
    const groupObj = db.groups ? db.groups.find(g => g.id === groupId) : null;
    const groupName = groupObj ? groupObj.name : groupId;

    if (!confirm(`هل تريد إضافة +${delta} نقطة لمجموعة "${groupName}" في Google Sheets؟`)) return;

    if (window.DataService && window.DataService.getGasUrl()) {
        window.DataService.sendToGAS({
            action : 'updateGroupPoints',
            group  : groupName,
            points : delta
        }).then(res => {
            if (res && res.status === 'success') {
                showToast(`🎉 تمت إضافة +${delta} نقطة لمجموعة ${groupName} في Google Sheets ✅`, 'success');
                if (typeof loadGroupScoresFromGAS === 'function') loadGroupScoresFromGAS();
            } else {
                showToast('فشل تحديث النقاط: ' + (res && res.message || ''), 'error');
            }
        });
    } else {
        showToast('لم يتم ضبط رابط Google Apps Script بعد', 'error');
    }
}


function closeEdit() {
    $('#editOverlay').removeClass('show');
}

function clearActiveTabAssignment() {
    if (!editingParticipantId) return;
    const p = db.participants.find(x => x.id === editingParticipantId);
    if (!p) return;

    if (currentSection === 'buses') {
        p.busNumber = null;
        p.seatNumber = null;
        showToast(`تم إخلاء الأتوبيس للمشترك "${p.name}" ✅`, 'info');
    } else if (currentSection === 'rooms') {
        p.roomId = null;
        p.bedNumber = null;
        showToast(`تم إخلاء السكن للمشترك "${p.name}" ✅`, 'info');
    } else if (currentSection === 'groups') {
        p.groupId = null;
        showToast(`تمت إزالة المشترك "${p.name}" من المجموعة ✅`, 'info');
    }

    markUnsaved();
    saveToStorage();
    closeEdit();
    refreshAll();
}

function saveEdit() {
    if (!editingParticipantId) return;
    const p = db.participants.find(x => x.id === editingParticipantId);
    if (!p) return;

    const name = $('#editName').val().trim();
    if (!name) {
        showToast('اكتب اسم المشترك!', 'error');
        return;
    }

    const groupId = $('#editGroup').val();
    const finalGroupId = groupId === 'none' ? null : groupId;

    const busVal = $('#editBus').val();
    const seatVal = $('#editSeat').val();
    let finalBus = busVal === 'none' ? null : parseInt(busVal);
    let finalSeat = seatVal ? parseInt(seatVal) : null;

    const roomVal = $('#editRoom').val();
    let finalRoom = roomVal === 'none' ? null : roomVal;

    // 1. التحقق من مقعد الأتوبيس (المقعد اختياري)
    if (finalBus !== null && finalSeat !== null) {
        if (isNaN(finalSeat) || finalSeat < 1 || finalSeat > SEATS_PER_BUS) {
            showToast('رقم المقعد غير صحيح! (1 - ' + SEATS_PER_BUS + ')', 'error');
            return;
        }
        const busConflict = db.participants.find(x => x.id !== p.id && x.busNumber === finalBus && x.seatNumber === finalSeat);
        if (busConflict) {
            showConfirm(
                'تعارض المقاعد',
                `المقعد ${finalSeat} في أتوبيس ${finalBus} محجوز للمشترك "${busConflict.name}". هل تريد مبادلة المقاعد بينهما؟`,
                function() {
                    busConflict.busNumber  = p.busNumber;
                    busConflict.seatNumber = p.seatNumber;
                    p.name       = name;
                    p.groupId    = finalGroupId;
                    p.busNumber  = finalBus;
                    p.seatNumber = finalSeat;
                    p.roomId     = finalRoom;
                    p.gender     = $('#editGender').val();
                    completeSave(p);
                }
            );
            return;
        }
    } else if (finalBus === null) {
        finalSeat = null; // لا أتوبيس → لا مقعد
    }

    // 2. التحقق من سعة الغرفة
    if (finalRoom !== null) {
        const room = db.rooms.find(r => r.id === finalRoom);
        const capacity = room ? room.capacity : 6;
        const currentCount = db.participants.filter(x => x.id !== p.id && x.roomId === finalRoom).length;
        if (currentCount >= capacity) {
            showToast(`غرفة ${room ? room.name : finalRoom} ممتلئة بالكامل (${capacity}/${capacity})!`, 'error');
            return;
        }
    }

    p.name       = name;
    p.groupId    = finalGroupId;
    p.busNumber  = finalBus;
    p.seatNumber = finalSeat;
    p.roomId     = finalRoom;
    p.gender     = $('#editGender').val();

    completeSave(p);
}

async function completeSave(p) {
    if (!(window.DataService && window.DataService.getGasUrl())) {
        showToast('تعذر الحفظ: مسار Google Sheets غير متاح', 'error');
        return;
    }
    const groupObj = db && db.groups ? db.groups.find(g => g.id === p.groupId) : null;
    const res = await window.DataService.sendToGAS({
        action: 'update',
        name: p.name,
        group: groupObj ? groupObj.name : (p.groupId || ''),
        room: p.roomId ? String(p.roomId).replace(/^r/, '') : '',
        bus: p.busNumber ? ('أتوبيس ' + p.busNumber) : '',
        seat: p.seatNumber ? String(p.seatNumber) : '',
        gender: p.gender || ''
    });
    if (!res || res.status !== 'success') {
        showToast('فشل حفظ التعديل في Google Sheets: ' + (res?.message || 'خطأ غير معروف'), 'error');
        try { db = await DataService.loadConference(true); window.db = db; refreshAll(); } catch(e) {}
        return;
    }
    markUnsaved();
    closeEdit();
    try { db = await DataService.loadConference(true); window.db = db; refreshAll(); } catch(e) {}
    showToast(`تم حفظ تعديلات "${p.name}" في Google Sheets بنجاح ✅`, 'success');
}

/* ========================================================
   نافذة إضافة مشترك جديد
   ======================================================== */
function openAddModal() {
    $('#addName').val('');
    $('#addGroup').val('none');
    $('#addBus').val(currentSection === 'buses' ? currentBus.toString() : 'none');
    $('#addSeat').val('');
    $('#addRoom').val('none');
    $('#addGender').val('');
    $('#addStatus').text('');

    $('#addOverlay').addClass('show');
    setTimeout(() => $('#addName').focus(), 300);
}

function closeAddModal() {
    $('#addOverlay').removeClass('show');
}

function validateAddAssignment() {
    if (!db) return;
    const busVal = $('#addBus').val();
    const seatVal = $('#addSeat').val();
    const roomVal = $('#addRoom').val();

    let statusHtml = '';

    if (busVal !== 'none' && seatVal) {
        const bus = parseInt(busVal);
        const seat = parseInt(seatVal);
        const conflict = db.participants.find(x => x.busNumber === bus && x.seatNumber === seat);
        if (conflict) {
            statusHtml += `<div style="color:var(--danger);">⚠️ المقعد ${seat} في أتوبيس ${bus} محجوز لـ "${conflict.name}"</div>`;
        } else if (seat < 1 || seat > SEATS_PER_BUS) {
            statusHtml += `<div style="color:var(--danger);">⚠️ رقم مقعد غير صحيح</div>`;
        } else {
            statusHtml += `<div style="color:var(--seat-avail-light);">✅ المقعد ${seat} في أتوبيس ${bus} متاح</div>`;
        }
    }

    if (roomVal !== 'none') {
        const room = db.rooms.find(r => r.id === roomVal);
        const capacity = room ? room.capacity : 6;
        const currentCount = db.participants.filter(x => x.roomId === roomVal).length;
        if (currentCount >= capacity) {
            statusHtml += `<div style="color:var(--danger);">⚠️ غرفة ${room ? room.name : roomVal} ممتلئة بالكامل (${capacity}/${capacity})</div>`;
        } else {
            statusHtml += `<div style="color:var(--seat-avail-light);">✅ غرفة ${room ? room.name : roomVal} متاحة (الركاب: ${currentCount}/${capacity})</div>`;
        }
    }

    $('#addStatus').html(statusHtml);
}

$(document).on('input change', '#addBus, #addSeat, #addRoom', validateAddAssignment);

async function saveAddPassenger() {
    const name = $('#addName').val().trim();
    if (!name) {
        showToast('اكتب اسم المشترك!', 'error');
        return;
    }

    const groupId = $('#addGroup').val();
    const finalGroupId = groupId === 'none' ? null : groupId;

    const busVal = $('#addBus').val();
    const seatVal = $('#addSeat').val();
    let finalBus = busVal === 'none' ? null : parseInt(busVal);
    let finalSeat = seatVal ? parseInt(seatVal) : null;

    const roomVal = $('#addRoom').val();
    let finalRoom = roomVal === 'none' ? null : roomVal;
    const genderVal = $('#addGender').val();

    // التحقق من المقعد (اختياري — يمكن إضافة مشترك بدون مقعد)
    if (finalBus !== null && finalSeat !== null) {
        if (isNaN(finalSeat) || finalSeat < 1 || finalSeat > SEATS_PER_BUS) {
            showToast('رقم المقعد غير صحيح! (1 - ' + SEATS_PER_BUS + ')', 'error');
            return;
        }
        const busConflict = db.participants.find(x => x.busNumber === finalBus && x.seatNumber === finalSeat);
        if (busConflict) {
            showToast(`المقعد ${finalSeat} محجوز للمشترك "${busConflict.name}"`, 'warning');
            return;
        }
    } else if (finalBus === null) {
        finalSeat = null; // لا أتوبيس → لا مقعد
    }

    // Validate room capacity conflict
    if (finalRoom !== null) {
        const room = db.rooms.find(r => r.id === finalRoom);
        const capacity = room ? room.capacity : 6;
        const currentCount = db.participants.filter(x => x.roomId === finalRoom).length;
        if (currentCount >= capacity) {
            showToast(`غرفة ${room ? room.name : finalRoom} ممتلئة بالكامل (${capacity}/${capacity})!`, 'error');
            return;
        }
    }

    const newId = 'p' + Date.now();
    const newParticipant = {
        id:         newId,
        name:       name,
        groupId:    finalGroupId,
        // لا نقاط فردية — النقاط خاصة بالمجموعات في ورقة GroupPoints
        roomId:     finalRoom,
        busNumber:  finalBus,
        seatNumber: finalSeat,
        gender:     genderVal
    };

    db.participants.push(newParticipant);
    markUnsaved();
    saveToStorage();
    closeAddModal();
    refreshAll();

    // لا نعلن النجاح قبل تأكيد Google Sheets.
    if (!(window.DataService && window.DataService.getGasUrl())) {
        showToast('تعذر الإضافة: مسار Google Sheets غير متاح', 'error');
        return;
    }
    const gObj = db && db.groups ? db.groups.find(g => g.id === finalGroupId) : null;
    const res = await window.DataService.sendToGAS({
        action:'add',
        name,
        group:gObj ? gObj.name : (finalGroupId || ''),
        room:finalRoom ? String(finalRoom).replace(/^r/, '') : '',
        bus:finalBus ? ('أتوبيس ' + finalBus) : '',
        seat:finalSeat ? String(finalSeat) : '',
        gender:genderVal
    });
    if (!res || res.status !== 'success') {
        showToast('فشل إضافة الشخص في Google Sheets: ' + (res?.message || 'خطأ غير معروف'), 'error');
        try { db = await DataService.loadConference(true); window.db = db; refreshAll(); } catch(e) {}
        return;
    }
    try { db = await DataService.loadConference(true); window.db = db; refreshAll(); } catch(e) {}
    showToast(`تم إضافة المشترك "${name}" في Google Sheets بنجاح ✅`, 'success');
}

/* ========================================================
   منطق حذف مشترك
   ======================================================== */
function deleteParticipant(id) {
    const p = db.participants.find(x => x.id === id);
    if (!p) return;

    showConfirm(
        'حذف مشترك',
        `هل تريد حذف المشترك "${escapeHTML(p.name)}" نهائياً من قاعدة البيانات؟`,
        function() {
            const idx = db.participants.findIndex(x => x.id === id);
            if (idx !== -1) {
                db.participants.splice(idx, 1);
                markUnsaved();
                saveToStorage();
                refreshAll();
                showToast(`تم حذف المشترك "${p.name}" ✅`, 'info');
            }
        }
    );
}

/* ========================================================
   تصدير واستيراد وتهيئة البيانات
   ======================================================== */
function exportJSONBackup() {
    if (!db) return;
    const jsonStr = JSON.stringify(db, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conference-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hasUnsavedChanges = false;
    hasExported = true;
    updateSaveIndicator();
    showToast('تم تصدير conference-data.json بنجاح ✅', 'success');
}

function confirmClearAll() {
    showConfirm(
        'تهيئة قاعدة البيانات',
        'هل تريد مسح جميع المشتركين تماماً؟<br>هذا الإجراء لا يمكن التراجع عنه!',
        function() {
            db.participants = [];
            markUnsaved();
            saveToStorage();
            refreshAll();
            showToast('تم مسح جميع المشتركين بنجاح ✅', 'info');
        }
    );
}

function toggleImport() {
    const $section = $('#importSection');
    $section.toggle();
    if ($section.is(':visible')) {
        $('html, body').animate({ scrollTop: $section.offset().top - 60 }, 400);
    }
}

function importData(mode) {
    const raw = $('#importArea').val().trim();
    if (!raw) { showToast('الصق البيانات أولاً!', 'warning'); return; }

    try {
        let newData = JSON.parse(raw);
        if (!newData.participants || !Array.isArray(newData.participants)) {
            throw new Error('البيانات يجب أن تحتوي على مصفوفة المشتركين (participants)');
        }

        db = newData;
        populateDropdowns();
        markUnsaved();
        saveToStorage();
        refreshAll();
        $('#importArea').val('');
        $('#importSection').hide();
        showToast('تم استيراد البيانات بنجاح ✅', 'success');
    } catch (e) {
        showToast('خطأ في صيغة الملف: ' + e.message, 'error');
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    processFile(file);
    event.target.value = '';
}

function processFile(file) {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
        showToast('الملف لازم يكون بصيغة JSON!', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            let parsed = JSON.parse(content);

            if (!parsed.participants || !Array.isArray(parsed.participants)) {
                throw new Error('الملف لا يحتوي على مصفوفة المشتركين (participants)');
            }

            db = parsed;
            populateDropdowns();
            markUnsaved();
            saveToStorage();
            refreshAll();
            showToast('تم استيراد البيانات من الملف بنجاح ✅', 'success');
        } catch (err) {
            showToast('خطأ في الملف: ' + err.message, 'error');
        }
    };
    reader.onerror = function() {
        showToast('حدث خطأ أثناء قراءة الملف!', 'error');
    };
    reader.readAsText(file);
}

function initDragDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
}

function filterPassengers() {
    if (currentSection === 'buses') {
        renderPassengerList();
    } else if (currentSection === 'rooms') {
        renderRoomsPassengerList();
    } else if (currentSection === 'groups') {
        renderGroupsBoard();
    }
}

const MASTER_USER_HASH = '77a3f439969f80c707af7791884a8c135b64f7bf2faf314bb69d6e5e2e5e88c3';
const MASTER_PASS_HASH = 'f5b9f57cbea8143a47a75f0c45a308b65f7f724ee87dd5bb99727c863744e423';

async function hashSHA256(str) {
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error('hashSHA256 error:', e);
        }
    }
    // إذا لم يكن crypto.subtle متاحاً (HTTP بدون HTTPS)، نرفض العملية بأمان
    return null;
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye-slash';
    }
}

function initEvadingSubmitButton() {
    const $btn = $('#masterLoginSubmitBtn');
    const $user = $('#masterAdminUser');
    const $pass = $('#masterAdminPass');
    const $hint = $('#masterLoginHint');

    if (!$btn.length) return;

    function isFormComplete() {
        return $user.val().trim().length > 0 && $pass.val().trim().length > 0;
    }

    function checkFormValidityStatus() {
        if (isFormComplete()) {
            $btn.css({
                'transform': 'translate(0, 0)',
                'background': 'linear-gradient(135deg, #06b6d4, #10b981)',
                'border-color': '#10b981',
                'box-shadow': '0 0 25px rgba(16, 185, 129, 0.5)',
                'cursor': 'pointer'
            }).html('<i class="bi bi-box-arrow-in-right me-1"></i> دخول اللوحة الآن ✨');
            $hint.slideUp(150);
        } else {
            $btn.css({
                'background': 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(16,185,129,0.2))',
                'border-color': 'rgba(34, 211, 238, 0.4)',
                'box-shadow': 'none'
            }).text('دخول اللوحة');
        }
    }

    $user.add($pass).on('input keyup change blur focus', function() {
        checkFormValidityStatus();
    });

    $btn.on('mouseenter mousemove', function(e) {
        if (!isFormComplete()) {
            const btnOffset = $btn.offset();
            const mouseX = e.pageX;
            const mouseY = e.pageY;
            const btnCenterX = btnOffset.left + $btn.outerWidth() / 2;
            const btnCenterY = btnOffset.top + $btn.outerHeight() / 2;

            let deltaX = (btnCenterX - mouseX);
            let deltaY = (btnCenterY - mouseY);

            if (Math.abs(deltaX) < 15) deltaX = (Math.random() > 0.5 ? 1 : -1) * 80;
            if (Math.abs(deltaY) < 10) deltaY = (Math.random() > 0.5 ? 1 : -1) * 40;

            const shiftX = Math.min(Math.max(deltaX * 2.2, -140), 140);
            const shiftY = Math.min(Math.max(deltaY * 2.2, -40), 40);

            $btn.css('transform', `translate(${shiftX}px, ${shiftY}px)`);
            $hint.stop(true, true).slideDown(150);
        }
    });

    $btn.on('mouseleave', function() {
        if (!isFormComplete()) {
            setTimeout(() => {
                if (!isFormComplete()) {
                    $btn.css('transform', 'translate(0, 0)');
                }
            }, 900);
        }
    });

    checkFormValidityStatus();
}

function checkMasterAdminSession() {
    // تحقق من token الجلسة (أكثر أماناً من قيمة ثابتة)
    const hasToken = sessionStorage.getItem('admin_session_token');
    if (hasToken) {
        $('#masterAdminAuthModal').removeClass('show').hide();
        return true;
    } else {
        $('#masterAdminAuthModal').addClass('show').css('display', 'flex');
        initEvadingSubmitButton();
        return false;
    }
}

async function handleMasterAdminLogin(e) {
    if (e) e.preventDefault();
    const user = $('#masterAdminUser').val().trim();
    const pass = $('#masterAdminPass').val().trim();
    if (!user || !pass) {
        $('#masterLoginErrorMsg').text('❌ يرجى ملء اسم المستخدم وكلمة المرور').show();
        return false;
    }

    try {
        const res = await fetch('/api/admin-auth', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({username:user,password:pass})
        });
        const json = await res.json().catch(()=>null);
        if (!res.ok || json?.status !== 'success' || !json.token) {
            throw new Error(json?.message || 'بيانات الدخول غير صحيحة');
        }
        sessionStorage.setItem('admin_session_token', json.token);
        sessionStorage.removeItem('login_attempts');
        sessionStorage.removeItem('login_locked_until');
        $('#masterLoginErrorMsg').hide();
        checkMasterAdminSession();
        await initMasterAdminDashboard();
    } catch (err) {
        $('#masterLoginErrorMsg').text('❌ '+(err.message || 'تعذر تسجيل الدخول')).show();
    }
    return false;
}

function masterAdminLogout() {
    if (confirm("هل تريد تسجيل الخروج من لوحة الإدارة؟")) {
        sessionStorage.removeItem('admin_session_token');
        sessionStorage.removeItem('login_attempts');
        sessionStorage.removeItem('login_locked_until');
        checkMasterAdminSession();
    }
}

/* ========================================================
   تهيئة الصفحة
   ======================================================== */
$(document).ready(async function() {
    $('.edit-overlay, .add-overlay, .confirm-overlay').on('click', function(e) {
        if (e.target === this) {
            $(this).removeClass('show');
        }
    });

    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') {
            $('.edit-overlay, .add-overlay, .confirm-overlay').removeClass('show');
            // إغلاق مودال الرفع فقط إذا ظهر زر "رائع" (انتهت العملية)
            if ($('#uploadProgressCloseBtn').is(':visible')) {
                closeUploadModal();
            }
        }
    });

    // لا يوجد تحذير beforeunload — التغييرات تُرفع مباشرةً لـ Google Sheets

    if (!checkMasterAdminSession()) return;
    await initMasterAdminDashboard();
});

async function initMasterAdminDashboard() {
    try {
        const sessionToken = sessionStorage.getItem('admin_session_token') || '';
        const authRes = await fetch('/api/admin-verify', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({token:sessionToken})
        });
        const authJson = await authRes.json().catch(()=>null);
        if (!authRes.ok || authJson?.status !== 'success') {
            sessionStorage.removeItem('admin_session_token');
            checkMasterAdminSession();
            throw new Error(authJson?.message || 'جلسة الأدمن غير صالحة');
        }
        db = await DataService.loadConference(true); // force refresh من GAS دائماً
        window.db = db;

        // إظهار تحذير واضح إذا فشل الاتصال بـ GAS
        if (db._gasError) {
            showToast(`⚠️ تعذّر الاتصال بـ Google Sheets: ${db._gasError}. يُرجى التحقق من الرابط.`, 'error');
        } else {
            showToast(`✅ تم جلب ${db.participants.length} مشترك من Google Sheets`, 'success');
        }

        populateDropdowns();
        renderStatsBar();
        switchSection(currentSection || 'buses');
        refreshAll();

        // تحديث full-db panel دائماً بعد جلب البيانات
        // لأن switchSection يُعيد للـ 'buses' بشكل افتراضي
        // فيُعرض الـ full-db panel فارغاً إذا لُم يُحدَّث هنا
        renderFullDbPanel();

        initDragDrop();
        updateSaveIndicator();

        // تحقّق من حالة الاتصال بـ GAS فور تحميل الصفحة
        updateMasterCloudStatus();

        // ── تحميل نقاط المجموعات من GAS وتخزينها محلياً ──
        loadGroupScoresFromGAS();

        window.addEventListener('yc_live_data_updated', function(e) {
            if (e.detail) {
                db = e.detail;
                window.db = db;
                populateDropdowns();
                renderStatsBar();
                refreshAll();
            }
        });
    } catch (e) {
        console.error('Failed to load conference-data: ', e);
        showToast('❌ تعذّر الاتصال بـ Google Sheets. تحقق من رابط GAS في الإعدادات.', 'error');
    }
}

/**
 * تحميل نقاط المجموعات من GAS (GroupPoints sheet) وتخزينها في localStorage
 * يُشغَّل عند بدء الصفحة لضمان أحدث النقاط من الشيت
 */
async function loadGroupScoresFromGAS() {
    try {
        if (!window.DataService) return;
        const url = window.DataService.getApiUrl();
        if (!url) return;

        const res = await fetch(url, {
            method  : 'POST',
            headers : { 'Content-Type': 'application/json' },
            body    : JSON.stringify({ action: 'getGroupScores' })
        });
        const json = await res.json();
        if (json.status !== 'success' || !Array.isArray(json.data) || json.data.length === 0) return;

        // تحديث localStorage بالقيم من GAS
        json.data.forEach(row => {
            // البحث عن المجموعة في db بالاسم
            const grpObj = db && db.groups ? db.groups.find(g => g.name === row.group) : null;
            const gid = grpObj ? grpObj.id : null;
            if (!gid) return;

            // تحديث كل يوم وكل قسم فقط إذا كانت القيمة من GAS أكبر (لتجنب تراجع النقاط)
            [['1', row.day1], ['2', row.day2], ['3', row.day3]].forEach(([day, d]) => {
                if (!d) return;
                ['workshop', 'games', 'commitment'].forEach(cat => {
                    const key    = `yc_pts_${gid}_day${day}_${cat}`;
                    const gasVal = Number(d[cat] || 0);
                    const local  = Number(localStorage.getItem(key) || 0);
                    if (gasVal > local) {
                        localStorage.setItem(key, gasVal);
                    }
                });
            });

            // تحديث نقاط حفلة السمر من GAS
            if (row.party !== undefined) {
                const partyKey   = `yc_pts_${gid}_party`;
                const gasParty   = Number(row.party || 0);
                const localParty = Number(localStorage.getItem(partyKey) || 0);
                if (gasParty > localParty) {
                    localStorage.setItem(partyKey, gasParty);
                }
            }
        });

        // تحديث لوحة المجموعات إذا كانت مفتوحة
        if (currentSection === 'groups') renderGroupsBoard();
        if (currentSection === 'admin-scores') renderAllScoringPanels();
        if (currentSection === 'games-leaderboard') renderGamesLeaderboardPanel();

        console.log('[Scoring] Loaded', json.data.length, 'group scores from GAS ✅');
    } catch (err) {
        console.warn('[Scoring] Could not load group scores from GAS:', err.message);
    }
}


/* ========================================================
   وحدة التحكم الموحدة — إدارة البرنامج والأجندة والسحابة
   ======================================================== */
function switchScheduleDay(dayNum) {
    currentScheduleDay = dayNum;
    $('#daySubTabs .bus-tab').removeClass('active');
    $(`#daySubTabs .bus-tab[data-day="${dayNum}"]`).addClass('active');
    renderStatsBar();
    renderSchedulePanel();
}

function renderSchedulePanel() {
    if (!db || !db.schedule) return;
    const dayKey = `day${currentScheduleDay}`;
    const events = db.schedule[dayKey] || [];
    const container = document.getElementById('scheduleEventsList');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:30px; font-size:0.9rem;">لا توجد فعاليات مسجلة لهذا اليوم</div>';
        return;
    }

    let html = '';
    events.forEach((ev, idx) => {
        html += `<div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:10px 14px; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-weight:900; color:#22d3ee; font-size:0.85rem; background:rgba(6,182,212,0.12); padding:4px 10px; border-radius:8px;">🕒 ${escapeHTML(ev.startTime)} - ${escapeHTML(ev.endTime)}</span>
                <div>
                    <div style="font-weight:800; color:#fff; font-size:0.92rem;">${escapeHTML(ev.title)}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">${escapeHTML(ev.type || 'فعالية')} · ${escapeHTML(ev.location || 'المقر')}</div>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button onclick="deleteEvent('${dayKey}', ${idx})" style="background:rgba(239,68,68,0.2); border:1px solid #ef4444; color:#f87171; border-radius:8px; padding:4px 10px; font-size:0.78rem; font-weight:800; cursor:pointer;" title="حذف الفعالية">
                    <i class="bi bi-trash3"></i> حذف
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

function openAddEventModal() {
    const title = prompt('اسم الفعالية أو المحاضرة:');
    if (!title) return;
    const startTime = prompt('وقت البداية (مثال 9:00 ص):', '9:00 ص');
    const endTime = prompt('وقت النهاية (مثال 10:00 ص):', '10:00 ص');
    const type = prompt('نوع الفعالية (محاضرة / ورشة / قداس / وجبة / ترفيه):', 'محاضرة');

    if (!db.schedule) db.schedule = { day1: [], day2: [], day3: [], day4: [] };
    const dayKey = `day${currentScheduleDay}`;
    if (!db.schedule[dayKey]) db.schedule[dayKey] = [];

    db.schedule[dayKey].push({
        id: 'act_' + Date.now(),
        title: title.trim(),
        startTime: startTime || '',
        endTime: endTime || '',
        type: type || 'فعالية'
    });

    markUnsaved();
    saveToStorage();
    renderSchedulePanel();
    showToast(`تمت إضافة فعالية "${title}" لليوم ${currentScheduleDay} بنجاح ✅`, 'success');
}

function deleteEvent(dayKey, idx) {
    if (!db || !db.schedule || !db.schedule[dayKey]) return;
    const ev = db.schedule[dayKey][idx];
    if (confirm(`هل أنت متأكد من حذف فعالية "${ev ? ev.title : ''}"؟`)) {
        db.schedule[dayKey].splice(idx, 1);
        markUnsaved();
        saveToStorage();
        renderSchedulePanel();
        showToast('تم حذف الفعالية بنجاح ✅', 'info');
    }
}

function renderCloudPanel() {
    // الـ URL الآن مُدار عبر Netlify Environment Variables — لا يوجد حقل إدخال
    renderMasterFeedbacks();
    // تحديث حالة الاتصال في cloud-panel تلقائياً
    setTimeout(updateMasterCloudStatus, 200);
}

function saveMasterGasUrl() {
    // الـ URL مُدار عبر Netlify Environment Variables — هذه الدالة احتياطية فقط
    showToast('رابط GAS مُدار تلقائياً عبر Netlify ✅ لا حاجة للتعديل اليدوي', 'info');
}

async function pushAllToSheetFromMaster() {
    if (!window.DataService || !window.DataService.getGasUrl()) {
        showToast('يرجى ضبط رابط Google Apps Script أولاً (من لوحة السحابة والآراء)', 'error');
        return;
    }

    const total = db.participants.length;
    if (total === 0) {
        showToast('لا يوجد مشتركين لرفعهم!', 'warning');
        return;
    }

    // ── إظهار Loading على الأزرار ──
    setSyncButtonsBusy();

    // ── فتح modal التقدم ──
    const $modal    = $('#uploadProgressModal');
    const $icon     = $('#uploadProgressIcon');
    const $title    = $('#uploadProgressTitle');
    const $msg      = $('#uploadProgressMsg');
    const $bar      = $('#uploadProgressBar');
    const $count    = $('#uploadProgressCount');
    const $closeBtn = $('#uploadProgressCloseBtn');

    $icon.text('☁️');
    $title.text('جاري رفع البيانات...').css('color', '#22d3ee');
    $msg.text(`يتم إرسال ${total} مشترك إلى Google Sheets`);
    $bar.css('width', '0%').css('background', 'linear-gradient(90deg, #06b6d4, #10b981)');
    $count.text(`0 / ${total} مشترك`);
    $closeBtn.hide();
    $modal.addClass('show');

    // أنيميشن وهمي للتقدم (5% إلى 85% خلال الإرسال)
    let fakeProgress = 5;
    const fakeInterval = setInterval(() => {
        if (fakeProgress < 82) {
            fakeProgress += Math.random() * 8;
            $bar.css('width', Math.min(fakeProgress, 82) + '%');
            $count.text(`${Math.round(total * Math.min(fakeProgress, 82) / 100)} / ${total} مشترك`);
        }
    }, 200);

    // بناء قائمة العناصر — 9 حقول تُطابق هيكل الشيت بدون النقاط
    // (النقاط تُدار في ورقة GroupPoints منفصلة)
    const items = db.participants.map(p => {
        const groupObj = db.groups ? db.groups.find(g => g.id === p.groupId) : null;
        return {
            name:     p.name     || '',
            group:    groupObj   ? groupObj.name : (p.groupId || ''),
            room:     p.roomId   ? p.roomId.replace(/^r/, '') : '',
            bus:      p.busNumber ? ('أتوبيس ' + p.busNumber) : '',
            seat:     p.seatNumber ? String(p.seatNumber) : '',
            gender:   p.gender   || '',
            feedback: p.feedback || '',
            nextTrip: p.nextTrip || ''
        };
    });

    try {
        const res = await window.DataService.sendToGAS({ action: 'bulkImport', items });
        clearInterval(fakeInterval);

        if (res && (res.status === 'success' || res.count > 0)) {
            $bar.css('width', '100%');
            $count.text(`${total} / ${total} مشترك`);
            $icon.text('✅');
            $title.text('تم الرفع بنجاح!').css('color', '#34d399');
            $msg.html(`تم رفع <strong style="color:#22d3ee">${total} مشترك</strong> بنجاح لـ Google Sheets ✨<br><span style="font-size:0.8rem; color:#94a3b8;">${escapeHTML(res.message || '')}</span>`);
            $bar.css('background', 'linear-gradient(90deg, #10b981, #34d399)');
        } else {
            $bar.css('width', '100%').css('background', 'linear-gradient(90deg, #f59e0b, #fbbf24)');
            $count.text(`${total} / ${total} مشترك`);
            $icon.text('⚠️');
            $title.text('تنبيه الإرسال').css('color', '#fbbf24');
            $msg.text((res && res.message) ? res.message : 'استجاب السيرفر مع تنبيه. تأكد من مطابقة مفتاح الأمان (GAS_TOKEN).');
        }
    } catch (err) {
        clearInterval(fakeInterval);
        $bar.css('width', '100%').css('background', 'linear-gradient(90deg, #ef4444, #f87171)');
        $count.text(`${total} / ${total} مشترك`);
        $icon.text('❌');
        $title.text('خطأ في الاتصال').css('color', '#f87171');
        $msg.text('تعذّر الوصول لـ Google Sheets: ' + (err.message || err.toString()));
    }

    $closeBtn.fadeIn(300);

    // تحديث حالة الأزرار بعد الرفع
    setSyncButtonsIdle();
}

function closeUploadModal() {
    $('#uploadProgressModal').removeClass('show');
}


function renderMasterFeedbacks() {
    const container = document.getElementById('masterFeedbacksList');
    const badge = document.getElementById('feedbacksMasterCount');
    if (!container) return;

    let feedbacks = [];
    if (db && Array.isArray(db.participants)) {
        feedbacks = db.participants.filter(p => p.feedback || p.nextTrip);
    }

    if (badge) badge.textContent = feedbacks.length + ' رأي وملاحظة';

    if (feedbacks.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:25px; font-size:0.85rem;">لا توجد تقييمات أو ترشيحات مسجلة بعد</div>';
        return;
    }

    let html = '';
    feedbacks.forEach(f => {
        html += `<div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:10px 14px; margin-bottom:8px;">
            <div style="font-weight:800; color:#c084fc; font-size:0.88rem; margin-bottom:4px;"><i class="bi bi-person-circle me-1"></i> ${escapeHTML(f.name)}</div>
            ${f.feedback ? `<div style="font-size:0.8rem; color:#e2e8f0; margin-bottom:3px;"><strong>الرأي:</strong> ${escapeHTML(f.feedback)}</div>` : ''}
            ${f.nextTrip ? `<div style="font-size:0.8rem; color:#34d399;"><strong>ترشيح الرحلة الجاية:</strong> ${escapeHTML(f.nextTrip)}</div>` : ''}
        </div>`;
    });

    container.innerHTML = html;
}

/* ========================================================
   إدارة النقاط والحكام وتقييم المجموعات (Admin Scores & 3 Judges)
   ======================================================== */

/* ═══════════════════════════════════════════════
   هيكل الأنشطة: كل نشاط له نوع (workshop/lecture/game) وسقف
   type: 'workshop'  → يحكم عليه 3 حكام، كل حكم 0-50، يُعتمد المتوسط
   type: 'lecture'   → المشرف فقط، سقف 20 نقطة/يوم
   type: 'game'      → المشرف فقط، سقف 30 نقطة/يوم
   الإجمالي الأقصى: 50 + 20 + 30 = 100 نقطة × 3 أيام = 300 نقطة
   ═══════════════════════════════════════════════ */
const MASTER_CONFERENCE_ACTIVITIES = {
    "1": [
        { id: "d1_lec1",  type: "lecture",  name: "المحاضرة الأولى — افتتاح المؤتمر",    maxWeight: 20 },
        { id: "d1_ws1",   type: "workshop", name: "ورشة العمل الأولى",                     maxWeight: 50 },
        { id: "d1_game1", type: "game",     name: "الألعاب والأنشطة — اليوم الأول",        maxWeight: 30 }
    ],
    "2": [
        { id: "d2_lec1",  type: "lecture",  name: "المحاضرة الثانية",                      maxWeight: 20 },
        { id: "d2_ws1",   type: "workshop", name: "ورشة العمل الثانية",                     maxWeight: 50 },
        { id: "d2_game1", type: "game",     name: "الألعاب والأنشطة — اليوم الثاني",       maxWeight: 30 }
    ],
    "3": [
        { id: "d3_lec1",  type: "lecture",  name: "القداس الإلهي والمحاضرة الختامية",     maxWeight: 20 },
        { id: "d3_ws1",   type: "workshop", name: "ورشة العمل الثالثة",                     maxWeight: 50 },
        { id: "d3_game1", type: "game",     name: "الألعاب والأنشطة — اليوم الثالث",       maxWeight: 30 }
    ]
};

/* ══════════════════════════════════════════════════════════════
   سقوف النقاط اليومية — النظام المحدث
   ورش العمل: 55 نقطة (تقييم الحكام بالنجوم)
   الألعاب:   30 نقطة (المشرف)
   الالتزام:  20 نقطة (المشرف)
   اليوم الواحد = 105 نقطة | 3 أيام = 315 نقطة + 50 سمر = 365 نقطة
   ══════════════════════════════════════════════════════════════ */
const DAY_CAPS = { workshop: 55, games: 30, commitment: 20 };
const DAY_MAX  = 105; // سقف اليوم الواحد
const PARTY_MAX = 50; // سقف حفلة السمر (حدث واحد)
const TOTAL_MAX_PTS = 365; // (105 × 3 أيام) + 50 حفلة السمر
const SCORE_DAYS = ['1', '2', '3'];

/* النجوم بناءً على النقاط الكلية من 350 */
function getGroupStars(pts) {
    const pct = pts / TOTAL_MAX_PTS;
    if (pct >= 0.83) return 5;
    if (pct >= 0.67) return 4;
    if (pct >= 0.50) return 3;
    if (pct >= 0.33) return 2;
    return 1;
}

function renderStarsHTML(pts) {
    const count = getGroupStars(pts);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += i <= count
            ? '<i class="bi bi-star-fill" style="color:#fbbf24; font-size:0.9rem;"></i>'
            : '<i class="bi bi-star" style="color:#374151; font-size:0.9rem;"></i>';
    }
    return html;
}

/* مفاتيح التخزين لسجل النقاط المفصّل */
function _getScoreKey(groupId, day, type) {
    return `yc_pts_${groupId}_day${day}_${type}`;
}
function _getScoreVal(groupId, day, type) {
    return Number(localStorage.getItem(_getScoreKey(groupId, day, type)) || 0);
}
function _setScoreVal(groupId, day, type, val) {
    localStorage.setItem(_getScoreKey(groupId, day, type), val);
}

/* مفاتيح نقاط حفلة السمر (50 نقطة) */
function _getPartyScore(groupId) {
    return Number(localStorage.getItem(`yc_pts_${groupId}_party`) || 0);
}
function _setPartyScore(groupId, val) {
    localStorage.setItem(`yc_pts_${groupId}_party`, Math.min(PARTY_MAX, Math.max(0, val)));
}

/**
 * حساب إجمالي نقاط مجموعة ليوم واحد (سقف 105)
 * workshop(55) + games(30) + commitment(20)
 */
function calcGroupDayTotal(groupId, day) {
    const ws  = _getScoreVal(groupId, day, 'workshop');    // 0-55
    const gm  = _getScoreVal(groupId, day, 'games');       // 0-30
    const com = _getScoreVal(groupId, day, 'commitment');  // 0-20
    return Math.min(ws + gm + com, DAY_MAX);
}

/**
 * حساب الإجمالي الكلي من 365 (3 أيام × 105 + 50 حفلة السمر)
 */
function calcGroupGrandTotal(groupId) {
    const daysTotal = SCORE_DAYS.reduce((sum, d) => sum + calcGroupDayTotal(groupId, d), 0);
    return daysTotal + _getPartyScore(groupId);
}

/* دالة التوافق مع الكود القديم */
function calcGroupTotalFromStorage(groupId) {
    return calcGroupGrandTotal(groupId);
}



function saveJudgesNamesMaster() {
    const j1 = $('#judge1Name').val().trim() || 'الحكم 1';
    const j2 = $('#judge2Name').val().trim() || 'الحكم 2';
    const j3 = $('#judge3Name').val().trim() || 'الحكم 3';
    localStorage.setItem('yc_judge1_name', j1);
    localStorage.setItem('yc_judge2_name', j2);
    localStorage.setItem('yc_judge3_name', j3);
    updateJudgesHeaders();
    showToast('✅ تم حفظ وتثبيت أسماء الحكام بنجاح!', 'success');
}

function updateJudgesHeaders() {
    const j1 = $('#judge1Name').val() || localStorage.getItem('yc_judge1_name') || 'الحكم 1';
    const j2 = $('#judge2Name').val() || localStorage.getItem('yc_judge2_name') || 'الحكم 2';
    const j3 = $('#judge3Name').val() || localStorage.getItem('yc_judge3_name') || 'الحكم 3';
    // تحديث بطاقات الحكام في البطاقات المرسومة (جاهزة في voiceJudgingCards)
    $('.voice-judge-label[data-judge="1"]').text(j1);
    $('.voice-judge-label[data-judge="2"]').text(j2);
    $('.voice-judge-label[data-judge="3"]').text(j3);
    // تحديث رؤوس الجدول إن وجدت
    if ($('#thJudge1').length) $('#thJudge1').text(j1);
    if ($('#thJudge2').length) $('#thJudge2').text(j2);
    if ($('#thJudge3').length) $('#thJudge3').text(j3);
    // إعادة رسم بطاقات الحكام لتحديث الأسماء فوراً
    renderVoiceJudgingCards();
}

function onEvalDayChange() {
    const day = $('#evalDaySelect').val() || '1';
    const activities = MASTER_CONFERENCE_ACTIVITIES[day] || [];
    let html = '';
    activities.forEach(act => {
        html += `<option value="${act.id}" data-weight="${act.maxWeight}">${escapeHTML(act.name)} (${act.maxWeight} نقطة)</option>`;
    });
    $('#evalActivitySelect').html(html);
    onEvalActivityChange();
}

function onEvalActivityChange() {
    const selectedOpt = $('#evalActivitySelect option:selected');
    const weight = selectedOpt.data('weight') || 50;
    $('#evalMaxPoints').val(weight);
}

function saveGasSettingsFromMaster() {
    // لم يعد يُستخدم — الـ GAS URL مُدار عبر Netlify Environment Variables
    showToast('رابط GAS مُدار عبر Netlify Environment Variables ✅', 'info');
}

// للتوافق مع الكود القديم
function saveMasterGasUrl() {
    saveGasSettingsFromMaster();
}

async function pingGASNow() {
    showToast('جاري اختبار الاتصال بـ Google Sheets...', 'info');
    updateMasterCloudStatus();
}


function updateMasterCloudStatus() {
    const setAllBadges = (bgColor, borderColor, textColor, iconClass, text) => {
        $('#masterCloudBadge').css({ 'background': bgColor, 'border-color': borderColor, 'color': textColor });
        $('#badgeText').text(text);
        $('#badgeSpinIcon').attr('class', iconClass + ' me-1');
        $('#cloudPanelBadge').css({ 'background': bgColor, 'border': `1px solid ${borderColor}`, 'color': textColor });
        $('#cloudPanelBadgeText').text(text);
        $('#cloudPanelBadgeIcon').attr('class', iconClass + ' me-1');
    };

    setAllBadges('rgba(100,116,139,0.2)', '#64748b', '#94a3b8', 'bi bi-arrow-repeat spin-icon', 'جاري التحقق...');

    // كشف البيئة واستخدام الـ API URL المناسب من DataService
    const pingUrl = (window.DataService && window.DataService.getApiUrl()) 
        ? window.DataService.getApiUrl() 
        : (window.YC_CONFIG && window.YC_CONFIG.DIRECT_GAS_URL);

    if (!pingUrl) {
        setAllBadges('rgba(245,158,11,0.2)', '#f59e0b', '#fbbf24', 'bi bi-gear-fill', 'رابط GAS غير مضبوط ⚙️');
        return;
    }

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 5000);

    fetch(pingUrl, { method: 'GET', signal: ctrl.signal })
        .then(async res => {
            clearTimeout(tid);
            if (res.status === 503) {
                setAllBadges('rgba(245,158,11,0.2)', '#f59e0b', '#fbbf24', 'bi bi-gear-fill', 'يحتاج ضبط GAS_URL ⚙️');
                return;
            }
            try {
                const json = await res.json().catch(() => null);
                if (json && json.status === 'success') {
                    setAllBadges('rgba(16,185,129,0.2)', '#10b981', '#34d399', 'bi bi-cloud-check-fill', 'سحابي متصل ✅');
                } else if (json && json.status === 'error' && json.message && !json.message.includes('إجراء غير معروف')) {
                    setAllBadges('rgba(239,68,68,0.15)', '#ef4444', '#f87171', 'bi bi-cloud-slash-fill', 'خطأ في GAS: ' + json.message);
                } else {
                    setAllBadges('rgba(16,185,129,0.2)', '#10b981', '#34d399', 'bi bi-cloud-check-fill', 'سحابي متصل ✅');
                }
            } catch(e) {
                setAllBadges('rgba(16,185,129,0.2)', '#10b981', '#34d399', 'bi bi-cloud-check-fill', 'سحابي متصل ✅');
            }
        })
        .catch(err => {
            clearTimeout(tid);
            if (err && err.name === 'AbortError') {
                setAllBadges('rgba(239,68,68,0.15)', '#ef4444', '#f87171', 'bi bi-cloud-slash-fill', 'انتهت المهلة ❌');
            } else {
                setAllBadges('rgba(245,158,11,0.2)', '#f59e0b', '#fbbf24', 'bi bi-cloud-slash-fill', 'تعذّر الاتصال ⚠️');
            }
        });
}

function setGASStatusError() {
    $('#masterCloudBadge').css({ 'background': 'rgba(239,68,68,0.15)', 'border-color': '#ef4444', 'color': '#f87171' });
    $('#badgeText').text('خطأ في الاتصال ❌');
    $('#badgeSpinIcon').attr('class', 'bi bi-cloud-slash-fill me-1');
}



function setSyncButtonsBusy() {
    // زر الشريط العلوي
    $('#masterSyncIcon').attr('class', 'bi bi-arrow-repeat spin-icon');
    $('#masterSyncLabel').text('جاري الرفع...');
    $('#masterSyncBtn').prop('disabled', true);
    // زر قاعدة البيانات الشاملة
    $('#fullDbSyncIcon').attr('class', 'bi bi-arrow-repeat spin-icon');
    $('#fullDbSyncLabel').text('جاري الرفع...');
    $('#fullDbSyncBtn').prop('disabled', true);
}

function setSyncButtonsIdle() {
    $('#masterSyncIcon').attr('class', 'bi bi-cloud-arrow-up-fill');
    $('#masterSyncLabel').text('مزامنة سحابية الآن');
    $('#masterSyncBtn').prop('disabled', false);
    $('#fullDbSyncIcon').attr('class', 'bi bi-cloud-arrow-up-fill');
    $('#fullDbSyncLabel').text('رفع للشيت');
    $('#fullDbSyncBtn').prop('disabled', false);
}

async function openGuideModalMaster() {
    $('#guideModalMaster').addClass('show');
    try {
        const res = await fetch('assets/js/google-apps-script-Code.gs.js');
        const text = await res.text();
        $('#gasScriptCodeMaster').val(text);
    } catch (e) {}
}

function closeGuideModalMaster() {
    $('#guideModalMaster').removeClass('show');
}

function copyGasCodeMaster() {
    const el = document.getElementById('gasScriptCodeMaster');
    el.select();
    document.execCommand('copy');
    showToast('تم نسخ كود Google Apps Script بنجاح! 📋', 'success');
}

function renderAdminScoresPanel() {
    const j1 = localStorage.getItem('yc_judge1_name') || 'الحكم 1';
    const j2 = localStorage.getItem('yc_judge2_name') || 'الحكم 2';
    const j3 = localStorage.getItem('yc_judge3_name') || 'الحكم 3';
    $('#judge1Name').val(j1);
    $('#judge2Name').val(j2);
    $('#judge3Name').val(j3);
    // بدون مزامنة #evalDaySelect / #supDaySelect (غير موجودين في هذه الصفحة)
    renderAllScoringPanels();
}


/* ══════════════════════════════════════════════════════════════
   دوال النظام الجديد لتقييم المجموعات
   ══════════════════════════════════════════════════════════════ */

function onScoringDayChange() {
    renderAllScoringPanels();
    // تحديث قسم المجموعات فوراً إذا كان مفتوحاً
    if (currentSection === 'groups') renderGroupsBoard();
}

function renderAllScoringPanels() {
    renderVoiceJudgingCards();
    renderGamesScoreCards();
    renderCommitmentScoreCards();
    renderPartyScoreCards();
    renderGroupSummaryCards();
}

/* ─────────────────────────────────────────────────────────────
   الجزء الأول: تقييم ورش العمل بالنجوم (The Voice)
   ───────────────────────────────────────────────────────────── */
function renderVoiceJudgingCards() {
    if (!db || !Array.isArray(db.groups)) return;
    const day = $('#scoringDaySelect').val() || '1';
    const j1 = localStorage.getItem('yc_judge1_name') || 'الحكم 1';
    const j2 = localStorage.getItem('yc_judge2_name') || 'الحكم 2';
    const j3 = localStorage.getItem('yc_judge3_name') || 'الحكم 3';

    let html = '';
    db.groups.forEach(g => {
        const savedWS = _getScoreVal(g.id, day, 'workshop');
        const locked  = savedWS > 0;
        const s1 = Number(localStorage.getItem(`yc_ws_j1_${g.id}_d${day}`) || 0);
        const s2 = Number(localStorage.getItem(`yc_ws_j2_${g.id}_d${day}`) || 0);
        const s3 = Number(localStorage.getItem(`yc_ws_j3_${g.id}_d${day}`) || 0);

        const makeStars = (judgeIdx, current) => {
            let s = '';
            for (let i = 1; i <= 5; i++) {
                s += `<button class="star-btn ${i <= current ? 'lit' : 'dim'}" onclick="setJudgeStar('${g.id}','${day}',${judgeIdx},${i})">${i <= current ? '⭐' : '☆'}</button>`;
            }
            return s;
        };

        // حساب المعاينة من النجوم
        const entered = [s1, s2, s3].filter(v => v > 0);
        const avgStars = entered.length > 0 ? entered.reduce((a,b) => a+b, 0) / entered.length : 0;
        const starCalcPts = Math.round(avgStars / 5 * 55);
        const displayVal = locked ? savedWS : (starCalcPts > 0 ? starCalcPts : '');

        html += `
        <div class="voice-group-card ${locked ? 'locked' : ''}" id="vcard_${g.id}">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
                <div style="font-weight:900; font-size:1rem; color:#e2e8f0;">${escapeHTML(g.name)}</div>
                ${locked ? `<div style="background:rgba(34,197,94,0.2); border:1px solid rgba(34,197,94,0.4); border-radius:10px; padding:3px 12px; font-size:0.8rem; color:#86efac; font-weight:800;">✅ مُعتمد: ${savedWS}/55 نقطة</div>` : ''}
            </div>

            <!-- 1. تقييم النجوم (الحكام 1، 2، 3) -->
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; ${locked ? 'opacity:0.5;pointer-events:none;' : ''}">
                <div class="judge-col">
                    <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px; font-weight:700;">${escapeHTML(j1)}</div>
                    <div id="stars_j1_${g.id}">${makeStars(1, s1)}</div>
                    <div style="font-size:0.72rem; color:#fbbf24; margin-top:2px; font-weight:700;">${s1} / 5 ⭐</div>
                </div>
                <div class="judge-col">
                    <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px; font-weight:700;">${escapeHTML(j2)}</div>
                    <div id="stars_j2_${g.id}">${makeStars(2, s2)}</div>
                    <div style="font-size:0.72rem; color:#fbbf24; margin-top:2px; font-weight:700;">${s2} / 5 ⭐</div>
                </div>
                <div class="judge-col">
                    <div style="font-size:0.75rem; color:#94a3b8; margin-bottom:4px; font-weight:700;">${escapeHTML(j3)}</div>
                    <div id="stars_j3_${g.id}">${makeStars(3, s3)}</div>
                    <div style="font-size:0.72rem; color:#fbbf24; margin-top:2px; font-weight:700;">${s3} / 5 ⭐</div>
                </div>
            </div>

            <!-- 2. شريط الدرجة (يدوي / نجوم) والاعتماد -->
            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:12px; border-top:1px solid rgba(255,255,255,0.08); padding-top:10px; flex-wrap:wrap; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <label for="manualWS_${g.id}" style="font-size:0.82rem; color:#cbd5e1; font-weight:800; cursor:pointer;">
                        🔢 الدرجة (يدوي أو بالنجوم):
                    </label>
                    <input type="number" id="manualWS_${g.id}" min="0" max="55" value="${displayVal}" placeholder="0-55"
                        ${locked ? 'disabled' : ''}
                        style="width:75px; background:rgba(15,23,42,0.85); border:1px solid rgba(250,204,21,0.45); border-radius:8px; color:#fbbf24; padding:5px 8px; font-size:0.95rem; font-weight:900; text-align:center;">
                    <span style="font-size:0.85rem; color:#64748b; font-weight:700;">/ 55 نقطة</span>
                    ${!locked && avgStars > 0 ? `<span style="font-size:0.75rem; color:#22d3ee; margin-right:4px;">(متوسط النجوم: ${avgStars.toFixed(1)} ⭐)</span>` : ''}
                </div>

                <div>
                    ${!locked ? `
                        <button class="action-btn" style="padding:6px 18px; font-size:0.82rem; font-weight:900; background:rgba(250,204,21,0.2); border:1px solid rgba(250,204,21,0.5); color:#fde68a; border-radius:10px; cursor:pointer;" onclick="applyWorkshopStars('${g.id}','${escapeHTML(g.name)}','${day}')">
                            <i class="bi bi-check2-circle me-1"></i>اعتماد
                        </button>
                    ` : `
                        <button class="action-btn" style="padding:6px 16px; font-size:0.8rem; background:rgba(100,116,139,0.2); border:1px solid rgba(100,116,139,0.3); color:#94a3b8; border-radius:10px;" onclick="unlockWorkshop('${g.id}','${day}')">
                            <i class="bi bi-unlock me-1"></i>تعديل
                        </button>
                    `}
                </div>
            </div>
        </div>`;
    });
    $('#voiceJudgingCards').html(html);
}

function setJudgeStar(groupId, day, judgeIdx, stars) {
    localStorage.setItem(`yc_ws_j${judgeIdx}_${groupId}_d${day}`, stars);
    const s1 = Number(localStorage.getItem(`yc_ws_j1_${groupId}_d${day}`) || 0);
    const s2 = Number(localStorage.getItem(`yc_ws_j2_${groupId}_d${day}`) || 0);
    const s3 = Number(localStorage.getItem(`yc_ws_j3_${groupId}_d${day}`) || 0);
    const entered = [s1, s2, s3].filter(v => v > 0);
    const avgStars = entered.length > 0 ? entered.reduce((a,b) => a+b, 0) / entered.length : 0;
    const starCalcPts = Math.round(avgStars / 5 * 55);
    const inp = document.getElementById(`manualWS_${groupId}`);
    if (inp) inp.value = starCalcPts;
    renderVoiceJudgingCards();
}

function unlockWorkshop(groupId, day) {
    _setScoreVal(groupId, day, 'workshop', 0);
    renderAllScoringPanels();
}

function applyWorkshopStars(groupId, groupName, day) {
    const inp = document.getElementById(`manualWS_${groupId}`);
    let pts = NaN;
    if (inp && inp.value !== '') {
        pts = parseInt(inp.value, 10);
    }
    
    // إذا لم يكتب رقماً، نحسب من النجوم
    if (isNaN(pts)) {
        const s1 = Number(localStorage.getItem(`yc_ws_j1_${groupId}_d${day}`) || 0);
        const s2 = Number(localStorage.getItem(`yc_ws_j2_${groupId}_d${day}`) || 0);
        const s3 = Number(localStorage.getItem(`yc_ws_j3_${groupId}_d${day}`) || 0);
        const entered = [s1, s2, s3].filter(v => v > 0);
        if (entered.length === 0) {
            showToast('⚠️ أدخل الدرجة يدوياً (0-55) أو اختر النجوم للحكام', 'warning');
            return;
        }
        const avgStars = entered.reduce((a,b) => a+b, 0) / entered.length;
        pts = Math.round(avgStars / 5 * 55);
    }

    pts = Math.min(55, Math.max(0, pts));
    _setScoreVal(groupId, day, 'workshop', pts);
    const grand = calcGroupGrandTotal(groupId);
    _applyPointsToGroup(groupId, groupName, grand);
    renderAllScoringPanels();
    _syncGroupScoreToGAS(groupId, groupName, day, 'workshop', pts);
    showToast(`✅ ورشة ${groupName} اليوم ${day}: ${pts}/55 نقطة مُعتمدة`, 'success');
}

function triggerVoiceReveal() {
    if (!db || !Array.isArray(db.groups)) return;
    const day = $('#scoringDaySelect').val() || '1';
    // نبحث عن المجموعة غير المُعتمدة أولاً، وإلا نأخذ الأولى
    const group = db.groups.find(g => _getScoreVal(g.id, day, 'workshop') === 0) || db.groups[0];
    const j1 = localStorage.getItem('yc_judge1_name') || 'الحكم 1';
    const j2 = localStorage.getItem('yc_judge2_name') || 'الحكم 2';
    const j3 = localStorage.getItem('yc_judge3_name') || 'الحكم 3';
    const s1 = Number(localStorage.getItem(`yc_ws_j1_${group.id}_d${day}`) || 0);
    const s2 = Number(localStorage.getItem(`yc_ws_j2_${group.id}_d${day}`) || 0);
    const s3 = Number(localStorage.getItem(`yc_ws_j3_${group.id}_d${day}`) || 0);
    const entered = [s1,s2,s3].filter(v=>v>0);
    const avgStars = entered.length>0 ? entered.reduce((a,b)=>a+b,0)/entered.length : 0;
    
    let pts = NaN;
    const inp = document.getElementById(`manualWS_${group.id}`);
    if (inp && inp.value !== '') pts = parseInt(inp.value, 10);
    if (isNaN(pts)) pts = Math.round(avgStars/5*55);
    pts = Math.min(55, Math.max(0, pts));

    // بناء صفوف الحكام
    const judgeRows = [[j1,s1],[j2,s2],[j3,s3]].map(([name,stars],ri) => {
        const starsHtml = Array.from({length:5},(_, i)=>`<span class="reveal-star" id="revStar_${ri}_${i}">☆</span>`).join('');
        return `<div class="reveal-judge-row" id="revRow_${ri}"><span class="reveal-judge-label">${escapeHTML(name)}</span><div class="reveal-stars-container">${starsHtml}</div></div>`;
    }).join('');

    $('#revealGroupName').text(group.name);
    $('#revealJudgesRows').html(judgeRows);
    $('#revealFinalScore').text(`${pts} / 55`).removeClass('show');
    $('#revealSubtext').css('opacity',0);
    document.getElementById('voiceRevealScreen').classList.add('active');

    // أنيميشن تسلسلي
    const starSets = [s1,s2,s3];
    let delay = 800;
    starSets.forEach((stars, ri) => {
        setTimeout(() => {
            document.getElementById(`revRow_${ri}`).classList.add('show');
            let sd = 200;
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    const el = document.getElementById(`revStar_${ri}_${i}`);
                    if (el && i < stars) el.classList.add('lit');
                }, sd * (i+1));
            }
        }, delay);
        delay += 1400;
    });

    // النتيجة النهائية
    setTimeout(() => {
        document.getElementById('revealFinalScore').classList.add('show');
        document.getElementById('revealSubtext').style.opacity = '1';
        // حفظ تلقائي
        _setScoreVal(group.id, day, 'workshop', pts);
        const grand = calcGroupGrandTotal(group.id);
        _applyPointsToGroup(group.id, group.name, grand);
        _syncGroupScoreToGAS(group.id, group.name, day, 'workshop', pts);
    }, delay + 300);

    // حفظ الكائن للإغلاق
    window._revealGroupId   = group.id;
    window._revealGroupName = group.name;
    window._revealDay       = day;
    window._revealPts       = pts;
}

function closeVoiceReveal() {
    document.getElementById('voiceRevealScreen').classList.remove('active');
    renderAllScoringPanels();
}

/* ─────────────────────────────────────────────────────────────
   الجزء الثاني: نقاط الألعاب (المشرف — تراكمي)
   ───────────────────────────────────────────────────────────── */
function renderGamesScoreCards() {
    if (!db || !Array.isArray(db.groups)) return;
    const day = $('#scoringDaySelect').val() || '1';
    let html = '';
    db.groups.forEach(g => {
        const current = _getScoreVal(g.id, day, 'games');
        const pct = Math.round(current / 30 * 100);
        html += `
        <div style="background:rgba(15,23,42,0.5); border:1px solid rgba(239,68,68,0.15); border-radius:14px; padding:12px 14px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="font-weight:800; color:#e2e8f0; min-width:90px;">${escapeHTML(g.name)}</div>
                <div class="score-progress-bar" style="flex:1;">
                    <div class="score-progress-fill" style="width:${pct}%; background:linear-gradient(90deg,#ef4444,#f97316);"></div>
                </div>
                <div style="font-weight:900; color:#f87171; min-width:60px; text-align:center;">${current}/30</div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="number" id="gamesPts_${g.id}" min="1" max="${30-current}" placeholder="+نقاط"
                        style="width:70px; background:rgba(15,23,42,0.8); border:1px solid rgba(239,68,68,0.3); border-radius:8px; color:#fff; padding:5px 8px; font-size:0.85rem; text-align:center;">
                    <button onclick="addGamesPoints('${g.id}','${escapeHTML(g.name)}','${day}')" style="background:rgba(239,68,68,0.25); border:1px solid rgba(239,68,68,0.4); color:#f87171; border-radius:8px; padding:5px 10px; font-weight:800; font-size:0.8rem; cursor:pointer;">+ إضافة</button>
                    ${current > 0 ? `<button onclick="resetGamesPoints('${g.id}','${escapeHTML(g.name)}','${day}')" style="background:none; border:1px solid rgba(100,116,139,0.3); color:#64748b; border-radius:8px; padding:5px 8px; font-size:0.75rem; cursor:pointer;">↩ صفر</button>` : ''}
                </div>
            </div>
        </div>`;
    });
    $('#gamesScoreCards').html(html);
}

function addGamesPoints(groupId, groupName, day) {
    const input = $(`#gamesPts_${groupId}`);
    const add = Math.max(0, parseInt(input.val()) || 0);
    if (add <= 0) { showToast('⚠️ أدخل عدد نقاط أكبر من صفر', 'warning'); return; }
    const current = _getScoreVal(groupId, day, 'games');
    const newVal  = Math.min(30, current + add);
    _setScoreVal(groupId, day, 'games', newVal);
    const grand = calcGroupGrandTotal(groupId);
    _applyPointsToGroup(groupId, groupName, grand);
    _syncGroupScoreToGAS(groupId, groupName, day, 'games', newVal);
    renderGamesScoreCards();
    renderGroupSummaryCards();
    showToast(`🎮 تم إضافة +${add} نقطة للألعاب — ${groupName} اليوم ${day}: ${newVal}/30`, 'success');
}

function resetGamesPoints(groupId, groupName, day) {
    _setScoreVal(groupId, day, 'games', 0);
    _syncGroupScoreToGAS(groupId, groupName, day, 'games', 0);
    renderGamesScoreCards();
    renderGroupSummaryCards();
    showToast(`↩ تم تصفير نقاط الألعاب لـ ${groupName} اليوم ${day}`, 'info');
}

/* ─────────────────────────────────────────────────────────────
   الجزء الثالث: تقييم الالتزام (المشرف — قابل للتحديث)
   ───────────────────────────────────────────────────────────── */
function renderCommitmentScoreCards() {
    if (!db || !Array.isArray(db.groups)) return;
    const day = $('#scoringDaySelect').val() || '1';
    let html = '';
    db.groups.forEach(g => {
        const current = _getScoreVal(g.id, day, 'commitment');
        const pct = Math.round(current / 20 * 100);
        html += `
        <div style="background:rgba(15,23,42,0.5); border:1px solid rgba(34,197,94,0.15); border-radius:14px; padding:12px 14px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="font-weight:800; color:#e2e8f0; min-width:90px;">${escapeHTML(g.name)}</div>
                <div class="score-progress-bar" style="flex:1;">
                    <div class="score-progress-fill" style="width:${pct}%; background:linear-gradient(90deg,#16a34a,#22c55e);"></div>
                </div>
                <div style="font-weight:900; color:#86efac; min-width:60px; text-align:center;">${current}/20</div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button onclick="adjustCommitment('${g.id}','${escapeHTML(g.name)}','${day}',-5)" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:8px; padding:4px 10px; font-weight:900; cursor:pointer;">−5</button>
                    <button onclick="adjustCommitment('${g.id}','${escapeHTML(g.name)}','${day}',-1)" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.2); color:#f87171; border-radius:8px; padding:4px 8px; font-weight:900; cursor:pointer;">−1</button>
                    <span style="font-size:0.8rem; color:#64748b; padding:0 4px;">|</span>
                    <button onclick="adjustCommitment('${g.id}','${escapeHTML(g.name)}','${day}',1)" style="background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); color:#86efac; border-radius:8px; padding:4px 8px; font-weight:900; cursor:pointer;">+1</button>
                    <button onclick="adjustCommitment('${g.id}','${escapeHTML(g.name)}','${day}',5)" style="background:rgba(34,197,94,0.2); border:1px solid rgba(34,197,94,0.3); color:#86efac; border-radius:8px; padding:4px 10px; font-weight:900; cursor:pointer;">+5</button>
                    <button onclick="setCommitmentFull('${g.id}','${escapeHTML(g.name)}','${day}')" style="background:rgba(34,197,94,0.25); border:1px solid rgba(34,197,94,0.4); color:#86efac; border-radius:8px; padding:4px 10px; font-size:0.75rem; font-weight:800; cursor:pointer;">كامل 20</button>
                </div>
            </div>
        </div>`;
    });
    $('#commitmentScoreCards').html(html);
}

function adjustCommitment(groupId, groupName, day, delta) {
    const current = _getScoreVal(groupId, day, 'commitment');
    const newVal  = Math.min(20, Math.max(0, current + delta));
    _setScoreVal(groupId, day, 'commitment', newVal);
    const grand = calcGroupGrandTotal(groupId);
    _applyPointsToGroup(groupId, groupName, grand);
    _syncGroupScoreToGAS(groupId, groupName, day, 'commitment', newVal);
    renderCommitmentScoreCards();
    renderGroupSummaryCards();
    const sign = delta > 0 ? '+' : '';
    showToast(`📋 الالتزام ${groupName} اليوم ${day}: ${sign}${delta} → ${newVal}/20`, delta > 0 ? 'success' : 'info');
}

function setCommitmentFull(groupId, groupName, day) {
    adjustCommitment(groupId, groupName, day, 20 - _getScoreVal(groupId, day, 'commitment'));
}

/* ─────────────────────────────────────────────────────────────
   الجزء الرابع: تقييم حفلة السمر (المشرف — 50 نقطة حدث واحد)
   ───────────────────────────────────────────────────────────── */
function renderPartyScoreCards() {
    if (!db || !Array.isArray(db.groups)) return;
    let html = '';
    db.groups.forEach(g => {
        const current = _getPartyScore(g.id);
        const pct = Math.round(current / 50 * 100);
        html += `
        <div style="background:rgba(15,23,42,0.5); border:1px solid rgba(168,85,247,0.2); border-radius:14px; padding:12px 14px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <div style="font-weight:800; color:#e2e8f0; min-width:90px;">${escapeHTML(g.name)}</div>
                <div class="score-progress-bar" style="flex:1;">
                    <div class="score-progress-fill" style="width:${pct}%; background:linear-gradient(90deg,#9333ea,#c084fc);"></div>
                </div>
                <div style="font-weight:900; color:#c4b5fd; min-width:60px; text-align:center;">${current}/50</div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button onclick="adjustPartyScore('${g.id}','${escapeHTML(g.name)}',-5)" style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:8px; padding:4px 10px; font-weight:900; cursor:pointer;">−5</button>
                    <button onclick="adjustPartyScore('${g.id}','${escapeHTML(g.name)}',-1)" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.2); color:#f87171; border-radius:8px; padding:4px 8px; font-weight:900; cursor:pointer;">−1</button>
                    <span style="font-size:0.8rem; color:#64748b; padding:0 4px;">|</span>
                    <button onclick="adjustPartyScore('${g.id}','${escapeHTML(g.name)}',1)" style="background:rgba(168,85,247,0.15); border:1px solid rgba(168,85,247,0.3); color:#c4b5fd; border-radius:8px; padding:4px 8px; font-weight:900; cursor:pointer;">+1</button>
                    <button onclick="adjustPartyScore('${g.id}','${escapeHTML(g.name)}',5)" style="background:rgba(168,85,247,0.2); border:1px solid rgba(168,85,247,0.3); color:#c4b5fd; border-radius:8px; padding:4px 10px; font-weight:900; cursor:pointer;">+5</button>
                    <button onclick="setPartyScoreFull('${g.id}','${escapeHTML(g.name)}')" style="background:rgba(168,85,247,0.25); border:1px solid rgba(168,85,247,0.4); color:#c4b5fd; border-radius:8px; padding:4px 10px; font-size:0.75rem; font-weight:800; cursor:pointer;">كامل 50</button>
                </div>
            </div>
        </div>`;
    });
    $('#partyScoreCards').html(html);
}

function adjustPartyScore(groupId, groupName, delta) {
    const current = _getPartyScore(groupId);
    const newVal  = Math.min(50, Math.max(0, current + delta));
    _setPartyScore(groupId, newVal);
    const grand = calcGroupGrandTotal(groupId);
    _applyPointsToGroup(groupId, groupName, grand);
    _syncPartyScoreToGAS(groupId, groupName, newVal);
    renderPartyScoreCards();
    renderGroupSummaryCards();
    const sign = delta > 0 ? '+' : '';
    showToast(`🎉 حفلة السمر ${groupName}: ${sign}${delta} → ${newVal}/50`, delta > 0 ? 'success' : 'info');
}

function setPartyScoreFull(groupId, groupName) {
    adjustPartyScore(groupId, groupName, 50 - _getPartyScore(groupId));
}

function _syncPartyScoreToGAS(groupId, groupName, points) {
    if (!window.DataService) return;
    const grandTotal = calcGroupGrandTotal(groupId);
    window.DataService.sendToGAS({
        action    : 'updatePartyScore',
        group     : groupName,
        points    : points,
        grandTotal: grandTotal
    }).catch(err => console.warn('[scoring] GAS party sync error:', err));
    window.dispatchEvent(new CustomEvent('yc_group_scores_updated', {
        detail: { groupId, groupName, category: 'party', points, grandTotal }
    }));
}

/* ─────────────────────────────────────────────────────────────
   مزامنة نقطة مع Google Sheets
   ───────────────────────────────────────────────────────────── */
function _syncGroupScoreToGAS(groupId, groupName, day, category, points) {
    if (!window.DataService) return;
    const dayTotal   = calcGroupDayTotal(groupId, day);
    const grandTotal = calcGroupGrandTotal(groupId);
    window.DataService.sendToGAS({
        action    : 'updateGroupDayScore',
        group     : groupName,
        day       : day,
        category  : category,
        points    : points,
        dayTotal  : dayTotal,
        grandTotal: grandTotal
    }).catch(err => console.warn('[scoring] GAS sync error:', err));
    // إطلاق حدث للتحديث الفوري في قسم المجموعات
    window.dispatchEvent(new CustomEvent('yc_group_scores_updated', {
        detail: { groupId, groupName, day, category, points, dayTotal, grandTotal }
    }));
}

// دالة توافق — تُعيد توجيه للنظام الجديد
function renderGroupsEvalTable() {
    renderVoiceJudgingCards();
}

// دوال توافق مع الكود القديم
function calcWorkshopAvg(groupId) { renderVoiceJudgingCards(); }
function applyWorkshopScores(gId, gName, day) { applyWorkshopStars(gId, gName, day); }
window.applySupervisorPoints = function(type) { /* replaced by new system */ };

/* ─── تطبيق النقاط على المشتركين ─── */
function _applyPointsToGroup(groupId, groupName, newTotal) {
    // تحديث محلي فقط — المزامنة مع GAS تتم عبر _syncGroupScoreToGAS
    if (db && Array.isArray(db.groups)) {
        const g = db.groups.find(g => g.id === groupId);
        if (g) g.points = newTotal;
    }
    markUnsaved();
    saveToStorage();
    // إطلاق حدث لتحديث قسم المجموعات فوراً
    window.dispatchEvent(new CustomEvent('yc_group_scores_updated', { detail: { groupId, newTotal } }));
}

/* ─── جدول المشرف ─── */
function renderSupervisorTable() { renderGamesScoreCards(); }

function renderGroupSummaryCards() {
    if (!db || !Array.isArray(db.groups)) return;
    const day = $('#scoringDaySelect').val() || '1';

    const sortedGroups = [...db.groups].sort((a, b) => {
        return calcGroupGrandTotal(b.id) - calcGroupGrandTotal(a.id);
    });

    const rankIcons = ['🥇', '🥈', '🥉', '4️⃣'];
    let html = '';

    sortedGroups.forEach((g, rank) => {
        const grand = calcGroupGrandTotal(g.id);
        const today = calcGroupDayTotal(g.id, day);
        const ws  = _getScoreVal(g.id, day, 'workshop');
        const gm  = _getScoreVal(g.id, day, 'games');
        const com = _getScoreVal(g.id, day, 'commitment');
        const pct = Math.min(100, Math.round(grand / TOTAL_MAX_PTS * 100));
        const todayPct = Math.min(100, Math.round(today / 100 * 100));
        const stars = renderStarsHTML(grand);

        html += `
        <div class="col-md-6 col-12">
            <div style="background:rgba(15,23,42,0.7); border:1.5px solid rgba(251,191,36,0.2); border-radius:20px; padding:1.1rem; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#fbbf24,#06b6d4); opacity:${pct/100};"></div>
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:1.5rem;">${rankIcons[rank] || '🏅'}</span>
                        <div>
                            <div style="font-weight:900; font-size:0.95rem; color:#fff;">${escapeHTML(g.name)}</div>
                            <div style="font-size:0.65rem;">${stars}</div>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:1.6rem; font-weight:900; color:#fbbf24; line-height:1;">${grand}</div>
                        <div style="font-size:0.62rem; color:#64748b;">/ ${TOTAL_MAX_PTS} كلي</div>
                    </div>
                </div>
                <!-- شريط الإجمالي الكلي -->
                <div class="score-progress-bar" style="margin-bottom:10px;">
                    <div class="score-progress-fill" style="width:${pct}%; background:linear-gradient(90deg,#fbbf24,#06b6d4);"></div>
                </div>
                <!-- تفصيل اليوم الحالي -->
                <div style="border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
                    <div style="font-size:0.72rem; color:#64748b; margin-bottom:6px; font-weight:700;">اليوم ${day}: ${today}/100 نقطة</div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <span style="background:rgba(250,204,21,0.12); border:1px solid rgba(250,204,21,0.25); border-radius:8px; padding:2px 8px; font-size:0.7rem; color:#fde68a; font-weight:700;">⭐ ورش: ${ws}/40</span>
                        <span style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:2px 8px; font-size:0.7rem; color:#fca5a5; font-weight:700;">🎮 ألعاب: ${gm}/30</span>
                        <span style="background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.25); border-radius:8px; padding:2px 8px; font-size:0.7rem; color:#86efac; font-weight:700;">✅ التزام: ${com}/30</span>
                    </div>
                </div>
            </div>
        </div>`;
    });

    $('#groupSummaryCardsContainer').html(html);
}

/* ========================================================
   2. FREE GAMES, LEADERBOARD PODIUM & REPORTS
   ======================================================== */

function renderGamesLeaderboardPanel() {
    renderGameLogsTable();
    renderLeaderboardPodium();
    renderWhatsAppReport();
    renderDetailedMatrix();
}

function onGameParticipantSearch(query) {
    const $list = $('#autocompleteSuggestions');
    if (!query || query.trim().length < 1 || !db || !Array.isArray(db.participants)) {
        $list.hide();
        return;
    }

    const q = query.trim().toLowerCase();
    const matches = db.participants.filter(p => p.name && p.name.toLowerCase().includes(q)).slice(0, 8);

    if (matches.length === 0) {
        $list.hide();
        return;
    }

    let html = '';
    matches.forEach(p => {
        const groupObj = db.groups ? db.groups.find(g => g.id === p.groupId) : null;
        const groupName = groupObj ? groupObj.name : 'بدون مجموعة';

        html += `<div class="suggestion-item" onclick="selectGameParticipant('${p.id}', '${escapeHTML(p.name)}', '${p.groupId || ''}')">
            <span><i class="bi bi-person-circle me-1"></i> ${escapeHTML(p.name)}</span>
            <span class="badge-chip badge-cyan" style="font-size:0.7rem;">${escapeHTML(groupName)}</span>
        </div>`;
    });

    $list.html(html).show();
}

function selectGameParticipant(id, name, groupId) {
    $('#gameParticipantInput').val(name);
    if (groupId) $('#gameGroupSelect').val(groupId);
    $('#autocompleteSuggestions').hide();
}

async function handleAddGameLog(e) {
    if (e) e.preventDefault();

    if (!db || !Array.isArray(db.groups)) {
        showToast('⚠️ البيانات غير محملة بعد', 'warning');
        return;
    }

    const name    = $('#gameParticipantInput').val().trim();
    const groupId = $('#gameGroupSelect').val();
    const score   = Number($('#gameScoreInput').val() || 0);
    const desc    = $('#gameDescInput').val().trim() || 'لعبة حرة';

    if (!score || score <= 0) {
        showToast('⚠️ يرجى إدخال عدد نقاط صحيح!', 'warning');
        return;
    }

    const groupObj  = db.groups.find(g => g.id === groupId);
    const groupName = groupObj ? groupObj.name : 'المجموعة';

    // تسجيل تاريخي فقط — لا يتدخل في نظام النقاط الجديد
    db.gameLogs = db.gameLogs || [];
    db.gameLogs.unshift({
        id             : 'glog_' + Date.now(),
        participantName: name || 'مشترك',
        groupId        : groupId,
        groupName      : groupName,
        score          : score,
        desc           : desc,
        date           : new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });

    markUnsaved();
    saveToStorage();
    renderGamesLeaderboardPanel();

    $('#gameParticipantInput').val('');
    $('#gameScoreInput').val('');
    $('#gameDescInput').val('');

    showToast(`🏆 تم تسجيل +${score} نقطة لـ ${groupName} (${desc})!`, 'success');
}

function renderGameLogsTable() {
    const logs = db.gameLogs || [];
    $('#gameLogsCountBadge').text(logs.length + ' سجل');

    if (logs.length === 0) {
        $('#gameLogsTableBody').html(`<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">لا توجد سجلات ألعاب حرة مضافة بعد</td></tr>`);
        return;
    }

    let html = '';
    logs.forEach(l => {
        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px; text-align: right; font-weight: 700; color: #fff;">${escapeHTML(l.participantName)}</td>
                <td style="padding: 8px;"><span class="badge-chip badge-cyan" style="font-size:0.75rem;">${escapeHTML(l.groupName)}</span></td>
                <td style="padding: 8px; font-weight: 900; color: #fbbf24;">+${l.score}</td>
                <td style="padding: 8px; font-size: 0.78rem; color: #94a3b8;">${escapeHTML(l.desc)}</td>
                <td style="padding: 8px;">
                    <button onclick="deleteGameLog('${l.id}')" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.9rem;" title="حذف السجل">
                        <i class="bi bi-trash3"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    $('#gameLogsTableBody').html(html);
}

async function deleteGameLog(logId) {
    if (!db || !Array.isArray(db.gameLogs)) return;

    const idx = db.gameLogs.findIndex(l => l.id === logId);
    if (idx === -1) return;

    // حذف السجل فقط — لا نلمس نظام النقاط الجديد
    db.gameLogs.splice(idx, 1);

    markUnsaved();
    saveToStorage();
    renderGamesLeaderboardPanel();

    showToast('تم حذف سجل اللعبة بنجاح!', 'info');
}

function renderLeaderboardPodium() {
    if (!db || !Array.isArray(db.groups)) return;

    const groupScores = db.groups.map(g => ({
        id    : g.id,
        name  : g.name,
        grand : calcGroupGrandTotal(g.id),
        day1  : calcGroupDayTotal(g.id, '1'),
        day2  : calcGroupDayTotal(g.id, '2'),
        day3  : calcGroupDayTotal(g.id, '3')
    })).sort((a, b) => b.grand - a.grand);

    const first  = groupScores[0] || { name: '—', grand: 0 };
    const second = groupScores[1] || { name: '—', grand: 0 };
    const third  = groupScores[2] || { name: '—', grand: 0 };

    const pct = (pts) => Math.min(100, Math.round(pts / TOTAL_MAX_PTS * 100));

    let html = `
        <!-- 2nd Place (Left) -->
        <div class="podium-card second">
            <div class="podium-badge">🥈</div>
            <div class="podium-name">${escapeHTML(second.name)}</div>
            <div class="podium-score">${second.grand}</div>
            <div style="font-size:0.68rem; color:#c084fc; font-weight:800; margin-top:2px;">المركز الثاني</div>
            <div style="font-size:0.62rem; color:#64748b; margin-top:4px;">/ ${TOTAL_MAX_PTS} نقطة</div>
        </div>

        <!-- 1st Place (Center) -->
        <div class="podium-card first">
            <div style="position:absolute; top:-12px; font-size:1.4rem;">👑</div>
            <div class="podium-badge">🥇</div>
            <div class="podium-name" style="color:#fbbf24;">${escapeHTML(first.name)}</div>
            <div class="podium-score" style="color:#fbbf24; font-size:1.45rem;">${first.grand}</div>
            <div style="font-size:0.72rem; color:#fef08a; font-weight:800; margin-top:2px;">المركز الأول 🏆</div>
            <div style="font-size:0.62rem; color:#92400e; margin-top:4px;">/ ${TOTAL_MAX_PTS} نقطة</div>
        </div>

        <!-- 3rd Place (Right) -->
        <div class="podium-card third">
            <div class="podium-badge">🥉</div>
            <div class="podium-name">${escapeHTML(third.name)}</div>
            <div class="podium-score">${third.grand}</div>
            <div style="font-size:0.72rem; color:#38bdf8; font-weight:800; margin-top:2px;">المركز الثالث</div>
            <div style="font-size:0.62rem; color:#64748b; margin-top:4px;">/ ${TOTAL_MAX_PTS} نقطة</div>
        </div>
    `;

    $('#podiumContainer').css('direction', 'ltr').html(html);

    // الترتيب الكامل أسفل المنصة
    let rankHtml = '';
    groupScores.forEach((g, i) => {
        const icons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
        const icon  = icons[i] || `${i+1}.`;
        rankHtml += `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 12px;
            background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:6px;
            border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:1.1rem;">${icon}</span>
            <span style="flex:1; font-weight:800; font-size:0.88rem;">${escapeHTML(g.name)}</span>
            <div style="display:flex; gap:5px;">
                <span style="font-size:0.68rem; color:#fde68a;">ي1: ${g.day1}</span>
                <span style="font-size:0.68rem; color:#fde68a;">ي2: ${g.day2}</span>
                <span style="font-size:0.68rem; color:#fde68a;">ي3: ${g.day3}</span>
            </div>
            <span style="font-weight:900; color:#fbbf24; font-size:0.95rem; min-width:55px; text-align:left;">${g.grand} <span style="font-size:0.6rem; color:#64748b;">/${TOTAL_MAX_PTS}</span></span>
            <div style="width:70px; height:5px; background:rgba(255,255,255,0.07); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${pct(g.grand)}%; background:linear-gradient(90deg,#fbbf24,#06b6d4); border-radius:3px;"></div>
            </div>
        </div>`;
    });
    const rankContainer = document.getElementById('fullRankList');
    if (rankContainer) rankContainer.innerHTML = rankHtml;
}

function renderWhatsAppReport() {
    if (!db || !Array.isArray(db.groups)) return;

    const groupScores = db.groups.map(g => ({
        name  : g.name,
        grand : calcGroupGrandTotal(g.id),
        ws    : ['1','2','3'].reduce((s,d) => s + _getScoreVal(g.id,d,'workshop'), 0),
        gm    : ['1','2','3'].reduce((s,d) => s + _getScoreVal(g.id,d,'games'), 0),
        com   : ['1','2','3'].reduce((s,d) => s + _getScoreVal(g.id,d,'commitment'), 0),
        party : _getPartyScore(g.id)
    })).sort((a, b) => b.grand - a.grand);

    const ranks = ['🥇','🥈','🥉','🏅'];
    const lines = groupScores.map((g, i) =>
        `${ranks[i] || (i+1+'.')} ${g.name} — ${g.grand}/${TOTAL_MAX_PTS} نقطة\n` +
        `   ⭐ ورش: ${g.ws}  🎮 ألعاب: ${g.gm}  ✅ التزام: ${g.com}  🎉 سمر: ${g.party}`
    ).join('\n');

    const text =
`🏆 تقرير نتائج مؤتمر الشباب 2026 🏆
${'─'.repeat(35)}
${lines}
${'─'.repeat(35)}
📊 إجمالي النقاط: (3 أيام × 100) + 50 حفلة السمر = 350 نقطة
✨ تحيات لجنة التحكيم والإدارة ✨`;

    $('#whatsappReportPreview').val(text);
}

function copyWhatsAppReport() {
    const text = $('#whatsappReportPreview').val();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    } else {
        const el = document.getElementById('whatsappReportPreview');
        el.select();
        document.execCommand('copy');
    }
    showToast('تم نسخ التقرير المنسق لـ WhatsApp بنجاح! 📲', 'success');
}

function exportCSVReport() {
    if (!db || !Array.isArray(db.participants)) return;

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "الرقم,الاسم,المجموعة,النقاط,الغرفة,الأتوبيس,المقعد,الرأي,ترشيح الرحلة\n";

    db.participants.forEach((p, idx) => {
        const groupObj = db.groups ? db.groups.find(g => g.id === p.groupId) : null;
        const groupName = groupObj ? groupObj.name : 'بدون مجموعة';
        const row = [
            idx + 1,
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${groupName}"`,
            p.points || 0,
            `"${p.roomId || ''}"`,
            `"${p.busNumber || ''}"`,
            `"${p.seatNumber || ''}"`,
            `"${(p.feedback || '').replace(/"/g, '""')}"`,
            `"${(p.nextTrip || '').replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_مؤتمر_الشباب_2026_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('تم تحميل ملف Excel (CSV) المطور بنجاح! 📊', 'success');
}

function renderDetailedMatrix() {
    if (!db || !Array.isArray(db.groups)) return;

    const sorted = [...db.groups].sort((a,b) => calcGroupGrandTotal(b.id) - calcGroupGrandTotal(a.id));
    const rankIcons = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'];

    let html = '';
    sorted.forEach((g, i) => {
        const ws1   = _getScoreVal(g.id,'1','workshop'),  gm1 = _getScoreVal(g.id,'1','games'),  com1 = _getScoreVal(g.id,'1','commitment');
        const ws2   = _getScoreVal(g.id,'2','workshop'),  gm2 = _getScoreVal(g.id,'2','games'),  com2 = _getScoreVal(g.id,'2','commitment');
        const ws3   = _getScoreVal(g.id,'3','workshop'),  gm3 = _getScoreVal(g.id,'3','games'),  com3 = _getScoreVal(g.id,'3','commitment');
        const d1    = calcGroupDayTotal(g.id, '1');
        const d2    = calcGroupDayTotal(g.id, '2');
        const d3    = calcGroupDayTotal(g.id, '3');
        const party = _getPartyScore(g.id);
        const grand = calcGroupGrandTotal(g.id);
        const pct   = Math.min(100, Math.round(grand / TOTAL_MAX_PTS * 100));

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding:10px; text-align:right; font-weight:800; color:#fff; white-space:nowrap;">
                    ${rankIcons[i] || (i+1)} ${escapeHTML(g.name)}
                </td>
                <td style="padding:6px; text-align:center;">
                    <div style="font-size:0.78rem; color:#fbbf24; font-weight:700;">${d1}/100</div>
                    <div style="font-size:0.62rem; color:#94a3b8;">⭐${ws1} 🎮${gm1} ✅${com1}</div>
                </td>
                <td style="padding:6px; text-align:center;">
                    <div style="font-size:0.78rem; color:#fbbf24; font-weight:700;">${d2}/100</div>
                    <div style="font-size:0.62rem; color:#94a3b8;">⭐${ws2} 🎮${gm2} ✅${com2}</div>
                </td>
                <td style="padding:6px; text-align:center;">
                    <div style="font-size:0.78rem; color:#fbbf24; font-weight:700;">${d3}/100</div>
                    <div style="font-size:0.62rem; color:#94a3b8;">⭐${ws3} 🎮${gm3} ✅${com3}</div>
                </td>
                <td style="padding:6px; text-align:center;">
                    <div style="font-size:0.78rem; color:#c4b5fd; font-weight:700;">🎉 ${party}/50</div>
                </td>
                <td style="padding:10px; font-weight:900; color:#fbbf24; font-size:1rem; text-align:center;">
                    ${grand}
                    <div style="width:55px; height:4px; background:rgba(255,255,255,0.07); border-radius:2px; overflow:hidden; margin:3px auto 0;">
                        <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#fbbf24,#06b6d4);"></div>
                    </div>
                </td>
            </tr>
        `;
    });

    $('#detailedMatrixTableBody').html(html);
}

/* ========================================================
   3. FULL 8-COLUMN DATABASE TABLE (from admin.html)
   ======================================================== */

function renderFullDbPanel() {
    if (!db || !Array.isArray(db.participants)) return;

    const totalCount = db.participants.length;
    let groupAssignedCount = 0;
    let roomsUsedSet = new Set();
    let seatsUsedCount = 0;

    db.participants.forEach(p => {
        if (p.groupId) groupAssignedCount++;
        if (p.roomId) roomsUsedSet.add(p.roomId);
        if (p.seatNumber) seatsUsedCount++;
    });

    $('#fullDbStatTotal').text(totalCount);
    $('#fullDbStatPoints').text(groupAssignedCount); // أصبح عدد المعيَّنين لمجموعة
    $('#fullDbStatRooms').text(roomsUsedSet.size);
    $('#fullDbStatBuses').text(seatsUsedCount);

    const query = ($('#fullDbSearchInput').val() || '').trim().toLowerCase();

    let filtered = db.participants;
    if (query) {
        filtered = db.participants.filter(p => {
            const gObj = db.groups ? db.groups.find(g => g.id === p.groupId) : null;
            const gName = gObj ? gObj.name : '';
            return (p.name && p.name.toLowerCase().includes(query)) ||
                   (gName && gName.toLowerCase().includes(query)) ||
                   (p.roomId && String(p.roomId).toLowerCase().includes(query)) ||
                   (p.busNumber && String(p.busNumber).includes(query)) ||
                   (p.feedback && p.feedback.toLowerCase().includes(query)) ||
                   (p.nextTrip && p.nextTrip.toLowerCase().includes(query));
        });
    }

    if (filtered.length === 0) {
        $('#fullDbTableBody').html(`<tr><td colspan="10" style="text-align:center; padding: 25px; color: var(--text-muted);">لا توجد نتائج مطابقة للبحث</td></tr>`);
        return;
    }

    let html = '';
    filtered.forEach((p, idx) => {
        const groupObj = db.groups ? db.groups.find(g => g.id === p.groupId) : null;
        const groupName = groupObj ? groupObj.name : 'بدون مجموعة';
        const busText = p.busNumber ? `أتوبيس ${p.busNumber} (م ${p.seatNumber})` : '—';
        const roomText = p.roomId ? `${p.roomId.replace(/^r/, 'غرفة ')}` : '—';

        html += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px; text-align: center; color: var(--text-muted); font-size: 0.78rem;">${idx + 1}</td>
                <td style="padding: 10px; font-weight: 800; color: #fff;">${escapeHTML(p.name)}</td>
                <td style="padding: 10px;" class="editable-cell" onclick="inlineEditGroup('${p.id}', this)"><span class="badge-chip badge-cyan">${escapeHTML(groupName)}</span></td>
                <td style="padding: 10px; text-align: center; color: #c084fc; font-weight: 700;" class="editable-cell" onclick="inlineEditRoom('${p.id}', this)">${roomText}</td>
                <td style="padding: 10px; text-align: center; color: #38bdf8;" class="editable-cell" onclick="inlineEditSeat('${p.id}', this)">${busText}</td>
                <td style="padding: 10px; font-size: 0.78rem; color: #cbd5e1; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(p.feedback || '—')}</td>
                <td style="padding: 10px; font-size: 0.78rem; color: #f472b6; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(p.nextTrip || '—')}</td>
                <td style="padding: 10px; text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button onclick="openEdit('${p.id}')" class="action-btn primary" style="padding: 4px 8px; font-size: 0.75rem;" title="تعديل">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button onclick="deleteParticipant('${p.id}')" class="action-btn danger" style="padding: 4px 8px; font-size: 0.75rem;" title="حذف">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    $('#fullDbTableBody').html(html);
}

/* ========================================================
   التعديل الفوري Inline Editing في جدول قاعدة البيانات
   ======================================================== */
// inlineEditPoints — تم حذفها. لا توجد نقاط فردية — النقاط خاصة بالمجموعات.


async function inlineEditGroup(pId, element) {
    if ($(element).find('select').length > 0) return;
    const p = db.participants.find(x => x.id === pId);
    if (!p) return;

    let options = '<option value="none">بدون مجموعة</option>';
    db.groups.forEach(g => {
        options += `<option value="${g.id}" ${g.id === p.groupId ? 'selected' : ''}>${escapeHTML(g.name)}</option>`;
    });

    const $select = $(`<select class="edit-select" style="font-size:0.8rem; padding:2px; width:100%;">${options}</select>`);
    $(element).html($select);
    $select.focus();

    $select.on('blur change', async function(e) {
        const newVal = $select.val();
        const finalGroupId = newVal === 'none' ? null : newVal;
        const oldGroupId = p.groupId;
        
        if (finalGroupId === oldGroupId && e.type === 'change') return;

        const groupObj = finalGroupId ? db.groups.find(g => g.id === finalGroupId) : null;
        const groupName = groupObj ? groupObj.name : 'بدون مجموعة';

        // Optimistic UI Update
        p.groupId = finalGroupId;
        p.group = groupName;
        $(element).html(`<span class="badge-chip badge-cyan">${escapeHTML(groupName)}</span>`);
        showToast('تم تعديل المجموعة بنجاح ✅', 'success');

        try {
            const res = await window.DataService.updateField(p.name, 'group', groupName);
            if (res.status !== 'success') throw new Error(res.message);
        } catch(err) {
            p.groupId = oldGroupId;
            const oldGroupObj = oldGroupId ? db.groups.find(g => g.id === oldGroupId) : null;
            const oldGroupName = oldGroupObj ? oldGroupObj.name : 'بدون مجموعة';
            p.group = oldGroupName;
            $(element).html(`<span class="badge-chip badge-cyan">${escapeHTML(oldGroupName)}</span>`);
            showToast('❌ فشل المزامنة السحابية للمجموعة', 'error');
        }
    });
}

async function inlineEditRoom(pId, element) {
    if ($(element).find('select').length > 0) return;
    const p = db.participants.find(x => x.id === pId);
    if (!p) return;

    let options = '<option value="none">بدون غرفة</option>';
    db.rooms.forEach(r => {
        options += `<option value="${r.id}" ${r.id === p.roomId ? 'selected' : ''}>${escapeHTML(r.name)}</option>`;
    });

    const $select = $(`<select class="edit-select" style="font-size:0.8rem; padding:2px; width:100%;">${options}</select>`);
    $(element).html($select);
    $select.focus();

    $select.on('blur change', async function(e) {
        const newVal = $select.val();
        const finalRoomId = newVal === 'none' ? null : newVal;
        const oldRoomId = p.roomId;

        if (finalRoomId === oldRoomId && e.type === 'change') return;

        // Optimistic UI Update
        p.roomId = finalRoomId;
        p.room = finalRoomId ? finalRoomId.replace(/^r/, '') : '';
        const dispText = finalRoomId ? finalRoomId.replace(/^r/, 'غرفة ') : '—';
        $(element).html(dispText);
        showToast('تم تسكين الراكب بنجاح ✅', 'success');

        try {
            let res;
            if (finalRoomId) {
                res = await window.DataService.assignRoom(p.name, finalRoomId);
            } else {
                res = await window.DataService.unassignRoom(p.name);
            }
            if (res.status !== 'success') throw new Error(res.message);
        } catch(err) {
            p.roomId = oldRoomId;
            p.room = oldRoomId ? oldRoomId.replace(/^r/, '') : '';
            const oldText = oldRoomId ? oldRoomId.replace(/^r/, 'غرفة ') : '—';
            $(element).html(oldText);
            showToast('❌ فشل حفظ التسكين سحابياً', 'error');
        }
    });
}

async function inlineEditSeat(pId, element) {
    if ($(element).find('select').length > 0) return;
    openEdit(pId);
}

/* ========================================================
   آلية التحديث التلقائي وحساب الفوارق (Auto Refresh)
   ======================================================== */
let secondsCounter = 0;
let autoRefreshTimer = null;

function initAutoRefreshTimer() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    // عداد الوقت تصاعدياً
    setInterval(() => {
        secondsCounter++;
        const statusText = `متصل سحابياً ✅ • آخر تحديث: منذ ${secondsCounter} ثانية`;
        $('#saveStatus').text(statusText);
    }, 1000);

    // مزامنة صامتة في الخلفية كل 30 ثانية
    autoRefreshTimer = setInterval(async () => {
        if (!window.DataService) return;
        try {
            const fresh = await window.DataService.refresh();
            if (dataHasChanged(db, fresh)) {
                db = fresh;
                refreshAll();
                showToast('🔄 تم تحديث البيانات تلقائياً من Google Sheets', 'info');
            }
            secondsCounter = 0;
        } catch(e) {
            console.warn('AutoRefresh failed:', e);
        }
    }, 30000);
}

function dataHasChanged(oldDb, newDb) {
    if (!oldDb || !newDb) return true;
    if (!oldDb.participants || !newDb.participants) return true;
    if (oldDb.participants.length !== newDb.participants.length) return true;
    
    const oldSum = oldDb.participants.reduce((acc, p) => acc + (p.points || 0) + (p.roomId || '') + (p.busNumber || ''), '');
    const newSum = newDb.participants.reduce((acc, p) => acc + (p.points || 0) + (p.roomId || '') + (p.busNumber || ''), '');
    return oldSum !== newSum;
}

$(document).ready(function() {
    initAutoRefreshTimer();
});

async function refreshDataFromGAS() {
    showToast('جاري تحديث البيانات من Sheets...', 'info');
    try {
        db = await window.DataService.refresh();
        refreshAll();
        secondsCounter = 0;
        showToast('تم تحديث البيانات بنجاح ✅', 'success');
    } catch(err) {
        showToast('❌ فشل جلب البيانات الحية', 'error');
    }
}
