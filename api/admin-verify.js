/**
 * api/admin-verify.js — Vercel Serverless Function
 * ─────────────────────────────────────────────────────────────────────────────
 * التحقق من صحة Session Token الصادر من admin-auth.js
 * مدة صلاحية الجلسة: 8 ساعات
 * ─────────────────────────────────────────────────────────────────────────────
 */

import crypto from 'crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 ساعات

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control',                'no-store, no-cache');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ status: 'error', message: 'Method not allowed' });
    }

    const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
    if (!SESSION_SECRET) return res.status(503).json({status:'error',message:'ADMIN_SESSION_SECRET غير مضبوط.'});
    const { token = '' } = req.body || {};

    if (!token) {
        return res.status(401).json({ status: 'error', message: 'لا يوجد توكن جلسة' });
    }

    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const normalizedToken = String(token).replace(/=+$/, '');
        const canonicalToken = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '');
        if (normalizedToken !== canonicalToken) throw new Error('invalid base64');
        const parts   = decoded.split(':');
        if (parts.length !== 3) throw new Error('invalid format');

        const [username, timestamp, signature] = parts;
        const payload     = `${username}:${timestamp}`;
        const expectedSig = crypto
            .createHmac('sha256', SESSION_SECRET)
            .update(payload)
            .digest('hex');

        const sigValid = crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSig, 'hex')
        );
        if (!sigValid) throw new Error('invalid signature');

        const expectedUsername = process.env.ADMIN_USERNAME;
        if (!expectedUsername) throw new Error('missing username config');
        if (username !== expectedUsername) throw new Error('invalid username');

        const age = Date.now() - parseInt(timestamp, 10);
        if (age < 0 || age > SESSION_TTL_MS) {
            return res.status(401).json({
                status : 'error',
                message: 'انتهت مدة الجلسة، يرجى إعادة تسجيل الدخول'
            });
        }

        return res.status(200).json({ status: 'success', username });

    } catch (e) {
        return res.status(401).json({ status: 'error', message: 'توكن الجلسة غير صالح' });
    }
}
