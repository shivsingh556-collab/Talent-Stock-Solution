const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const executablePath=process.env.TSS_BROWSER_PATH||undefined;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.stack||String(error)));
  await page.goto(process.env.TSS_BASE_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:30000});
  await page.waitForFunction(()=>window.TSSInterviewScheduler&&window.TSSInterviewSync&&window.TSSRoleAccessVisibility);
  await page.waitForTimeout(500);
  errors.length=0;
  await page.evaluate(async()=>{
    const candidateId='22222222-2222-4222-8222-222222222222';
    const requirementId='33333333-3333-4333-8333-333333333333';
    const first={id:'first-interview',serverId:'first-interview',candidate:'FIRST CANDIDATE',position:'Key Account Manager',client:'ShipDelight Logistics',date:'2026-09-10',time:'11:00 am',status:'Scheduled'};
    db.interviews=[first];
    db.candidates=[{id:candidateId,serverId:candidateId,name:'SECOND CANDIDATE',email:'second@example.com'}];
    db.requirements=[{id:'TSS-TEST',serverId:requirementId,title:'Key Account Manager',client:'ShipDelight Logistics',status:'Active'}];
    const profiles=[{id:'admin-user',full_name:'Admin User',email:'admin@example.com',role:'admin'}];
    const serverInterviews=[{id:'first-interview',created_by:'admin-user',status:'Scheduled',candidate_response:'Pending'}];
    window.__interviewInsertCalls=0;
    window.__lastInterviewPayload=null;
    const query=table=>{
      const state={};
      const builder={
        select(){return builder},
        eq(column,value){state.eq={column,value};return builder},
        insert(payload){state.payload=payload;if(table==='interviews'){window.__interviewInsertCalls+=1;window.__lastInterviewPayload=payload}return builder},
        async single(){await new Promise(resolve=>setTimeout(resolve,250));return{data:{...state.payload},error:null}},
        async maybeSingle(){return{data:profiles.find(row=>row[state.eq?.column]===state.eq?.value)||null,error:null}},
        async order(){return{data:table==='interviews'?serverInterviews:profiles,error:null}},
        then(resolve,reject){return Promise.resolve({data:table==='profiles'?profiles:serverInterviews,error:null}).then(resolve,reject)}
      };
      return builder;
    };
    window.TSSBackend={enabled:true,currentUser:async()=>({id:'admin-user'}),client:{from:query,auth:{getSession:async()=>({data:{session:{user:{id:'admin-user'}}}})}}};
    window.confirm=()=>true;
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
    gotoView('interviews');
    await window.TSSRoleAccessVisibility.boot();
    window.TSSInterviewScheduler.open();
    document.getElementById('tssIsCandidate').value=candidateId;
    document.getElementById('tssIsRequirement').value=requirementId;
    document.getElementById('tssIsDate').value='2026-09-11';
    document.getElementById('tssIsTime').value='11:00';
    const button=document.getElementById('tssIsSubmit');
    button.click();button.click();button.click();
    setTimeout(()=>window.TSSRoleAccessVisibility.refreshInterviewScope(),50);
  });
  await page.waitForFunction(()=>db.interviews.length===2&&db.interviews[1]?.serverId,{timeout:5000});
  const result=await page.evaluate(()=>({
    insertCalls:window.__interviewInsertCalls,
    count:db.interviews.length,
    second:db.interviews[1],
    payload:window.__lastInterviewPayload,
    modalHidden:document.getElementById('tssInterviewSchedulerModal').classList.contains('hidden'),
    submitDisabled:document.getElementById('tssIsSubmit').disabled
  }));
  assert.equal(result.insertCalls,1,'rapid clicks must create one server request');
  assert.equal(result.count,2,'existing interview plus the new interview must remain visible');
  assert.equal(result.second.candidate,'SECOND CANDIDATE');
  assert.equal(result.second.syncState,'synced');
  assert.equal(result.second.serverId,result.payload.id);
  assert.match(result.payload.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(result.modalHidden,true);
  assert.equal(result.submitDisabled,false);
  assert.equal(errors.length,0,errors.join('\n'));
  await browser.close();
  console.log('interview scheduling browser test passed');
})().catch(error=>{console.error(error);process.exitCode=1});
