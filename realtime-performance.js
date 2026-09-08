// One authoritative realtime coordinator for TODO AI.
(function(){
  'use strict';
  if(window.__TSS_REALTIME_PERFORMANCE__)return;
  window.__TSS_REALTIME_PERFORMANCE__=true;
  const backend=()=>window.TSSBackend;
  let channel=null,refreshTimer=null,reconnectTimer=null,stateTimer=null,subscribePromise=null;
  let refreshing=false,refreshAgain=false,lastRefresh=0,reconnectAttempt=0,booted=false,channelReady=false;
  let online=navigator.onLine;

  function paintState(state){
    document.documentElement.dataset.tssLive=state;
    const indicator=document.querySelector('#backendIndicator');
    if(indicator)indicator.className='backend-indicator '+(state==='on'?'':'off');
    const label=document.querySelector('#backendIndicator span');
    if(label)label.textContent=state==='on'?'Live updates on':state==='offline'?'Offline · changes saved locally':'Reconnecting…';
  }
  function setState(state){
    clearTimeout(stateTimer);stateTimer=null;
    if(state==='on'||state==='offline'){paintState(state);return}
    // Brief reconnects are normal during auth refreshes and tab wake-up.
    stateTimer=setTimeout(()=>{if(!channelReady&&online)paintState('degraded')},1500);
  }
  function setSyncing(active){
    if(active)document.documentElement.dataset.tssSyncing='true';else delete document.documentElement.dataset.tssSyncing;
    const indicator=document.querySelector('#backendIndicator');
    if(indicator)indicator.setAttribute('aria-busy',active?'true':'false');
  }
  function renderOnce(){
    try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('TODO AI render',e)}
    try{if(typeof renderOldSite==='function')renderOldSite()}catch(e){console.warn('TODO AI legacy render',e)}
    document.dispatchEvent(new CustomEvent('tss:data-rendered'));
  }
  function installSave(){
    if(typeof window.saveDB!=='function'||window.saveDB.__tssCoordinated)return;
    const original=window.saveDB;
    const coordinated=function(){const result=original.apply(this,arguments);queueMicrotask(renderOnce);return result};
    coordinated.__tssCoordinated=true;window.saveDB=coordinated;
  }
  async function refresh(reason='background',force=false){
    if(!online||document.visibilityState==='hidden')return false;
    if(refreshing){refreshAgain=true;return false}
    if(!force&&Date.now()-lastRefresh<1500)return false;
    refreshing=true;setSyncing(true);
    try{
      await window.TSSProduction?.hydrate?.();
      lastRefresh=Date.now();if(channelReady)setState('on');
      console.info('TODO AI sync complete',reason);return true;
    }catch(e){setState('degraded');console.warn('TODO AI sync failed',reason,e?.message||e);return false}
    finally{refreshing=false;setSyncing(false);if(refreshAgain){refreshAgain=false;scheduleRefresh('queued',250,true)}}
  }
  function scheduleRefresh(reason='change',delay=180,force=false){
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(reason,force),delay);
  }
  function scheduleReconnect(){
    if(!online||reconnectTimer)return;
    const delay=Math.min(30000,1000*(2**Math.min(reconnectAttempt++,5)));
    reconnectTimer=setTimeout(()=>{reconnectTimer=null;subscribe()},delay);
  }
  async function removeChannel(){
    if(!channel)return;const current=channel;channel=null;channelReady=false;
    try{await backend()?.client?.removeChannel(current)}catch{}
  }
  async function subscribeOnce(){
    const b=backend();if(!b?.enabled||!b.client||!online)return false;
    const {data:{session}}=await b.client.auth.getSession();if(!session?.user)return false;
    await removeChannel();
    const next=b.client.channel('tss-operational-live-v3');channel=next;channelReady=false;
    ['requirements','candidates','screenings','interviews'].forEach(table=>next.on('postgres_changes',{event:'*',schema:'public',table},()=>scheduleRefresh(table,180,true)));
    next.subscribe((status,error)=>{
      if(channel!==next)return;
      if(status==='SUBSCRIBED'){
        channelReady=true;reconnectAttempt=0;clearTimeout(reconnectTimer);reconnectTimer=null;
        setState('on');scheduleRefresh('reconnected',250,true);
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        channelReady=false;console.warn('TODO AI realtime connection',status,error||'');setState('degraded');scheduleReconnect();
      }
    });
    return true;
  }
  function subscribe(){
    if(subscribePromise)return subscribePromise;
    subscribePromise=subscribeOnce().finally(()=>{subscribePromise=null});
    return subscribePromise;
  }
  function installLifecycle(){
    window.addEventListener('online',()=>{online=true;subscribe()},{passive:true});
    window.addEventListener('offline',()=>{online=false;setState('offline');removeChannel()},{passive:true});
    window.addEventListener('focus',()=>scheduleRefresh('focus',150,false),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleRefresh('visible',150,false)});
    document.addEventListener('tss:data-changed',()=>scheduleRefresh('local-change',250,true));
    window.addEventListener('pagehide',()=>removeChannel(),{once:true});
  }
  function installAuth(){
    backend()?.client?.auth?.onAuthStateChange?.((event,session)=>{
      if(session?.user&&(event==='SIGNED_IN'||event==='INITIAL_SESSION'))setTimeout(()=>{subscribe();scheduleRefresh(event,100,true)},0);
      if(event==='SIGNED_OUT'){removeChannel();setState('offline')}
    });
  }
  async function boot(){
    if(booted)return;booted=true;installSave();installLifecycle();installAuth();
    const connected=await subscribe();
    if(connected)await refresh('startup',true);else setState(online?'degraded':'offline');
    setInterval(()=>{if(document.visibilityState==='visible')scheduleRefresh('fallback',0,false)},120000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,50),{once:true});else setTimeout(boot,50);
  window.TSSRealtimePerformance={boot,subscribe,refresh,backgroundRefresh:refresh,scheduleRefresh,removeChannel};
})();
