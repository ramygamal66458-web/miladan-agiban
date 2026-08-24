/**
 * api/gas.js — Vercel Serverless Function
 * Secure proxy between the browser and Google Apps Script.
 *
 * Public browser actions are allow-listed. Sensitive/admin actions require
 * a valid server-issued admin session token.
 */
import crypto from 'crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const PUBLIC_ACTIONS = new Set([
  'get', 'getAll', 'getScores', 'getGroupScores', 'getScorebook',
  'getSiteConfig', 'saveGameAttempt', 'saveIndividualScore',
  'addFeedback', 'ping'
]);

function verifyAdminSession(token) {
  try {
    const decoded = Buffer.from(String(token || ''), 'base64').toString('utf8');
    const normalizedToken = String(token || '').replace(/=+$/, '');
    const canonicalToken = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '');
    if (!normalizedToken || normalizedToken !== canonicalToken) return false;
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [username, timestamp, signature] = parts;
    const secret = process.env.ADMIN_SESSION_SECRET;
    const payload = `${username}:${timestamp}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || !sigBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
    const age = Date.now() - Number(timestamp);
    return username === (process.env.ADMIN_USERNAME || 'admin') &&
           Number.isFinite(age) && age >= 0 && age <= SESSION_TTL_MS;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  const GAS_URL = process.env.GAS_URL;
  if (!GAS_URL) {
    return res.status(503).json({ status: 'error', message: 'GAS_URL environment variable is not set in Vercel dashboard.' });
  }

  try {
    let body = {};
    if (req.method === 'POST') {
      body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const action = String(body.action || '').trim();
      if (!action) {
        return res.status(400).json({ status: 'error', message: 'Missing action.' });
      }

      const sensitiveIndividual =
        action === 'saveIndividualScore' &&
        /^(attendance\d+|pamphlet)$/.test(String(body.category || ''));
      if (!PUBLIC_ACTIONS.has(action) || sensitiveIndividual) {
        if (!verifyAdminSession(body.sessionToken)) {
          return res.status(403).json({ status: 'error', message: 'هذه العملية تتطلب جلسة أدمن صالحة.' });
        }
      }

      // Never trust client-supplied session/GAS tokens.
      const { token: _ignored, sessionToken: _session, ...safeBody } = body;
      if (sensitiveIndividual) safeBody.adminAuthorized = true;
      if (!process.env.GAS_TOKEN) {
        return res.status(503).json({status:'error',message:'GAS_TOKEN غير مضبوط في Vercel Environment Variables.'});
      }
      safeBody.token = process.env.GAS_TOKEN;
      body = safeBody;
    }

    let targetUrl = GAS_URL;
    if (req.method === 'GET') {
      const params = new URLSearchParams(req.query || {});
      if (params.toString()) targetUrl += (targetUrl.includes('?') ? '&' : '?') + params.toString();
    }

    const fetchOptions = {
  method: req.method,
  headers: {
    'Content-Type': 'application/json'
  },
  redirect: 'follow'
};

if (req.method === 'POST') {
  fetchOptions.body = JSON.stringify(body);
}

// Google Apps Script ContentService redirects the response
// to script.googleusercontent.com.
// Let fetch follow that redirect automatically.
const gasResponse = await fetch(targetUrl, fetchOptions);

const responseText = await gasResponse.text();

let responseData;

try {
  responseData = JSON.parse(responseText);
} catch {
  console.error('[gas-proxy] Non-JSON response from GAS:', responseText.substring(0, 1000));

  return res.status(502).json({
    status: 'error',
    message: 'Invalid JSON response from Google Apps Script',
    raw: responseText.substring(0, 500)
  });
}

    let responseData;
    try { responseData = JSON.parse(responseText); }
    catch {
      return res.status(502).json({
        status: 'error',
        message: 'Invalid JSON response from Google Apps Script',
        raw: responseText.substring(0, 500)
      });
    }

    // Preserve application-level GAS errors instead of turning them into success.
    const upstreamStatus = responseData?.status === 'error' ? 502 : 200;
    return res.status(upstreamStatus).json(responseData);
  } catch (err) {
    console.error('[gas-proxy] Error:', err.message);
    return res.status(502).json({ status: 'error', message: err.message });
  }
}
