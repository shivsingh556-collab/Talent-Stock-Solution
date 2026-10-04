const {readFile}=require('node:fs/promises');
const {join}=require('node:path');
const URL_BASE='https://wbclpjdjhlsuspojtner.supabase.co';
const API_KEY='sb_publishable_qx9Xf31udLMuRWmqNAjBFQ_I7woPxap';

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Authorization');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).end();
  const authorization=req.headers.authorization||'';
  if(!/^Bearer \S+$/i.test(authorization))return res.status(401).end();
  const headers={apikey:API_KEY,Authorization:authorization};
  try{
    const userResponse=await fetch(`${URL_BASE}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok)return res.status(userResponse.status>=500?503:401).end();
    const user=await userResponse.json();
    if(!user.id||String(user.email||'').toLowerCase().split('@')[1]!=='talent-stock.com')return res.status(403).end();
    const profileResponse=await fetch(`${URL_BASE}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role,is_active`,{headers,signal:AbortSignal.timeout(10000)});
    if(!profileResponse.ok)return res.status(503).end();
    const profiles=await profileResponse.json();
    const profile=profiles?.[0];
    if(!profile||profile.id!==user.id||profile.is_active!==true||!['admin','recruiter'].includes(profile.role)||String(profile.email||'').toLowerCase().split('@')[1]!=='talent-stock.com')return res.status(403).end();
    const shell=await readFile(join(process.cwd(),'private/workspace-shell.html'),'utf8');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.status(200).send(shell);
  }catch{
    return res.status(503).end();
  }
};
