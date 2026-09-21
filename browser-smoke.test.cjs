const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const baseUrl=process.env.TSS_BASE_URL||'http://127.0.0.1:4173/';
let checks=0;
function check(value,message){assert.ok(value,message);checks++;console.log(`✓ ${message}`)}

const signedOutSdk=`
window.supabase={createClient(){return{
  auth:{getUser:async()=>({data:{user:null},error:null}),signInWithPassword:async()=>({data:{},error:null}),signOut:async()=>({error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from(){throw new Error('signed-out page queried application data')}
}}};`;

const signedInBackend=`
(()=>{
  const profile={id:'user-1',full_name:'Test Recruiter',email:'test@talent-stock.com',role:'recruiter',is_active:true,is_super_admin:false};
  const terminal={data:[],error:null};
  function query(){return new Proxy({}, {get(_t,key){if(key==='then')return resolve=>resolve(terminal);if(key==='maybeSingle'||key==='single')return async()=>({data:profile,error:null});return()=>query()}})}
  const channel={on(){return this},subscribe(callback){callback?.('SUBSCRIBED');return this}};
  const authUser={id:'user-1',email:profile.email};
  const client={auth:{getSession:async()=>({data:{session:{user:authUser}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>query(),channel:()=>channel,removeChannel:async()=>{}};
  window.TSSBackend={enabled:true,client,currentUser:async()=>({id:'user-1',email:profile.email}),signIn:async()=>({}),signOut:async()=>{},getActiveRequirements:async()=>[],syncMasterRequirements:async()=>({synced:0,skipped:0}),createOrUpdateCandidate:async()=>({}),updateCandidate:async()=>({}),uploadResume:async()=>({}),saveScreening:async()=>({}),candidateHistory:async()=>[],existingMatches:async()=>[]};
})();`;

(async()=>{
  const executablePath=process.env.TSS_BROWSER_PATH||undefined;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});

  for(const width of [360,390,768]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:signedOutSdk}));
    await page.addInitScript(()=>localStorage.setItem('tss_user_session',JSON.stringify({email:'forged@talent-stock.com',role:'admin',supabase:true})));
    const response=await page.goto(baseUrl,{waitUntil:'networkidle',timeout:30000});
    check(response.status()===200,`${width}px returns HTTP 200`);
    check(await page.locator('#loginGate').isVisible(),`${width}px login gate is visible`);
    check(await page.locator('#workspace').count()===0,`${width}px sends no workspace DOM before authentication`);
    check(await page.locator('select, option').count()===0,`${width}px sends no recruiter options before authentication`);
    const legacy=await page.evaluate(()=>localStorage.getItem('tss_user_session'));
    check(legacy===null,`${width}px forged localStorage session is discarded`);
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));
    check(!resources.some(url=>/(?:app-(?:core|runtime)|evidence-screening)\.js/.test(url)),`${width}px feature bundles are not requested signed out`);
    const mascot=await page.locator('.login-todo-photo').boundingBox();
    const panel=await page.locator('.login-right').boundingBox();
    check(Boolean(mascot&&panel&&mascot.x>=panel.x-1&&mascot.x+mascot.width<=panel.x+panel.width+1&&mascot.y>=panel.y-1&&mascot.y+mascot.height<=panel.y+panel.height+1),`${width}px mascot is fully visible inside its panel`);
    check(await page.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${width}px has no horizontal overflow`);
    check(!(await page.locator('body').innerText()).toLowerCase().includes('private by design'),`${width}px private-design card is absent`);
    check(errors.length===0,`${width}px has no page errors`);
    await page.close();
  }

  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient(){return {}}};'}));
  await page.route('**/backend/supabase-client.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:signedInBackend}));
  const response=await page.goto(baseUrl,{waitUntil:'networkidle',timeout:30000});
  check(response.status()===200,'verified-session fixture returns HTTP 200');
  await page.waitForSelector('#workspace:not(.hidden)',{timeout:15000});
  check(await page.locator('#workspace').isVisible(),'verified session mounts and reveals the workspace');
  check(await page.locator('script[src*="app-core.js"]').count()===1,'core bundle loads exactly once');
  check(await page.locator('script[src*="evidence-screening.js"]').count()===1,'accuracy engine loads exactly once');
  check(await page.locator('script[src*="app-runtime.js"]').count()===1,'runtime bundle loads exactly once');
  check(await page.locator('link[data-tss-runtime]').count()===1,'runtime stylesheet loads exactly once');
  check((await page.locator('#profileName').innerText()).includes('Test Recruiter'),'verified profile identity reaches the workspace');
  check(errors.length===0,`authenticated bootstrap has no page errors: ${errors.join(' | ')}`);
  await page.reload({waitUntil:'networkidle'});
  check(await page.locator('script[src*="app-core.js"]').count()===1,'reload still has one core bundle');
  check(await page.locator('script[src*="evidence-screening.js"]').count()===1,'reload still has one accuracy engine');
  check(await page.locator('.login-todo-photo').count()===1,'reload keeps one mascot renderer');

  await browser.close();
  console.log(`browser hardening checks passed (${checks} checks)`);
})().catch(error=>{console.error(error);process.exit(1)});
