/* ═══════════════════════════════════════════════
   bg-3d.js — حاقن الخلفية المحيطية الخفيفة
   بدون GSAP، بدون scroll listener، بدون mousemove
   مؤتمر خلطبيطة بالصلصة 2026
   ═══════════════════════════════════════════════ */

(function () {
    'use strict';

    const prefix = location.pathname.includes('/pages/') ? '../' : '';
    const cssPath = prefix + 'assets/css/bg-3d.css?v=4.0';

    /* ── 1. تحميل ملف التنسيق ── */
    if (!document.querySelector('link[href*="bg-3d.css"]')) {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = cssPath;
        document.head.appendChild(link);
    }

    /* ── 2. إنشاء عناصر الخلفية بعد DOMContentLoaded ── */
    function injectBackground() {
        if (document.getElementById('gsap-3d-bg-container')) return;

        const container = document.createElement('div');
        container.id        = 'gsap-3d-bg-container';
        container.className = 'gsap-3d-bg-container';
        container.setAttribute('aria-hidden', 'true');

        /* الهالات الثلاث + حقل النجوم + الخط العلوي */
        container.innerHTML = `
            <div class="gsap-3d-bg">
                <div class="bg-3d-orb bg-3d-orb-cyan"></div>
                <div class="bg-3d-orb bg-3d-orb-pink"></div>
                <div class="bg-3d-orb bg-3d-orb-purple"></div>
                <div class="bg-3d-stars"></div>
                <div class="bg-3d-topline"></div>
            </div>
        `;

        /* إدراج كأول عنصر في الـ body */
        document.body.insertBefore(container, document.body.firstChild);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectBackground);
    } else {
        injectBackground();
    }

})();
