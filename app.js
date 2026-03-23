// ==========================================
// 1. API CONNECTION & GLOBALS
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6Krts8ndJr93iN103htz0zvdn9znxcm8Qqa3Z2WW9snrILKGgp6pbh-kmUqnBjg2i0w/exec"; 

let currentUser = { username: "", facility: "", role: "", fullName: "" };
let labOrders = {};
let pendingData = [];
let completedData = [];
let selectedIds = new Set();
let editModeIds = new Set();

const ALL_PAGES = ['page-workspace', 'page-registry', 'page-reports', 'page-settings'];
const TODAY_STR = new Date().toLocaleDateString(); 

async function apiGet(action, params = {}) {
    let url = new URL(SCRIPT_URL);
    url.searchParams.append('action', action);
    for (let key in params) if (params[key] !== undefined) url.searchParams.append(key, params[key]);
    try { const res = await fetch(url); return await res.json(); } catch (e) { throw e; }
}

async function apiPost(action, payload) {
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, ...payload }) });
        return await res.json();
    } catch (e) { throw e; }
}

// ==========================================
// 2. SYSTEM STARTUP & LOGIN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('mho-theme') === 'dark') document.body.classList.add('dark-mode');
    
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
            
            if(currentUser.role === 'VIEWER') showPage('registry');
            else showPage('workspace');
        } catch (e) {
            localStorage.removeItem('labUser');
            document.getElementById('app-loader').style.display = 'none';
        }
    } else {
        document.getElementById('app-loader').style.display = 'none';
    }
});

async function attemptLogin() {
    const u = document.getElementById('login_user').value.trim();
    const p = document.getElementById('login_pass').value.trim();
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('login-error');

    if (!u || !p) { err.style.display = 'block'; err.innerText = "Enter credentials."; return; }

    btn.innerHTML = 'Verifying...'; btn.disabled = true; err.style.display = 'none';

    try {
        const res = await apiGet("loginUser", { username: u, password: p });
        if (res.status === "SUCCESS") {
            currentUser = { username: res.username, facility: res.facility, role: res.role, fullName: res.fullName };
            localStorage.setItem('labUser', JSON.stringify(currentUser));              
            window.location.reload();
        } else {
            err.style.display = 'block'; err.innerHTML = "Invalid credentials";
        }
    } catch (e) { alert("Server Error"); } 
    finally { btn.innerHTML = 'Log In'; btn.disabled = false; }
}

function logoutUser() { document.getElementById('logout-modal').style.display = 'flex'; }
function closeLogoutModal() { document.getElementById('logout-modal').style.display = 'none'; }
function confirmLogout() { localStorage.removeItem('labUser'); window.location.reload(); }

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('mho-theme', 'dark');
        if(icon) icon.classList.replace('ph-moon-stars', 'ph-sun');
        if(text) text.innerText = "Light Mode";
    } else {
        localStorage.setItem('mho-theme', 'light');
        if(icon) icon.classList.replace('ph-sun', 'ph-moon-stars');
        if(text) text.innerText = "Dark Mode";
    }
}

// ==========================================
// 3. NAVIGATION & PERMISSIONS
// ==========================================
function showPage(targetId) {
    const elId = 'page-' + targetId;
    const role = (currentUser.role || "VIEWER").toUpperCase();
    
    if (role === 'VIEWER' && (targetId === 'workspace' || targetId === 'settings')) return;
    if (role === 'ENCODER' && targetId === 'settings') return;

    ALL_PAGES.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const target = document.getElementById(elId);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.id === 'nav-' + targetId) item.classList.add('active');
    });

    if (targetId === 'workspace' && role !== 'ENCODER') loadPendingData();
    if (targetId === 'settings' && typeof loadSettingsData === 'function') loadSettingsData();
}

