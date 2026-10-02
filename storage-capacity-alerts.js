// Admin-only capacity warnings. One cached row, no work on recruiter save paths.
(function(){
  'use strict';
  const id='tssStorageCapacity';
  let inflight=null, lastRead=0;
  const isAdmin=()=>window.TSS_AUTH_CONTEXT?.profile?.is_active===true && window.TSS_AUTH_CONTEXT?.role==='admin' && window.TSS_AUTH_CONTEXT?.email==='info@talent-stock.com';
  function level(percent){return percent>=95?'Critical':percent>=85?'High':percent>=70?'Warning':'Healthy';}
  function metric(bytes,limit){
    const used=Number(bytes), maximum=Number(limit);
    if(!Number.isFinite(used)||used<0||!Number.isFinite(maximum)||maximum<=0)throw new Error('Invalid capacity snapshot');
    const percent=100*used/maximum;
    return {used,maximum,percent,level:level(percent)};
  }
  const mb=bytes=>(bytes/1000000).toFixed(1)+' MB';
  function render(row,error){
    if(!isAdmin()){document.getElementById(id)?.remove();return;}
    const parent=document.querySelector('.main-shell');if(!parent)return;
    let panel=document.getElementById(id);
    if(!panel){panel=document.createElement('aside');panel.id=id;panel.setAttribute('aria-label','Storage capacity');parent.prepend(panel);}
    panel.replaceChildren();
    panel.style.cssText='padding:14px 18px;margin:0 0 16px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#172033;font-size:13px;line-height:1.6;overflow-wrap:anywhere';
    const line=(text,strong=false)=>{const el=document.createElement(strong?'strong':'div');el.textContent=text;panel.appendChild(el);};
    if(error||!row){line('Storage monitoring unavailable',true);line('Usage could not be checked. Review Supabase Usage before assuming there is enough space.');return;}
    try{
      const database=metric(row.database_bytes,row.database_limit_bytes);
      const files=metric(row.storage_bytes,row.storage_limit_bytes);
      const percent=Math.max(database.percent,files.percent);
      const stale=!Number.isFinite(Date.parse(row.checked_at))||Date.now()-Date.parse(row.checked_at)>2*60*60*1000;
      panel.dataset.level=stale?'Stale':level(percent);
      panel.style.borderColor=stale||percent>=70?'#d97706':'#cbd5e1';
      line(stale?'Storage monitoring needs attention':percent>=70?level(percent)+' — Supabase capacity alert':'Supabase capacity',true);
      line('Database: '+mb(database.used)+' / '+mb(database.maximum)+' ('+database.percent.toFixed(1)+'%) — '+database.level);
      line('Files: '+mb(files.used)+' / '+mb(files.maximum)+' ('+files.percent.toFixed(1)+'%) — '+files.level);
      line(String(row.file_count)+' files • '+String(row.plan_label)+' plan • Checked '+new Date(row.checked_at).toLocaleString());
      if(percent>=70)line(percent>=95?'Capacity is nearly exhausted. Arrange an upgrade or backed-up cleanup immediately; new saves or uploads are at risk.':percent>=85?'Capacity is running low. Arrange an upgrade or backed-up cleanup soon.':'Capacity has reached 70%. Review growth and plan space before it fills.');
      if(stale)line('This snapshot is over two hours old or has an invalid timestamp. Check Supabase Usage; current consumption may be higher.');
      line('Warnings: 70%, 85%, 95%. Updated hourly. File usage is a live project estimate; billing usage can differ.');
    }catch{render(null,true);}
  }
  async function refresh(){
    if(!isAdmin()){document.getElementById(id)?.remove();return;}
    if(inflight)return inflight;
    if(Date.now()-lastRead<5*60*1000)return;
    lastRead=Date.now();
    inflight=(async()=>{
      try{
        const query=window.TSSBackend.client.from('storage_usage_snapshot').select('*').eq('id',true);
        const {data,error}=await query.abortSignal(AbortSignal.timeout(8000)).maybeSingle();
        if(error)throw error;
        render(data,false);
      }catch{render(null,true);}
    })().finally(()=>{inflight=null;});
    return inflight;
  }
  window.TSSStorageCapacity=Object.freeze({refresh,level,metric});
  window.addEventListener('tss:auth-ready',()=>{void refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  // Timer reads only the singleton snapshot, at most once per 5 minutes.
  setInterval(()=>{if(!document.hidden)void refresh();},5*60*1000);
})();
