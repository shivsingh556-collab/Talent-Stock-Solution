// Sync patch from TSS_All_Job_Profiles_2026-08-10.xlsx
// Uploaded workbook contains 46 active profile rows. TSS040 is duplicated in the workbook,
// so the IntelMac record uses a unique internal id while retaining requirementId='TSS040'.
(function(){
  if(!window.db || !Array.isArray(db.requirements)) return;

  // Workbook does not contain TSS037 (Liberty DVP), so remove it from the active master.
  db.requirements = db.requirements.filter(r => r.id !== 'TSS037');

  const additions = [
    {
      id:'TSS043', requirementId:'TSS043', profileKey:'manual-3fe33552-7202-4dfc-960b-030ff37549b2',
      client:'Neosoft Technologies', title:'ASP.NET Backend Lead', status:'Active',
      location:'Ghansoli / Mahape, Navi Mumbai', experience:'10+ years', salaryRange:'Up to ₹18 LPA',
      qualification:'Not provided', industry:'IT', aiSuggested:false, skillsSource:'client_confirmed',
      skills:['ASP.NET Core','C#','.NET 6/7/8','REST API Development','SQL Server','Entity Framework Core','Microservices Architecture','AI Integration (Azure AI/OpenAI or similar)','Azure Cloud','Git','CI/CD','Design Patterns','SOLID Principles','High-performance applications'],
      preferred:['Docker','Kubernetes','Azure DevOps','Redis','RabbitMQ / Azure Service Bus','Performance Optimization','Agile/Scrum'],
      responsibilities:'Lead backend engineering for enterprise .NET applications, API architecture, microservices, SQL Server, cloud integration, AI integration, code quality and technical delivery. Location: Ghansoli / Mahape, Navi Mumbai. Immediate to 15 days notice preferred.',
      jdText:''
    },
    {
      id:'TSS044', requirementId:'TSS044', profileKey:'manual-b1ac6ea9-a5f5-4467-82d8-fe3ee75d9644',
      client:'ShipDelight Logistics', title:'Pick-up Executive (4PL Operations)', status:'Active',
      location:'Mumbai', experience:'1-3 years', salaryRange:'Not provided', qualification:"Bachelor's", industry:'Logistics', aiSuggested:false, skillsSource:'client_confirmed',
      skills:['MS Excel','Communication','Logistics','Pickup Operations','4PL Operations','Shipment Coordination','Partner Coordination','MIS Reporting','SLA Tracking','Issue Resolution'],
      preferred:['Logistics operations experience','Courier or 4PL exposure'],
      responsibilities:'Coordinate pickup operations, shipment handovers, partner follow-ups, SLA tracking, issue resolution and operational reporting for 4PL logistics operations.', jdText:''
    },
    {
      id:'TSS045', requirementId:'TSS045', profileKey:'manual-f8a08af1-74b0-48bc-9dd2-e113110e9571',
      client:'InnovationM', title:'Flutter Developer', status:'Active',
      location:'Bangalore', experience:'4-5 years', salaryRange:'Not provided', qualification:'B.Tech', industry:'IT', aiSuggested:false, skillsSource:'client_confirmed',
      skills:['Flutter','Dart','Android','iOS','Flutter Architecture','Widget Lifecycle','State Management','Provider','Bloc','Riverpod','REST API Integration','GraphQL','SQLite','Hive','Networking','OOP','SOLID Principles','Clean Architecture','Git','CI/CD','Performance Optimization','Debugging'],
      preferred:['Kotlin','Java','Swift','Unit Testing','Widget Testing','Integration Testing'],
      responsibilities:'Build and maintain production-grade cross-platform mobile applications using Flutter and Dart, integrate APIs, manage state, optimise performance and follow clean architecture and testing practices.', jdText:''
    },
    {
      id:'TSS046', requirementId:'TSS046', profileKey:'manual-45a2f206-8a7a-4980-a86a-472798a40f1e',
      client:'InnovationM', title:'AI Engineer', status:'Active',
      location:'Bangalore / Hyderabad / Gurgaon', experience:'5-6 years', salaryRange:'Not provided', qualification:'Not provided', industry:'IT', aiSuggested:false, skillsSource:'client_confirmed',
      skills:['Generative AI','PyTorch','TensorFlow','Claude','Llama','Gemini','Mistral','RAG Pipelines','Embeddings','Vector Databases','Pinecone','Chroma','FAISS','Weaviate','Milvus','pgvector','Prompt Engineering','LangChain','LangGraph','CrewAI','AutoGen','Semantic Kernel','LlamaIndex','Neo4j','Graph Databases','GraphRAG','Cypher'],
      preferred:['Production GenAI deployment','Agentic AI','Knowledge Graphs','Evaluation and observability'],
      responsibilities:'Design and build production-grade GenAI and agentic AI solutions using LLMs, RAG, vector databases, orchestration frameworks and graph technologies.', jdText:''
    },
    {
      id:'TSS040__INTELMAC', requirementId:'TSS040', profileKey:'manual-64cf339b-f1ab-4ee6-b510-ed04bfbcdfb4',
      client:'IntelMac', title:'Senior Service Engineer', status:'Active',
      location:'Bangalore', experience:'5 years', salaryRange:'₹40,000-₹50,000 in hand', qualification:'DME / ITI / B.E.', industry:'Engineering', aiSuggested:false, skillsSource:'client_confirmed',
      skills:['CNC Machines','Machine Service','Machine Construction','Troubleshooting','Preventive Maintenance','Breakdown Maintenance','Customer Support','Communication','Problem Solving','Documentation','MS Excel','Process Compliance','Reporting','Time Management','Team Collaboration'],
      preferred:['CNC machine tools service experience','Field service exposure'],
      responsibilities:'Senior Service Engineer for CNC and machine-tool service operations in Bangalore. Handle installation/service support, troubleshooting, maintenance, customer coordination and technical reporting. Two positions.', jdText:''
    }
  ];

  additions.forEach(p => {
    const idx = db.requirements.findIndex(r => r.id === p.id);
    if(idx >= 0) db.requirements[idx] = {...db.requirements[idx], ...p};
    else db.requirements.push(p);
  });

  // Keep exactly the 46 workbook profiles as the active master, while preserving recruiter-created custom records.
  const custom = db.requirements.filter(r => String(r.id||'').startsWith('CUSTOM-'));
  const master = db.requirements.filter(r => !String(r.id||'').startsWith('CUSTOM-') && r.status === 'Active');
  const unique = [];
  const keys = new Set();
  for(const r of master){
    const k = r.profileKey || r.id;
    if(!keys.has(k)){ keys.add(k); unique.push(r); }
  }
  db.requirements = [...unique, ...custom];

  db.activity = db.activity || [];
  const marker='tss_profile_sync_46_2026_08_10';
  if(!localStorage.getItem(marker)){
    db.activity.push({date:new Date().toISOString(),title:'Job profile master updated',detail:'46 profiles synced from TSS_All_Job_Profiles_2026-08-10.xlsx'});
    localStorage.setItem(marker,'1');
  }
  if(typeof saveDB==='function') saveDB();
  else localStorage.setItem('tss_talent_buddy_v1',JSON.stringify(db));

  // If Supabase auth is active, persist the same master to the database too.
  if(window.TSSBackend?.enabled && typeof window.TSSBackend.syncMasterRequirements==='function'){
    window.TSSBackend.syncMasterRequirements(db.requirements)
      .then(r=>console.info('TSS Supabase requirement sync',r))
      .catch(err=>console.warn('TSS Supabase requirement sync skipped',err?.message||err));
  }
})();