function applyPermissions() {
    const role = (currentUser.role || "VIEWER").toUpperCase();
    const navWork = document.getElementById('nav-workspace');
    const navReg = document.getElementById('nav-registry');
    const navRep = document.getElementById('nav-reports');
    const navSet = document.getElementById('nav-settings');
    const panePending = document.getElementById('pane-pending');
    const paneCompleted = document.getElementById('pane-completed');
    const grid = document.getElementById('workspace-grid-container');

    if(navWork) navWork.style.display = 'none';
    if(navReg) navReg.style.display = 'none';
    if(navRep) navRep.style.display = 'none';
    if(navSet) navSet.style.display = 'none';

    if (role === 'ADMIN' || role === 'STAFF') {
        if(navWork) { navWork.style.display = 'flex'; navWork.innerHTML = '<i class="ph ph-desktop"></i> Workspace'; }
        if(navReg) navReg.style.display = 'flex';
        if(navRep) navRep.style.display = 'flex';
        if(role === 'ADMIN' && navSet) navSet.style.display = 'flex';
        
        if(panePending) panePending.style.display = 'flex';
        if(paneCompleted) paneCompleted.style.display = 'flex';
        if(grid) { grid.style.gridTemplateColumns = '320px 1fr 280px'; grid.style.justifyContent = 'stretch'; }
    } else if (role === 'ENCODER') {
        if(navWork) { navWork.style.display = 'flex'; navWork.innerHTML = '<i class="ph ph-user-plus"></i> Patient Entry'; }
        if(navReg) navReg.style.display = 'flex';
        
        if(panePending) panePending.style.display = 'none';
        if(paneCompleted) paneCompleted.style.display = 'none';
        if(grid) { grid.style.gridTemplateColumns = 'minmax(320px, 600px)'; grid.style.justifyContent = 'center'; }
    } else {
        if(navReg) navReg.style.display = 'flex';
    }
}

// ==========================================
// 4. ADD PATIENT LOGIC
// ==========================================
const availableTests = {
    "mtb": { testName: "GeneXpert MTB/Rif Ultra", testCode: "GXP", title: "GeneXpert Details", html: `<div class="field-group"><label class="field-label">History</label><select id="gx_hist" class="form-select"><option>New</option><option>Retreatment</option></select></div><div class="field-group"><label class="field-label">Source</label><input type="text" id="gx_src" class="form-input"></div><div class="field-group"><label class="field-label">X-Ray</label><input type="text" id="gx_xray" class="form-input"></div>`},
    "dssm": { testName: "DSSM", testCode: "DSSM", title: "DSSM Microscopy", html: `<div class="field-group"><label class="field-label">TB Case No</label><input type="text" id="ds_case" class="form-input"></div><div class="field-group"><label class="field-label">Month of Treatment</label><input type="text" id="ds_month" class="form-input"></div>` },
    "viral": { testName: "GeneXpert Viral Load", testCode: "GXVL", isSimple: true },
    "sero": { testName: "Serology", testCode: "SERO", title: "Serology", html: `<label class="field-label">Test(s):</label><div class="chip-group" id="sero-sub-tests">${['HIV Screening','Syphilis Screening','HBsAg Screening'].map(t => `<div class="chip" onclick="toggleSub(this)" data-val="${t}">${t}</div>`).join('')}</div><div class="form-grid grid-2"><div class="field-group"><label class="field-label">Classification</label><select id="sr_class" class="form-select"><option>Maternal</option><option>SHC</option><option>TB Patient</option></select></div><div class="field-group"><label class="field-label">KAP Category</label><select id="sr_kap" class="form-select"><option value="None">None</option><option>MSM</option><option>TGW</option><option>FSW</option><option>MSW</option><option>PDL</option><option>PWID</option></select></div></div>` },
    "gram": { testName: "Gram Stain", testCode: "GRAM", title: "Gram Stain", html: `<div class="field-group"><label class="field-label">Source</label><input type="text" id="gs_src" class="form-input"></div>` },
    "dengue": { testName: "Dengue NS1", testCode: "DENG", title: "Dengue", html: `<div class="field-group"><label class="field-label">Days of Illness</label><input type="number" id="dn_onset" class="form-input"></div>` },
    "hema": { testName: "Hematology", testCode: "HEMA", title: "Hematology", html: `<div class="chip-group">${['CBC','Platelet Count','Blood Typing'].map(t => `<div class="chip" onclick="toggleSub(this)" data-val="${t}">${t}</div>`).join('')}</div>` },
    "uria": { testName: "Urinalysis", testCode: "UA", isSimple: true },
    "feca": { testName: "Fecalysis", testCode: "FA", isSimple: true },
    "chem": { testName: "Blood Chemistry", testCode: "CHEM", title: "Chemistry", html: `<div class="chip-group">${['FBS','OGTT','BUN','Uric Acid','Cholesterol','Triglycerides','Lipid Profile','HBA1C','Creatinine'].map(a => `<div class="chip" onclick="toggleSub(this)" data-val="${a}">${a}</div>`).join('')}</div>` }
};

