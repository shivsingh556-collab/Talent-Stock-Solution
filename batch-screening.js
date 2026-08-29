// TSS Batch Resume Screening & Sequential Evaluation Engine
(function () {
  'use strict';

  let currentBatchResults = [];
  let isBatchRunning = false;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function toast(msg) {
    if (window.toast) window.toast(msg);
    else console.log('[TSS Toast]', msg);
  }

  function nameFromFilename(fileName) {
    if (!fileName) return 'Candidate';
    const base = fileName.replace(/\.[^/.]+$/, '').replace(/[_.\-+]/g, ' ');
    const clean = base.replace(/resume|cv|profile|curriculum|vitae|updated|latest|\d{4,}/gi, '').trim();
    if (!clean) return base;
    return clean.replace(/\b\w/g, c => c.toUpperCase());
  }

  // Sequential Batch Processor
  async function processBatch(files) {
    if (!files || !files.length) return;
    if (isBatchRunning) {
      toast('A batch screening is already in progress');
      return;
    }

    const fileList = Array.from(files);
    const db = window.db;
    if (!db) {
      toast('Database not initialized');
      return;
    }

    const reqSelect = document.getElementById('screenRequirement') || document.getElementById('topRequirementSelect');
    const reqId = reqSelect?.value || (db.requirements?.find(r => r.status === 'Active') || db.requirements?.[0])?.id;
    const req = db.requirements?.find(x => x.id === reqId);

    if (!req) {
      toast('Please select or create a Job Requirement before screening resumes.');
      return;
    }

    isBatchRunning = true;
    currentBatchResults = [];

    // UI Progress Elements
    const progressWrap = document.getElementById('batchProgressContainer');
    const summaryWrap = document.getElementById('batchSummaryCard');
    const progressBar = document.getElementById('batchProgressBar');
    const progressStatus = document.getElementById('batchProgressStatus');
    const progressCount = document.getElementById('batchProgressCount');
    const progressFile = document.getElementById('batchProgressCurrentFile');

    if (progressWrap) progressWrap.classList.remove('hidden');
    if (summaryWrap) summaryWrap.classList.add('hidden');

    toast(`🚀 Starting batch screening of ${fileList.length} candidate CVs for ${req.title}…`);

    const total = fileList.length;

    for (let i = 0; i < total; i++) {
      const file = fileList[i];
      const percent = Math.round(((i) / total) * 100);

      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressCount) progressCount.textContent = `${i + 1} of ${total}`;
      if (progressStatus) progressStatus.textContent = `Extracting & evaluating candidate ${i + 1}/${total}…`;
      if (progressFile) progressFile.textContent = file.name;

      try {
        // Step 1: Extract candidate data via API or Local parser
        let data = null;
        if (window.TSSDocumentParser?.extractResumeAPI) {
          data = await window.TSSDocumentParser.extractResumeAPI({ file });
        } else if (window.TSSDocumentParser?.parseLocally) {
          const raw = await window.TSSDocumentParser.parseLocally(file);
          data = window.TSSDocumentParser.localExtractResume(raw);
        } else {
          const txt = await file.text();
          data = { name: nameFromFilename(file.name), extractedText: txt, skills: [] };
        }

        const candidateName = (data.name && data.name !== 'Candidate Name' && data.name !== 'Candidate' && !data.name.toLowerCase().includes('resume')) 
          ? data.name 
          : nameFromFilename(file.name);

        const resumeText = data.extractedText || `${candidateName} | ${data.designation || ''} | ${(data.skills || []).join(', ')}`;

        const curUser = window.TSSTeamIntelligence?.getCurrentUser ? window.TSSTeamIntelligence.getCurrentUser() : { name: 'Recruiter', email: 'recruiter@talent-stock.com', role: 'recruiter' };
        const payload = {
          name: candidateName.trim(),
          email: (data.email || '').trim(),
          phone: (data.phone || '').trim(),
          totalExperience: data.totalExperience || 0,
          location: (data.location || '').trim(),
          designation: (data.designation || '').trim(),
          currentCompany: (data.currentCompany || '').trim(),
          noticePeriod: (data.noticePeriod || '').trim(),
          currentCTC: (data.currentCTC || '').trim(),
          expectedCTC: (data.expectedCTC || '').trim(),
          skills: data.skills || [],
          resumeText: resumeText,
          resumeHash: simpleHash(resumeText),
          uploadDate: new Date().toISOString(),
          uploadedBy: curUser.name,
          recruiterEmail: curUser.email,
          sourceFile: file.name
        };

        // Step 2: Check / Store Candidate in DB
        let candidate = detectDuplicateCandidate(payload.email, payload.phone, payload.resumeText);
        if (candidate) {
          Object.assign(candidate, payload, { id: candidate.id, uploadDate: candidate.uploadDate });
        } else {
          candidate = { id: `C${Date.now()}_${i + 1}`, ...payload };
          db.candidates.push(candidate);
        }

        // Step 3: Screen & Score Candidate
        const scoreResult = typeof window.scoreCandidate === 'function' 
          ? window.scoreCandidate(resumeText, req, candidate)
          : localScoreCandidate(resumeText, req, candidate);

        candidate.lastScreenedDate = new Date().toISOString();
        const recommendation = typeof window.screeningLabel === 'function' 
          ? window.screeningLabel(scoreResult.score)
          : (scoreResult.score >= 75 ? 'Strong Match' : scoreResult.score >= 50 ? 'Review Recommended' : 'Not Suitable');

        const screeningRecord = {
          id: `S${Date.now()}_${i + 1}`,
          candidateId: candidate.id,
          candidateName: candidate.name,
          requirementId: req.id,
          requirementTitle: req.title,
          client: req.client,
          date: new Date().toISOString(),
          score: scoreResult.score,
          recommendation: recommendation,
          matched: scoreResult.matched || [],
          missing: scoreResult.missing || [],
          metrics: scoreResult,
          recruiterDecision: 'Pending',
          notes: `Batch screened from ${file.name} by ${curUser.name}`,
          manualOverride: false,
          screenedBy: curUser.name,
          recruiterEmail: curUser.email,
          recruiterRole: curUser.role,
          sourceFile: file.name
        };

        db.screenings.push(screeningRecord);
        db.activity.push({
          date: screeningRecord.date,
          title: 'Batch CV Screened',
          detail: `${candidate.name} — ${req.title} — ${scoreResult.score}/100`
        });

        // Step 4: Real-time Google Sheets Sync if active
        if (window.TSSGoogleSheets?.syncScreeningToSpreadsheet) {
          window.TSSGoogleSheets.syncScreeningToSpreadsheet(screeningRecord, candidate, req);
        }

        currentBatchResults.push({
          candidate,
          screening: screeningRecord,
          score: scoreResult.score,
          recommendation,
          fileName: file.name,
          extracted: data
        });

      } catch (err) {
        console.error(`Error screening file ${file.name}:`, err);
        toast(`⚠️ Warning: Could not fully parse ${file.name}`);
      }
    }

    // Step 5: Finalize Batch
    if (progressBar) progressBar.style.width = '100%';
    if (progressStatus) progressStatus.textContent = 'Finalizing batch rankings & updating database…';

    if (typeof window.saveDB === 'function') window.saveDB();
    if (typeof window.renderOldSite === 'function') window.renderOldSite();
    if (window.TSSGoogleSheets?.syncFullWorkspaceToMasterSheet) {
      window.TSSGoogleSheets.syncFullWorkspaceToMasterSheet(false);
    }

    // Sort by score descending
    currentBatchResults.sort((a, b) => b.score - a.score);

    setTimeout(() => {
      if (progressWrap) progressWrap.classList.add('hidden');
      isBatchRunning = false;
      renderBatchSummary(currentBatchResults, req);
      toast(`🎉 Batch screening complete! ${currentBatchResults.length} candidates ranked for ${req.title}`);

      // Auto-display top candidate in detailed scorecard
      if (currentBatchResults.length > 0) {
        const top = currentBatchResults[0];
        if (typeof window.showResult === 'function') {
          window.showResult(top.screening, top.candidate, req);
        }
      }
    }, 600);
  }

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    return String(h);
  }

  function detectDuplicateCandidate(email, phone, text) {
    const db = window.db;
    if (!db || !db.candidates) return null;
    return db.candidates.find(c =>
      (email && c.email && c.email.toLowerCase() === email.toLowerCase()) ||
      (phone && c.phone && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '')) ||
      (text && c.resumeHash === simpleHash(text))
    );
  }

  function localScoreCandidate(text, r, c = {}) {
    const hay = `${text} ${c.designation || ''} ${c.location || ''}`.toLowerCase();
    const mandatory = r.skills || [];
    const preferred = r.preferred || [];
    const matched = mandatory.filter(s => hay.includes(s.toLowerCase()));
    const missing = mandatory.filter(s => !matched.includes(s));
    const prefMatched = preferred.filter(s => hay.includes(s.toLowerCase()));

    const mandatoryPct = mandatory.length ? Math.round((matched.length / mandatory.length) * 100) : 70;
    const prefPct = preferred.length ? Math.round((prefMatched.length / preferred.length) * 100) : 70;
    const reqYears = parseFloat((r.experience || '').match(/[\d.]+/)?.[0] || 0);
    const candYears = parseFloat(c.totalExperience || 0);
    const expPct = reqYears ? Math.min(100, Math.round((candYears / reqYears) * 100)) : 75;

    let score = Math.round(mandatoryPct * 0.4 + prefPct * 0.1 + expPct * 0.25 + 20);
    score = Math.max(15, Math.min(98, score));

    return {
      score,
      matched,
      missing,
      prefMatched,
      mandatoryPct,
      prefPct,
      expPct,
      domainPct: 70,
      locPct: 75
    };
  }

  // Render Batch Results Summary Card & Ranked Shortlist Table
  function renderBatchSummary(results, requirement) {
    let container = document.getElementById('batchSummaryCard');
    if (!container) {
      container = document.createElement('article');
      container.id = 'batchSummaryCard';
      container.className = 'old-panel batch-summary-panel';
      const resultPanel = document.querySelector('#screening .result-panel');
      if (resultPanel && resultPanel.parentNode) {
        resultPanel.parentNode.insertBefore(container, resultPanel);
      }
    }

    container.classList.remove('hidden');

    const total = results.length;
    const strong = results.filter(r => r.recommendation === 'Strong Match').length;
    const review = results.filter(r => r.recommendation === 'Review Recommended').length;
    const low = results.filter(r => r.recommendation === 'Not Suitable').length;
    const avgScore = total ? Math.round(results.reduce((a, b) => a + b.score, 0) / total) : 0;

    container.innerHTML = `
      <div class="panel-title" style="margin-bottom:14px;border-bottom:1px solid #163654;padding-bottom:12px;">
        <div>
          <span class="purple-label">BATCH SCREENING COMPLETE</span>
          <h2 style="margin:4px 0 2px;color:#f0f6fc;font-size:20px;">Ranked Shortlist Summary (${total} Candidates)</h2>
          <p style="margin:0;color:#8bb6dc;font-size:12px;">Evaluated sequentially against <b>${esc(requirement.title)}</b> (${esc(requirement.client)})</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="exportBatchCsvBtn" class="toolbar-btn" style="height:36px;padding:0 12px;font-size:12px;font-weight:700;background:#0d2847;border-color:#2a5e8f;color:#c2e0ff;">
            📥 Export Batch CSV
          </button>
          <button id="syncBatchToSheetsBtn" class="toolbar-btn" style="height:36px;padding:0 12px;font-size:12px;font-weight:700;background:#0d3522;border-color:#238636;color:#7ee787;">
            📊 Sync to Google Sheets
          </button>
        </div>
      </div>

      <!-- Overview Stats Grid -->
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:16px;">
        <div style="background:#091b2c;border:1px solid #1c3e5e;border-radius:8px;padding:12px;text-align:center;">
          <small style="color:#8bb6dc;display:block;font-size:11px;font-weight:600;">TOTAL SCREENED</small>
          <strong style="font-size:22px;color:#f0f6fc;margin-top:4px;display:block;">${total}</strong>
        </div>
        <div style="background:#07281c;border:1px solid #196944;border-radius:8px;padding:12px;text-align:center;">
          <small style="color:#7ee787;display:block;font-size:11px;font-weight:600;">STRONG MATCH (≥75%)</small>
          <strong style="font-size:22px;color:#56d364;margin-top:4px;display:block;">${strong}</strong>
        </div>
        <div style="background:#2b2208;border:1px solid #7d5e16;border-radius:8px;padding:12px;text-align:center;">
          <small style="color:#e3b341;display:block;font-size:11px;font-weight:600;">REVIEW RECOMMENDED</small>
          <strong style="font-size:22px;color:#f2cc60;margin-top:4px;display:block;">${review}</strong>
        </div>
        <div style="background:#091b2c;border:1px solid #1f4973;border-radius:8px;padding:12px;text-align:center;">
          <small style="color:#79c0ff;display:block;font-size:11px;font-weight:600;">AVG. BATCH SCORE</small>
          <strong style="font-size:22px;color:#58a6ff;margin-top:4px;display:block;">${avgScore}%</strong>
        </div>
      </div>

      <!-- Ranked Candidates Table -->
      <div style="overflow-x:auto;border:1px solid #193856;border-radius:10px;background:#081827;">
        <table class="jobs-table" style="width:100%;margin:0;">
          <thead>
            <tr style="background:#0b2034;border-bottom:2px solid #1e456b;">
              <th style="width:60px;text-align:center;padding:12px 8px;">Rank</th>
              <th style="padding:12px 10px;">Candidate & Role</th>
              <th style="padding:12px 10px;">Exp & Location</th>
              <th style="width:110px;padding:12px 10px;">Match Score</th>
              <th style="width:140px;padding:12px 10px;">Recommendation</th>
              <th style="padding:12px 10px;">Key Matching Evidence</th>
              <th style="width:170px;text-align:right;padding:12px 10px;">Quick Action</th>
            </tr>
          </thead>
          <tbody>
            ${results.map((res, index) => {
              const c = res.candidate;
              const s = res.screening;
              const rank = index + 1;
              const badgeCls = res.recommendation === 'Strong Match' ? 'green' : res.recommendation === 'Review Recommended' ? 'amber' : 'red';
              const scoreColor = res.score >= 75 ? '#56d364' : res.score >= 50 ? '#e3b341' : '#f85149';
              const matchedChips = (s.matched || []).slice(0, 4).map(m => `<span style="display:inline-block;padding:2px 6px;margin:1px 2px;background:#0f385c;border-radius:4px;font-size:10px;color:#a5d6ff;">${esc(m)}</span>`).join('');
              const missingCount = (s.missing || []).length;

              return `
                <tr class="batch-row" data-index="${index}" style="border-bottom:1px solid #14304c;transition:background 0.2s;cursor:pointer;">
                  <td style="text-align:center;font-weight:800;font-size:14px;color:${rank === 1 ? '#e3b341' : '#8bb6dc'};">
                    ${rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`}
                  </td>
                  <td style="padding:10px;">
                    <div style="font-weight:700;color:#f0f6fc;font-size:13px;">${esc(c.name)}</div>
                    <small style="color:#8bb6dc;display:block;margin-top:2px;">${esc(c.designation || 'Profile')} ${c.currentCompany ? `· ${esc(c.currentCompany)}` : ''}</small>
                    <small style="color:#5f84a4;font-size:10px;">📄 ${esc(res.fileName || 'CV')}</small>
                  </td>
                  <td style="padding:10px;">
                    <div style="color:#d5ebff;font-size:12px;font-weight:600;">${c.totalExperience ? c.totalExperience + ' yrs' : '—'}</div>
                    <small style="color:#8bb6dc;">${esc(c.location || 'Location unconfirmed')}</small>
                  </td>
                  <td style="padding:10px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <strong style="color:${scoreColor};font-size:15px;">${res.score}%</strong>
                      <div style="flex:1;height:6px;background:#152f48;border-radius:99px;overflow:hidden;">
                        <div style="width:${res.score}%;height:100%;background:${scoreColor};"></div>
                      </div>
                    </div>
                  </td>
                  <td style="padding:10px;">
                    <span class="badge ${badgeCls}" style="font-weight:700;padding:4px 8px;">${res.recommendation}</span>
                  </td>
                  <td style="padding:10px;">
                    <div>${matchedChips || '<small style="color:#6f8aa4;">No keyword matches</small>'}</div>
                    ${missingCount > 0 ? `<small style="color:#f85149;display:block;margin-top:3px;">⚠ ${missingCount} gap(s): ${(s.missing || []).slice(0, 2).join(', ')}</small>` : '<small style="color:#7ee787;display:block;margin-top:3px;">✓ Zero mandatory gaps</small>'}
                  </td>
                  <td style="padding:10px;text-align:right;">
                    <div style="display:inline-flex;gap:6px;">
                      <button class="view-evaluation-btn btn primary" data-index="${index}" style="padding:4px 9px;font-size:11px;font-weight:700;">
                        View Report
                      </button>
                      <button class="quick-shortlist-btn btn ghost" data-index="${index}" style="padding:4px 8px;font-size:11px;color:#7ee787;border-color:#238636;">
                        ✓ Shortlist
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;color:#8bb6dc;font-size:12px;">
        <span>💡 Click any candidate row to view their comprehensive evaluation, score breakdown, and recruiter notes below.</span>
        <button id="clearBatchViewBtn" class="text-btn" style="color:#58a6ff;font-size:12px;font-weight:600;cursor:pointer;">
          Upload Another Batch
        </button>
      </div>
    `;

    // Wire Batch Actions
    container.querySelectorAll('.view-evaluation-btn, .batch-row').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.quick-shortlist-btn')) return;
        const idx = parseInt(el.getAttribute('data-index') || el.closest('[data-index]')?.getAttribute('data-index'), 10);
        if (!isNaN(idx) && results[idx]) {
          const selected = results[idx];
          if (typeof window.showResult === 'function') {
            window.showResult(selected.screening, selected.candidate, requirement);
            // Highlight selected row
            container.querySelectorAll('.batch-row').forEach((r, i) => {
              r.style.background = (i === idx) ? '#103252' : '';
            });
            document.querySelector('#screening .result-panel')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });

    container.querySelectorAll('.quick-shortlist-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (!isNaN(idx) && results[idx]) {
          const s = results[idx].screening;
          s.recruiterDecision = 'Shortlisted';
          btn.textContent = '✓ Shortlisted';
          btn.disabled = true;
          btn.style.background = '#0f3b25';
          if (typeof window.saveDB === 'function') window.saveDB();
          toast(`Candidate ${results[idx].candidate.name} marked as Shortlisted!`);
        }
      });
    });

    document.getElementById('exportBatchCsvBtn')?.addEventListener('click', () => {
      exportBatchCsv(results, requirement);
    });

    document.getElementById('syncBatchToSheetsBtn')?.addEventListener('click', () => {
      if (window.TSSGoogleSheets?.openSyncHub) {
        window.TSSGoogleSheets.openSyncHub();
      } else {
        toast('Google Sheets integration initialized');
      }
    });

    document.getElementById('clearBatchViewBtn')?.addEventListener('click', () => {
      const resumeInput = document.getElementById('resumeFile');
      if (resumeInput) resumeInput.value = '';
      document.querySelector('#screening .upload-card')?.scrollIntoView({ behavior: 'smooth' });
      toast('Ready for new batch upload');
    });
  }

  function exportBatchCsv(results, req) {
    if (!results || !results.length) {
      toast('No batch results to export');
      return;
    }

    const headers = [
      'Rank', 'Candidate Name', 'Designation', 'Experience (Years)', 'Location', 
      'Email', 'Phone', 'Match Score (%)', 'Recommendation', 'Job Title', 
      'Client', 'Matched Skills', 'Missing Skills', 'Source File', 'Evaluation Date'
    ];

    const rows = results.map((r, i) => [
      i + 1,
      r.candidate.name,
      r.candidate.designation || '',
      r.candidate.totalExperience || '',
      r.candidate.location || '',
      r.candidate.email || '',
      r.candidate.phone || '',
      r.score,
      r.recommendation,
      req.title,
      req.client,
      (r.screening.matched || []).join('; '),
      (r.screening.missing || []).join('; '),
      r.fileName || '',
      new Date().toLocaleString()
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `TSS_Batch_Ranked_Shortlist_${req.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('Batch CSV downloaded successfully');
  }

  // Setup UI DropZone & Multi-file support
  function setupBatchUI() {
    const resumeInput = document.getElementById('resumeFile');
    if (resumeInput) {
      resumeInput.setAttribute('multiple', 'multiple');
      resumeInput.setAttribute('accept', '.pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.webp');
    }

    const dropZone = document.querySelector('label.drop-zone[for="resumeFile"]');
    if (dropZone && !dropZone.dataset.batchWired) {
      dropZone.dataset.batchWired = 'true';
      dropZone.innerHTML = `
        <span style="font-size:32px;display:block;margin-bottom:6px;">📂</span>
        <strong style="font-size:15px;color:#f0f6fc;display:block;">Drop Candidate Resume(s) Here</strong>
        <small style="color:#8bb6dc;display:block;margin-top:4px;">Upload single or <b>multiple CV files at once</b> (PDF, DOCX, TXT)</small>
        <span style="display:inline-block;margin-top:10px;padding:3px 10px;background:#0d2847;border:1px solid #28557a;border-radius:999px;font-size:11px;font-weight:700;color:#79c0ff;">
          ⚡ Sequential AI Extraction & Shortlist Ranking
        </span>
      `;

      // Drag & Drop handlers
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.style.borderColor = '#388bfd';
          dropZone.style.background = '#0c2742';
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.style.borderColor = '';
          dropZone.style.background = '';
        }, false);
      });

      dropZone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          if (files.length === 1) {
            if (window.TSSDocumentParser?.handleResumeFile) {
              window.TSSDocumentParser.handleResumeFile(files[0]);
            }
          } else {
            processBatch(files);
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBatchUI);
  } else {
    setupBatchUI();
  }

  setTimeout(setupBatchUI, 200);
  setTimeout(setupBatchUI, 800);

  window.TSSBatchScreening = {
    processBatch,
    renderBatchSummary,
    exportBatchCsv,
    getCurrentResults: () => currentBatchResults
  };
})();
