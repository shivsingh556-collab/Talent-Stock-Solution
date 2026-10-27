const assert=require('node:assert/strict');
const fs=require('node:fs');
const {setup}=require('./test-support/browser-fixture.cjs');

(async()=>{
  fs.mkdirSync('test-results',{recursive:true});
  for(const role of ['recruiter','admin'])for(const width of [360,390,768]){
    const flow=await setup(role,width);const {page}=flow;
    try{
      for(const view of ['dashboard','requirements','screening','candidates','interviews']){
        await page.locator(`.nav-item[data-view="${view}"]`).click();
        assert.equal(await page.locator('#'+view).isVisible(),true,`${role} ${width}px ${view} opens`);
        const overflow=await page.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));
        assert.ok(Math.max(overflow.body,overflow.html)<=width+1,`${role} ${width}px ${view} overflow: ${JSON.stringify(overflow)}`);
      }
      await page.locator('#scheduleInterview').click();
      const dialog=page.locator('#tssInterviewSchedulerModal .tss-is-card');
      await dialog.waitFor({state:'visible'});
      const bounds=await dialog.boundingBox();
      await page.screenshot({path:`test-results/${role}-${width}-interview.png`,fullPage:true});
      assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,`${role} ${width}px interview dialog fits`);
      assert.equal(await page.locator('#tssIsCandidate').isVisible(),true);
      assert.equal(await page.locator('#tssIsRequirementSearch').isVisible(),true);
      assert.deepEqual(flow.errors,[],`${role} ${width}px page errors`);
      console.log(`${role} ${width}px: dashboard, requirements, screening, candidates, interviews and scheduling dialog passed`);
    }finally{await flow.close()}
  }
})().catch(error=>{console.error(error);process.exitCode=1});
