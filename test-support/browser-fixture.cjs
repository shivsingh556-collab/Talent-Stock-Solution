const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');

// Only synthetic candidates and an in-memory backend are used. No production writes.
async function setup(role='recruiter',width=390){
  const server=http.createServer((req,res)=>{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
    try{
      const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'text/html';
      res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file));
    }catch{res.writeHead(404);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`;
  const browser=await chromium.launch({headless:true,...(process.env.TSS_BROWSER_PATH?{executablePath:process.env.TSS_BROWSER_PATH}:{})});
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient(){return {}}};'}));
  await page.route('**/backend/supabase-client.js*',route=>route.fulfill({contentType:'application/javascript',body:`(${installBackend.toString()})(${JSON.stringify(role)});`}));
  await page.route('**/api/workspace-shell*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'private/workspace-shell.html'),'utf8')}));
  await page.goto(base,{waitUntil:'networkidle'});
  await page.waitForSelector('#workspace:not(.hidden)');
  await page.waitForFunction(()=>window.TSSProduction&&window.TSSDocumentParser);
  await page.evaluate(()=>TSSProduction.hydrate());
  if(role==='recruiter')await page.waitForSelector('#quickAnalyseBtn');
  return {page,errors,browser,base,close:async()=>{await browser.close();await new Promise(resolve=>server.close(resolve))}};
}
function installBackend(role){
  const profile={id:'test-user',email:'test@talent-stock.com',full_name:'Test Recruiter',role,is_active:true,is_super_admin:role==='admin'};
  const req={id:'req-1',profile_key:'TSS001',tss_id:'TSS001',job_title:'Python Developer',clients:{name:'Test Client'},status:'Work in Progress',mandatory_skills:['Python','SQL'],preferred_skills:[],location:'Mumbai',experience_text:'2 years'};
  window.__test={candidates:[],screenings:[],uploads:[],calls:[],hold:false};
  const query=table=>{
    const filters=[];let operation='',payload;
    const result=()=>{
      if(operation==='insert'){__test.calls.push({table,payload});return {data:payload,error:null}}
      let rows=table==='profiles'?[profile]:table==='requirements'?[req]:table==='candidates'?__test.candidates:table==='screenings'?__test.screenings:[];
      rows=rows.filter(row=>filters.every(([k,v])=>row[k]===v));
      return {data:rows,error:null};
    };
    const q=new Proxy({}, {get(_t,key){
      if(key==='then')return resolve=>resolve(result());
      if(key==='maybeSingle'||key==='single')return async()=>{const r=result();return {...r,data:r.data[0]||null}};
      if(key==='eq')return(k,v)=>{filters.push([k,v]);return q};
      if(key==='insert'||key==='update'||key==='upsert')return value=>{operation=key;payload=value;return q};
      return()=>q;
    }});return q;
  };
  const user={id:profile.id,email:profile.email};
  const channel={on(){return this},subscribe(fn){fn?.('SUBSCRIBED');return this}};
  window.TSSBackend={enabled:true,
    client:{auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic-token'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:query,channel:()=>channel,removeChannel:async()=>{}},
    currentUser:async()=>user,signOut:async()=>{},getActiveRequirements:async()=>[req],syncMasterRequirements:async()=>({}),
    createOrUpdateCandidate:async input=>{
      const snapshot=structuredClone(input);
      if(__test.hold)await new Promise(resolve=>__test.release=resolve);
      const c={...snapshot,id:'person-'+(__test.candidates.length+1),candidate_name:snapshot.name};__test.candidates.push(c);return {candidate:c};
    },
    updateCandidate:async(id,value)=>({id,candidate_name:value.name,...value}),
    saveScreening:async value=>{const s={...value,id:'screen-'+(__test.screenings.length+1)};__test.screenings.push(s);return s},
    uploadResume:async(id,file,hash,text)=>{const r={id:'resume-'+(__test.uploads.length+1),candidate_id:id,original_filename:file.name,storage_path:id+'/'+file.name,mime_type:file.type};__test.uploads.push({...r,text,contents:await file.text()});return r},
    candidateHistory:async()=>[],existingMatches:async()=>[]
  };
}
module.exports={setup};