function openTestDetails(id) {
    const config = availableTests[id];
    if (!config) return;
    
    // Itago ang mga test buttons
    document.getElementById('test-grid-main').style.display = 'none';
    
    const area = document.getElementById('test-details-area');
    area.style.display = 'block';
    area.innerHTML = `
        <div style="font-weight: 700; color: var(--pri); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 0.8rem;">
            <i class="ph ph-info"></i> ${config.title}
        </div>
        <div id="temp-form-data" class="form-grid grid-1">${config.html}</div>
        <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn btn-secondary" style="flex:1;" onclick="cancelDetail()">Cancel</button>
            <button class="btn btn-primary" style="flex:1;" onclick="confirmDetail('${id}')">Confirm</button>
        </div>`;
}

function cancelDetail() { 
    // Itago ang details form
    document.getElementById('test-details-area').style.display = 'none'; 
    // FIX: Ibalik ang display ng mga test buttons (flex kasi ang gamit natin sa chip-group)
    document.getElementById('test-grid-main').style.display = 'flex'; 
}


function toggleSub(btn) { btn.classList.toggle('active'); }
function cancelDetail() { document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-grid-main').style.display = 'grid'; }

function confirmDetail(id) {
   let details = {}; let subSelected = [];
   if(id === 'mtb') details = { "History of Treatment": document.getElementById('gx_hist').value, "Source of Request": document.getElementById('gx_src').value, "X-Ray Result": document.getElementById('gx_xray').value };
   else if(id === 'dssm') details = { "TB Case Number": document.getElementById('ds_case').value, "Month of Treatment": document.getElementById('ds_month').value };
   else if(id === 'gram') details = { "Source of Specimen": document.getElementById('gs_src').value };
   else if(id === 'dengue') details = { "Day/s of Onset of Illness": document.getElementById('dn_onset').value };
   else if(['sero','hema','chem'].includes(id)) {
       const activeBtns = document.querySelectorAll('.chip.active');
       if(activeBtns.length === 0) { alert("Select at least one sub-test."); return; }
       subSelected = Array.from(activeBtns).map(b => b.getAttribute('data-val'));
       if(id === 'sero') details = { "Classification": document.getElementById('sr_class').value, "KAP Category": document.getElementById('sr_kap').value };
   }

   labOrders[id] = { details: details, subTests: subSelected };
   document.getElementById('btn-'+id).classList.add('active');
   updateSummary(); cancelDetail(); 
}

function toggleSimple(id) {
    const btn = document.getElementById('btn-'+id);
    if(labOrders[id]) { delete labOrders[id]; btn.classList.remove('active'); }
    else { labOrders[id] = { details: {}, subTests: [] }; btn.classList.add('active'); }
    updateSummary();
}

function updateSummary() {
    const container = document.getElementById('order-summary');
    container.innerHTML = '';
    Object.keys(labOrders).forEach(key => {
        let label = availableTests[key].testName;
        if(labOrders[key].subTests && labOrders[key].subTests.length > 0) label += `: ${labOrders[key].subTests.join(', ')}`;
        container.innerHTML += `<div class="badge badge-warning" style="cursor:pointer;" onclick="removeOrder('${key}')">${label} &times;</div>`;
    });
}
function removeOrder(key) { delete labOrders[key]; document.getElementById('btn-'+key).classList.remove('active'); updateSummary(); }

function calculateAge() {
    const dob = new Date(document.getElementById('p_bday').value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    document.getElementById('p_age').value = age;
}
function generateSmartID() {
    const bday = document.getElementById('p_bday').value.replace(/-/g, "") || "00000000";
    const name = document.getElementById('p_name').value.trim().toUpperCase();
    let initials = "XX";
    if(name) { const p = name.split(" "); initials = p.length > 1 ? p[0][0] + p[p.length-1][0] : name.substring(0,2); }
    document.getElementById('finalPatientId').value = `MHOA-${bday}-${initials}${Math.floor(Math.random()*90+10)}`;
}

let searchTimeout; 
async function runDirectSearch(q) {
  if(q.length < 2) { document.getElementById('direct-results-box').style.display='none'; return; }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
      try {
          const res = await apiGet("searchPatients", { query: q });
          const box = document.getElementById('direct-results-box');
          if (res.status === "success" && res.data.length > 0) {
              box.style.display = 'block'; box.innerHTML = '';
              res.data.forEach(p => {
                  const div = document.createElement('div');
                  div.style.padding = '10px'; div.style.borderBottom = '1px solid var(--border-color)'; div.style.cursor = 'pointer';
                  div.innerHTML = `<div style="font-weight:600;">${p.name}</div><div style="font-size:0.75rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility}</div>`;
                  div.onclick = () => {
                      document.getElementById('p_name').value = p.name || ""; document.getElementById('p_age').value = p.age || "";
                      document.getElementById('p_address').value = p.address || ""; document.getElementById('p_contact').value = p.contact || ""; 
                      document.getElementById('p_facility').value = p.facility || ""; document.getElementById('p_sex').value = p.sex || "";
                      if (p.bday) { try { const d = new Date(p.bday); document.getElementById('p_bday').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } catch(e){} }
                      generateSmartID(); box.style.display = 'none';
                  };
                  box.appendChild(div);
              });
          } else { box.style.display = 'none'; }
      } catch(e) {}
  }, 400);
}

