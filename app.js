const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwJeZ3ljs9YSeVyqRB0iCwNln6NLMDD_eFE4DOnyrTZ2ebRLrgbTw0dCQPlD1aJXdOnoQ/exec"; 

let currentUser = { username: "", facility: "", role: "", fullName: "" };
let labOrders = {};
let pendingData = [];
let completedData = [];
let isExistingPatient = false; 
let editingPendingId = null;
let currentQuickPatient = null;
let searchTimeout; 
let confirmActionCallback = null; 
window.CURRENT_TEST_TYPE = ""; 
const ALL_PAGES = ['page-workspace', 'page-registry', 'page-reports', 'page-settings', 'page-patient'];
const TODAY_STR = new Date().toLocaleDateString(); 

// --- Custom Alerts ---
function closeCustomAlert() { document.getElementById('custom-alert').style.display = 'none'; }
function showAppAlert(title, message, type = 'info') {
    const modal = document.getElementById('custom-alert');
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-msg').innerText = message;
    const iconEl = document.getElementById('custom-alert-icon');
    if(type === 'success') { iconEl.className = 'ph ph-check-circle'; iconEl.style.color = 'var(--success)'; } 
    else if(type === 'error') { iconEl.className = 'ph ph-warning-circle'; iconEl.style.color = 'var(--danger)'; } 
    else { iconEl.className = 'ph ph-info'; iconEl.style.color = 'var(--pri)'; }
    modal.style.display = 'flex';
}
function customConfirm(message, callback) {
    document.getElementById('custom-confirm-msg').innerText = message;
    document.getElementById('custom-confirm').style.display = 'flex';
    confirmActionCallback = callback;
}
function closeCustomConfirm(isConfirmed) {
    document.getElementById('custom-confirm').style.display = 'none';
    if (isConfirmed && confirmActionCallback) confirmActionCallback();
    confirmActionCallback = null;
}
window.alert = function(message) { showAppAlert("Notice", message, "info"); };

// --- API Functions ---
async function apiGet(action, params = {}) { 
    let url = new URL(SCRIPT_URL); url.searchParams.append('action', action); 
    for (let key in params) if (params[key] !== undefined) url.searchParams.append(key, params[key]); 
    const res = await fetch(url); return await res.json(); 
}
async function apiPost(action, payload) { 
    const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, ...payload }) }); 
    return await res.json(); 
}

// --- Startup ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (localStorage.getItem('mho-theme') === 'dark') document.body.classList.add('dark-mode');
        const isLimited = localStorage.getItem('mho-limited-mode') === 'true';
        const toggleLimit = document.getElementById('toggle-limited-mode');
        if(toggleLimit) toggleLimit.checked = isLimited;
        applyLimitedMode(isLimited);

        const savedUser = localStorage.getItem('labUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            if (!currentUser.username) throw new Error("Invalid");
            
            document.getElementById('login-overlay').style.display = 'none';
            document.getElementById('display-full-name').innerText = currentUser.fullName || currentUser.username;
            document.getElementById('display-role-facility').innerText = `${currentUser.role} | ${currentUser.facility}`;
            document.getElementById('pill-avatar').innerHTML = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();
            
            applyPermissions(); 
            const r = String(currentUser.role).toUpperCase().replace(/\s+/g, '_');
            if(r === 'PATIENT') { showPage('patient'); loadPatientResults(); }
            else if(r === 'NTP_CHECKER' || r === 'DOH_TB' || r === 'VIEWER') showPage('registry'); 
            else showPage('workspace');
        }
    } catch (e) { 
        localStorage.removeItem('labUser'); 
        document.getElementById('login-overlay').style.display = 'flex';
    } finally {
        document.getElementById('app-loader').style.display = 'none';
    }
});

// --- UI Toggles ---
function toggleLimitedMode() { const isChecked = document.getElementById('toggle-limited-mode').checked; localStorage.setItem('mho-limited-mode', isChecked); applyLimitedMode(isChecked); }
function applyLimitedMode(isLimited) {
    const hiddenTests = ['btn-viral', 'btn-hema', 'btn-chem', 'btn-uria', 'btn-feca'];
    const hiddenRegistries = ['GXVL', 'HEMA', 'CHEM', 'UA', 'FA'];
    hiddenTests.forEach(id => { const btn = document.getElementById(id); if(btn) { if(isLimited) btn.classList.add('disabled-test'); else btn.classList.remove('disabled-test'); } });
    document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const onclickAttr = card.getAttribute('onclick'); if(onclickAttr) { let isHidden = hiddenRegistries.some(r => onclickAttr.includes(r)); if(isLimited && isHidden) card.classList.add('disabled-test'); else card.classList.remove('disabled-test'); } });
}
function toggleSidebar() { const sidebar = document.getElementById('main-sidebar'); const overlay = document.getElementById('sidebar-overlay'); if (sidebar.classList.contains('show')) { sidebar.classList.remove('show'); overlay.style.display = 'none'; overlay.style.opacity = '0'; } else { sidebar.classList.add('show'); overlay.style.display = 'block'; setTimeout(()=>overlay.style.opacity = '1', 10); } }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const icon = document.getElementById('theme-icon'); const text = document.getElementById('theme-text'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('mho-theme', 'dark'); if(icon) icon.classList.replace('ph-moon-stars', 'ph-sun'); if(text) text.innerText = "Light Mode"; } else { localStorage.setItem('mho-theme', 'light'); if(icon) icon.classList.replace('ph-sun', 'ph-moon-stars'); if(text) text.innerText = "Dark Mode"; } }

// --- Modals & Login ---
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

async function attemptLogin() {
    const u = document.getElementById('login_user').value.trim(); const p = document.getElementById('login_pass').value.trim();
    const btn = document.getElementById('btn-login'); const err = document.getElementById('login-error');
    if (!u || !p) { err.style.display = 'block'; err.innerText = "Enter credentials."; return; }
    btn.innerHTML = 'Verifying...'; btn.disabled = true; err.style.display = 'none';
    try {
        const res = await apiGet("loginUser", { username: u, password: p });
        if (res.status === "SUCCESS") { currentUser = { username: res.username, facility: res.facility, role: res.role, fullName: res.fullName }; localStorage.setItem('labUser', JSON.stringify(currentUser)); window.location.reload(); } 
        else if (res.status === "PENDING") { err.style.display = 'block'; err.innerHTML = "Account Pending Approval."; } else { err.style.display = 'block'; err.innerHTML = "Invalid credentials"; }
    } catch (e) { alert("Server Error."); } finally { btn.innerHTML = 'Log In'; btn.disabled = false; }
}

