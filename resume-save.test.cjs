const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {File}=require('node:buffer');
const {webcrypto}=require('node:crypto');
function setup({pasted=false}={}){
  const candidate={id:'local-c',name:'Test Person',resumeText:'Test Person\nEmail: test@example.com\nPython engineer with five years experience.'};
  const screening={id:'local-s',candidateId:'local-c',requirementId:'req',score:75};
  const state={uploads:0,screens:0,fail:true,resumes:[],lastFile:null};
  const elements={savingOverlay:{},backendIndicator:{querySelector(){return {}}},resumeFile:{files:pasted?[]:[new File(['original cv'],'original.pdf',{type:'application/pdf'})]},saveScreenedCandidate:{},screeningSaveHint:{}};
  const client={from(table){let payload;let filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},order(){return q},limit(){return q},update(v){payload=v;return q},async maybeSingle(){return {data:table==='resume_versions'?state.resumes.find(r=>(!filters.candidate_id||r.candidate_id===filters.candidate_id)&&r.file_hash===filters.file_hash)||null:null,error:null}},then(resolve){return Promise.resolve({data:payload,error:null}).then(resolve)}};return q}};
  const backend={enabled:true,client,currentUser:async()=>({id:'recruiter'}),createOrUpdateCandidate:async()=>({candidate:{id:'candidate',candidate_name:'Test Person'}}),saveScreening:async()=>{state.screens++;return{id:'screening'}},uploadResume:async(id,file,hash,text)=>{state.uploads++;state.lastFile=file;if(state.fail)throw Error('upload interrupted');const r={id:'resume',candidate_id:id,file_hash:hash,storage_path:'private/path',original_filename:file.name,mime_type:file.type,extracted_text:text};state.resumes.push(r);return r}};
  const ctx={window:{TSSBackend:backend},db:{candidates:[candidate],requirements:[{id:'req',serverId:'requirement'}],screenings:[screening]},document:{readyState:'loading',addEventListener(){},getElementById:id=>elements[id]||null},localStorage:{setItem(){}},crypto:webcrypto,File,setTimeout,clearTimeout,console:{info(){},warn(){},error(){}},toast(){},renderCandidates(){}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('production.js','utf8'),ctx);
  return {api:ctx.window.TSSProduction,state,candidate,screening,elements};
}
(async()=>{
  const flow=setup();
  assert.equal(await flow.api.persistLatestScreening(),false);
  assert.equal(flow.screening.serverId,'screening');
  assert.equal(flow.screening.resumeSavePending,true);
  assert.equal(flow.elements.saveScreenedCandidate.disabled,false);
  flow.state.fail=false;
  assert.equal(await flow.api.persistLatestScreening(),true);
  assert.equal(flow.state.screens,1,'retry must not create another screening');
  assert.equal(flow.candidate.resumePath,'private/path');
  assert.equal(flow.screening.resumeSavePending,false);
  assert.equal(await flow.api.persistLatestScreening(),true);
  assert.equal(flow.state.uploads,2,'saved CV must not upload again');
  const pasted=setup({pasted:true});pasted.state.fail=false;
  assert.equal(await pasted.api.persistLatestScreening(),true);
  assert.match(pasted.state.lastFile.name,/-resume-text\.txt$/);
  assert.equal(await pasted.state.lastFile.text(),pasted.candidate.resumeText);
  console.log('Resume save tests passed: upload failure, safe retry, original file, pasted text and repeat save.');
})().catch(e=>{console.error(e);process.exitCode=1});
