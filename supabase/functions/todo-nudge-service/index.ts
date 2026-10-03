import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.109.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MS_TENANT_ID = Deno.env.get('MS_TENANT_ID')?.trim();
const MS_CLIENT_ID = Deno.env.get('MS_CLIENT_ID')?.trim();
const MS_CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET')?.trim();
const MS_SENDER_EMAIL = Deno.env.get('MS_SENDER_EMAIL')?.trim() || 'info@talent-stock.com';
const APP_URL = 'https://todo-resume-intelligence.vercel.app';
const sb = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

function esc(s=''){return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]!));}
function firstName(name=''){return String(name||'there').trim().split(/\s+/)[0]||'there';}
function hash32(input:string){let h=2166136261>>>0;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0;}
function pick<T>(arr:T[],seed:number,offset=0){return arr[(seed+offset)%arr.length];}

async function graphToken(){
  if(!MS_TENANT_ID||!MS_CLIENT_ID||!MS_CLIENT_SECRET) throw new Error('Microsoft 365 configuration is incomplete');
  const r=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(MS_TENANT_ID)}/oauth2/v2.0/token`,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:MS_CLIENT_ID,client_secret:MS_CLIENT_SECRET,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'})
  });
  if(!r.ok) throw new Error(`Microsoft authentication failed (${r.status}): ${await r.text()}`);
  const j=await r.json(); if(!j?.access_token) throw new Error('Microsoft access token missing'); return String(j.access_token);
}

const SUBJECTS_1130=[
  'Todo did a morning check. The dashboard looked shy 👀',
  'Coffee is active. Todo activity? Not yet ☕',
  'Your morning recruiter check-in just arrived ✨',
  'Tiny Todo nudge before lunch gets involved 👀',
  'Todo has one small question: update hua kya? 😌',
  'Morning pulse check: your pipeline is waiting',
  'Your dashboard sent a polite reminder 👋',
  'Todo noticed a quiet morning. Everything okay?',
  'Before lunch: one quick recruiter update?',
  'A small nudge from Todo, not a lecture 😌',
  'Today’s recruiter story is still missing a chapter 👀',
  'Todo is ready. Your activity log is warming up',
  'Quick morning sync before the day gets busy',
  'Your pipeline called for a tiny status update',
  'Todo’s morning memo: keep the pipeline fresh ✨'
];
const SUBJECTS_1530=[
  'Your candidates called. They want an update 👀',
  'Todo checked the dashboard. Suspiciously quiet 👀',
  'Before you log off… one quick Todo check? 😌',
  'Your pipeline wants a 60-second update',
  '3:30 PM check: give tomorrow-you a favour ✨',
  'Todo remembers everything. Save yourself the detective work',
  'Quick afternoon sync before the day disappears',
  'The dashboard is waiting for today’s plot twist 👀',
  'One tiny update before the evening wins',
  'Your recruiter activity deserves a closing scene 🎬',
  'Todo’s 3:30 memo: keep the pipeline honest',
  'Before the tab closes: update the pipeline once',
  'Candidate moved today? Tell Todo before you forget',
  'Afternoon recruiter check-in: 60 seconds, that’s it',
  'Todo has entered the chat with one small reminder 👋',
  'Your future self requested a cleaner dashboard',
  'Close the loop before you close the laptop',
  'A gentle 3:30 nudge from your very observant Todo 👀'
];
const HEADLINES=[
  'All good? Just a quick nudge!',
  'Tiny update. Much cleaner pipeline.',
  'Keep today out of tomorrow’s detective work.',
  'Your dashboard likes fresh news.',
  'One minute now saves ten tomorrow.',
  'Let’s keep the hiring story current.',
  'A quick update keeps everyone in sync.',
  'Small action, cleaner pipeline.',
  'Todo noticed a quiet patch 👀',
  'Before the day moves on…',
  'Give the dashboard today’s version.',
  'Your pipeline deserves a quick refresh.',
  'One tiny recruiter housekeeping moment.',
  'Keep Todo in the loop — it gets dramatic otherwise 😌',
  'Today happened. Make sure the dashboard knows.'
];
const LEADS=[
  'No alarm bells — just a friendly recruiter check-in.',
  'Todo is doing its job: remembering the things humans forget.',
  'If something moved today, this is your cue to log it.',
  'A clean pipeline is basically a gift to your future self.',
  'Your activity can be small; the update should still exist.',
  'This is the polite version of Todo clearing its throat.',
  'The day is moving fast, so here is your 60-second checkpoint.',
  'Nothing fancy — just keep the team view current.',
  'If you touched a candidate, requirement or interview, Todo wants the headline.',
  'A little recruiter hygiene now keeps tomorrow much calmer.',
  'No spreadsheet archaeology required — just update the source of truth.',
  'Todo is not judging. It is definitely noticing, though. 👀'
];
const BODIES=[
  'Candidate screened, interview scheduled, follow-up done, requirement moved — log whatever changed today so the team sees the latest picture.',
  'Add the latest candidate movement, interview action or requirement update. One current dashboard beats five “what happened?” messages tomorrow.',
  'If today included screening, sourcing, scheduling or client movement, capture it now while the context is still fresh.',
  'Keep candidate and requirement status current so handoffs stay clean and nobody has to reconstruct the day later.',
  'A quick activity update keeps reports accurate, ownership clear and tomorrow’s follow-ups much easier.',
  'Whatever moved today — candidate, interview, requirement or client follow-up — give Todo the latest version before it becomes yesterday’s mystery.',
  'Update the work you already did. The goal is not more admin; it is less confusion tomorrow.',
  'Drop in the latest activity so your pipeline, team view and reporting all tell the same story.',
  'If something progressed today, record it once in Todo and let the dashboard do the remembering for you.',
  'A current activity log means cleaner handoffs, better follow-ups and fewer last-minute status hunts.'
];
const CTAS=[
  'Update Todo in 60 sec',
  'Give Todo the latest',
  'Refresh my pipeline',
  'Log today’s update',
  'Close the loop',
  'Update before I forget',
  'Keep the dashboard current',
  'Do the 60-second check'
];
const MISSIONS=[
  'Add today’s candidate movement',
  'Update an interview or follow-up',
  'Move the requirement status if needed',
  'Log the latest recruiter activity',
  'Give the pipeline one clean refresh'
];
const FOOTERS=[
  'Already updated? Perfect — Todo can stop being dramatic now 😌',
  'If everything is current, consider this your permission to ignore Todo with confidence.',
  'Done already? Beautiful. You are officially ahead of the reminder.',
  'Nothing changed today? No action needed — Todo just likes certainty.',
  'Pipeline already clean? Carry on. Todo approves quietly.'
];

type Copy={subject:string;headline:string;lead:string;body:string;cta:string;mission:string;footer:string;signature:string};

async function usedCopy(subject:string,signature:string){
  const {data,error}=await sb.from('todo_nudge_email_log').select('id').eq('subject',subject).eq('body',signature).limit(1);
  if(error) throw error;
  return Boolean(data?.length);
}

async function freshCopy(slot:string,seedBasis:string):Promise<Copy>{
  const subjects=slot==='15:30'?SUBJECTS_1530:SUBJECTS_1130;
  const seed=hash32(seedBasis);
  for(let attempt=0;attempt<500;attempt++){
    const subject=pick(subjects,seed,attempt*7);
    const headline=pick(HEADLINES,seed>>>1,attempt*11);
    const lead=pick(LEADS,seed>>>2,attempt*13);
    const body=pick(BODIES,seed>>>3,attempt*17);
    const cta=pick(CTAS,seed>>>4,attempt*19);
    const mission=pick(MISSIONS,seed>>>5,attempt*23);
    const footer=pick(FOOTERS,seed>>>6,attempt*29);
    const signature=JSON.stringify({headline,lead,body,cta,mission,footer});
    if(!(await usedCopy(subject,signature))) return {subject,headline,lead,body,cta,mission,footer,signature};
  }
  throw new Error('Unable to produce an unused nudge copy combination');
}

function premiumHtml(name:string,slot:string,c:Copy){
  const first=esc(firstName(name));
  const isAfternoon=slot==='15:30';
  const badge=isAfternoon?'3:30 PM CHECK-IN':'11:30 AM CHECK-IN';
  const sub=isAfternoon?'Before the day runs away':'A quick morning pulse check';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#12243a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6fb"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;background:#ffffff;border:1px solid #e1e8f0;border-radius:22px;overflow:hidden;box-shadow:0 14px 38px rgba(30,55,90,.08)">
<tr><td style="padding:22px 28px 10px">
<table role="presentation" width="100%"><tr>
<td style="font-size:21px;font-weight:800;color:#12243a"><span style="color:#2f72ff">✦</span> TODO <span style="color:#2f72ff">AI</span><span style="font-size:13px;font-weight:500;color:#8190a3"> · Talent Stock Solutions</span></td>
<td align="right"><span style="display:inline-block;background:#eef5ff;color:#2b66d9;border:1px solid #d8e7ff;border-radius:999px;padding:7px 11px;font-size:10px;font-weight:800;letter-spacing:.6px">${badge}</span></td>
</tr></table></td></tr>

<tr><td style="padding:12px 28px 0">
<table role="presentation" width="100%" style="background:linear-gradient(135deg,#f3f7ff,#fff7f0);border:1px solid #e7edf5;border-radius:18px">
<tr><td style="padding:26px 24px" valign="middle">
<div style="font-size:13px;color:#6f8094;font-weight:700;margin-bottom:7px">${esc(sub)}</div>
<div style="font-size:30px;line-height:1.16;font-weight:800;color:#11233a">${esc(c.headline)}</div>
<div style="font-size:15px;line-height:1.6;color:#52677d;margin-top:10px">Hey <b style="color:#11233a">${first}</b> 👋 &nbsp; ${esc(c.lead)}</div>
</td>
<td width="120" align="center" style="padding:22px 18px 22px 0"><div style="width:84px;height:84px;border-radius:42px;background:#ffffff;border:1px solid #e4ebf4;text-align:center;line-height:84px;font-size:38px;box-shadow:0 8px 22px rgba(44,87,140,.08)">🤖</div></td>
</tr></table></td></tr>

<tr><td style="padding:16px 28px 0">
<table role="presentation" width="100%" style="background:#f8fbff;border:1px solid #dce9fa;border-radius:15px">
<tr><td width="58" align="center" style="font-size:25px;padding:18px 8px">📍</td><td style="padding:16px 18px 16px 0">
<div style="font-size:11px;letter-spacing:.7px;font-weight:800;color:#6e8298">TODAY’S UPDATE</div>
<div style="font-size:14px;line-height:1.65;color:#40566d;margin-top:5px">${esc(c.body)}</div>
</td></tr></table></td></tr>

<tr><td style="padding:15px 28px 0">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td width="32%" style="padding-right:7px"><div style="background:#fff6ea;border:1px solid #f3dfc1;border-radius:12px;padding:13px 12px;text-align:center;font-size:12px;color:#745626"><b>Candidate</b><br><span style="color:#8c7655">movement</span></div></td>
<td width="32%" style="padding:0 4px"><div style="background:#eef8f2;border:1px solid #d3eadc;border-radius:12px;padding:13px 12px;text-align:center;font-size:12px;color:#356148"><b>Interview</b><br><span style="color:#6b8575">follow-up</span></div></td>
<td width="32%" style="padding-left:7px"><div style="background:#f1f2ff;border:1px solid #dfe1fa;border-radius:12px;padding:13px 12px;text-align:center;font-size:12px;color:#515780"><b>Requirement</b><br><span style="color:#777c9d">status</span></div></td>
</tr></table></td></tr>

<tr><td style="padding:16px 28px 0">
<table role="presentation" width="100%" style="background:#fff9e9;border:1px solid #f1e0ad;border-radius:14px"><tr>
<td width="56" align="center" style="font-size:22px;padding:15px 6px">⚡</td>
<td style="padding:14px 16px 14px 0"><div style="font-size:12px;font-weight:800;color:#765b18">QUICK MISSION</div><div style="font-size:13px;color:#685d40;margin-top:4px">${esc(c.mission)} — then you’re done.</div></td>
</tr></table></td></tr>

<tr><td align="center" style="padding:22px 28px 10px">
<a href="${APP_URL}" style="display:inline-block;background:#276ef1;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:11px;font-size:14px;font-weight:800;box-shadow:0 8px 20px rgba(39,110,241,.18)">${esc(c.cta)} &nbsp;→</a>
<div style="font-size:11px;color:#8796a7;margin-top:10px">Candidates · Interviews · Requirements · Activity</div>
</td></tr>

<tr><td style="padding:8px 28px 24px">
<div style="border-top:1px solid #e9eef4;padding-top:15px;font-size:11px;line-height:1.55;color:#8a99a9">
<table role="presentation" width="100%"><tr><td>${esc(c.footer)}</td><td align="right"><b>TODO AI</b><br>Smarter hiring, cleaner process.</td></tr></table>
</div></td></tr>
</table></td></tr></table></body></html>`;
}

