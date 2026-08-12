// Final requirement master patch from newwwwwwww.xlsx (47 active rows)
(function(){
  if(!window.db||!Array.isArray(db.requirements))return;
  const r={
    id:'TSS048',requirementId:'TSS048',profileKey:'manual-85779992-2912-4d11-8d34-c49fc3b91c84',
    client:'Inter IPartner',title:'Full Stack- Digital Engineer',status:'Active',location:'Remote',
    experience:'6-8 years',salaryRange:'Max ₹1.5 Lakh/month client rate; recruiter budget ₹1 LPM',qualification:'Not provided',industry:'IT',
    skills:['DevOps','Jenkins','CI/CD','JIRA','Java','JavaScript','React.js','.NET','C#','Python','SQL','Git','GitHub','ETL','Agile','Communication','Cyber Security','HTML5','CSS','React Native','Unit Testing','Regression Testing','E2E Testing','Web APIs','Database Systems','Reverse Engineering','Troubleshooting'],
    preferred:['7+ years full-stack engineering','Canada client / EST work-hours exposure','Data pipelines','Mobile and web application development'],
    responsibilities:'Canada-based client contract role. Work time 9am-5pm EST, remote. Develop and use data systems; identify efficient ways to organise, store and analyse data while maintaining security and confidentiality; diagnose corrupted data and coding issues; design web/mobile solutions; analyse and present results; resolve data-integrity gaps; design and maintain data infrastructure and ETL processes; design, build and maintain data pipelines; collaborate across teams. Strong backend experience in Java, Python, .NET, Ruby or SQL; hands-on DevOps/CI/CD/Cyber Security tooling such as Jenkins, JIRA and Confluence; testing and source-control experience; web API integrations; database systems; troubleshooting; Agile/Waterfall practices; Core/Advanced Java and C#; front-end HTML5, CSS, JavaScript, C++, C#, jQuery, ReactJS and React Native; requirements analysis; strong communication and cross-team collaboration.',
    jdText:'Client: Inter IPartner\nSkill: Full Stack- Digital Engineer\nWork Time: 9am-5pm EST\nWork mode: Remote\nJob Type: Contract\nClient: Canada based Client\nExperience: 6-8 years\nRate from client: max ₹1.5 Lakh per month; recruiter budget ₹1 LPM.\n\nKey responsibilities: develop data systems, fix data/coding issues, build web/mobile solutions, analyse and present results, resolve data integrity gaps, maintain ETL/data infrastructure, build data pipelines and collaborate across teams.\n\nRequired experience includes backend Java/Python/.NET/Ruby/SQL; DevOps, Jenkins, CI/CD, JIRA/Confluence and Cyber Security; testing and Git/GitHub; web API integrations; database systems; reverse engineering and troubleshooting; Agile/Waterfall; Core/Advanced Java and C#; HTML5/CSS/JavaScript/C++/C#/jQuery/ReactJS/React Native; requirements analysis and strong communication.',
    aiSuggested:false,skillsSource:'client_confirmed'
  };
  const i=db.requirements.findIndex(x=>(x.profileKey||x.id)===r.profileKey||x.id==='TSS048');if(i>=0)db.requirements[i]={...db.requirements[i],...r};else db.requirements.push(r);
  try{saveDB()}catch{localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db))}
  window.TSS_MASTER_EXPECTED_COUNT=47;
})();