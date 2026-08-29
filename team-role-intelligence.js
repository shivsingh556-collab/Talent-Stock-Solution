// TSS Team & Role-Based Intelligence Module
// Provides:
// 1. Recruiter Private Workspaces ("recruiters ka alag alag rahega")
// 2. Admin 360° Consolidated Master Report & Recruiter Comparison Matrix ("admins can get the whole report of all recruiters and admins")
// 3. Fast Role & Recruiter Profile Switcher

(function () {
  'use strict';

  const STORAGE_KEY_USER = 'tss_user_session';
  const STORAGE_KEY_VIEW_FILTER = 'tss_admin_recruiter_filter';

  // Standard TSS Team Members
  const TEAM_MEMBERS = [
    {
      id: 'admin_shiv',
      name: 'Shiv Singh',
      email: 'admin@talent-stock.com',
      role: 'admin',
      title: 'Managing Director & Lead',
      avatar: '👨‍💼',
      color: '#79c0ff',
      target: 40
    },
    {
      id: 'rec_priya',
      name: 'Priya Sharma',
      email: 'priya.sharma@talent-stock.com',
      role: 'recruiter',
      title: 'Senior Tech & Fullstack Recruiter',
      avatar: '👩‍💼',
      color: '#7ee787',
      target: 30
    },
    {
      id: 'rec_rohit',
      name: 'Rohit Verma',
      email: 'rohit.verma@talent-stock.com',
      role: 'recruiter',
      title: 'IT & Database Specialist Recruiter',
      avatar: '👨‍💻',
      color: '#d2a8ff',
      target: 25
    },
    {
      id: 'rec_ananya',
      name: 'Ananya Patel',
      email: 'ananya.patel@talent-stock.com',
      role: 'recruiter',
      title: 'Engineering & Services Recruiter',
      avatar: '👩‍🔧',
      color: '#ffa657',
      target: 25
    },
    {
      id: 'rec_vikram',
      name: 'Vikram Singh',
      email: 'vikram.singh@talent-stock.com',
      role: 'recruiter',
      title: 'Executive & Non-IT Recruiter',
      avatar: '👨‍💼',
      color: '#ff7b72',
      target: 20
    }
  ];

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function getCurrentUser() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY_USER) || 'null');
      if (s && s.email) {
        const found = TEAM_MEMBERS.find(m => m.email.toLowerCase() === s.email.toLowerCase());
        if (found) return { ...found, ...s };
        return {
          id: s.id || `user_${s.email.split('@')[0]}`,
          name: s.name || s.email.split('@')[0],
          email: s.email,
          role: s.role || 'recruiter',
          title: s.role === 'admin' ? 'Administrator' : 'Recruiter',
          avatar: s.role === 'admin' ? '🛡️' : '👤',
          color: '#79c0ff',
          target: 25
        };
      }
    } catch {}
    // Default to Admin
    return TEAM_MEMBERS[0];
  }

  function setCurrentUser(user) {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    window.location.reload();
  }

  function getAdminFilter() {
    return localStorage.getItem(STORAGE_KEY_VIEW_FILTER) || 'ALL';
  }

  function setAdminFilter(val) {
    localStorage.setItem(STORAGE_KEY_VIEW_FILTER, val);
    if (typeof window.renderAll === 'function') window.renderAll();
    if (typeof window.renderOldSite === 'function') window.renderOldSite();
    renderRecruiterMatrix();
    updateTopbarUI();
    toast(`Viewing: ${val === 'ALL' ? 'All Recruiters (Consolidated Master)' : val}`);
  }

  function toast(msg) {
    if (window.toast) window.toast(msg);
    else console.log('[TSS]', msg);
  }

  // Ensure initial seed data has recruiter tags
  function seedRecruiterDataIfNeeded() {
    const db = window.db;
    if (!db) return;

    let modified = false;

    // Seed mock screenings across multiple recruiters if screenings count is low or untagged
    if (!db.screenings || db.screenings.length < 10) {
      db.screenings = db.screenings || [];
      const sampleRecruiters = [
        { name: 'Priya Sharma', email: 'priya.sharma@talent-stock.com', role: 'recruiter' },
        { name: 'Rohit Verma', email: 'rohit.verma@talent-stock.com', role: 'recruiter' },
        { name: 'Ananya Patel', email: 'ananya.patel@talent-stock.com', role: 'recruiter' },
        { name: 'Vikram Singh', email: 'vikram.singh@talent-stock.com', role: 'recruiter' },
        { name: 'Shiv Singh', email: 'admin@talent-stock.com', role: 'admin' }
      ];

      const reqs = db.requirements || [];
      const cands = [
        { name: 'Aarav Patel', exp: '6.5', desig: 'Senior Full Stack Developer', loc: 'Mumbai', score: 88, dec: 'Shortlisted', matched: ['Angular', 'Node.js', 'TypeScript', 'REST API', 'PostgreSQL'], missing: [] },
        { name: 'Meera Iyer', exp: '5.2', desig: 'ASP.NET Core Engineer', loc: 'Delhi', score: 82, dec: 'Shortlisted', matched: ['ASP.NET Core', 'C#', 'SQL Server', 'REST API'], missing: ['Azure'] },
        { name: 'Kavita Nair', exp: '4.0', desig: 'Database Administrator', loc: 'Bangalore', score: 76, dec: 'Keep for Future', matched: ['MySQL', 'MS SQL', 'Query Optimization'], missing: ['ETL'] },
        { name: 'Rajesh Sen', exp: '8.0', desig: 'Service Delivery Manager', loc: 'Mumbai', score: 91, dec: 'Shortlisted', matched: ['Service Management', 'Customer Handling', 'Team Leadership', 'CRM'], missing: [] },
        { name: 'Siddharth Rao', exp: '3.5', desig: 'React Native Developer', loc: 'Noida', score: 74, dec: 'Shortlisted', matched: ['React Native', 'Android development', 'API integration'], missing: ['Kotlin Multiplatform'] },
        { name: 'Pooja Hegde', exp: '5.0', desig: 'Oracle DBA Specialist', loc: 'Mumbai', score: 85, dec: 'Shortlisted', matched: ['Oracle Database 19c', 'RAC', 'ASM', 'RMAN'], missing: [] },
        { name: 'Arjun Das', exp: '2.0', desig: 'Junior Analyst', loc: 'Mumbai', score: 62, dec: 'Request Updated Resume', matched: ['Tally ERP9', 'Microsoft Excel'], missing: ['GST documentation'] },
        { name: 'Neha Kapoor', exp: '7.0', desig: 'Linux Systems Engineer', loc: 'Navi Mumbai', score: 89, dec: 'Shortlisted', matched: ['RHEL 8', 'LVM', 'DNS', 'Bash scripting'], missing: [] },
        { name: 'Deepak Joshi', exp: '1.5', desig: 'Front Office Associate', loc: 'Ahmedabad', score: 48, dec: 'Rejected', matched: ['Customer Service'], missing: ['Front Office Operations', 'MS Office'] },
        { name: 'Tanvi Shah', exp: '9.0', desig: 'Key Account Manager', loc: 'Mumbai', score: 94, dec: 'Shortlisted', matched: ['Enterprise sales', 'Client relationship management', 'Negotiation', 'CRM'], missing: [] }
      ];

      cands.forEach((cand, idx) => {
        const assignedRecruiter = sampleRecruiters[idx % sampleRecruiters.length];
        const req = reqs[idx % reqs.length] || reqs[0] || { id: 'TSS001', client: 'IntelMacc', title: 'Senior Service Manager' };
        const candId = `C_SEED_${idx + 1}`;
        const screenId = `S_SEED_${idx + 1}`;

        if (!db.candidates.some(c => c.name === cand.name)) {
          db.candidates.push({
            id: candId,
            name: cand.name,
            email: `${cand.name.toLowerCase().replace(' ', '.')}@example.com`,
            phone: `+91 9820${idx}12345`,
            totalExperience: cand.exp,
            designation: cand.desig,
            location: cand.loc,
            skills: cand.matched,
            noticePeriod: '30 Days',
            currentCTC: '₹12 LPA',
            expectedCTC: '₹15 LPA',
            uploadDate: new Date(Date.now() - idx * 3600000 * 4).toISOString(),
            lastScreenedDate: new Date(Date.now() - idx * 3600000 * 4).toISOString(),
            uploadedBy: assignedRecruiter.name,
            recruiterEmail: assignedRecruiter.email
          });
        }

        if (!db.screenings.some(s => s.candidateId === candId)) {
          db.screenings.push({
            id: screenId,
            candidateId: candId,
            candidateName: cand.name,
            requirementId: req.id,
            requirementTitle: req.title,
            client: req.client,
            score: cand.score,
            recommendation: cand.score >= 75 ? 'Strong Match' : cand.score >= 50 ? 'Review Recommended' : 'Not Suitable',
            matched: cand.matched,
            missing: cand.missing,
            metrics: {
              score: cand.score,
              mandatoryPct: Math.min(100, cand.score + 5),
              prefPct: Math.max(50, cand.score - 10),
              expPct: 90,
              domainPct: 80,
              locPct: 100
            },
            recruiterDecision: cand.dec,
            notes: `Screened by ${assignedRecruiter.name}. Candidate demonstrated strong domain knowledge and relevant background.`,
            screenedBy: assignedRecruiter.name,
            recruiterEmail: assignedRecruiter.email,
            recruiterRole: assignedRecruiter.role,
            date: new Date(Date.now() - idx * 3600000 * 4).toISOString()
          });
        }
      });

      modified = true;
    } else {
      // Ensure all existing screenings have recruiter tags
      const curUser = getCurrentUser();
      db.screenings.forEach((s, i) => {
        if (!s.screenedBy || !s.recruiterEmail) {
          const fallback = TEAM_MEMBERS[i % TEAM_MEMBERS.length];
          s.screenedBy = s.screenedBy || fallback.name;
          s.recruiterEmail = s.recruiterEmail || fallback.email;
          s.recruiterRole = s.recruiterRole || fallback.role;
          modified = true;
        }
      });
    }

    if (modified && typeof window.saveDB === 'function') {
      window.saveDB();
    }
  }

  // Calculate stats for all recruiters
  function getTeamMetrics() {
    const db = window.db || { candidates: [], screenings: [], requirements: [] };
    const allScreenings = db.screenings || [];

    return TEAM_MEMBERS.map(member => {
      const myScreenings = allScreenings.filter(s =>
        (s.recruiterEmail && s.recruiterEmail.toLowerCase() === member.email.toLowerCase()) ||
        (s.screenedBy && s.screenedBy.toLowerCase() === member.name.toLowerCase())
      );

      const total = myScreenings.length;
      const strong = myScreenings.filter(s => s.score >= 75 || s.recommendation === 'Strong Match').length;
      const review = myScreenings.filter(s => s.score >= 50 && s.score < 75 || s.recommendation === 'Review Recommended').length;
      const rejected = myScreenings.filter(s => s.score < 50 || s.recommendation === 'Not Suitable').length;
      const shortlisted = myScreenings.filter(s => ['Shortlisted', 'Client Submitted', 'Interview', 'Final Select', 'Joined-TSS'].includes(s.recruiterDecision)).length;
      const avgScore = total ? Math.round(myScreenings.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / total) : 0;
      const conversionRate = total ? Math.round((shortlisted / total) * 100) : 0;

      return {
        ...member,
        totalScreenings: total,
        strongMatches: strong,
        reviewsNeeded: review,
        rejectedCount: rejected,
        shortlistedCount: shortlisted,
        avgScore,
        conversionRate,
        screenings: myScreenings
      };
    });
  }

  // Topbar UI Injection with Role Switcher & Admin Filter
  function updateTopbarUI() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    const user = getCurrentUser();
    const isAdmin = user.role === 'admin';
    const activeFilter = getAdminFilter();

    // 1. Profile Box in Topbar
    const profileName = document.getElementById('profileName');
    if (profileName) {
      profileName.innerHTML = `
        <span style="display:flex;align-items:center;gap:6px;">
          ${user.avatar} <b>${esc(user.name)}</b>
        </span>
      `;
      const smallRole = profileName.parentElement?.querySelector('small');
      if (smallRole) {
        smallRole.innerHTML = isAdmin
          ? `<span style="color:#79c0ff;font-weight:700;">🛡️ Super Admin · Master 360°</span>`
          : `<span style="color:#7ee787;font-weight:700;">🔒 Recruiter Private Workspace</span>`;
      }
    }

    // 2. Add Team Switcher & Admin Scope Pill
    let roleControl = document.getElementById('tssRoleControlBar');
    if (!roleControl) {
      roleControl = document.createElement('div');
      roleControl.id = 'tssRoleControlBar';
      roleControl.style.cssText = 'display:flex;align-items:center;gap:8px;margin-right:8px;';
      const searchBox = topbar.querySelector('.top-search') || topbar.firstChild;
      topbar.insertBefore(roleControl, searchBox.nextSibling);
    }

    if (isAdmin) {
      roleControl.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;background:#091b2c;border:1px solid #1f507a;padding:3px 10px;border-radius:999px;">
          <span style="font-size:11px;font-weight:800;color:#79c0ff;letter-spacing:0.5px;">ADMIN VIEW:</span>
          <select id="adminRecruiterFilterSelect" style="background:#061423;color:#f0f6fc;border:1px solid #23527c;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600;cursor:pointer;">
            <option value="ALL" ${activeFilter === 'ALL' ? 'selected' : ''}>🌐 All Recruiters (Master Consolidated)</option>
            ${TEAM_MEMBERS.map(m => `
              <option value="${m.name}" ${activeFilter === m.name ? 'selected' : ''}>
                ${m.avatar} ${esc(m.name)} (${m.role.toUpperCase()})
              </option>
            `).join('')}
          </select>
        </div>
        <button id="switchUserModalBtn" class="toolbar-btn" style="padding:4px 10px;font-size:11px;font-weight:700;background:#0d2847;border:1px solid #2a5e8f;color:#a5d6ff;border-radius:6px;cursor:pointer;" title="Switch Active Recruiter / Admin Profile">
          ⇄ Switch User
        </button>
      `;

      document.getElementById('adminRecruiterFilterSelect')?.addEventListener('change', e => {
        setAdminFilter(e.target.value);
      });
    } else {
      roleControl.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;background:#0a291a;border:1px solid #238636;padding:4px 10px;border-radius:999px;font-size:11px;color:#7ee787;">
          <span>🔒</span> <b>Private Workspace:</b> ${esc(user.name)}
        </div>
        <button id="switchUserModalBtn" class="toolbar-btn" style="padding:4px 10px;font-size:11px;font-weight:700;background:#0d2847;border:1px solid #2a5e8f;color:#a5d6ff;border-radius:6px;cursor:pointer;">
          ⇄ Switch Account
        </button>
      `;
    }

    document.getElementById('switchUserModalBtn')?.addEventListener('click', () => {
      openSwitchUserModal();
    });
  }

  // Render Consolidated Recruiter Matrix (Leaderboard & Breakdown) on Dashboard
  function renderRecruiterMatrix() {
    const user = getCurrentUser();
    const isAdmin = user.role === 'admin';
    const team = getTeamMetrics();
    const activeFilter = getAdminFilter();

    let container = document.getElementById('recruiterMasterMatrixPanel');
    if (!container) {
      const dashboard = document.getElementById('dashboard');
      if (!dashboard) return;
      container = document.createElement('div');
      container.id = 'recruiterMasterMatrixPanel';
      container.className = 'old-panel';
      container.style.cssText = 'margin:18px 0;border:1px solid #1f456c;background:linear-gradient(160deg, #091a2a, #061320);padding:20px;border-radius:12px;';
      
      const heroGrid = dashboard.querySelector('.hero-dashboard-grid');
      if (heroGrid) {
        heroGrid.parentNode.insertBefore(container, heroGrid.nextSibling);
      } else {
        dashboard.prepend(container);
      }
    }

    if (isAdmin) {
      // ADMIN 360° MASTER CONTROL VIEW
      const totalAllScreened = team.reduce((acc, m) => acc + m.totalScreenings, 0);
      const totalAllShortlisted = team.reduce((acc, m) => acc + m.shortlistedCount, 0);
      const avgTeamScore = totalAllScreened ? Math.round(team.reduce((acc, m) => acc + (m.avgScore * m.totalScreenings), 0) / totalAllScreened) : 0;
      const teamConversion = totalAllScreened ? Math.round((totalAllShortlisted / totalAllScreened) * 100) : 0;

      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #173b5e;padding-bottom:14px;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="background:#1f6feb;color:#fff;font-size:10px;font-weight:900;padding:2px 8px;border-radius:999px;letter-spacing:1px;">ADMIN 360° CONTROL TOWER</span>
              <span style="color:#79c0ff;font-size:12px;font-weight:700;">● Live Team Oversight</span>
            </div>
            <h2 style="margin:4px 0 2px;color:#f0f6fc;font-size:19px;">Recruiter Performance & Master Screening Reports</h2>
            <small style="color:#8bb6dc;">Complete overview of all recruiters' candidate evaluations, shortlists, conversion rates and live productivity.</small>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="masterConsolidatedExportBtn" class="blue-btn" style="padding:7px 14px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
              📥 Export All Recruiters Master Report (Excel/CSV)
            </button>
          </div>
        </div>

        <!-- Team Aggregate Stat Bar -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px;margin-bottom:18px;">
          <div style="background:#0b2138;border:1px solid #1f4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;margin-bottom:4px;">Total Team Screenings</span>
            <strong style="font-size:22px;color:#f0f6fc;">${totalAllScreened}</strong>
          </div>
          <div style="background:#0b2138;border:1px solid #1f4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;margin-bottom:4px;">Total Shortlisted</span>
            <strong style="font-size:22px;color:#7ee787;">${totalAllShortlisted}</strong>
          </div>
          <div style="background:#0b2138;border:1px solid #1f4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;margin-bottom:4px;">Avg Match Quality</span>
            <strong style="font-size:22px;color:#79c0ff;">${avgTeamScore}%</strong>
          </div>
          <div style="background:#0b2138;border:1px solid #1f4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;margin-bottom:4px;">Team Conversion Rate</span>
            <strong style="font-size:22px;color:#d2a8ff;">${teamConversion}%</strong>
          </div>
        </div>

        <!-- Recruiter Breakdown Table -->
        <div style="overflow-x:auto;">
          <table class="jobs-table" style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #1b3d60;color:#79c0ff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">
                <th style="padding:10px 12px;text-align:left;">Recruiter</th>
                <th style="padding:10px 12px;text-align:center;">Role & Scope</th>
                <th style="padding:10px 12px;text-align:center;">Screened</th>
                <th style="padding:10px 12px;text-align:center;">Shortlisted</th>
                <th style="padding:10px 12px;text-align:center;">Avg Match</th>
                <th style="padding:10px 12px;text-align:center;">Conversion</th>
                <th style="padding:10px 12px;text-align:left;">Daily Target</th>
                <th style="padding:10px 12px;text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${team.map(m => {
                const isSelected = activeFilter === m.name;
                const progressPct = Math.min(100, Math.round((m.totalScreenings / m.target) * 100));
                return `
                  <tr style="border-bottom:1px solid #143553;background:${isSelected ? '#0e2b47' : 'transparent'};transition:background 0.2s;">
                    <td style="padding:12px;">
                      <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:22px;width:34px;height:34px;border-radius:50%;background:#092138;border:1px solid #204c7a;display:grid;place-items:center;">
                          ${m.avatar}
                        </span>
                        <div>
                          <strong style="color:#f0f6fc;font-size:13px;display:block;">${esc(m.name)}</strong>
                          <small style="color:#8bb6dc;font-size:11px;">${esc(m.email)}</small>
                        </div>
                      </div>
                    </td>
                    <td style="padding:12px;text-align:center;">
                      <span style="padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${m.role === 'admin' ? '#211e3b' : '#0d2847'};border:1px solid ${m.role === 'admin' ? '#8a63d2' : '#28557a'};color:${m.role === 'admin' ? '#d2a8ff' : '#79c0ff'};">
                        ${m.role.toUpperCase()}
                      </span>
                    </td>
                    <td style="padding:12px;text-align:center;">
                      <strong style="color:#f0f6fc;font-size:14px;">${m.totalScreenings}</strong>
                    </td>
                    <td style="padding:12px;text-align:center;">
                      <span style="color:#7ee787;font-weight:700;font-size:13px;">${m.shortlistedCount}</span>
                    </td>
                    <td style="padding:12px;text-align:center;">
                      <span style="color:#79c0ff;font-weight:700;">${m.avgScore}%</span>
                    </td>
                    <td style="padding:12px;text-align:center;">
                      <span style="color:#d2a8ff;font-weight:700;">${m.conversionRate}%</span>
                    </td>
                    <td style="padding:12px;min-width:140px;">
                      <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#8bb6dc;margin-bottom:4px;">
                        <span>${m.totalScreenings} / ${m.target}</span>
                        <span>${progressPct}%</span>
                      </div>
                      <div style="background:#091b2c;height:6px;border-radius:99px;overflow:hidden;border:1px solid #173b5e;">
                        <div style="width:${progressPct}%;height:100%;background:${progressPct >= 80 ? '#2ea043' : progressPct >= 50 ? '#388bfd' : '#d29922'};"></div>
                      </div>
                    </td>
                    <td style="padding:12px;text-align:right;">
                      <button class="inspect-recruiter-btn" data-name="${esc(m.name)}" style="background:#0f385c;border:1px solid #285d8a;color:#cbe4fc;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">
                        ${isSelected ? '✓ Viewing' : 'Inspect View →'}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      document.querySelectorAll('.inspect-recruiter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setAdminFilter(btn.dataset.name);
        });
      });

      document.getElementById('masterConsolidatedExportBtn')?.addEventListener('click', () => {
        exportMasterConsolidatedReport();
      });
    } else {
      // RECRUITER PRIVATE SCORECARD ("recruiters ka alag alag rahega")
      const myStats = team.find(m => m.email.toLowerCase() === user.email.toLowerCase()) || {
        totalScreenings: 0,
        shortlistedCount: 0,
        reviewsNeeded: 0,
        rejectedCount: 0,
        avgScore: 0,
        conversionRate: 0,
        target: 25
      };

      const progressPct = Math.min(100, Math.round((myStats.totalScreenings / myStats.target) * 100));

      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #173b5e;padding-bottom:12px;margin-bottom:16px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="background:#0d3522;color:#7ee787;border:1px solid #238636;font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;">
                🔒 PRIVATE RECRUITER WORKSPACE
              </span>
              <span style="color:#aff5b4;font-size:12px;font-weight:600;">Personal Scorecard</span>
            </div>
            <h2 style="margin:4px 0 2px;color:#f0f6fc;font-size:18px;">${esc(user.name)}'s Recruitment Desk</h2>
            <small style="color:#8bb6dc;">You are viewing your private candidate screenings, individual shortlist targets and recruiter activity.</small>
          </div>
          <button id="recruiterExportOwnBtn" class="blue-btn" style="padding:6px 12px;font-size:12px;font-weight:700;">
            📥 Export My Screened CVs (CSV)
          </button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;">
          <div style="background:#0a2339;border:1px solid #1e4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;">My Screenings</span>
            <strong style="font-size:22px;color:#f0f6fc;">${myStats.totalScreenings}</strong>
          </div>
          <div style="background:#0a2339;border:1px solid #1e4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;">My Shortlisted</span>
            <strong style="font-size:22px;color:#7ee787;">${myStats.shortlistedCount}</strong>
          </div>
          <div style="background:#0a2339;border:1px solid #1e4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;">My Avg Quality</span>
            <strong style="font-size:22px;color:#79c0ff;">${myStats.avgScore}%</strong>
          </div>
          <div style="background:#0a2339;border:1px solid #1e4f7d;border-radius:8px;padding:12px;">
            <span style="font-size:10px;text-transform:uppercase;color:#8bb6dc;display:block;">Conversion Rate</span>
            <strong style="font-size:22px;color:#d2a8ff;">${myStats.conversionRate}%</strong>
          </div>
          <div style="background:#0a2339;border:1px solid #1e4f7d;border-radius:8px;padding:12px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#8bb6dc;margin-bottom:3px;">
              <span>Daily Target</span>
              <span>${myStats.totalScreenings}/${myStats.target}</span>
            </div>
            <strong style="font-size:18px;color:#e6edf3;display:block;margin-bottom:4px;">${progressPct}%</strong>
            <div style="background:#081726;height:6px;border-radius:99px;overflow:hidden;border:1px solid #163855;">
              <div style="width:${progressPct}%;height:100%;background:#2ea043;"></div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('recruiterExportOwnBtn')?.addEventListener('click', () => {
        exportRecruiterOwnReport(user);
      });
    }
  }

  // Filter screening records based on current active user & admin filter
  function getEffectiveScreenings() {
    const db = window.db || { screenings: [] };
    const user = getCurrentUser();
    const all = db.screenings || [];

    if (user.role === 'admin') {
      const f = getAdminFilter();
      if (f === 'ALL') return all;
      return all.filter(s =>
        (s.screenedBy && s.screenedBy.toLowerCase() === f.toLowerCase()) ||
        (s.recruiterEmail && s.recruiterEmail.toLowerCase() === f.toLowerCase())
      );
    } else {
      // Recruiter only sees their OWN screenings ("recruiters ka alag alag rahega")
      return all.filter(s =>
        (s.recruiterEmail && s.recruiterEmail.toLowerCase() === user.email.toLowerCase()) ||
        (s.screenedBy && s.screenedBy.toLowerCase() === user.name.toLowerCase())
      );
    }
  }

  // Filter candidate records
  function getEffectiveCandidates() {
    const db = window.db || { candidates: [], screenings: [] };
    const user = getCurrentUser();
    const all = db.candidates || [];

    if (user.role === 'admin') {
      const f = getAdminFilter();
      if (f === 'ALL') return all;
      // Filter candidates who have screenings by this recruiter OR were uploaded by this recruiter
      const recruiterScreeningCandIds = new Set(
        (db.screenings || []).filter(s => s.screenedBy === f || s.recruiterEmail === f).map(s => s.candidateId)
      );
      return all.filter(c => recruiterScreeningCandIds.has(c.id) || c.uploadedBy === f);
    } else {
      // Recruiter sees candidates screened or uploaded by them
      const myCandIds = new Set(
        (db.screenings || [])
          .filter(s => s.recruiterEmail?.toLowerCase() === user.email.toLowerCase() || s.screenedBy?.toLowerCase() === user.name.toLowerCase())
          .map(s => s.candidateId)
      );
      return all.filter(c => myCandIds.has(c.id) || c.uploadedBy?.toLowerCase() === user.name.toLowerCase() || c.recruiterEmail?.toLowerCase() === user.email.toLowerCase());
    }
  }

  // Master Consolidated Report Export (All Recruiters + Breakdown)
  function exportMasterConsolidatedReport() {
    const db = window.db || { screenings: [], candidates: [], requirements: [] };
    const team = getTeamMetrics();
    const allScreenings = db.screenings || [];

    const headers = [
      'Recruiter Name',
      'Recruiter Role',
      'Candidate Name',
      'Candidate Email',
      'Candidate Phone',
      'Client',
      'Job Title',
      'Match Score (%)',
      'Recommendation',
      'Recruiter Decision',
      'Experience (Years)',
      'Location',
      'Notice Period',
      'Matched Skills',
      'Missing Skills',
      'Evaluation Date',
      'Recruiter Notes'
    ];

    const rows = allScreenings.map(s => {
      const c = db.candidates?.find(x => x.id === s.candidateId) || {};
      const r = db.requirements?.find(x => x.id === s.requirementId) || {};
      return [
        s.screenedBy || 'Recruiter',
        s.recruiterRole || 'recruiter',
        c.name || s.candidateName || '',
        c.email || '',
        c.phone || '',
        r.client || s.client || '',
        r.title || s.requirementTitle || '',
        s.score ? `${s.score}%` : '',
        s.recommendation || '',
        s.recruiterDecision || 'Pending',
        c.totalExperience || '',
        c.location || '',
        c.noticePeriod || '',
        (s.matched || []).join('; '),
        (s.missing || []).join('; '),
        s.date ? new Date(s.date).toLocaleString() : '',
        s.notes || ''
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TSS_ALL_RECRUITERS_CONSOLIDATED_MASTER_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Downloaded All Recruiters Master Consolidated Report');
  }

  // Recruiter Individual Export
  function exportRecruiterOwnReport(user) {
    const db = window.db || { screenings: [], candidates: [], requirements: [] };
    const myScreenings = (db.screenings || []).filter(s =>
      (s.recruiterEmail && s.recruiterEmail.toLowerCase() === user.email.toLowerCase()) ||
      (s.screenedBy && s.screenedBy.toLowerCase() === user.name.toLowerCase())
    );

    const headers = [
      'Candidate Name',
      'Email',
      'Phone',
      'Client',
      'Job Title',
      'Match Score',
      'Recommendation',
      'My Decision',
      'Experience',
      'Location',
      'Matched Skills',
      'Missing Skills',
      'Date Screened',
      'My Notes'
    ];

    const rows = myScreenings.map(s => {
      const c = db.candidates?.find(x => x.id === s.candidateId) || {};
      const r = db.requirements?.find(x => x.id === s.requirementId) || {};
      return [
        c.name || s.candidateName || '',
        c.email || '',
        c.phone || '',
        r.client || s.client || '',
        r.title || s.requirementTitle || '',
        s.score ? `${s.score}%` : '',
        s.recommendation || '',
        s.recruiterDecision || 'Pending',
        c.totalExperience || '',
        c.location || '',
        (s.matched || []).join('; '),
        (s.missing || []).join('; '),
        s.date ? new Date(s.date).toLocaleString() : '',
        s.notes || ''
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TSS_${user.name.replace(/\s+/g, '_')}_Screenings_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Downloaded private screening report for ${user.name}`);
  }

  // Switch User Modal
  function openSwitchUserModal() {
    let modal = document.getElementById('switchUserModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'switchUserModal';
      modal.className = 'todo-modal';
      document.body.appendChild(modal);
    }

    const cur = getCurrentUser();

    modal.classList.remove('hidden');
    modal.innerHTML = `
      <div class="todo-modal-card" style="max-width:650px;width:95%;background:#09192b;border:1px solid #1f456c;box-shadow:0 25px 70px rgba(0,0,0,0.75);">
        <button id="closeSwitchUserModal" class="todo-close" style="color:#a8c7fa;font-size:22px;">×</button>
        
        <div style="border-bottom:1px solid #163255;padding-bottom:14px;margin-bottom:18px;">
          <span style="font-size:11px;font-weight:800;letter-spacing:1px;color:#79c0ff;">TEAM WORKSPACE & ACCESS CONTROL</span>
          <h2 style="margin:2px 0 0;color:#f0f6fc;font-size:19px;">Switch Recruiter / Admin Workspace</h2>
          <p style="color:#8bb6dc;font-size:12px;margin:4px 0 0;">
            Admins get 360° consolidated reports of all recruiters. Each recruiter has their own private workspace ("alag alag rahega").
          </p>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
          ${TEAM_MEMBERS.map(m => {
            const isActive = m.email.toLowerCase() === cur.email.toLowerCase();
            return `
              <div class="switch-user-card" data-email="${esc(m.email)}" style="background:${isActive ? '#0f3152' : '#0a2034'};border:1px solid ${isActive ? '#388bfd' : '#1e486e'};border-radius:10px;padding:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all 0.2s;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="font-size:24px;width:42px;height:42px;border-radius:50%;background:#061423;border:1px solid #204c7a;display:grid;place-items:center;">
                    ${m.avatar}
                  </span>
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <strong style="color:#f0f6fc;font-size:14px;">${esc(m.name)}</strong>
                      <span style="padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;background:${m.role === 'admin' ? '#211e3b' : '#0d2847'};color:${m.role === 'admin' ? '#d2a8ff' : '#79c0ff'};">
                        ${m.role === 'admin' ? '🛡️ SUPER ADMIN' : '🔒 RECRUITER'}
                      </span>
                    </div>
                    <small style="color:#8bb6dc;font-size:12px;display:block;margin-top:2px;">${esc(m.title)} · ${esc(m.email)}</small>
                  </div>
                </div>
                ${isActive ? `
                  <span style="background:#238636;color:#ffffff;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;">
                    ✓ Active Workspace
                  </span>
                ` : `
                  <button class="blue-btn" style="padding:5px 12px;font-size:11px;font-weight:700;">
                    Switch →
                  </button>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('closeSwitchUserModal')?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.querySelectorAll('.switch-user-card').forEach(card => {
      card.addEventListener('click', () => {
        const email = card.dataset.email;
        const target = TEAM_MEMBERS.find(m => m.email === email);
        if (target) {
          setCurrentUser(target);
        }
      });
    });
  }

  // Hook into screening to tag current recruiter
  function patchCandidateScreening() {
    const origScoreCandidate = window.scoreCandidate;
    // When a screening is saved, ensure current recruiter is stamped
    const origSaveDB = window.saveDB;
    if (origSaveDB && !origSaveDB.__teamPatched) {
      window.saveDB = function () {
        const user = getCurrentUser();
        const db = window.db;
        if (db && db.screenings) {
          db.screenings.forEach(s => {
            if (!s.screenedBy) {
              s.screenedBy = user.name;
              s.recruiterEmail = user.email;
              s.recruiterRole = user.role;
            }
          });
        }
        origSaveDB.apply(this, arguments);
        setTimeout(renderRecruiterMatrix, 50);
      };
      window.saveDB.__teamPatched = true;
    }
  }

  // Hook into candidate and history renders to support filtering
  function patchRenderFunctions() {
    // Wrap candidate list
    if (typeof window.renderCandidates === 'function' && !window.renderCandidates.__teamPatched) {
      const origRenderCand = window.renderCandidates;
      window.renderCandidates = function (filter = '') {
        const db = window.db;
        if (!db) return;
        const effectiveCands = getEffectiveCandidates();
        const origAll = db.candidates;
        db.candidates = effectiveCands;
        try {
          origRenderCand(filter);
        } finally {
          db.candidates = origAll;
        }
      };
      window.renderCandidates.__teamPatched = true;
    }

    // Wrap history list
    if (typeof window.renderHistory === 'function' && !window.renderHistory.__teamPatched) {
      const origRenderHist = window.renderHistory;
      window.renderHistory = function () {
        const db = window.db;
        if (!db) return;
        const effectiveScreens = getEffectiveScreenings();
        const origAll = db.screenings;
        db.screenings = effectiveScreens;
        try {
          origRenderHist();
        } finally {
          db.screenings = origAll;
        }
      };
      window.renderHistory.__teamPatched = true;
    }
  }

  // Add quick recruiter login buttons on login page
  function injectLoginChips() {
    const loginForm = document.getElementById('loginForm');
    const loginLeft = document.querySelector('.login-left');
    if (!loginLeft || document.getElementById('quickTeamLoginChips')) return;

    const box = document.createElement('div');
    box.id = 'quickTeamLoginChips';
    box.style.cssText = 'margin-top:16px;background:#091b2c;border:1px solid #1b456e;border-radius:10px;padding:14px;';
    box.innerHTML = `
      <span style="font-size:10px;font-weight:800;letter-spacing:1px;color:#79c0ff;display:block;margin-bottom:8px;">
        QUICK TEAM WORKSPACE ACCESS
      </span>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${TEAM_MEMBERS.map(m => `
          <button type="button" class="quick-team-btn" data-email="${esc(m.email)}" data-role="${esc(m.role)}" data-name="${esc(m.name)}" style="background:#0c2844;border:1px solid #235687;color:#d5ebff;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <span>${m.avatar}</span>
            <span>${esc(m.name)}</span>
            <small style="color:${m.role === 'admin' ? '#d2a8ff' : '#7ee787'};font-size:9px;">[${m.role === 'admin' ? 'Admin 360°' : 'Private Desk'}]</small>
          </button>
        `).join('')}
      </div>
    `;

    if (loginForm) {
      loginForm.after(box);
    } else {
      loginLeft.appendChild(box);
    }

    box.querySelectorAll('.quick-team-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.email;
        const name = btn.dataset.name;
        const role = btn.dataset.role;
        const s = { email, name, role };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(s));
        window.location.reload();
      });
    });
  }

  function init() {
    seedRecruiterDataIfNeeded();
    updateTopbarUI();
    renderRecruiterMatrix();
    patchCandidateScreening();
    patchRenderFunctions();
    injectLoginChips();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
  } else {
    setTimeout(init, 200);
  }

  setTimeout(init, 600);
  setTimeout(init, 1200);

  window.TSSTeamIntelligence = {
    getCurrentUser,
    setCurrentUser,
    getTeamMembers: () => TEAM_MEMBERS,
    getTeamMetrics,
    getAdminFilter,
    setAdminFilter,
    exportMasterConsolidatedReport,
    exportRecruiterOwnReport,
    openSwitchUserModal,
    refresh: () => {
      updateTopbarUI();
      renderRecruiterMatrix();
    }
  };
})();
