const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const listeners={};
const documentListeners={};
let hydrateCalls=0,createdChannels=0,removedChannels=0,currentHandlers=[];
const client={
  auth:{
    getSession:async()=>({data:{session:{user:{id:'test-user'}}}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  },
  channel(){
    createdChannels++;currentHandlers=[];
    return {
      on(_type,filter,handler){currentHandlers.push({table:filter.table,handler});return this},
      subscribe(callback){setTimeout(()=>callback('SUBSCRIBED'),0);return this}
    };
  },
  async removeChannel(){removedChannels++}
};
const document={
  readyState:'complete',visibilityState:'visible',documentElement:{dataset:{}},
  querySelector(){return null},
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
  await new Promise(r=>setTimeout(r,400));
  assert.equal(createdChannels,1,'boot creates one realtime channel');
  const before=hydrateCalls;
  for(const entry of currentHandlers)entry.handler({eventType:'UPDATE'});
  await new Promise(r=>setTimeout(r,350));
  assert.equal(hydrateCalls,before+1,'burst changes coalesce into one refresh');
  await context.TSSRealtimePerformance.subscribe();
  assert.equal(createdChannels,2,'explicit reconnect creates replacement channel');
  assert.equal(removedChannels,1,'old channel is removed before reconnect');
  console.log('realtime coordinator test passed');
})().catch(error=>{console.error(error);process.exitCode=1});
