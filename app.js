// ==========================================
// 1. API & CUSTOM MODALS
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgAvLkwCw-Uz3NetiAiBM10EyCRyWmu6p8ftI1QM_BxcsPjJVDN9Bn8Sviu-mYcDXHmg/exec"; 

let currentUser = { username: "", facility: "", role: "", fullName: "" };
let labOrders = {};
let pendingData = [];
let completedData = [];
let isExistingPatient = false; 
let editingPendingId = null;
let currentQuickPatient = null;
let searchTimeout; 
let editModeIds = new Set();
window.CURRENT_TEST_TYPE = ""; 
const ALL_PAGES = ['page-workspace', 'page-registry', 'page-reports', 'page-settings', 'page-patient'];
const TODAY_STR = new Date().toLocaleDateString(); 

async function apiGet(action, params = {}) { let url = new URL(SCRIPT_URL); url.searchParams.append('action', action); for (let key in params) if (params[key] !== undefined) url.searchParams.append(key, params[key]); try { const res = await fetch(url); return await res.json(); } catch (e) { throw e; } }
async function apiPost(action, payload) { try { const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, ...payload }) }); return await res.json(); } catch (e) { throw e; } }

function showCustomAlert(msg, type = 'info') {
    document.getElementById('custom-alert-msg').innerHTML = msg;
    const icon = document.getElementById('custom-alert-icon');
    if(type === 'error') { icon.className = 'ph ph-warning-circle'; icon.style.color = 'var(--danger)'; }
    else if(type === 'success') { icon.className = 'ph ph-check-circle'; icon.style.color = 'var(--success)'; }
    else { icon.className = 'ph ph-info'; icon.style.color = 'var(--pri)'; }
    document.getElementById('custom-alert').style.display = 'flex';
}
function closeCustomAlert() { document.getElementById('custom-alert').style.display = 'none'; }

function showCustomConfirm(msg, callback) {
    document.getElementById('custom-confirm-msg').innerHTML = msg;
    document.getElementById('custom-confirm').style.display = 'flex';
    window.pendingConfirmCallback = callback;
}
function closeCustomConfirm(isConfirmed) {
    document.getElementById('custom-confirm').style.display = 'none';
    if(isConfirmed && window.pendingConfirmCallback) window.pendingConfirmCallback();
    window.pendingConfirmCallback = null;
}

// ==========================================
// 2. SYSTEM STARTUP & LIMITED MODE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('mho-theme') === 'dark') document.body.classList.add('dark-mode');
    
    const isLimited = localStorage.getItem('mho-limited-mode') === 'true';
    const toggleLimit = document.getElementById('toggle-limited-mode');
    if(toggleLimit) toggleLimit.checked = isLimited;
    applyLimitedMode(isLimited);

    const savedUser = localStorage.getItem('labUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (!currentUser.username) throw new Error("Invalid");
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('display-full-name').innerText = currentUser.fullName || currentUser.username;
            document.getElementById('display-role-facility').innerText = `${currentUser.role} | ${currentUser.facility}`;
            document.getElementById('pill-avatar').innerHTML = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();
            
            applyPermissions(); 
            document.getElementById('app-loader').style.display = 'none';
            
            const r = String(currentUser.role).toUpperCase().replace(/\s+/g, '_');
            
            if(r === 'PATIENT') { showPage('patient'); loadPatientResults(); }
            else if(r === 'NTP_CHECKER' || r === 'DOH_TB' || r === 'VIEWER') showPage('registry'); 
            else showPage('workspace');
        } catch (e) { localStorage.removeItem('labUser'); document.getElementById('app-loader').style.display = 'none'; }
    } else { document.getElementById('app-loader').style.display = 'none'; }
});

function toggleLimitedMode() { const isChecked = document.getElementById('toggle-limited-mode').checked; localStorage.setItem('mho-limited-mode', isChecked); applyLimitedMode(isChecked); }
function applyLimitedMode(isLimited) {
    const hiddenTests = ['btn-viral', 'btn-hema', 'btn-chem', 'btn-uria', 'btn-feca'];
    const hiddenRegistries = ['GXVL', 'HEMA', 'CHEM', 'UA', 'FA'];
    hiddenTests.forEach(id => { const btn = document.getElementById(id); if(btn) { if(isLimited) btn.classList.add('disabled-test'); else btn.classList.remove('disabled-test'); } });
    document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const onclickAttr = card.getAttribute('onclick'); if(onclickAttr) { let isHidden = hiddenRegistries.some(r => onclickAttr.includes(r)); if(isLimited && isHidden) card.classList.add('disabled-test'); else card.classList.remove('disabled-test'); } });
}
function toggleSidebar() { const sidebar = document.getElementById('main-sidebar'); const overlay = document.getElementById('sidebar-overlay'); if (sidebar.classList.contains('show')) { sidebar.classList.remove('show'); overlay.style.display = 'none'; overlay.style.opacity = '0'; } else { sidebar.classList.add('show'); overlay.style.display = 'block'; setTimeout(()=>overlay.style.opacity = '1', 10); } }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const icon = document.getElementById('theme-icon'); const text = document.getElementById('theme-text'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('mho-theme', 'dark'); if(icon) icon.classList.replace('ph-moon-stars', 'ph-sun'); if(text) text.innerText = "Light Mode"; } else { localStorage.setItem('mho-theme', 'light'); if(icon) icon.classList.replace('ph-sun', 'ph-moon-stars'); if(text) text.innerText = "Dark Mode"; } }

// ==========================================
// 3. AUTHENTICATION & TABS
// ==========================================
function switchLoginTab(type) {
    if(type === 'staff') {
        document.getElementById('staff-login-form').style.display = 'block'; document.getElementById('patient-login-form').style.display = 'none';
        document.getElementById('tab-staff-login').style.color = 'var(--pri)'; document.getElementById('tab-staff-login').style.borderBottom = '2px solid var(--pri)';
        document.getElementById('tab-patient-login').style.color = 'var(--text-muted)'; document.getElementById('tab-patient-login').style.borderBottom = 'none';
    } else {
        document.getElementById('staff-login-form').style.display = 'none'; document.getElementById('patient-login-form').style.display = 'block';
        document.getElementById('tab-patient-login').style.color = 'var(--pri)'; document.getElementById('tab-patient-login').style.borderBottom = '2px solid var(--pri)';
        document.getElementById('tab-staff-login').style.color = 'var(--text-muted)'; document.getElementById('tab-staff-login').style.borderBottom = 'none';
    }
}
function showPatientResend() { document.getElementById('login-card').style.display = 'none'; document.getElementById('patient-resend-card').style.display = 'block'; }
function showPatientInfo() { document.getElementById('login-card').style.display = 'none'; document.getElementById('patient-info-card').style.display = 'block'; }
function backToLoginFromPatient() { document.getElementById('patient-resend-card').style.display = 'none'; document.getElementById('patient-info-card').style.display = 'none'; document.getElementById('login-card').style.display = 'block'; }

