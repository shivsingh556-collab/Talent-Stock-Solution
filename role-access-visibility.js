// Role-based visibility: shared candidate database, recruiter-owned interviews, admin oversight.
(function(){
  'use strict';
  const backend=()=>window.TSSBackend;
  const DB=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  let role='recruiter', userId='', interviewMeta=new Map(), profileMap=new Map();
  function recruiterLabel(profile){
    const raw=String(profile?.full_name||profile?.email||'Recruiter').split('@')[0].trim();
    return raw.replace(/[._-]+/g,' ').replace(/\b\w/g,char=>char.toUpperCase())||'Recruiter';
  }

  async function getRole(){
    const b=backend(); if(!b?.enabled)return {role:'recruiter',user:null};
    const user=await b.currentUser().catch(()=>null); if(!user)return {role:'recruiter',user:null};
    userId=user.id;
    const {data}=await b.client.from('profiles').select('id,full_name,email,role').eq('id',user.id).maybeSingle();
    role=String(data?.role||'recruiter').toLowerCase();
    return {role,user,profile:data};
  }

  async function refreshInterviewScope(){
    const b=backend(),store=DB(); if(!b?.enabled||!store)return;
    const {data:rows,error}=await b.client.from('interviews').select('id,created_by,status,candidate_response,reschedule_preferred_date,reschedule_preferred_time').order('scheduled_at',{ascending:true});
    if(error)throw error;
    interviewMeta=new Map((rows||[]).map(x=>[String(x.id),x]));

    // RLS is authoritative: recruiter query returns only their interviews; admin query returns all.
    const allowed=new Set((rows||[]).map(x=>String(x.id)));
    store.interviews=(store.interviews||[]).filter(i=>allowed.has(String(i.serverId||i.id)));
    profileMap=new Map();
    if(role==='admin'){
      const {data:profiles}=await b.client.from('profiles').select('id,full_name,email');
      profileMap=new Map((profiles||[]).map(p=>[String(p.id),p]));
    }else{
      const {data:self}=await b.client.from('profiles').select('id,full_name,email').eq('id',userId).maybeSingle();
      if(self)profileMap.set(String(self.id),self);
    }
    store.interviews.forEach(item=>{
      const meta=interviewMeta.get(String(item.serverId||item.id));
      if(!meta)return;
      const profile=profileMap.get(String(meta.created_by));
      item.createdBy=meta.created_by||null;
      item.scheduledBy=recruiterLabel(profile);
    });
    try{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(store))}catch{}
    try{window.renderOldSite?.()}catch{}
    setTimeout(()=>window.TSSInterviewActions?.renderStable?.(true),60);
  }

  function ensureScopeNote(){
    const board=document.getElementById('interviewBoard'); if(!board)return;
    let note=document.getElementById('interviewScopeNote');
    if(!note){note=document.createElement('div');note.id='interviewScopeNote';note.className='role-scope-note';board.before(note);}
    note.innerHTML=role==='admin'
      ? '<b>Admin view:</b> All recruiters\' interviews and candidate responses are visible here.'
      : '<b>My interviews:</b> Only interviews scheduled by you are shown here.';
  }

  function ensureCandidateNote(){
    const view=document.getElementById('candidates'); if(!view)return;
    let note=document.getElementById('candidateSharedNote');
    if(!note){note=document.createElement('div');note.id='candidateSharedNote';note.className='role-scope-note shared';const first=view.querySelector('.section-head,.section-title,.card');if(first)first.after(note);else view.prepend(note);}
    note.innerHTML='<b>Shared Candidate Database:</b> All authenticated TSS recruiters can view the common candidate database. Editing/deleting remains restricted to the record owner or Admin.';
  }

  function decorateInterviewBoard(){
    ensureScopeNote(); ensureCandidateNote();
  }

  function style(){if(document.getElementById('roleAccessStyle'))return;const s=document.createElement('style');s.id='roleAccessStyle';s.textContent=`.role-scope-note{margin:0 0 12px;padding:10px 13px;border:1px solid #234d6d;border-radius:10px;background:#0a2133;color:#a9c7dc;font-size:12px}.role-scope-note b{color:#e8f5ff}.role-scope-note.shared{border-color:#285f70;background:#0a252d}`;document.head.appendChild(s)}

  async function boot(){
    style();
    const ctx=await getRole(); if(!ctx.user)return;
    await refreshInterviewScope();
    ensureCandidateNote();
    window.addEventListener('focus',()=>setTimeout(()=>refreshInterviewScope().catch(()=>{}),80));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>boot().catch(console.warn),300),{once:true});else setTimeout(()=>boot().catch(console.warn),300);
  window.TSSRoleAccessVisibility={boot,refreshInterviewScope,decorateInterviewBoard,recruiterLabel,get role(){return role}};
})();
