/* hymns.js — v5 | UX/UI Redesign — نظام ألوان + تنقل + swipe + clear */
(function () {
    'use strict';

    /* ══════════════════════════════════════
       State
       ══════════════════════════════════════ */
    var allConferenceHymns  = [];
    var currentList         = [];   // الألحان الحالية في المودال
    var currentIndex        = 0;    // موقع الترنيمة المفتوحة
    var currentModalFontSize = 1;
    var isLooping           = false;

    /* Audio refs */
    var audioEl, progressEl, currentEl, durationEl, playIconEl, audioPlayerWrap;

    /* ══════════════════════════════════════
       Audio Player
       ══════════════════════════════════════ */
    function initAudioPlayer() {
        audioEl         = document.getElementById('modal-audio');
        progressEl      = document.getElementById('audio-progress');
        currentEl       = document.getElementById('audio-current');
        durationEl      = document.getElementById('audio-duration');
        playIconEl      = document.getElementById('audio-play-icon');
        audioPlayerWrap = document.getElementById('modal-audio-player');

        document.getElementById('audio-play').addEventListener('click', function () {
            if (!audioEl.src) return;
            audioEl.paused ? audioEl.play() : audioEl.pause();
        });
        document.getElementById('audio-replay').addEventListener('click', function () {
            if (!audioEl.src) return;
            audioEl.currentTime = 0; audioEl.play();
        });
        document.getElementById('audio-back15').addEventListener('click', function () {
            if (!audioEl.src) return;
            audioEl.currentTime = Math.max(0, audioEl.currentTime - 15);
        });
        document.getElementById('audio-fwd15').addEventListener('click', function () {
            if (!audioEl.src) return;
            audioEl.currentTime = Math.min(audioEl.duration || 0, audioEl.currentTime + 15);
        });
        document.getElementById('audio-loop').addEventListener('click', function () {
            isLooping = !isLooping;
            audioEl.loop = isLooping;
            this.classList.toggle('looping', isLooping);
        });
        progressEl.addEventListener('input', function () {
            if (!audioEl.duration) return;
            audioEl.currentTime = (progressEl.value / 100) * audioEl.duration;
        });
        audioEl.addEventListener('timeupdate', function () {
            if (!audioEl.duration) return;
            progressEl.value = (audioEl.currentTime / audioEl.duration) * 100;
            currentEl.textContent = fmtTime(audioEl.currentTime);
        });
        audioEl.addEventListener('loadedmetadata', function () {
            durationEl.textContent = fmtTime(audioEl.duration);
        });
        audioEl.addEventListener('play',  function () { playIconEl.className = 'bi bi-pause-fill'; });
        audioEl.addEventListener('pause', function () { playIconEl.className = 'bi bi-play-fill'; });
        audioEl.addEventListener('ended', function () {
            playIconEl.className = 'bi bi-play-fill';
            progressEl.value = 0; currentEl.textContent = '0:00';
        });
    }

    function fmtTime(sec) {
        if (isNaN(sec)) return '0:00';
        var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function resetAudio() {
        if (!audioEl) return;
        audioEl.pause(); audioEl.src = '';
        progressEl.value = 0; currentEl.textContent = '0:00';
        durationEl.textContent = '0:00'; playIconEl.className = 'bi bi-play-fill';
    }

    /* ══════════════════════════════════════
       بناء بطاقة ترنيمة
       ══════════════════════════════════════ */
    function buildHymnCard(hymn, isPrayer, indexInList) {
        var card = document.createElement('div');
        var typeClass = 'type-conference';
        card.className = 'hymn-card ' + typeClass;
        card.id = 'hymn-' + hymn.id;
        card.dataset.title  = hymn.title  || '';
        card.dataset.lyrics = hymn.lyrics || '';
        card.style.animationDelay = (indexInList * 0.04) + 's';

        var isFav    = YC.FavoritesManager.isFavorite(hymn.id);
        var numLabel = '';

        var numHtml = numLabel
            ? '<div class="hymn-num">' + numLabel + '</div>'
            : '<div class="hymn-icon"><i class="bi bi-music-note-beamed"></i></div>';

        var audioIndicator = hymn.audio
            ? '<div class="hymn-has-audio"><i class="bi bi-soundwave"></i> صوت</div>'
            : '';

        /* مقتطف أول سطر من الكلمات */
        var previewLine = '';
        if (hymn.lyrics) {
            var firstLine = hymn.lyrics.split('\n').find(function(l) { return l.trim().length > 2; });
            if (firstLine) previewLine = '<div class="hymn-preview">' + escHtml(firstLine.trim().substring(0, 50)) + '</div>';
        }

        card.innerHTML =
            numHtml +
            '<div class="hymn-card-info">' +
                '<div class="hymn-title">' + escHtml(hymn.title) + '</div>' +
                previewLine +
                audioIndicator +
            '</div>' +
            '<div class="hymn-card-actions">' +
                '<button class="hymn-fav-btn ' + (isFav ? 'active' : '') +
                    '" data-id="' + hymn.id + '" aria-label="أضف للمفضلة">' +
                    '<i class="bi bi-heart' + (isFav ? '-fill' : '') + '"></i>' +
                '</button>' +
                '<div class="hymn-arrow"><i class="bi bi-chevron-left"></i></div>' +
            '</div>';

        card.querySelector('.hymn-fav-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            var id = this.dataset.id;
            var nowFav = YC.FavoritesManager.toggle(id);
            this.classList.toggle('active', nowFav);
            this.querySelector('i').className = 'bi bi-heart' + (nowFav ? '-fill' : '');
            updateFavBadge();
            renderFavorites();
        });

        card.addEventListener('click', function (e) {
            if (e.target.closest('.hymn-fav-btn')) return;
            var list = allConferenceHymns;
            openHymnModal(hymn, list, list.indexOf(hymn));
        });

        return card;
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function toArabicNumerals(n) {
        return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'[d]; });
    }

    /* ══════════════════════════════════════
       المودال — فتح / إغلاق / تنقل
       ══════════════════════════════════════ */
    function openHymnModal(hymn, list, idx) {
        currentList  = list || [];
        currentIndex = (idx !== undefined) ? idx : 0;

        renderModal(hymn);

        document.getElementById('hymn-modal').classList.add('open');
        document.body.style.overflow = 'hidden';
        document.getElementById('modal-body').scrollTop = 0;
    }

    function renderModal(hymn) {
        var isConf = !!hymn.audio;

        /* العنوان */
        document.getElementById('modal-hymn-title').textContent = hymn.title || '';

        /* نقاط التقدم */
        buildProgressDots(isConf);

        /* الكلمات */
        document.getElementById('modal-hymn-lyrics').textContent = hymn.lyrics || '';

        /* حجم الخط */
        document.getElementById('modal-hymn-lyrics').style.fontSize = currentModalFontSize + 'rem';

        /* الصورة */
        var imgWrap = document.getElementById('modal-img-wrap');
        var imgEl   = document.getElementById('modal-hymn-img');
        if (hymn.img) {
            imgEl.src = hymn.img; imgWrap.classList.add('has-img');
        } else {
            imgEl.src = ''; imgWrap.classList.remove('has-img');
        }

        /* الصوت */
        resetAudio();
        if (hymn.audio) {
            audioEl.src = encodeURI(hymn.audio);
            audioEl.load();
            audioPlayerWrap.classList.add('has-audio');
        } else {
            audioPlayerWrap.classList.remove('has-audio');
        }

        /* أزرار التنقل */
        var prevBtn = document.getElementById('modal-prev');
        var nextBtn = document.getElementById('modal-next');
        prevBtn.disabled = (currentIndex <= 0);
        nextBtn.disabled = (currentIndex >= currentList.length - 1);
        prevBtn.style.opacity = prevBtn.disabled ? '.3' : '';
        nextBtn.style.opacity = nextBtn.disabled ? '.3' : '';

        /* البطاقة السفلية */
        var confCard = document.getElementById('modal-conference-card');
        if (confCard) confCard.classList.toggle('visible', isConf);
    }

    function buildProgressDots(isConf) {
        var container = document.getElementById('modal-dots');
        container.innerHTML = '';
        if (!currentList || currentList.length <= 1) return;
        var max = Math.min(currentList.length, 10);
        for (var i = 0; i < max; i++) {
            var dot = document.createElement('div');
            dot.className = 'modal-dot' + (i === currentIndex ? (' active' + (isConf ? ' conf' : '')) : '');
            container.appendChild(dot);
        }
    }

    function navModal(direction) {
        var newIdx = currentIndex + direction;
        if (newIdx < 0 || newIdx >= currentList.length) return;
        currentIndex = newIdx;
        var hymn = currentList[currentIndex];
        renderModal(hymn);
        document.getElementById('modal-body').scrollTop = 0;
    }

    function closeHymnModal() {
        resetAudio();
        document.getElementById('hymn-modal').classList.remove('open');
        document.body.style.overflow = '';
    }

    /* أحداث المودال */
    document.getElementById('modal-close').addEventListener('click', closeHymnModal);
    document.getElementById('modal-prev').addEventListener('click', function () { navModal(-1); });
    document.getElementById('modal-next').addEventListener('click', function () { navModal(1); });

    /* مفاتيح لوحة المفاتيح */
    document.addEventListener('keydown', function (e) {
        if (!document.getElementById('hymn-modal').classList.contains('open')) return;
        if (e.key === 'Escape') closeHymnModal();
        if (e.key === 'ArrowRight') navModal(-1);
        if (e.key === 'ArrowLeft')  navModal(1);
    });

    /* Swipe down to close (touch) */
    (function () {
        var modal = document.getElementById('hymn-modal');
        var startY = 0, isDragging = false;

        modal.addEventListener('touchstart', function (e) {
            /* فقط إذا كان في أعلى المحتوى */
            var body = document.getElementById('modal-body');
            if (body && body.scrollTop > 10) return;
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });

        modal.addEventListener('touchmove', function (e) {
            if (!isDragging) return;
            var dy = e.touches[0].clientY - startY;
            if (dy > 0) {
                modal.style.transform = 'translateY(' + dy + 'px)';
                modal.style.transition = 'none';
            }
        }, { passive: true });

        modal.addEventListener('touchend', function (e) {
            if (!isDragging) return;
            isDragging = false;
            var dy = e.changedTouches[0].clientY - startY;
            modal.style.transition = '';
            if (dy > 120) {
                closeHymnModal();
            }
            modal.style.transform = '';
        });
    })();

    /* ضوابط حجم الخط داخل المودال */
    document.getElementById('modal-font-inc').addEventListener('click', function () {
        currentModalFontSize = Math.min(currentModalFontSize + 0.12, 2.2);
        document.getElementById('modal-hymn-lyrics').style.fontSize = currentModalFontSize + 'rem';
    });
    document.getElementById('modal-font-dec').addEventListener('click', function () {
        currentModalFontSize = Math.max(currentModalFontSize - 0.12, 0.72);
        document.getElementById('modal-hymn-lyrics').style.fontSize = currentModalFontSize + 'rem';
    });

    /* ══════════════════════════════════════
       رسم القوائم
       ══════════════════════════════════════ */
    function renderList(panelId, hymns, isPrayer) {
        var panel = document.getElementById(panelId);
        if (!panel) return;
        var noRes = panel.querySelector('.no-results');
        panel.innerHTML = '';
        if (noRes) panel.appendChild(noRes);

        if (!hymns || hymns.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<i class="bi bi-music-note"></i><p>لا توجد ألحان بعد</p>';
            panel.appendChild(empty);
            return;
        }
        /* DocumentFragment — نبني كل البطاقات خارج DOM ثم ندرجها دفعة واحدة */
        var frag = document.createDocumentFragment();
        hymns.forEach(function (h, i) {
            frag.appendChild(buildHymnCard(h, isPrayer, i));
        });
        panel.appendChild(frag);
    }

    /* ══════════════════════════════════════
       المفضلة
       ══════════════════════════════════════ */
    function renderFavorites() {
        var favIds  = YC.FavoritesManager.getAll();
        var panel   = document.getElementById('panel-favorites-list');
        if (!panel) return;
        panel.innerHTML = '';
        var allHymns  = allConferenceHymns;
        var favHymns  = allHymns.filter(function (h) { return favIds.indexOf(h.id) > -1; });
        updateFavBadge();
        if (favHymns.length === 0) {
            panel.innerHTML = '<div class="empty-state"><i class="bi bi-heart"></i>' +
                '<p>لم تضف أي ترنيمة للمفضلة بعد<br><small style="opacity:.6">اضغط ❤️ على أي ترنيمة لإضافتها</small></p></div>';
            return;
        }
        /* DocumentFragment — لتجنب Reflow متكرر عند عرض المفضلة */
        var frag = document.createDocumentFragment();
        favHymns.forEach(function (h, i) {
            var isPrayer = false;
            frag.appendChild(buildHymnCard(h, isPrayer, i));
        });
        panel.appendChild(frag);
    }

    function updateFavBadge() {
        var count = YC.FavoritesManager.getAll().length;
        var badge = document.getElementById('badge-favorites');
        if (badge) badge.textContent = toArabicNumerals(count);
        /* تحديث النص في كرت المفضلة في صفحة الوصول */
        var favSub = document.getElementById('home-fav-sub');
        if (favSub) {
            favSub.textContent = count > 0
                ? toArabicNumerals(count) + ' ترنيمة في المفضلة'
                : 'لا توجد ألحان مفضلة بعد';
        }
        /* تحديث section المفضلة إذا كانت مفتوحة */
        if (typeof updateTopbar === 'function' && typeof currentSection !== 'undefined' && currentSection === 'favorites') {
            updateTopbar('favorites');
        }
    }

    /* ══════════════════════════════════════
       البحث مع زر Clear
       ══════════════════════════════════════ */
    var searchTimer = null;
    function initSearch() { /* البحث يتم من خلال البحث العالمي أعلى الصفحة */ }

    /* ══════════════════════════════════════
       التابات (للتوافق الداخلي)
       ══════════════════════════════════════ */
    function initTabs() {
        document.querySelectorAll('.hymn-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                document.querySelectorAll('.hymn-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
            });
        });
    }

    /* ══════════════════════════════════════
       صفحة الوصول — Home Navigation
       ══════════════════════════════════════ */
    var currentSection = null; /* 'conference' | 'favorites' */

    function showHome() {
        var home = document.getElementById('hymns-home');
        var listView = document.getElementById('hymns-list-view');
        if (home) home.classList.remove('hidden');
        if (listView) listView.classList.remove('active');
        currentSection = null;
        document.body.style.overflow = '';

        /* إغلاق نتائج البحث إن كانت مفتوحة */
        var searchResults = document.getElementById('global-search-results');
        if (searchResults) { searchResults.classList.remove('open'); searchResults.innerHTML = ''; }

        /* scroll للأعلى */
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function showSection(section) {
        var home = document.getElementById('hymns-home');
        var listView = document.getElementById('hymns-list-view');
        if (home) home.classList.add('hidden');
        if (listView) listView.classList.add('active');
        currentSection = section;

        /* إخفاء كل sections */
        ['conference','favorites'].forEach(function(s) {
            var el = document.getElementById('list-' + s);
            if (el) el.style.display = 'none';
        });

        /* إظهار section المطلوب */
        var target = document.getElementById('list-' + section);
        if (target) target.style.display = '';

        /* تحديث شريط الرجوع */
        updateTopbar(section);

        /* scroll to top */
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    function updateTopbar(section) {
        var topbar  = document.getElementById('list-topbar');
        var title   = document.getElementById('list-topbar-title');
        var badge   = document.getElementById('list-topbar-badge');
        var countEl = document.getElementById('list-topbar-count');
        if (!topbar) return;

        topbar.className = 'list-topbar';

        if (section === 'conference') {
            topbar.classList.add('conference-topbar');
            if (title) title.textContent = '🎵 الألحان';
            if (badge) { badge.innerHTML = '<i class="bi bi-soundwave"></i> <span id="list-topbar-count">' + toArabicNumerals(allConferenceHymns.length) + '</span>'; }
        } else if (section === 'favorites') {
            topbar.classList.add('favorites-topbar');
            if (title) title.textContent = '⭐ مفضلتي';
            var favCount = YC.FavoritesManager.getAll().length;
            if (badge) { badge.innerHTML = '<i class="bi bi-heart-fill"></i> <span id="list-topbar-count">' + toArabicNumerals(favCount) + '</span>'; }
        }
    }

    function initHymnsHome() {
        /* كرت المؤتمر */
        var cCard = document.getElementById('home-conference-card');
        if (cCard) {
            cCard.addEventListener('click', function () { showSection('conference'); });
            cCard.addEventListener('keydown', function(e) { if (e.key==='Enter'||e.key===' ') showSection('conference'); });
        }

        /* كرت المفضلة */
        var fCard = document.getElementById('home-fav-card');
        if (fCard) {
            fCard.addEventListener('click', function () { showSection('favorites'); });
            fCard.addEventListener('keydown', function(e) { if (e.key==='Enter'||e.key===' ') showSection('favorites'); });
        }

        /* زر الرجوع */
        var backBtn = document.getElementById('list-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function () { showHome(); });
        }

        /* URL param — فتح section مباشرة */
        var tabParam = new URLSearchParams(window.location.search).get('tab');
        if (tabParam === 'conference' || tabParam === 'favorites') {
            showSection(tabParam);
        }
    }

    /* ══════════════════════════════════════
       البحث العالمي — Global Search
       ══════════════════════════════════════ */
    function initGlobalSearch() {
        var input    = document.getElementById('global-search-input');
        var results  = document.getElementById('global-search-results');
        var clearBtn = document.getElementById('global-search-clear');
        if (!input || !results) return;

        var searchTimer = null;
        var focusedIdx  = -1;

        function highlightMatch(text, q) {
            if (!q) return escHtml(text);
            var idx = text.toLowerCase().indexOf(q.toLowerCase());
            if (idx === -1) return escHtml(text);
            return escHtml(text.slice(0, idx)) +
                   '<mark>' + escHtml(text.slice(idx, idx + q.length)) + '</mark>' +
                   escHtml(text.slice(idx + q.length));
        }

        function doSearch() {
            var q = input.value.trim();
            clearBtn.classList.toggle('visible', q.length > 0);
            if (q.length < 1) { closeResults(); return; }

            var qLow = q.toLowerCase();
            var matched = [];

            allConferenceHymns.forEach(function(h) {
                if ((h.title || '').toLowerCase().includes(qLow))
                    matched.push({ hymn: h, isPrayer: false });
            });

            focusedIdx = -1;
            results.innerHTML = '';

            if (matched.length === 0) {
                results.innerHTML = '<div class="search-no-results"><i class="bi bi-search"></i>لا توجد نتائج لـ "' + escHtml(q) + '"</div>';
                results.classList.add('open');
                return;
            }

            var frag = document.createDocumentFragment();
            matched.forEach(function(m, i) {
                var item = document.createElement('div');
                item.className = 'search-result-item' + (m.isPrayer ? '' : ' conf-result');
                item.setAttribute('role', 'option');
                item.dataset.idx = i;

                var numLabel = '♪';
                var iconClass = 'conf-icon';
                var sectionName = 'الألحان';
                var audioTag = m.hymn.audio
                    ? '<span class="search-result-audio"><i class="bi bi-soundwave"></i>صوت</span>'
                    : '';

                item.innerHTML =
                    '<div class="search-result-icon ' + iconClass + '">' + numLabel + '</div>' +
                    '<div class="search-result-info">' +
                        '<div class="search-result-title">' + highlightMatch(m.hymn.title, q) + '</div>' +
                        '<div class="search-result-section">' + sectionName + ' ' + audioTag + '</div>' +
                    '</div>' +
                    '<div class="search-result-arrow"><i class="bi bi-chevron-left"></i></div>';

                item.addEventListener('click', function() {
                    openFromSearch(m.hymn, false);
                });
                frag.appendChild(item);
            });
            results.appendChild(frag);
            results.classList.add('open');
        }

        function openFromSearch(hymn, isPrayer) {
            /* أغلق البحث */
            closeResults();
            input.value = '';
            clearBtn.classList.remove('visible');
            /* افتح الترنيمة في المودال مباشرة */
            var list = allConferenceHymns;
            var idx  = list.indexOf(hymn);
            openHymnModal(hymn, list, idx >= 0 ? idx : 0);
        }

        function closeResults() {
            results.classList.remove('open');
            results.innerHTML = '';
            focusedIdx = -1;
        }

        /* التنقل بالكيبورد */
        input.addEventListener('keydown', function(e) {
            var items = results.querySelectorAll('.search-result-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                focusedIdx = Math.min(focusedIdx + 1, items.length - 1);
                items.forEach(function(it, i) { it.classList.toggle('focused', i === focusedIdx); });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIdx = Math.max(focusedIdx - 1, 0);
                items.forEach(function(it, i) { it.classList.toggle('focused', i === focusedIdx); });
            } else if (e.key === 'Enter' && focusedIdx >= 0 && items[focusedIdx]) {
                items[focusedIdx].click();
            } else if (e.key === 'Escape') {
                closeResults();
                input.blur();
            }
        });

        input.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(doSearch, 180);
        });

        clearBtn.addEventListener('click', function() {
            input.value = '';
            clearBtn.classList.remove('visible');
            closeResults();
            input.focus();
        });

        /* إغلاق عند الضغط خارج */
        document.addEventListener('click', function(e) {
            var wrap = document.getElementById('global-search-wrap');
            if (wrap && !wrap.contains(e.target)) closeResults();
        });
    }

    /* ══════════════════════════════════════
       تحديث الأرقام في صفحة الوصول
       ══════════════════════════════════════ */
    function updateHomeCounts() {
        var cCount = document.getElementById('home-conf-count');
        var favSub = document.getElementById('home-fav-sub');
        if (cCount) cCount.textContent = toArabicNumerals(allConferenceHymns.length);
        var favLen = YC.FavoritesManager.getAll().length;
        if (favSub) {
            favSub.textContent = favLen > 0
                ? toArabicNumerals(favLen) + ' لحن في المفضلة'
                : 'لا توجد ألحان مفضلة بعد';
        }
    }

    /* ══════════════════════════════════════
       تحميل البيانات والعرض
       ══════════════════════════════════════ */
    function loadAndRender() {
        allConferenceHymns = (typeof conferenceHymns !== 'undefined' ? conferenceHymns : []);
        renderList('panel-conference-list', allConferenceHymns, false);
        var cBadge = document.getElementById('badge-conference');
        var cCountEl = document.getElementById('conference-hymns-count');
        if (cBadge) cBadge.textContent = toArabicNumerals(allConferenceHymns.length);
        if (cCountEl) cCountEl.textContent = toArabicNumerals(allConferenceHymns.length);
        updateHomeCounts();
        initSearch();
        renderFavorites();
        initHymnsHome();
        initGlobalSearch();
    }

    /* ══════════════════════════════════════
       Bootstrap
       ══════════════════════════════════════ */
    initAudioPlayer();

    /* ══════════════════════════════════════
       تهيئة عناصر الصفحة (نُقلت من inline script في HTML)
       ══════════════════════════════════════ */
    function initPageControls() {
        /* حجم الخط وضع القراءة */
        if (window.YC) {
            if (YC.FontSizeControl) YC.FontSizeControl.init();
            if (YC.ReadingModeToggle) YC.ReadingModeToggle.init();
        }
        var fontDec = document.getElementById('font-dec');
        var fontInc = document.getElementById('font-inc');
        var readingToggle = document.getElementById('reading-toggle');
        if (fontDec && window.YC && YC.FontSizeControl)
            fontDec.addEventListener('click', function () { YC.FontSizeControl.decrease(); });
        if (fontInc && window.YC && YC.FontSizeControl)
            fontInc.addEventListener('click', function () { YC.FontSizeControl.increase(); });
        if (readingToggle && window.YC && YC.ReadingModeToggle)
            readingToggle.addEventListener('click', function () { YC.ReadingModeToggle.toggle(); });



        /* partials */
        if (window.YC && YC.loadPartials) YC.loadPartials();
    }
    initPageControls();

    if (typeof DataService !== 'undefined' && DataService.loadStructure) {
        DataService.loadStructure().then(function (data) {
            var h = (data && data.hymns) || {};
            if (h.conference && h.conference.length) allConferenceHymns = h.conference;
            renderList('panel-conference-list', allConferenceHymns, false);
            updateHomeCounts();
            initSearch();
            renderFavorites();
            initHymnsHome();
            initGlobalSearch();
        }).catch(function () { loadAndRender(); });
    } else {
        loadAndRender();
    }

})();