async function attemptPatientLogin() {
    const e = document.getElementById('pat_user').value.trim().toLowerCase(); const p = document.getElementById('pat_pass').value.trim();
    const btn = document.getElementById('btn-pat-login'); const err = document.getElementById('login-error');
    if (!e || !p) { err.style.display = 'block'; err.innerText = "Enter email and password."; return; }
    btn.innerHTML = 'Verifying...'; btn.disabled = true; err.style.display = 'none';
    try {
        const res = await apiGet("patientLogin", { email: e, password: p });
        if (res.status === "SUCCESS") { currentUser = { username: res.patientId, facility: "PATIENT", role: "PATIENT", fullName: res.name }; localStorage.setItem('labUser', JSON.stringify(currentUser)); window.location.reload(); } 
        else { err.style.display = 'block'; err.innerHTML = "Invalid credentials."; }
    } catch (e) { err.style.display = 'block'; err.innerHTML = "Server Error."; } finally { btn.innerHTML = 'View My Results'; btn.disabled = false; }
}

function showPatientResend() { document.getElementById('login-card').style.display = 'none'; document.getElementById('patient-resend-card').style.display = 'block'; }
function showPatientInfo() { document.getElementById('login-card').style.display = 'none'; document.getElementById('patient-info-card').style.display = 'block'; }
function backToLoginFromPatient() { document.getElementById('patient-resend-card').style.display = 'none'; document.getElementById('patient-info-card').style.display = 'none'; document.getElementById('login-card').style.display = 'block'; }
async function resendPatientPassword() { 
    const email = document.getElementById('resend_pat_email').value.trim(); 
    if(!email) return showAppAlert("Required", "Please enter your email.", "error"); 
    const btn = document.querySelector('#patient-resend-card .btn-primary'); 
    const oldText = btn.innerHTML; btn.innerHTML = "Sending..."; btn.disabled = true; 
    try { await apiPost("resendPatientPassword", { email: email }); showAppAlert("Success", "If registered, your password has been sent.", "success"); backToLoginFromPatient(); } 
    catch(e) { showAppAlert("Success", "If registered, your password has been sent.", "success"); backToLoginFromPatient(); } finally { btn.innerHTML = oldText; btn.disabled = false; } 
}

function logoutUser() { 
    const modal = document.getElementById('logout-modal'); 
    if (modal) modal.style.display = 'flex'; 
    const sidebar = document.getElementById('main-sidebar'); 
    if (sidebar && sidebar.classList.contains('show')) toggleSidebar(); 
}
function closeLogoutModal() { document.getElementById('logout-modal').style.display = 'none'; }
function confirmLogout() { localStorage.removeItem('labUser'); window.location.reload(); }
function showRegistrySelectionModal() { document.getElementById('registry-selection-modal').style.display = 'flex'; }

function showPage(targetId) {
    const elId = 'page-' + targetId; const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
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
    else if (role === 'NTP_CHECKER' || role === 'DOH_TB') {
        if(navReg) navReg.style.display = 'flex'; if(role === 'NTP_CHECKER' && navRep) navRep.style.display = 'flex'; if(floatBtns) floatBtns.style.display = 'flex';
        document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const attr = card.getAttribute('onclick') || ''; if (!attr.includes('GXP') && !attr.includes('DSSM')) card.style.display = 'none'; });
        if(role === 'NTP_CHECKER') { document.querySelectorAll('.chip-group .chip').forEach(chip => { if (!chip.getAttribute('onclick').includes('tb')) chip.style.display = 'none'; }); switchTab('tb'); }
    }
}
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

function openTestDetails(id) { const config = availableTests[id]; if (!config) return; document.getElementById('test-buttons-container').style.display = 'none'; const area = document.getElementById('test-details-area'); area.style.display = 'block'; area.innerHTML = `<div style="font-weight: 700; color: var(--pri); margin-bottom: 8px;"><i class="ph ph-info"></i> ${config.title}</div><div class="form-grid grid-1">${config.html}</div><div style="margin-top:12px; display:flex; gap:8px;"><button class="btn btn-secondary" style="flex:1;" onclick="cancelDetail()">Cancel</button><button class="btn btn-primary" style="flex:1;" onclick="confirmDetail('${id}')">Confirm</button></div>`; }
function toggleSub(btn) { btn.classList.toggle('active'); }
function cancelDetail() { document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-buttons-container').style.display = 'grid'; }
function confirmDetail(id) { let details = {}; let subSelected = []; document.querySelectorAll('#test-details-area [data-key]').forEach(el => { details[el.getAttribute('data-key')] = el.value; }); if(id === 'dengue') { if(document.getElementById('dn_duo_check') && document.getElementById('dn_duo_check').checked) subSelected.push('Dengue Duo'); } else if(['sero','hema','chem'].includes(id)) { const activeBtns = document.querySelectorAll('#test-details-area .chip.active'); if(activeBtns.length === 0) { showAppAlert("Required", "Select at least one test.", "error"); return; } subSelected = Array.from(activeBtns).map(b => b.getAttribute('data-val')); } labOrders[id] = { details: details, subTests: subSelected }; document.getElementById('btn-'+id).classList.add('active'); updateSummary(); cancelDetail(); }
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
                      isExistingPatient = true; document.getElementById('finalPatientId').value = p.id; document.getElementById('p_name').value = p.name || ""; document.getElementById('p_age').value = p.age || ""; document.getElementById('p_address').value = p.address || ""; document.getElementById('p_contact').value = p.contact || ""; 
                      if(document.getElementById('p_email')) document.getElementById('p_email').value = p.email || "";
                      setSelectValue('p_sex', p.sex); setSelectValue('p_facility', p.facility || p.Facility);
                      if (p.bday) { try { const d = new Date(p.bday); document.getElementById('p_bday').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } catch(e){} }
                      box.style.display = 'none'; document.getElementById('new-entry-header').style.display = 'none'; document.getElementById('profile-header').style.display = 'flex';
                      fetchHistory(p.id, 'history-section', 'history-list'); 
                  }; box.appendChild(div);
              });
          } else { box.style.display = 'none'; }
      } catch(e) {} finally { stat.style.display='none'; }
  }, 600);
}

function openQuickSearch() { 
    document.getElementById('quick-search-modal').style.display='flex'; 
    const input = document.getElementById('quick-search-input'); 
    input.value = ''; document.getElementById('quick-search-results').style.display = 'none'; 
    document.getElementById('quick-profile-view').style.display = 'none'; input.focus(); 
}

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
    currentQuickPatient = p; 
    document.getElementById('quick-profile-view').style.display = 'flex'; 
    document.getElementById('quick-profile-view').style.flexDirection = 'column';
    document.getElementById('qs-name').innerText = p.name; 
    document.getElementById('qs-meta').innerHTML = `<span><i class="ph ph-fingerprint"></i> ${p.id}</span> <span><i class="ph ph-calendar"></i> ${p.age} yrs</span> <span><i class="ph ph-gender-intersex"></i> ${p.sex}</span> <span><i class="ph ph-buildings"></i> ${p.facility || 'N/A'}</span>`;
    fetchHistory(p.id, null, 'qs-history-list', true, false); 
}