async function attemptLogin() {
    const u = document.getElementById('login_user').value.trim(); const p = document.getElementById('login_pass').value.trim();
    const btn = document.getElementById('btn-login'); const err = document.getElementById('login-error');
    if (!u || !p) { err.style.display = 'block'; err.innerText = "Enter credentials."; return; }
    btn.innerHTML = 'Verifying...'; btn.disabled = true; err.style.display = 'none';
    try {
        const res = await apiGet("loginUser", { username: u, password: p });
        if (res.status === "SUCCESS") { currentUser = { username: res.username, facility: res.facility, role: res.role, fullName: res.fullName }; localStorage.setItem('labUser', JSON.stringify(currentUser)); window.location.reload(); } 
        else if (res.status === "PENDING") { err.style.display = 'block'; err.innerHTML = "Account Pending Approval."; } else { err.style.display = 'block'; err.innerHTML = "Invalid credentials"; }
    } catch (e) { showCustomAlert("Server Error. Check connection.", "error"); } finally { btn.innerHTML = 'Log In'; btn.disabled = false; }
}

async function attemptPatientLogin() {
    const e = document.getElementById('pat_user').value.trim().toLowerCase(); const p = document.getElementById('pat_pass').value.trim();
    const btn = document.getElementById('btn-pat-login'); const err = document.getElementById('login-error');
    if (!e || !p) { err.style.display = 'block'; err.innerText = "Enter email and password."; return; }
    btn.innerHTML = 'Verifying...'; btn.disabled = true; err.style.display = 'none';
    try {
        const res = await apiGet("patientLogin", { email: e, password: p });
        if (res.status === "SUCCESS") { currentUser = { username: res.patientId, facility: "PATIENT", role: "PATIENT", fullName: res.name }; localStorage.setItem('labUser', JSON.stringify(currentUser)); window.location.reload(); } 
        else { err.style.display = 'block'; err.innerHTML = "Invalid email or password."; }
    } catch (e) { err.style.display = 'block'; err.innerHTML = "Server Error."; } finally { btn.innerHTML = 'View My Results'; btn.disabled = false; }
}

async function resendPatientPassword() {
    const email = document.getElementById('resend_pat_email').value.trim();
    if(!email) return showCustomAlert("Please enter your registered email address.", "error");
    const btn = document.querySelector('#patient-resend-card .btn-primary'); const oldText = btn.innerHTML; btn.innerHTML = "Sending..."; btn.disabled = true;
    try { await apiPost("resendPatientPassword", { email: email }); showCustomAlert("If your email is registered, your password has been sent.", "success"); backToLoginFromPatient(); } 
    catch(e) { showCustomAlert("If your email is registered, your password has been sent.", "success"); backToLoginFromPatient(); } 
    finally { btn.innerHTML = oldText; btn.disabled = false; }
}

function logoutUser() { document.getElementById('logout-modal').style.display = 'flex'; toggleSidebar(); }
function closeLogoutModal() { document.getElementById('logout-modal').style.display = 'none'; }
function confirmLogout() { localStorage.removeItem('labUser'); window.location.reload(); }

// ==========================================
// 4. NAVIGATION & PERMISSIONS
// ==========================================
function showPage(targetId) {
    const elId = 'page-' + targetId; 
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
    if (role === 'VIEWER' && targetId === 'settings') return;
    if (role === 'ENCODER' && targetId === 'settings') return;
    if (role === 'PATIENT' && targetId !== 'patient') return;
    if ((role === 'NTP_CHECKER' || role === 'DOH_TB') && (targetId !== 'registry' && targetId !== 'reports')) return;

    ALL_PAGES.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const target = document.getElementById(elId); if (target) target.style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('active'); if (item.id === 'nav-' + targetId) item.classList.add('active'); });
    if (targetId === 'workspace' && (role === 'ADMIN' || role === 'STAFF' || role === 'ENCODER' || role === 'VIEWER')) loadPendingData();
    if (targetId === 'settings' && typeof loadSettingsData === 'function') loadSettingsData();
}

function applyPermissions() {
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
    const navWork = document.getElementById('nav-workspace'); const navReg = document.getElementById('nav-registry'); const navRep = document.getElementById('nav-reports'); const navSet = document.getElementById('nav-settings');
    const colEntry = document.getElementById('col-entry'); const colPending = document.getElementById('col-pending'); const colCompleted = document.getElementById('col-completed'); const colRepeat = document.getElementById('col-repeat');
    const floatBtns = document.querySelector('.float-actions');

    if(navWork) navWork.style.display = 'none'; if(navReg) navReg.style.display = 'none'; if(navRep) navRep.style.display = 'none'; if(navSet) navSet.style.display = 'none';
    if(colEntry) colEntry.style.display = 'none'; if(colPending) colPending.style.display = 'none'; if(colCompleted) colCompleted.style.display = 'none'; if(colRepeat) colRepeat.style.display = 'none';
    if(floatBtns) floatBtns.style.display = 'none';

    if (role === 'PATIENT') { const sidebarBtn = document.getElementById('menu-toggle-btn'); if(sidebarBtn) sidebarBtn.style.display = 'none'; }
    else if (role === 'ADMIN' || role === 'STAFF') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex'; if(navRep) navRep.style.display = 'flex';
        if(role === 'ADMIN' && navSet) navSet.style.display = 'flex'; 
        if(colEntry) colEntry.style.display = 'flex'; if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
        if(floatBtns) floatBtns.style.display = 'flex';
    } 
    else if (role === 'ENCODER') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex';
        if(colEntry) colEntry.style.display = 'flex'; if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
        if(floatBtns) floatBtns.style.display = 'flex';
    } 
    else if (role === 'VIEWER') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex';
        if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
        if(floatBtns) floatBtns.style.display = 'flex';
        document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { if(card.getAttribute('onclick') && card.getAttribute('onclick').includes('GXVL')) card.style.display = 'none'; });
    } 
    else if (role === 'NTP_CHECKER') {
        if(navReg) navReg.style.display = 'flex'; if(navRep) navRep.style.display = 'flex'; if(floatBtns) floatBtns.style.display = 'flex';
        document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const attr = card.getAttribute('onclick') || ''; if (!attr.includes('GXP') && !attr.includes('DSSM')) card.style.display = 'none'; });
        document.querySelectorAll('.chip-group .chip').forEach(chip => { if (!chip.getAttribute('onclick').includes('tb')) chip.style.display = 'none'; });
        switchTab('tb');
    }
    else if (role === 'DOH_TB') {
        if(navReg) navReg.style.display = 'flex'; if(floatBtns) floatBtns.style.display = 'flex';
        document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const attr = card.getAttribute('onclick') || ''; if (!attr.includes('GXP') && !attr.includes('DSSM')) card.style.display = 'none'; });
    }
}
 // ==========================================