function clearForm() {
    document.getElementById('regForm').reset();
    labOrders = {};
    document.querySelectorAll('.test-card.active').forEach(b => b.classList.remove('active'));
    updateSummary();
    document.getElementById('finalPatientId').value = "";
}

async function finalSubmit() {
  const btn = document.getElementById('save-btn-action');
  if(!document.getElementById('p_name').value || Object.keys(labOrders).length === 0) { alert("Fill in Name and select a test."); return; }

  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true;

  let finalTestsArray = [];
  const pAge = document.getElementById('p_age').value || ""; const pSex = document.getElementById('p_sex').value || ""; const pFacility = document.getElementById('p_facility').value || "";

  Object.keys(labOrders).forEach(key => {
      const entry = { name: availableTests[key].testName, code: availableTests[key].testCode, details: { ...labOrders[key].details, age: pAge, sex: pSex, facility: pFacility } };
      if(labOrders[key].subTests && labOrders[key].subTests.length > 0) entry.details["Requested Tests"] = labOrders[key].subTests.join(', ');
      finalTestsArray.push(entry);
  });

  const formData = {
      patientId: document.getElementById('finalPatientId').value, fullName: document.getElementById('p_name').value,
      bday: document.getElementById('p_bday').value, sex: pSex, age: pAge, address: document.getElementById('p_address').value,
      contact: document.getElementById('p_contact').value, email: document.getElementById('p_email').value, facility: pFacility,
      encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify(finalTestsArray)
  };

  try {
      const res = await apiPost("submitForm", { formObject: formData });
      if (res.status === "success") {
          btn.style.background = "var(--success)"; btn.innerHTML = '<i class="ph ph-check"></i> Saved';
          clearForm();
          if (currentUser.role !== 'ENCODER') loadPendingData();
          setTimeout(() => { btn.disabled = false; btn.innerHTML = originalText; btn.style.background = ""; }, 2000);
      } else { throw new Error(res.message); }
  } catch (err) { alert("Error: " + err); btn.disabled = false; btn.innerHTML = originalText; }
}

// ==========================================
// 5. PENDING ANALYSIS LOGIC
// ==========================================
async function loadPendingData() {
  const icon = document.getElementById('refresh-icon');
  if(icon) icon.classList.add('ph-spin');
  try {
      const res = await apiGet("getPendingWorkload", { role: currentUser.role, facility: currentUser.facility });
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      window.pendingData = (data.pending || []).map(item => { item.id = String(item.id).trim(); return item; });
      window.completedData = (data.completed || data.encoded || []).map(item => { item.id = String(item.id).trim(); return item; }).reverse();
      renderLists();
  } catch (e) { } finally { if(icon) icon.classList.remove('ph-spin'); }
}

