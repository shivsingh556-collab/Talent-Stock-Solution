// TSS Dedicated Master Google Spreadsheet Integration & Continuous Live Sync Module
(function () {
  'use strict';

  const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ];

  const STORAGE_KEY_ID = 'tss_master_spreadsheet_id';
  const STORAGE_KEY_TITLE = 'tss_master_spreadsheet_title';
  const STORAGE_KEY_URL = 'tss_master_spreadsheet_url';
  const STORAGE_KEY_LAST_SYNC = 'tss_master_spreadsheet_last_sync';

  let firebaseConfig = null;
  let auth = null;
  let currentUser = null;
  let cachedAccessToken = null;
  let isSigningIn = false;
  let isSyncing = false;

  let masterSpreadsheetId = localStorage.getItem(STORAGE_KEY_ID) || null;
  let masterSpreadsheetTitle = localStorage.getItem(STORAGE_KEY_TITLE) || 'TSS Master Recruitment Live Tracker';
  let masterSpreadsheetUrl = localStorage.getItem(STORAGE_KEY_URL) || null;
  let lastSyncTime = localStorage.getItem(STORAGE_KEY_LAST_SYNC) || null;

  function toast(msg) {
    if (window.toast) window.toast(msg);
    else console.log('[TSS Toast]', msg);
  }

  function setMasterSheet(id, title, url) {
    masterSpreadsheetId = id;
    masterSpreadsheetTitle = title || 'TSS Master Recruitment Live Tracker';
    masterSpreadsheetUrl = url || `https://docs.google.com/spreadsheets/d/${id}`;
    lastSyncTime = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY_ID, masterSpreadsheetId);
    localStorage.setItem(STORAGE_KEY_TITLE, masterSpreadsheetTitle);
    localStorage.setItem(STORAGE_KEY_URL, masterSpreadsheetUrl);
    localStorage.setItem(STORAGE_KEY_LAST_SYNC, lastSyncTime);

    updateAuthUI();
    updateLiveSyncBadge();
  }

  function clearMasterSheet() {
    masterSpreadsheetId = null;
    masterSpreadsheetUrl = null;
    lastSyncTime = null;
    localStorage.removeItem(STORAGE_KEY_ID);
    localStorage.removeItem(STORAGE_KEY_TITLE);
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
    updateAuthUI();
    updateLiveSyncBadge();
    toast('Dedicated master sheet reference cleared.');
  }

  // Load Firebase Config & Scripts
  async function loadFirebase() {
    if (window.firebase?.auth) return;

    await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js');

    try {
      const res = await fetch('/firebase-applet-config.json');
      firebaseConfig = await res.json();
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      auth = window.firebase.auth();

      auth.onAuthStateChanged(user => {
        currentUser = user;
        if (!user) {
          cachedAccessToken = null;
        }
        updateAuthUI();
        updateLiveSyncBadge();
      });
    } catch (e) {
      console.warn('Firebase init warning:', e);
    }
  }

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

  async function signInWithGoogle() {
    if (!auth) await loadFirebase();
    if (isSigningIn) return;

    try {
      isSigningIn = true;
      const provider = new window.firebase.auth.GoogleAuthProvider();
      SCOPES.forEach(scope => provider.addScope(scope));

      const result = await auth.signInWithPopup(provider);
      const credential = result.credential;
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      } else if (result._tokenResponse?.oauthAccessToken) {
        cachedAccessToken = result._tokenResponse.oauthAccessToken;
      }

      currentUser = result.user;
      toast(`Connected: ${currentUser.displayName || currentUser.email}`);
      updateAuthUI();
      updateLiveSyncBadge();
      renderSheetsSyncModal();

      // If user has a master sheet already, auto-sync full workspace on login
      if (masterSpreadsheetId) {
        syncFullWorkspaceToMasterSheet(false);
      }

      return { user: currentUser, accessToken: cachedAccessToken };
    } catch (error) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request' || error?.code === 'auth/user-cancelled') {
        console.log('Google Sign-in popup closed by user.');
        toast('Google sign-in was cancelled');
        return null;
      } else if (error?.code === 'auth/popup-blocked') {
        console.warn('Google Sign-in popup blocked:', error);
        toast('Sign-in popup blocked. Please allow popups for this site and try again.');
        return null;
      } else {
        console.error('Google Sign-in error:', error);
        toast(error.message || 'Google sign-in failed');
        return null;
      }
    } finally {
      isSigningIn = false;
    }
  }

  async function signOutGoogle() {
    if (auth) {
      await auth.signOut();
    }
    currentUser = null;
    cachedAccessToken = null;
    updateAuthUI();
    updateLiveSyncBadge();
    toast('Disconnected from Google account');
  }

  async function getAccessToken() {
    if (cachedAccessToken) return cachedAccessToken;
    if (currentUser) {
      const res = await signInWithGoogle();
      return res?.accessToken;
    }
    return null;
  }

  // Google Sheets API Helpers
  async function createSpreadsheet(title, sheets = ['Candidates', 'Screenings', 'Job Profiles', 'Interviews', 'Activity Log']) {
    const token = await getAccessToken();
    if (!token) throw new Error('Please sign in with Google first');

    const body = {
      properties: { title: title || `TSS Master Recruitment Live Tracker - ${new Date().toISOString().slice(0, 10)}` },
      sheets: sheets.map(s => ({ properties: { title: s } }))
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Failed to create spreadsheet (HTTP ${res.status})`);
    }

    return await res.json();
  }

  async function appendRows(spreadsheetId, range, values) {
    const token = await getAccessToken();
    if (!token) return null;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Failed to append rows to sheet (HTTP ${res.status})`);
    }

    return await res.json();
  }

  async function updateRange(spreadsheetId, range, values) {
    const token = await getAccessToken();
    if (!token) return null;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `Failed to write sheet (HTTP ${res.status})`);
    }

    return await res.json();
  }

  async function clearRange(spreadsheetId, range) {
    const token = await getAccessToken();
    if (!token) return null;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  // CREATE OR RE-INITIALIZE THE DEDICATED MASTER SPREADSHEET
  async function initializeMasterSpreadsheet(customTitle) {
    const token = await getAccessToken();
    if (!token) {
      toast('Please sign in with Google to create the Master Spreadsheet');
      return;
    }

    try {
      toast('Creating dedicated Master Google Spreadsheet…');
      const title = customTitle || `TSS Master Recruitment Live Tracker (${new Date().toLocaleDateString('en-GB')})`;
      const spreadsheet = await createSpreadsheet(title, ['Candidates', 'Screenings', 'Job Profiles', 'Interviews', 'Activity Log']);

      const newId = spreadsheet.spreadsheetId;
      const newUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newId}`;

      setMasterSheet(newId, title, newUrl);

      // Immediately populate all current database tables into this new sheet
      await syncFullWorkspaceToMasterSheet(true);

      toast(`🎉 Dedicated Master Sheet initialized & linked! All future evaluations will sync here.`);
      renderSheetsSyncModal();
      return spreadsheet;
    } catch (e) {
      console.error('Initialize Master Sheet Error:', e);
      toast(e.message || 'Failed to initialize Master Google Sheet');
    }
  }

  // SYNC COMPLETE WORKSPACE TO THE SAME DEDICATED MASTER SHEET
  async function syncFullWorkspaceToMasterSheet(showNotification = true) {
    if (!masterSpreadsheetId) {
      if (showNotification) toast('No Master Spreadsheet linked yet. Click "Create Master Live Spreadsheet"');
      return;
    }

    const token = await getAccessToken();
    if (!token) return;

    if (isSyncing) return;
    isSyncing = true;
    updateLiveSyncBadge('syncing');

    try {
      if (showNotification) toast('Syncing latest recruitment data to Master Sheet…');

      const db = window.db || { candidates: [], requirements: [], screenings: [], interviews: [], activity: [] };

      // 1. Tab: Candidates
      const candHeader = ['Candidate ID', 'Name', 'Email', 'Phone', 'Total Exp (Years)', 'Designation', 'Current Employer', 'Location', 'Skills', 'Notice Period', 'Current CTC', 'Expected CTC', 'Last Screened Date', 'Source File / Uploaded By'];
      const candRows = (db.candidates || []).map(c => [
        c.id || '',
        c.name || '',
        c.email || '',
        c.phone || '',
        c.totalExperience || '',
        c.designation || '',
        c.currentCompany || '',
        c.location || '',
        (c.skills || []).join(', '),
        c.noticePeriod || '',
        c.currentCTC || '',
        c.expectedCTC || '',
        c.lastScreenedDate || c.uploadDate || '',
        c.screenedBy || c.uploadedBy || 'Recruiter'
      ]);
      await clearRange(masterSpreadsheetId, 'Candidates!A1:Z5000');
      await updateRange(masterSpreadsheetId, 'Candidates!A1', [candHeader, ...candRows]);

      // 2. Tab: Screenings (Consolidated with Recruiter Information)
      const screenHeader = ['Screening ID', 'Recruiter Name', 'Candidate Name', 'Requirement Title', 'Client', 'Match Score (%)', 'Recommendation', 'Recruiter Decision', 'Evaluation Date', 'Matched Skills', 'Missing Mandatory Skills', 'Recruiter / AI Notes', 'Source File'];
      const screenRows = (db.screenings || []).map(s => {
        const c = db.candidates?.find(x => x.id === s.candidateId);
        const r = db.requirements?.find(x => x.id === s.requirementId);
        return [
          s.id || '',
          s.screenedBy || 'Recruiter',
          c?.name || s.candidateName || '',
          r?.title || s.requirementTitle || '',
          r?.client || s.client || '',
          s.score ? `${s.score}%` : '',
          s.recommendation || '',
          s.recruiterDecision || 'Pending',
          s.date ? new Date(s.date).toLocaleString() : '',
          (s.matched || []).join('; '),
          (s.missing || []).join('; '),
          s.notes || '',
          s.sourceFile || ''
        ];
      });
      await clearRange(masterSpreadsheetId, 'Screenings!A1:Z5000');
      await updateRange(masterSpreadsheetId, 'Screenings!A1', [screenHeader, ...screenRows]);

      // 3. Tab: Job Profiles
      const reqHeader = ['Requirement ID', 'Client Name', 'Job Title', 'Status', 'Location', 'Experience', 'Industry', 'Mandatory Skills', 'Preferred Skills', 'Qualification', 'Responsibilities Summary'];
      const reqRows = (db.requirements || []).map(r => [
        r.id || '',
        r.client || '',
        r.title || '',
        r.status || 'Active',
        r.location || '',
        r.experience || '',
        r.industry || '',
        (r.skills || []).join(', '),
        (r.preferred || []).join(', '),
        r.qualification || '',
        r.responsibilities || ''
      ]);
      await clearRange(masterSpreadsheetId, 'Job Profiles!A1:Z1000');
      await updateRange(masterSpreadsheetId, 'Job Profiles!A1', [reqHeader, ...reqRows]);

      // 4. Tab: Interviews
      const intHeader = ['Candidate', 'Position', 'Client', 'Date', 'Time', 'Mode', 'Status'];
      const intRows = (db.interviews || []).map(i => [
        i.candidate || '',
        i.position || '',
        i.client || '',
        i.date || '',
        i.time || '',
        i.mode || 'Virtual',
        'Scheduled'
      ]);
      await clearRange(masterSpreadsheetId, 'Interviews!A1:Z1000');
      await updateRange(masterSpreadsheetId, 'Interviews!A1', [intHeader, ...intRows]);

      // 5. Tab: Activity Log
      const actHeader = ['Timestamp', 'Action / Event', 'Details'];
      const actRows = (db.activity || []).slice(-100).reverse().map(a => [
        a.date ? new Date(a.date).toLocaleString() : new Date().toLocaleString(),
        a.title || '',
        a.detail || ''
      ]);
      await clearRange(masterSpreadsheetId, 'Activity Log!A1:Z1000');
      await updateRange(masterSpreadsheetId, 'Activity Log!A1', [actHeader, ...actRows]);

      lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, lastSyncTime);

      if (showNotification) toast(`✓ Master Google Sheet updated with latest recruitment records!`);
      updateLiveSyncBadge('active');
    } catch (e) {
      console.error('Master Sheet sync error:', e);
      if (showNotification) toast(`⚠️ Master sheet sync: ${e.message}`);
      updateLiveSyncBadge('error');
    } finally {
      isSyncing = false;
    }
  }

  // REAL-TIME AUTO-APPEND / UPDATE FOR SINGLE SCREENING
  async function syncScreeningToSpreadsheet(screening, candidate, requirement) {
    if (!masterSpreadsheetId) return;
    const token = await getAccessToken();
    if (!token) return;

    try {
      const row = [
        screening.id || `S${Date.now()}`,
        candidate?.name || '',
        requirement?.title || '',
        requirement?.client || '',
        `${screening.score}%`,
        screening.recommendation || '',
        screening.recruiterDecision || 'Pending',
        new Date().toLocaleString(),
        (screening.matched || []).join('; '),
        (screening.missing || []).join('; '),
        screening.notes || '',
        screening.sourceFile || ''
      ];
      await appendRows(masterSpreadsheetId, 'Screenings!A:L', [row]);

      // Also ensure candidate row exists in Candidates tab
      if (candidate) {
        const candRow = [
          candidate.id || '',
          candidate.name || '',
          candidate.email || '',
          candidate.phone || '',
          candidate.totalExperience || '',
          candidate.designation || '',
          candidate.currentCompany || '',
          candidate.location || '',
          (candidate.skills || []).join(', '),
          candidate.noticePeriod || '',
          candidate.currentCTC || '',
          candidate.expectedCTC || '',
          candidate.lastScreenedDate || new Date().toISOString(),
          candidate.sourceFile || 'Recruiter'
        ];
        await appendRows(masterSpreadsheetId, 'Candidates!A:N', [candRow]);
      }

      lastSyncTime = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, lastSyncTime);
      updateLiveSyncBadge('active');
    } catch (e) {
      console.warn('Real-time screening append skipped:', e.message);
    }
  }

  // REAL-TIME RECRUITER DECISION SYNC
  async function syncDecisionUpdate(screeningId, decision, notes) {
    if (!masterSpreadsheetId) return;
    // Trigger lightweight debounced full sync to ensure decision column matches exactly
    debounceFullSync();
  }

  let syncDebounceTimer = null;
  function debounceFullSync() {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      syncFullWorkspaceToMasterSheet(false);
    }, 1500);
  }

  // Update Live Sync Badge in TopBar
  function updateLiveSyncBadge(state = 'idle') {
    let badge = document.getElementById('masterSheetLiveBadge');
    if (!badge) {
      const topBar = document.querySelector('.topbar');
      if (topBar) {
        badge = document.createElement('div');
        badge.id = 'masterSheetLiveBadge';
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;margin-right:8px;';
        topBar.insertBefore(badge, document.getElementById('googleAuthBtn') || topBar.firstChild);
        badge.addEventListener('click', () => renderSheetsSyncModal());
      }
    }

    if (!badge) return;

    if (!currentUser) {
      badge.style.display = 'none';
      return;
    }

    badge.style.display = 'inline-flex';

    if (masterSpreadsheetId) {
      if (state === 'syncing') {
        badge.style.background = '#1b324f';
        badge.style.border = '1px solid #388bfd';
        badge.style.color = '#79c0ff';
        badge.innerHTML = `<span>⏳</span> Syncing to Master Sheet…`;
      } else {
        badge.style.background = '#0d3522';
        badge.style.border = '1px solid #238636';
        badge.style.color = '#7ee787';
        badge.innerHTML = `<span>🟢</span> <b>Live Sheet Active:</b> ${esc(masterSpreadsheetTitle.slice(0, 22))}…`;
      }
    } else {
      badge.style.background = '#2c220b';
      badge.style.border = '1px solid #8f6b1e';
      badge.style.color = '#e3b341';
      badge.innerHTML = `<span>⚠️</span> <b>Setup Master Sheet</b>`;
    }
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function updateAuthUI() {
    const btn = document.getElementById('googleAuthBtn');
    if (btn) {
      if (currentUser) {
        btn.classList.add('connected');
        btn.innerHTML = `
          <img src="${currentUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" />
          <b>Google Sheets Live</b>
        `;
      } else {
        btn.classList.remove('connected');
        btn.innerHTML = `
          <svg style="width:15px;height:15px;" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
          </svg>
          <b>Connect Google Sheets</b>
        `;
      }
    }
  }

  function injectTopBarElements() {
    const topBar = document.querySelector('.topbar');
    if (!topBar || document.getElementById('googleAuthBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'googleAuthBtn';
    btn.className = 'toolbar-btn google-sync-btn';
    btn.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:6px 12px;background:#0d233a;border:1px solid #295b8d;border-radius:8px;color:#cbe4fc;font-size:12px;cursor:pointer;white-space:nowrap;transition:all 0.2s;';
    btn.innerHTML = `
      <svg style="width:15px;height:15px;" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
      </svg>
      <b>Google Sheets Hub</b>
    `;

    btn.addEventListener('click', () => {
      renderSheetsSyncModal();
    });

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      topBar.insertBefore(btn, exportBtn);
    } else {
      topBar.appendChild(btn);
    }

    updateLiveSyncBadge();

    // Add Google Sheets navigation tab to sidebar
    const nav = document.getElementById('nav');
    if (nav && !document.querySelector('.nav-item[data-view="googlesheets"]')) {
      const navItem = document.createElement('button');
      navItem.className = 'nav-item';
      navItem.setAttribute('data-view', 'googlesheets');
      navItem.innerHTML = `<span>📊</span>Google Sheets Master`;
      navItem.addEventListener('click', () => {
        renderSheetsSyncModal();
      });
      nav.appendChild(navItem);
    }
  }

  // RENDER DEDICATED MASTER GOOGLE SPREADSHEET MODAL
  function renderSheetsSyncModal() {
    let modal = document.getElementById('googleSheetsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'googleSheetsModal';
      modal.className = 'todo-modal';
      document.body.appendChild(modal);
    }

    modal.classList.remove('hidden');

    const db = window.db || {};
    const candCount = (db.candidates || []).length;
    const reqCount = (db.requirements || []).length;
    const screenCount = (db.screenings || []).length;

    modal.innerHTML = `
      <div class="todo-modal-card" style="max-width:800px;width:95%;background:#09192b;border:1px solid #1f456c;box-shadow:0 25px 70px rgba(0,0,0,0.75);">
        <button id="closeSheetsModal" class="todo-close" style="color:#a8c7fa;font-size:22px;">×</button>
        
        <div style="display:flex;align-items:center;gap:14px;border-bottom:1px solid #163255;padding-bottom:16px;margin-bottom:20px;">
          <div style="width:48px;height:48px;border-radius:12px;background:#0d3522;border:1px solid #238636;display:flex;align-items:center;justify-content:center;color:#7ee787;font-size:24px;">
            📊
          </div>
          <div>
            <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#79c0ff;">DEDICATED LIVE SPREADSHEET INTEGRATION</span>
            <h2 style="margin:2px 0 0;color:#f0f6fc;font-size:20px;">Master Google Spreadsheet Live Sync</h2>
          </div>
        </div>

        ${!currentUser ? `
          <div style="background:#0c2238;border:1px solid #204c7a;border-radius:12px;padding:26px;text-align:center;margin-bottom:20px;">
            <h3 style="color:#d5ebff;margin:0 0 8px;font-size:18px;">Sign In to Connect Your Dedicated Master Spreadsheet</h3>
            <p style="color:#8bb6dc;font-size:13px;max-width:540px;margin:0 auto 20px;line-height:1.5;">
              Sign in once to generate a dedicated Master Google Spreadsheet. Every new resume screened, candidate evaluated, and recruiter decision will <b>automatically update that exact same sheet in real time</b>.
            </p>
            <button id="modalGoogleSignInBtn" class="gsi-material-button" style="background:#ffffff;border:1px solid #747775;border-radius:8px;padding:11px 26px;font-family:'Roboto',sans-serif;font-size:14px;font-weight:600;color:#1f1f1f;cursor:pointer;display:inline-flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="width:20px;height:20px;display:block;">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        ` : `
          <!-- User Profile & Master Sheet Status Header -->
          <div style="background:#092138;border:1px solid #1f4f7d;border-radius:12px;padding:16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${currentUser.photoURL || 'https://lh3.googleusercontent.com/a/default-user'}" style="width:38px;height:38px;border-radius:50%;border:2px solid #388bfd;" />
              <div>
                <strong style="color:#e6edf3;font-size:14px;display:block;">${currentUser.displayName || 'Recruiter'}</strong>
                <small style="color:#8bb6dc;">${currentUser.email} · Google Connected</small>
              </div>
            </div>
            <button id="modalGoogleSignOutBtn" style="background:#21262d;border:1px solid #30363d;color:#f85149;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              Sign Out
            </button>
          </div>

          <!-- PRIMARY ACTIVE MASTER SPREADSHEET CARD -->
          <div style="background:${masterSpreadsheetId ? 'linear-gradient(135deg, #07281a, #061e13)' : '#0d2238'};border:1px solid ${masterSpreadsheetId ? '#238636' : '#23527c'};border-radius:12px;padding:18px;margin-bottom:20px;">
            ${masterSpreadsheetId ? `
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#56d364;box-shadow:0 0 8px #56d364;"></span>
                    <span style="font-size:12px;font-weight:800;letter-spacing:1px;color:#7ee787;">DEDICATED LIVE SPREADSHEET ACTIVE</span>
                  </div>
                  <h3 style="margin:6px 0 3px;color:#f0f6fc;font-size:17px;">${esc(masterSpreadsheetTitle)}</h3>
                  <div style="font-size:12px;color:#aff5b4;">
                    Last Synced: <b>${lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Active'}</b> · All single & batch screenings continuously update this sheet.
                  </div>
                </div>
                <a href="${masterSpreadsheetUrl}" target="_blank" style="background:#238636;color:#ffffff;text-decoration:none;padding:8px 16px;border-radius:6px;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;">
                  Open Live Sheet ↗
                </a>
              </div>

              <div style="margin-top:14px;display:flex;gap:10px;border-top:1px solid #16462c;padding-top:14px;flex-wrap:wrap;">
                <button id="syncNowMasterBtn" class="blue-btn" style="padding:8px 16px;font-size:12px;font-weight:700;">
                  🔄 Sync Entire Workspace to this Sheet Now
                </button>
                <button id="recreateMasterSheetBtn" class="btn ghost" style="padding:7px 12px;font-size:12px;color:#79c0ff;border-color:#2a5e8f;">
                  ✨ Create Fresh Dedicated Sheet
                </button>
                <button id="clearMasterSheetBtn" class="text-btn" style="color:#f85149;font-size:12px;cursor:pointer;margin-left:auto;">
                  Unlink Sheet
                </button>
              </div>
            ` : `
              <div style="text-align:center;padding:12px 10px;">
                <span style="font-size:28px;display:block;margin-bottom:8px;">📋</span>
                <h3 style="color:#f0f6fc;margin:0 0 6px;font-size:17px;">No Dedicated Master Sheet Linked Yet</h3>
                <p style="color:#8bb6dc;font-size:13px;max-width:540px;margin:0 auto 16px;">
                  Initialize a brand new dedicated Master Spreadsheet. The app will create the required tabs (<b>Candidates</b>, <b>Screenings</b>, <b>Job Profiles</b>, <b>Interviews</b>, <b>Activity Log</b>) and use this single sheet for all continuous updates.
                </p>
                <button id="initMasterSheetBtn" class="blue-btn" style="padding:10px 24px;font-size:14px;font-weight:700;border-radius:8px;">
                  ✨ Initialize Dedicated Master Live Spreadsheet
                </button>
              </div>
            `}
          </div>

          <!-- Existing Sheet Link Option -->
          <div style="background:#0a1e33;border:1px solid #1c456f;border-radius:10px;padding:14px;margin-bottom:16px;">
            <label style="font-size:12px;font-weight:700;color:#c9d1d9;display:block;margin-bottom:6px;">
              Or bind to an existing Google Spreadsheet URL / ID to use as the permanent target:
            </label>
            <div style="display:flex;gap:8px;">
              <input id="customSheetIdInput" placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit" style="flex:1;background:#061423;border:1px solid #204c7a;color:#f0f6fc;padding:8px 12px;border-radius:6px;font-size:13px;" />
              <button id="bindCustomSheetBtn" class="toolbar-btn" style="padding:8px 16px;white-space:nowrap;font-size:12px;font-weight:700;background:#0d2847;border-color:#2a5e8f;color:#c2e0ff;">
                Set as Live Master
              </button>
            </div>
          </div>

          <!-- What is Synced Info -->
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;font-size:11px;color:#8bb6dc;">
            <div style="background:#071828;border:1px solid #143553;border-radius:8px;padding:10px;">
              <strong style="color:#d5ebff;display:block;margin-bottom:2px;">Candidates (${candCount})</strong>
              Auto-synced with contact details, skills & experience.
            </div>
            <div style="background:#071828;border:1px solid #143553;border-radius:8px;padding:10px;">
              <strong style="color:#d5ebff;display:block;margin-bottom:2px;">Screenings (${screenCount})</strong>
              Auto-synced with scores, evidence & recruiter decisions.
            </div>
            <div style="background:#071828;border:1px solid #143553;border-radius:8px;padding:10px;">
              <strong style="color:#d5ebff;display:block;margin-bottom:2px;">Job Profiles (${reqCount})</strong>
              Auto-synced with JD skills, industry & requirements.
            </div>
          </div>
        `}
      </div>
    `;

    // Wire Events
    document.getElementById('closeSheetsModal')?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('modalGoogleSignInBtn')?.addEventListener('click', async () => {
      await signInWithGoogle();
    });

    document.getElementById('modalGoogleSignOutBtn')?.addEventListener('click', async () => {
      await signOutGoogle();
      renderSheetsSyncModal();
    });

    document.getElementById('initMasterSheetBtn')?.addEventListener('click', async () => {
      await initializeMasterSpreadsheet();
    });

    document.getElementById('syncNowMasterBtn')?.addEventListener('click', async () => {
      await syncFullWorkspaceToMasterSheet(true);
    });

    document.getElementById('recreateMasterSheetBtn')?.addEventListener('click', async () => {
      if (confirm('Create a brand new dedicated Master Spreadsheet and switch future live syncing to it?')) {
        await initializeMasterSpreadsheet();
      }
    });

    document.getElementById('clearMasterSheetBtn')?.addEventListener('click', () => {
      if (confirm('Unlink this Master Spreadsheet? You can create a new one anytime.')) {
        clearMasterSheet();
        renderSheetsSyncModal();
      }
    });

    document.getElementById('bindCustomSheetBtn')?.addEventListener('click', async () => {
      const val = document.getElementById('customSheetIdInput')?.value.trim();
      if (!val) { toast('Please enter a spreadsheet URL or ID'); return; }
      const match = val.match(/\/d\/([a-zA-Z0-9-_]+)/) || [null, val];
      const sheetId = match[1] || val;

      setMasterSheet(sheetId, 'Connected Master Spreadsheet', `https://docs.google.com/spreadsheets/d/${sheetId}`);
      await syncFullWorkspaceToMasterSheet(true);
      renderSheetsSyncModal();
      toast('Spreadsheet linked as the active Master Live Tracker!');
    });
  }

  // Auto initialize on document load
  function init() {
    loadFirebase();
    injectTopBarElements();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(injectTopBarElements, 300);
  setTimeout(injectTopBarElements, 1000);

  window.TSSGoogleSheets = {
    signInWithGoogle,
    signOutGoogle,
    getAccessToken,
    createSpreadsheet,
    initializeMasterSpreadsheet,
    syncFullWorkspaceToMasterSheet,
    syncScreeningToSpreadsheet,
    syncDecisionUpdate,
    setMasterSheet,
    clearMasterSheet,
    getMasterSheetId: () => masterSpreadsheetId,
    openSyncHub: renderSheetsSyncModal
  };
})();