function editPatientDemographicsQS() { 
    if(!currentQuickPatient) return; 
    document.getElementById('qs-edit-form').style.display = 'block'; 
    document.getElementById('qs_edit_name').value = currentQuickPatient.name; 
    document.getElementById('qs_edit_age').value = currentQuickPatient.age; 
    document.getElementById('qs_edit_fac').value = currentQuickPatient.facility || currentQuickPatient.Facility; 
}
function savePatientDemographicsQS() { 
    showAppAlert("Feature Offline", "Demographics update requires backend linkage.", "info"); 
    document.getElementById('qs-edit-form').style.display = 'none'; 
}

async function loadPatientResults() {
    const histContainer = document.getElementById('my-portal-history'); 
    if(histContainer) histContainer.innerHTML = '<div style="text-align:center;"><i class="ph ph-spinner ph-spin"></i> Retrieving your records...</div>';
    const nameEl = document.getElementById('my-portal-name'); if(nameEl) nameEl.innerText = currentUser.fullName || "Patient Portal";
    const metaEl = document.getElementById('my-portal-meta'); if(metaEl) metaEl.innerText = `Patient ID: ${currentUser.username}`;
    fetchHistory(currentUser.username, null, 'my-portal-history', false, true); 
}

function getTestCodeFromName(name) {
    const t = String(name).toUpperCase();
    if (t.includes("VIRAL") || t.includes("VL")) return "GXVL"; 
    if (t.includes("GXP") || t.includes("MTB") || t.includes("GENEXPERT")) return "GXP";
    if (t.includes("DSSM") || t.includes("AFB")) return "DSSM"; 
    if (t.includes("UA") || t.includes("URINALYSIS")) return "UA";
    if (t.includes("FA") || t.includes("FECALYSIS")) return "FA"; 
    if (t.includes("HEMA") || t.includes("CBC")) return "HEMA";
    if (t.includes("CHEM") || t.includes("BLOOD CHEM")) return "CHEM"; 
    if (t.includes("GRAM")) return "GRAM";
    if (t.includes("DENGUE") || t.includes("NS1")) return "DENGUE"; 
    if (t.includes("SERO") || t.includes("HIV") || t.includes("SYPHILIS") || t.includes("HBSAG")) return "SERO";
    return t; 
}