function renderLists() {
    const pList = document.getElementById('list-pending');
    const cList = document.getElementById('list-completed');
    const filterValue = document.getElementById('test-filter').value;
    if (!pList || !cList) return;

    const filterFn = (item, isCompleted) => {
        let t = (item.test || "").toUpperCase();
        let typeMatch = (filterValue === "ALL") || t.includes(filterValue) || (filterValue === 'GXP' && t.includes("MTB")) || (filterValue === 'DSSM' && t.includes("AFB")) || (filterValue === 'HEMA' && t.includes("CBC")) || (filterValue === 'CHEM' && t.includes("GLUCOSE"));
        if (!typeMatch) return false;
        if (isCompleted) {
            if (item.isSessionCompleted) return true;
            const dStr = item.dateResult || item.dateEncoded || item.date;
            if (dStr && new Date(dStr).toDateString() !== new Date().toDateString()) return false;
        }
        return true;
    };

    const fPending = window.pendingData.filter(i => filterFn(i, false));
    const fComp = window.completedData.filter(i => filterFn(i, true));

    pList.innerHTML = fPending.map(item => {
        const safeId = item.id.replace(/[^a-zA-Z0-9]/g, "");
        const isEditing = editModeIds.has(item.id);
        let tCode = "DEFAULT"; let t = item.test.toUpperCase();
        if (t.includes("VIRAL")) tCode = "GXVL"; else if (t.includes("GXP")||t.includes("MTB")) tCode = "GXP"; else if (t.includes("DSSM")||t.includes("AFB")) tCode = "DSSM"; else if (t.includes("UA")) tCode = "UA"; else if (t.includes("FA")) tCode = "FA"; else if (t.includes("HEMA")||t.includes("CBC")) tCode = "HEMA"; else if (t.includes("CHEM")) tCode = "CHEM"; else if (t.includes("GRAM")) tCode = "GRAM"; else if (t.includes("DENGUE")) tCode = "DENGUE"; else if (t.includes("SERO")) tCode = "SERO";
       
        if(!isEditing) {
            let subTxt = ""; try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; if(d.Age) subTxt = `(${d.Age}/${d.Sex})`; } catch(e){}
            return `
            <div class="patient-card" id="card-${safeId}">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                   <div style="flex-grow:1; cursor:pointer;" onclick="toggleExpand('${safeId}')">
                      <div class="pc-name">${item.name} <span style="color:var(--text-muted); font-size:0.75rem;">${subTxt}</span></div>
                      <div class="pc-meta">${item.test} • ${item.id}</div>
                   </div>
                   <div style="display:flex; gap:5px;">
                        <button onclick="toggleEditMode('${item.id}')" class="btn-icon"><i class="ph ph-pencil-simple"></i></button>
                        <button onclick="deleteEntry('${item.id}')" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button>
                   </div>
                </div>
                <div id="expand-${safeId}" class="pc-expand-area">
                    <div style="display:flex; gap:10px; margin-bottom: 12px;">
                        <button class="btn btn-secondary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, false)"><i class="ph ph-floppy-disk"></i> Save</button>
                        <button class="btn btn-primary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, true)"><i class="ph ph-printer"></i> Print</button>
                    </div>
                    <div>${getResultTemplate(tCode, safeId, item)}</div>
                </div>
            </div>`;
        } else {
            return `<div class="patient-card" style="border-color:var(--warning);">
                <input type="text" id="edit-name-${safeId}" value="${item.name}" class="form-input" style="margin-bottom:8px;">
                <textarea id="edit-details-${safeId}" class="form-input" style="min-height: 60px; font-family: monospace; font-size: 0.75rem; margin-bottom:8px;">${typeof item.details==='string'?item.details:JSON.stringify(item.details)}</textarea>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleEditMode('${item.id}')" class="btn btn-secondary" style="flex:1;">Cancel</button>
                    <button onclick="saveDetails('${item.id}', '${safeId}')" class="btn btn-primary" style="flex:1;">Save Edits</button>
                </div>
            </div>`;
        }
    }).join('');

    cList.innerHTML = fComp.map(item => {
        const isSel = selectedIds.has(item.id);
        return `
        <div class="patient-card print-target ${isSel ? 'selected' : ''}" data-id="${item.id}" data-test="${item.test}" onclick="toggleCard(this)" style="display:flex; align-items:center;">
            <i class="ph ph-check-circle-fill sel-icon" style="font-size:1.5rem; color:${isSel?'var(--pri)':'transparent'}; margin-right:12px; transition:0.2s;"></i>
            <div style="flex-grow:1;">
                <div class="pc-name" style="font-size:0.9rem;">${item.name}</div>
                <div class="pc-meta" style="margin:0;">${item.test}</div>
            </div>
            <button onclick="printDirect(event, '${item.id}', '${item.test}')" class="btn-icon"><i class="ph ph-printer"></i></button>
        </div>`;
    }).join('');

    document.getElementById('count-pending').innerText = fPending.length;
    updateFooter();
}

