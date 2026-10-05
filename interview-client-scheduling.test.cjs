const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;

function setup({role='admin',isActive=true,duplicates=[]}={}){
  const writes=[];
  const candidateId='22222222-2222-4222-8222-222222222222';
  const requirementId='33333333-3333-4333-8333-333333333333';
  const context={crypto,console,localStorage:{setItem(){}},db:{
    candidates:[{id:candidateId,serverId:candidateId,name:'Test Candidate',email:''}],
    requirements:[{id:'TSS-TEST',serverId:requirementId,title:'Developer',client:'Test Client'}],interviews:[]},
    window:{TSSBackend:{enabled:true,currentUser:async()=>({id:'test-user'}),client:{from(table){
      let payload;
      const builder={select(){return builder},eq(){return builder},in(){return builder},is(){return builder},
        insert(value){payload=value;return builder},
        async maybeSingle(){return {data:{role,is_active:isActive,is_super_admin:false},error:null}},
        async single(){writes.push(payload);return {data:payload,error:null}},
        then(resolve,reject){return Promise.resolve({data:duplicates,error:null}).then(resolve,reject)}};
      return builder;
    }}}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('interview-sync.js','utf8'),context);
  const item=()=>({candidateId,requirementServerId:requirementId,candidate:'Test Candidate',position:'Developer',client:'Test Client',date:'2026-10-10',time:'11:00 AM',schedulingSource:'client',interviewRound:1});
  return {context,writes,item,sync:context.window.TSSInterviewSync};
}

(async()=>{
  let s=setup();const item=s.item();
  await Promise.all([s.sync.persistItem(item),s.sync.persistItem(item)]);
  assert.equal(s.writes.length,1,'double click sends one insert');
  assert.equal(s.writes[0].scheduling_source,'client');
  assert.equal(s.writes[0].candidate_email_snapshot,null,'client records work without a candidate email');
  assert.equal(s.writes[0].reminder_morning_enabled,false);
  assert.equal(s.writes[0].reminder_pre_enabled,false);
  assert.equal(s.writes[0].reminder_status,'Disabled - Client Scheduled');
  assert.equal(s.writes[0].scheduled_at,'2026-10-10T05:30:00.000Z','schedule is IST regardless of browser timezone');
  assert.equal(item.schedulingSource,'client');
  s=setup({role:'recruiter'});
  await s.sync.persistItem(s.item());
  assert.equal(s.writes[0].scheduling_source,'client','recruiters can record a client interview');
  assert.equal(s.writes[0].reminder_status,'Disabled - Client Scheduled');
  s=setup({isActive:false});
  await assert.rejects(()=>s.sync.persistItem(s.item()),/Only active TSS/);
  s=setup({duplicates:[{id:'existing',interview_round:1}]});
  await assert.rejects(()=>s.sync.persistItem(s.item()),/Edit \/ Reschedule/);
  assert.equal(s.writes.length,0);
  const nextRound=s.item();nextRound.interviewRound=2;await s.sync.persistItem(nextRound);
  assert.equal(s.writes[0].interview_round,2);
  s=setup({duplicates:[{id:'legacy',interview_round:null}]});
  await assert.rejects(()=>s.sync.persistItem(s.item()),/already exists/);
  s=setup({role:'recruiter'});const tss=s.item();tss.schedulingSource='tss';tss.email='test@example.com';
  await s.sync.persistItem(tss);
  assert.equal(s.writes[0].scheduling_source,'tss');
  assert.equal(s.writes[0].reminder_morning_enabled,true);
  assert.equal(s.writes[0].reminder_status,'Pending');
  console.log('Client interview tests passed: admin/recruiter authorization, inactive denial, silent records, IST, duplicate rounds, legacy duplicates and rapid-click idempotency.');
})().catch(error=>{console.error(error);process.exitCode=1;});
