const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const executablePath=process.env.TSS_BROWSER_PATH||undefined;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(process.env.TSS_BASE_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:30000});
  await page.waitForFunction(()=>window.TSSRoleAccessVisibility&&window.TSSInterviewActions);
  await page.evaluate(async()=>{
    db.interviews=[
      {id:'archived-meghal',serverId:'archived-meghal',candidate:'ARCHIVED',date:'2026-09-06',time:'11:00 am',archivedAt:'2026-09-06T12:00:00Z'},
      {id:'mirza-farha',serverId:'mirza-farha',candidate:'MIRZA JAFFER BEIG',position:'Key Account Manager',client:'ShipDelight Logistics',date:'2026-09-07',time:'03:00 pm',mode:'Face to Face',status:'Reschedule Requested',candidateResponse:'Reschedule Requested'}
    ];
    const interviewRows=[
      {id:'archived-meghal',created_by:'meghal-user',status:'Scheduled',candidate_response:'Pending'},
      {id:'mirza-farha',created_by:'farha-user',status:'Reschedule Requested',candidate_response:'Reschedule Requested'}
    ];
    const profiles=[
      {id:'admin-user',full_name:'info',email:'info@talent-stock.com',role:'admin'},
      {id:'meghal-user',full_name:'meghal',email:'meghal@talent-stock.com',role:'recruiter'},
      {id:'farha-user',full_name:'farha.khan',email:'farha.khan@talent-stock.com',role:'recruiter'}
    ];
    const query=(table)=>{
      const state={};
      const builder={
        select(){return builder},
        eq(column,value){state.eq={column,value};return builder},
        order(){return Promise.resolve({data:table==='interviews'?interviewRows:profiles,error:null})},
        maybeSingle(){return Promise.resolve({data:profiles.find(row=>row[state.eq?.column]===state.eq?.value)||null,error:null})},
        then(resolve,reject){return Promise.resolve({data:table==='profiles'?profiles:interviewRows,error:null}).then(resolve,reject)}
      };
      return builder;
    };
    window.TSSBackend={enabled:true,currentUser:async()=>({id:'admin-user'}),client:{from:query}};
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
    gotoView('interviews');
    await window.TSSRoleAccessVisibility.boot();
  });
  await page.waitForFunction(()=>document.querySelector('[data-interview-id="mirza-farha"]')?.innerText.includes('Farha Khan'));
  const table=page.locator('[data-tss-stable-interview-table]');
  assert.equal(await table.locator('thead th').count(),10);
  assert.equal(await table.locator('thead th',{hasText:'Scheduled By'}).count(),1);
  const row=table.locator('[data-interview-id="mirza-farha"]');
  assert.equal(await row.locator('td').count(),10);
  assert.match(await row.innerText(),/Farha Khan/);
  assert.doesNotMatch(await row.innerText(),/Meghal/i);
  assert.equal(errors.length,0,errors.join('\n'));
  await browser.close();
  console.log('interview attribution browser test passed');
})().catch(error=>{console.error(error);process.exitCode=1});