function toggleExpand(safeId) { const el = document.getElementById('expand-' + safeId); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleEditMode(id) { if(editModeIds.has(id)) editModeIds.delete(id); else editModeIds.add(id); renderLists(); }
function toggleCard(div) { const id = div.getAttribute('data-id'); if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); renderLists(); }
function toggleSelectAll() { const cards = document.querySelectorAll('.print-target'); const allSel = Array.from(cards).every(c => selectedIds.has(c.getAttribute('data-id'))); cards.forEach(c => { if(allSel) selectedIds.delete(c.getAttribute('data-id')); else selectedIds.add(c.getAttribute('data-id')); }); renderLists(); }
function updateFooter() { const f = document.getElementById('batch-footer'); if(selectedIds.size > 0) { f.style.display = 'block'; f.querySelector('button').innerHTML = `<i class="ph ph-printer"></i> Print Selected (${selectedIds.size})`; } else f.style.display = 'none'; }

async function saveDetails(id, safeId) { 
    const item = window.pendingData.find(i => String(i.id) === String(id).trim()); 
    try { await apiPost("updatePatientAndTestDetails", { testId: id, patientId: item.patientId, newName: document.getElementById(`edit-name-${safeId}`).value, newTestType: item.test, newJsonDetails: document.getElementById(`edit-details-${safeId}`).value }); toggleEditMode(id); loadPendingData(); } catch(e) {}
}
async function deleteEntry(id) { if(!confirm("Delete entry?")) return; try { await apiPost("deletePendingTestById", { testId: id }); loadPendingData(); } catch(e) {} }

async function saveResult(id, safeId, btn, doPrint) {
  const inputs = document.querySelectorAll('.res-' + safeId);
  const item = window.pendingData.find(d => String(d.id) === String(id).trim());
  let newResults = {}; inputs.forEach(inp => { newResults[inp.getAttribute('data-key')] = inp.value; });
  let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
  let finalStr = JSON.stringify({ ...detailsObj, ...newResults });

  btn.disabled = true; btn.innerHTML = 'Saving...';
  try {
      const res = await apiPost("saveLabResult", { patientId: item.patientId, testId: id, jsonDetails: finalStr, encodedBy: currentUser.fullName || currentUser.username, updatedName: item.name, updatedTest: item.test });
      if (res.status === "success") {
          btn.style.background = "var(--success)"; btn.innerHTML = 'Saved';
          if(doPrint) { setTimeout(() => { runPrintJob([{ testCode: id, testName: item.test }]); }, 500); }
          
          const pIndex = window.pendingData.findIndex(p => p.id === id);
          if (pIndex > -1) {
              const moved = window.pendingData[pIndex]; moved.isSessionCompleted = true; moved.dateResult = TODAY_STR;
              window.completedData.unshift(moved); window.pendingData.splice(pIndex, 1); renderLists();
          }
      }
  } catch (err) { btn.disabled = false; btn.innerHTML = "Save"; }
}

function printDirect(e, id, testName) { e.stopPropagation(); runPrintJob([{ testCode: id, testName: testName }]); }
function batchPrint() {
  if (selectedIds.size === 0) return;
  const requests = Array.from(document.querySelectorAll('.print-target.selected')).map(c => ({ testCode: c.getAttribute('data-id'), testName: c.getAttribute('data-test') }));
  runPrintJob(requests);
}
async function runPrintJob(requests) {
    try {
        const res = await apiPost("printFromRegistry", { requests: requests });
        if (res.status === "success" && res.data) {
            selectedIds.clear(); renderLists();
            const win = window.open('', '_blank'); if (win) { win.document.write(res.data); win.document.close(); }
        }
    } catch (e) { alert("Print Error"); }
}