async function fetchHistory(id, sectionId, listId, isQuickSearch = false, isPatientPortal = false) {
    if(sectionId) document.getElementById(sectionId).style.display = 'block';
    const list = document.getElementById(listId); list.innerHTML = '<div style="text-align:center; color:var(--pri);"><i class="ph ph-spinner ph-spin"></i> Retrieving full records...</div>';
    try {
        const res = await apiGet("getPatientHistory", { patientId: id, role: currentUser.role });
        if (res.status === 'success' && res.data.length > 0) {
            list.innerHTML = res.data.map((h, i) => {
                const uniqueId = `hist-${listId}-${i}`; const dateStr = new Date(h.date).toLocaleDateString();
                let summaryHtml = '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;">'; let editInputsHtml = '<div class="form-grid grid-2">';
                let testCodeForPrint = id; 

                if(h.fullData) {
                    testCodeForPrint = h.fullData["Test Code"] || h.fullData["Sample ID"] || h.fullData["Lab Serial Number"] || id;
                    for (const [key, value] of Object.entries(h.fullData)) {
                        if (key.toUpperCase() !== "JSON DETAILS" && key.toUpperCase() !== "TEST CODE" && String(value).trim() !== "") {
                           summaryHtml += `<span style="font-size:0.7rem; background:var(--bg-subtle); padding:4px 8px; border-radius:4px; border:1px solid var(--border-color);"><strong style="color:var(--pri);">${key}:</strong> ${value}</span>`;
                           editInputsHtml += `<div class="field-group"><label class="field-label">${key}</label><input type="text" class="form-input edit-hist-${uniqueId}" data-key="${key}" value="${value}"></div>`;
                        }
                    }
                }
                summaryHtml += '</div>'; editInputsHtml += '</div>';
                let editBtnHtml = (isQuickSearch && !isPatientPortal) ? `<button class="btn-icon" style="width:24px; height:24px; font-size:1rem;" onclick="toggleHistoryEdit('${uniqueId}')" title="Edit Record"><i class="ph ph-pencil-simple"></i></button>` : '';
                let printBtnHtml = (isQuickSearch || isPatientPortal) ? `<button class="btn-icon" onclick="printDirect(event, '${testCodeForPrint}', '${h.test}')" title="Print this Result" style="color:var(--success);"><i class="ph ph-printer"></i></button>` : '';
                let updateBtnHtml = (isQuickSearch && !isPatientPortal) ? `<button class="btn btn-primary text-xs" onclick="saveHistoryEdit('${id}', '${h.test}', '${uniqueId}')"><i class="ph ph-floppy-disk"></i> Update Record</button>` : '';
                
                return `
                <div class="history-card" style="display:flex; flex-direction:column; align-items:stretch;">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%; cursor:pointer;" ondblclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'" title="Double click to view full details">
                        <div><div class="h-test">${h.test}</div><div class="h-date">${dateStr}</div></div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.8rem; font-weight:bold; color:var(--text-main);">${h.result}</span>
                            ${printBtnHtml}
                            <i class="ph ph-caret-down" style="color:var(--text-muted);" onclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'"></i>
                        </div>
                    </div>
                    <div id="${uniqueId}" class="h-expanded-details">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:6px;"><span style="font-size:0.75rem; font-weight:bold; color:var(--text-muted);">RESULT SUMMARY</span>${editBtnHtml}</div>
                        <div id="summary-view-${uniqueId}">${summaryHtml}</div>
                        <div id="edit-view-${uniqueId}" style="display:none; background:var(--bg-body); padding:10px; border-radius:var(--radius-sm); border:1px dashed var(--warning);">
                            <div style="margin-bottom:10px; font-size:0.7rem; color:var(--warning); font-weight:bold;">EDIT COMPLETE DETAILS:</div>
                            ${editInputsHtml}
                            <div style="margin-top:10px; display:flex; gap:10px;"><button class="btn btn-secondary text-xs" onclick="toggleHistoryEdit('${uniqueId}')">Cancel</button>${updateBtnHtml}</div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else { list.innerHTML = '<div class="text-muted text-xs text-center">No lab records found.</div>'; }
    } catch(e) { list.innerHTML = '<div class="text-xs text-center" style="color:var(--danger);">Failed to load history.</div>'; }
}

function toggleHistoryEdit(id) { const sum = document.getElementById('summary-view-'+id); const edt = document.getElementById('edit-view-'+id); if (sum.style.display === 'none') { sum.style.display = 'block'; edt.style.display = 'none'; } else { sum.style.display = 'none'; edt.style.display = 'block'; } }
async function saveHistoryEdit(patientId, testType, uniqueId) { const inputs = document.querySelectorAll(`.edit-hist-${uniqueId}`); let updates = {}; inputs.forEach(inp => updates[inp.getAttribute('data-key')] = inp.value); try { const res = await apiPost("editRegistryRecord", { patientId: patientId, testType: testType, updates: updates }); if (res.status === "success") { showAppAlert("Success", "Record updated successfully!", "success"); toggleHistoryEdit(uniqueId); } } catch(e) { showAppAlert("Error", "Error updating past record.", "error"); } }

function clearForm() {
    document.getElementById('regForm').reset(); labOrders = {}; document.querySelectorAll('.test-btn-vert.active').forEach(b => b.classList.remove('active')); updateSummary(); document.getElementById('finalPatientId').value = ""; isExistingPatient = false; 
    document.getElementById('history-section').style.display = 'none'; document.getElementById('new-entry-header').style.display = 'flex'; document.getElementById('profile-header').style.display = 'none';
    editingPendingId = null; document.getElementById('col-entry').classList.remove('edit-mode-pane'); document.getElementById('entry-main-header').classList.remove('edit-mode-header'); document.getElementById('entry-main-header').innerHTML = `<h2><i class="ph ph-user-plus"></i> Patient Entry</h2><button class="btn-icon" onclick="clearForm()" title="Clear Form"><i class="ph ph-eraser"></i></button>`;
    document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-buttons-container').style.display = 'grid';
    const saveBtn = document.getElementById('save-btn-action'); saveBtn.innerHTML = '<i class="ph ph-paper-plane-right"></i> Save Record'; saveBtn.onclick = finalSubmit; saveBtn.style.background = '';
}

async function finalSubmit() {
  const btn = document.getElementById('save-btn-action');
  if(!document.getElementById('p_name').value || Object.keys(labOrders).length === 0) { showAppAlert("Missing Info", "Please fill in Name and select a test.", "error"); return; }
  const originalText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true;

  const pEmailEl = document.getElementById('p_email');
  const pEmail = pEmailEl ? pEmailEl.value.trim().toLowerCase() : "";
  const generatedPassword = pEmail ? Math.random().toString(36).slice(-8).toUpperCase() : "";

  let finalTestsArray = []; const pAge = document.getElementById('p_age').value || ""; const pSex = document.getElementById('p_sex').value || ""; const pFacility = document.getElementById('p_facility').value || "";
  Object.keys(labOrders).forEach(key => { const entry = { name: availableTests[key].testName, code: availableTests[key].testCode, details: { ...labOrders[key].details, age: pAge, sex: pSex, facility: pFacility, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, bday: document.getElementById('p_bday').value } }; if(labOrders[key].subTests && labOrders[key].subTests.length > 0) entry.details["Requested Tests"] = labOrders[key].subTests.join(', '); finalTestsArray.push(entry); });

  const formData = { patientId: document.getElementById('finalPatientId').value, fullName: document.getElementById('p_name').value, bday: document.getElementById('p_bday').value, sex: pSex, age: pAge, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, email: pEmail, patientPassword: generatedPassword, facility: pFacility, encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify(finalTestsArray) };

  try {
      const res = await apiPost("submitForm", { formObject: formData });
      if (res.status === "success") { 
          btn.style.background = "var(--success)"; btn.innerHTML = '<i class="ph ph-check"></i> Saved'; 
          clearForm(); if (currentUser.role !== 'ENCODER') await loadPendingData(); 
          
          const savedEmail = res.data ? res.data.email : pEmail;
          const savedPass = res.data ? res.data.generatedPassword : generatedPassword;
          if(savedEmail && savedPass) {
              showAppAlert("Patient Portal Created", `Email: ${savedEmail}\nPassword: ${savedPass}\n\n(Inform the patient or wait for the system to email them.)`, "success");
          } else {
              showAppAlert("Record Saved", "The laboratory record has been successfully added to pending.", "success");
          }
          
          setTimeout(() => { btn.disabled = false; btn.innerHTML = originalText; btn.style.background = ""; }, 2000); 
      } else { throw new Error("Server rejected the save."); }
  } catch (err) { showAppAlert("Error", String(err), "error"); btn.disabled = false; btn.innerHTML = originalText; }
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
    try { await apiPost("updatePatientAndTestDetails", { testId: editingPendingId, patientId: item.patientId, newName: document.getElementById('p_name').value, newTestType: item.test, newJsonDetails: finalJsonStr }); cancelEditPending(); await loadPendingData(); } catch(e) { showAppAlert("Error", String(e), "error"); } finally { btn.innerHTML = oldTxt; btn.disabled = false; }
}

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
    const currentVal = filterSelect ? filterSelect.value : 'ALL';
    let dropHtml = '<option value="ALL">All Sections</option>';
    uniqueTests.forEach(t => { let tCode = getTestCodeFromName(t); if(!isLimited || allowedTests.includes(tCode)) { dropHtml += `<option value="${t}">${t}</option>`; } });
    if(filterSelect) { filterSelect.innerHTML = dropHtml; filterSelect.value = currentVal; }

    const filterFn = (item, isCompleted) => {
        let t = (item.test || "").toUpperCase(); let filterVal = filterSelect ? filterSelect.value : "ALL"; let tCode = getTestCodeFromName(t);
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
            let typeMatch = !filterSelect || filterSelect.value === "ALL" || item.test.toUpperCase().includes(filterSelect.value);
            if(!isAlreadyPending && typeMatch) fRepeat.push(item); 
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
        
        let actionsHtml = isViewer ? '' : `<div style="display:flex; gap:5px;"><button onclick="editPendingFull('${item.id}')" class="btn-icon" title="Edit Full Profile"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Are you sure you want to delete this pending request?', () => deleteEntry('${item.id}'))" class="btn-icon" style="color:var(--danger);" title="Delete"><i class="ph ph-trash"></i></button></div>`;
        let clickAttr = isViewer ? '' : `onclick="toggleExpand('${safeId}')" style="cursor:pointer; flex-grow:1;"`;
        let expandAreaHtml = isViewer ? '' : `<div id="expand-${safeId}" class="pc-expand-area"><div style="display:flex; gap:10px; margin-bottom: 16px;"><button class="btn btn-secondary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, false)"><i class="ph ph-floppy-disk"></i> Save Only</button><button class="btn btn-primary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, true)"><i class="ph ph-printer"></i> Save & Print</button></div><div>${getResultTemplate(tCode, safeId, item)}</div></div>`;
        
        return `<div class="pending-card" id="card-${safeId}"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div ${clickAttr}><div class="pc-name">${item.name} <span style="color:var(--text-muted); font-size:0.7rem; font-weight:normal;">${subTxt}</span> ${repeatBadge}</div><div class="pc-meta">${item.test} • By: <span style="color:var(--pri);">${item.encoder || 'System'}</span></div></div>${actionsHtml}</div>${expandAreaHtml}</div>`;
    }).join('');

    if (rList) {
        rList.innerHTML = fRepeat.map(item => {
            const safeId = item.id.replace(/[^a-zA-Z0-9]/g, "");
            return `<div class="pending-card" style="border-left: 4px solid var(--warning); background: var(--warning-light-bg);"><div class="pc-name" style="color: var(--warning);">${item.name}</div><div class="pc-meta" style="margin-bottom:8px;">${item.test}</div>${isViewer ? '' : `<button class="btn btn-secondary text-xs full-width" id="btn-repeat-${safeId}" style="border-color:var(--warning); color:var(--warning); font-weight:bold;" onclick="moveToPendingRepeat('${item.id}')"><i class="ph ph-arrow-circle-left"></i> Move to Pending</button>`}</div>`;
        }).join('');
        const cRep = document.getElementById('count-repeat'); if(cRep) cRep.innerText = `(${fRepeat.length})`;
    }

    cList.innerHTML = fComp.map(item => {
        let tCodePrint = getTestCodeFromName(item.test);
        let repeatBadge = ""; 
        try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; let rpt = d.Repeat || d["Test Type"]; if(rpt && String(rpt).toUpperCase() === 'INITIAL') repeatBadge = `<span class="badge badge-warning" style="margin-left:4px; font-size:0.55rem;">INITIAL</span>`; } catch(e){}
        return `<div class="completed-card" onclick="printDirect(event, '${item.id}', '${tCodePrint}')" title="Click to print"><div style="overflow:hidden;"><div class="pc-name">${item.name} ${repeatBadge}</div><div class="pc-meta">${item.test}</div></div><i class="ph ph-printer" style="color: var(--success); font-size: 1.2rem;"></i></div>`;
    }).join('');
    const cPend = document.getElementById('count-pending'); if(cPend) cPend.innerText = `(${fPending.length})`;
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

    try { const res = await apiPost("submitForm", { formObject: formData }); if (res.status === "success") { await loadPendingData(); } else { showAppAlert("Error", res.message, "error"); if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } } } catch (err) { showAppAlert("Error", "Error moving.", "error"); if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } }
}

