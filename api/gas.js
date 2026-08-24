/**
 * api/gas.js — Vercel Serverless Function
 * Secure proxy between the browser and Google Apps Script.
 *
 * Public browser actions are allow-listed.
 * Sensitive/admin actions require a valid server-issued admin session token.
 */

import crypto from 'crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const PUBLIC_ACTIONS = new Set([
  'get',
  'getAll',
  'getScores',
  'getGroupScores',
  'getScorebook',
  'getSiteConfig',
  'saveGameAttempt',
  'saveIndividualScore',
  'addFeedback',
  'ping'
]);

function verifyAdminSession(token) {
  try {
    const decoded = Buffer
      .from(String(token || ''), 'base64')
      .toString('utf8');

    const normalizedToken = String(token || '').replace(/=+$/, '');

    const canonicalToken = Buffer
      .from(decoded, 'utf8')
      .toString('base64')
      .replace(/=+$/, '');

    if (!normalizedToken || normalizedToken !== canonicalToken) {
      return false;
    }

    const parts = decoded.split(':');

    if (parts.length !== 3) {
      return false;
    }

    const [username, timestamp, signature] = parts;

    const secret = process.env.ADMIN_SESSION_SECRET;

    if (!secret) {
      return false;
    }

    const payload = `${username}:${timestamp}`;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (
      sigBuf.length !== expBuf.length ||
      !sigBuf.length
    ) {
      return false;
    }

    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }

    const age = Date.now() - Number(timestamp);

    return (
      username === (process.env.ADMIN_USERNAME || 'admin') &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= SESSION_TTL_MS
    );

  } catch (error) {
    console.error('[gas-proxy] Session verification error:', error.message);
    return false;
  }
}

export default async function handler(req, res) {

  // ---------------------------------------------------------
  // CORS / CACHE
  // ---------------------------------------------------------

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate'
  );

  // ---------------------------------------------------------
  // OPTIONS
  // ---------------------------------------------------------

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ---------------------------------------------------------
  // METHODS
  // ---------------------------------------------------------

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    });
  }

  // ---------------------------------------------------------
  // ENVIRONMENT VARIABLES
  // ---------------------------------------------------------

  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return res.status(503).json({
      status: 'error',
      message:
        'GAS_URL environment variable is not set in Vercel dashboard.'
    });
  }

  try {

    // =======================================================
    // REQUEST BODY
    // =======================================================

    let body = {};

    if (req.method === 'POST') {

      body = req.body || {};

      // Vercel may sometimes provide the body as a string.
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      if (!body || typeof body !== 'object') {
        body = {};
      }

      const action = String(body.action || '').trim();

      if (!action) {
        return res.status(400).json({
          status: 'error',
          message: 'Missing action.'
        });
      }

      // -----------------------------------------------------
      // Sensitive individual scoring actions
      // -----------------------------------------------------

      const sensitiveIndividual =
        action === 'saveIndividualScore' &&
        /^(attendance\d+|pamphlet)$/.test(
          String(body.category || '')
        );

      // -----------------------------------------------------
      // Admin verification
      // -----------------------------------------------------

      if (
        !PUBLIC_ACTIONS.has(action) ||
        sensitiveIndividual
      ) {
        if (!verifyAdminSession(body.sessionToken)) {
          return res.status(403).json({
            status: 'error',
            message:
              'هذه العملية تتطلب جلسة أدمن صالحة.'
          });
        }
      }

      // -----------------------------------------------------
      // NEVER trust client supplied GAS/session tokens
      // -----------------------------------------------------

      const {
        token: _ignoredToken,
        sessionToken: _ignoredSession,
        ...safeBody
      } = body;

      // -----------------------------------------------------
      // Sensitive action authorization
      // -----------------------------------------------------

      if (sensitiveIndividual) {
        safeBody.adminAuthorized = true;
      }

      // -----------------------------------------------------
      // GAS TOKEN
      // -----------------------------------------------------

      const GAS_TOKEN = process.env.GAS_TOKEN;

      if (!GAS_TOKEN) {
        return res.status(503).json({
          status: 'error',
          message:
            'GAS_TOKEN غير مضبوط في Vercel Environment Variables.'
        });
      }

      // Server-side token only.
      safeBody.token = GAS_TOKEN;

      body = safeBody;
    }

    // =======================================================
    // BUILD GAS URL
    // =======================================================

    let targetUrl = GAS_URL;

    if (req.method === 'GET') {

      const params = new URLSearchParams(req.query || {});

      if (params.toString()) {
        targetUrl +=
          (targetUrl.includes('?') ? '&' : '?') +
          params.toString();
      }
    }

    // =======================================================
    // FETCH OPTIONS
    // =======================================================

    const fetchOptions = {
      method: req.method,

      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },

      // IMPORTANT:
      // Google Apps Script /exec normally redirects
      // to script.googleusercontent.com.
      //
      // We allow fetch to follow the redirect while
      // preserving the request body.
      redirect: 'follow'
    };

    if (req.method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    }

    // =======================================================
    // SEND REQUEST TO GOOGLE APPS SCRIPT
    // =======================================================

    console.log(
      '[gas-proxy] Sending request:',
      JSON.stringify({
        method: req.method,
        action: body?.action || null,
        category: body?.category || null
      })
    );

    const gasResponse = await fetch(
      targetUrl,
      fetchOptions
    );

    // =======================================================
    // READ RESPONSE
    // =======================================================

    const responseText = await gasResponse.text();

    console.log(
      '[gas-proxy] GAS HTTP status:',
      gasResponse.status
    );

    console.log(
      '[gas-proxy] GAS response:',
      responseText.substring(0, 1000)
    );

    // =======================================================
    // PARSE JSON
    // =======================================================

    let responseData;

    try {

      responseData = JSON.parse(responseText);

    } catch (error) {

      console.error(
        '[gas-proxy] Non-JSON response from GAS:',
        responseText.substring(0, 1000)
      );

      return res.status(502).json({
        status: 'error',
        message:
          'Invalid JSON response from Google Apps Script',
        raw: responseText.substring(0, 500)
      });
    }

    // =======================================================
    // PRESERVE GAS APPLICATION ERRORS
    // =======================================================

    if (responseData?.status === 'error') {

      console.error(
        '[gas-proxy] GAS application error:',
        responseData
      );

      return res.status(502).json(responseData);
    }

    // =======================================================
    // SUCCESS
    // =======================================================

    return res.status(200).json(responseData);

  } catch (err) {

    console.error(
      '[gas-proxy] Error:',
      err?.message || err
    );

    return res.status(502).json({
      status: 'error',
      message:
        err?.message ||
        'Failed to communicate with Google Apps Script'
    });
  }
}
