const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const listeners={};
const documentListeners={};
const channels=[];
const transitions=[];
let hydrateCalls=0,createdChannels=0,removedChannels=0,labelText='';
const label={
  get textContent(){return labelText},
  set textContent(value){labelText=value;transitions.push(value)}
};
const indicator={attributes:{},setAttribute(name,value){this.attributes[name]=value}};
const client={
  auth:{
    getSession:async()=>({data:{session:{user:{id:'test-user'}}}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  },
  channel(){
    createdChannels++;
    const candidate={handlers:[],callback:null,
      on(_type,filter,handler){this.handlers.push({table:filter.table,handler});return this},
      subscribe(callback){this.callback=callback;setTimeout(()=>callback('SUBSCRIBED'),0);return this}
    };
    channels.push(candidate);return candidate;
  },
  async removeChannel(channel){removedChannels++;setTimeout(()=>channel.callback?.('CLOSED'),0)}
};
const document={
  readyState:'complete',visibilityState:'visible',documentElement:{dataset:{}},
  querySelector(selector){return selector==='#backendIndicator span'?label:selector==='#backendIndicator'?indicator:null},
  addEventListener(name,fn){(documentListeners[name]??=[]).push(fn)},
  dispatchEvent(event){for(const fn of documentListeners[event.type]||[])fn(event)}
};
const context={
  console,document,navigator:{onLine:true},CustomEvent:class{constructor(type){this.type=type}},
  setTimeout,clearTimeout,setInterval:()=>0,queueMicrotask,
  addEventListener(name,fn){(listeners[name]??=[]).push(fn)},
  TSSBackend:{enabled:true,client},TSSProduction:{hydrate:async()=>{hydrateCalls++}},
  renderAll(){},renderOldSite(){}
};
context.window=context;
vm.runInNewContext(fs.readFileSync('realtime-performance.js','utf8'),context);

(async()=>{
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(createdChannels,1,'boot creates one realtime channel');
  assert.equal(labelText,'Live updates on','connected badge is stable');
  assert(!transitions.includes('Syncing…'),'normal hydration is not shown as a connection change');

  const before=hydrateCalls;
  for(const entry of channels.at(-1).handlers)entry.handler({eventType:'UPDATE'});
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(hydrateCalls,before+1,'burst changes coalesce into one refresh');
  assert.equal(labelText,'Live updates on','background refresh leaves connected label unchanged');

  const oldChannel=channels.at(-1);
  await Promise.all([
    context.TSSRealtimePerformance.subscribe(),
    context.TSSRealtimePerformance.subscribe(),
    context.TSSRealtimePerformance.subscribe()
  ]);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(createdChannels,2,'concurrent reconnect requests create one replacement channel');
  assert.equal(removedChannels,1,'old channel is removed before reconnect');
  oldChannel.callback('CLOSED');
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(labelText,'Live updates on','stale close events cannot change the current status');

  const current=channels.at(-1);
  current.callback('CHANNEL_ERROR',new Error('temporary'));
  setTimeout(()=>current.callback('SUBSCRIBED'),50);
  await new Promise(resolve=>setTimeout(resolve,250));
  assert.equal(labelText,'Live updates on','short reconnects do not flicker the badge');
  assert(!transitions.includes('Reconnecting…'),'reconnecting is only displayed for a sustained outage');
  console.log('realtime coordinator test passed');
})().catch(error=>{console.error(error);process.exitCode=1});
