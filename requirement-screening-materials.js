// Client screening guides are reference material, never inputs to resume scoring.
(function(){
  'use strict';
  const $=id=>document.getElementById(id),bucket='requirement-assessments';
  const maxSize=25*1024*1024,maxFiles=10,maxText=200000;
  let entries=[],originalPaths=[],generation=0,pending=0,locked=false;
  const client=()=>window.TSSBackend?.client;
  const requirements=()=>typeof db!=='undefined'?db.requirements||[]:[];
  const find=id=>requirements().find(r=>r.id===id);
  const notice=message=>{if($('reqAssessmentStatus'))$('reqAssessmentStatus').textContent=message};
  const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=label;b.onclick=action;return b};
  function textNode(tag,text){const el=document.createElement(tag);el.textContent=text;return el}
  async function download(item,button){
    button.disabled=true;
    try{
      const {data,error}=await client().storage.from(bucket).download(item.path);
      if(error)throw error;
      const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=item.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){button.after(textNode('p','Download failed: '+error.message))}finally{button.disabled=false}
  }
  function renderReadOnly(container,requirement){
    if(!container)return;
    const section=document.createElement('section');section.className='assessment-guide';
    section.append(textNode('h4','Screening Questions & Assessment'));
    section.append(textNode('small','Client screening guide · review with the candidate separately from resume scoring.'));
    const guide=textNode('div',requirement?.screeningGuide||'No screening instructions added.');guide.className='assessment-text';section.append(guide);
    for(const item of requirement?.screeningMaterials||[]){
      const details=document.createElement('details');details.append(textNode('summary',item.name));
      const preview=textNode('div',item.text||item.message||'Text extraction unavailable. Download the original file.');preview.className='assessment-text';details.append(preview);
      const b=button('Download original',()=>download(item,b));details.append(b);section.append(details);
    }
    container.append(section);
  }
  function paint(){
    const list=$('reqAssessmentFiles');if(!list)return;list.replaceChildren();
    for(const item of entries){
      const card=document.createElement('div');card.className='assessment-file';
      card.append(textNode('strong',item.name),textNode('small',item.message||'Text extracted — review before saving.'));
      const area=document.createElement('textarea');area.rows=4;area.maxLength=maxText;area.value=item.text||'';area.placeholder='Paste or correct the text from this file';area.setAttribute('aria-label','Extracted text for '+item.name);area.disabled=item.busy||locked;
      area.oninput=()=>{item.text=area.value};card.append(area);
      const remove=button('Remove attachment',()=>{if(locked)return;entries=entries.filter(e=>e!==item);paint()});remove.disabled=locked||item.busy;card.append(remove);list.append(card);
    }
  }
  function hydrate(){
    generation++;pending=0;const r=find($('reqId')?.value);
    entries=(r?.screeningMaterials||[]).map(item=>({...item}));originalPaths=entries.map(item=>item.path).filter(Boolean);
    $('reqScreeningGuide').value=r?.screeningGuide||'';notice('');paint();
  }
  async function addFiles(files){
    if(locked)return;
    const token=generation;
    for(const file of files){
      if(token!==generation)return;
      if(entries.length>=maxFiles){notice('Maximum 10 attachments per requirement.');break}
      if(file.size>maxSize){notice(file.name+': exceeds the 25 MB per-file limit.');continue}
      const item={id:crypto.randomUUID(),name:file.name,size:file.size,type:file.type,file,text:'',busy:true,message:'Extracting text…'};
      entries.push(item);pending++;paint();
      try{
        const text=await window.TSSDocumentParser.parseAssessment(file);
        if(text.length>maxText)throw Error('Text exceeds 200,000 characters. Paste the relevant questions manually.');
        item.text=text;item.message=text?'Text extracted — review and edit before saving.':'No readable text found. Original file will be attached; paste the questions manually.';
      }catch(error){item.message='Original file will be attached. '+(error.message||'Text extraction unavailable.')}
      finally{item.busy=false;if(token===generation){pending--;paint()}}
    }
    if(token===generation)$('reqAssessmentUpload').value='';
  }
  function lock(value){
    locked=value;
    const form=$('requirementForm');
    if(value){
      form?.querySelectorAll('input,textarea,select,button').forEach(el=>{if(!el.disabled){el.dataset.assessmentLocked='1';el.disabled=true}});
    }else form?.querySelectorAll('[data-assessment-locked]').forEach(el=>{el.disabled=false;delete el.dataset.assessmentLocked});
    paint();
  }
  async function prepareSave(userId){
    if(pending||locked)throw Error('Wait for screening material processing to finish.');
    const guide=$('reqScreeningGuide')?.value.trim()||'';
    if(guide.length>maxText)throw Error('Screening guide is too long.');
    lock(true);
    let committed=false;
    const uploaded=[],staged=entries.map(item=>({...item}));
    const rollback=async()=>{
      if(committed)return;
      try{if(uploaded.length){const {error}=await client().storage.from(bucket).remove(uploaded);if(error)console.warn('Assessment upload cleanup failed',error.message)}}finally{lock(false)}
    };
    try{
      for(const item of staged){
        if(!item.file)continue;
        // Keep original names in metadata, use opaque paths for any file type.
        item.path=userId+'/'+crypto.randomUUID()+'/'+crypto.randomUUID();
        const {error}=await client().storage.from(bucket).upload(item.path,item.file,{contentType:item.type||'application/octet-stream',upsert:false});
        if(error)throw error;uploaded.push(item.path);
      }
      const materials=staged.map(({id,name,size,type,path,text,message})=>({id,name,size,type,path,text,message}));
      return {payload:{screening_guide:guide,screening_materials:materials},rollback,commit(){
        committed=true;entries=materials;
        const removed=originalPaths.filter(path=>!materials.some(item=>item.path===path));originalPaths=materials.map(item=>item.path);
        if(removed.length)client().storage.from(bucket).remove(removed).then(({error})=>{if(error)console.warn('Removed assessment cleanup failed',error.message)}).catch(error=>console.warn('Removed assessment cleanup failed',error.message));
        lock(false);
      }};
    }catch(error){await rollback();throw error}
  }
  function refreshScreening(){
    const host=$('selectedRequirementSummary');if(!host)return;
    host.querySelectorAll('.assessment-guide').forEach(el=>el.remove());
    renderReadOnly(host,find($('screenRequirement')?.value));
  }
  function boot(){
    const form=$('requirementForm');if(!form||$('reqScreeningGuide'))return;
    const section=document.createElement('section');section.className='assessment-guide';
    section.innerHTML='<h4>Screening Questions & Assessment</h4><p>Add client questions, assessment instructions or an evaluation guide.</p><label for="reqScreeningGuide">Paste screening questions / instructions</label><textarea id="reqScreeningGuide" rows="5" maxlength="200000" placeholder="Questions to ask, assessment steps, evaluation criteria…"></textarea><label for="reqAssessmentUpload">Upload screening / assessment files</label><input id="reqAssessmentUpload" type="file" multiple /><small>Any file type · up to 10 files, 25 MB each. Text extraction: PDF, DOCX, Excel, PPTX, TXT, CSV and common images. Scans use English OCR. Other formats remain downloadable.</small><p id="reqAssessmentStatus" role="status" aria-live="polite"></p><div id="reqAssessmentFiles"></div>';
    form.querySelector('.dialog-actions').before(section);
    $('reqAssessmentUpload').onchange=e=>addFiles(Array.from(e.target.files||[]));
    const dlg=$('requirementDialog');
    new MutationObserver(()=>{if(dlg.open&&!locked)hydrate();else if(!dlg.open&&!locked){generation++;pending=0}}).observe(dlg,{attributes:true,attributeFilter:['open']});
    dlg.addEventListener('cancel',e=>{if(locked)e.preventDefault()});
    form.addEventListener('submit',e=>{if(locked)e.preventDefault()});
    document.addEventListener('tss:data-rendered',refreshScreening);
    window.addEventListener('tss:hydrated',refreshScreening);
    document.addEventListener('change',e=>{if(['screenRequirement','topRequirementSelect'].includes(e.target.id))setTimeout(refreshScreening,0)});
    document.addEventListener('click',e=>{if(e.target.closest('.screen-req,#reqDetailScreen,.nav-item'))setTimeout(refreshScreening,0)});
    // Programmatic selection and existing renderers also replace the summary.
    if($('selectedRequirementSummary'))new MutationObserver(()=>{
      if(!$('selectedRequirementSummary').querySelector('.assessment-guide'))refreshScreening();
    }).observe($('selectedRequirementSummary'),{childList:true});
    refreshScreening();
  }
  window.TSSScreeningMaterials={prepareSave,renderReadOnly,refreshScreening,isBusy:()=>pending>0||locked};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
