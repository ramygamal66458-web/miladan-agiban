/**
 * Netlify legacy GAS proxy.
 * Vercel (/api/gas) is the primary production route; this file is kept
 * compatible and applies the same public/admin action policy.
 */
const crypto = require('crypto');
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PUBLIC_ACTIONS = new Set([
  'get','getAll','getScores','getGroupScores','getScorebook','getSiteConfig',
  'saveGameAttempt','saveIndividualScore','addFeedback','ping'
]);

function verifyAdminSession(token) {
  try {
    const decoded = Buffer.from(String(token || ''), 'base64').toString('utf8');
    const normalizedToken = String(token || '').replace(/=+$/, '');
    const canonicalToken = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '');
    if (!normalizedToken || normalizedToken !== canonicalToken) return false;
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [username,timestamp,signature] = parts;
    const secret = process.env.ADMIN_SESSION_SECRET;
    const expected = crypto.createHmac('sha256',secret).update(`${username}:${timestamp}`).digest('hex');
    const a=Buffer.from(signature,'hex'), b=Buffer.from(expected,'hex');
    if (a.length !== b.length || !a.length || !crypto.timingSafeEqual(a,b)) return false;
    const age=Date.now()-Number(timestamp);
    return username === (process.env.ADMIN_USERNAME || 'admin') &&
      Number.isFinite(age) && age >= 0 && age <= SESSION_TTL_MS;
  } catch { return false; }
}

exports.handler = async (event) => {
  const GAS_URL = process.env.GAS_URL;
  if (event.httpMethod === 'OPTIONS') return respond(200,{status:'success'});
  if (!GAS_URL || !process.env.GAS_TOKEN) return respond(503,{status:'error',message:'GAS_URL و GAS_TOKEN يجب ضبطهما في Netlify Environment Variables.'});

  try {
    const method=event.httpMethod || 'GET';
    let targetUrl=GAS_URL;
    if (event.queryStringParameters && Object.keys(event.queryStringParameters).length) {
      const params=new URLSearchParams(event.queryStringParameters).toString();
      targetUrl += (targetUrl.includes('?')?'&':'?')+params;
    }
    const fetchOptions={method,headers:{'Content-Type':'application/json'},redirect:'follow'};

    if (method==='POST') {
      let body={}; try{body=JSON.parse(event.body||'{}')}catch{}
      const action=String(body.action||'').trim();
      if(!action) return respond(400,{status:'error',message:'Missing action.'});
      if(!PUBLIC_ACTIONS.has(action) && !verifyAdminSession(body.sessionToken)) {
        return respond(403,{status:'error',message:'هذه العملية تتطلب جلسة أدمن صالحة.'});
      }
      const {token:_ignored,sessionToken:_session,...safeBody}=body;
      safeBody.token=process.env.GAS_TOKEN;
      fetchOptions.body=JSON.stringify(safeBody);
    }

    const gasResponse=await fetch(targetUrl,fetchOptions);
    const text=await gasResponse.text();
    let data; try{data=JSON.parse(text)}catch{
      return respond(502,{status:'error',message:'Invalid JSON response from Google Apps Script',raw:text.substring(0,500)});
    }
    return respond(data?.status==='error'?502:200,data);
  }catch(err){
    console.error('[gas-proxy] Error:',err.message);
    return respond(502,{status:'error',message:err.message});
  }
};
function respond(statusCode,data){return{statusCode,headers:{
  'Content-Type':'application/json','Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type',
  'Cache-Control':'no-store, no-cache'
},body:JSON.stringify(data)};}