// 5. ADD PATIENT LOGIC
// ==========================================
const availableTests = {
    "mtb": { testName: "GeneXpert MTB/Rif Ultra", testCode: "GXP", title: "GeneXpert Details", html: `<div class="field-group"><label class="field-label">History</label><select id="gx_hist" class="form-select" data-key="History of Treatment"><option>New</option><option>Retreatment</option></select></div><div class="field-group"><label class="field-label">Source</label><input type="text" id="gx_src" data-key="Source of Request" class="form-input" placeholder="e.g. Dr. Cruz"></div><div class="field-group"><label class="field-label">X-Ray</label><input type="text" id="gx_xray" data-key="X-Ray Result" class="form-input" placeholder="e.g. Normal"></div>`},
    "dssm": { testName: "DSSM", testCode: "DSSM", title: "DSSM Microscopy", html: `<div class="field-group"><label class="field-label">TB Case No</label><input type="text" id="ds_case" data-key="TB Case Number" class="form-input" placeholder="Case Number"></div><div class="field-group"><label class="field-label">Month of Treatment</label><input type="text" id="ds_month" data-key="Month of Treatment" class="form-input" placeholder="e.g. 2nd Month"></div>` },
    "viral": { testName: "GeneXpert Viral Load", testCode: "GXVL", isSimple: true },
    "sero": { testName: "Serology", testCode: "SERO", title: "Serology", html: `<label class="field-label">Test(s):</label><div class="chip-group" id="sero-sub-tests">${['HIV Screening','Syphilis Screening','HBsAg Screening'].map(t => `<div class="chip" onclick="toggleSub(this)" data-val="${t}">${t}</div>`).join('')}</div><div class="form-grid grid-1" style="margin-top:8px;"><div class="field-group"><label class="field-label">Classification</label><select id="sr_class" data-key="Classification" class="form-select"><option>Maternal</option><option>SHC</option><option>TB Patient</option></select></div><div class="field-group"><label class="field-label">KAP Category</label><select id="sr_kap" data-key="KAP Category" class="form-select"><option value="None">None</option><option>MSM</option><option>TGW</option><option>FSW</option><option>MSW</option><option>PDL</option><option>PWID</option></select></div></div>` },
    "gram": { testName: "Gram Stain", testCode: "GRAM", title: "Gram Stain", html: `<div class="field-group"><label class="field-label">Source</label><input type="text" id="gs_src" data-key="Source of Specimen" class="form-input" placeholder="e.g. Urethral Discharge"></div>` },
    "dengue": { testName: "Dengue", testCode: "DENG", title: "Dengue Setup", html: `<div class="field-group"><label class="field-label">Days of Illness</label><input type="number" id="dn_onset" data-key="Day/s of Onset of Illness" class="form-input" placeholder="e.g. 3"></div> <div class="field-group" style="margin-top:12px;"><label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-weight:600; color:var(--text-main); font-size:0.85rem;"><input type="checkbox" id="dn_duo_check" style="accent-color:var(--pri); width:16px; height:16px;"> Include Dengue Duo (IgG/IgM)</label></div>` },
    "hema": { testName: "Hematology", testCode: "HEMA", title: "Hematology", html: `<div class="chip-group">${['CBC','Platelet Count','Blood Typing'].map(t => `<div class="chip" onclick="toggleSub(this)" data-val="${t}">${t}</div>`).join('')}</div>` },
    "uria": { testName: "Urinalysis", testCode: "UA", isSimple: true },
    "feca": { testName: "Fecalysis", testCode: "FA", isSimple: true },
    "chem": { testName: "Blood Chemistry", testCode: "CHEM", title: "Chemistry", html: `<div class="chip-group">${['FBS','OGTT','BUN','Uric Acid','Cholesterol','Triglycerides','Lipid Profile','HBA1C','Creatinine'].map(a => `<div class="chip" onclick="toggleSub(this)" data-val="${a}">${a}</div>`).join('')}</div>` }
};

function openTestDetails(id) {
    const config = availableTests[id]; if (!config) return;
    document.getElementById('test-buttons-container').style.display = 'none'; 
    const area = document.getElementById('test-details-area'); area.style.display = 'block';
    area.innerHTML = `<div style="font-weight: 700; color: var(--pri); margin-bottom: 8px;"><i class="ph ph-info"></i> ${config.title}</div><div class="form-grid grid-1">${config.html}</div><div style="margin-top:12px; display:flex; gap:8px;"><button class="btn btn-secondary" style="flex:1;" onclick="cancelDetail()">Cancel</button><button class="btn btn-primary" style="flex:1;" onclick="confirmDetail('${id}')">Confirm</button></div>`;
}

