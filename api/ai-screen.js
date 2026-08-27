// TODO AI — secure serverless AI endpoint for resume extraction and screening.
// Runs on Vercel (or the local dev server). The AI key stays server-side only.
// Env vars required: OPENAI_API_KEY, OPENAI_BASE_URL (OpenAI-compatible).

const MAX_RESUME = 14000;
const MAX_JD = 7000;

const EXTRACT_MODEL = process.env.AI_EXTRACT_MODEL || 'gpt-5-mini';
const SCREEN_MODEL = process.env.AI_SCREEN_MODEL || 'gpt-5.1';

function clip(s, n) { return String(s || '').slice(0, n); }

function extractPrompt(resume) {
  return `You are an elite resume parser used by a professional recruitment agency in India.
Read the resume below and extract candidate data with maximum precision.

Rules:
- Extract ONLY what is truly in the resume. Never invent data. Use "" when absent.
- name: the candidate's real full name (proper case). Never a heading like "Curriculum Vitae".
- phone: 10-digit Indian mobile if present (strip +91/0 prefix), else the raw number.
- total_experience_years: compute carefully from employment dates if not declared; resolve overlaps; number with 1 decimal.
- skills: ALL genuine professional skills, deduplicated, canonical names (e.g. "React" not "reactjs").
- For each skill give: rating 1-10 of demonstrated proficiency judged from projects, seniority, recency and depth of usage (not just being listed); years of hands-on use if inferable; a short evidence quote/paraphrase from the resume.
- warnings: real inconsistencies (date gaps, declared vs calculated experience mismatch, missing contact info).
- confidence: 0-100 honest overall extraction confidence.

Return STRICT JSON only, no markdown fences, exactly this shape:
{"name":"","email":"","phone":"","location":"","total_experience_years":0,"relevant_experience_years":0,"current_designation":"","current_company":"","notice_period":"","current_ctc":"","expected_ctc":"","education":"","skills":[{"skill":"","rating":0,"years":0,"evidence":""}],"summary":"one crisp recruiter-facing sentence about who this candidate is","warnings":[],"confidence":0}

RESUME:
${clip(resume, MAX_RESUME)}`;
}

function screenPrompt(resume, candidate, req) {
  return `You are a highly experienced technical recruitment consultant screening a candidate for a client role. Be rigorous, evidence-based and honest — like a senior recruiter who has read thousands of resumes. Judge real capability, not keyword presence: recognize related/equivalent technologies (e.g. Postgres ≈ relational SQL experience), and penalize skills that are merely listed without evidence of use.

CLIENT REQUIREMENT
Client: ${clip(req.client, 120)}
Role: ${clip(req.title, 160)}
Location: ${clip(req.location, 120)}
Experience required: ${clip(req.experience, 80)}
Mandatory skills: ${clip((req.skills || []).join(', '), 800)}
Preferred skills: ${clip((req.preferred || []).join(', '), 500)}
Qualification: ${clip(req.qualification, 200)}
Responsibilities / JD: ${clip(req.responsibilities || req.jdText, MAX_JD)}

CANDIDATE FORM DATA (recruiter-entered, may be incomplete)
Name: ${clip(candidate.name, 100)} | Location: ${clip(candidate.location, 100)} | Experience: ${clip(candidate.totalExperience, 20)}y | Designation: ${clip(candidate.designation, 120)} | Notice: ${clip(candidate.noticePeriod, 60)} | Current CTC: ${clip(candidate.currentCTC, 60)} | Expected CTC: ${clip(candidate.expectedCTC, 60)}

RESUME TEXT
${clip(resume, MAX_RESUME)}

Scoring guidance:
- overall_score 0-100. 85+ only for genuinely excellent fits. 70-84 strong. 50-69 possible with gaps. Below 50 poor fit. Never inflate.
- verdict: "Strong Match" (>=75), "Review Recommended" (50-74), "Not Suitable" (<50) — must be consistent with overall_score.
- skill_ratings: rate EVERY mandatory and preferred skill 0-10 with evidence quoted/paraphrased from the resume ("0" = no evidence at all). required=true for mandatory skills.
- dimension scores 0-100 each with a one-line reason.
- executive_summary: 2-3 sentences a recruiter could read aloud to a hiring manager — specific to THIS person, mentioning their actual companies/projects, not generic filler.
- red_flags: job hopping, gaps, inconsistencies, overclaiming, notice/CTC/location conflicts. Empty array if none.
- interview_questions: 5 sharp questions tailored to THIS candidate's actual background and the gaps you found.
- risk_notes: joining/dropout risk based on notice period, CTC jump expectations, location mismatch.

Return STRICT JSON only, no markdown fences, exactly this shape:
{"overall_score":0,"verdict":"","confidence":0,"executive_summary":"","dimensions":{"mandatory_skills":{"score":0,"reason":""},"preferred_skills":{"score":0,"reason":""},"experience":{"score":0,"reason":""},"role_relevance":{"score":0,"reason":""},"domain":{"score":0,"reason":""},"location":{"score":0,"reason":""}},"skill_ratings":[{"skill":"","required":true,"rating":0,"years":0,"evidence":""}],"matched_skills":[],"missing_skills":[{"skill":"","impact":"high|medium|low","note":""}],"strengths":[],"concerns":[],"red_flags":[],"interview_questions":[],"risk_notes":"","recommendation_detail":"3-4 sentence final recommendation with clear next step"}`;
}

