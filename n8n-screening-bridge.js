(function(){
  const cfg=()=>window.TSS_N8N_SCREENING||{};
  async function analyse(payload){
    const c=cfg();
    if(!c.enabled||!c.url)throw new Error('n8n screening bridge is not configured');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),Number(c.timeoutMs)||30000);
    try{
      const res=await fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json',...(c.headers||{})},body:JSON.stringify(payload),signal:controller.signal});
      if(!res.ok)throw new Error(`n8n screening failed (${res.status})`);
      const data=await res.json();
      return data?.output||data;
    }finally{clearTimeout(timeout)}
  }
  window.TSSN8NScreening={analyse,isEnabled:()=>Boolean(cfg().enabled&&cfg().url)};
})();