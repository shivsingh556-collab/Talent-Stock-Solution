const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function setup(){
  const dom=new JSDOM('<dialog id="requirementDialog"><form id="requirementForm"><input id="reqId"><div class="dialog-actions"><button id="save">Save</button></div></form></dialog><select id="screenRequirement"><option>A</option><option>B</option></select><div id="selectedRequirementSummary"></div>',{runScripts:'outside-only',url:'https://todo.test'});
  const w=dom.window,uploads=[],removed=[];w.crypto.randomUUID=require('node:crypto').randomUUID;
  w.db={requirements:[{id:'A',screeningGuide:'Ask about SQL',screeningMaterials:[{id:'old',name:'<script>alert(1)</script>',path:'user/old',text:'<img src=x onerror=alert(1)>'}]},{id:'B'}]};
  w.TSSDocumentParser={parseAssessment:async f=>{if(f.name==='unknown.bin')throw Error('Unsupported format');if(f.name==='slow.txt')await new Promise(resolve=>w.finish=resolve);return 'Client questions for '+f.name}};
  w.TSSBackend={client:{storage:{from:()=>({upload:async(path,file)=>{if(w.fail)throw Error('upload failed');uploads.push(path);return {error:null}},remove:async paths=>{removed.push(...paths);return {error:null}}})}}};
  w.eval(fs.readFileSync('requirement-screening-materials.js','utf8'));await tick();
  async function open(id){w.document.getElementById('requirementDialog').removeAttribute('open');await tick();w.document.getElementById('reqId').value=id;w.document.getElementById('requirementDialog').setAttribute('open','');await tick()}
  function add(names){const input=w.document.getElementById('reqAssessmentUpload');Object.defineProperty(input,'files',{value:names.map(name=>({name,size:20,type:'text/plain'})),configurable:true});input.dispatchEvent(new w.Event('change'))}
  return {w,dom,uploads,removed,open,add};
}
test('screening materials preserve edits, isolate requirements, retain originals, and roll back failed saves',async()=>{
  const s=await setup();const {w}=s;
  try{
    await s.open('A');assert.equal(w.document.getElementById('reqScreeningGuide').value,'Ask about SQL');
    assert.equal(w.document.querySelectorAll('#selectedRequirementSummary img, #selectedRequirementSummary script').length,0);
    s.add(['questions.txt','unknown.bin']);await tick();
    const areas=w.document.querySelectorAll('#reqAssessmentFiles textarea');assert.equal(areas.length,3);areas[1].value='Reviewed question';areas[1].dispatchEvent(new w.Event('input'));
    const save=await w.TSSScreeningMaterials.prepareSave('user');
    assert.equal(save.payload.screening_materials[1].text,'Reviewed question');assert.equal(save.payload.screening_materials[0].path,'user/old');assert.equal(save.payload.screening_materials[2].text,'');assert.equal(s.uploads.length,2);
    await save.rollback();assert.deepEqual(s.removed,s.uploads);assert.equal(w.document.getElementById('reqScreeningGuide').disabled,false);
    await s.open('B');assert.equal(w.document.querySelectorAll('#reqAssessmentFiles textarea').length,0);assert.equal(w.document.getElementById('reqScreeningGuide').value,'');
    s.add(['slow.txt']);await tick();assert.equal(w.TSSScreeningMaterials.isBusy(),true);await assert.rejects(()=>w.TSSScreeningMaterials.prepareSave('user'),/Wait/);
    await s.open('A');w.finish();await tick();assert.equal(w.document.querySelectorAll('#reqAssessmentFiles textarea').length,1,'old extraction must not enter another requirement');
    s.add(['new.txt']);await tick();w.fail=true;await assert.rejects(()=>w.TSSScreeningMaterials.prepareSave('user'),/upload failed/);assert.equal(w.TSSScreeningMaterials.isBusy(),false);
    w.fail=false;const committed=await w.TSSScreeningMaterials.prepareSave('user');committed.commit();const before=s.removed.length;await committed.rollback();assert.equal(s.removed.length,before,'post-commit refresh failure must not delete persisted originals');
    await s.open('A');w.document.querySelector('#reqAssessmentFiles button').click();const cleared=await w.TSSScreeningMaterials.prepareSave('user');assert.equal(cleared.payload.screening_materials.length,0);cleared.commit();await tick();assert.ok(s.removed.includes('user/old'));
  }finally{s.dom.window.close()}
});
