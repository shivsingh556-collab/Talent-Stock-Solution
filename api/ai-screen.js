// TODO AI — secure serverless AI endpoint for resume extraction and screening.
// Runs on Vercel (or the local dev server). The AI key stays server-side only.
// Env vars required: OPENAI_API_KEY, OPENAI_BASE_URL (OpenAI-compatible).

const MAX_RESUME = 14000;
const MAX_JD = 7000;

const EXTRACT_MODEL = process.env.AI_EXTRACT_MODEL || 'gpt-5-mini';
const SCREEN_MODEL = process.env.AI_SCREEN_MODEL || 'gpt-5-mini';
const REASONING_EFFORT = process.env.AI_REASONING_EFFORT || 'low';

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

function screenContext(resume, candidate, req) {
  return `CLIENT REQUIREMENT
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
${clip(resume, MAX_RESUME)}`;
}

// Parallel call A — the numbers: scores, dimensions, per-skill ratings.
function scoringPrompt(ctx) {
  return `You are a rigorous technical recruitment consultant screening a candidate. Judge real capability from resume evidence, not keyword presence: recognize related/equivalent technologies (e.g. Postgres ≈ relational SQL experience), and penalize skills merely listed without evidence of use. Never inflate scores.

${ctx}

Scoring rules:
- overall_score 0-100. 85+ only for genuinely excellent fits. 70-84 strong. 50-69 possible with gaps. Below 50 poor fit.
- STRICT calibration: each mandatory skill with zero resume evidence must pull the score down hard. If 2+ mandatory skills score 0/10, mandatory_skills dimension must be under 40 and overall_score under 55. If half or more mandatory skills are missing, overall_score must be under 50.
- Every dimension score is 0-100 (NOT 0-10), each with a reason under 15 words.
- skill_ratings: rate EVERY mandatory and preferred skill 0-10 with short evidence from the resume (0 = no evidence at all). required=true for mandatory skills. Keep evidence under 15 words.
- confidence: 0-100.

Return STRICT JSON only, no markdown fences, exactly this shape:
{"overall_score":0,"confidence":0,"dimensions":{"mandatory_skills":{"score":0,"reason":""},"preferred_skills":{"score":0,"reason":""},"experience":{"score":0,"reason":""},"role_relevance":{"score":0,"reason":""},"domain":{"score":0,"reason":""},"location":{"score":0,"reason":""}},"skill_ratings":[{"skill":"","required":true,"rating":0,"years":0,"evidence":""}],"matched_skills":[],"missing_skills":[{"skill":"","impact":"high|medium|low","note":""}]}`;
}

// Parallel call B — the words: summary, strengths/concerns, red flags, questions, risk.
function narrativePrompt(ctx) {
  return `You are a senior recruitment consultant writing a candid screening brief for a hiring manager. Be specific to THIS candidate's actual companies and projects — no generic filler.

${ctx}

Rules:
- executive_summary: 2-3 sentences a recruiter could read aloud to the client.
- strengths / concerns: up to 4 each, under 15 words each.
- red_flags: only real ones (job hopping, gaps, overclaiming, notice/CTC/location conflicts). Empty array if none.
- interview_questions: 5 sharp questions tailored to this candidate's background and gaps, under 25 words each.
- risk_notes: joining/dropout risk (notice period, CTC jump, location) in under 40 words.
- recommendation_detail: 2-3 sentence final recommendation with a clear next step.

Return STRICT JSON only, no markdown fences, exactly this shape:
{"executive_summary":"","strengths":[],"concerns":[],"red_flags":[],"interview_questions":[],"risk_notes":"","recommendation_detail":""}`;
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
      reasoning_effort: REASONING_EFFORT,
      messages: [
        { role: 'system', content: 'You are a precise recruitment AI. You always return valid strict JSON with no markdown, no code fences, no commentary. All scores and numbers MUST be numeric digits (e.g. 55), never words.' },
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
  // Parse escalation: as-is → word-number fix → truncation repair → both.
  try { return JSON.parse(text); } catch {}
  try { return JSON.parse(fixWordNumbers(text)); } catch {}
  try { return JSON.parse(repairJSON(text)); } catch {}
  return JSON.parse(repairJSON(fixWordNumbers(text)));
}

// The model occasionally writes JSON numbers as words ("score": Fifty). Fix them.
const WORD_NUMS = { zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,hundred:100 };
function wordToNum(w) {
  // Split on spaces/hyphens and also camelCase joins like "ThirtyFive".
  const parts = String(w).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[\s-]+/).filter(Boolean);
  let total = 0, ok = parts.length > 0;
  for (const p of parts) { if (p === 'hundred') { total = (total || 1) * 100; } else if (p in WORD_NUMS) total += WORD_NUMS[p]; else ok = false; }
  return ok ? total : null;
}
function fixWordNumbers(text) {
  // Walk the JSON, skipping quoted strings, and replace bare word values after a colon.
  let out = '', i = 0, inStr = false, esc = false;
  while (i < text.length) {
    const ch = text[i];
    if (inStr) {
      out += ch;
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      i++; continue;
    }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    if (ch === ':') {
      const m = text.slice(i).match(/^(:\s*)([A-Za-z][A-Za-z -]{1,30}?)(\s*[,}\]])/);
      if (m) {
        const t = m[2].trim().toLowerCase();
        if (t !== 'true' && t !== 'false' && t !== 'null') {
          const n = wordToNum(m[2]);
          out += m[1] + (n !== null ? n : `"${m[2].trim()}"`) + m[3];
          i += m[0].length; continue;
        }
      }
    }
    out += ch; i++;
  }
  return out;
}

