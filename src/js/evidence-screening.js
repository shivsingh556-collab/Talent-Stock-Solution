(function installEvidenceScreening(global) {
  'use strict';

  /* Todo AI evidence screening engine v2. Exact names and approved aliases are
     trusted, spelling recovery is conservative, and related technologies are
     never treated as equivalents. */
  const skillGroups = {
    'python':['python'], 'java':['java'], 'javascript':['javascript','java script','js','ecmascript'],
    'typescript':['typescript','type script','ts'], 'c':['c language'], 'c++':['c++','cpp','c plus plus'],
    'c#':['c#','c sharp','csharp'], '.net':['.net','dotnet','dot net'],
    'asp.net':['asp.net','asp net','aspdotnet'], 'asp.net core':['asp.net core','asp net core','aspdotnet core'],
    'php':['php'], 'ruby':['ruby'], 'golang':['golang','go language'], 'kotlin':['kotlin'], 'swift':['swift'],
    'scala':['scala'], 'r':['r language','r programming'],
    'react':['react','react.js','react js','reactjs'], 'react native':['react native','reactnative'],
    'angular':['angular','angular.js','angular js','angularjs'], 'vue.js':['vue','vue.js','vue js','vuejs'],
    'next.js':['next.js','next js','nextjs'], 'node.js':['node.js','node js','nodejs'],
    'express.js':['express.js','express js','expressjs'], 'spring':['spring framework','spring'],
    'spring boot':['spring boot','springboot'], 'hibernate':['hibernate'], 'django':['django'],
    'flask':['flask'], 'fastapi':['fastapi','fast api'], 'laravel':['laravel'],
    'rest api':['rest api','rest apis','restful api','restful apis','restful services','rest web services'],
    'graphql':['graphql','graph ql'], 'microservices':['microservices','micro services','microservice architecture'],
    'html':['html','html5'], 'css':['css','css3'], 'tailwind css':['tailwind','tailwind css','tailwindcss'],
    'bootstrap':['bootstrap'],
    'sql':['sql','structured query language'], 'postgresql':['postgresql','postgres','postgre sql'],
    'mysql':['mysql','my sql'], 'sql server':['sql server','mssql','ms sql','microsoft sql server'],
    'oracle database':['oracle database','oracle db','oracle sql'], 'mongodb':['mongodb','mongo db'],
    'redis':['redis'], 'snowflake':['snowflake'], 'sqlite':['sqlite','sqlite3'], 'cassandra':['cassandra'],
    'elasticsearch':['elasticsearch','elastic search'], 'dynamodb':['dynamodb','dynamo db'],
    'aws':['aws','amazon web services'], 'azure':['azure','microsoft azure'],
    'gcp':['gcp','google cloud','google cloud platform'], 'docker':['docker','containers'],
    'kubernetes':['kubernetes','k8s'], 'terraform':['terraform'], 'ansible':['ansible'],
    'jenkins':['jenkins'], 'ci/cd':['ci/cd','ci cd','cicd','continuous integration','continuous delivery'],
    'linux':['linux','rhel','red hat enterprise linux'], 'git':['git','version control with git'],
    'github':['github'], 'gitlab':['gitlab'], 'jira':['jira'], 'nginx':['nginx'], 'kafka':['kafka','apache kafka'],
    'power bi':['power bi','powerbi','microsoft power bi'], 'tableau':['tableau'],
    'excel':['excel','microsoft excel','ms excel'], 'python pandas':['pandas','python pandas'],
    'numpy':['numpy'], 'scikit-learn':['scikit-learn','scikit learn','sklearn'],
    'tensorflow':['tensorflow','tensor flow'], 'pytorch':['pytorch','py torch'],
    'machine learning':['machine learning','ml'], 'generative ai':['generative ai','gen ai','genai'],
    'artificial intelligence':['artificial intelligence','ai'], 'natural language processing':['natural language processing','nlp'],
    'large language models':['large language models','large language model','llms','llm'],
    'data analysis':['data analysis','data analytics'], 'data engineering':['data engineering'],
    'etl':['etl','extract transform load'], 'spark':['apache spark','spark'], 'hadoop':['apache hadoop','hadoop'],
    'pytest':['pytest','py test'], 'junit':['junit','j unit'],
    'automated testing':['automated testing','test automation','automation testing'],
    'unit testing':['unit testing','unit tests'], 'selenium':['selenium'], 'postman':['postman'],
    'agile':['agile','agile methodology'], 'scrum':['scrum'],
    'salesforce':['salesforce','sales force'], 'crm':['crm','customer relationship management'],
    'sap':['sap'], 'workday':['workday'], 'recruitment':['recruitment','talent acquisition'],
    'b2b sales':['b2b sales','business to business sales'], 'digital marketing':['digital marketing'],
    'seo':['seo','search engine optimization'], 'project management':['project management'],
    'team leadership':['team leadership','team management','people management'],
    'stakeholder management':['stakeholder management'], 'communication':['communication','communication skills']
  };

  const protectedShortSkills = new Set(['c','r','go','js','ts','ai','ml','bi','qa','ui','ux']);
  const negationRe = /\b(?:no|not|without|lack(?:ing|s|ed)?|never)\b.{0,30}$/i;
  const headingRe = /^(?:technical |key |core )?skills?|technologies|tech stack|experience|employment|work history|projects?|summary|profile|education|certifications?|tools?$/i;
  const roleStopWords = new Set(['and','or','the','a','an','for','with','in','of','to','on','at','senior','sr','junior','jr','lead','manager','engineer','developer','executive','specialist','consultant','associate','role','position']);
  const months={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  const monthNames=Object.keys(months).sort((a,b)=>b.length-a.length).join('|');
  const dateRangeRe=new RegExp(`(${monthNames})\\s+(20\\d{2})\\s*[-–—]\\s*(?:(${monthNames})\\s+(20\\d{2})|(present|current|now))`,'gi');

  function normalize(value=''){
    return String(value).normalize('NFKD').toLowerCase()
      .replace(/&/g,' and ').replace(/\bplus\b/g,' plus ')
      .replace(/asp\s*\.\s*net/g,' aspdotnet ').replace(/\.\s*net/g,' dotnet ')
      .replace(/c\s*\+\s*\+/g,' cplusplus ').replace(/c\s*#/g,' csharp ')
      .replace(/([a-z])\.(?=[a-z])/g,'$1')
      .replace(/\//g,' ').replace(/[^a-z0-9+ ]/g,' ').replace(/\s+/g,' ').trim();
  }
  function unique(values){return [...new Set(values.filter(Boolean))]}
  function escapeRe(value=''){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function tokenPattern(value=''){
    const normalized=normalize(value); if(!normalized)return null;
    return new RegExp(`(?:^|\\s)${escapeRe(normalized).replace(/\\ /g,'\\s+')}(?=\\s|$)`,'i');
  }

  const aliasIndex=new Map();
  const canonicalAliases=new Map();
  Object.entries(skillGroups).forEach(([canonical,rawAliases])=>{
    const aliases=unique([canonical,...rawAliases].map(normalize));
    canonicalAliases.set(canonical,aliases);
    aliases.forEach(alias=>{if(!aliasIndex.has(alias))aliasIndex.set(alias,canonical)});
  });
  function canonicalFor(skill){return aliasIndex.get(normalize(skill))||null}
  function aliasesFor(skill){const canonical=canonicalFor(skill);return canonical?canonicalAliases.get(canonical):[normalize(skill)]}
  function meaningfulLines(text=''){
    let section='other';
    return String(text).split(/\r?\n/).map((raw,index)=>{
      const clean=raw.replace(/[•●▪◦]/g,' ').trim(),heading=clean.replace(/[:\-–—]+$/,'').trim();
      if(heading.length<45&&headingRe.test(heading))section=normalize(heading);
      return {raw:clean,normalized:normalize(clean),section,index};
    }).filter(line=>line.normalized);
  }
  function isNegated(line,matchIndex){return negationRe.test(line.slice(Math.max(0,matchIndex-45),matchIndex))}
  function contextType(section,line=''){
    if(/experience|employment|work history/.test(section))return 'experience';
    if(/project/.test(section))return 'project';
    if(/skills|technologies|tech stack|tools/.test(section))return 'skills';
    if(/certification|education/.test(section))return 'education';
    if(/\b(?:built|developed|implemented|managed|led|designed|created|deployed|used|worked)\b/i.test(line))return 'applied';
    return 'mention';
  }
  function exactEvidence(lines,skill){
    const requested=normalize(skill),canonical=canonicalFor(skill),aliases=[...aliasesFor(skill)].sort((a,b)=>b.length-a.length);
    for(const line of lines)for(const alias of aliases){
      const pattern=tokenPattern(alias),match=pattern&&line.normalized.match(pattern);if(!match)continue;
      const position=line.normalized.indexOf(normalize(alias),match.index);if(isNegated(line.normalized,position))continue;
      return {requestedSkill:String(skill).trim(),canonical:canonical||requested,matchedTerm:alias,method:alias===requested?'exact':'alias',confidence:1,evidenceLine:line.raw.slice(0,240),context:contextType(line.section,line.raw)};
    }
    return null;
  }
  function levenshtein(a,b){
    if(a===b)return 0;if(!a.length)return b.length;if(!b.length)return a.length;
    const matrix=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++)matrix[i][0]=i;for(let j=0;j<=b.length;j++)matrix[0][j]=j;
    for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
      matrix[i][j]=Math.min(matrix[i-1][j]+1,matrix[i][j-1]+1,matrix[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])matrix[i][j]=Math.min(matrix[i][j],matrix[i-2][j-2]+1);
    }
    return matrix[a.length][b.length];
  }
  function typoAllowed(target,candidate){
    const a=target.replace(/\s/g,''),b=candidate.replace(/\s/g,'');
    if(a===b||a.length<5||b.length<5||protectedShortSkills.has(a)||protectedShortSkills.has(b)||Math.abs(a.length-b.length)>2)return false;
    const distance=levenshtein(a,b),limit=Math.min(a.length,b.length)>=9?2:1;
    return distance<=limit&&1-distance/Math.max(a.length,b.length)>=0.82;
  }
  function fuzzyEvidence(lines,skill){
    const canonical=canonicalFor(skill),aliases=aliasesFor(skill).filter(x=>x.replace(/\s/g,'').length>=5);
    for(const line of lines){const words=line.normalized.split(' ');for(const alias of aliases){const size=alias.split(' ').length;for(let width=Math.max(1,size-1);width<=size+1;width++)for(let i=0;i<=words.length-width;i++){
      const candidate=words.slice(i,i+width).join(' ');if(!typoAllowed(alias,candidate))continue;
      if(negationRe.test(words.slice(Math.max(0,i-6),i).join(' ')))continue;
      const distance=levenshtein(alias.replace(/\s/g,''),candidate.replace(/\s/g,''));
      const confidence=Number((1-distance/Math.max(alias.replace(/\s/g,'').length,candidate.replace(/\s/g,'').length)).toFixed(2));
      return {requestedSkill:String(skill).trim(),canonical:canonical||normalize(skill),matchedTerm:candidate,method:'fuzzy',confidence,evidenceLine:line.raw.slice(0,240),context:contextType(line.section,line.raw),needsVerification:true};
    }}}
    return null;
  }
  function splitAlternative(skill){return String(skill).split(/\s+(?:or|\/)\s+/i).map(x=>x.trim()).filter(Boolean)}
  function matchRequirement(textOrLines,skill){
    const lines=Array.isArray(textOrLines)?textOrLines:meaningfulLines(textOrLines);
    for(const option of splitAlternative(skill)){const match=exactEvidence(lines,option)||fuzzyEvidence(lines,option);if(match)return {label:option,evidence:match.matchedTerm,...match}}
    return null;
  }
  function mergeMonths(ranges){const merged=[];ranges.sort((a,b)=>a[0]-b[0]).forEach(([start,end])=>{const last=merged.at(-1);if(!last||start>last[1]+1)merged.push([start,end]);else last[1]=Math.max(last[1],end)});return merged.reduce((sum,[start,end])=>sum+end-start+1,0)}
  function experience(text,relevantSkills){
    const matches=[...String(text).matchAll(dateRangeRe)],today=new Date(),all=[],relevant=[];
    matches.forEach((match,index)=>{const start=Number(match[2])*12+months[match[1].toLowerCase()]-1,end=match[5]?today.getFullYear()*12+today.getMonth():Number(match[4])*12+months[match[3].toLowerCase()]-1;if(end<start)return;const range=[start,end];all.push(range);const block=String(text).slice(match.index+match[0].length,matches[index+1]?.index??String(text).length);if(relevantSkills.some(skill=>matchRequirement(block,skill)))relevant.push(range)});
    return {total:all.length?Math.round(mergeMonths(all)/1.2)/10:0,relevant:relevant.length?Math.round(mergeMonths(relevant)/1.2)/10:0};
  }
  function minimumYears(value=''){return parseFloat(String(value).match(/\d+(?:\.\d+)?/)?.[0]||0)}
  function titleScore(requirement,candidate,text){
    const wanted=normalize(requirement.title).split(' ').filter(x=>x.length>2&&!roleStopWords.has(x));if(!wanted.length)return null;
    const candidateRole=normalize(`${candidate.designation||''} ${String(text).slice(0,1200)}`);
    return Math.round(wanted.filter(word=>tokenPattern(word)?.test(candidateRole)).length/wanted.length*100);
  }
  function locationScore(requirement,candidate){
    const wanted=normalize(requirement.location),current=normalize(candidate.location),preferred=normalize(candidate.preferredLocation);if(!wanted)return null;if(/\bremote\b/.test(wanted))return 100;if(!current&&!preferred)return 60;
    const options=wanted.split(/\s+(?:or|and)\s+|,/).map(x=>x.trim()).filter(Boolean);
    return options.some(place=>current.includes(place)||preferred.includes(place)||(current&&place.includes(current))||(preferred&&place.includes(preferred)))?100:35;
  }
  function qualificationScore(requirement,text,candidate){
    const wanted=normalize(requirement.qualification);if(!wanted)return null;const hay=normalize(`${candidate.education||''} ${text}`);
    const options=wanted.split(/\s+(?:or|and)\s+|,/).map(x=>x.trim()).filter(x=>x.length>1);return options.some(option=>hay.includes(option))?100:40;
  }
  function weightedScore(components){const available=components.filter(x=>Number.isFinite(x.value)),weight=available.reduce((sum,x)=>sum+x.weight,0);return weight?Math.round(available.reduce((sum,x)=>sum+x.value*x.weight,0)/weight):0}
  function scoreCap(mandatoryPct,hasMissing,expPct,requiredYears){let cap=100;if(mandatoryPct<40)cap=34;else if(mandatoryPct<60)cap=54;else if(mandatoryPct<80)cap=74;else if(hasMissing)cap=84;if(requiredYears&&expPct<50)cap=Math.min(cap,69);return cap}

  function scoreCandidateEvidence(text,requirement={},candidate={}){
    const required=unique(requirement.skills||[]),preferred=unique(requirement.preferred||[]),lines=meaningfulLines(text);
    const requiredMatches=required.map(skill=>({skill,match:matchRequirement(lines,skill)})),preferredMatches=preferred.map(skill=>({skill,match:matchRequirement(lines,skill)}));
    const matchedRequired=requiredMatches.filter(x=>x.match).map(x=>x.skill),missingRequired=requiredMatches.filter(x=>!x.match).map(x=>x.skill);
    const matchedPreferred=preferredMatches.filter(x=>x.match).map(x=>x.skill),missingPreferred=preferredMatches.filter(x=>!x.match).map(x=>x.skill);
    const matchDetails=[...requiredMatches,...preferredMatches].filter(x=>x.match).map(x=>({skill:x.skill,...x.match}));
    const evidence=Object.fromEntries(matchDetails.map(x=>[x.skill,{term:x.matchedTerm,method:x.method,confidence:x.confidence,line:x.evidenceLine,context:x.context}]));
    const mandatoryPct=required.length?requiredMatches.reduce((sum,x)=>sum+(x.match?.confidence||0),0)/required.length*100:100;
    const prefPct=preferred.length?preferredMatches.reduce((sum,x)=>sum+(x.match?.confidence||0),0)/preferred.length*100:null;
    const parsedYears=experience(text,required),enteredYears=parseFloat(candidate.totalExperience||0)||0,explicitRelevant=parseFloat(candidate.relevantExperience||0)||0,totalYears=parsedYears.total||enteredYears;
    const relevantYears=parsedYears.relevant||explicitRelevant||(enteredYears*(mandatoryPct/100)),requiredYears=minimumYears(requirement.experience);
    const expPct=requiredYears?Math.min(100,relevantYears/requiredYears*100):null,rolePct=titleScore(requirement,candidate,text),locPct=locationScore(requirement,candidate),qualificationPct=qualificationScore(requirement,text,candidate);
    const rawScore=weightedScore([{value:mandatoryPct,weight:50},{value:expPct,weight:20},{value:prefPct,weight:10},{value:rolePct,weight:10},{value:qualificationPct,weight:5},{value:locPct,weight:5}]);
    const cap=scoreCap(mandatoryPct,missingRequired.length>0,expPct,requiredYears),score=Math.max(0,Math.min(100,rawScore,cap)),fuzzyMatches=matchDetails.filter(x=>x.method==='fuzzy').map(x=>x.skill);
    return {score,matched:unique([...matchedRequired,...matchedPreferred]),missing:unique([...missingRequired,...missingPreferred]),prefMatched:matchedPreferred,mandatoryPct:Math.round(mandatoryPct),prefPct:prefPct==null?100:Math.round(prefPct),expPct:expPct==null?100:Math.round(expPct),domainPct:rolePct==null?100:rolePct,locPct:locPct==null?100:locPct,qualificationPct:qualificationPct==null?100:qualificationPct,rolePct:rolePct==null?100:rolePct,totalExperienceYears:totalYears,relevantExperienceYears:Math.min(relevantYears,totalYears||relevantYears),missingRequired,missingPreferred,evidence,matchDetails,fuzzyMatches,rawScore,scoreCap:cap,experienceSource:parsedYears.relevant?'dated-resume':explicitRelevant?'candidate-relevant-field':enteredYears?'coverage-adjusted-total':'not-found',engine:'evidence-v2'};
  }

  global.scoreCandidate=scoreCandidateEvidence;
  global.explain=function evidenceExplanation(screening,candidate,requirement){
    const m=screening.metrics||{},missingRequired=m.missingRequired||screening.missing||[],missingPreferred=m.missingPreferred||[],parts=[`The candidate scores ${screening.score}/100 using normalized skills, verified aliases and resume evidence.`];
    if(Number.isFinite(m.relevantExperienceYears))parts.push(`Relevant experience: ${m.relevantExperienceYears.toFixed(1)} years${requirement.experience?` against ${requirement.experience}`:''}.`);
    if(m.fuzzyMatches?.length)parts.push(`Spelling-tolerant matches requiring recruiter confirmation: ${m.fuzzyMatches.join(', ')}.`);
    if(missingRequired.length)parts.push(`Missing or unconfirmed required skills: ${missingRequired.join(', ')}.`);else parts.push('All identified required skill conditions are satisfied.');
    if(missingPreferred.length)parts.push(`Missing preferred skills: ${missingPreferred.join(', ')}.`);if(m.scoreCap<100)parts.push(`The score was capped at ${m.scoreCap} because of mandatory-skill or experience gaps.`);return parts.join(' ');
  };
  global.tssEvidenceScreening={scoreCandidate:scoreCandidateEvidence,experience,matchRequirement,normalize,canonicalFor,levenshtein,skillGroups};
})(window);
