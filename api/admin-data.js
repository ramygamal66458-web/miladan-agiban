/* api/admin-data.js — بوابة العمليات الحساسة للوحة الأدمن */
import crypto from 'crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;


function verifyToken(token) {
  try {
    const decoded = Buffer.from(String(token||''), 'base64').toString('utf8');
    const normalizedToken=String(token||'').replace(/=+$/,'');
    const canonicalToken=Buffer.from(decoded,'utf8').toString('base64').replace(/=+$/,'');
    if(!normalizedToken || normalizedToken!==canonicalToken) return false;
    const parts = decoded.split(':');
    if(parts.length !== 3) return false;
    const [username,timestamp,signature]=parts;
    const secret=process.env.ADMIN_SESSION_SECRET; if(!secret) return false;
    const payload=`${username}:${timestamp}`;
    const expected=crypto.createHmac('sha256',secret).update(payload).digest('hex');
    if(signature.length!==expected.length) return false;
    if(!crypto.timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'))) return false;
    const age=Date.now()-Number(timestamp);
    return username === process.env.ADMIN_USERNAME && age >= 0 && age <= SESSION_TTL_MS;
  } catch(e){ return false; }
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, no-cache');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({status:'error',message:'Method not allowed'});

  const {sessionToken, action, payload={}} = req.body || {};
  if(!verifyToken(sessionToken)) return res.status(401).json({status:'error',message:'جلسة الأدمن غير صالحة'});

  const GAS_URL=process.env.GAS_URL || DEFAULT_GAS_URL;
  const GAS_TOKEN=process.env.GAS_TOKEN;
  try{
    const body={...(payload||{}),action,token:GAS_TOKEN};
    const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'follow'});
    const text=await r.text();
    let data; try{data=JSON.parse(text);}catch(e){return res.status(502).json({status:'error',message:'استجابة غير صالحة من Google Apps Script'});}
    return res.status(r.ok?200:502).json(data);
  }catch(e){return res.status(502).json({status:'error',message:e.message});}
}
