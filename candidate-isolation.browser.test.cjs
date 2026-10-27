const assert=require('node:assert/strict');
const {setup}=require('./test-support/browser-fixture.cjs');
const alice='ALICE KUMAR\nalice.kumar@example.com\n9876543210\nPython Developer\nMumbai\n2 years of Python and SQL experience';
const bharat='BHARAT SHAH\nbharat.shah@example.com\n9876543211\nPython Developer\nMumbai\n3 years of Python and SQL experience';

(async()=>{
  const flow=await setup();const {page}=flow;
  try{
    // Exercise the full authenticated application and capture backend boundaries.
    await page.locator('#quickResumeText').fill(alice);
    await page.evaluate(()=>{__test.hold=true});
    await page.locator('#quickAnalyseBtn').click();
    await page.waitForFunction(()=>typeof __test.release==='function');
    await page.locator('.quick-new-screen').click();
    await page.locator('#quickResumeText').fill(bharat);
    await page.locator('#quickAnalyseBtn').click();
    await page.evaluate(()=>{__test.hold=false;__test.release()});
    await page.waitForFunction(()=>__test.uploads.length===2);
    const state=await page.evaluate(()=>({people:__test.candidates,screens:__test.screenings,uploads:__test.uploads}));
    assert.equal(state.people.length,2);
    for(const [index,name,email,text] of [[0,'Alice Kumar','alice.kumar@example.com',alice],[1,'Bharat Shah','bharat.shah@example.com',bharat]]){
      const person=state.people[index],upload=state.uploads[index];
      assert.equal(person.candidate_name,name);assert.equal(person.email,email);
      assert.equal(state.screens[index].candidate_id,person.id);
      assert.equal(upload.candidate_id,person.id);assert.equal(upload.contents,text);
      assert.equal(upload.text,text);assert.match(upload.original_filename,/-resume-text\.txt$/);
    }

    await page.locator('.quick-new-screen').click();
    await page.locator('.nav-item[data-view="screening"]').click();
    // A deliberately slow first upload must never overwrite a newer upload.
    await page.evaluate(({alice,bharat})=>{
      const input=document.getElementById('resumeFile');
      const set=file=>{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))};
      const first=new File([alice],'alice.txt',{type:'text/plain'});
      first.text=()=>new Promise(resolve=>window.__finishAlice=()=>resolve(alice));
      set(first);set(new File([bharat],'bharat.txt',{type:'text/plain'}));
    },{alice,bharat});
    await page.waitForFunction(()=>document.getElementById('candidateName').value==='Bharat Shah');
    await page.evaluate(()=>__finishAlice());
    assert.equal(await page.locator('#resumeText').inputValue(),bharat);
    assert.equal(await page.locator('#candidateEmail').inputValue(),'bharat.shah@example.com');

    await page.locator('#screenBtn').click();
    await page.waitForFunction(()=>__test.uploads.length===3);
    const original=await page.evaluate(()=>({upload:__test.uploads.at(-1),screen:__test.screenings.at(-1)}));
    assert.equal(original.upload.original_filename,'bharat.txt');
    assert.equal(original.upload.contents,bharat);
    assert.equal(original.upload.candidate_id,original.screen.candidate_id);

    // Failure must clear the previous candidate, rather than screening stale text.
    await page.locator('#resumeFile').setInputFiles({name:'broken.doc',mimeType:'application/msword',buffer:Buffer.from('unreadable')});
    await page.waitForFunction(()=>!TSSDocumentParser.isResumePending());
    assert.equal(await page.locator('#candidateName').inputValue(),'');
    assert.equal(await page.locator('#resumeText').inputValue(),'');
    const count=await page.evaluate(()=>db.screenings.length);
    await page.locator('#screenBtn').click();
    assert.equal(await page.evaluate(()=>db.screenings.length),count);

    // Pasting and resetting invalidate a pending extraction even after it finishes.
    await page.evaluate(alice=>{
      const f=new File([alice],'slow.txt',{type:'text/plain'});
      f.text=()=>new Promise(resolve=>window.__finishSlow=()=>resolve(alice));
      const input=document.getElementById('resumeFile'),dt=new DataTransfer();dt.items.add(f);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    },alice);
    await page.locator('#screenBtn').click();
    assert.equal(await page.evaluate(()=>db.screenings.length),count,'screening is blocked while extraction is pending');
    await page.locator('#resumeText').fill(bharat);
    await page.evaluate(()=>__finishSlow());
    assert.equal(await page.locator('#resumeText').inputValue(),bharat);
    assert.equal(await page.locator('#candidateName').inputValue(),'Bharat Shah');
    assert.equal(await page.locator('#resumeFile').evaluate(el=>el.files.length),0);
    await page.evaluate(()=>TSSQuickScreeningNext.reset());
    assert.equal(await page.locator('#resumeText').inputValue(),'');
    assert.deepEqual(flow.errors,[]);
    console.log('Candidate isolation: A→B while saving, attachment ownership, rapid replacement, extraction failure, text replacement, pending-extraction block and next candidate passed.');
  }finally{await flow.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
