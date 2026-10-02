const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('warnings, stale/error states, deduplication and recruiter isolation',async()=>{
 let now=Date.now(), calls=0, error=null;
 const row={database_bytes:100000000,storage_bytes:36000000,database_limit_bytes:500000000,storage_limit_bytes:1000000000,file_count:173,plan_label:'Free',checked_at:new Date(now).toISOString()};
 const nodes=new Map();
 function node(){return {children:[],dataset:{},style:{},setAttribute(){},appendChild(el){this.children.push(el)},prepend(el){nodes.set(el.id,el)},replaceChildren(){this.children=[]},remove(){nodes.delete(this.id)}};}
 const parent=node();
 const document={hidden:false,querySelector:()=>parent,getElementById:id=>nodes.get(id),createElement:node,addEventListener(){}};
 const window={TSS_AUTH_CONTEXT:{role:'admin',profile:{is_active:true}},addEventListener(){},TSSBackend:{client:{from(){calls++;return {select(){return this},eq(){return this},abortSignal(){return this},async maybeSingle(){return {data:row,error}}}}}}};
 class Clock extends Date {constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 vm.runInNewContext(fs.readFileSync(__dirname+'/storage-capacity-alerts.js','utf8'),{window,document,Date:Clock,AbortSignal,setInterval(){}});
 const api=window.TSSStorageCapacity;
 await Promise.all([api.refresh(),api.refresh()]);assert.equal(calls,1);
 const panel=()=>nodes.get('tssStorageCapacity');
 assert.equal(panel().dataset.level,'Healthy');
 for(const [ratio,expected] of [[.6999,'Healthy'],[.7,'Warning'],[.8499,'Warning'],[.85,'High'],[.9499,'High'],[.95,'Critical'],[1.1,'Critical']]){
  now+=300001;row.storage_bytes=1000000000*ratio;row.checked_at=new Date(now).toISOString();await api.refresh();assert.equal(panel().dataset.level,expected);
 }
 assert.equal(nodes.size,1);
 now+=300001;row.checked_at='2020-01-01';await api.refresh();assert.equal(panel().dataset.level,'Stale');
 now+=300001;error={message:'offline'};await api.refresh();assert.match(panel().children[0].textContent,/unavailable/);
 const before=calls;now+=300001;window.TSS_AUTH_CONTEXT={role:'recruiter',profile:{is_active:true}};await api.refresh();assert.equal(calls,before);assert.equal(nodes.size,0);
 now+=300001;window.TSS_AUTH_CONTEXT={role:'admin',profile:{is_active:false}};await api.refresh();assert.equal(calls,before);
});
