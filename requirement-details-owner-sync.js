// Keep Requirement Details owner display aligned with authoritative requirement data.
(function(){
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();

  function reqByTss(tss){
    if(typeof db==='undefined')return null;
    return (db.requirements||[]).find(r=>(r.requirementId||r.id)===tss)||null;
  }

  async function authoritativeOwner(tss){
    const local=reqByTss(tss);
    if(local?.clientOwner)return local.clientOwner;
    try{
      const c=window.TSSBackend?.client;
      if(!c)return '';
      const {data,error}=await c.from('requirements').select('client_owner').eq('tss_id',tss).limit(1).maybeSingle();
      if(error)throw error;
      if(data?.client_owner && local)local.clientOwner=data.client_owner;
      return data?.client_owner||'';
    }catch(e){console.warn('Requirement detail owner sync',e?.message||e);return local?.clientOwner||'';}
  }

  function findDetailContainer(){
    const candidates=[...document.querySelectorAll('dialog[open],.modal,.dialog,[role="dialog"]')];
    return candidates.find(el=>/REQUIREMENT DETAILS/i.test(el.innerText||''))||null;
  }

  function setOwnerValue(container,owner){
    if(!container||!owner)return false;
    const labels=[...container.querySelectorAll('label,span,small,div,p')].filter(el=>norm(el.textContent)==='Client Owner');
    for(const label of labels){
      const card=label.parentElement;
      if(!card)continue;
      const values=[...card.querySelectorAll('strong,b,p,span,div')].filter(el=>el!==label && !el.contains(label));
      const value=values.find(el=>{
        const t=norm(el.textContent);
        return t && t!=='Client Owner' && (t==='Not assigned'||t==='Not provided'||t.length<80);
      });
      if(value){value.textContent=owner;return true;}
    }
    return false;
  }

  async function patch(){
    const container=findDetailContainer();if(!container)return;
    const m=(container.innerText||'').match(/\bTSS\d{3}\b/i);if(!m)return;
    const tss=m[0].toUpperCase();
    const owner=await authoritativeOwner(tss);
    if(owner)setOwnerValue(container,owner);
  }

  document.addEventListener('click',()=>{[40,140,320,700].forEach(ms=>setTimeout(patch,ms));},true);
  [300,900,1800].forEach(ms=>setTimeout(patch,ms));
  window.TSSRequirementDetailsOwnerSync={patch};
})();