function toggleExpand(safeId) { const el = document.getElementById('expand-' + safeId); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
async function deleteEntry(id) { try { await apiPost("deletePendingTestById", { testId: id }); loadPendingData(); } catch(e) {} }

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

async function printDirect(e, id, testName) { 
    if(e) e.stopPropagation(); const correctCode = getTestCodeFromName(testName);
    const win = window.open('', '_blank'); win.document.write('<h2>Loading Document...</h2>');
    try { const res = await apiPost("printFromRegistry", { requests: [{testCode: id, testName: correctCode}] }); if (res.status === "success" && res.data) { win.document.open(); win.document.write(res.data); win.document.close(); } else { win.document.body.innerHTML = "Document not found. Test Code: " + id; } } catch (e) { win.document.body.innerHTML = "Print Error."; } 
}

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
     case 'DSSM': return `<div class="form-grid grid-2">${[1,2].map(n=>`<div class="field-group"><label class="field-label">Smear ${n}</label><select class="res-${safeId} form-select" data-key="Smear${n}" onchange="handleDSSM(this,'${safeId}','${n}')"><option value=""></option><option value="0">0</option><option value="+N">+N</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option></select></div><div id="s${n}n-${safeId}" style="display:none;" class="field-group"><label class="field-label">Count</label><input type="number" class="res-${safeId} form-input" data-key="Smear${n}_Count"></div>`).join('')}<div class="full-width">${select('Appearance', 'Appearance', apps)}</div><div class="full-width">${select('Diagnosis', 'Diagnosis', ['Negative', 'Positive'])}</div></div>${rem}`;
     case 'CHEM': return `<div class="form-grid grid-3">${input('FBS','FBS',['FBS','GLUCOSE'])}${input('RBS','RBS',['RBS'])}${input('HbA1c','HbA1c',['HBA1C'])}${input('Cholesterol','Chol',['CHOLESTEROL','LIPID'])}${input('Triglycerides','Trig',['TRIGLYCERIDES','LIPID'])}${input('HDL','HDL',['HDL','LIPID'])}${input('LDL','LDL',['LDL','LIPID'])}${input('BUN','BUN',['BUN'])}${input('Creatinine','Crea',['CREA'])}${input('Uric Acid','Uric',['URIC'])}${input('SGOT','SGOT',['SGOT','AST'])}${input('SGPT','SGPT',['SGPT','ALT'])}</div>${rem}`;
     case 'HEMA': return `<div class="form-grid grid-3">${input('Hemoglobin','Hb',['CBC'])}${input('Hematocrit','Hct',['CBC'])}${input('WBC_Count','WBC',['CBC'])}${input('RBC_Count','RBC',['CBC'])}${input('Platelet','Plt',['CBC','PLATELET'])}${input('Neutrophils','Neut',['CBC'])}${input('Lymphocytes','Lym',['CBC'])}${input('Monocytes','Mono',['CBC'])}${input('Eosinophils','Eos',['CBC'])}${input('Basophils','Baso',['CBC'])}${select('ABO','ABO',['A','B','AB','O'],['TYPING'])}${select('Rh','Rh',['Positive','Negative'],['TYPING'])}</div>${rem}`;
     case 'UA': return `<div class="form-grid grid-3">${input('Color','Color')}${input('Transparency','Transp')}${input('pH','pH')}${input('SG','Sp.Grav')}${select('Protein','Protein',gradings)}${select('Glucose','Glucose',gradings)}${input('RBC','RBC')}${input('WBC','WBC')}${input('Bacteria','Bact.')}${input('Epithelial','Epith.')}${input('Cast','Casts')}${input('Crystals','Crys.')}${input('Amorphous','Amorph')}${input('Mucus','Mucus')}</div>${rem}`;
     case 'FA': return `<div class="form-grid grid-2">${select('Color','Color',['Brown','Yellow','Green','Black','Red'])}${select('Consistency','Consistency',['Formed','Soft','Loose','Watery'])}<div class="full-width">${input('parasite','Parasite')}</div>${input('RBC','RBC')}${input('WBC','WBC')}</div>${rem}`;
     case 'GRAM': return `<div class="form-grid grid-2"><div class="full-width font-bold" style="color:var(--pri);">Gram Positive</div>${input('GP_Quantity','Qty')}${input('GP_Morphology','Morph')}${input('GP_Arrangement','Arrange')}<div class="full-width font-bold" style="color:var(--sec); margin-top:8px;">Gram Negative</div>${input('GN_Quantity','Qty')}${input('GN_Morphology','Morph')}${input('GN_Arrangement','Arrange')}</div>${rem}`;
     case 'SERO': return `<div class="form-grid grid-3">${select('HIV','HIV',['NONREACTIVE','REACTIVE'],['HIV','SERO'])}${select('HBSAG','HBsAg',['NONREACTIVE','REACTIVE'],['HBSAG','SERO'])}${select('SYPHILIS','Syphilis',['NONREACTIVE','REACTIVE'],['SYPHILIS','SERO'])}</div>${rem}`;
     case 'DENGUE': let duoHtml = ''; if (req.includes('DUO')) { duoHtml = select('IgG', 'IgG', ['Negative','Positive']) + select('IgM', 'IgM', ['Negative','Positive']); } return `<div class="form-grid grid-1">${select('Dengue_Result', 'Dengue NS1', ['Negative', 'Positive'])}${duoHtml}</div>${rem}`;
     default: return `<div class="form-grid grid-1">${input('Result','Result')}</div>${rem}`;
 }
}