async function callAI(model, prompt) {
  const base = (process.env.OPENAI_BASE_URL || '').replace(/\/$/, '');
  const key = process.env.OPENAI_API_KEY;
  if (!base || !key) { const e = new Error('AI not configured'); e.code = 'NO_CONFIG'; throw e; }
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a precise recruitment AI. You always return valid strict JSON with no markdown, no code fences, no commentary.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 16000
    })
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`AI upstream ${r.status}: ${body.slice(0, 300)}`);
  }
  const data = await r.json();
  let text = data?.choices?.[0]?.message?.content || '';
  text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { return JSON.parse(repairJSON(text)); }
}

// Repairs a JSON string that was truncated mid-way (e.g. token limit hit):
// trims a dangling partial value, then closes any open strings/brackets.
function repairJSON(text) {
  let s = String(text || '').trim();
  const stack = [];
  let inStr = false, esc = false, lastComplete = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = false; lastComplete = i + 1; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') { stack.push(ch); continue; }
    if (ch === '}' || ch === ']') { stack.pop(); lastComplete = i + 1; continue; }
    if (ch === ',' || ch === ':') continue;
  }
  // Cut back to the last completed value, then drop a trailing comma/colon+key.
  s = s.slice(0, Math.max(lastComplete, 1));
  s = s.replace(/,\s*$/, '').replace(/,?\s*"[^"]*"\s*:\s*$/, '');
  // Recompute open brackets on the trimmed string and close them.
  const open = [];
  inStr = false; esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) { esc = false; } else if (ch === '\\') { esc = true; } else if (ch === '"') { inStr = false; } continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') open.push(ch);
    else if (ch === '}' || ch === ']') open.pop();
  }
  while (open.length) s += open.pop() === '{' ? '}' : ']';
  return s;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 2_000_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'POST only' })); }
  try {
    const body = await readBody(req);
    const mode = body.mode;
    if (mode === 'ping') {
      const ok = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_BASE_URL);
      return res.end(JSON.stringify({ ok, ai: ok }));
    }
    if (mode === 'extract') {
      const resume = String(body.resume || '');
      if (resume.trim().length < 40) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Resume text too short' })); }
      const out = await callAI(EXTRACT_MODEL, extractPrompt(resume));
      return res.end(JSON.stringify({ ok: true, data: out }));
    }
    if (mode === 'screen') {
      const resume = String(body.resume || '');
      const candidate = body.candidate || {};
      const requirement = body.requirement || {};
      if (resume.trim().length < 40) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Resume text too short' })); }
      const out = await callAI(SCREEN_MODEL, screenPrompt(resume, candidate, requirement));
      // Consistency guard: verdict must follow score.
      const s = Math.max(0, Math.min(100, Math.round(Number(out.overall_score) || 0)));
      out.overall_score = s;
      out.verdict = s >= 75 ? 'Strong Match' : s >= 50 ? 'Review Recommended' : 'Not Suitable';
      return res.end(JSON.stringify({ ok: true, data: out }));
    }
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Unknown mode' }));
  } catch (err) {
    res.statusCode = err.code === 'NO_CONFIG' ? 503 : 502;
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
};
