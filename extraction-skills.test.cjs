const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');

function loadParser(){
  const document={readyState:'complete',scripts:[],getElementById(){return null},addEventListener(){},head:{appendChild(){}}};
  const context={console,Date,document,setTimeout,clearTimeout,URL};context.window=context;
  vm.createContext(context);vm.runInContext(fs.readFileSync('extraction-accuracy.js','utf8'),context);
  return context.TSSDocumentParser;
}
const parser=loadParser();

test('extracts structured skills beyond the built-in catalogue',()=>{
  const jd=parser.extractJD(`Job Title: Technical Lead
Mandatory Skills:
Java, Spring Boot, Hazelcast, Groovy/Grails
Fortinet SD-WAN; BGP, VRRP, LAG
Preferred Skills:
FinOps, Terraform
Experience: 8-12 years`);
  for(const skill of ['Java','Spring Boot','Hazelcast','Groovy','Grails','Fortinet SD-WAN','BGP','VRRP','LAG'])assert(jd.skills.includes(skill),`${skill} should be extracted`);
  assert.deepEqual([...jd.preferred],['FinOps','Terraform']);
});

test('extracts skills from natural-language requirement cues',()=>{
  const jd=parser.extractJD(`Role: Workday Integration Consultant
Candidates must have experience with Workday Studio, EIB, Core Connector and PECI.
Good to have: Workday Prism, Extend.`);
  for(const skill of ['Workday Studio','EIB','Core Connector','PECI'])assert(jd.skills.includes(skill),`${skill} should be extracted automatically`);
  for(const skill of ['Workday Prism','Extend'])assert(jd.preferred.includes(skill),`${skill} should be preferred`);
});

test('resume skill sections retain custom skills as separate items',()=>{
  const resume=parser.extractResume(`ANITA SHARMA
SKILLS
Workday Studio, EIB, Core Connector; PECI
EXPERIENCE
Jan 2023 - Present`);
  for(const skill of ['Workday Studio','EIB','Core Connector','PECI'])assert(resume.skills.includes(skill),`${skill} should be extracted from the resume`);
});

test('manual custom skills are preserved by the shared splitter',()=>{
  assert.deepEqual([...parser.splitSkillBlock('Hazelcast, Groovy/Grails, Fortinet SD-WAN')],['Hazelcast','Groovy','Grails','Fortinet SD-WAN']);
});

test('production parser canonicalizes aliases and keeps preferred synonyms separate',()=>{
  const document={readyState:'complete',scripts:[],getElementById(){return null},addEventListener(){},head:{appendChild(){}}};
  const context={console,Date,document,setTimeout,clearTimeout,URL};context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync('evidence-screening.js','utf8'),context);
  vm.runInContext(fs.readFileSync('extraction-accuracy.js','utf8'),context);
  const jd=context.TSSDocumentParser.extractJD('Job Title: Analyst\nMandatory Skills:\nRAG, Retrieval-Augmented Generation\nPreferred Skills:\nMS Excel, Microsoft Excel\nExperience: 3 years');
  assert.deepEqual([...jd.skills],['RAG']);assert.deepEqual([...jd.preferred],['Excel']);
  const resume=context.TSSDocumentParser.extractResume('ANITA SHARMA\nSKILLS\nMS SQL, MSSQL, ReactJS\nEXPERIENCE\nJan 2023 - Present');
  assert(resume.skills.includes('SQL Server'));assert.equal(resume.skills.filter(s=>s==='SQL Server').length,1);assert(resume.skills.includes('React'));
});

test('production JD extraction does not invent related skills or split PL/SQL',()=>{
  const document={readyState:'complete',scripts:[],getElementById(){return null},addEventListener(){},head:{appendChild(){}}},context={console,Date,document,setTimeout,clearTimeout,URL};context.window=context;vm.createContext(context);
  for(const file of ['evidence-screening.js','extraction-accuracy.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  for(const [wording,expected] of [['Angular JS','AngularJS'],['Angular 1.x','AngularJS'],['PL/SQL','PL/SQL'],['React Native','React Native']]){
    const jd=context.TSSDocumentParser.extractJD('Job Title: Developer\nRequired Skills:\n'+wording+'\nExperience: 3 years');
    assert.deepEqual([...jd.skills],[expected],wording+' must remain one genuine skill');
  }
});