async function loadSettingsData() { apiGet("getSettingsData").then(res => { if (res.status === "success") renderSettings(res.data); }).catch(e=>console.log(e)); loadStaff(); loadFacilities(); }
function renderSettings(data) { if (typeof data === 'string') data = JSON.parse(data); const uList = document.getElementById('list-users'); if (!uList) return; if (!data || !data.users || data.users.length === 0) { uList.innerHTML = '<div style="text-align:center; color:var(--text-muted);">No users found.</div>'; return; } const myRole = (typeof currentUser !== 'undefined' && currentUser.role) ? String(currentUser.role).toUpperCase() : ""; const isAdmin = (myRole === 'ADMIN'); uList.innerHTML = data.users.map(u => { const status = String(u.status || "").toUpperCase(); const isPending = (status === 'PENDING'); let statusDisplay = ''; let cardBorder = 'border-color: var(--border-color);'; if (isPending && isAdmin) { cardBorder = 'border-color: var(--warning); background: var(--warning-bg);'; statusDisplay = `<div style="display:flex; gap:8px; margin-top:8px;"><button onclick="decideUser('${u.username}', 'APPROVE')" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.7rem; background: var(--success);"><i class="ph ph-check"></i></button><button onclick="decideUser('${u.username}', 'REJECT')" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.7rem;"><i class="ph ph-x"></i></button></div>`; } else { let badgeClass = status === 'ACTIVE' ? 'badge-negative' : (status === 'REJECTED' ? 'badge-positive' : 'badge-warning'); statusDisplay = `<div style="margin-top:8px;"><span class="badge ${badgeClass}">${u.status || 'ACTIVE'}</span></div>`; } let editBtn = isAdmin ? `<button onclick="openEditUser('${u.username}', '${u.role}', '${u.status}')" class="btn-icon"><i class="ph ph-pencil-simple"></i></button>` : ''; return `<div class="pending-card" style="margin-bottom: 8px; ${cardBorder} flex-direction: row; justify-content: space-between; align-items: flex-start;"><div><div class="pc-name">${u.fullname || u.username}</div><div class="pc-meta" style="margin-top:2px;">@${u.username} • ${u.role} • ${u.facility}</div>${statusDisplay}</div>${editBtn}</div>`; }).join(''); }
let currentEditTarget = ""; function openEditUser(username, role, status) { currentEditTarget = username; document.getElementById('edit-username-display').innerText = "@" + username; document.getElementById('edit-role-select').value = role; document.getElementById('edit-status-select').value = status; document.getElementById('edit-user-modal').style.display = 'flex'; } function closeEditModal() { document.getElementById('edit-user-modal').style.display = 'none'; } async function saveUserChanges() { const newRole = document.getElementById('edit-role-select').value; const newStatus = document.getElementById('edit-status-select').value; const btn = document.getElementById('btn-save-user'); const oldText = btn.innerText; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true; try { await apiPost("updateUser", { targetUsername: currentEditTarget, newRole: newRole, newStatus: newStatus, adminRole: currentUser.role }); closeEditModal(); loadSettingsData(); } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } } async function decideUser(username, action) { customConfirm(action + " access for " + username + "?", async () => { try { await apiPost("approveUser", { targetUsername: username, userAction: action, adminRole: currentUser.role }); loadSettingsData(); } catch(e) {} }); } async function saveUser() { 
    const user = { 
        u: document.getElementById('u_user').value, 
        p: document.getElementById('u_pass').value, 
        role: document.getElementById('u_role').value, 
        fac: document.getElementById('u_facility').value, 
        name: document.getElementById('u_fullname').value // <--- HETO YUNG FULL NAME
    }; 
    if(!user.u || !user.p || !user.role || !user.name) { 
        showAppAlert("Required", "Please fill all fields.", "error"); 
        return;
    } 
    const btn = document.querySelector('#user-form button'); 
    const oldText = btn.innerText; btn.innerHTML = "SAVING..."; btn.disabled = true; 
    try { 
        await apiPost("saveNewUser", { data: { username: user.u, password: user.p, facility: user.fac, role: user.role, fullName: user.name, roleCheck: currentUser.role }}); 
        document.getElementById('user-form').style.display = 'none'; 
        document.getElementById('u_user').value = ""; 
        document.getElementById('u_pass').value = ""; 
        document.getElementById('u_fullname').value = ""; 
        loadSettingsData(); 
    } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } 
}


