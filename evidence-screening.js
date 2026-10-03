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
    'angular':['angular','angular framework'], 'angularjs':['angularjs','angular.js','angular js','angular 1.x'], 'vue.js':['vue','vue.js','vue js','vuejs'],
    'next.js':['next.js','next js','nextjs'], 'node.js':['node.js','node js','nodejs'],
    'express.js':['express.js','express js','expressjs'], 'spring':['spring framework','spring'],
    'spring boot':['spring boot','springboot'], 'hibernate':['hibernate'], 'django':['django'],
    'flask':['flask'], 'fastapi':['fastapi','fast api'], 'laravel':['laravel'],
    'rest api':['rest api','rest apis','restful api','restful apis','restful services','rest web services'],
    'graphql':['graphql','graph ql'], 'microservices':['microservices','micro services','microservice architecture'],
    'html':['html','html5'], 'css':['css','css3'], 'tailwind css':['tailwind','tailwind css','tailwindcss'],
    'bootstrap':['bootstrap'],
    'sql':['sql','structured query language'], 'postgresql':['postgresql','postgres','postgre sql'],
    'mysql':['mysql','my sql'],
    'oracle database':['oracle database','oracle db','oracle sql'], 'mongodb':['mongodb','mongo db'],
    'redis':['redis'], 'snowflake':['snowflake'], 'sqlite':['sqlite','sqlite3'], 'cassandra':['cassandra'],
    'elasticsearch':['elasticsearch','elastic search'], 'dynamodb':['dynamodb','dynamo db'],
    'aws':['aws','amazon web services'], 'azure':['azure','microsoft azure','ms azure'],
    'gcp':['gcp','google cloud','google cloud platform'], 'docker':['docker'],
    'kubernetes':['kubernetes','k8s'], 'terraform':['terraform'], 'ansible':['ansible'],
    'jenkins':['jenkins'], 'ci/cd':['ci/cd','ci cd','cicd','continuous integration and continuous delivery','continuous integration and continuous deployment','ci/cd pipelines'],
    'linux':['linux'], 'rhel':['rhel','red hat enterprise linux','redhat enterprise linux'], 'git':['git','version control with git'],
    'github':['github'], 'gitlab':['gitlab'], 'jira':['jira'], 'kafka':['kafka','apache kafka'],
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
    'team leadership':['team leadership'], 'team management':['team management','people management'],
    'stakeholder management':['stakeholder management'], 'communication':['communication','communication skills'],
    '.net core':['.net core','net core','dotnet core','dot net core'],
    '.net framework':['.net framework','net framework','dotnet framework','dot net framework'],
    'asp.net mvc':['asp.net mvc','asp net mvc','aspdotnet mvc'],
    'asp.net mvc 5':['asp.net mvc 5','asp net mvc 5','mvc 5','aspdotnet mvc 5'],
    'asp.net core mvc':['asp.net core mvc','asp net core mvc','aspdotnet core mvc'],
    'asp.net web api':['asp.net web api','asp net web api','aspdotnet web api'],
    'asp.net web forms':['asp.net web forms','asp.net webforms','aspdotnet web forms','aspdotnet webforms'],
    'web api':['web api','web apis'], 'api':['api','apis','application programming interface','application programming interfaces'],
    'entity framework':['entity framework','ef framework'], 'entity framework core':['entity framework core','entityframework core','ef core','efcore'],
    'linq':['linq','language integrated query'], 'jquery':['jquery','j query'], 'rabbitmq':['rabbitmq','rabbit mq'],
    'azure devops':['azure devops','azure dev ops','ado pipelines'], 'tfs':['tfs','team foundation server'],
    'windows forms':['windows forms','winforms','win forms'], 'wpf':['wpf','windows presentation foundation'],
    'vsto':['vsto','visual studio tools for office'],
    'object-oriented programming':['object oriented programming','object-oriented programming','oop','oops','object oriented design and programming'],
    'sql server':['sql server','mssql','ms sql','ms sql server','microsoft sql server','microsoft sql server (ms sql)'],
    'pl/sql':['pl/sql','plsql','pl sql','oracle pl/sql','oracle plsql','procedural language sql'],
    't-sql':['t-sql','t sql','tsql','transact sql','advanced t-sql'],
    'stored procedures':['stored procedure','stored procedures'],
    'sql query optimization':['sql query optimization','sql query optimisation','sql query tuning','query optimization in sql','query optimisation in sql','sql query performance tuning'],
    'database design and optimization':['database design and optimization','database design and optimisation'],
    'relational databases':['relational databases','relational database','rdbms','relational database management systems'],
    'database migration':['database migration','database migrations','db migration','db migrations'],
    'data modeling':['data modeling','data modelling','data model design'],
    'pyspark':['pyspark','py spark','python spark'], 'databricks':['databricks','data bricks'],
    'ssis':['ssis','sql server integration services'], 'ssrs':['ssrs','sql server reporting services'],
    'mlops':['mlops','ml ops','machine learning operations'],
    'rag':['rag','retrieval augmented generation','retrieval-augmented generation'],
    'agentic ai':['agentic ai','autonomous ai agents','agentic artificial intelligence'],
    'langgraph':['langgraph','lang graph'], 'langchain':['langchain','lang chain'],
    'vector databases':['vector database','vector databases','vector db','vector dbs'],
    'anomaly detection':['anomaly detection','outlier detection'],
    'flutter':['flutter'], 'dart':['dart'], 'groovy':['groovy'], 'grails':['grails'], 'hazelcast':['hazelcast'],
    'manual testing':['manual testing','manual software testing'], 'regression testing':['regression testing','regression tests'],
    'performance testing':['performance testing','performance tests'], 'integration testing':['integration testing','integration tests'],
    'api testing':['api testing','api tests','application programming interface testing'],
    'uat':['uat','user acceptance testing','user acceptance tests'],
    'root cause analysis':['root cause analysis','root-cause analysis','rca'],
    'defect reporting':['defect reporting','bug reporting'], 'defect management':['defect management','bug management'],
    'test case design':['test case design','test case development','testcase design','test cases design'],
    'test execution':['test execution','executing test cases'], 'sdlc':['sdlc','software development life cycle','software development lifecycle'],
    'code reviews':['code reviews','code review','peer code reviews'],
    'bash':['bash','bash scripting','shell/bash'], 'shell scripting':['shell scripting','shell scripts'],
    'active directory':['active directory','microsoft active directory','ms active directory'],
    'group policy':['group policy','group policies','gpo'], 'dns':['dns','domain name system'], 'dhcp':['dhcp','dynamic host configuration protocol'],
    'vmware':['vmware','vm ware'], 'nginx':['nginx','engine x'], 'openshift':['openshift','open shift','red hat openshift'],
    'infrastructure as code':['infrastructure as code','iac'],
    'disaster recovery':['disaster recovery','disaster-recovery','dr planning'],
    'high availability':['high availability','ha architecture'],
    'itil':['itil','information technology infrastructure library'],
    'itsm':['itsm','it service management','information technology service management'],
    'itam':['itam','it asset management','information technology asset management'],
    'incident management':['incident management','incident handling'],
    'service now':['servicenow','service now'], 'sd-wan':['sd-wan','sd wan','software defined wide area network'],
    'wi-fi':['wi-fi','wifi','wi fi','wireless fidelity'],
    'lan':['lan','local area network'], 'wan':['wan','wide area network'],
    'vlan':['vlan','virtual lan','virtual local area network'], 'bgp':['bgp','border gateway protocol'],
    'ospf':['ospf','open shortest path first'], 'qos':['qos','quality of service'],
    'nat':['nat','network address translation'], 'acl':['acl','access control list','access control lists'],
    'ipsec':['ipsec','ip sec','internet protocol security'],
    'oracle rac':['oracle rac','real application clusters','oracle real application clusters'],
    'oracle data guard':['oracle data guard','oracle dataguard','data guard'],
    'rman':['rman','oracle recovery manager','recovery manager'],
    'oracle goldengate':['oracle goldengate','oracle golden gate','goldengate'],
    'guidewire data model':['guidewire data model','guidewire data models','gw data model','gw data models','guidewire data modeling','guidewire data modelling'],
    'guidewire policycenter':['guidewire policycenter','guidewire policy center','policycenter','policy center','guidewire pc'],
    'guidewire billingcenter':['guidewire billingcenter','guidewire billing center','billingcenter','billing center','guidewire bc'],
    'guidewire claimcenter':['guidewire claimcenter','guidewire claim center','claimcenter','claim center','guidewire cc'],
    'sql scripting':['sql scripting','sql scripts','sql script development'],
    'sap sd':['sap sd','sap sales and distribution','sap sales distribution'],
    'sap fico':['sap fico','sap fi/co','sap fi co','sap finance and controlling','sap financial accounting and controlling'],
    'sap abap':['sap abap','abap','advanced business application programming'],
    'sap fiori':['sap fiori','fiori'], 'sap s/4hana':['sap s/4hana','sap s4hana','s/4hana','s4hana','sap s4 hana'],
    'sap ewm':['sap ewm','sap extended warehouse management','embedded ewm'],
    'sap wm':['sap wm','sap warehouse management'],
    'sap transportation management':['sap transportation management','sap tm'],
    'sap hcm payroll':['sap hcm payroll','sap hr payroll','sap payroll'],
    'sap successfactors employee central':['sap successfactors employee central','successfactors employee central','sap sf ec','successfactors ec'],
    'personnel calculation rules':['personnel calculation rules','personnel calculation rules (pcrs)','payroll pcrs','payroll pcr'],
    'order-to-cash':['order-to-cash','order to cash','o2c','otc'], 'procure-to-pay':['procure-to-pay','procure to pay','p2p'],
    'accounts payable':['accounts payable','account payable'], 'accounts receivable':['accounts receivable','account receivable'],
    'cost center accounting':['cost center accounting','cost centre accounting'], 'profit center accounting':['profit center accounting','profit centre accounting'],
    'copa':['copa','co-pa','sap profitability analysis'],
    'veeam backup and replication':['veeam backup & replication','veeam backup and replication','veeam b&r'],
    'veeam data cloud vault':['veeam data cloud vault','veeam data cloud vault (vdcv)','vdcv'],
    'veeam one':['veeam one','veeamone'], 'veritas backup exec':['veritas backup exec','backup exec'],
    'saas':['saas','software as a service'], 'saas sales':['saas sales','software as a service sales'],
    'lead generation':['lead generation','lead gen'], 'cold calling':['cold calling','cold calls'],
    'key account management':['key account management','key accounts management','managing key accounts'],
    'business development':['business development','business dev'],
    'client relationship management':['client relationship management','customer relationship management skills','managing client relationships','client relations management'],
    'pipeline management':['pipeline management','sales pipeline management','managing sales pipeline'],
    'sales forecasting':['sales forecasting','sales forecasts'],
    'requirements gathering':['requirements gathering','requirement gathering','requirements elicitation','requirement elicitation','business requirements gathering','client requirement gathering'],
    'mis reporting':['mis reporting','management information system reporting','management information systems reporting'],
    'data center operations':['data center operations','data centre operations','dc operations'],
    'process optimization':['process optimization','process optimisation'], 'cost optimization':['cost optimization','cost optimisation'],
    'admission counselling':['admission counselling','admission counseling','admissions counselling','admissions counseling'],
    'student counselling':['student counselling','student counseling'],
    'learning and development':['learning and development','learning & development','l&d'],
    'hr operations':['hr operations','human resources operations','human resource operations'],
    'hrms':['hrms','human resource management system','human resources management system'],
    'lms':['lms','learning management system','learning management systems'],
    'moodle':['moodle','moodle lms'], 'powerpoint':['powerpoint','power point','ms powerpoint','microsoft powerpoint'],
    'microsoft project':['ms project','microsoft project'], 'confluence':['confluence','atlassian confluence'],
    'problem solving':['problem solving','problem-solving','problem solving skills'],
    'attention to detail':['attention to detail','detail oriented','detail-oriented'],
    'cross-functional collaboration':['cross-functional collaboration','cross functional collaboration','cross-functional coordination','cross functional coordination'],
    'negotiation':['negotiation','negotiation skills','negotiating'],
    'verbal communication':['verbal communication','oral communication'], 'written communication':['written communication','written communication skills']
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
  // Stable labels are shared by JD extraction and the one-time data cleanup.
  // Unknown labels (including versions and compound conditions) retain their text.
  const displayNames={
    'html':'HTML','css':'CSS','tailwind css':'Tailwind CSS','generative ai':'Generative AI','artificial intelligence':'Artificial Intelligence','azure devops':'Azure DevOps','attention to detail':'Attention to Detail','learning and development':'Learning and Development','cross-functional collaboration':'Cross-functional Collaboration','javascript':'JavaScript','typescript':'TypeScript','react':'React','angular':'Angular','angularjs':'AngularJS',
    'vue.js':'Vue.js','next.js':'Next.js','node.js':'Node.js','express.js':'Express.js',
    'c#':'C#','c++':'C++','.net':'.NET','.net core':'.NET Core','.net framework':'.NET Framework',
    'asp.net':'ASP.NET','asp.net core':'ASP.NET Core','asp.net mvc':'ASP.NET MVC','asp.net mvc 5':'ASP.NET MVC 5',
    'asp.net core mvc':'ASP.NET Core MVC','asp.net web api':'ASP.NET Web API','asp.net web forms':'ASP.NET Web Forms',
    'sql':'SQL','sql server':'SQL Server','mysql':'MySQL','postgresql':'PostgreSQL','mongodb':'MongoDB',
    'pl/sql':'PL/SQL','t-sql':'T-SQL','sql query optimization':'SQL Query Optimization','sql scripting':'SQL Scripting',
    'aws':'AWS','azure':'Azure','gcp':'GCP','ci/cd':'CI/CD','rhel':'RHEL','git':'Git','github':'GitHub','gitlab':'GitLab',
    'power bi':'Power BI','excel':'Excel','python pandas':'Pandas','numpy':'NumPy','scikit-learn':'Scikit-learn',
    'tensorflow':'TensorFlow','pytorch':'PyTorch','fastapi':'FastAPI','graphql':'GraphQL','rest api':'REST APIs',
    'large language models':'LLM','rag':'RAG','agentic ai':'Agentic AI','mlops':'MLOps','pyspark':'PySpark',
    'langgraph':'LangGraph','langchain':'LangChain','etl':'ETL','ssis':'SSIS','ssrs':'SSRS',
    'api':'API','web api':'Web API','api testing':'API Testing','uat':'UAT','sdlc':'SDLC','linq':'LINQ','jquery':'jQuery',
    'tfs':'TFS','windows forms':'WinForms','wpf':'WPF','vsto':'VSTO','object-oriented programming':'Object-Oriented Programming',
    'rabbitmq':'RabbitMQ','dns':'DNS','dhcp':'DHCP','vmware':'VMware','nginx':'Nginx','itil':'ITIL','itsm':'ITSM','itam':'ITAM',
    'service now':'ServiceNow','sd-wan':'SD-WAN','wi-fi':'Wi-Fi','lan':'LAN','wan':'WAN','vlan':'VLAN','bgp':'BGP','ospf':'OSPF',
    'qos':'QoS','nat':'NAT','acl':'ACL','ipsec':'IPsec','oracle rac':'Oracle RAC','rman':'RMAN','oracle goldengate':'Oracle GoldenGate',
    'guidewire policycenter':'Guidewire PolicyCenter','guidewire billingcenter':'Guidewire BillingCenter','guidewire claimcenter':'Guidewire ClaimCenter',
    'sap':'SAP','sap sd':'SAP SD','sap fico':'SAP FICO','sap abap':'SAP ABAP','sap fiori':'SAP Fiori','sap s/4hana':'SAP S/4HANA',
    'sap ewm':'SAP EWM','sap wm':'SAP WM','sap transportation management':'SAP TM','sap hcm payroll':'SAP HCM Payroll','copa':'SAP CO-PA',
    'saas':'SaaS','saas sales':'SaaS Sales','crm':'CRM','seo':'SEO','mis reporting':'MIS Reporting','hr operations':'HR Operations',
    'hrms':'HRMS','lms':'LMS','moodle':'Moodle','powerpoint':'PowerPoint','b2b sales':'B2B Sales'
  };
  Object.entries(displayNames).forEach(([key,label])=>{const normalized=normalize(label);aliasIndex.set(normalized,key);canonicalAliases.set(key,unique([...canonicalAliases.get(key)||[],normalized]))});
  function canonicalLabel(skill){
    const key=canonicalFor(skill);
    return key?(displayNames[key]||key.replace(/\b[a-z]/g,c=>c.toUpperCase())):String(skill).trim();
  }
  function skillKey(skill){return canonicalFor(skill)||normalize(skill)}
  function dedupeSkills(values){const seen=new Set();return (values||[]).filter(skill=>{const key=skillKey(skill);if(!key||seen.has(key))return false;seen.add(key);return true})}
  function canonicalizeSkills(values){return dedupeSkills(values).map(canonicalLabel)}

  // Only explicitly defined alternative groups are expanded. AND groups require
  // evidence for every component and keep the original JD condition as one label.
  const compoundRules=new Map([
    ['Cloud Platform (AWS / Azure / GCP)',{any:['AWS','Azure','GCP']}],
    ['Cloud Platform (Azure / AWS / GCP)',{any:['Azure','AWS','GCP']}],
    ['Relational Databases (Oracle / MySQL / PostgreSQL)',{any:['Oracle Database','MySQL','PostgreSQL']}],
    ['Desktop Applications (WinForms / WPF)',{any:['WinForms','WPF']}],
    ['Analytical and Communication Skills',{all:['Analytical Skills','Communication']}],
    ['SQL/PLSQL',{all:['SQL','PL/SQL']}]
  ].map(([label,rule])=>[normalize(label),rule]));
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
  const patternCache=new Map();
  function exactEvidence(lines,skill){
    const requested=normalize(skill),canonical=canonicalFor(skill),aliases=[...aliasesFor(skill)].sort((a,b)=>b.length-a.length);
    for(const line of lines)for(const alias of aliases){
      if(!patternCache.has(alias)){const pattern=tokenPattern(alias);patternCache.set(alias,pattern?new RegExp(pattern.source,'gi'):null)}
      const pattern=patternCache.get(alias);if(!pattern)continue;pattern.lastIndex=0;
      for(const match of line.normalized.matchAll(pattern)){
        const position=match.index+(match[0].startsWith(' ')?1:0),tail=line.normalized.slice(position);
        if(canonical==='javascript'&&alias==='js'&&/angular $/.test(line.normalized.slice(0,position)))continue;
        if(canonical==='react'&&/^react native\b/.test(tail))continue;
        if(canonical==='angular'&&/^angular (?:js|1(?: x)?)\b/.test(tail))continue;
        if(canonical==='sql'&&/(?:^| )(?:pl|t) $/.test(line.normalized.slice(0,position)))continue;
        if(isNegated(line.normalized,position))continue;
        return {requestedSkill:String(skill).trim(),canonical:canonical||requested,matchedTerm:alias,method:alias===requested?'exact':'alias',confidence:1,evidenceLine:line.raw.slice(0,240),context:contextType(line.section,line.raw)};
      }
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
  function boundedDistance(a,b,limit){
    let previous=Array.from({length:b.length+1},(_,i)=>i),beforePrevious=null;
    for(let i=1;i<=a.length;i++){
      const row=Array(b.length+1).fill(limit+1);row[0]=i;
      for(let j=Math.max(1,i-limit);j<=Math.min(b.length,i+limit);j++){
        row[j]=Math.min(previous[j]+1,row[j-1]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])row[j]=Math.min(row[j],beforePrevious[j-2]+1);
      }
      if(Math.min(...row)>limit)return limit+1;
      beforePrevious=previous;previous=row;
    }
    return previous[b.length];
  }
  const typoCache=new Map();
  function typoAllowed(target,candidate){
    const key=target+'|'+candidate;if(typoCache.has(key))return typoCache.get(key);
    const result=checkTypo(target,candidate);if(typoCache.size>=5000)typoCache.clear();typoCache.set(key,result);return result;
  }
  function checkTypo(target,candidate){
    const a=target.replace(/\s/g,''),b=candidate.replace(/\s/g,'');
    if(a===b||a.length<5||b.length<5||protectedShortSkills.has(a)||protectedShortSkills.has(b)||Math.abs(a.length-b.length)>2)return false;
    const knownTarget=canonicalFor(target),knownCandidate=canonicalFor(candidate);
    if(knownCandidate&&knownTarget!==knownCandidate)return false;
    if(/\d/.test(a+b)&&a.match(/\d+/g)?.join()!==b.match(/\d+/g)?.join())return false;
    if(knownTarget==='ci/cd'&&!/^(?:ci cd|cicd|continuous integration and continuous (?:delivery|deployment))\b/.test(candidate))return false;
    const limit=Math.min(a.length,b.length)>=9?2:1;
    if(Math.abs(a.length-b.length)>limit)return false;
    // A bounded edit calculation avoids full matrices for unrelated phrases.
    const distance=boundedDistance(a,b,limit);
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
    const rule=compoundRules.get(normalize(skill));
    if(rule){
      const literal=exactEvidence(lines,skill);if(literal)return {label:skill,evidence:literal.matchedTerm,...literal};
      const matches=(rule.any||rule.all).map(part=>matchRequirement(lines,part));
      if(rule.any)return matches.find(Boolean)||null;
      if(matches.some(match=>!match))return null;
      return {label:skill,requestedSkill:skill,canonical:normalize(skill),matchedTerm:matches.map(m=>m.matchedTerm).join(' + '),evidence:matches.map(m=>m.evidence).join(' + '),method:'group',confidence:Math.min(...matches.map(m=>m.confidence)),evidenceLine:matches.map(m=>m.evidenceLine).join(' | ').slice(0,480),context:'combined',needsVerification:matches.some(m=>m.needsVerification),components:matches};
    }
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
    const required=dedupeSkills(requirement.skills||[]),requiredKeys=new Set(required.map(skillKey)),preferred=dedupeSkills(requirement.preferred||[]).filter(skill=>!requiredKeys.has(skillKey(skill))),lines=meaningfulLines(text);
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
    const cap=scoreCap(mandatoryPct,missingRequired.length>0,expPct,requiredYears),score=Math.max(0,Math.min(100,rawScore,cap)),fuzzyMatches=matchDetails.filter(x=>x.method==='fuzzy'||x.needsVerification).map(x=>x.skill);
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
  global.tssEvidenceScreening={scoreCandidate:scoreCandidateEvidence,experience,matchRequirement,normalize,canonicalFor,canonicalLabel,canonicalizeSkills,skillKey,levenshtein,skillGroups};
})(window);
