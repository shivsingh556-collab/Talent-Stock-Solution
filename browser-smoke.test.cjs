const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const executablePath=process.env.TSS_BROWSER_PATH||undefined;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const page=await browser.newPage();
  const errors=[],failedResponses=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!message.text().startsWith('Failed to load resource:'))errors.push(message.text())});
  page.on('response',response=>{if(response.status()>=400)failedResponses.push(`${response.status()} ${response.url()}`)});
  const baseUrl=process.env.TSS_BASE_URL||'http://127.0.0.1:4173/';
  const response=await page.goto(baseUrl,{waitUntil:'networkidle',timeout:30000});
  assert.equal(response.status(),200);
  assert.ok((await page.locator('body').innerText()).trim().length>100,'page has visible content');
  assert.ok(await page.locator('#loginGate').count(),'login shell renders');
  assert.ok(await page.locator('script[src="evidence-screening.js"]').count(),'screening engine loads');
  const relevantFailures=failedResponses.filter(x=>!x.includes('/favicon.ico'));
  assert.equal(relevantFailures.length,0,`failed responses: ${relevantFailures.join(' | ')}`);
  assert.equal(errors.length,0,`browser errors: ${errors.join(' | ')}`);
  await browser.close();
  console.log('browser smoke test passed');
})().catch(error=>{console.error(error);process.exitCode=1});
