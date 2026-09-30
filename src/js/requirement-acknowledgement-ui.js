// Show recruiter acknowledgement status for requirement assignments.
(function(){
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function currentReq(){
    if(typeof db==='undefined')return null;
    const key=$('reqId')?.value;
    return (db.requirements||[]).find(r=>r.id===key||r.requirementId===key||r.profileKey===key||r.serverId===key)||null;
  }
  function ensureBox(){
    const chips=$('reqRecruiterCleanChips');if(!chips)return null;
    let box=$('reqAcknowledgementStatus');
    if(!box){box=document.createElement('div');box.id='reqAcknowledgementStatus';box.style.cssText='margin-top:10px;display:flex;flex-wrap:wrap;gap:7px;font-size:11px';chips.insertAdjacentElement('afterend',box)}
    return box;
  }
  async function refresh(){
    const r=currentReq(),box=ensureBox();if(!box)return;
    if(!r?.serverId){box.innerHTML='';return;}
    try{
      const c=window.TSSBackend?.client;if(!c)return;
      const {data,error}=await c.rpc('get_requirement_assignment_acknowledgements',{p_requirement_id:r.serverId});
      if(error)throw error;
      const rows=data||[];
      if(!rows.length){box.innerHTML='';return;}
      box.innerHTML=rows.map(x=>{const ack=x.acknowledgement_status==='Acknowledged';const sent=x.email_sent_at?'Email sent':'Email pending';const time=x.acknowledged_at?new Date(x.acknowledged_at).toLocaleString('en-IN'):'';return `<span title="${esc(time)}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border:1px solid ${ack?'#2d8a67':'#5b6670'};border-radius:999px;background:${ack?'rgba(34,197,139,.10)':'rgba(255,255,255,.04)'};color:${ack?'#8ff0c6':'#b8c5d0'}"><b>${ack?'✓ Acknowledged':'○ Pending acknowledgement'}</b> · ${esc(x.recipient_ref||x.recipient_email||'Recruiter')} · ${esc(sent)}</span>`}).join('');
    }catch(e){console.warn('Requirement acknowledgement status',e?.message||e)}
  }
  document.addEventListener('click',()=>{[120,350,900].forEach(ms=>setTimeout(refresh,ms))},true);
  const dlg=$('requirementDialog');if(dlg)new MutationObserver(()=>{if(dlg.open)setTimeout(refresh,180)}).observe(dlg,{attributes:true,attributeFilter:['open']});
  setInterval(()=>{if($('requirementDialog')?.open)refresh()},15000);
  window.TSSRequirementAcknowledgementUI={refresh};
})();