let globalFacilityList = []; async function loadFacilities() { try { const res = await apiGet("getFacilityList"); globalFacilityList = res.data || []; renderFacilityList(); } catch(e) {} } function renderFacilityList() { const container = document.getElementById('list-facilities'); const dropdown = document.getElementById('u_facility'); if(dropdown) { while (dropdown.options.length > 1) { dropdown.remove(1); } } if(container) { container.innerHTML = globalFacilityList.map((f, index) => `<div class="pending-card" style="margin-bottom: 8px; border-left: 3px solid var(--warning); flex-direction: row; justify-content: space-between; align-items: flex-start;"><div><div class="pc-name">${f.name}</div><div class="pc-meta" style="margin-top:2px;">${f.address || ""}</div>${ f.person ? `<div class="pc-meta" style="margin-top:2px; color:var(--pri);">${f.person} (${f.number})</div>` : '' }</div><div style="display:flex; gap:4px;"><button onclick="editFacility(${index})" class="btn-icon"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Remove facility?', () => deleteFacility(${index}))" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button></div></div>`).join(''); } globalFacilityList.forEach(f => { if(dropdown) { let o = document.createElement('option'); o.value = f.name; o.innerText = f.name; dropdown.appendChild(o); } }); } let editingFacilityIndex = -1; async function handleSaveFacility() { const name = document.getElementById('f_name').value; if (!name) return; const newItem = { name: name, address: document.getElementById('f_address').value, person: document.getElementById('f_person').value, number: document.getElementById('f_number').value }; if (editingFacilityIndex >= 0) { globalFacilityList[editingFacilityIndex] = newItem; editingFacilityIndex = -1; } else { globalFacilityList.push(newItem); } renderFacilityList(); clearFacilityForm(); toggleForm('fac-form'); } function editFacility(index) { const f = globalFacilityList[index]; document.getElementById('f_name').value = f.name; document.getElementById('f_address').value = f.address; document.getElementById('f_person').value = f.person; document.getElementById('f_number').value = f.number; editingFacilityIndex = index; document.getElementById('fac-form').style.display = 'block'; } function deleteFacility(index) { globalFacilityList.splice(index, 1); renderFacilityList(); } function clearFacilityForm() { document.getElementById('f_name').value = ""; document.getElementById('f_address').value = ""; document.getElementById('f_person').value = ""; document.getElementById('f_number').value = ""; editingFacilityIndex = -1; }
let globalStaffList = []; let editingStaffIndex = -1; async function loadStaff() { try { const res = await apiGet("getStaffList"); globalStaffList = res.data || []; renderStaffList(); } catch(e) {} } function renderStaffList() { const container = document.getElementById('staffListContainer'); if (!container) return; if (globalStaffList.length === 0) { container.innerHTML = '<div style="text-align:center; color:var(--text-muted);">No staff found.</div>'; return; } container.innerHTML = globalStaffList.map((s, index) => { let previewUrl = cleanDriveLink(s.sigUrl); const sigBadge = previewUrl ? `<img src="${previewUrl}" style="height:30px; border:1px solid var(--border-color); border-radius:4px; padding:2px; object-fit:contain;" onerror="this.style.display='none'">` : `<span class="badge badge-neutral">No Sig</span>`; return `<div class="pending-card" style="margin-bottom: 8px; border-left: 3px solid var(--danger); flex-direction: row; justify-content: space-between; align-items: center;"><div style="flex:1;"><div class="pc-name">${s.name}</div><div class="pc-meta" style="margin-top:2px;">${s.role} • Lic: ${s.license || "N/A"}</div></div><div style="margin-right: 12px;">${sigBadge}</div><div style="display:flex; gap:4px;"><button onclick="editStaff(${index})" class="btn-icon"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Remove staff?', () => deleteStaff(${index}))" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button></div></div>`; }).join(''); } function cleanDriveLink(url) { if (!url) return ""; if (url.includes("drive.google.com")) { let id = ""; let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); if (match) id = match[1]; else { match = url.match(/id=([a-zA-Z0-9_-]+)/); if (match) id = match[1]; } if (id) return "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000"; } return url; } async function handleSaveStaff() { const name = document.getElementById('staffName').value; if (!name) return; const btn = document.querySelector('#staff-form .btn-primary'); const oldText = btn.innerText; btn.innerHTML = "PROCESSING..."; btn.disabled = true; const newItem = { name: name, role: document.getElementById('staffRole').value, license: document.getElementById('staffLicense').value, sigUrl: cleanDriveLink(document.getElementById('staffSigUrl').value) }; if (editingStaffIndex >= 0) { globalStaffList[editingStaffIndex] = newItem; editingStaffIndex = -1; } else { globalStaffList.push(newItem); } renderStaffList(); clearStaffForm(); try { await apiPost("saveStaffData", { staffArray: globalStaffList }); toggleForm('staff-form'); } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } } function editStaff(index) { const s = globalStaffList[index]; document.getElementById('staffName').value = s.name; document.getElementById('staffRole').value = s.role; document.getElementById('staffLicense').value = s.license; document.getElementById('staffSigUrl').value = s.sigUrl || ""; editingStaffIndex = index; document.getElementById('staff-form').style.display = 'block'; } async function deleteStaff(index) { globalStaffList.splice(index, 1); renderStaffList(); try { await apiPost("saveStaffData", { staffArray: globalStaffList }); } catch(e) {} } function clearStaffForm() { document.getElementById('staffName').value = ""; document.getElementById('staffRole').value = "Medical Technologist"; document.getElementById('staffLicense').value = ""; document.getElementById('staffSigUrl').value = ""; editingStaffIndex = -1; } function toggleForm(id) { const el = document.getElementById(id); if(el) el.style.display = (el.style.display === 'block') ? 'none' : 'block'; }

