/**
 * admin-verify.js — Netlify Serverless Function
 * ─────────────────────────────────────────────────────────────────────────────
 * التحقق من صحة Session Token الصادر من admin-auth.js
 * يُستخدم لحماية العمليات الإدارية الحساسة
 * ─────────────────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');

// مدة صلاحية الجلسة: 8 ساعات
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return respond(405, { status: 'error', message: 'Method not allowed' });
    }

    const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

    let body = {};
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return respond(400, { status: 'error', message: 'Invalid request body' });
    }

    const { token = '' } = body;
    if (!token) {
        return respond(401, { status: 'error', message: 'لا يوجد توكن جلسة' });
    }

    try {
        const decoded  = Buffer.from(token, 'base64').toString('utf8');
        const parts    = decoded.split(':');
        if (parts.length !== 3) throw new Error('invalid format');

        const [username, timestamp, signature] = parts;
        if (!process.env.ADMIN_USERNAME || username !== process.env.ADMIN_USERNAME) throw new Error('invalid username');
        const payload   = `${username}:${timestamp}`;

        // التحقق من التوقيع
        const expectedSig = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(payload)
            .digest('hex');

        const sigValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSig, 'hex')
        );

        if (!sigValid) throw new Error('invalid signature');

        // التحقق من انتهاء الصلاحية
        const age = Date.now() - parseInt(timestamp, 10);
        if (age > SESSION_TTL_MS) {
            return respond(401, { status: 'error', message: 'انتهت مدة الجلسة، يرجى إعادة تسجيل الدخول' });
        }

        return respond(200, { status: 'success', username });

    } catch (e) {
        return respond(401, { status: 'error', message: 'توكن الجلسة غير صالح' });
    }
};

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
