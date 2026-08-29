import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(process.cwd()));

let aiClient = null;
function getAI() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Fallback Heuristics
const cleanStr = v => String(v || '').replace(/\s+/g, ' ').trim();
const firstMatch = (text, patterns) => {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return cleanStr(m[1]);
  }
  return '';
};

const knownSkillsCatalog = [
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

function extractSkillsHeuristic(text) {
  const low = ' ' + text.toLowerCase() + ' ';
  return [...new Set(knownSkillsCatalog.filter(s => {
    const regex = new RegExp(`(^|[^a-z0-9+#.])${s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9+#.]|$)`, 'i');
    return regex.test(low);
  }))];
}

function fallbackResumeExtract(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const email = firstMatch(text, [/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i]);
  const rawPhone = firstMatch(text, [/(?:\+?91[\s-]?)?([6-9]\d{9})\b/, /(?:phone|mobile|contact|tel)\s*[:\-]?\s*([+\d][\d\s()-]{8,18})/i]);
  const phone = rawPhone.replace(/\D/g, '').slice(-10);

  let name = '';
  const badNames = /resume|curriculum|profile|summary|objective|experience|engineer|developer|manager|analyst|email|phone|mobile|contact|linkedin|github|portfolio/i;
  for (const l of lines.slice(0, 10)) {
    const cleanL = l.replace(/[|•·*]/g, ' ').trim();
    if (cleanL.length >= 3 && cleanL.length <= 50 && !badNames.test(cleanL) && !/@/.test(cleanL) && !/\d{5,}/.test(cleanL) && /^[A-Za-z][A-Za-z .'-]+$/.test(cleanL)) {
      name = cleanL.replace(/\b\w/g, c => c.toUpperCase());
      break;
    }
  }

  const expMatch = firstMatch(text, [
    /(?:total\s+experience|overall\s+experience|professional\s+experience|experience)\s*[:\-]?\s*(\d+(?:\.\d+)?\s*\+?\s*(?:years?|yrs?))/i,
    /(\d+(?:\.\d+)?\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience)/i
  ]);
  const totalExperience = expMatch ? parseFloat(expMatch) : 0;

  const locMatch = firstMatch(text, [/(?:current\s+location|location|based\s+in|address|city)\s*[:\-]\s*([^\n|]{2,60})/i]);
  const cities = ['Mumbai', 'Navi Mumbai', 'Pune', 'Delhi', 'New Delhi', 'Gurgaon', 'Gurugram', 'Noida', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Dubai', 'Abu Dhabi', 'Thane', 'Jaipur', 'Indore', 'Kochi', 'Chandigarh'];
  let location = locMatch;
  if (!location) {
    for (const l of lines.slice(0, 18)) {
      const hit = cities.find(c => new RegExp(`\\b${c.replace(' ', '\\s+')}\\b`, 'i').test(l));
      if (hit) { location = hit; break; }
    }
  }

  const designation = firstMatch(text, [
    /(?:current\s+designation|designation|current\s+role|job\s+title|role)\s*[:\-]\s*([^\n|]{2,80})/i
  ]) || firstMatch(text, [
    /\b((?:Senior|Sr\.?|Lead|Principal|Junior|Jr\.?)?\s*(?:QA|Quality|Software|Data|Backend|Frontend|Full Stack|Automation|Sales|Business|Database|BI|AI|Flutter|React|Java|\.NET)?\s*(?:Engineer|Developer|Manager|Analyst|Consultant|Executive|Lead|Administrator|Architect|Specialist|Recruiter))\b/i
  ]);

  const currentCompany = firstMatch(text, [/(?:current\s+company|current\s+employer|company|organization)\s*[:\-]\s*([^\n|]{2,80})/i]);
  const noticePeriod = firstMatch(text, [/(?:notice\s+period|notice)\s*[:\-]?\s*([^\n|]+)/i]);
  const currentCTC = firstMatch(text, [/(?:current\s+ctc|present\s+ctc|current\s+salary)\s*[:\-]?\s*([^\n|]+)/i]);
  const expectedCTC = firstMatch(text, [/(?:expected\s+ctc|expected\s+salary)\s*[:\-]?\s*([^\n|]+)/i]);
  const education = firstMatch(text, [/(?:highest\s+qualification|qualification|education|degree)\s*[:\-]\s*([^\n]{2,100})/i]);
  const skills = extractSkillsHeuristic(text);

  return {
    name: name || 'Candidate',
    email: email || '',
    phone: phone || '',
    totalExperience: totalExperience || 0,
    relevantExperience: '',
    location: location || '',
    preferredLocation: '',
    designation: designation || '',
    currentCompany: currentCompany || '',
    noticePeriod: noticePeriod || '',
    currentCTC: currentCTC || '',
    expectedCTC: expectedCTC || '',
    skills,
    primarySkills: skills.slice(0, 5),
    education: education || '',
    summary: lines.slice(0, 5).join(' ').slice(0, 200),
    extractedText: text,
    confidence: Math.round(([name, email, phone, location, totalExperience, designation, skills.length].filter(Boolean).length / 7) * 100),
    warnings: [],
    source: 'heuristic',
  };
}

function fallbackJDExtract(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const title = firstMatch(text, [/(?:job\s+title|position|role|designation)\s*[:\-]\s*([^\n|]{2,100})/i]) ||
    lines.find(l => /\b(manager|engineer|developer|analyst|consultant|executive|lead|architect|recruiter|specialist)\b/i.test(l) && l.length < 90) || '';
  const client = firstMatch(text, [/(?:client\s+name|client|company\s+name|hiring\s+company)\s*[:\-]\s*([^\n|]{2,100})/i]) || '';
  const location = firstMatch(text, [/(?:work\s+location|job\s+location|location|based\s+at)\s*[:\-]\s*([^\n|]{2,80})/i]) || '';
  const experience = firstMatch(text, [/(?:experience|required\s+experience|exp)\s*[:\-]?\s*([^\n|]{2,60})/i, /(\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*years?)/i, /(\d+\+\s*years?)/i]) || '';
  const industry = firstMatch(text, [/(?:industry|domain|sector)\s*[:\-]\s*([^\n|]{2,60})/i]) || '';
  const qualification = firstMatch(text, [/(?:qualification|education|academic\s+qualification)\s*[:\-]\s*([^\n]{2,120})/i]) || '';
  const salary = firstMatch(text, [/(?:salary|ctc|compensation|budget)\s*[:\-]\s*([^\n|]{2,80})/i]) || '';
  const skills = extractSkillsHeuristic(text);

  return {
    client,
    title,
    location,
    experience,
    industry,
    qualification,
    salary,
    skills,
    preferred: [],
    responsibilities: text.slice(0, 800),
    interviewMode: 'Virtual / F2F',
    extractedText: text,
    confidence: Math.round(([title, location, experience, skills.length].filter(Boolean).length / 4) * 100),
    source: 'heuristic',
  };
}

// RESUME EXTRACTION API
app.post('/api/extract/resume', async (req, res) => {
  try {
    const { text, fileData, mimeType, fileName } = req.body;
    let rawText = text || '';

    // Handle DOCX files via mammoth
    if (fileData && (fileName?.toLowerCase().endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      try {
        const buffer = Buffer.from(fileData, 'base64');
        const docxResult = await mammoth.extractRawText({ buffer });
        rawText = docxResult.value || '';
      } catch (err) {
        console.warn('DOCX extraction warning:', err.message);
      }
    }

    const ai = getAI();
    if (ai) {
      const parts = [];

      if (fileData && (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf') || mimeType?.startsWith('image/'))) {
        parts.push({
          inlineData: {
            mimeType: mimeType || (fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png'),
            data: fileData,
          },
        });
        parts.push({
          text: `Extract all candidate details from this resume document with maximum precision.
Also include the complete clean extracted plain text in 'extractedText' so recruiters can view the full CV.`,
        });
      } else {
        const contentText = rawText || (fileData ? Buffer.from(fileData, 'base64').toString('utf-8') : '');
        if (!contentText.trim()) {
          return res.status(400).json({ error: 'No readable resume text or file data provided.' });
        }
        parts.push({
          text: `Extract structured candidate details from the following resume text with extreme recruitment accuracy:
---
${contentText.slice(0, 45000)}
---
Also provide the full clean text representation in 'extractedText'.`,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: { parts },
        config: {
          systemInstruction: `You are an expert Talent Intelligence & Resume Extraction Engine for TalentStock Solutions.
Extract candidate details with high precision:
- Extract full name cleanly without noise or headings.
- Extract valid primary email and 10-digit/standard phone.
- Calculate or parse total experience in years as a float/number (e.g. 5.5, 3.0, 0 for freshers).
- Identify current/most recent job designation and employer company.
- Extract current city/location and preferred locations.
- Extract notice period and CTC (current & expected) if present.
- Extract a comprehensive list of technical, functional and domain skills evidenced in the CV.
- Extract education, degree, summary, and note any flags in warnings.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Candidate full name' },
              email: { type: Type.STRING, description: 'Primary email address' },
              phone: { type: Type.STRING, description: 'Primary mobile/phone number' },
              totalExperience: { type: Type.NUMBER, description: 'Total experience in years as a number (e.g. 5.5)' },
              relevantExperience: { type: Type.STRING, description: 'Relevant experience if specified' },
              location: { type: Type.STRING, description: 'Current city or location' },
              preferredLocation: { type: Type.STRING, description: 'Preferred location(s)' },
              designation: { type: Type.STRING, description: 'Current or latest job designation' },
              currentCompany: { type: Type.STRING, description: 'Current employer or company name' },
              noticePeriod: { type: Type.STRING, description: 'Notice period (e.g. 15 Days, 1 Month, Immediate)' },
              currentCTC: { type: Type.STRING, description: 'Current CTC / compensation' },
              expectedCTC: { type: Type.STRING, description: 'Expected CTC / compensation' },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'All technical and professional skills found in the resume',
              },
              primarySkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Top 3-5 core primary skills',
              },
              education: { type: Type.STRING, description: 'Highest qualification / degree' },
              summary: { type: Type.STRING, description: 'Brief candidate profile summary' },
              extractedText: { type: Type.STRING, description: 'Full extracted plain text of the resume' },
              confidence: { type: Type.INTEGER, description: 'Extraction confidence score (0-100)' },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Any validation warnings or discrepancies',
              },
            },
            required: ['name', 'email', 'phone', 'location', 'designation', 'skills'],
          },
        },
      });

      const parsed = JSON.parse(response.text.trim());
      parsed.source = 'gemini-ai';
      if (!parsed.extractedText && rawText) parsed.extractedText = rawText;
      return res.json(parsed);
    }

    // Heuristic Fallback
    const content = rawText || (fileData ? Buffer.from(fileData, 'base64').toString('utf-8') : '');
    const fallback = fallbackResumeExtract(content);
    return res.json(fallback);
  } catch (error) {
    console.error('Resume extraction error:', error);
    const content = req.body.text || '';
    if (content) {
      return res.json(fallbackResumeExtract(content));
    }
    res.status(500).json({ error: error.message || 'Failed to extract resume details' });
  }
});

// JOB DESCRIPTION (JD) EXTRACTION API
app.post('/api/extract/jd', async (req, res) => {
  try {
    const { text, fileData, mimeType, fileName } = req.body;
    let rawText = text || '';

    // Handle DOCX files via mammoth
    if (fileData && (fileName?.toLowerCase().endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      try {
        const buffer = Buffer.from(fileData, 'base64');
        const docxResult = await mammoth.extractRawText({ buffer });
        rawText = docxResult.value || '';
      } catch (err) {
        console.warn('DOCX extraction warning:', err.message);
      }
    }

    const ai = getAI();
    if (ai) {
      const parts = [];

      if (fileData && (mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf') || mimeType?.startsWith('image/'))) {
        parts.push({
          inlineData: {
            mimeType: mimeType || (fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/png'),
            data: fileData,
          },
        });
        parts.push({
          text: `Extract all job requirement details from this JD document with maximum precision.
Include the complete clean extracted text in 'extractedText'.`,
        });
      } else {
        const contentText = rawText || (fileData ? Buffer.from(fileData, 'base64').toString('utf-8') : '');
        if (!contentText.trim()) {
          return res.status(400).json({ error: 'No readable JD text or file data provided.' });
        }
        parts.push({
          text: `Extract structured job profile and client requirement details from this text with high accuracy:
---
${contentText.slice(0, 45000)}
---
Include the full clean text in 'extractedText'.`,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: { parts },
        config: {
          systemInstruction: `You are an expert Job Description & Talent Requirement Analyzer for TalentStock Solutions.
Extract job requirement details with high accuracy:
- Extract hiring client/company name if present.
- Extract exact Job Title (e.g. Lead Full Stack Engineer, Senior QA Automation Engineer).
- Extract work location and mode (e.g. Mumbai / Hybrid, Remote, Bengaluru).
- Extract required experience range (e.g. 5-8 years, 3+ years).
- Categorize the industry domain (e.g. IT, Banking, Healthcare, Logistics).
- Extract qualification/degree requirements.
- Distinguish strictly between Mandatory/Must-Have Skills and Preferred/Good-to-Have Skills.
- Extract clear, well-structured roles and responsibilities.
- Extract salary budget / CTC range if specified.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              client: { type: Type.STRING, description: 'Hiring client or company name' },
              title: { type: Type.STRING, description: 'Job Title' },
              location: { type: Type.STRING, description: 'Work location / hybrid / remote mode' },
              experience: { type: Type.STRING, description: 'Required experience range (e.g. 4-7 years)' },
              industry: { type: Type.STRING, description: 'Industry or domain' },
              qualification: { type: Type.STRING, description: 'Academic qualification required' },
              salary: { type: Type.STRING, description: 'Budget / CTC range' },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Mandatory / must-have required skills',
              },
              preferred: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Good-to-have / preferred skills',
              },
              responsibilities: { type: Type.STRING, description: 'Key roles and responsibilities' },
              interviewMode: { type: Type.STRING, description: 'Interview mode (e.g. Virtual, In-person)' },
              extractedText: { type: Type.STRING, description: 'Full plain text of the job description' },
              confidence: { type: Type.INTEGER, description: 'Extraction confidence score (0-100)' },
            },
            required: ['title', 'location', 'experience', 'skills'],
          },
        },
      });

      const parsed = JSON.parse(response.text.trim());
      parsed.source = 'gemini-ai';
      if (!parsed.extractedText && rawText) parsed.extractedText = rawText;
      return res.json(parsed);
    }

    // Heuristic Fallback
    const content = rawText || (fileData ? Buffer.from(fileData, 'base64').toString('utf-8') : '');
    const fallback = fallbackJDExtract(content);
    return res.json(fallback);
  } catch (error) {
    console.error('JD extraction error:', error);
    const content = req.body.text || '';
    if (content) {
      return res.json(fallbackJDExtract(content));
    }
    res.status(500).json({ error: error.message || 'Failed to extract JD details' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', aiConfigured: !!process.env.GEMINI_API_KEY });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`TSS Resume Intelligence server running on http://${HOST}:${PORT}`);
});

