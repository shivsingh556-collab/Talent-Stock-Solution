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
