/**
 * api/admin-auth.js — Vercel Serverless Function
 * ─────────────────────────────────────────────────────────────────────────────
 * مصادقة لوحة الإدارة على جانب السيرفر (Server-Side Authentication)
 * يستخدم HMAC-SHA256 لإنشاء Session Token آمن
 *
 * ضبط هذه المتغيرات في Vercel Dashboard → Project Settings → Environment Variables:
 *   ADMIN_USERNAME       = اسم مستخدم الأدمن
 *   ADMIN_PASSWORD       = كلمة مرور الأدمن
 *   ADMIN_SESSION_SECRET = مفتاح سري عشوائي (openssl rand -hex 32)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control',                'no-store, no-cache');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }

    const ADMIN_USERNAME  = process.env.ADMIN_USERNAME;
    const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD;
    const SESSION_SECRET  = process.env.ADMIN_SESSION_SECRET;
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_SECRET) {
        return res.status(503).json({status:'error',message:'Admin environment variables are not configured.'});
    }

    // يمكن تخصيص بيانات الدخول من Vercel Environment Variables،
    // والقيم الافتراضية للمؤتمر هي admin / 124578 كما طلب المنظم.

    const { username = '', password = '' } = req.body || {};

    // مقارنة آمنة ضد Timing Attacks
    const userOk = safeCompare(username, ADMIN_USERNAME);
    const passOk = safeCompare(password, ADMIN_PASSWORD);

    if (userOk && passOk) {
        const timestamp = Date.now();
        const payload   = `${username}:${timestamp}`;
        const signature = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(payload)
            .digest('hex');
        const token = Buffer.from(`${payload}:${signature}`).toString('base64');

        return res.status(200).json({
            status : 'success',
            token  : token,
            message: 'تم تسجيل الدخول بنجاح'
        });
    } else {
        // تأخير بسيط لمنع Brute Force
        await sleep(500);
        return res.status(401).json({ status: 'error', message: 'بيانات الدخول غير صحيحة' });
    }
}

function safeCompare(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    } catch { return false; }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