// RESULT TEMPLATES
function handleDSSM(sel, safeId, num) { const box = document.getElementById(`s${num}n-${safeId}`); if(sel.value === '+N') box.style.display = 'block'; else { box.style.display = 'none'; if(box.querySelector('input')) box.querySelector('input').value = ""; } }
function getResultTemplate(code, safeId, item) {
 const gradings = ["Negative", "Trace", "1+", "2+", "3+", "4+"];
 const apps = ["Watery", "Salivary", "Mucosalivary", "Mucopurulent", "Purulent", "Blood-Streaked"];
 let req = ""; try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; req = (d["Requested Tests"] || "").toUpperCase(); } catch(e){}
 const input = (key, lbl, keys=[]) => (req==="" || keys.length===0 || keys.some(k=>req.includes(k))) ? `<div class="field-group"><label class="field-label">${lbl}</label><input type="text" class="res-${safeId} form-input" data-key="${key}"></div>` : '';
 const select = (key, lbl, opts, keys=[]) => (req==="" || keys.length===0 || keys.some(k=>req.includes(k))) ? `<div class="field-group"><label class="field-label">${lbl}</label><select class="res-${safeId} form-select" data-key="${key}">${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div>` : '';
 const rem = `<div class="field-group full-width" style="margin-top:10px;"><label class="field-label">Remarks</label><input type="text" class="res-${safeId} form-input" data-key="Remarks"></div>`;
 
 switch (code) {
     case 'GXP': return `<div class="form-grid grid-2">${select('ResultCode', 'MTB Result', ['N', 'T', 'TT', 'TI', 'RR', 'I'])} ${select('Appearance', 'Appearance', apps)} <div class="full-width">${select('Grade', 'Grade', ['', 'Very Low', 'Low', 'Medium', 'High'])}</div> <div class="full-width">${select('Repeat', 'Test Type', ['Standard', 'INITIAL'])}</div></div>${rem}`;
     case 'GXVL': return `<div class="form-grid grid-1">${select('VL_Choice', 'Interpretation', ['HIV-1 NOT DETECTED', 'DETECTED_XX', 'DETECTED >1X10e7', 'DETECTED <40', 'INVALID'])}${input('VL_Number', 'Copies/mL')}</div>${rem}`;
     case 'DSSM': return `<div class="form-grid grid-2">${[1,2].map(n=>`<div class="field-group"><label class="field-label">Smear ${n}</label><select class="res-${safeId} form-select" data-key="Smear${n}" onchange="handleDSSM(this,'${safeId}','${n}')"><option value=""></option><option value="0">0</option><option value="+N">+N</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option></select></div><div id="s${n}n-${safeId}" style="display:none;" class="field-group"><label class="field-label">Count</label><input type="number" class="res-${safeId} form-input" data-key="Smear${n}_Count"></div>`).join('')}<div class="full-width">${select('Diagnosis', 'Diagnosis', ['Negative', 'Positive'])}</div></div>${rem}`;
     case 'CHEM': return `<div class="form-grid grid-3">${input('FBS','FBS',['FBS','GLUCOSE'])}${input('RBS','RBS',['RBS'])}${input('HbA1c','HbA1c',['HBA1C'])}${input('Cholesterol','Chol',['CHOLESTEROL','LIPID'])}${input('Triglycerides','Trig',['TRIGLYCERIDES','LIPID'])}${input('HDL','HDL',['HDL','LIPID'])}${input('LDL','LDL',['LDL','LIPID'])}${input('BUN','BUN',['BUN'])}${input('Creatinine','Crea',['CREA'])}${input('Uric Acid','Uric',['URIC'])}${input('SGOT','SGOT',['SGOT','AST'])}${input('SGPT','SGPT',['SGPT','ALT'])}</div>${rem}`;
     case 'HEMA': return `<div class="form-grid grid-3">${input('Hemoglobin','Hb',['CBC'])}${input('Hematocrit','Hct',['CBC'])}${input('WBC_Count','WBC',['CBC'])}${input('RBC_Count','RBC',['CBC'])}${input('Platelet','Plt',['CBC','PLATELET'])}${input('Neutrophils','Neut',['CBC'])}${input('Lymphocytes','Lym',['CBC'])}${input('Monocytes','Mono',['CBC'])}${input('Eosinophils','Eos',['CBC'])}${input('Basophils','Baso',['CBC'])}${select('ABO','ABO',['A','B','AB','O'],['TYPING'])}${select('Rh','Rh',['Positive','Negative'],['TYPING'])}</div>${rem}`;
     case 'UA': return `<div class="form-grid grid-3">${input('Color','Color')}${input('Transparency','Transp')}${input('pH','pH')}${input('SG','Sp.Grav')}${select('Protein','Protein',gradings)}${select('Glucose','Glucose',gradings)}${input('RBC','RBC')}${input('WBC','WBC')}${input('Bacteria','Bact.')}${input('Epithelial','Epith.')}${input('Cast','Casts')}${input('Crystals','Crys.')}${input('Amorphous','Amorph')}${input('Mucus','Mucus')}</div>${rem}`;
     case 'FA': return `<div class="form-grid grid-2">${select('Color','Color',['Brown','Yellow','Green','Black','Red'])}${select('Consistency','Consistency',['Formed','Soft','Loose','Watery'])}<div class="full-width">${input('parasite','Parasite')}</div>${input('RBC','RBC')}${input('WBC','WBC')}</div>${rem}`;
     case 'GRAM': return `<div class="form-grid grid-2"><div class="full-width font-bold" style="color:var(--pri);">Gram Positive</div>${input('GP_Quantity','Qty')}${input('GP_Morphology','Morph')}${input('GP_Arrangement','Arrange')}<div class="full-width font-bold" style="color:var(--sec); margin-top:8px;">Gram Negative</div>${input('GN_Quantity','Qty')}${input('GN_Morphology','Morph')}${input('GN_Arrangement','Arrange')}</div>${rem}`;
     case 'SERO': return `<div class="form-grid grid-3">${select('HIV','HIV',['NONREACTIVE','REACTIVE'],['HIV','SERO'])}${select('HBSAG','HBsAg',['NONREACTIVE','REACTIVE'],['HBSAG','SERO'])}${select('SYPHILIS','Syphilis',['NONREACTIVE','REACTIVE'],['SYPHILIS','SERO'])}</div>${rem}`;
     case 'DENGUE': return `<div class="form-grid grid-1">${select('Dengue_Result','Dengue NS1',['Negative','Positive'])}</div>${rem}`;
     default: return `<div class="form-grid grid-1">${input('Result','Result')}</div>${rem}`;
 }
}