function toggleSub(btn) { btn.classList.toggle('active'); }
function cancelDetail() { document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-buttons-container').style.display = 'grid'; }
function confirmDetail(id) {
   let details = {}; let subSelected = [];
   document.querySelectorAll('#test-details-area [data-key]').forEach(el => { details[el.getAttribute('data-key')] = el.value; });
   if(id === 'dengue') { if(document.getElementById('dn_duo_check') && document.getElementById('dn_duo_check').checked) subSelected.push('Dengue Duo'); }
   else if(['sero','hema','chem'].includes(id)) { const activeBtns = document.querySelectorAll('#test-details-area .chip.active'); if(activeBtns.length === 0) { showCustomAlert("Select at least one test.", "error"); return; } subSelected = Array.from(activeBtns).map(b => b.getAttribute('data-val')); }
   labOrders[id] = { details: details, subTests: subSelected }; document.getElementById('btn-'+id).classList.add('active'); updateSummary(); cancelDetail(); 
}

function toggleSimple(id) { const btn = document.getElementById('btn-'+id); if(labOrders[id]) { delete labOrders[id]; btn.classList.remove('active'); } else { labOrders[id] = { details: {}, subTests: [] }; btn.classList.add('active'); } updateSummary(); }
function updateSummary() { const container = document.getElementById('order-summary'); container.innerHTML = ''; Object.keys(labOrders).forEach(key => { let label = availableTests[key].testName; if(labOrders[key].subTests && labOrders[key].subTests.length > 0) label += `: ${labOrders[key].subTests.join(', ')}`; container.innerHTML += `<div class="badge badge-warning" style="cursor:pointer;" onclick="removeOrder('${key}')">${label} &times;</div>`; }); }
function removeOrder(key) { delete labOrders[key]; document.getElementById('btn-'+key).classList.remove('active'); updateSummary(); }
function setSelectValue(id, val) { const el = document.getElementById(id); if (!el || !val) return; const searchVal = String(val).toUpperCase().trim(); for (let i = 0; i < el.options.length; i++) { if (el.options[i].value.toUpperCase().trim() === searchVal || el.options[i].text.toUpperCase().trim() === searchVal) { el.selectedIndex = i; return; } } }
function calculateAge() { const dob = new Date(document.getElementById('p_bday').value); const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--; document.getElementById('p_age').value = age; }
function generateSmartID() { if(isExistingPatient) return; const bday = document.getElementById('p_bday').value.replace(/-/g, "") || "00000000"; const name = document.getElementById('p_name').value.trim().toUpperCase(); let initials = "XX"; if(name) { const p = name.split(" "); initials = p.length > 1 ? p[0][0] + p[p.length-1][0] : name.substring(0,2); } document.getElementById('finalPatientId').value = `MHOA-${bday}-${initials}${Math.floor(Math.random()*90+10)}`; }

async function runDirectSearch(q) {
  const box = document.getElementById('direct-results-box'); const stat = document.getElementById('search-status');
  if(q.length < 2) { box.style.display='none'; stat.style.display='none'; return; }
  stat.style.display='block'; clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
      try {
          const res = await apiGet("searchPatients", { query: q });
          if (res.status === "success" && res.data.length > 0) {
              box.style.display = 'block'; 
              box.innerHTML = `<div style="text-align:right; padding:6px; background:var(--bg-subtle); border-bottom:1px dashed var(--border-color);"><button type="button" class="btn btn-secondary text-xs" style="padding:4px 8px;" onclick="document.getElementById('direct-results-box').style.display='none'"><i class="ph ph-x"></i> Hide / New Patient</button></div>`;
              res.data.forEach(p => {
                  const div = document.createElement('div'); div.className = "search-item";
                  div.innerHTML = `<div style="font-weight:600;">${p.name} <span class="badge badge-success" style="margin-left:4px;">Returning</span></div><div style="font-size:0.7rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility || p.Facility || 'No Facility'}</div>`;
                  div.onclick = () => {
                      isExistingPatient = true; document.getElementById('finalPatientId').value = p.id;
                      document.getElementById('p_name').value = p.name || ""; document.getElementById('p_age').value = p.age || "";
                      document.getElementById('p_address').value = p.address || ""; document.getElementById('p_contact').value = p.contact || ""; 
                      setSelectValue('p_sex', p.sex); setSelectValue('p_facility', p.facility || p.Facility);
                      if (p.bday) { try { const d = new Date(p.bday); document.getElementById('p_bday').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } catch(e){} }
                      box.style.display = 'none'; 
                      document.getElementById('new-entry-header').style.display = 'none'; document.getElementById('profile-header').style.display = 'flex';
                      fetchHistory(p.id, 'history-section', 'history-list'); 
                  };
                  box.appendChild(div);
              });
          } else { box.style.display = 'none'; }
      } catch(e) {} finally { stat.style.display='none'; }
  }, 600);
}

function openQuickSearch() { document.getElementById('quick-search-modal').style.display='flex'; const input = document.getElementById('quick-search-input'); input.value = ''; document.getElementById('quick-search-results').style.display = 'none'; document.getElementById('quick-profile-view').style.display = 'none'; input.focus(); }
async function runQuickSearch(q) {
  const box = document.getElementById('quick-search-results'); if(q.length < 2) { box.style.display='none'; return; }
  clearTimeout(searchTimeout); searchTimeout = setTimeout(async () => {
      try {
          const res = await apiGet("searchPatients", { query: q });
          if (res.status === "success" && res.data.length > 0) {
              box.style.display = 'block'; box.innerHTML = '';
              res.data.forEach(p => {
                  const div = document.createElement('div'); div.className = "search-item";
                  div.innerHTML = `<div style="font-weight:600;">${p.name}</div><div style="font-size:0.75rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility || 'No Facility'}</div>`;
                  div.onclick = () => { viewQuickProfile(p); box.style.display = 'none'; }; box.appendChild(div);
              });
          } else { box.style.display = 'none'; }
      } catch(e) {}
  }, 500);
}

async function viewQuickProfile(p) {
    currentQuickPatient = p; document.getElementById('quick-profile-view').style.display = 'flex'; document.getElementById('quick-profile-view').style.flexDirection = 'column';
    document.getElementById('qs-name').innerText = p.name; document.getElementById('qs-meta').innerHTML = `<span><i class="ph ph-fingerprint"></i> ${p.id}</span> <span><i class="ph ph-calendar"></i> ${p.age} yrs</span> <span><i class="ph ph-gender-intersex"></i> ${p.sex}</span> <span><i class="ph ph-buildings"></i> ${p.facility || 'N/A'}</span>`;
    fetchHistory(p.id, null, 'qs-history-list', true); 
}
function editPatientDemographicsQS() { if(!currentQuickPatient) return; document.getElementById('qs-edit-form').style.display = 'block'; document.getElementById('qs_edit_name').value = currentQuickPatient.name; document.getElementById('qs_edit_age').value = currentQuickPatient.age; document.getElementById('qs_edit_fac').value = currentQuickPatient.facility || currentQuickPatient.Facility; }
function savePatientDemographicsQS() { showCustomAlert("Demographics update triggered. (Requires backend updateMasterlist)."); document.getElementById('qs-edit-form').style.display = 'none'; }

