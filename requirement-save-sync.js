// TODO AI authoritative requirement create/update -> Supabase.
(function(){
  const $=id=>document.getElementById(id);
  const backend=()=>window.TSSBackend;
  const split=v=>[...new Set(String(v||'').split(/[,;\n|]/).map(x=>x.trim()).filter(Boolean))];
  const clean=v=>String(v||'').trim();
  const toastSafe=m=>{try{toast(m)}catch{console.log(m)}};
  let saving=false;

  function parseExp(text){
    const nums=(String(text||'').match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    return {min:nums[0]??null,max:nums[1]??null};
  }
  async function nextTssId(c){
    const {data,error}=await c.from('requirements').select('tss_id');
    if(error)throw error;
    const max=(data||[]).reduce((m,r)=>Math.max(m,Number(String(r.tss_id||'').match(/\d+/)?.[0]||0)),0);
    return `TSS${String(max+1).padStart(3,'0')}`;
  }
  async function ensureClient(c,user,name,industry){
    const {data,error}=await c.from('clients').select('id,name').ilike('name',name).limit(1);
    if(error)throw error;
    if(data?.[0])return data[0].id;
    const ins=await c.from('clients').insert({name,industry:industry||null,is_active:true,created_by:user.id}).select('id').single();
    if(ins.error)throw ins.error;
    return ins.data.id;
  }
  async function saveRequirement(e){
    if(saving)return;
    const b=backend();
    if(!b?.enabled)return; // allow legacy local fallback if backend unavailable
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const client=clean($('reqClient')?.value),title=clean($('reqTitle')?.value);
    if(!client||!title){toastSafe('Client and Job Title are required');return;}
    saving=true;
    const btn=$('saveRequirementBtn'),old=btn?.textContent;if(btn){btn.disabled=true;btn.textContent='Saving…'}
    try{
      const user=await b.currentUser();if(!user)throw new Error('Please sign in again');
      const c=b.client;
      const localId=$('reqId')?.value;
      const local=(typeof db!=='undefined'?(db.requirements||[]):[]).find(r=>r.id===localId||r.requirementId===localId);
      const clientId=await ensureClient(c,user,client,clean($('reqIndustry')?.value));
      const exp=parseExp($('reqExperience')?.value);
      const payload={
        client_id:clientId,job_title:title,location:clean($('reqLocation')?.value)||null,
        experience_min:exp.min,experience_max:exp.max,experience_text:clean($('reqExperience')?.value)||null,
        industry:clean($('reqIndustry')?.value)||null,qualification:clean($('reqQualification')?.value)||null,
        responsibilities:clean($('reqResponsibilities')?.value)||null,jd_text:clean($('reqJdText')?.value)||null,
        status:$('reqStatus')?.value||'Active',mandatory_skills:split($('reqSkills')?.value),preferred_skills:split($('reqPreferred')?.value),
        client_owner:clean($('reqClientOwner')?.value)||null,updated_by:user.id,updated_at:new Date().toISOString()
      };
      let saved;
      if(local?.serverId){
        const q=await c.from('requirements').update(payload).eq('id',local.serverId).select('*,clients(name)').single();
        if(q.error)throw q.error;saved=q.data;toastSafe('Requirement updated successfully');
      }else{
        const tssId=await nextTssId(c);
        const profileKey=`current-${tssId.toLowerCase()}-${crypto.randomUUID().slice(0,8)}`;
        const q=await c.from('requirements').insert({...payload,tss_id:tssId,profile_key:profileKey,created_by:user.id}).select('*,clients(name)').single();
        if(q.error)throw q.error;saved=q.data;toastSafe(`${tssId} requirement added successfully`);
      }
      $('requirementDialog')?.close();
      await window.TSSRequirementsLiveSync?.syncNow?.();
      setTimeout(()=>window.TSSProduction?.hydrate?.(),150);
      return saved;
    }catch(err){console.error('Requirement save failed',err);toastSafe('Requirement save failed: '+(err?.message||err));}
    finally{saving=false;if(btn){btn.disabled=false;btn.textContent=old||'Save Requirement'}}
  }
  function wire(){const b=$('saveRequirementBtn');if(!b||b.dataset.supabaseSave==='1')return;b.dataset.supabaseSave='1';b.addEventListener('click',saveRequirement,true);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
  setTimeout(wire,500);
  window.TSSRequirementSaveSync={wire};
})();