// Models occasionally emit malformed JSON (e.g. numbers as words); retry once.
async function callAIRetry(model, prompt) {
  try { return await callAI(model, prompt); }
  catch (e) { if (e.code === 'NO_CONFIG') throw e; return await callAI(model, prompt); }
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
      const out = await callAIRetry(EXTRACT_MODEL, extractPrompt(resume));
      return res.end(JSON.stringify({ ok: true, data: out }));
    }
    if (mode === 'screen') {
      const resume = String(body.resume || '');
      const candidate = body.candidate || {};
      const requirement = body.requirement || {};
      if (resume.trim().length < 40) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Resume text too short' })); }
      // Speed: run scoring and narrative as two smaller parallel AI calls, then merge.
      const ctx = screenContext(resume, candidate, requirement);
      const [scoring, narrative] = await Promise.all([
        callAIRetry(SCREEN_MODEL, scoringPrompt(ctx)),
        callAIRetry(SCREEN_MODEL, narrativePrompt(ctx))
      ]);
      const out = { ...narrative, ...scoring };
      // Normalize: some models return 0-1 or 0-10 scales despite instructions.
      const to100 = (v) => { let n = Number(v) || 0; if (n > 0 && n <= 1) n *= 100; else if (n > 1 && n <= 10) n *= 10; return Math.max(0, Math.min(100, Math.round(n))); };
      out.overall_score = to100(out.overall_score);
      out.confidence = to100(out.confidence);
      for (const k of Object.keys(out.dimensions || {})) out.dimensions[k].score = to100(out.dimensions[k].score);
      // Deterministic calibration guard: missing mandatory skills must cap the score,
      // regardless of how lenient the model felt. rating<=1 with no evidence = missing.
      const mand = (out.skill_ratings || []).filter(x => x && x.required);
      if (mand.length) {
        const missing = mand.filter(x => (Number(x.rating) || 0) <= 1).length;
        const ratio = missing / mand.length;
        let cap = 100;
        if (ratio >= 0.5) cap = 48;            // half or more mandatory skills absent
        else if (missing >= 2) cap = 55;       // multiple mandatory gaps
        else if (missing === 1) cap = 72;      // one mandatory gap blocks "Strong Match"
        if (out.overall_score > cap) {
          out.overall_score = cap;
          if (out.dimensions?.mandatory_skills) {
            out.dimensions.mandatory_skills.score = Math.min(out.dimensions.mandatory_skills.score, Math.round(100 * (1 - ratio)));
          }
        }
      }
      // Consistency guard: verdict must follow score.
      out.verdict = out.overall_score >= 75 ? 'Strong Match' : out.overall_score >= 50 ? 'Review Recommended' : 'Not Suitable';
      return res.end(JSON.stringify({ ok: true, data: out }));
    }
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Unknown mode' }));
  } catch (err) {
    res.statusCode = err.code === 'NO_CONFIG' ? 503 : 502;
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
};
