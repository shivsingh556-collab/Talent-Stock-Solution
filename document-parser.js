(function(){
  let pdfReady=null,mammothReady=null;
  function load(src){return new Promise((resolve,reject)=>{if([...document.scripts].some(s=>s.src===src))return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
  async function parsePDF(file){if(!pdfReady)pdfReady=load('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'});await pdfReady;const data=new Uint8Array(await file.arrayBuffer());const pdf=await window.pdfjsLib.getDocument({data}).promise;let pages=[];for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const c=await p.getTextContent();const items=c.items||[];let line='',lastY=null,lines=[];for(const item of items){const y=Math.round(item.transform?.[5]||0);if(lastY!==null&&Math.abs(y-lastY)>3){if(line.trim())lines.push(line.trim());line=''}line+=(line?' ':'')+(item.str||'');lastY=y}if(line.trim())lines.push(line.trim());pages.push(lines.join('\n'))}return pages.join('\n\n').trim()}
  async function parseDOCX(file){if(!mammothReady)mammothReady=load('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');await mammothReady;const r=await window.mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});return(r.value||'').trim()}
  async function parse(file){const name=file.name.toLowerCase();if(file.type==='text/plain'||name.endsWith('.txt'))return(await file.text()).trim();if(file.type==='application/pdf'||name.endsWith('.pdf'))return parsePDF(file);if(name.endsWith('.docx'))return parseDOCX(file);throw new Error('Please use PDF, DOCX or TXT. Old .DOC files are not supported.')}

  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const linesOf=t=>String(t||'').split(/\r?\n/).map(clean).filter(Boolean);
  const firstMatch=(text,patterns)=>{for(const p of patterns){const m=text.match(p);if(m?.[1])return clean(m[1])}return''};
  const knownSkills=['Java','JavaScript','TypeScript','Python','C#','C++','ASP.NET Core','.NET Core','.NET','Angular','React','React Native','Node.js','Spring Boot','REST API','GraphQL','SQL','SQL Server','MS SQL','MySQL','PostgreSQL','MongoDB','Oracle','AWS','Azure','GCP','Docker','Kubernetes','Git','CI/CD','Jenkins','GitHub Actions','RabbitMQ','Redis','Power BI','Tableau','Excel','Selenium','Playwright','Cypress','Postman','API Testing','Automation Testing','Manual Testing','Regression Testing','Functional Testing','Integration Testing','Performance Testing','JMeter','Appium','PyTorch','TensorFlow','Generative AI','RAG','LangChain','Flutter','Dart','B2B Sales','CRM','Lead Generation','Key Account Management','Stakeholder Management','Team Leadership','Logistics','MIS Reporting'];
  function skillList(text){const low=text.toLowerCase();return [...new Set(knownSkills.filter(s=>low.includes(s.toLowerCase())))];}
  function likelyName(lines){
    const bad=/resume|curriculum|profile|summary|objective|experience|engineer|developer|manager|analyst|email|phone|mobile|contact|linkedin|github/i;
    for(const l of lines.slice(0,8)){const x=l.replace(/[|•·]/g,' ').trim();if(x.length>=3&&x.length<=50&&!bad.test(x)&&!/@/.test(x)&&!/\d{5,}/.test(x)&&/^[A-Za-z][A-Za-z .'-]+$/.test(x)&&x.split(/\s+/).length<=5)return x.replace(/\b\w/g,c=>c.toUpperCase())}
    return'';
  }
  function locationFromText(text,lines){
    let v=firstMatch(text,[/(?:current\s+location|location|based\s+in|address)\s*[:\-]\s*([^\n|]{2,60})/i]);if(v)return v;
    const cities=['Mumbai','Navi Mumbai','Pune','Delhi','New Delhi','Gurgaon','Gurugram','Noida','Bangalore','Bengaluru','Hyderabad','Chennai','Kolkata','Ahmedabad','Dubai','Abu Dhabi','Thane'];
    for(const l of lines.slice(0,12)){const hit=cities.find(c=>new RegExp('\\b'+c.replace(' ','\\s+')+'\\b','i').test(l));if(hit)return hit}
    return'';
  }
  function experienceFromText(text){
    let v=firstMatch(text,[/(?:total\s+experience|overall\s+experience|experience)\s*[:\-]?\s*(\d+(?:\.\d+)?\s*(?:\+)?\s*(?:years?|yrs?))/i,/(\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience)/i]);if(v)return parseFloat(v);
    const m=[...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)\b/gi)].map(x=>Number(x[1])).filter(n=>n>0&&n<50);return m.length?Math.max(...m):'';
  }
  function designationFromText(text,lines){
    let v=firstMatch(text,[/(?:current\s+designation|designation|current\s+role|job\s+title)\s*[:\-]\s*([^\n|]{2,80})/i]);if(v)return v;
    const roles=/\b(Senior|Sr\.?|Lead|Principal|Junior|Jr\.?)?\s*(QA|Quality|Software|Data|Backend|Frontend|Full Stack|Automation|Sales|Business|Service|Database|BI|AI|Flutter|React|Java|\.NET)?\s*(Engineer|Developer|Manager|Analyst|Consultant|Executive|Lead|Administrator|Architect)\b/i;
    for(const l of lines.slice(0,20)){const m=l.match(roles);if(m&&l.length<100)return clean(m[0])}return'';
  }
  function extractResume(text){const lines=linesOf(text),email=firstMatch(text,[/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]),phone=firstMatch(text,[/(?:\+?91[\s-]?)?([6-9]\d{9})\b/,/(?:phone|mobile|contact)\s*[:\-]?\s*([+\d][\d\s()-]{8,18})/i]);return {name:likelyName(lines),email,phone:phone.replace(/\D/g,'').slice(-10),location:locationFromText(text,lines),totalExperience:experienceFromText(text),designation:designationFromText(text,lines),skills:skillList(text),education:firstMatch(text,[/(?:education|qualification|degree)\s*[:\-]\s*([^\n]{2,100})/i]),currentCompany:firstMatch(text,[/(?:current\s+company|company)\s*[:\-]\s*([^\n|]{2,80})/i])}}

  function section(text,names){const joined=names.join('|');const re=new RegExp('(?:^|\\n)\\s*(?:'+joined+')\\s*[:\\-]?\\s*\\n?([\\s\\S]{0,1800}?)(?=\\n\\s*(?:mandatory skills|must have|preferred skills|good to have|experience|qualification|education|location|responsibilities|roles and responsibilities|job responsibilities|requirements|job description|about the role|salary|ctc)\\s*[:\\-]?|$)','i');return clean((text.match(re)||[])[1]||'')}
  function extractJD(text){
    const lines=linesOf(text);const rawSkills=section(text,['mandatory skills','must have skills','required skills','key skills','technical skills']);const pref=section(text,['preferred skills','good to have','nice to have']);
    let skills=rawSkills?rawSkills.split(/[,;|•\n]/).map(clean).filter(x=>x.length>1&&x.length<80):skillList(text);let preferred=pref?pref.split(/[,;|•\n]/).map(clean).filter(x=>x.length>1&&x.length<80):[];
    if(!skills.length)skills=skillList(text);
    const location=firstMatch(text,[/(?:work\s+location|job\s+location|location|based\s+at)\s*[:\-]\s*([^\n|]{2,80})/i]);
    const experience=firstMatch(text,[/(?:experience|required experience|exp)\s*[:\-]?\s*([^\n|]{2,60})/i,/(\d+\s*(?:-|to)\s*\d+\s*years?)/i,/(\d+\+\s*years?)/i]);
    const qualification=firstMatch(text,[/(?:qualification|education|academic qualification)\s*[:\-]\s*([^\n]{2,150})/i]);
    const salary=firstMatch(text,[/(?:salary|ctc|compensation|budget)\s*[:\-]\s*([^\n|]{2,100})/i]);
    const responsibilities=section(text,['roles and responsibilities','job responsibilities','responsibilities','key responsibilities','role and responsibilities'])||section(text,['job description','about the role']);
    const title=firstMatch(text,[/(?:job title|position|role)\s*[:\-]\s*([^\n|]{2,100})/i]);
    return {title,location,experience,qualification,salary,responsibilities,skills:[...new Set(skills)],preferred:[...new Set(preferred)]};
  }
  function setVal(id,val,overwrite=false){const el=document.getElementById(id);if(el&&val!==''&&val!=null&&(overwrite||!el.value))el.value=val}
  function applyResume(data){setVal('candidateName',data.name);setVal('candidateEmail',data.email);setVal('candidatePhone',data.phone);setVal('candidateExp',data.totalExperience);setVal('candidateLocation',data.location);setVal('candidateDesignation',data.designation);window.TSS_PARSED_RESUME=data;}
  function applyJDToDialog(data){setVal('reqTitle',data.title);setVal('reqLocation',data.location,true);setVal('reqExperience',data.experience,true);setVal('reqQualification',data.qualification,true);if(data.skills?.length)setVal('reqSkills',data.skills.join(', '),true);if(data.preferred?.length)setVal('reqPreferred',data.preferred.join(', '),true);if(data.responsibilities)setVal('reqResponsibilities',data.responsibilities,true)}
  function applyJDToRequirement(data,text){const select=document.getElementById('screenRequirement');const r=window.db?.requirements?.find(x=>x.id===select?.value);if(!r)return;r.jdText=text;if(data.location)r.location=data.location;if(data.experience)r.experience=data.experience;if(data.qualification)r.qualification=data.qualification;if(data.salary)r.salaryRange=data.salary;if(data.responsibilities)r.responsibilities=data.responsibilities;if(data.skills?.length)r.skills=data.skills;if(data.preferred?.length)r.preferred=data.preferred;r.aiSuggested=false;try{saveDB()}catch{}try{renderOldSite()}catch{}}

  async function handleResume(file){if(!file)return;try{toast('Reading & extracting resume…');const text=await parse(file);if(!text)throw new Error('No readable text found in resume');const box=document.getElementById('resumeText');if(box)box.value=text;const data=extractResume(text);applyResume(data);const found=[data.name&&'name',data.email&&'email',data.phone&&'phone',data.location&&'location',data.totalExperience&&'experience',data.designation&&'designation'].filter(Boolean);toast(`Resume extracted: ${found.length} profile fields auto-filled`)}catch(e){console.error(e);toast(e.message||'Resume parsing failed')}}
  async function handleJD(file){if(!file)return;try{toast('Reading & extracting JD…');const text=await parse(file);if(!text)throw new Error('No readable text found in JD');const data=extractJD(text);window.TSS_PARSED_JD=data;const dialog=document.getElementById('requirementDialog');const quick=document.getElementById('reqJdText');if(quick&&dialog?.open){quick.value=text;applyJDToDialog(data)}applyJDToRequirement(data,text);toast(`JD extracted: ${data.skills.length} skills + job details detected`)}catch(e){console.error(e);toast(e.message||'JD parsing failed')}}
  function wire(){const resume=document.getElementById('resumeFile');resume?.addEventListener('change',e=>handleResume(e.target.files?.[0]));const quick=document.getElementById('jdQuickFile');quick?.addEventListener('change',e=>handleJD(e.target.files?.[0]));const dialog=document.getElementById('jdFile');dialog?.addEventListener('change',e=>handleJD(e.target.files?.[0]))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();window.TSSDocumentParser={parse,extractResume,extractJD,handleResume,handleJD};
})();