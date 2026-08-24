/* =====================================================
   accommodation.js — مؤتمر الشباب 2026
   ممر فندقي ثلاثي الأبعاد تفاعلي للغرف والأسرّة
   ===================================================== */
(function () {
    'use strict';

    const list = document.getElementById('rooms-list');
    let activeGender = 'all';

    /* ══════════════════════════════════════════════════
       0. الحصول على غرفة المستخدم الحالية من الهوية المقفلة
       ══════════════════════════════════════════════════ */
    function _getProfile() {
        try { return JSON.parse(localStorage.getItem('yc2_user_profile') || '{}'); }
        catch(e) { return {}; }
    }

    function getMyRoomName() {
        const profile = _getProfile();
        return (profile && profile.room) ? String(profile.room).trim() : null;
    }

    function isMyRoom(room) {
        const myRoom = getMyRoomName();
        if (!myRoom) return false;
        return YC.normalizeArabic(room.name) === YC.normalizeArabic(myRoom)
            || room.name === myRoom;
    }

    /* هل هوية المستخدم محدّدة بالاسم (sمن الأتوبيس أو الغرفة) */
    function hasLockedIdentity() {
        const profile = _getProfile();
        return !!(profile && profile.name && profile.name.trim());
    }

    /* هل له غرفة محدّدة بالإضافة للاسم */
    function hasLockedRoom() {
        const profile = _getProfile();
        return !!(profile && profile.name && profile.room);
    }

    /* ══════════════════════════════════════════════════
       1. كارت غرفتي السريعة (My Quick Room Access)
       ══════════════════════════════════════════════════ */
    function checkAndRenderMyQuickRoomCard() {
        const container = document.getElementById('my-quick-room-container');
        if (!container) return;

        try {
            const profile = _getProfile();
            // يكفي وجود الاسم فقط لعرض البطاقة
            if (!profile || !profile.name) {
                container.innerHTML = '';
                return;
            }

            const hasRoom  = !!(profile.room);
            const hasBus   = !!(profile.bus || profile.busNumber);
            const floorText = profile.floor === 1 ? 'الأول (بنات)' : (profile.floor === 2 ? 'الثاني (ولاد)' : 'الثالث (ولاد)');
            const bedText   = profile.bed ? ` • السرير رقم ${profile.bed}` : '';
            const busText   = hasBus
                ? `🚍 ${profile.bus || ('أتوبيس ' + profile.busNumber)}${profile.seat ? ' — مقعد ' + profile.seat : ''}`
                : '';

            container.innerHTML = `
                <div class="my-quick-room-card" style="position:relative;">
                    <div style="position:absolute;top:6px;left:8px;font-size:0.6rem;color:#64748b;opacity:0.8;">🔒 هويتك محفوظة</div>
                    <div class="my-quick-room-info">
                        <div class="my-quick-room-icon">
                            <i class="bi bi-person-fill-check"></i>
                        </div>
                        <div class="my-quick-room-text">
                            <div>أهلاً بك يا ${profile.name}! 🎯</div>
                            <div style="font-size:0.75rem; color:#cbd5e1; font-weight:700; margin-top:3px; display:flex; flex-direction:column; gap:2px;">
                                ${hasBus ? `<span style="color:#22d3ee;">${busText}</span>` : ''}
                                ${hasRoom
                                    ? `<span>غرفتك: <strong style="color:#fbbf24;">${profile.room}</strong> (الدور ${floorText})${bedText}</span>`
                                    : `<span style="color:#f59e0b;">⏳ الغرفة لم تُعيَّن بعد — تواصل مع المسؤول</span>`}
                            </div>
                        </div>
                    </div>
                    ${hasRoom ? `
                    <button class="btn-goto-my-room" id="btn-goto-my-room">
                        <i class="bi bi-geo-alt-fill me-1"></i> خذني لغرفتي
                    </button>` : ''}
                </div>
            `;

            document.getElementById('btn-goto-my-room')?.addEventListener('click', () => {
                const matchedRoom = (window.rooms || []).find(r => isMyRoom(r));
                if (matchedRoom) {
                    const blockEl = document.getElementById(`room-block-${matchedRoom.id}`);
                    if (blockEl) {
                        blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        const door = blockEl.querySelector('.room-door');
                        door?.classList.add('door-spotlight-glow');
                        setTimeout(() => {
                            door?.classList.remove('door-spotlight-glow');
                            openRoomModal(matchedRoom);
                        }, 600);
                    }
                }
            });
        } catch (e) {
            console.error('Error rendering quick room card:', e);
        }
    }


    /* ══════════════════════════════════════════════════

       2. بناء مكون الباب الخشبي الفندقي (3D Hotel Door)
       ══════════════════════════════════════════════════ */
    function buildDoorEl(room, sideClass) {
        const isBoysRoom = room.gender === 'boys';
        const color     = isBoysRoom ? '#38bdf8' : '#f87171';
        const genderTxt = isBoysRoom ? 'ولاد 🧒' : 'بنات 👧';
        const roomNum   = room.name.replace('غرفة ', '');
        const occupied  = room.persons.filter(Boolean).length;
        const pct       = Math.round((occupied / room.capacity) * 100);

        let statusClass = 'status-partial';
        let statusText  = room.note ? room.note : 'متاح';
        let barColor    = '#f59e0b';

        if (occupied === 0) {
            statusClass = 'status-empty';
            statusText  = 'هنا مكان';
            barColor    = '#22c55e';
        } else if (occupied === room.capacity) {
            statusClass = 'status-full';
            statusText  = 'مكتملة';
            barColor    = '#ef4444';
        }

        const doorWrapper = document.createElement('div');
        doorWrapper.className = `room-door-wrapper ${room.gender}`;
        doorWrapper.id = `room-block-${room.id}`;

        // ─── تحديد ما إذا كانت هذه غرفة المستخدم أو غرفة مقفلة ───
        const userHasIdentity = hasLockedIdentity();
        const isMine = isMyRoom(room);
        const isLocked = userHasIdentity && !isMine;

        const door = document.createElement('div');
        door.className = `room-door ${sideClass} ${statusClass} ${room.gender}${isLocked ? ' door-locked-private' : ''}${isMine ? ' door-my-room' : ''}`;
        
        if (isMine) {
            door.innerHTML = `
                <div class="door-my-room-badge">⭐ غرفتك</div>
                <div class="door-handle"></div>
                <div class="door-brass-plate">
                    <div class="door-number">${roomNum}</div>
                    <span class="door-status-text">${statusText}</span>
                </div>
                <div class="door-occupancy-info">
                    <div class="door-occ-counts">
                        <span style="color:${color}; font-size:0.6rem;">${genderTxt}</span>
                    </div>
                    <div class="door-occ-bar-bg">
                        <div class="door-occ-bar-fill" style="width:${pct}%; background:${barColor};"></div>
                    </div>
                </div>
                <div class="door-light-leak"></div>
            `;
            door.addEventListener('click', () => {
                door.classList.add('open');
                setTimeout(() => { openRoomModal(room); door.classList.remove('open'); }, 300);
            });
        } else if (isLocked) {
            // غرفة مقفلة — رقم الغرفة والقفل فقط
            door.innerHTML = `
                <div class="door-handle"></div>
                <div class="door-brass-plate">
                    <div class="door-number">${roomNum}</div>
                </div>
                <div class="door-private-lock-icon">🔒</div>
                <div class="door-light-leak"></div>
            `;
            door.addEventListener('click', () => {
                const modal = document.getElementById('privacyLockedModal');
                if (modal) new bootstrap.Modal(modal).show();
            });
        } else {
            // المستخدم لم يُحدد هويته بعد — عرض كامل طبيعي (مع الأرقام)
            door.innerHTML = `
                <div class="door-handle"></div>
                <div class="door-brass-plate">
                    <div class="door-number">${roomNum}</div>
                    <span class="door-status-text">${statusText}</span>
                </div>
                <div class="door-occupancy-info">
                    <div class="door-occ-counts">
                        <span><i class="bi bi-person-fill" style="color:${color};"></i> ${occupied}/${room.capacity}</span>
                        <span style="color:${color}; font-size:0.6rem;">${genderTxt}</span>
                    </div>
                    <div class="door-occ-bar-bg">
                        <div class="door-occ-bar-fill" style="width:${pct}%; background:${barColor};"></div>
                    </div>
                </div>
                <div class="door-light-leak"></div>
            `;
            door.addEventListener('click', () => {
                door.classList.add('open');
                setTimeout(() => { openRoomModal(room); door.classList.remove('open'); }, 300);
            });
        }

        doorWrapper.appendChild(door);
        return doorWrapper;
    }



    /* ══════════════════════════════════════════════════
       3. بناء ممر الأدوار (3D Hallway Scene)
       ══════════════════════════════════════════════════ */
    function buildHallwaySection(floorRooms, label, color) {
        const container = document.createElement('div');
        container.className = 'floor-hallway-container';

        // شارات العنوان
        const header = document.createElement('div');
        header.className = 'floor-title-badge';
        header.innerHTML = `
            <div class="line" style="background:${color};"></div>
            <div class="label" style="color:${color};">${label}</div>
            <div class="line" style="background:${color};"></div>
        `;
        container.appendChild(header);

        // مشهد الممر
        const scene = document.createElement('div');
        scene.className = 'hallway-scene';
        scene.innerHTML = `
            <div class="hallway-ceiling">
                <div class="ceiling-light"></div>
                <div class="ceiling-light"></div>
                <div class="ceiling-light"></div>
            </div>
            <div class="hallway-floor"></div>
            <div class="hallway-center-path"></div>
        `;

        // شبكة الممر المتوازية (أبواب يمين ويسار)
        const corridor = document.createElement('div');
        corridor.className = 'hallway-corridor';

        floorRooms.forEach((room, index) => {
            const sideClass = (index % 2 === 0) ? 'door-left' : 'door-right';
            const doorEl = buildDoorEl(room, sideClass);
            corridor.appendChild(doorEl);
        });

        scene.appendChild(corridor);
        container.appendChild(scene);
        return container;
    }

    /* ══════════════════════════════════════════════════
       4. رسم الكل — الممر الفندقي
       ══════════════════════════════════════════════════ */
    function renderAll(rooms) {
        if (!list) return;
        list.innerHTML = '';

        const filtered = rooms.filter(r =>
            activeGender === 'all' || r.gender === activeGender
        );

        if (!filtered.length) {
            list.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:#64748b;">
                <i class="bi bi-door-closed" style="font-size:2.8rem; display:block; margin-bottom:10px; color:#475569;"></i>
                <div style="font-size:0.95rem; font-weight:700;">لا توجد غرف مطابقة للبحث</div>
            </div>`;
            return;
        }

        // ─── إحصائيات سريعة في الأعلى ───
        const totalBeds   = filtered.reduce((s, r) => s + r.capacity, 0);
        const totalOccupied = filtered.reduce((s, r) => s + r.persons.filter(Boolean).length, 0);
        const totalFree   = totalBeds - totalOccupied;

        const statsEl = document.createElement('div');
        statsEl.className = 'accomm-stats-bar';
        statsEl.innerHTML = `
        <div class="stat-item">
            <i class="bi bi-door-closed-fill" style="color:#38bdf8;"></i>
            <span>${filtered.length} غرفة</span>
        </div>
        <div class="stat-item">
            <i class="bi bi-person-check-fill" style="color:#22c55e;"></i>
            <span>${totalOccupied} مشغول</span>
        </div>
        <div class="stat-item">
            <i class="bi bi-moon-stars-fill" style="color:#f59e0b;"></i>
            <span>${totalFree} شاغر</span>
        </div>`;
        list.appendChild(statsEl);

        // ─── الأدوار الثلاثة ───
        const floor1 = filtered.filter(r => r.floor === 1);
        if (floor1.length) {
            const sec = buildHallwaySection(floor1, '🚪 الدور الأول — ممر البنات 👧', '#f87171');
            list.appendChild(sec);
        }

        const floor2 = filtered.filter(r => r.floor === 2);
        const floor3 = filtered.filter(r => r.floor === 3);

        if (floor1.length && (floor2.length || floor3.length)) {
            const elevatorDivider = document.createElement('div');
            elevatorDivider.className = 'hotel-elevator-divider';
            elevatorDivider.innerHTML = `
                <span class="hotel-elevator-icon"><i class="bi bi-border-style"></i> 🛗</span>
                <span>مصعد الفندق والسلالم الرئيسية — الانتقال للدور الأعلى</span>
                <span class="hotel-elevator-icon">🪜</span>
            `;
            list.appendChild(elevatorDivider);
        }

        if (floor2.length) {
            const sec = buildHallwaySection(floor2, '🚪 الدور الثاني — ممر الولاد 🧒', '#38bdf8');
            list.appendChild(sec);
        }

        if (floor2.length && floor3.length) {
            const elevatorDivider = document.createElement('div');
            elevatorDivider.className = 'hotel-elevator-divider';
            elevatorDivider.innerHTML = `
                <span class="hotel-elevator-icon"><i class="bi bi-border-style"></i> 🛗</span>
                <span>مصعد الفندق والسلالم الرئيسية — الدور الثالث</span>
                <span class="hotel-elevator-icon">🪜</span>
            `;
            list.appendChild(elevatorDivider);
        }

        if (floor3.length) {
            const sec = buildHallwaySection(floor3, '🚪 الدور الثالث — ممر الولاد 🧒', '#38bdf8');
            list.appendChild(sec);
        }

        checkAndRenderMyQuickRoomCard();
    }

    /* ══════════════════════════════════════════════════
       5. مودال الغرفة المعماري داخل الغرفة (Architectural Room View)
       ══════════════════════════════════════════════════ */
    function openRoomModal(room) {
        // ─── حماية الخصوصية: المودال يفتح فقط لغرفة المستخدم — يشترط معرفة الغرفة ———
        if (hasLockedRoom() && !isMyRoom(room)) {
            const modal = document.getElementById('privacyLockedModal');
            if (modal) new bootstrap.Modal(modal).show();
            return;
        }

        const titleEl = document.getElementById('room-modal-title');
        const gridEl  = document.getElementById('room-modal-beds-grid');
        if (!titleEl || !gridEl) return;

        const isBoysRoom = room.gender === 'boys';
        const color      = isBoysRoom ? '#38bdf8' : '#f87171';
        const genderText = isBoysRoom ? 'ولاد 🧒' : 'بنات 👧';
        const floorText  = room.floor === 1 ? 'الأول' : (room.floor === 2 ? 'الثاني' : 'الثالث');
        const occupied   = room.persons.filter(Boolean).length;
        const pct        = Math.round((occupied / room.capacity) * 100);

        titleEl.innerHTML = `
            <div class="d-flex align-items-center justify-content-between w-100 pe-3">
                <div>
                    <span class="fs-5">${room.name}</span>
                    <span class="badge ms-2" style="background:${color}22; color:${color}; border:1px solid ${color}44; font-size:0.75rem;">
                        ${genderText} — الدور ${floorText}
                    </span>
                </div>
            </div>
        `;

        // بناء الأسرّة داخل المخطط المعماري
        const bedsCardsHtml = room.persons.map((personName, index) => {
            const bedNum = index + 1;
            const isFull = !!personName;
            const statusClass = isFull ? 'occupied' : 'empty';
            const icon = isFull ? (isBoysRoom ? 'bi-person-fill' : 'bi-person-fill-dress') : 'bi-moon-stars-fill';

            return `
            <div class="bed-3d-card ${room.gender} ${statusClass}" style="animation-delay: ${index * 70}ms;">
                <span class="bed-number-badge">سرير #${bedNum}</span>
                <div class="bed-pillow"></div>
                <div style="font-size:1.4rem; color:${isFull ? color : '#64748b'}; margin: 2px 0;">
                    <i class="bi ${icon}"></i>
                </div>
                <div class="bed-person-name-title">
                    ${isFull ? personName : 'شاغر 😴'}
                </div>
            </div>`;
        }).join('');

        gridEl.innerHTML = `
            <div class="text-center mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1 px-2">
                    <span class="fw-bold text-slate-300" style="font-size:0.85rem;">نسبة الإشغال</span>
                    <span class="fw-bold" style="color:${color};">${occupied} من ${room.capacity} أسرة</span>
                </div>
                <div class="progress" style="height: 6px; background: rgba(255,255,255,0.08); border-radius:99px;">
                    <div class="progress-bar" style="width: ${pct}%; background: ${color}; border-radius:99px; transition: width 0.6s ease;"></div>
                </div>
            </div>

            <div class="room-architectural-plan">
                <div class="plan-door-entrance">🚪 مدخل الغرفة</div>
                
                <div class="beds-architecture-grid">
                    ${bedsCardsHtml}
                </div>

                <div class="plan-window"></div>
            </div>
        `;

        // تشغيل أنيميشن ظهور الأسرّة Stagger Pop-in
        setTimeout(() => {
            document.querySelectorAll('.bed-3d-card').forEach(card => {
                card.classList.add('animate-pop');
            });
        }, 50);

        const modalEl = document.getElementById('roomDetailsModal');
        if (modalEl) {
            const myModal = new bootstrap.Modal(modalEl);
            myModal.show();
        }
    }

    /* ══════════════════════════════════════════════════
       6. فلتر + بحث
       ══════════════════════════════════════════════════ */
    function applyFilters(q, autoOpenModal = false) {
        const query = (YC.normalizeArabic(q || '')).trim();

        const filtered = (window.rooms || []).filter(room => {
            const genderOk = activeGender === 'all' || room.gender === activeGender;
            if (!genderOk) return false;
            if (!query) return true;
            const nameMatch   = YC.normalizeArabic(room.name).includes(query);
            const noteMatch   = YC.normalizeArabic(room.note || '').includes(query);
            const personMatch = (room.persons || []).some(p => p && YC.normalizeArabic(p).includes(query));
            return nameMatch || noteMatch || personMatch;
        });

        // تحديث التظليل مباشرةً
        if (!query) {
            document.querySelectorAll('.room-door-wrapper').forEach(el => {
                const door = el.querySelector('.room-door');
                door?.classList.remove('highlighted', 'dimmed', 'door-spotlight-glow');
                const g = el.classList.contains('boys') ? 'boys' : 'girls';
                el.style.display = (activeGender === 'all' || g === activeGender) ? '' : 'none';
            });
        } else {
            const matchedIds = new Set(filtered.map(r => r.id));
            document.querySelectorAll('.room-door-wrapper').forEach(el => {
                const roomId = el.id.replace('room-block-', '');
                const door = el.querySelector('.room-door');
                const g = el.classList.contains('boys') ? 'boys' : 'girls';
                const genderOk = activeGender === 'all' || g === activeGender;
                if (!genderOk) { el.style.display = 'none'; return; }
                el.style.display = '';
                if (matchedIds.has(roomId)) {
                    door?.classList.add('highlighted');
                    door?.classList.remove('dimmed');
                } else {
                    door?.classList.add('dimmed');
                    door?.classList.remove('highlighted');
                }
            });
        }

        // إظهار بادج البحث
        const wrap = document.getElementById('accomm-active-search-wrap');
        if (wrap) {
            if (q) {
                wrap.style.display = 'block';
                wrap.innerHTML = `
                <div style="display:inline-flex; align-items:center; gap:0.5rem; background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.3); color:#fbbf24; padding:0.35rem 0.8rem; border-radius:12px; font-size:0.78rem; font-weight:700;">
                    <span>البحث: "${q}"</span>
                    <i class="bi bi-x-circle-fill" id="clear-search-badge-btn" style="cursor:pointer; opacity:0.8;"></i>
                </div>`;
                document.getElementById('clear-search-badge-btn')?.addEventListener('click', () => {
                    const si = document.getElementById('accomm-search');
                    if (si) si.value = '';
                    wrap.style.display = 'none';
                    applyFilters('');
                });
            } else {
                wrap.style.display = 'none';
            }
        }

        // فتح المودال تلقائياً والتمرير بأسلوب Spotlight
        if (autoOpenModal && query && filtered.length > 0) {
            const matched = filtered[0];
            const blockEl = document.getElementById(`room-block-${matched.id}`);
            if (blockEl) {
                setTimeout(() => {
                    blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const door = blockEl.querySelector('.room-door');
                    door?.classList.add('door-spotlight-glow');
                    setTimeout(() => {
                        enrichIdentityWithRoom(matched);
                        openRoomModal(matched);
                        door?.classList.remove('door-spotlight-glow');
                    }, 400);
                }, 100);
            }
        }
    }

    /* ══════════════════════════════════════════════════
       7. الأحداث
       ══════════════════════════════════════════════════ */
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            activeGender = this.dataset.gender;
            renderAll(window.rooms || []);
            applyFilters(document.getElementById('accomm-search')?.value || '');
        });
    });

    const searchInput = document.getElementById('accomm-search');
    if (searchInput) {
        searchInput.addEventListener('input',   e => applyFilters(e.target.value));
        searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(e.target.value, true); });
    }

    /* ══════════════════════════════════════════════════
       8. Overlay البحث الأولي مع الاقتراحات الحية ورسالة "اسمك مش موجود"
       ══════════════════════════════════════════════════ */
    function initSearchOverlay() {
        const overlay       = document.getElementById('accomm-search-overlay');
        const popupInput    = document.getElementById('accomm-popup-search-input');
        const popupBtn      = document.getElementById('accomm-popup-search-btn');
        const closeBtn      = document.getElementById('accomm-popup-close-btn');
        const suggestionsEl = document.getElementById('accomm-search-suggestions');
        const noMatchEl     = document.getElementById('accomm-no-match-msg');
        const btnsWrap      = document.getElementById('accomm-search-btns-wrap');

        if (!overlay) return;

        // إذا كانت الهوية مقفلة بالفعل — لا نُظهر نافذة البحث مرة أخرى
        if (!sessionStorage.getItem('search_shown_accomm') && !hasLockedIdentity()) {
            overlay.style.display = 'flex';
            setTimeout(() => popupInput?.focus(), 500);
        } else if (hasLockedIdentity()) {
            // الهوية مقفلة — أغلق النافذة واخفِ شريط الفلاتر والبحث العام
            if (overlay) overlay.style.display = 'none';
            sessionStorage.setItem('search_shown_accomm', 'true');
            _applyPrivacyMode();
        }

        /* ── مساعد: تطبيق وضع الخصوصية (إخفاء كل شيء عدا غرفتي) ── */
        function _applyPrivacyMode() {
            const filterBar   = document.querySelector('.filter-bar');
            const searchWrap  = document.getElementById('accomm-active-search-wrap');
            const navSearchBtn = document.getElementById('accomm-nav-search-btn');
            if (filterBar)    filterBar.style.display   = 'none';
            if (searchWrap)   searchWrap.style.display  = 'none';
            if (navSearchBtn) navSearchBtn.style.display = 'none';
        }

        /* ══════════════════════════════════════════════
           محرك البحث الذكي — Smart Identity Search Engine
           ══════════════════════════════════════════════
           يدعم:
           • تصحيح الهمزات والتاء المربوطة (normalizeArabic)
           • البحث بأجزاء الاسم (كلمة كلمة)
           • ترتيب النتائج بالأذكى (تطابق كامل → بداية الاسم → جزء منه)
           • البحث برقم الأتوبيس أو المقعد ("أتوبيس 1"، "مقعد 5")
           • البحث في الغرف + قائمة المشتركين الكاملة
        ══════════════════════════════════════════════ */
        function smartScore(name, query) {
            const nName = YC.normalizeArabic(name);
            const nQ    = YC.normalizeArabic(query);
            if (!nName || !nQ) return 0;

            // تطابق كامل
            if (nName === nQ) return 100;
            // يبدأ بالاستعلام تماماً
            if (nName.startsWith(nQ)) return 85;
            // كل كلمات الاستعلام موجودة في الاسم (بأي ترتيب)
            const words = nQ.split(/\s+/).filter(Boolean);
            if (words.length > 1 && words.every(w => nName.includes(w))) return 75;
            // الاستعلام موجود كسلسلة متواصلة
            if (nName.includes(nQ)) return 60;
            // بعض كلمات الاستعلام موجودة
            const matchCount = words.filter(w => nName.includes(w)).length;
            if (matchCount > 0) return Math.round(40 * matchCount / words.length);
            return 0;
        }

        function searchAll(query) {
            if (!query || query.length < 2) return [];

            const nq    = YC.normalizeArabic(query.trim());
            const rawQ  = query.trim();
            const results = [];
            const seen  = new Set();

            /* ── مساعد: إضافة نتيجة بالدرجة ── */
            function addResult(item) {
                const key = item.type === 'room' ? `r:${item.room?.id}` : `p:${item.name}`;
                if (seen.has(key)) return;
                seen.add(key);
                results.push(item);
            }

            /* ══ 1. بحث في الغرف (persons[]) ══ */
            for (const room of window.rooms || []) {
                (room.persons || []).forEach((person, bIdx) => {
                    if (!person) return;
                    const score = smartScore(person, rawQ);
                    if (score > 0) {
                        addResult({
                            type: 'person', name: person,
                            room, bed: bIdx + 1,
                            source: 'room', score
                        });
                    }
                });
                // اسم الغرفة
                if (YC.normalizeArabic(room.name).includes(nq)) {
                    addResult({ type: 'room', name: room.name, room, source: 'room', score: 50 });
                }
            }

            /* ══ 2. بحث في قائمة المشتركين الكاملة ══ */
            const allParticipants = (window.conferenceData?.participants) ||
                                    (window.DataService?.cachedData?.participants) || [];

            for (const p of allParticipants) {
                if (!p.name) continue;

                // بحث برقم أتوبيس أو مقعد ("1" أو "أتوبيس 2" أو "مقعد 7")
                const busMatch  = p.busNumber  && (rawQ === String(p.busNumber) || nq.includes('اتوبيس') && String(p.busNumber) === rawQ.replace(/[^\d]/g, ''));
                const seatMatch = p.seatNumber && (rawQ === String(p.seatNumber) || nq.includes('مقعد') && String(p.seatNumber) === rawQ.replace(/[^\d]/g, ''));

                const nameScore = smartScore(p.name, rawQ);
                const score = nameScore > 0 ? nameScore : (busMatch || seatMatch ? 30 : 0);
                if (score === 0) continue;

                const key = `p:${p.name}`;
                if (seen.has(key)) {
                    // حدّث الدرجة للنتيجة الموجودة من الغرف إذا كانت أعلى
                    const existing = results.find(r => r.name === p.name);
                    if (existing && score > existing.score) existing.score = score;
                    continue;
                }
                seen.add(key);

                const matchedRoom = (window.rooms || []).find(r =>
                    (p.roomId && r.id === p.roomId) ||
                    (p.room && (r.name === p.room || r.name.includes(String(p.room))))
                );
                const busInfo = p.busNumber ? `🚍 أتوبيس ${p.busNumber}${p.seatNumber ? ' — مقعد ' + p.seatNumber : ''}` : null;

                if (matchedRoom) {
                    const bedIdx = matchedRoom.persons.findIndex(n => n === p.name);
                    addResult({
                        type: 'person', name: p.name,
                        room: matchedRoom,
                        bed: bedIdx >= 0 ? bedIdx + 1 : null,
                        source: 'participant', score, busInfo
                    });
                } else {
                    addResult({
                        type: 'unassigned', name: p.name,
                        room: null, source: 'bus', score, busInfo
                    });
                }
            }

            /* ══ 3. ترتيب بالدرجة (الأعلى أولاً) ثم تقليص ══ */
            results.sort((a, b) => (b.score || 0) - (a.score || 0));
            return results.slice(0, 7);
        }



        /* ── قفل الهوية وحفظها (يعمل من الأتوبيس ومن الغرفة) ── */
        function lockIdentity(name, room, bed, busInfo) {
            try {
                const profile = _getProfile();
                // لا تكتب فوق هوية محدّدة بالفعل (الاسم موجود)
                if (profile.name && profile.name.trim()) return;

                profile.name      = name;
                profile.lockedAt  = Date.now(); // طابع القفل

                // بيانات الغرفة (إذا وجدت)
                if (room) {
                    profile.room   = room.name;
                    profile.floor  = room.floor;
                    profile.gender = room.gender;
                    profile.bed    = bed || null;
                }
                // بيانات الأتوبيس (إذا وجدت)
                if (busInfo) profile.bus = busInfo;

                localStorage.setItem('yc2_user_profile', JSON.stringify(profile));
            } catch(e) {}
        }

        /* ── تحديث بيانات الغرفة لمن عرف نفسه عبر الأتوبيس وتم تعيين غرفته لاحقاً ── */
        function enrichIdentityWithRoom(room, bed) {
            try {
                const profile = _getProfile();
                if (!profile.name) return;
                if (profile.room) return; // لا تدهور
                profile.room   = room.name;
                profile.floor  = room.floor;
                profile.gender = room.gender;
                profile.bed    = bed || null;
                localStorage.setItem('yc2_user_profile', JSON.stringify(profile));
            } catch(e) {}
        }

        /* ── بعد اختيار نتيجة من البحث ── */
        function selectAndHighlightMatch(match) {
            if (match.type === 'unassigned') {
                // مشترك في الأتوبيس لكن لم تُحدَّد له غرفة بعد
                lockIdentity(match.name, null, null, match.busInfo);
                const searchBox  = document.getElementById('accomm-search-box');
                const successBox = document.getElementById('accomm-success-box');
                const welcomeTitle = document.getElementById('accomm-success-welcome');
                const welcomeDesc  = document.getElementById('accomm-success-desc');
                const showRoomBtn  = document.getElementById('accomm-success-show-btn');

                if (searchBox && successBox) {
                    searchBox.style.display  = 'none';
                    successBox.style.display = 'block';
                    if (welcomeTitle) welcomeTitle.textContent = `أهلاً بك يا ${match.name}! 🎉`;
                    if (welcomeDesc) welcomeDesc.innerHTML = `
                        ${match.busInfo ? `<strong style="color:#22d3ee;">🚍 ${match.busInfo}</strong><br>` : ''}
                        <span style="color:#fbbf24;">⏳ لم يتم تحديد غرفتك بعد</span><br>
                        <span style="font-size:0.82rem;color:#94a3b8;">تواصل مع المسؤول لتعيين غرفتك</span>
                    `;
                    if (showRoomBtn) {
                        showRoomBtn.textContent = 'عرض الغرف';
                        showRoomBtn.onclick = () => {
                            overlay.style.display = 'none';
                            sessionStorage.setItem('search_shown_accomm', 'true');
                        };
                    }
                }
                return;
            }

            if (match.type === 'person' && match.room) {
                // قفل جديد (أول مرة) أو تحديث بيانات الغرفة للمُعرَّف مسبقاً عبر الأتوبيس
                lockIdentity(match.name, match.room, match.bed, match.busInfo);
                enrichIdentityWithRoom(match.room, match.bed);
                sessionStorage.setItem('search_shown_accomm', 'true');


                const searchBox  = document.getElementById('accomm-search-box');
                const successBox = document.getElementById('accomm-success-box');
                const welcomeTitle = document.getElementById('accomm-success-welcome');
                const welcomeDesc  = document.getElementById('accomm-success-desc');
                const showRoomBtn  = document.getElementById('accomm-success-show-btn');

                if (searchBox && successBox) {
                    searchBox.style.display  = 'none';
                    successBox.style.display = 'block';
                    if (welcomeTitle) welcomeTitle.textContent = `أهلاً بك يا ${match.name}! 🎉`;
                    if (welcomeDesc) welcomeDesc.innerHTML = `
                        تم تسكينك في الدور ${match.room.floor === 1 ? 'الأول (ولاد)' : 'الثاني (بنات)'}<br>
                        غرفتك: <strong style="color:#fbbf24; font-size:1.4rem; display:block; margin-top:0.4rem;">${match.room.name}</strong>
                        ${match.bed ? `سريرك رقم: <strong style="color:#06b6d4;">${match.bed}</strong>` : ''}
                        ${match.busInfo ? `<br><span style="color:#22d3ee;font-size:0.85rem;">🚍 ${match.busInfo}</span>` : ''}
                    `;
                    if (showRoomBtn) showRoomBtn.onclick = () => {
                        overlay.style.display = 'none';
                        sessionStorage.setItem('search_shown_accomm', 'true');
                        _applyPrivacyMode();
                        applyFilters(match.name, true);
                    };
                }
            } else if (match.type === 'room') {
                overlay.style.display = 'none';
                sessionStorage.setItem('search_shown_accomm', 'true');
                applyFilters(match.room.name, true);
            }
        }

        /* ── الاقتراحات الحية ── */
        function renderLiveSuggestions() {
            if (!suggestionsEl || !popupInput) return;
            const val = popupInput.value.trim();
            if (noMatchEl) noMatchEl.style.display = 'none';
            if (btnsWrap)  btnsWrap.style.display  = 'flex';

            if (!val || val.length < 2) {
                suggestionsEl.innerHTML = '';
                suggestionsEl.classList.remove('show');
                return;
            }

            const results = searchAll(val);
            if (!results.length) {
                suggestionsEl.innerHTML = '';
                suggestionsEl.classList.remove('show');
                return;
            }

            /* ── تمييز الجزء المتطابق في الاسم ── */
            function highlightMatch(text, query) {
                if (!text || !query) return text;
                const nText  = YC.normalizeArabic(text);
                const nQuery = YC.normalizeArabic(query);
                const idx    = nText.indexOf(nQuery);
                if (idx === -1) return text;
                return text.slice(0, idx)
                    + `<mark style="background:rgba(251,191,36,0.3);color:#fbbf24;border-radius:3px;padding:0 2px;">${text.slice(idx, idx + query.length)}</mark>`
                    + text.slice(idx + query.length);
            }

            /* ── شارة درجة التطابق ── */
            function scoreBadge(score) {
                if (score >= 80) return `<span style="font-size:0.6rem;background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.4);border-radius:6px;padding:1px 5px;margin-right:4px;">✓ دقيق</span>`;
                if (score >= 60) return `<span style="font-size:0.6rem;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);border-radius:6px;padding:1px 5px;margin-right:4px;">~ قريب</span>`;
                return '';
            }

            suggestionsEl.innerHTML = results.map((m, idx) => {
                let icon, color, meta;
                if (m.type === 'person') {
                    icon  = m.room?.gender === 'boys' ? 'bi-person-fill' : 'bi-person-fill-dress';
                    color = m.room?.gender === 'boys' ? '#38bdf8' : '#f87171';
                    const roomPart = m.room ? `🚪 ${m.room.name}${m.bed ? ' — سرير #' + m.bed : ''}` : '';
                    const busPart  = m.busInfo ? m.busInfo : '';
                    meta = [roomPart, busPart].filter(Boolean).join(' &nbsp;|&nbsp; ') || 'غير مُسكَّن';
                } else if (m.type === 'unassigned') {
                    icon  = 'bi-bus-front-fill';
                    color = '#22d3ee';
                    meta  = (m.busInfo || 'في الأتوبيس') + ' — ⏳ غرفة لم تُحدَّد';
                } else {
                    icon  = 'bi-door-closed-fill';
                    color = '#a78bfa';
                    meta  = `الدور ${m.room?.floor === 1 ? 'الأول 🧒' : 'الثاني 👧'}`;
                }
                const highlighted = highlightMatch(m.name, val.trim());
                return `<div class="suggestion-item" data-idx="${idx}" style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex;align-items:center;gap:4px;">
                        <i class="bi ${icon}" style="color:${color};font-size:0.9rem;"></i>
                        ${scoreBadge(m.score || 0)}
                        <span style="font-weight:700;color:#f1f5f9;font-size:0.88rem;">${highlighted}</span>
                    </div>
                    <div style="font-size:0.72rem;color:#64748b;margin-top:2px;padding-right:20px;">${meta}</div>
                </div>`;
            }).join('');

            suggestionsEl.classList.add('show');

            suggestionsEl.querySelectorAll('.suggestion-item').forEach((item, idx) => {
                item.addEventListener('click', () => {
                    popupInput.value = results[idx].name;
                    suggestionsEl.innerHTML = '';
                    suggestionsEl.classList.remove('show');
                    selectAndHighlightMatch(results[idx]);
                });
            });
        }


        /* ── البحث المباشر بالتأكيد ── */
        function doSearch() {
            const val = (popupInput?.value || '').trim();
            if (!val) {
                overlay.style.display = 'none';
                sessionStorage.setItem('search_shown_accomm', 'true');
                return;
            }

            const results = searchAll(val);
            if (results.length > 0) {
                selectAndHighlightMatch(results[0]);
            } else {
                if (suggestionsEl) { suggestionsEl.innerHTML = ''; suggestionsEl.classList.remove('show'); }
                if (noMatchEl) {
                    noMatchEl.style.display = 'block';
                    noMatchEl.innerHTML = `
                        <div class="search-no-match-box">
                            <div style="font-size:2.2rem; margin-bottom:0.2rem;">😅</div>
                            <div style="font-size:1.05rem; font-weight:900; color:#fb7185;">اسمك مش موجود في قائمة التسكين</div>
                            <div style="font-size:0.78rem; color:#cbd5e1; margin-top:0.35rem; line-height:1.5;">
                                اتأكد من كتابة الاسم صح أو ابعت للمسؤول عشان يضيفك
                            </div>
                            <button class="btn-secondary-app mt-3" id="accomm-retry-btn" style="padding:0.45rem 1.1rem; font-size:0.82rem;">
                                <i class="bi bi-arrow-counterclockwise me-1"></i> جرّب اسم تاني
                            </button>
                        </div>
                    `;
                    document.getElementById('accomm-retry-btn')?.addEventListener('click', () => {
                        noMatchEl.style.display = 'none';
                        if (popupInput) { popupInput.value = ''; popupInput.focus(); }
                    });
                }
            }
        }

        popupInput?.addEventListener('input', renderLiveSuggestions);
        popupBtn?.addEventListener('click', doSearch);
        popupInput?.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
        closeBtn?.addEventListener('click', () => {
            overlay.style.display = 'none';
            sessionStorage.setItem('search_shown_accomm', 'true');
        });
    }

    /* ══════════════════════════════════════════════════

       9. تهيئة البيانات
       ══════════════════════════════════════════════════ */
    /* ══════════════════════════════════════════════════════════════
       ★ ربط الهوية التلقائي من الأتوبيسات إلى الغرف
       يُشغَّل بعد بناء window.rooms — يبحث عن المستخدم المُعرَّف بالاسم
       ويُحدِّث الهوية بالغرفة والسرير ثم يُمرّر إلى غرفته تلقائياً
    ══════════════════════════════════════════════════════════════ */
    function _autoEnrichFromRooms() {
        try {
            const profile = _getProfile();
            // يعمل فقط لمن لديه اسم بدون غرفة (مُعرَّف من الأتوبيسات)
            if (!profile.name || profile.room) return;

            const savedName = YC.normalizeArabic(profile.name.trim());

            let foundRoom = null;
            let foundBed  = null;

            for (const room of window.rooms || []) {
                const bedIdx = room.persons.findIndex(
                    p => p && YC.normalizeArabic(p) === savedName
                );
                if (bedIdx >= 0) {
                    foundRoom = room;
                    foundBed  = bedIdx + 1;
                    break;
                }
            }

            if (!foundRoom) return; // لم يُسكَّن بعد

            // ─── حدّث الهوية ───
            profile.room   = foundRoom.name;
            profile.floor  = foundRoom.floor;
            profile.gender = foundRoom.gender;
            profile.bed    = foundBed;
            try { localStorage.setItem('yc2_user_profile', JSON.stringify(profile)); } catch(e) {}

            // ─── أعِد رسم بطاقة "غرفتي" ───
            checkAndRenderMyQuickRoomCard();

            // ─── مرّر تلقائياً إلى الباب مع بريق ───
            setTimeout(() => {
                const blockEl = document.getElementById(`room-block-${foundRoom.id}`);
                if (!blockEl) return;
                blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const door = blockEl.querySelector('.room-door');
                if (door) {
                    door.classList.add('door-spotlight-glow');
                    setTimeout(() => door.classList.remove('door-spotlight-glow'), 2000);
                }
            }, 600);

        } catch(e) { console.warn('_autoEnrichFromRooms:', e); }
    }

    function buildRoomsFromData(data) {
        const participants = data.participants || [];
        window.rooms = (data.rooms || []).map(room => {
            // بيانات PDF المعتمدة هي المصدر الأساسي للغرف والأسماء.
            // نستخدم persons الموجودة في ملف المؤتمر إن وُجدت، ولا نستبدلها ببيانات GAS القديمة.
            if (Array.isArray(room.persons) && room.persons.length > 0) {
                return {
                    id: room.id,
                    name: room.name,
                    floor: room.floor,
                    capacity: Math.max(Number(room.capacity) || 0, room.persons.length),
                    gender: room.gender,
                    persons: room.persons.slice(),
                    note: room.note || ''
                };
            }

            const capacity = Math.max(Number(room.capacity) || 0, 1);
            const persons = Array(capacity).fill('');
            const roomDigits = room.id.match(/\d+/)?.[0] || '';

            const roomParticipants = participants.filter(p => {
                if (p.roomId === room.id) return true;
                if (p.room && roomDigits && String(p.room).includes(roomDigits)) return true;
                if (p.room && p.room === room.name) return true;
                return false;
            });

            roomParticipants.forEach(p => {
                const bNum = parseInt(p.bedNumber || p.bed);
                if (!isNaN(bNum) && bNum >= 1 && bNum <= capacity && !persons[bNum - 1]) {
                    persons[bNum - 1] = p.name;
                } else {
                    const freeIdx = persons.findIndex(n => !n);
                    if (freeIdx !== -1) persons[freeIdx] = p.name;
                }
            });

            return { id: room.id, name: room.name, floor: room.floor, capacity, gender: room.gender, persons, note: room.note || '' };
        });

        renderAll(window.rooms);

        /* ★ ربط تلقائي: لو المستخدم عُرِّف من الأتوبيسات (name بدون room)
           → ابحث عنه في window.rooms الآن وحدّث هويته تلقائياً */
        _autoEnrichFromRooms();

        initSearchOverlay();


        // إزالة حالة التحميل من نافذة البحث بمجرد وصول البيانات
        const searchBox = document.getElementById('accomm-search-box');
        const loadingIndicator = document.getElementById('accomm-loading-indicator');
        const popupInput = document.getElementById('accomm-popup-search-input');

        if (searchBox && loadingIndicator) {
            // إخفاء مؤشر التحميل وتفعيل خانة البحث
            loadingIndicator.style.display = 'none';
            searchBox.classList.remove('accomm-loading-active');

            // تركيز على الخانة تلقائياً إذا كانت النافذة مفتوحة
            const overlay = document.getElementById('accomm-search-overlay');
            if (overlay && overlay.style.display !== 'none') {
                setTimeout(() => {
                    if (popupInput) popupInput.focus();
                }, 150);
            }
        }
    }

    let _accommRetries = 0;
    const MAX_ACCOMM_RETRIES = 60; // 60 × 50ms = 3 ثوانٍ حد أقصى

    function initAccommodationData() {
        // التسكين الأساسي ثابت داخل accommodation-data.js، لذلك نعرضه فوراً
        // ولا ننتظر Google Sheets / GAS حتى تظهر خانة البحث.
        if (Array.isArray(window.rooms) && window.rooms.length) {
            const localRooms = window.rooms.map(room => ({
                id: room.id,
                name: room.name,
                floor: room.floor,
                capacity: room.capacity,
                gender: room.gender,
                persons: Array.isArray(room.persons) ? room.persons.slice() : []
            }));
            window.rooms = localRooms;
            renderAll(window.rooms);
            _autoEnrichFromRooms();
            initSearchOverlay();

            const searchBox = document.getElementById('accomm-search-box');
            const loadingIndicator = document.getElementById('accomm-loading-indicator');
            const popupInput = document.getElementById('accomm-popup-search-input');
            if (searchBox && loadingIndicator) {
                loadingIndicator.style.display = 'none';
                searchBox.classList.remove('accomm-loading-active');
                const overlay = document.getElementById('accomm-search-overlay');
                if (overlay && overlay.style.display !== 'none') {
                    setTimeout(() => popupInput?.focus(), 150);
                }
            }
            return;
        }

        if (window.DataService) {
            window.DataService.loadConference()
                .then(data => buildRoomsFromData(data))
                .catch(err => {
                    console.error('[accommodation] خطأ في تحميل البيانات:', err);
                    // إظهار رسالة خطأ واضحة للمستخدم بدلاً من الصمت
                    const list = document.getElementById('rooms-list');
                    if (list) {
                        list.innerHTML = `
                            <div style="text-align:center; padding: 3rem 1rem; color: #94a3b8;">
                                <div style="font-size:3rem; margin-bottom:1rem;">⚠️</div>
                                <div style="font-size:1.1rem; font-weight:700; color:#e2e8f0; margin-bottom:0.5rem;">تعذّر تحميل بيانات الغرف</div>
                                <div style="font-size:0.85rem; margin-bottom:1.5rem;">تأكد من الإنترنت وحاول مرة أخرى</div>
                                <button onclick="location.reload()" style="background:linear-gradient(135deg,#06b6d4,#0284c7);border:none;color:white;padding:0.6rem 1.5rem;border-radius:12px;font-size:0.9rem;cursor:pointer;font-weight:700;">
                                    🔄 إعادة المحاولة
                                </button>
                            </div>
                        `;
                    }
                });
        } else {
            _accommRetries++;
            if (_accommRetries >= MAX_ACCOMM_RETRIES) {
                console.error('[accommodation] DataService لم يُحمَّل بعد 3 ثوانٍ — إيقاف المحاولات');
                const list = document.getElementById('rooms-list');
                if (list) {
                    list.innerHTML = `
                        <div style="text-align:center; padding: 3rem 1rem; color: #94a3b8;">
                            <div style="font-size:3rem; margin-bottom:1rem;">⚠️</div>
                            <div style="font-size:1.1rem; font-weight:700; color:#e2e8f0; margin-bottom:0.5rem;">تعذّر تحميل خدمة البيانات</div>
                            <div style="font-size:0.85rem; margin-bottom:1.5rem;">حاول تحديث الصفحة</div>
                            <button onclick="location.reload()" style="background:linear-gradient(135deg,#06b6d4,#0284c7);border:none;color:white;padding:0.6rem 1.5rem;border-radius:12px;font-size:0.9rem;cursor:pointer;font-weight:700;">
                                🔄 تحديث
                            </button>
                        </div>
                    `;
                }
                return;
            }
            setTimeout(initAccommodationData, 50);
        }
    }

    window.addEventListener('yc_live_data_updated', e => { if (e.detail) buildRoomsFromData(e.detail); });

    /* ── إصلاح WAI-ARIA: إزالة focus قبل إغلاق أي modal لتجنّب خطأ aria-hidden ── */
    document.addEventListener('hide.bs.modal', function() {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }
    }, true); // capture phase — ينفذ قبل Bootstrap

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAccommodationData);
    } else {
        initAccommodationData();
    }
})();
