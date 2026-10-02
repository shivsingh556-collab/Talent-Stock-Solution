const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const listeners=[];
const fields={candidateName:{value:'',focus(){}},resumeText:{value:'',addEventListener(){}}};
const document={readyState:'complete',scripts:[],getElementById:id=>fields[id]||null,addEventListener:(type,callback)=>listeners.push({type,callback}),head:{appendChild(){}}};
const context={console,Date,document,setTimeout,clearTimeout,URL,toast(){}};context.window=context;
vm.createContext(context);vm.runInContext(fs.readFileSync('extraction-accuracy.js','utf8'),context);
const parser=context.TSSDocumentParser;

test('recovers a real name sharing its resume line with a phone number',()=>{
  const profile=parser.extractResume('ANITA SHARMA 9876543210\nanitasharma@example.com\nSales Executive\nNew Delhi\nSUMMARY');
  assert.equal(profile.name,'Anita Sharma');
  assert.equal(profile.nameSource,'resume-and-email');
  assert.equal(profile.nameConfidence,0.98);
  assert.equal(profile.phone,'9876543210');
});
test('explicit names beat headings, including names with accents and apostrophes',()=>{
  assert.equal(parser.extractResume("PROFILE\nFull Name: José O'Neil | +91 9876543210\njose.oneil@example.com").name,"José O'Neil");
  assert.equal(parser.extractResume('Candidate Name: शिव सिंह\nSales Executive').name,'शिव सिंह');
  assert.equal(parser.candidateNameIssue('A. Kumar'),'');
  assert.equal(parser.candidateNameIssue('Rohit Nagar'),'');
});
test('job titles and headings cannot become names',()=>{
  for(const name of ['Sales Executive','Sales Associate','Business Development Executive','Data Analyst','Curriculum Vitae','Candidate','Professional Experience'])assert.ok(parser.candidateNameIssue(name),name);
  const profile=parser.extractResume('Sales Executive\nanita.sharma23@example.com\nSUMMARY\nSKILLS');
  assert.equal(profile.name,'');
  assert.equal(profile.nameSuggestion,'Anita Sharma');
  assert.ok(profile.warnings.some(x=>x.includes('name needs review')));
});
test('email addresses only provide conservative suggestions, never guessed identities',()=>{
  assert.equal(parser.extractResume('Sales Executive\nanitasharma@example.com').name,'');
  assert.equal(parser.emailNameSuggestion('anitasharma@example.com'),'');
  assert.equal(parser.emailNameSuggestion('sales.team@example.com'),'');
  assert.equal(parser.emailNameSuggestion('hr.office@example.com'),'');
  assert.equal(parser.emailNameSuggestion('anita.sharma+applications@example.com'),'Anita Sharma');
  fields.candidateName.value='';
  parser.applyResume(parser.extractResume('Sales Executive\nanita.sharma@example.com'));
  assert.equal(fields.candidateName.value,'','email suggestion requires recruiter verification');
});
test('screening automatically repairs a title from resume evidence and blocks unresolved names',()=>{
  const click=listeners.find(x=>x.type==='click').callback;
  fields.candidateName.value='Sales Executive';fields.resumeText.value='ANITA SHARMA 9876543210\nanitasharma@example.com\nSales Executive';
  let blocked=false;
  click({target:{closest:()=>true},preventDefault(){blocked=true},stopImmediatePropagation(){blocked=true}});
  assert.equal(fields.candidateName.value,'Anita Sharma');assert.equal(blocked,false);
  fields.candidateName.value='Sales Executive';fields.resumeText.value='Sales Executive\ninfo@example.com';
  click({target:{closest:()=>true},preventDefault(){blocked=true},stopImmediatePropagation(){blocked=true}});
  assert.equal(blocked,true);
});
test('valid recruiter edits survive parser application',()=>{
  fields.candidateName.value='Anita S. Sharma';
  parser.applyResume(parser.extractResume('ANITA SHARMA\nanita.sharma@example.com'));
  assert.equal(fields.candidateName.value,'Anita S. Sharma');
});
test('other scheduling entry points reject a job title before writing an interview',async()=>{
  let writes=0;
  const sandbox={window:{TSSDocumentParser:parser,TSSBackend:{enabled:true,currentUser:async()=>({id:'recruiter'}),client:{from(){writes++;throw Error('Unexpected database write')}}}},db:{candidates:[{id:'candidate-uuid',name:'Sales Executive'}],requirements:[]},console,crypto:require('node:crypto').webcrypto,document:{addEventListener(){}},setTimeout,clearTimeout};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync('interview-sync.js','utf8'),sandbox);
  await assert.rejects(sandbox.window.TSSInterviewSync.persistItem({candidateId:'candidate-uuid',candidate:'Sales Executive'}),/real name/);
  assert.equal(writes,0);
});
