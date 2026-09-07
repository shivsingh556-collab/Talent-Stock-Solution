const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const executablePath=process.env.TSS_BROWSER_PATH||undefined;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(process.env.TSS_BASE_URL||'http://127.0.0.1:4173/',{waitUntil:'networkidle',timeout:30000});
  await page.evaluate(()=>{
    db.candidates=[
      {id:'C-JAYESH',name:'JAYESH WAGHELA',email:'',phone:'9867741866',designation:'Executive',location:'Mumbai',totalExperience:'5.6',noticePeriod:'30 days',resumeAvailable:true,resumePath:'user/C-JAYESH/resume.pdf',resumeFilename:'resume.pdf',lastScreenedDate:'2026-09-07T06:21:11.474Z'},
      {id:'C-NO-CV',name:'NO RESUME CANDIDATE',email:'candidate@example.com',phone:'',designation:'Analyst',location:'Pune',totalExperience:'2',resumeAvailable:false}
    ];
    db.screenings=[{candidateId:'C-JAYESH',date:'2026-09-07T06:21:11.474Z',recommendation:'Review Recommended'}];
    renderAll();
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('workspace').classList.remove('hidden');
    gotoView('candidates');
  });

  const rows=page.locator('.candidate-records-table tbody tr');
  await rows.first().waitFor();
  assert.equal(await rows.count(),2);
  assert.equal(await rows.first().locator('.candidate-view-resume').textContent(),'View Resume');
  assert.equal(await rows.first().locator('.candidate-view-resume').isDisabled(),false);
  assert.equal(await rows.nth(1).locator('.candidate-view-resume').textContent(),'Resume Unavailable');
  assert.equal(await rows.nth(1).locator('.candidate-view-resume').isDisabled(),true);

  await rows.first().locator('.candidate-edit').click();
  await page.locator('#candidateEditEmail').fill('jayesh.updated@example.com');
  await page.locator('#saveCandidateBtn').click();
  await page.waitForFunction(()=>!document.getElementById('candidateDialog').open);
  assert.match(await rows.first().locator('.candidate-contact').innerText(),/jayesh\.updated@example\.com/);
  assert.equal(errors.length,0,errors.join('\n'));
  await browser.close();
  console.log('candidate records browser test passed');
})().catch(error=>{console.error(error);process.exitCode=1});
