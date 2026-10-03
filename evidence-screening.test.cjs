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

test('matches skill synonyms across technical and business JDs',()=>{
  const cases=[['MS SQL','Microsoft SQL Server (MS SQL)'],['Retrieval-Augmented Generation','RAG'],['Oracle PLSQL','PL/SQL'],['SQL query optimisation','SQL Query Optimization'],['Object oriented programming','OOP'],['user acceptance testing','UAT'],['human resources management system','HRMS'],['admissions counseling','Admission Counselling'],['GW data model','Guidewire Data Model']];
  for(const [resume,skill] of cases){const match=engine.matchRequirement('SKILLS\n'+resume,skill);assert(match,`${resume} must match ${skill}`);assert.strictEqual(match.confidence,1)}
});

test('keeps versions and related technology families distinct',()=>{
  for(const [resume,skill] of [['Angular JS','Angular'],['Angular 1.x','Angular'],['AngularJS','Angular'],['.NET Framework','.NET Core'],['.NET Core','.NET Framework'],['Containers','Docker'],['RHEL','Linux'],['Continuous integration','CI/CD'],['CD pipelines','CI/CD'],['Angular 18','Angular 19+'],['React Native','React']])assert.strictEqual(engine.matchRequirement(resume,skill),null,`${resume} is not equivalent to ${skill}`);
});

test('finds valid evidence after protected or negated mentions on one line',()=>{
  for(const [resume,skill] of [['React Native and React','React'],['PL/SQL and SQL','SQL'],['T-SQL and SQL','SQL'],['No Python experience; later developed Python applications','Python']])assert(engine.matchRequirement(resume,skill),`${skill} must find later valid evidence`);
});

test('preserves compound AND conditions and accepts explicit alternatives',()=>{
  assert.strictEqual(engine.matchRequirement('PLSQL','SQL/PLSQL'),null);
  assert.strictEqual(engine.matchRequirement('SQL','SQL/PLSQL'),null);
  assert(engine.matchRequirement('PL/SQL and SQL','SQL/PLSQL'));
  assert(engine.matchRequirement('Analytical and Communication Skills','Analytical and Communication Skills'));
  assert.strictEqual(engine.matchRequirement('Communication skills','Analytical and Communication Skills'),null);
  assert(engine.matchRequirement('Amazon Web Services','Cloud Platform (AWS / Azure / GCP)'));
});

test('canonicalizes genuine aliases without adding skills or inflating weight',()=>{
  assert.deepStrictEqual([...engine.canonicalizeSkills(['MS SQL','MSSQL','JavaScript','JS','Angular 19+','Unknown domain skill'])],['SQL Server','JavaScript','Angular 19+','Unknown domain skill']);
  const result=engine.scoreCandidate('MSSQL',{skills:['MS SQL','SQL Server','Python'],preferred:['MSSQL','Docker']});
  assert.strictEqual(result.mandatoryPct,50);assert.strictEqual(result.missingRequired.length,1);assert.deepStrictEqual([...result.missingPreferred],['Docker']);
  for(const label of ['HTML','CSS','Tailwind CSS','Generative AI','Azure DevOps','PL/SQL'])assert.strictEqual(engine.canonicalLabel(label),label);
  for(const key of Object.keys(engine.skillGroups))assert.strictEqual(engine.canonicalFor(engine.canonicalLabel(key)),key,key+' recognized display label');
  for(const key of Object.keys(engine.skillGroups))assert.strictEqual(engine.canonicalLabel(engine.canonicalLabel(key)),engine.canonicalLabel(key),key+' stable label');
});
