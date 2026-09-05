(function installEvidenceScreening(global) {
  'use strict';

  const aliases = {
    'python':['python'],'java':['java'],'javascript':['javascript','js'],'typescript':['typescript'],
    'c#':['c#','.net'],'c++':['c++'],'fastapi':['fastapi'],'django':['django'],'flask':['flask'],
    'react':['react','react.js','reactjs'],'angular':['angular'],'node.js':['node.js','nodejs'],
    'rest api':['rest apis','rest api','restful apis','restful api'],'rest apis':['rest apis','rest api','restful apis','restful api'],
    'postgresql':['postgresql','postgres'],'mysql':['mysql'],'sql':['sql'],'ms sql':['ms sql','sql server','mssql'],
    'sql server':['sql server','ms sql','mssql'],'mongodb':['mongodb','mongo db'],'redis':['redis'],
    'docker':['docker'],'kubernetes':['kubernetes','k8s'],'aws':['aws','amazon web services'],
    'azure':['azure'],'gcp':['gcp','google cloud'],'git':['git','github','gitlab'],
    'automated testing':['automated testing','pytest','junit','unit test','test automation'],
    'unit testing':['unit testing','unit test','pytest','junit','test automation'],
    'linux':['linux'],'ci/cd':['ci/cd','continuous integration','continuous delivery'],
    'power bi':['power bi','powerbi'],'tableau':['tableau'],'excel':['excel','microsoft excel'],
    'asp.net core':['asp.net core','.net core'],'entity framework':['entity framework','ef core']
  };
  const months={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
  const monthNames=Object.keys(months).sort((a,b)=>b.length-a.length).join('|');
  const dateRangeRe=new RegExp(`(${monthNames})\\s+(20\\d{2})\\s*[-–—]\\s*(?:(${monthNames})\\s+(20\\d{2})|(present|current|now))`,'gi');

  function normalize(value=''){return String(value).toLowerCase().replace(/[^a-z0-9+# ]/g,' ').replace(/\s+/g,' ').trim()}
  function skillAliases(skill){const key=normalize(skill);return aliases[key]||[key]}
  function contains(text,term){const hay=` ${normalize(text)} `,needle=normalize(term);return needle.length>1&&hay.includes(` ${needle} `)}
  function evidenceFor(text,skill){return skillAliases(skill).find(term=>contains(text,term))||null}
  function splitAlternative(skill){return String(skill).split(/\s+(?:or|\/)\s+/i).map(x=>x.trim()).filter(Boolean)}
  function matchRequirement(text,skill){const options=splitAlternative(skill);const matchedOption=options.find(option=>evidenceFor(text,option));return matchedOption?{label:matchedOption,evidence:evidenceFor(text,matchedOption)}:null}
  function mergeMonths(ranges){const merged=[];ranges.sort((a,b)=>a[0]-b[0]).forEach(([start,end])=>{const last=merged.at(-1);if(!last||start>last[1]+1)merged.push([start,end]);else last[1]=Math.max(last[1],end)});return merged.reduce((sum,[start,end])=>sum+end-start+1,0)}
  function experience(text,relevantSkills){const matches=[...String(text).matchAll(dateRangeRe)],today=new Date(),all=[],relevant=[];matches.forEach((match,index)=>{const start=Number(match[2])*12+months[match[1].toLowerCase()]-1;const end=match[5]?today.getFullYear()*12+today.getMonth():Number(match[4])*12+months[match[3].toLowerCase()]-1;if(end<start)return;const range=[start,end];all.push(range);const block=String(text).slice(match.index+match[0].length,matches[index+1]?.index??String(text).length);if(relevantSkills.some(skill=>matchRequirement(block,skill)))relevant.push(range)});return {total:all.length?Math.round(mergeMonths(all)/1.2)/10:0,relevant:relevant.length?Math.round(mergeMonths(relevant)/1.2)/10:0}}
  function unique(values){return [...new Set(values)]}

  function scoreCandidateEvidence(text,requirement,candidate={}){
    const required=requirement.skills||[],preferred=requirement.preferred||[];
    const requiredMatches=required.map(skill=>({skill,match:matchRequirement(text,skill)}));
    const preferredMatches=preferred.map(skill=>({skill,match:matchRequirement(text,skill)}));
    const matchedRequired=requiredMatches.filter(x=>x.match).map(x=>x.match.label);
    const missingRequired=requiredMatches.filter(x=>!x.match).map(x=>x.skill);
    const matchedPreferred=preferredMatches.filter(x=>x.match).map(x=>x.match.label);
    const missingPreferred=preferredMatches.filter(x=>!x.match).map(x=>x.skill);
    const evidence=Object.fromEntries([...requiredMatches,...preferredMatches].filter(x=>x.match).map(x=>[x.match.label,x.match.evidence]));
    const years=experience(text,required),enteredYears=parseFloat(candidate.totalExperience||0),totalYears=years.total||enteredYears||0,relevantYears=years.relevant||Math.min(enteredYears,totalYears)||0;
    const reqYears=parseFloat(String(requirement.experience||'').match(/[\d.]+/)?.[0]||0);
    const mandatoryPct=required.length?(matchedRequired.length/required.length*100):100;
    const prefPct=preferred.length?(matchedPreferred.length/preferred.length*100):100;
    const expPct=reqYears?Math.min(100,relevantYears/reqYears*100):100;
    const evidencePct=[...required,...preferred].length?(Object.keys(evidence).length/[...required,...preferred].length*100):100;
    let score=Math.round(mandatoryPct*.55+expPct*.25+prefPct*.10+evidencePct*.10);
    const experienceMet=!reqYears||relevantYears>=reqYears;
    if(missingRequired.length||!experienceMet)score=Math.min(score,69);
    score=Math.max(0,Math.min(100,score));
    return {score,matched:unique([...matchedRequired,...matchedPreferred]),missing:unique([...missingRequired,...missingPreferred]),prefMatched:matchedPreferred,mandatoryPct:Math.round(mandatoryPct),prefPct:Math.round(prefPct),expPct:Math.round(expPct),domainPct:Math.round(evidencePct),locPct:100,totalExperienceYears:totalYears,relevantExperienceYears:Math.min(relevantYears,totalYears),missingRequired,missingPreferred,evidence,engine:'evidence-v1'};
  }

  global.scoreCandidate=scoreCandidateEvidence;
  global.explain=function evidenceExplanation(screening,candidate,requirement){const m=screening.metrics||{},parts=[`The candidate scores ${screening.score}/100 using verified skills and dated experience.`];if(Number.isFinite(m.relevantExperienceYears))parts.push(`Relevant experience: ${m.relevantExperienceYears.toFixed(1)} years${requirement.experience?` against ${requirement.experience}`:''}.`);if(m.missingRequired?.length)parts.push(`Missing required skills: ${m.missingRequired.join(', ')}.`);else parts.push('All identified required skill conditions are satisfied.');if(m.missingPreferred?.length)parts.push(`Missing preferred skills: ${m.missingPreferred.join(', ')}.`);return parts.join(' ')};
  global.tssEvidenceScreening={scoreCandidate:scoreCandidateEvidence,experience,matchRequirement};
})(window);
