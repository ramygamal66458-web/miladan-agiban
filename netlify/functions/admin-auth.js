/**
 * admin-auth.js — Netlify Serverless Function
 * ─────────────────────────────────────────────────────────────────────────────
 * مصادقة لوحة الإدارة على جانب السيرفر (Server-Side Authentication)
 * بيانات الدخول مخزنة في Netlify Environment Variables فقط.
 *
 * يجب ضبط هذه المتغيرات في Netlify Dashboard → Site Settings → Environment Variables:
 *   ADMIN_USERNAME  = اسم مستخدم الأدمن
 *   ADMIN_PASSWORD  = كلمة مرور الأدمن
 *   ADMIN_SESSION_SECRET = مفتاح سري عشوائي (يمكن توليده بـ openssl rand -hex 32)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');

exports.handler = async (event) => {
    // فقط POST مسموح
    if (event.httpMethod !== 'POST') {
        return respond(405, { status: 'error', message: 'Method not allowed' });
    }

    // قراءة بيانات الدخول من البيئة
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
    const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
        return respond(503, {
            status: 'error',
            message: 'بيانات الأدمن غير مضبوطة في Netlify Environment Variables'
        });
    }

    // تحليل الطلب
    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return respond(400, { status: 'error', message: 'Invalid request body' });
    }

    const { username = '', password = '' } = body;

    // مقارنة آمنة باستخدام timingSafeEqual لمنع Timing Attacks
    const usernameMatch = safeCompare(username, ADMIN_USERNAME);
    const passwordMatch = safeCompare(password, ADMIN_PASSWORD);

    if (usernameMatch && passwordMatch) {
        // إنشاء Session Token موقّع
        const timestamp = Date.now();
        const payload   = `${username}:${timestamp}`;
        const signature = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(payload)
            .digest('hex');
        const token = Buffer.from(`${payload}:${signature}`).toString('base64');

        return respond(200, {
            status : 'success',
            token  : token,
            message: 'تم تسجيل الدخول بنجاح'
        });
    } else {
        // تأخير بسيط لمنع Brute Force
        await sleep(500);
        return respond(401, { status: 'error', message: 'بيانات الدخول غير صحيحة' });
    }
};

// ─── Verify Token Function (تُستخدم في admin-verify.js) ──────────────────────
// يمكن استيرادها إن أردت التحقق من الجلسة في Functions أخرى

/**
 * مقارنة آمنة ضد Timing Attacks
 */
function safeCompare(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(
            Buffer.from(a, 'utf8'),
            Buffer.from(b, 'utf8')
        );
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function respond(statusCode, data) {
    return {
        statusCode,
        headers: {
            'Content-Type'                : 'application/json',
            'Access-Control-Allow-Origin' : '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control'               : 'no-store, no-cache'
        },
        body: JSON.stringify(data)
    };
}
