const fs=require('fs'),vm=require('vm'),assert=require('assert'),test=require('node:test');
const context={window:{},Date};vm.createContext(context);vm.runInContext(fs.readFileSync('evidence-screening.js','utf8'),context);
const engine=context.window.tssEvidenceScreening;

test('matches approved aliases and formatting variations',()=>{
  const jd={title:'Full Stack Developer',experience:'3+ years',skills:['Node.js','JavaScript','Power BI','SQL Server','Generative AI','Spring Boot'],preferred:[]};
  const resume='SKILLS\nNodeJS, JS, PowerBI, MSSQL, GenAI, Springboot\nEXPERIENCE\nJan 2022 - Present\nBuilt production applications using NodeJS, JS, MSSQL and Springboot.';
  const result=engine.scoreCandidate(resume,jd,{totalExperience:4.5,designation:'Full Stack Developer'});
  assert.deepStrictEqual([...result.missingRequired],[]);assert.strictEqual(result.mandatoryPct,100);assert.strictEqual(result.engine,'evidence-v2');
  assert(['exact','alias'].includes(result.evidence['Node.js'].method));assert.strictEqual(result.evidence['SQL Server'].term,'mssql');
});

test('recovers conservative spelling mistakes and flags them for verification',()=>{
  const jd={title:'Backend Engineer',skills:['Python','Kubernetes','PostgreSQL'],preferred:[]};
  const resume='TECHNICAL SKILLS\nPyhton, Kubernets, Postgress\nPROJECTS\nBuilt services using Pyhton and Kubernets.';
  const result=engine.scoreCandidate(resume,jd,{designation:'Backend Engineer'});
  assert.deepStrictEqual([...result.missingRequired],[]);assert(result.fuzzyMatches.includes('Python'));assert(result.fuzzyMatches.includes('Kubernetes'));assert(result.mandatoryPct>=80&&result.mandatoryPct<100);
});

test('prevents dangerous substring and related-skill false positives',()=>{
  const resume='JavaScript developer using React, Azure, C++ and NoSQL databases.';
  for(const skill of ['Java','AWS','C','C#','SQL','React Native'])assert.strictEqual(engine.matchRequirement(resume,skill),null,`${skill} must not be inferred from a related or longer term`);
});

test('does not accept negated experience',()=>{
  assert.strictEqual(engine.matchRequirement('No experience with Kubernetes. Strong Docker knowledge.','Kubernetes'),null);assert(engine.matchRequirement('No experience with Kubernetes. Strong Docker knowledge.','Docker'));
});

test('handles alternatives without requiring every option',()=>{const match=engine.matchRequirement('Jan 2022 - Present\nDeveloped APIs using Django.','FastAPI or Django');assert(match);assert.strictEqual(match.label,'Django')});

test('calculates dated relevant experience and keeps evidence details',()=>{
  const jd={title:'Backend Python Developer',experience:'3+ years',location:'Pune',skills:['Python','FastAPI or Django','REST APIs','PostgreSQL','Git','Automated testing'],preferred:['Docker','AWS','Redis']};
  const resume='Asha Mehta | Pune\nJan 2022-Present: Built REST APIs using Python and FastAPI, PostgreSQL, Docker, Git and automated testing with pytest.\nJul 2020-Dec 2021: Maintained Java applications.';
  const result=engine.scoreCandidate(resume,jd,{totalExperience:6.2,location:'Pune',designation:'Python Developer'});
  assert.deepStrictEqual([...result.missingRequired],[]);assert(result.matched.includes('FastAPI or Django'));assert(!result.matched.includes('Django'));assert.deepStrictEqual([...result.missingPreferred],['AWS','Redis']);assert.strictEqual(result.totalExperienceYears,6.3);assert.strictEqual(result.relevantExperienceYears,4.8);assert(result.score>=75);assert(result.evidence['REST APIs'].line.includes('REST APIs'));
});

test('caps scores when mandatory coverage is weak',()=>{
  const jd={title:'Cloud Engineer',experience:'3 years',skills:['AWS','Docker','Kubernetes','Terraform','Linux'],preferred:['Jenkins']};
  const result=engine.scoreCandidate('Cloud engineer with Linux and Docker. 5 years total experience.',jd,{totalExperience:5,designation:'Cloud Engineer'});
  assert.strictEqual(result.missingRequired.length,3);assert(result.score<=54);assert.strictEqual(result.scoreCap,54);
});

test('normalization keeps distinct technology families separate',()=>{
  assert.strictEqual(engine.canonicalFor('Node JS'),'node.js');assert.strictEqual(engine.canonicalFor('node.js'),'node.js');assert.strictEqual(engine.canonicalFor('MSSQL'),'sql server');assert.strictEqual(engine.canonicalFor('C#'),'c#');assert.strictEqual(engine.canonicalFor('.NET'),'.net');
});

test('matches manually added skills even when they are not in the alias catalogue',()=>{
  const jd={title:'Technical Lead',skills:['Hazelcast','Groovy','Fortinet SD-WAN'],preferred:['FinOps']};
  const resume='Technical Lead with hands-on Hazelcast, Groovy and Fortinet SD-WAN. Familiar with FinOps.';
  const result=engine.scoreCandidate(resume,jd,{designation:'Technical Lead'});
  assert.deepStrictEqual([...result.missingRequired],[]);assert.deepStrictEqual([...result.missingPreferred],[]);assert.strictEqual(result.mandatoryPct,100);
});
