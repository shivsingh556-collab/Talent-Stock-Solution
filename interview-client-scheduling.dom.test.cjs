const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require(process.env.TSS_JSDOM_PATH||'jsdom');

async function run(role,superAdmin=false){
  const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://todo.test',runScripts:'outside-only'});
  const w=dom.window;
  w.eval(`var db={candidates:[{id:'candidate-1',name:'Test Candidate',email:''}],requirements:[{id:'TSS-TEST',serverId:'requirement-1',title:'Developer',client:'Test Client',status:'Active'}],interviews:[]};`);
  w.TSS_AUTH_CONTEXT={role,isSuperAdmin:superAdmin};
  const calls=[];
  w.TSSInterviewSync={newRequestId:()=> 'request-1',async persistItem(item){calls.push({...item});item.serverId='saved-1';}};
  const alerts=[];w.alert=msg=>alerts.push(msg);w.confirm=()=>true;
  w.eval(fs.readFileSync('interview-scheduler-ui.js','utf8'));
  w.TSSInterviewScheduler.open();
  const doc=w.document;
  const field=doc.getElementById('tssIsSourceField');
  assert.equal(field.classList.contains('hidden'),!['admin','recruiter'].includes(role));
  const source=doc.getElementById('tssIsSource');source.value='client';source.dispatchEvent(new w.Event('change'));
  const candidate=doc.getElementById('tssIsCandidate');candidate.value='Test';candidate.dispatchEvent(new w.Event('input'));
  doc.querySelector('#tssIsCandidateOptions [role=option]').click();
  doc.getElementById('tssIsRequirement').value='requirement-1';
  doc.getElementById('tssIsDate').value='2026-10-10';
  doc.getElementById('tssIsTime').value='11:00';
  doc.getElementById('tssIsLocation').value='https://meet.example.com/test';
  if(['admin','recruiter'].includes(role)){
    assert.equal(doc.getElementById('tssIsTitle').textContent,'Record Client-Scheduled Interview');
    assert.match(doc.getElementById('tssIsSubmit').textContent,/No Candidate Email/);
    doc.getElementById('tssIsSubmit').click();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,1);
    assert.equal(calls[0].schedulingSource,'client');
    assert.equal(calls[0].locationOrLink,'https://meet.example.com/test');
    assert.equal(calls[0].interviewRound,1);
    assert.equal(alerts.length,0,'record-only flow does not require candidate email');
    assert.equal(w.eval('db.interviews.length'),1);
    assert.equal(doc.getElementById('tssInterviewSchedulerModal').classList.contains('hidden'),true);
  }else{
    assert.equal(source.value,'tss','tampering with a hidden selector does not enable client mode');
    doc.getElementById('tssIsSubmit').click();
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(calls.length,0);
    assert.match(alerts[0],/no email saved/);
  }
  dom.window.close();
}
(async()=>{await run('admin');await run('admin',true);await run('recruiter');await run('unknown');console.log('Client interview DOM tests passed: all-team mode, labels, link, save, no-email candidate and unknown-role denial.');})().catch(e=>{console.error(e);process.exitCode=1});
