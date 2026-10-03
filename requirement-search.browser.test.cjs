const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.TSS_BROWSER_PATH?{executablePath:process.env.TSS_BROWSER_PATH}:{})});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('http://requirements.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Requirement search test</title><style>body{margin:12px}.hidden-support{display:none}#outside{margin-top:320px}#background{height:40px;background:#eee}</style><label for="screenRequirement">Requirement</label><select id="screenRequirement"></select><select id="topRequirementSelect" class="hidden-support"></select><button id="outside">Outside</button><div id="background">Background</div><div id="dynamic"></div>'}));
    await page.goto('http://requirements.test/');
    await page.evaluate(()=>{
      window.db={requirements:[
        {id:'TSS116',serverId:'requirement-a',title:'Guidewire Developer',client:'Neosoft',status:'Active'},
        {id:'TSS117',serverId:'requirement-b',title:'Guidewire Developer',client:'Wipro',status:'Work in Progress'},
        {id:'TSS118',serverId:'requirement-c',title:'Développeur Angular',client:'Kyzer Software',status:'Active'},
        {id:'TSS119',serverId:'requirement-d',title:'<img src=x onerror=alert(1)>',client:'Escaped Client',status:'Active'}
      ]};
      const select=document.getElementById('screenRequirement');
      select.add(new Option('Select requirement',''));
      db.requirements.forEach(r=>select.add(new Option(r.title+' — '+r.client,r.id)));
      select.value='TSS116';window.changes=[];
      document.addEventListener('change',event=>changes.push({id:event.target.id,value:event.target.value}));
    });
    await page.addStyleTag({path:path.join(__dirname,'requirement-search.css')});
    await page.addScriptTag({path:path.join(__dirname,'requirement-search.js')});
    const input=page.locator('#screenRequirementSearch'),list=page.locator('#screenRequirementSearchOptions'),options=list.locator('[role=option]');
    assert.equal(await page.locator('label').getAttribute('for'),'screenRequirementSearch');
    assert.equal(await page.locator('#topRequirementSelectSearch').count(),0,'hidden-support selector must not become visible');
    assert.equal(await page.locator('#topRequirementSelect').isVisible(),false);
    await input.click();assert.equal(await options.count(),4);
    await input.fill('guidewire');assert.equal(await options.count(),2);
    await input.fill('neosoft');assert.equal(await options.count(),1);
    await input.fill('TSS 117');assert.equal(await options.count(),1);
    await options.first().tap();
    assert.equal(await page.locator('#screenRequirement').inputValue(),'TSS117');
    assert.match(await input.inputValue(),/Wipro/);
    assert.deepEqual(await page.evaluate(()=>changes),[{id:'screenRequirement',value:'TSS117'}]);
    assert.equal(await input.getAttribute('aria-expanded'),'false');
    await input.click();await input.fill('nonexistent');assert.equal(await options.count(),0);assert.match(await list.innerText(),/No matching/);
    assert.equal(await page.locator('#screenRequirement').inputValue(),'TSS117','typing never changes selected requirement');
    await page.locator('#outside').click();assert.equal(await input.getAttribute('aria-expanded'),'false');assert.match(await input.inputValue(),/Wipro/);
    await input.click();await input.fill('unfinished');await page.locator('#background').click();assert.equal(await input.getAttribute('aria-expanded'),'false');assert.match(await input.inputValue(),/Wipro/);
    await input.click();await input.fill('developpeur');assert.equal(await options.count(),1);
    await input.press('ArrowDown');assert.ok(await input.getAttribute('aria-activedescendant'));
    await input.press('Enter');assert.equal(await page.locator('#screenRequirement').inputValue(),'TSS118');
    await input.click();await input.fill('escaped');assert.equal(await list.locator('img').count(),0);assert.match(await list.innerText(),/<img src=x/);
    await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');assert.match(await input.inputValue(),/Angular/);
    await input.click();await input.press('ArrowUp');assert.ok(await input.getAttribute('aria-activedescendant'));
    await input.press('Tab');assert.equal(await input.getAttribute('aria-expanded'),'false');
    await page.evaluate(()=>{
      const mount=document.getElementById('dynamic');
      for(const id of ['quickRequirement','tssIsRequirement']){
        const select=document.createElement('select');select.id=id;
        db.requirements.forEach(r=>select.add(new Option(r.title+' — '+r.client,id==='tssIsRequirement'?r.serverId:r.id)));
        mount.append(select);
      }
      TSSRequirementSearch.refresh();TSSRequirementSearch.refresh();
    });
    assert.equal(await page.locator('#quickRequirementSearch').count(),1,'refresh must not duplicate controls');
    const interview=page.locator('#tssIsRequirementSearch');
    await interview.click();await interview.fill('TSS116');await interview.press('Enter');
    assert.equal(await page.locator('#tssIsRequirement').inputValue(),'requirement-a','interview keeps exact server ID');
    const quick=page.locator('#quickRequirementSearch');
    await quick.click();await quick.fill('wipro');await quick.press('Enter');
    assert.equal(await page.locator('#quickRequirement').inputValue(),'TSS117','quick screening keeps local ID');
    await page.evaluate(()=>{
      const select=document.getElementById('screenRequirement');
      const disabled=new Option('Disabled requirement','disabled');disabled.disabled=true;
      const hidden=new Option('Hidden requirement','hidden');hidden.hidden=true;
      const group=document.createElement('optgroup');group.disabled=true;group.append(new Option('Disabled group requirement','group-disabled'));
      select.replaceChildren(new Option('Replacement requirement','replacement'),disabled,hidden,group);
    });
    await input.click();assert.equal(await options.count(),1);assert.match(await input.inputValue(),/Replacement/);
    await page.evaluate(()=>document.getElementById('screenRequirement').disabled=true);
    await page.waitForFunction(()=>document.getElementById('screenRequirementSearch').disabled);
    assert.equal(await input.isDisabled(),true);
    await page.evaluate(()=>{
      const select=document.getElementById('screenRequirement');select.disabled=false;
      db.requirements=Array.from({length:2000},(_,i)=>({id:'TSS'+i,title:'Role '+i,client:'Client '+i,status:'Active'}));
      select.replaceChildren(...db.requirements.map(r=>new Option(r.title+' — '+r.client,r.id)));
    });
    await page.waitForFunction(()=>!document.getElementById('screenRequirementSearch').disabled);
    await input.click();assert.equal(await options.count(),100,'large library keeps bounded result DOM');
    await input.fill('Client 1999');assert.equal(await options.count(),1);await input.press('Enter');
    assert.equal(await page.locator('#screenRequirement').inputValue(),'TSS1999');
    assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'mobile fixture has no horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log('Requirement search passed: role/client/ID filtering, preserved local/server values and events, stale search restore, no-match, escaping, keyboard/touch, dynamic selectors, hidden/disabled options, option replacement and bounded 2,000-row mobile list.');
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
