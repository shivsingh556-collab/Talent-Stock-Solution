(function(){
  'use strict';

  let pdfReady = null, mammothReady = null, ocrReady = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src === src)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function clean(v) {
    return String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function toast(msg) {
    try {
      if (window.toast) window.toast(msg);
      else console.log('[TSS Toast]', msg);
    } catch {}
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result || '';
        const base64 = String(result).split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function parsePDFLocally(file) {
    if (!pdfReady) {
      pdfReady = loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(() => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      });
    }
    await pdfReady;
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const c = await p.getTextContent();
      const items = c.items || [];
      let line = '', lastY = null, lines = [];
      for (const item of items) {
        const y = Math.round(item.transform?.[5] || 0);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (line.trim()) lines.push(line.trim());
          line = '';
        }
        line += (line ? ' ' : '') + (item.str || '');
        lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n').trim();
  }

  async function parseDOCXLocally(file) {
    if (!mammothReady) {
      mammothReady = loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js');
    }
    await mammothReady;
    const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return (r.value || '').trim();
  }

  async function parseLocally(file) {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    if (type === 'text/plain' || name.endsWith('.txt') || name.endsWith('.csv')) {
      return (await file.text()).trim();
    }
    if (type === 'application/pdf' || name.endsWith('.pdf')) {
      return parsePDFLocally(file);
    }
    if (name.endsWith('.docx')) {
      return parseDOCXLocally(file);
    }
    throw new Error('Please use PDF, DOCX, TXT or Image files.');
  }

  const knownSkills = [
    'Java', 'JavaScript', 'TypeScript', 'Python', 'C#', 'C++', 'ASP.NET Core', '.NET Core', '.NET',
    'Angular', 'React', 'React Native', 'Node.js', 'Spring Boot', 'REST API', 'GraphQL', 'SQL',
    'SQL Server', 'MS SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Oracle', 'AWS', 'Azure', 'GCP',
    'Docker', 'Kubernetes', 'Git', 'CI/CD', 'Jenkins', 'GitHub Actions', 'RabbitMQ', 'Redis',
    'Power BI', 'Tableau', 'Excel', 'Selenium', 'Playwright', 'Cypress', 'Postman', 'API Testing',
    'Automation Testing', 'Manual Testing', 'Regression Testing', 'Performance Testing', 'JMeter',
    'Appium', 'PyTorch', 'TensorFlow', 'Generative AI', 'RAG', 'LangChain', 'Flutter', 'Dart',
    'B2B Sales', 'CRM', 'Lead Generation', 'Key Account Management', 'Stakeholder Management',
    'Team Leadership', 'Logistics', 'MIS Reporting', 'Recruitment', 'Staffing', 'Executive Search',
    'Digital Marketing', 'SEO', 'SEM', 'Google Ads', 'Salesforce', 'SAP', 'ETL', 'Data Engineering',
    'Machine Learning', 'Data Analysis', 'Business Analysis', 'Project Management', 'Agile', 'Scrum', 'Jira'
  ];

  function skillList(text) {
    const low = ' ' + String(text || '').toLowerCase() + ' ';
    return [...new Set(knownSkills.filter(s => {
      const reg = new RegExp('(^|[^a-z0-9+#.])' + s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9+#.]|$)', 'i');
      return reg.test(low);
    }))];
  }

  function firstMatch(text, patterns) {
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return clean(m[1]);
    }
    return '';
  }

  function likelyName(lines) {
    const bad = /resume|curriculum|profile|summary|objective|experience|engineer|developer|manager|analyst|email|phone|mobile|contact|linkedin|github/i;
    for (const l of lines.slice(0, 10)) {
      const x = l.replace(/[|•·*]/g, ' ').trim();
      if (x.length >= 3 && x.length <= 50 && !bad.test(x) && !/@/.test(x) && !/\d{5,}/.test(x) && /^[A-Za-z][A-Za-z .'-]+$/.test(x) && x.split(/\s+/).length <= 5) {
        return x.replace(/\b\w/g, c => c.toUpperCase());
      }
    }
    return '';
  }

  function locationFromText(text, lines) {
    const v = firstMatch(text, [/(?:current\s+location|location|based\s+in|address|city)\s*[:\-]\s*([^\n|]{2,60})/i]);
    if (v) return v;
    const cities = ['Mumbai', 'Navi Mumbai', 'Pune', 'Delhi', 'New Delhi', 'Gurgaon', 'Gurugram', 'Noida', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Dubai', 'Abu Dhabi', 'Thane', 'Jaipur', 'Indore', 'Kochi', 'Chandigarh'];
    for (const l of lines.slice(0, 15)) {
      const hit = cities.find(c => new RegExp('\\b' + c.replace(' ', '\\s+') + '\\b', 'i').test(l));
      if (hit) return hit;
    }
    return '';
  }

  function experienceFromText(text) {
    const v = firstMatch(text, [
      /(?:total\s+experience|overall\s+experience|professional\s+experience|experience)\s*[:\-]?\s*(\d+(?:\.\d+)?\s*(?:\+)?\s*(?:years?|yrs?))/i,
      /(\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience)/i
    ]);
    if (v) return parseFloat(v);
    const m = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years?|yrs?)\b/gi)].map(x => Number(x[1])).filter(n => n > 0 && n < 50);
    return m.length ? Math.max(...m) : '';
  }

  function designationFromText(text, lines) {
    const v = firstMatch(text, [/(?:current\s+designation|designation|current\s+role|job\s+title|role)\s*[:\-]\s*([^\n|]{2,80})/i]);
    if (v) return v;
    const roles = /\b((?:Senior|Sr\.?|Lead|Principal|Junior|Jr\.?)?\s*(?:QA|Quality|Software|Data|Backend|Frontend|Full Stack|Automation|Sales|Business|Service|Database|BI|AI|Flutter|React|Java|\.NET)?\s*(?:Engineer|Developer|Manager|Analyst|Consultant|Executive|Lead|Administrator|Architect|Specialist|Recruiter))\b/i;
    for (const l of lines.slice(0, 20)) {
      const m = l.match(roles);
      if (m && l.length < 100) return clean(m[0]);
    }
    return '';
  }

  function localExtractResume(text) {
    const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
    const email = firstMatch(text, [/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i]);
    const rawPhone = firstMatch(text, [/(?:\+?91[\s-]?)?([6-9]\d{9})\b/, /(?:phone|mobile|contact|tel)\s*[:\-]?\s*([+\d][\d\s()-]{8,18})/i]);
    const phone = rawPhone.replace(/\D/g, '').slice(-10);
    const skills = skillList(text);
    return {
      name: likelyName(lines),
      email,
      phone,
      location: locationFromText(text, lines),
      totalExperience: experienceFromText(text),
      designation: designationFromText(text, lines),
      skills,
      primarySkills: skills.slice(0, 5),
      education: firstMatch(text, [/(?:highest\s+qualification|qualification|education|degree)\s*[:\-]\s*([^\n]{2,100})/i]),
      currentCompany: firstMatch(text, [/(?:current\s+company|current\s+employer|company)\s*[:\-]\s*([^\n|]{2,80})/i]),
      noticePeriod: firstMatch(text, [/(?:notice\s+period|notice)\s*[:\-]?\s*([^\n|]+)/i]),
      currentCTC: firstMatch(text, [/(?:current\s+ctc|present\s+ctc|current\s+salary)\s*[:\-]?\s*([^\n|]+)/i]),
      expectedCTC: firstMatch(text, [/(?:expected\s+ctc|expected\s+salary)\s*[:\-]?\s*([^\n|]+)/i]),
      extractedText: text,
      confidence: 80,
      source: 'local'
    };
  }

  function section(text, names) {
    const joined = names.join('|');
    const stop = 'mandatory skills|must have|required skills|preferred skills|good to have|experience|qualification|education|location|responsibilities|job responsibilities|requirements|job description|salary|ctc|industry';
    const re = new RegExp('(?:^|\\n)\\s*(?:' + joined + ')\\s*[:\\-]?\\s*\\n?([\\s\\S]{0,2500}?)(?=\\n\\s*(?:' + stop + ')\\s*[:\\-]?|$)', 'i');
    return clean((text.match(re) || [])[1] || '');
  }

  function localExtractJD(text) {
    const rawSkills = section(text, ['mandatory skills', 'must have skills', 'must have', 'required skills', 'key skills', 'technical skills']);
    const pref = section(text, ['preferred skills', 'good to have', 'nice to have']);
    let skills = rawSkills ? rawSkills.split(/[,;|•·●\n]/).map(clean).filter(x => x.length > 1 && x.length < 80) : skillList(text);
    let preferred = pref ? pref.split(/[,;|•·●\n]/).map(clean).filter(x => x.length > 1 && x.length < 80) : [];
    if (!skills.length) skills = skillList(text);
    const location = firstMatch(text, [/(?:work\s+location|job\s+location|location|based\s+at)\s*[:\-]\s*([^\n|]{2,80})/i]);
    const experience = firstMatch(text, [/(?:experience|required\s+experience|exp)\s*[:\-]?\s*([^\n|]{2,60})/i, /(\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*years?)/i, /(\d+\+\s*years?)/i]);
    const qualification = firstMatch(text, [/(?:qualification|education|academic\s+qualification)\s*[:\-]\s*([^\n]{2,150})/i]);
    const salary = firstMatch(text, [/(?:salary|ctc|compensation|budget)\s*[:\-]\s*([^\n|]{2,100})/i]);
    const responsibilities = section(text, ['roles and responsibilities', 'job responsibilities', 'responsibilities', 'key responsibilities', 'role and responsibilities']) || section(text, ['job description', 'about the role']);
    const title = firstMatch(text, [/(?:job\s+title|position|role|designation)\s*[:\-]\s*([^\n|]{2,100})/i]);
    const client = firstMatch(text, [/(?:client\s+name|client|company\s+name)\s*[:\-]\s*([^\n|]{2,100})/i]);
    const industry = firstMatch(text, [/(?:industry|domain|sector)\s*[:\-]\s*([^\n|]{2,60})/i]);
    return {
      client,
      title,
      location,
      experience,
      industry,
      qualification,
      salary,
      responsibilities,
      skills: [...new Set(skills)],
      preferred: [...new Set(preferred)],
      extractedText: text,
      confidence: 80,
      source: 'local'
    };
  }

  // Server AI Callers
  async function extractResumeAPI({ text, file }) {
    let payload = {};
    if (file) {
      const base64 = await fileToBase64(file);
      payload = {
        fileData: base64,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name
      };
    } else {
      payload = { text: String(text || '') };
    }

    try {
      const res = await fetch('/api/extract/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn('Server resume extraction failed, using robust local parser:', e);
      let rawText = text;
      if (file) rawText = await parseLocally(file);
      return localExtractResume(rawText);
    }
  }

  async function extractJDAPI({ text, file }) {
    let payload = {};
    if (file) {
      const base64 = await fileToBase64(file);
      payload = {
        fileData: base64,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name
      };
    } else {
      payload = { text: String(text || '') };
    }

    try {
      const res = await fetch('/api/extract/jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn('Server JD extraction failed, using robust local parser:', e);
      let rawText = text;
      if (file) rawText = await parseLocally(file);
      return localExtractJD(rawText);
    }
  }

  function setVal(id, val, overwrite = true) {
    const el = document.getElementById(id);
    if (el && val !== '' && val != null && (overwrite || !el.value)) {
      el.value = Array.isArray(val) ? val.join(', ') : val;
    }
  }

  function applyResumeToUI(data) {
    setVal('candidateName', data.name, true);
    setVal('candidateEmail', data.email, true);
    setVal('candidatePhone', data.phone, true);
    setVal('candidateExp', data.totalExperience, true);
    setVal('candidateLocation', data.location, true);
    setVal('candidateDesignation', data.designation, true);
    setVal('candidateNotice', data.noticePeriod, true);
    setVal('candidateCTC', data.currentCTC, true);
    setVal('candidateExpectedCTC', data.expectedCTC, true);
    if (data.extractedText) {
      setVal('resumeText', data.extractedText, true);
    }
    window.TSS_PARSED_RESUME = data;
    renderResumeExtractionBadge(data);
  }

  function renderResumeExtractionBadge(data) {
    let badgeWrap = document.getElementById('resumeExtractionBadge');
    if (!badgeWrap) {
      badgeWrap = document.createElement('div');
      badgeWrap.id = 'resumeExtractionBadge';
      badgeWrap.style.cssText = 'margin:10px 0;padding:12px;border:1px solid #2b6c9d;border-radius:10px;background:#092138;color:#d5ebff;font-size:13px;line-height:1.5;';
      const grid = document.querySelector('.candidate-detail-grid');
      if (grid && grid.parentNode) grid.parentNode.insertBefore(badgeWrap, grid.nextSibling);
    }

    const conf = data.confidence || 90;
    const skillsList = data.skills || [];
    const chipsHtml = skillsList.slice(0, 10).map(s => `<span style="display:inline-block;padding:2px 8px;margin:2px 3px;background:#153d61;border:1px solid #2d6b9d;border-radius:999px;font-size:11px;font-weight:600;color:#9ce0ff;">${clean(s)}</span>`).join('');

    badgeWrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-weight:700;color:#7ee787;display:flex;align-items:center;gap:6px;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
          High-Accuracy AI Extracted (${conf}% Confidence · ${data.source === 'gemini-ai' ? 'Gemini 3.7 Intelligence' : 'Enhanced Parser'})
        </span>
        <span style="color:#8bb6dc;font-size:12px;">${skillsList.length} skills evidenced</span>
      </div>
      <div style="margin-top:6px;color:#c0dffc;">
        <b>Designation:</b> ${data.designation || '—'} · <b>Experience:</b> ${data.totalExperience ? data.totalExperience + ' yrs' : '—'} · <b>Location:</b> ${data.location || '—'}${data.currentCompany ? ` · <b>Employer:</b> ${data.currentCompany}` : ''}
      </div>
      ${chipsHtml ? `<div style="margin-top:6px;">${chipsHtml}${skillsList.length > 10 ? `<span style="font-size:11px;color:#8bb6dc;"> +${skillsList.length - 10} more</span>` : ''}</div>` : ''}
    `;
  }

  function applyJDToUI(data, fullText = '') {
    setVal('reqTitle', data.title, true);
    setVal('reqClient', data.client, true);
    setVal('reqLocation', data.location, true);
    setVal('reqExperience', data.experience, true);
    setVal('reqIndustry', data.industry, true);
    setVal('reqQualification', data.qualification, true);
    if (data.skills?.length) setVal('reqSkills', data.skills.join(', '), true);
    if (data.preferred?.length) setVal('reqPreferred', data.preferred.join(', '), true);
    if (data.responsibilities) setVal('reqResponsibilities', data.responsibilities, true);
    if (data.extractedText || fullText) setVal('reqJdText', data.extractedText || fullText, true);

    window.TSS_PARSED_JD = data;

    // Also sync to active requirement in DB
    const select = document.getElementById('screenRequirement') || document.getElementById('topRequirementSelect');
    const r = window.db?.requirements?.find(x => x.id === select?.value);
    if (r) {
      if (data.title) r.title = data.title;
      if (data.client) r.client = data.client;
      if (data.location) r.location = data.location;
      if (data.experience) r.experience = data.experience;
      if (data.industry) r.industry = data.industry;
      if (data.qualification) r.qualification = data.qualification;
      if (data.salary) r.salaryRange = data.salary;
      if (data.responsibilities) r.responsibilities = data.responsibilities;
      if (data.skills?.length) r.skills = data.skills;
      if (data.preferred?.length) r.preferred = data.preferred;
      if (fullText || data.extractedText) r.jdText = fullText || data.extractedText;
      r.aiSuggested = false;
      try { if (typeof saveDB === 'function') saveDB(); } catch {}
      try { if (typeof renderOldSite === 'function') renderOldSite(); } catch {}
    }

    renderJDExtractionBadge(data);
  }

  function renderJDExtractionBadge(data) {
    let badgeWrap = document.getElementById('jdExtractionBadge');
    if (!badgeWrap) {
      badgeWrap = document.createElement('div');
      badgeWrap.id = 'jdExtractionBadge';
      badgeWrap.style.cssText = 'margin:10px 0;padding:12px;border:1px solid #2b6c9d;border-radius:10px;background:#092138;color:#d5ebff;font-size:13px;line-height:1.5;';
      const uploadCard = document.querySelector('#screening .upload-card');
      if (uploadCard) uploadCard.appendChild(badgeWrap);
    }

    const conf = data.confidence || 90;
    const skillsList = data.skills || [];
    const chipsHtml = skillsList.slice(0, 8).map(s => `<span style="display:inline-block;padding:2px 8px;margin:2px 3px;background:#153d61;border:1px solid #2d6b9d;border-radius:999px;font-size:11px;font-weight:600;color:#9ce0ff;">${clean(s)}</span>`).join('');

    badgeWrap.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-weight:700;color:#7ee787;display:flex;align-items:center;gap:6px;">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>
          JD High-Accuracy Extracted (${conf}% Confidence · ${data.source === 'gemini-ai' ? 'Gemini 3.7 Intelligence' : 'Enhanced Parser'})
        </span>
        <span style="color:#8bb6dc;font-size:12px;">${skillsList.length} mandatory skills confirmed</span>
      </div>
      <div style="margin-top:6px;color:#c0dffc;">
        <b>Role:</b> ${data.title || '—'} · <b>Experience:</b> ${data.experience || '—'} · <b>Location:</b> ${data.location || '—'}
      </div>
      ${chipsHtml ? `<div style="margin-top:6px;">${chipsHtml}${skillsList.length > 8 ? `<span style="font-size:11px;color:#8bb6dc;"> +${skillsList.length - 8} more</span>` : ''}</div>` : ''}
    `;
  }

  // Public Handler Functions
  async function handleResumeFile(file) {
    if (!file) return;
    try {
      toast('⚡ AI extracting candidate details with high precision…');
      const data = await extractResumeAPI({ file });
      applyResumeToUI(data);
      toast(`✨ Extracted: ${data.name || 'Candidate'} · ${data.skills?.length || 0} skills auto-filled`);
    } catch (e) {
      console.error(e);
      toast(e.message || 'Resume extraction failed');
    }
  }

  async function handleResumeText(text) {
    if (!text || text.trim().length < 15) return;
    try {
      toast('⚡ AI extracting candidate details from text…');
      const data = await extractResumeAPI({ text });
      applyResumeToUI(data);
      toast(`✨ Extracted: ${data.name || 'Candidate'} · ${data.skills?.length || 0} skills auto-filled`);
    } catch (e) {
      console.error(e);
      toast(e.message || 'Resume text extraction failed');
    }
  }

  async function handleJDFile(file) {
    if (!file) return;
    try {
      toast('⚡ AI extracting JD details with high precision…');
      const data = await extractJDAPI({ file });
      applyJDToUI(data);
      toast(`✨ JD Extracted: ${data.title || 'Role'} · ${data.skills?.length || 0} skills detected`);
    } catch (e) {
      console.error(e);
      toast(e.message || 'JD extraction failed');
    }
  }

  async function handleJDText(text) {
    if (!text || text.trim().length < 15) return;
    try {
      toast('⚡ AI extracting JD details from text…');
      const data = await extractJDAPI({ text });
      applyJDToUI(data, text);
      toast(`✨ JD Extracted: ${data.title || 'Role'} · ${data.skills?.length || 0} skills detected`);
    } catch (e) {
      console.error(e);
      toast(e.message || 'JD text extraction failed');
    }
  }

  function addExtractionButtons() {
    // 1. Resume AI Extract Button
    const resumeText = document.getElementById('resumeText');
    if (resumeText && !document.getElementById('aiExtractResumeBtn')) {
      const btn = document.createElement('button');
      btn.id = 'aiExtractResumeBtn';
      btn.type = 'button';
      btn.className = 'btn ghost';
      btn.style.cssText = 'margin:6px 0;width:100%;border:1px solid #3b82f6;background:#0d2847;color:#93c5fd;font-weight:700;padding:8px 12px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;';
      btn.innerHTML = `
        <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>
        ⚡ AI Re-Extract & Fill All Candidate Details
      `;
      btn.addEventListener('click', () => {
        const val = resumeText.value.trim();
        if (!val) { toast('Please paste resume text or upload a file first'); return; }
        handleResumeText(val);
      });
      resumeText.parentNode.insertBefore(btn, resumeText);
    }

    // 2. Quick JD AI Extract Button
    const pasteJdQuick = document.getElementById('pasteJdQuick');
    if (pasteJdQuick && !document.getElementById('aiExtractJdQuickBtn')) {
      const btn = document.createElement('button');
      btn.id = 'aiExtractJdQuickBtn';
      btn.type = 'button';
      btn.className = 'dark-upload-btn';
      btn.style.cssText = 'background:#13395d;border-color:#388bfd;color:#bae0ff;font-weight:700;';
      btn.innerHTML = '⚡ AI Parse JD Text';
      btn.addEventListener('click', () => {
        const text = prompt('Paste full Job Description, email, or client requirements:');
        if (text && text.trim()) handleJDText(text.trim());
      });
      pasteJdQuick.parentNode.insertBefore(btn, pasteJdQuick.nextSibling);
    }
  }

  function wire() {
    const fileAccept = '.pdf,.docx,.doc,.txt,.csv,.png,.jpg,.jpeg,.webp';

    const resumeInput = document.getElementById('resumeFile');
    if (resumeInput) {
      resumeInput.setAttribute('multiple', 'multiple');
      resumeInput.setAttribute('accept', fileAccept);
      resumeInput.addEventListener('change', e => {
        const files = Array.from(e.target.files || []);
        if (files.length > 1) {
          if (window.TSSBatchScreening?.processBatch) {
            window.TSSBatchScreening.processBatch(files);
          }
        } else if (files.length === 1) {
          handleResumeFile(files[0]);
        }
      });
    }

    const jdQuickInput = document.getElementById('jdQuickFile');
    if (jdQuickInput) {
      jdQuickInput.setAttribute('accept', fileAccept);
      jdQuickInput.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) handleJDFile(file);
      });
    }

    const jdDialogInput = document.getElementById('jdFile');
    if (jdDialogInput) {
      jdDialogInput.setAttribute('accept', fileAccept);
      jdDialogInput.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) handleJDFile(file);
      });
    }

    const resumeBox = document.getElementById('resumeText');
    if (resumeBox) {
      resumeBox.addEventListener('paste', () => {
        setTimeout(() => {
          const t = resumeBox.value.trim();
          if (t.length > 50) handleResumeText(t);
        }, 100);
      });
    }

    const reqJdBox = document.getElementById('reqJdText');
    if (reqJdBox) {
      reqJdBox.addEventListener('paste', () => {
        setTimeout(() => {
          const t = reqJdBox.value.trim();
          if (t.length > 50) handleJDText(t);
        }, 100);
      });
    }

    addExtractionButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  setTimeout(wire, 200);
  setTimeout(wire, 800);

  window.TSSDocumentParser = {
    parseLocally,
    extractResumeAPI,
    extractJDAPI,
    handleResumeFile,
    handleResumeText,
    handleJDFile,
    handleJDText,
    applyResumeToUI,
    applyJDToUI,
    localExtractResume,
    localExtractJD,
    version: '3.0-high-accuracy-ai'
  };
})();