async function fetchHistory(id, sectionId, listId, isQuickSearch = false) {
    if(sectionId) document.getElementById(sectionId).style.display = 'block';
    const list = document.getElementById(listId); list.innerHTML = '<div style="text-align:center; color:var(--pri);"><i class="ph ph-spinner ph-spin"></i> Retrieving full records...</div>';
    try {
        const res = await apiGet("getPatientHistory", { patientId: id, role: currentUser.role });
        if (res.status === 'success' && res.data.length > 0) {
            list.innerHTML = res.data.map((h, i) => {
                const uniqueId = `hist-${listId}-${i}`; const dateStr = new Date(h.date).toLocaleDateString();
                let summaryHtml = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">'; let editInputsHtml = '<div class="form-grid grid-2">';
                if(h.fullData) {
                    for (const [key, value] of Object.entries(h.fullData)) {
                        if (key.toUpperCase() !== "JSON DETAILS" && key.toUpperCase() !== "TEST CODE" && String(value).trim() !== "") {
                           summaryHtml += `<span style="font-size:0.7rem; background:var(--bg-subtle); padding:4px 8px; border-radius:4px; border:1px solid var(--border-color);"><strong style="color:var(--pri);">${key}:</strong> ${value}</span>`;
                           editInputsHtml += `<div class="field-group"><label class="field-label">${key}</label><input type="text" class="form-input edit-hist-${uniqueId}" data-key="${key}" value="${value}"></div>`;
                        }
                    }
                }
                summaryHtml += '</div>'; editInputsHtml += '</div>';
                return `
                <div class="history-card" style="display:flex; flex-direction:column; align-items:stretch;">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; cursor:pointer;" ondblclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'" title="Double click to view full details">
                        <div><div class="h-test">${h.test}</div><div class="h-date">${dateStr}</div></div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.8rem; font-weight:bold; color:var(--text-main);">${h.result}</span>
                            <button class="btn-icon" onclick="printDirect(event, '${id}', '${h.test}')" title="Print this Result" style="color:var(--success);"><i class="ph ph-printer"></i></button>
                            <i class="ph ph-caret-down" style="color:var(--text-muted);" onclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'"></i>
                        </div>
                    </div>
                    <div id="${uniqueId}" class="h-expanded-details">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:6px;">
                            <span style="font-size:0.75rem; font-weight:bold; color:var(--text-muted);">RESULT SUMMARY</span>
                            <button class="btn-icon" style="width:24px; height:24px; font-size:1rem;" onclick="toggleHistoryEdit('${uniqueId}')" title="Edit Record"><i class="ph ph-pencil-simple"></i></button>
                        </div>
                        <div id="summary-view-${uniqueId}">${summaryHtml}</div>
                        <div id="edit-view-${uniqueId}" style="display:none; background:var(--bg-body); padding:10px; border-radius:var(--radius-sm); border:1px dashed var(--warning);">
                            <div style="margin-bottom:10px; font-size:0.7rem; color:var(--warning); font-weight:bold;">EDIT COMPLETE DETAILS:</div>
                            ${editInputsHtml}
                            <div style="margin-top:10px; display:flex; gap:10px;">
                                <button class="btn btn-secondary text-xs" onclick="toggleHistoryEdit('${uniqueId}')">Cancel</button>
                                <button class="btn btn-primary text-xs" onclick="saveHistoryEdit('${id}', '${h.test}', '${uniqueId}')"><i class="ph ph-floppy-disk"></i> Update Record</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else { list.innerHTML = '<div class="text-muted text-xs text-center">No lab records found.</div>'; }
    } catch(e) { list.innerHTML = '<div class="text-xs text-center" style="color:var(--danger);">Failed to load history.</div>'; }
}

function toggleHistoryEdit(id) { const sum = document.getElementById('summary-view-'+id); const edt = document.getElementById('edit-view-'+id); if (sum.style.display === 'none') { sum.style.display = 'block'; edt.style.display = 'none'; } else { sum.style.display = 'none'; edt.style.display = 'block'; } }
async function saveHistoryEdit(patientId, testType, uniqueId) { const inputs = document.querySelectorAll(`.edit-hist-${uniqueId}`); let updates = {}; inputs.forEach(inp => updates[inp.getAttribute('data-key')] = inp.value); try { const res = await apiPost("editRegistryRecord", { patientId: patientId, testType: testType, updates: updates }); if (res.status === "success") { showCustomAlert("Record updated successfully!", "success"); toggleHistoryEdit(uniqueId); } } catch(e) { showCustomAlert("Error updating past record: " + e, "error"); } }

function clearForm() {
    document.getElementById('regForm').reset(); labOrders = {}; document.querySelectorAll('.test-btn-vert.active').forEach(b => b.classList.remove('active')); updateSummary(); document.getElementById('finalPatientId').value = ""; isExistingPatient = false; 
    document.getElementById('history-section').style.display = 'none'; document.getElementById('new-entry-header').style.display = 'flex'; document.getElementById('profile-header').style.display = 'none';
    editingPendingId = null; document.getElementById('col-entry').classList.remove('edit-mode-pane'); document.getElementById('entry-main-header').classList.remove('edit-mode-header'); document.getElementById('entry-main-header').innerHTML = `<h2><i class="ph ph-user-plus"></i> Patient Entry</h2><button class="btn-icon" onclick="clearForm()" title="Clear Form"><i class="ph ph-eraser"></i></button>`;
    document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-buttons-container').style.display = 'grid';
    const saveBtn = document.getElementById('save-btn-action'); saveBtn.innerHTML = '<i class="ph ph-paper-plane-right"></i> Save Record'; saveBtn.onclick = finalSubmit; saveBtn.style.background = '';
}

async function finalSubmit() {
  const btn = document.getElementById('save-btn-action');
  if(!document.getElementById('p_name').value || Object.keys(labOrders).length === 0) { showCustomAlert("Fill in Name and select a test.", "error"); return; }
  const originalText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true;

  const pEmail = document.getElementById('p_email').value.trim().toLowerCase();
  const generatedPassword = pEmail ? Math.random().toString(36).slice(-8).toUpperCase() : "";

  let finalTestsArray = []; const pAge = document.getElementById('p_age').value || ""; const pSex = document.getElementById('p_sex').value || ""; const pFacility = document.getElementById('p_facility').value || "";
  Object.keys(labOrders).forEach(key => { const entry = { name: availableTests[key].testName, code: availableTests[key].testCode, details: { ...labOrders[key].details, age: pAge, sex: pSex, facility: pFacility, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, bday: document.getElementById('p_bday').value } }; if(labOrders[key].subTests && labOrders[key].subTests.length > 0) entry.details["Requested Tests"] = labOrders[key].subTests.join(', '); finalTestsArray.push(entry); });

  const formData = { patientId: document.getElementById('finalPatientId').value, fullName: document.getElementById('p_name').value, bday: document.getElementById('p_bday').value, sex: pSex, age: pAge, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, email: pEmail, patientPassword: generatedPassword, facility: pFacility, encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify(finalTestsArray) };

  try {
      const res = await apiPost("submitForm", { formObject: formData });
      if (res.status === "success") { 
          btn.style.background = "var(--success)"; btn.innerHTML = '<i class="ph ph-check"></i> Saved'; 
          clearForm(); if (currentUser.role !== 'ENCODER') await loadPendingData(); 
          if(pEmail && generatedPassword) showCustomAlert(`<b>Patient Portal Access Created!</b><br>Email: ${pEmail}<br>Password: <strong style="color:var(--danger);">${generatedPassword}</strong><br><br><i>Credentials have been emailed to the patient.</i>`, "success");
          setTimeout(() => { btn.disabled = false; btn.innerHTML = originalText; btn.style.background = ""; }, 2000); 
      } else { throw new Error(res.message); }
  } catch (err) { showCustomAlert("Error: " + err, "error"); btn.disabled = false; btn.innerHTML = originalText; }
}

function editPendingFull(id) {
    const item = window.pendingData.find(i => String(i.id) === String(id).trim()); if(!item) return;
    editingPendingId = item.id; isExistingPatient = true; 
    
    document.getElementById('col-entry').classList.add('edit-mode-pane'); document.getElementById('entry-main-header').classList.add('edit-mode-header'); document.getElementById('entry-main-header').innerHTML = `<h2><i class="ph ph-pencil-simple"></i> Editing Pending Record</h2><button class="btn-icon" onclick="cancelEditPending()" style="color:white;"><i class="ph ph-x"></i></button>`;
    document.getElementById('finalPatientId').value = item.patientId; document.getElementById('p_name').value = item.name || "";
    let d = {}; try { d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; } catch(e){}
    document.getElementById('p_age').value = d.age || d.Age || ""; document.getElementById('p_address').value = d.address || d.Address || ""; document.getElementById('p_contact').value = d.contact || d.Contact || "";
    setSelectValue('p_sex', d.sex || d.Sex); setSelectValue('p_facility', d.facility || d.Facility);
    if(d.bday || d.Bday) { try { const bd = new Date(d.bday||d.Bday); document.getElementById('p_bday').value = `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}`; } catch(e){} }
    
    document.getElementById('new-entry-header').style.display = 'none'; document.getElementById('profile-header').style.display = 'flex';
    fetchHistory(item.patientId, 'history-section', 'history-list'); 
    
    document.getElementById('test-buttons-container').style.display = 'none'; const area = document.getElementById('test-details-area'); area.style.display = 'block';
    let testKey = Object.keys(availableTests).find(k => availableTests[k].testName.toUpperCase() === item.test.toUpperCase() || availableTests[k].testCode.toUpperCase() === item.test.toUpperCase());
    let dynamicHtml = testKey ? availableTests[testKey].html : `<textarea id="edit-pending-fallback-box" class="form-input" style="min-height:100px;">${JSON.stringify(d,null,2)}</textarea>`;
    
    area.innerHTML = `<div style="font-weight: 700; color: var(--pri); margin-bottom: 8px;"><i class="ph ph-info"></i> Updating Details for ${item.test}</div><div id="temp-form-data" class="form-grid grid-1">${dynamicHtml}</div><div style="margin-top:12px; display:flex; gap:8px;"><button class="btn btn-secondary" style="flex:1;" onclick="cancelEditPending()">Cancel Edit</button></div>`;
    setTimeout(() => { document.querySelectorAll('#test-details-area [data-key]').forEach(el => { let val = d[el.getAttribute('data-key')]; if(val) el.value = val; }); }, 100);
    
    const saveBtn = document.getElementById('save-btn-action'); saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Update Pending Record'; saveBtn.onclick = submitPendingUpdate; saveBtn.style.background = 'var(--warning)'; saveBtn.style.color = 'white';
}

function cancelEditPending() { clearForm(); } 
async function submitPendingUpdate() {
    if(!editingPendingId) return; const item = window.pendingData.find(i => String(i.id) === String(editingPendingId).trim());
    const btn = document.getElementById('save-btn-action'); const oldTxt = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Updating...'; btn.disabled = true;
    let newDetails = {}; document.querySelectorAll('#test-details-area [data-key]').forEach(el => { newDetails[el.getAttribute('data-key')] = el.value; });
    let oldD = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; let finalJsonStr = JSON.stringify({...oldD, ...newDetails});

    try { await apiPost("updatePatientAndTestDetails", { testId: editingPendingId, patientId: item.patientId, newName: document.getElementById('p_name').value, newTestType: item.test, newJsonDetails: finalJsonStr }); cancelEditPending(); await loadPendingData(); } catch(e) { showCustomAlert("Error: " + e, "error"); } finally { btn.innerHTML = oldTxt; btn.disabled = false; }
}
// ==========================================
// 6. PENDING CARDS & RESULTS LOGIC
// ==========================================
async function loadPendingData() {
  const icon = document.getElementById('refresh-icon'); if(icon) icon.classList.add('ph-spin');
  try {
      const res = await apiGet("getPendingWorkload", { role: currentUser.role, facility: currentUser.facility });
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      window.pendingData = (data.pending || []).map(item => { item.id = String(item.id).trim(); return item; }).reverse(); 
      window.completedData = (data.completed || data.encoded || []).map(item => { item.id = String(item.id).trim(); return item; }).reverse();
      renderLists();
  } catch (e) { } finally { if(icon) icon.classList.remove('ph-spin'); }
}

function renderLists() {
    const pList = document.getElementById('list-pending'); const cList = document.getElementById('list-completed'); const rList = document.getElementById('list-repeat');
    const filterSelect = document.getElementById('test-filter');
    if (!pList || !cList) return;
    
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
    const isViewer = (role === 'VIEWER');
    const isLimited = localStorage.getItem('mho-limited-mode') === 'true';
    const allowedTests = ['GXP', 'DSSM', 'GRAM', 'DENGUE', 'SERO'];

    const uniqueTests = [...new Set(window.pendingData.map(item => item.test.toUpperCase()))];
    const currentVal = filterSelect.value;
    let dropHtml = '<option value="ALL">All Sections</option>';
    uniqueTests.forEach(t => { let tCode = getTestCodeFromName(t); if(!isLimited || allowedTests.includes(tCode)) { dropHtml += `<option value="${t}">${t}</option>`; } });
    filterSelect.innerHTML = dropHtml; filterSelect.value = currentVal || 'ALL';

    const filterFn = (item, isCompleted) => {
        let t = (item.test || "").toUpperCase(); let filterVal = filterSelect.value; let tCode = getTestCodeFromName(t);
        if(isLimited && !allowedTests.includes(tCode)) return false; 
        let typeMatch = (filterVal === "ALL") || t.includes(filterVal);
        if (!typeMatch) return false;
        if (isCompleted) { if (item.isSessionCompleted) return true; const dStr = item.dateResult || item.dateEncoded || item.date; if (dStr && new Date(dStr).toDateString() !== new Date().toDateString()) return false; }
        return true;
    };

    const fPending = window.pendingData.filter(i => filterFn(i, false)); 
    const fComp = window.completedData.filter(i => filterFn(i, true));

    let latestCompleted = {};
    window.completedData.forEach(item => { let key = item.patientId + "_" + item.test.toUpperCase(); if(!latestCompleted[key]) latestCompleted[key] = item; });
    const fRepeat = [];
    Object.values(latestCompleted).forEach(item => {
        let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
        let rpt = d.Repeat || d["Test Type"] || "";
        if (String(rpt).toUpperCase() === 'INITIAL') {
            let isAlreadyPending = window.pendingData.some(p => p.patientId === item.patientId && p.test.toUpperCase() === item.test.toUpperCase());
            if(!isAlreadyPending) { let tCode = getTestCodeFromName(item.test); if(!isLimited || allowedTests.includes(tCode)) { let typeMatch = (filterSelect.value === "ALL") || item.test.toUpperCase().includes(filterSelect.value); if(typeMatch) fRepeat.push(item); } }
        }
    });

    pList.innerHTML = fPending.map(item => {
        const safeId = item.id.replace(/[^a-zA-Z0-9]/g, ""); let tCode = getTestCodeFromName(item.test);
        let subTxt = ""; let repeatBadge = ""; 
        try { 
            let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; 
            if(d.Age) subTxt = `(${d.Age}/${d.Sex})`; 
            let hasInitial = window.completedData.some(c => c.patientId === item.patientId && c.test.toUpperCase() === item.test.toUpperCase() && (() => { let cd = typeof c.details === 'string' ? JSON.parse(c.details) : c.details; return String(cd.Repeat || cd["Test Type"]).toUpperCase() === 'INITIAL'; })());
            if(hasInitial) repeatBadge = `<span style="background:var(--danger); color:white; padding:3px 6px; border-radius:4px; font-size:0.6rem; font-weight:bold; margin-left:6px; box-shadow: 0 2px 4px rgba(231,76,60,0.3);">REPEAT</span>`;
        } catch(e){}
        
        let actionsHtml = isViewer ? '' : `<div style="display:flex; gap:5px;"><button onclick="editPendingFull('${item.id}')" class="btn-icon" title="Edit Full Profile"><i class="ph ph-pencil-simple"></i></button><button onclick="confirmDelete('${item.id}')" class="btn-icon" style="color:var(--danger);" title="Delete"><i class="ph ph-trash"></i></button></div>`;
        let clickAttr = isViewer ? '' : `onclick="toggleExpand('${safeId}')" style="cursor:pointer; flex-grow:1;"`;
        let expandAreaHtml = isViewer ? '' : `<div id="expand-${safeId}" class="pc-expand-area"><div style="display:flex; gap:10px; margin-bottom: 16px;"><button class="btn btn-secondary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, false)"><i class="ph ph-floppy-disk"></i> Save Only</button><button class="btn btn-primary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, true)"><i class="ph ph-printer"></i> Save & Print</button></div><div>${getResultTemplate(tCode, safeId, item)}</div></div>`;
        
        return `<div class="pending-card" id="card-${safeId}"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div ${clickAttr}><div class="pc-name">${item.name} <span style="color:var(--text-muted); font-size:0.7rem; font-weight:normal;">${subTxt}</span> ${repeatBadge}</div><div class="pc-meta">${item.test} • By: <span style="color:var(--pri);">${item.encoder || 'System'}</span></div></div>${actionsHtml}</div>${expandAreaHtml}</div>`;
    }).join('');

    if (rList) {
        rList.innerHTML = fRepeat.map(item => {
            const safeId = item.id.replace(/[^a-zA-Z0-9]/g, "");
            return `<div class="pending-card" style="border-left: 4px solid var(--warning); background: var(--warning-light-bg);">
                        <div class="pc-name" style="color: var(--warning);">${item.name}</div>
                        <div class="pc-meta" style="margin-bottom:8px;">${item.test}</div>
                        ${isViewer ? '' : `<button class="btn btn-secondary text-xs full-width" id="btn-repeat-${safeId}" style="border-color:var(--warning); color:var(--warning); font-weight:bold;" onclick="moveToPendingRepeat('${item.id}')"><i class="ph ph-arrow-circle-left"></i> Move to Pending</button>`}
                    </div>`;
        }).join('');
        document.getElementById('count-repeat').innerText = `(${fRepeat.length})`;
    }

    cList.innerHTML = fComp.map(item => {
        let tCodePrint = getTestCodeFromName(item.test);
        let repeatBadge = ""; 
        try { 
            let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; 
            let rpt = d.Repeat || d["Test Type"];
            if(rpt && String(rpt).toUpperCase() === 'INITIAL') { repeatBadge = `<span class="badge badge-warning" style="margin-left:4px; font-size:0.55rem;">INITIAL</span>`; }
        } catch(e){}

        return `<div class="completed-card" onclick="printDirect(event, '${item.id}', '${tCodePrint}')" title="Click to print"><div style="overflow:hidden;"><div class="pc-name">${item.name} ${repeatBadge}</div><div class="pc-meta">${item.test}</div></div><i class="ph ph-printer" style="color: var(--success); font-size: 1.2rem;"></i></div>`;
    }).join('');
    document.getElementById('count-pending').innerText = `(${fPending.length})`;
}

async function moveToPendingRepeat(idStr) {
    const item = window.completedData.find(i => String(i.id) === String(idStr)); if(!item) return;
    const btn = document.getElementById('btn-repeat-' + item.id.replace(/[^a-zA-Z0-9]/g, ""));
    if(btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Moving...'; btn.disabled = true; }

    let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
    let cleanDetails = { age: d.age || d.Age || "", sex: d.sex || d.Sex || "", facility: d.facility || d.Facility || "", address: d.address || d.Address || "", contact: d.contact || d.Contact || "", bday: d.bday || d.Bday || "", "History of Treatment": d["History of Treatment"] || "", "Source of Request": d["Source of Request"] || "", "X-Ray Result": d["X-Ray Result"] || "" };
    const tCode = getTestCodeFromName(item.test);
    const testEntry = { name: item.test, code: tCode, details: cleanDetails };
    const formData = { patientId: item.patientId, fullName: item.name, bday: cleanDetails.bday, sex: cleanDetails.sex, age: cleanDetails.age, address: cleanDetails.address, contact: cleanDetails.contact, email: "", facility: cleanDetails.facility, encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify([testEntry]) };

    try { const res = await apiPost("submitForm", { formObject: formData }); if (res.status === "success") { showCustomAlert("Moved to Pending successfully!", "success"); await loadPendingData(); } else { showCustomAlert("Error: " + res.message, "error"); if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } } } catch (err) { showCustomAlert("Error moving.", "error"); if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } }
}

function toggleExpand(safeId) { const el = document.getElementById('expand-' + safeId); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function confirmDelete(id) { showCustomConfirm("Are you sure you want to delete this entry?", async () => { try { await apiPost("deletePendingTestById", { testId: id }); loadPendingData(); } catch(e) {} }); }

async function saveResult(id, safeId, btn, doPrint) {
  let printWin = null;
  if (doPrint) { printWin = window.open('', '_blank'); printWin.document.write('<h2>Generating Document... Please wait.</h2>'); }
  
  const inputs = document.querySelectorAll('.res-' + safeId); const item = window.pendingData.find(d => String(d.id) === String(id).trim());
  let newResults = {}; inputs.forEach(inp => { newResults[inp.getAttribute('data-key')] = inp.value; });
  let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
  let tCodePrint = getTestCodeFromName(item.test);
  
  if (tCodePrint === "GXP" && (!newResults["Remarks"] || newResults["Remarks"].trim() === "")) {
      if (detailsObj["X-Ray Result"]) { newResults["Remarks"] = "X-Ray: " + detailsObj["X-Ray Result"]; }
  }
  
  let finalStr = JSON.stringify({ ...detailsObj, ...newResults });
  btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';

  try {
      const res = await apiPost("saveLabResult", { patientId: item.patientId, testId: id, jsonDetails: finalStr, encodedBy: currentUser.fullName || currentUser.username, updatedName: item.name, updatedTest: item.test });
      if (res.status === "success") {
          btn.style.background = "var(--success)"; btn.innerHTML = 'Saved';
          if(doPrint) { 
              const printRes = await apiPost("printFromRegistry", { requests: [{testCode: id, testName: tCodePrint}] });
              if(printRes.status === "success" && printRes.data) { printWin.document.open(); printWin.document.write(printRes.data); printWin.document.close(); } else { printWin.document.body.innerHTML = "Error generating print view."; }
          }
          await loadPendingData(); 
      }
  } catch (err) { if(printWin) printWin.close(); btn.disabled = false; btn.innerHTML = "Save Only"; }
}

function getTestCodeFromName(name) {
    const t = name.toUpperCase();
    if (t.includes("VIRAL")) return "GXVL"; if (t.includes("GXP")||t.includes("MTB")) return "GXP";
    if (t.includes("DSSM")||t.includes("AFB")) return "DSSM"; if (t.includes("UA") || t.includes("URINALYSIS")) return "UA";
    if (t.includes("FA") || t.includes("FECALYSIS")) return "FA"; if (t.includes("HEMA")||t.includes("CBC")) return "HEMA";
    if (t.includes("CHEM")) return "CHEM"; if (t.includes("GRAM")) return "GRAM";
    if (t.includes("DENGUE")) return "DENGUE"; if (t.includes("SERO")) return "SERO";
    return "DEFAULT";
}

async function printDirect(e, id, testName) { 
    if(e) e.stopPropagation(); const correctCode = getTestCodeFromName(testName);
    const win = window.open('', '_blank'); win.document.write('<h2>Loading Document...</h2>');
    try { const res = await apiPost("printFromRegistry", { requests: [{testCode: id, testName: correctCode}] }); if (res.status === "success" && res.data) { win.document.open(); win.document.write(res.data); win.document.close(); } else { win.document.body.innerHTML = "Document not found."; } } catch (e) { win.document.body.innerHTML = "Print Error."; } 
}

// TEMPLATES
function handleDSSM(sel, safeId, num) { const box = document.getElementById(`s${num}n-${safeId}`); if(sel.value === '+N') box.style.display = 'block'; else { box.style.display = 'none'; if(box.querySelector('input')) box.querySelector('input').value = ""; } }
function getResultTemplate(code, safeId, item) {
 const gradings = ["Negative", "Trace", "1+", "2+", "3+", "4+"]; const apps = ["Watery", "Salivary", "Mucosalivary", "Mucopurulent", "Purulent", "Blood-Streaked"];
 let req = ""; try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; req = (d["Requested Tests"] || "").toUpperCase(); } catch(e){}
 const input = (key, lbl, keys=[]) => (req==="" || keys.length===0 || keys.some(k=>req.includes(k))) ? `<div class="field-group"><label class="field-label">${lbl}</label><input type="text" class="res-${safeId} form-input" data-key="${key}"></div>` : '';
 const select = (key, lbl, opts, keys=[]) => (req==="" || keys.length===0 || keys.some(k=>req.includes(k))) ? `<div class="field-group"><label class="field-label">${lbl}</label><select class="res-${safeId} form-select" data-key="${key}">${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div>` : '';
 const rem = `<div class="field-group full-width" style="margin-top:10px;"><label class="field-label">Remarks</label><input type="text" class="res-${safeId} form-input" data-key="Remarks"></div>`;
 
 switch (code) {
     case 'GXP': return `<div class="form-grid grid-2">${select('ResultCode', 'MTB Result', ['N', 'T', 'TT', 'TI', 'RR', 'I'])} ${select('Appearance', 'Appearance', apps)} <div class="full-width">${select('Grade', 'Grade', ['', 'Very Low', 'Low', 'Medium', 'High'])}</div> <div class="full-width">${select('Test Type', 'Test Type', ['Standard', 'INITIAL'])}</div></div>${rem}`;
     case 'GXVL': return `<div class="form-grid grid-1">${select('VL_Choice', 'Interpretation', ['HIV-1 NOT DETECTED', 'DETECTED_XX', 'DETECTED >1X10e7', 'DETECTED <40', 'INVALID'])}${input('VL_Number', 'Copies/mL')}</div>${rem}`;
     case 'DSSM': return `<div class="form-grid grid-2">${[1,2].map(n=>`<div class="field-group"><label class="field-label">Smear ${n}</label><select class="res-${safeId} form-select" data-key="Smear${n}" onchange="handleDSSM(this,'${safeId}','${n}')"><option value=""></option><option value="0">0</option><option value="+N">+N</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option></select></div><div id="s${n}n-${safeId}" style="display:none;" class="field-group"><label class="field-label">Count</label><input type="number" class="res-${safeId} form-input" data-key="Smear${n}_Count"></div>`).join('')}<div class="full-width

