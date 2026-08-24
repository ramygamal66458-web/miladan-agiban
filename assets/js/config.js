/**
 * ════════════════════════════════════════════════════════════
 *  config.js — إعدادات مؤتمر الشباب 2026
 *  ✅ آمن للرفع على GitHub
 *  🔒 يعمل على GitHub Pages و Netlify تلقائياً
 * ════════════════════════════════════════════════════════════
 *
 *  Netlify  → /_api/gas (Proxy مخفي) ← GAS_URL في Environment Variables
 *  GitHub Pages → DIRECT_GAS_URL للقراءة فقط؛ الكتابة الحساسة تتطلب Proxy
 *
 *  🔒 الأمان: GAS_TOKEN لا يُخزَّن هنا بعد الآن.
 *  على Netlify: يُحقَّن التوكن من السيرفر تلقائياً عبر gas-proxy.js
 *  على GitHub Pages: لا تُرسل أسرار من المتصفح؛ عمليات الكتابة الحساسة تعتمد على Proxy.
 */

window.YC_CONFIG = {
    // ── مسار الـ Proxy الآمن (Netlify فقط) ──
    GAS_URL: '/_api/gas',

    // ── الرابط المباشر لـ Google Apps Script (قراءة/توافق GitHub Pages) ──
    // لا يحتوي على أي Secret. الكتابة الحساسة في الإنتاج تمر عبر Vercel Proxy.
    DIRECT_GAS_URL: 'https://script.google.com/macros/s/AKfycbyJawD3RVxXF4sWio0oUPaaJHOJO3YW5ZSQdc3q634ENMYkhedYVAMSUW13B_cvCIMK/exec',

    // ── إصدار الإعدادات ──
    CONFIG_VERSION: '2026.08.22-profile-fix2'
};
