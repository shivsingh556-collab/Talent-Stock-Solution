const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.TSS_BROWSER_PATH?{executablePath:process.env.TSS_BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('http://interview.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Interview scheduler test</title>'}));
    await page.goto('http://interview.test/');
    await page.evaluate(()=>{
      window.db={candidates:[
        {id:'TSS001',serverId:'candidate-a',name:'Anita Sharma',email:'anita.one@example.com',phone:'9876543210'},
        {id:'TSS002',serverId:'candidate-b',name:'Anita Sharma',email:'anita.two@example.com',phone:'+91 91234 56780'},
        {id:'TSS003',serverId:'candidate-c',name:'José Kumar',email:'jose@example.com',phone:'9000000000'},
        {id:'TSS004',serverId:'candidate-d',name:'<img src=x onerror=alert(1)>',email:'escaped@example.com'}
      ],requirements:[{id:'REQ001',serverId:'requirement-a',title:'Sales Associate',client:'Client One',status:'Active'}],interviews:[]};
      window.writes=[];window.confirm=()=>true;window.alert=message=>window.lastAlert=message;window.toast=()=>{};
      window.TSSInterviewSync={newRequestId:()=> 'request-a',persistItem:async item=>{window.writes.push({...item});item.serverId='interview-a';item.id='interview-a'}};
    });
    await page.addScriptTag({path:path.join(__dirname,'interview-scheduler-ui.js')});
    await page.evaluate(()=>window.TSSInterviewScheduler.open());
    const input=page.locator('#tssIsCandidate'),list=page.locator('#tssIsCandidateOptions'),options=list.locator('[role=option]');
    await input.click();assert.equal(await options.count(),4);
    await input.fill('anita');assert.equal(await options.count(),2);
    assert.match(await list.innerText(),/anita.one@example.com/);assert.match(await list.innerText(),/anita.two@example.com/);
    await options.nth(1).click();assert.equal(await input.inputValue(),'Anita Sharma — anita.two@example.com');
    assert.equal(await input.getAttribute('aria-expanded'),'false');
    await input.click();await input.fill('9123456780');assert.equal(await options.count(),1);
    await input.press('ArrowDown');assert.ok(await input.getAttribute('aria-activedescendant'));
    await input.press('Enter');assert.match(await input.inputValue(),/anita.two/);
    await page.selectOption('#tssIsRequirement','requirement-a');
    await page.locator('#tssIsSubmit').click();
    assert.equal(await page.evaluate(()=>writes.length),1);
    const saved=await page.evaluate(()=>writes[0]);assert.equal(saved.candidateId,'candidate-b');assert.equal(saved.email,'anita.two@example.com');assert.equal(saved.requirementServerId,'requirement-a');
    await page.evaluate(()=>window.TSSInterviewScheduler.open());
    await input.fill('TSS003');await input.press('ArrowDown');await input.press('Enter');assert.match(await input.inputValue(),/José Kumar/);
    await input.fill('nonexistent');assert.equal(await options.count(),0);assert.match(await list.innerText(),/No matching/);
    await page.selectOption('#tssIsRequirement','requirement-a');await page.locator('#tssIsSubmit').click();
    assert.equal(await page.evaluate(()=>writes.length),1,'typing must invalidate the previous saved selection');
    assert.match(await page.evaluate(()=>lastAlert),/select a saved candidate/);
    await input.click();await input.fill('anita.one');await input.press('ArrowDown');await input.press('Enter');
    await input.press('ArrowDown');await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');
    await page.locator('#tssIsRequirement').focus();assert.equal(await input.inputValue(),'Anita Sharma — anita.one@example.com');
    await input.click();await input.fill('escaped');assert.equal(await list.locator('img').count(),0);assert.match(await list.innerText(),/<img src=x/);
    await page.evaluate(()=>{db.candidates=Array.from({length:2000},(_,i)=>({id:'TSS'+i,serverId:'candidate-'+i,name:'Person '+i,email:'person'+i+'@example.com'}));TSSInterviewScheduler.open()});
    await input.click();assert.equal(await options.count(),100,'dropdown DOM stays bounded with a large candidate library');
    await input.fill('person1999@');assert.equal(await options.count(),1);assert.match(await list.innerText(),/Person 1999/);
    await input.press('Tab');assert.equal(await input.getAttribute('aria-expanded'),'false');
    assert.deepEqual(errors,[]);
    console.log('Candidate combobox passed: inline search, contact/ID filtering, duplicate names, exact scheduling ID, stale-selection guard, keyboard, escaping and bounded large lists.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