function switchTab(id) { document.querySelectorAll('.tab-view').forEach(el => el.style.display = 'none'); document.querySelectorAll('.chip').forEach(el => el.classList.remove('active')); document.getElementById('tab-' + id).style.display = 'block'; const btn = document.getElementById('tab-btn-' + id); if(btn) btn.classList.add('active'); }
function togglePeriod() { const type = document.querySelector('input[name="rep_type"]:checked').value; document.getElementById('rep_month').style.display = (type === 'monthly') ? 'inline-block' : 'none'; document.getElementById('rep_quarter').style.display = (type === 'quarterly') ? 'inline-block' : 'none'; }
async function generateReport() { const type = document.querySelector('input[name="rep_type"]:checked').value; const year = document.getElementById('rep_year').value; let targetFacility = "ALL"; let userRole = "VIEWER"; try { if (typeof currentUser !== 'undefined') { userRole = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_'); if (userRole === 'VIEWER' || userRole === 'ENCODER') { targetFacility = currentUser.facility || "ALL"; } } } catch (e) {} let val = 0; let text = ""; if (type === 'monthly') { const sel = document.getElementById('rep_month'); val = sel.value; text = sel.options[sel.selectedIndex].text.toUpperCase() + " " + year; } else if (type === 'quarterly') { const sel = document.getElementById('rep_quarter'); val = sel.value; text = sel.options[sel.selectedIndex].text.toUpperCase() + " " + year; } else { val = 0; text = "ANNUAL REPORT " + year; } let facLabel = (targetFacility === "ALL") ? "(CONSOLIDATED)" : `(${targetFacility})`; document.querySelectorAll('.rep-period').forEach(el => el.innerText = `- ${text} ${facLabel}`); const btn = document.getElementById('btn-generate-rep'); const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> PROCESSING...'; btn.disabled = true; try { const res = await apiGet("getReportData", { type: type, value: val, year: year, facility: targetFacility }); if (res.status === "success") { const d = res.data; renderTB(d.tb); renderHIV(d.hiv); renderSTI(d.sti); renderDengue(d.dengue); renderWorkload(d.workload); if (d.fhsis_maternal) renderFHSIS(d.fhsis_maternal); } } catch (err) {} finally { btn.innerHTML = oldHtml; btn.disabled = false; } }
function renderFHSIS(data) { if (!data) return; const facMap = { "SAN ISIDRO": "SI", "SAN VICENTE": "SV", "KALAYAAN": "KA", "STO. NIÑO": "SN", "SAN ROQUE": "SR", "MAHABANG PARANG": "MP", "POB. ITAAS": "PI", "POB. IBABA": "PB", "BAGUMBAYAN": "BA", "SAN PEDRO": "SP", "ANGONO RHU I": "R1" }; const keys = [ "syp_s_t", "syp_s_10", "syp_s_15", "syp_s_20", "syp_p_t", "syp_p_10", "syp_p_15", "syp_p_20", "hiv_s_t", "hiv_s_10", "hiv_s_15", "hiv_s_20", "hiv_r_t", "hiv_r_10", "hiv_r_15", "hiv_r_20", "hbs_s_t", "hbs_s_10", "hbs_s_15", "hbs_s_20", "hbs_r_t", "hbs_r_10", "hbs_r_15", "hbs_r_20" ]; keys.forEach(key => { let rowTotal = 0; Object.keys(facMap).forEach(facName => { let val = (data[facName] && data[facName][key]) ? data[facName][key] : 0; let cellId = key + "_" + facMap[facName]; let cell = document.getElementById(cellId); if (cell) { cell.innerText = val; rowTotal += val; } }); let totalCell = document.getElementById(key + "_TOT"); if (totalCell) totalCell.innerText = rowTotal; }); }
function renderTB(tb) { const row = (lbl, n, r) => `<tr><td style="font-weight:600; text-align:left;">${lbl}</td><td class="text-center">${n || 0}</td><td class="text-center">${r || 0}</td></tr>`; document.getElementById('tb-exam-body').innerHTML = row("EXAMINED", tb.exam.new, tb.exam.ret) + row("INVALID / ERROR", tb.invalid.new, tb.invalid.ret) + row("INITIAL RESULT", tb.initial.new, tb.initial.ret); document.getElementById('tb-res-body').innerHTML = row("MTB DETECTED", tb.pos.new, tb.pos.ret) + row(" > RIF RESISTANT", tb.rr.new, tb.rr.ret) + row(" > TRACE DETECTED", tb.tt.new, tb.tt.ret) + row(" > INDETERMINATE", tb.ti.new, tb.ti.ret) + row(" > SENSITIVE", tb.t.new, tb.t.ret) + row("MTB NOT DETECTED", tb.n.new, tb.n.ret); document.getElementById('tb-cart').innerText = tb.cartridges || 0; }
function renderHIV(h) { const buildRow = (grid) => `<tr><td style="font-weight:600; text-align:left;">ANGONO</td><td class="text-center">${grid.m.c15}</td><td class="text-center">${grid.m.c1524}</td><td class="text-center">${grid.m.c2534}</td><td class="text-center">${grid.m.c3549}</td><td class="text-center">${grid.m.c50}</td><td class="text-center">${grid.f.c15}</td><td class="text-center">${grid.f.c1524}</td><td class="text-center">${grid.f.c2534}</td><td class="text-center">${grid.f.c3549}</td><td class="text-center">${grid.f.c50}</td><td class="text-center" style="color:var(--danger); font-weight:700;">${grid.f.mat}</td><td class="text-center">${grid.kap.msm}</td><td class="text-center">${grid.kap.tgw}</td><td class="text-center">${grid.kap.msw}</td><td class="text-center">${grid.kap.fsw}</td><td class="text-center">${grid.kap.pwid}</td><td class="text-center" style="font-weight:700; color:var(--text-main); background:var(--warning-bg);">${grid.kap.tb}</td><td class="text-center font-bold" style="background:var(--bg-subtle);">${grid.total}</td></tr>`; document.getElementById('hiv-test-body').innerHTML = buildRow(h.tested); document.getElementById('hiv-react-body').innerHTML = buildRow(h.reactive); }
function renderSTI(s) { const buildSTI = (name, d) => `<tr><td rowspan="3" style="font-weight:700; vertical-align:middle;">${name}</td><td>NON-REACTIVE</td><td class="text-center">${d.m - d.m_r}</td><td class="text-center">${d.f - d.f_r}</td><td class="text-center">${d.mat - d.mat_r}</td><td class="text-center">${d.total - d.react}</td></tr><tr style="color:var(--danger); font-weight:600;"><td>REACTIVE</td><td class="text-center">${d.m_r}</td><td class="text-center">${d.f_r}</td><td class="text-center">${d.mat_r}</td><td class="text-center">${d.react}</td></tr><tr style="background:var(--bg-subtle); font-weight:700;"><td>TOTAL</td><td class="text-center">${d.m}</td><td class="text-center">${d.f}</td><td class="text-center">${d.mat}</td><td class="text-center">${d.total}</td></tr>`; document.getElementById('sti-body').innerHTML = buildSTI("HIV", s.hiv) + buildSTI("SYPHILIS", s.syph) + buildSTI("HBsAg", s.hbsag); }
function renderDengue(d) { document.getElementById('dengue-body').innerHTML = `<tr><td>POSITIVE</td><td class="text-center" style="color:var(--danger); font-weight:700;">${d.pos}</td></tr><tr><td>NEGATIVE</td><td class="text-center">${d.neg}</td></tr><tr style="background:var(--bg-subtle); font-weight:700;"><td>TOTAL</td><td class="text-center">${d.total}</td></tr>`; }
function renderWorkload(w) { let html = ""; for (const [key, val] of Object.entries(w)) { html += `<tr><td style="text-align:left; text-transform:uppercase; font-weight:600;">${key.replace('Registry - ','')}</td><td class="text-center" style="font-weight:700;">${val}</td></tr>`; } document.getElementById('workload-body').innerHTML = html; }

