const assert=require('node:assert/strict');
const fs=require('node:fs');
const {setup}=require('./test-support/browser-fixture.cjs');
(async()=>{
  const flow=await setup('admin',390),{page}=flow;
  try{
    await page.evaluate(()=>{
      const req={id:'req-1',profile_key:'TSS001',tss_id:'TSS001',job_title:'Python Developer',clients:{name:'Test Client'},client_id:'client-1',status:'Work In Progress',mandatory_skills:['Python','SQL'],preferred_skills:[],location:'Mumbai',experience_text:'2 years'};
      window.assessmentTest={row:req,files:{},writes:[]};const original=TSSBackend.client.from;
      TSSBackend.client.from=table=>{
        if(!['requirements','clients'].includes(table))return original(table);
        let payload=null;
        const result=()=>{if(payload){Object.assign(req,payload);assessmentTest.writes.push(payload);payload=null}return table==='clients'?{id:'client-1',name:'Test Client'}:req};
        const q=new Proxy({}, {get(_t,key){
          if(key==='then')return resolve=>resolve({data:[result()],error:null});
          if(key==='single'||key==='maybeSingle')return async()=>({data:result(),error:null});
          if(key==='update'||key==='insert')return value=>{payload=value;return q};
          return()=>q;
        }});return q;
      };
      TSSBackend.client.storage={from:()=>({
        upload:async(path,file)=>{assessmentTest.files[path]=await file.text();return {error:null}},
        remove:async paths=>{paths.forEach(path=>delete assessmentTest.files[path]);return {error:null}},
        download:async path=>({data:new Blob([assessmentTest.files[path]]),error:null})
      })};
    });
    await page.locator('.nav-item[data-view="requirements"]').click();
    await page.evaluate(()=>openRequirement('TSS001'));
    await page.locator('#reqScreeningGuide').fill('Ask about SQL joins.\nAssessment: 20 minutes; review with the candidate.');
    await page.locator('#reqAssessmentUpload').setInputFiles([
      {name:'client-questions.txt',mimeType:'text/plain',buffer:Buffer.from('1. Explain a LEFT JOIN.\n2. Explain GROUP BY.')},
      {name:'assessment.custom',mimeType:'application/octet-stream',buffer:Buffer.from('original assessment')}
    ]);
    await page.waitForFunction(()=>!TSSScreeningMaterials.isBusy());
    assert.match(await page.locator('#reqAssessmentFiles').innerText(),/Original file will be attached/);
    await page.locator('#reqAssessmentFiles textarea').first().fill('1. Explain a LEFT JOIN.\n2. Reviewed question.');
    fs.mkdirSync('test-results',{recursive:true});
    await page.screenshot({path:'test-results/assessment-mobile.png',fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('#saveRequirementBtn').click();
    await page.waitForFunction(()=>!document.getElementById('requirementDialog').open);
    const stored=await page.evaluate(()=>assessmentTest);
    assert.equal(stored.row.screening_materials.length,2);assert.match(stored.row.screening_materials[0].text,/Reviewed question/);assert.equal(stored.files[stored.row.screening_materials[0].path],'1. Explain a LEFT JOIN.\n2. Explain GROUP BY.');
    await page.evaluate(()=>openRequirement('TSS001'));
    await page.waitForFunction(()=>document.querySelectorAll('#reqAssessmentFiles textarea').length===2);
    assert.match(await page.locator('#reqScreeningGuide').inputValue(),/SQL joins/);
    await page.evaluate(()=>document.getElementById('requirementDialog').close());
    await page.evaluate(()=>TSSStableRuntime.openDetails(db.requirements.find(r=>r.id==='TSS001')));
    await page.locator('#reqDetailBody .assessment-guide summary').first().click();
    assert.match(await page.locator('#reqDetailBody .assessment-guide').innerText(),/Reviewed question/);
    const download=page.waitForEvent('download');await page.locator('#reqDetailBody .assessment-guide button').first().click();assert.equal((await download).suggestedFilename(),'client-questions.txt');
    await page.evaluate(()=>document.getElementById('requirementDetailsDialog').close());
    await page.locator('.nav-item[data-view="screening"]').click();
    assert.match(await page.locator('#selectedRequirementSummary .assessment-guide').innerText(),/SQL joins/);
    await page.setViewportSize({width:1280,height:900});
    await page.screenshot({path:'test-results/assessment-screening-desktop.png',fullPage:true});
    assert.deepEqual(flow.errors,[]);
    const cspPage=await flow.browser.newPage();
    try{
      const policy=JSON.parse(fs.readFileSync('vercel.json','utf8')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
      await cspPage.route('http://assessment-csp.test/',route=>route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':policy},body:'<!doctype html><title>OCR policy test</title>'}));
      await cspPage.goto('http://assessment-csp.test/');
      const result=await cspPage.evaluate(async()=>{
        const worker=new Worker(URL.createObjectURL(new Blob(["WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0])).then(()=>postMessage('ok')).catch(e=>postMessage(e.message))"],{type:'application/javascript'})));
        const wasm=await new Promise((resolve,reject)=>{worker.onmessage=e=>resolve(e.data);worker.onerror=reject});worker.terminate();
        let dynamicJS=false;try{eval('1+1');dynamicJS=true}catch{}
        return {wasm,dynamicJS};
      });
      assert.deepEqual(result,{wasm:'ok',dynamicJS:false},'OCR workers may compile WebAssembly while arbitrary JS eval remains blocked');
    }finally{await cspPage.close()}
    console.log('Assessment browser flow passed: real text extraction, unsupported-file retention, edit, save, reload, original download, requirement details and mobile layout.');
  }finally{await flow.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