async function sendMail(token:string,to:string,name:string,slot:string,c:Copy){
  const html=premiumHtml(name,slot,c);
  const r=await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MS_SENDER_EMAIL)}/sendMail`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({message:{subject:c.subject,body:{contentType:'HTML',content:html},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:true})
  });
  if(!r.ok) throw new Error(`Microsoft Graph sendMail failed (${r.status}): ${await r.text()}`);
}

async function logCopy(userId:string,date:string,slot:string,c:Copy,status='sent'){
  const {error}=await sb.from('todo_nudge_email_log').insert({user_id:userId,nudge_date:date,slot,subject:c.subject,body:c.signature,status,sent_at:new Date().toISOString()});
  if(error) throw error;
}

function isNudgeWeekday(at:Date=new Date()){
  const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short'}).format(at);
  return weekday!=='Sat' && weekday!=='Sun';
}

function todayIST(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

Deno.serve(async(req)=>{
  if(req.method!=='POST') return new Response('Method Not Allowed',{status:405});
  const key=req.headers.get('x-automation-key')||'';
  if(!key) return new Response('Unauthorized',{status:401});
  const {data:auth,error:authErr}=await sb.from('automation_settings').select('value').eq('key','todo_nudge_cron_key').maybeSingle();
  if(authErr||!auth||auth.value!==key) return new Response('Unauthorized',{status:401});

  if(!isNudgeWeekday()) return Response.json({ok:true,skipped:true,reason:'weekend',time_zone:'Asia/Kolkata',sent:0});

  let body:any={}; try{body=await req.json().catch(()=>({}));}catch{}
  const slot=String(body?.slot||'');
  const testTo=String(body?.test_to||'').trim();
  const realTo=String(body?.real_to||'').trim();
  const targetName=String(body?.name||body?.test_name||'Recruiter').trim();

  if(!MS_TENANT_ID||!MS_CLIENT_ID||!MS_CLIENT_SECRET) return Response.json({ok:false,error:'Microsoft 365 configuration is incomplete'},{status:503});
  let token=''; try{token=await graphToken();}catch(err){return Response.json({ok:false,provider:'microsoft-graph',error:String(err)},{status:502});}

  if(testTo||realTo){
    const target=testTo||realTo;
    const effectiveSlot=['11:30','15:30'].includes(slot)?slot:'15:30';
    try{
      const c=await freshCopy(effectiveSlot,`${target}|${effectiveSlot}|${crypto.randomUUID()}`);
      await sendMail(token,target,targetName,effectiveSlot,c);
      return Response.json({ok:true,test:Boolean(testTo),one_off:Boolean(realTo),provider:'microsoft-graph',sender:MS_SENDER_EMAIL,sent:1,subject:c.subject});
    }catch(err){return Response.json({ok:false,test:Boolean(testTo),one_off:Boolean(realTo),provider:'microsoft-graph',error:String(err)},{status:502});}
  }

  if(!['11:30','15:30'].includes(slot)) return Response.json({ok:false,error:'slot must be 11:30 or 15:30'},{status:400});
  const {data,error}=await sb.rpc('claim_todo_nudges_with_key',{p_key:key,p_slot:slot,p_limit:50});
  if(error) return Response.json({ok:false,error:error.message},{status:500});

  const date=todayIST(); let sent=0,failed=0;
  for(const e of data||[]){
    try{
      const c=await freshCopy(e.slot,`${e.event_id}|${e.profile_id}|${date}|${e.slot}`);
      await sendMail(token,e.email,e.full_name,e.slot,c);
      await logCopy(e.profile_id,date,e.slot,c,'sent');
      const m=await sb.rpc('mark_todo_nudge_with_key',{p_key:key,p_event_id:e.event_id,p_status:'Sent',p_error:null});
      if(m.error) throw m.error;
      sent++;
    }catch(err){
      await sb.rpc('mark_todo_nudge_with_key',{p_key:key,p_event_id:e.event_id,p_status:'Failed',p_error:String(err)});
      failed++;
    }
  }
  return Response.json({ok:true,provider:'microsoft-graph',sender:MS_SENDER_EMAIL,slot,claimed:(data||[]).length,sent,failed,copy_mode:'non_repeating_premium'});
});