// ==========================================
// 6. REGISTRY LOGIC
// ==========================================
async function openRegistryModal(type) {
    showPage('registry');
    document.getElementById('regTitle').innerHTML = `<i class="ph ph-books" style="color:var(--pri);"></i> ${type} Registry`;
    const cont = document.getElementById('registry-table-content');
    cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i></div>';
    
    try {
        const res = await apiGet("getRegistryData", { type: type, facility: currentUser.facility, role: currentUser.role });
        if (res.status === "success") {
            window.CURRENT_REGISTRY_HEADERS = res.data.headers;
            window.CURRENT_REGISTRY_TITLE = res.data.title;
            const hMap = res.data.headers.map((h, i) => h.includes("{") ? null : { index: i, text: h.replace("Date ","").replace("Patient ",""), original: h }).filter(x=>x);
            const sorted = res.data.rows.sort((a, b) => String(b[3]).localeCompare(String(a[3])));
            
            let html = `<table class="data-table"><thead><tr><th style="width:30px;"><input type="checkbox" onclick="document.querySelectorAll('.chk-reg').forEach(c=>c.checked=this.checked); document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></th>`;
            hMap.forEach(c => html += `<th>${c.text}</th>`);
            html += `</tr></thead><tbody id="regTableBody">`;
            
            sorted.forEach(row => {
                html += `<tr><td><input type="checkbox" class="chk-reg" value="${encodeURIComponent(JSON.stringify(row))}" onchange="document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></td>`;
                hMap.forEach(c => {
                    let val = row[c.index];
                    if (c.original.toLowerCase().includes('result') || c.original.toLowerCase().includes('code') || c.original.toLowerCase().includes('diagnosis')) {
                        let style = "res-gray"; let vU = String(val).toUpperCase();
                        if (vU==="T" || vU.includes("REAC") || vU.includes("POS")) style = "res-positive";
                        else if (vU==="N" || vU.includes("NON") || vU.includes("NEG")) style = "res-negative";
                        else if (vU==="RR") style = "res-dark-red";
                        else if (vU==="TT"||vU==="TI") style = "res-warning";
                        else if (vU==="I" || vU.includes("ERR")) style = "res-black";
                        html += `<td><span class="res-badge ${style}">${val||''}</span></td>`;
                    } else { html += `<td>${val||''}</td>`; }
                });
                html += `</tr>`;
            });
            cont.innerHTML = html + `</tbody></table>`;
        }
    } catch (e) { cont.innerHTML = "Error loading data."; }
}

function filterRegistryTable() {
    const s = document.getElementById('regSearch').value.toLowerCase();
    const m = document.getElementById('monthFilter').value.toLowerCase();
    document.querySelectorAll('#regTableBody tr').forEach(tr => {
        const text = tr.textContent.toLowerCase();
        tr.style.display = (text.includes(s) && text.includes(m)) ? "" : "none";
    });
}

// ==========================================
// 7. SIDEBAR TOGGLE LOGIC
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        // I-save ang preference ng user sa browser
        if (sidebar.classList.contains('collapsed')) {
            localStorage.setItem('sidebar-pref', 'collapsed');
        } else {
            localStorage.setItem('sidebar-pref', 'expanded');
        }
    }
}

// Kapag nag-refresh, titingnan kung naka-collapse dati
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('sidebar-pref') === 'collapsed') {
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
});


