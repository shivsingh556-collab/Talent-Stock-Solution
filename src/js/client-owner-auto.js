// TODO AI client-owner automation. One client -> one owner -> all its requirements.
(function(){
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  let clients=[];
  let loading=false;

  function toastSafe(m){try{toast(m)}catch{console.log(m)}}
  function backend(){return window.TSSBackend?.client||null}

  async function loadClients(force=false){
    if(loading)return clients;
    if(clients.length&&!force)return clients;
    const c=backend();if(!c)return clients;
    loading=true;
    try{
      const {data:{session}}=await c.auth.getSession();if(!session?.user)return clients;
      const {data,error}=await c.from('clients').select('id,name,client_owner').eq('is_active',true).order('name');
      if(error)throw error;
      clients=(data||[]).map(x=>({id:x.id,name:x.name,owner:x.client_owner||''}));
      return clients;
    }catch(e){console.warn('Client owner mapping load failed',e?.message||e);return clients;}
    finally{loading=false;}
  }

  function setOwnerControls(owner){
    if(!owner)return;
    const hidden=$('reqClientOwner');if(hidden)hidden.value=owner;
    const clean=$('reqClientOwnerClean');if(clean&&[...clean.options].some(x=>x.value===owner))clean.value=owner;
  }

  async function applyOwnerForCurrentClient({silent=false}={}){
    const name=$('reqClient')?.value||'';if(!name)return '';
    const list=await loadClients();
    let rec=list.find(x=>norm(x.name)===norm(name));
    if(!rec){
      const c=backend();if(c){
        const {data}=await c.from('clients').select('id,name,client_owner').ilike('name',name).limit(1).maybeSingle();
        if(data){rec={id:data.id,name:data.name,owner:data.client_owner||''};clients.push(rec)}
      }
    }
    if(rec?.owner){
      setOwnerControls(rec.owner);
      if(!silent)toastSafe(`Client Owner auto-filled: ${rec.owner}`);
      return rec.owner;
    }
    return '';
  }

  async function saveClientOwner(owner){
    const name=$('reqClient')?.value||'';if(!name||!owner)return false;
    const c=backend();if(!c)return false;
    try{
      let rec=(await loadClients()).find(x=>norm(x.name)===norm(name));
      if(!rec){
        const q=await c.from('clients').select('id,name,client_owner').ilike('name',name).limit(1).maybeSingle();
        if(q.error)throw q.error;rec=q.data?{id:q.data.id,name:q.data.name,owner:q.data.client_owner||''}:null;
      }
      if(!rec?.id)return false;
      const {error}=await c.from('clients').update({client_owner:owner,updated_at:new Date().toISOString()}).eq('id',rec.id);
      if(error)throw error;
      rec.owner=owner;
      // DB trigger propagates the owner to every requirement for this client.
      await window.TSSRequirementsLiveSync?.syncNow?.();
      setTimeout(()=>window.TSSProduction?.hydrate?.(),120);
      toastSafe(`${owner} set as owner for all ${name} requirements`);
      return true;
    }catch(e){console.error('Client owner propagation failed',e);toastSafe('Client Owner sync failed: '+(e?.message||e));return false;}
  }

  function wire(){
    const client=$('reqClient');
    if(client&&!client.dataset.ownerAuto){
      client.dataset.ownerAuto='1';
      client.addEventListener('change',()=>setTimeout(()=>applyOwnerForCurrentClient(),40));
      client.addEventListener('blur',()=>setTimeout(()=>applyOwnerForCurrentClient({silent:true}),40));
    }
    const clean=$('reqClientOwnerClean');
    if(clean&&!clean.dataset.clientOwnerPropagate){
      clean.dataset.clientOwnerPropagate='1';
      clean.addEventListener('change',()=>saveClientOwner(clean.value));
    }
    if($('requirementDialog')?.open)setTimeout(()=>applyOwnerForCurrentClient({silent:true}),80);
  }

  async function boot(){await loadClients(true);wire();
    const dlg=$('requirementDialog');
    if(dlg&&!dlg.dataset.clientOwnerAutoObserved){
      dlg.dataset.clientOwnerAutoObserved='1';
      new MutationObserver(()=>{if(dlg.open){setTimeout(wire,100);setTimeout(()=>applyOwnerForCurrentClient({silent:true}),180)}}).observe(dlg,{attributes:true,attributeFilter:['open']});
    }
    [700,1500,2600].forEach(ms=>setTimeout(wire,ms));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,950),{once:true});else setTimeout(boot,950);
  window.TSSClientOwnerAuto={loadClients,applyOwnerForCurrentClient,saveClientOwner};
})();
