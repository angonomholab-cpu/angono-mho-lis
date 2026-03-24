// ==========================================
// 1. API CONNECTION & GLOBALS
// ==========================================
const SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE"; 

let currentUser = { username: "", facility: "", role: "", fullName: "" };
let labOrders = {};
let pendingData = [];
let completedData = [];
let isExistingPatient = false; 
let editingPendingId = null;
let currentQuickPatient = null;

const ALL_PAGES = ['page-workspace', 'page-registry', 'page-reports', 'page-settings'];
const TODAY_STR = new Date().toLocaleDateString(); 

async function apiGet(action, params = {}) {
    let url = new URL(SCRIPT_URL); url.searchParams.append('action', action);
    for (let key in params) if (params[key] !== undefined) url.searchParams.append(key, params[key]);
    try { const res = await fetch(url); return await res.json(); } catch (e) { throw e; }
}

async function apiPost(action, payload) {
    try { const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, ...payload }) }); return await res.json(); } catch (e) { throw e; }
}

// ==========================================
// 2. SYSTEM STARTUP & ANDROID MENU
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
            if(currentUser.role === 'VIEWER') showPage('registry'); else showPage('workspace');
        } catch (e) { localStorage.removeItem('labUser'); document.getElementById('app-loader').style.display = 'none'; }
    } else { document.getElementById('app-loader').style.display = 'none'; }
});

function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('show')) {
        sidebar.classList.remove('show');
        overlay.style.display = 'none'; overlay.style.opacity = '0';
    } else {
        sidebar.classList.add('show');
        overlay.style.display = 'block'; setTimeout(()=>overlay.style.opacity = '1', 10);
    }
}

// [Keep existing attemptLogin, logoutUser, toggleDarkMode, showPage, applyPermissions] ...

// ==========================================
// 4. ADD PATIENT LOGIC
// ==========================================
const availableTests = {
    "mtb": { testName: "GeneXpert MTB/Rif Ultra", testCode: "GXP", title: "GeneXpert Details", html: `<div class="field-group"><label class="field-label">History</label><select id="gx_hist" class="form-select"><option>New</option><option>Retreatment</option></select></div><div class="field-group"><label class="field-label">Source</label><input type="text" id="gx_src" class="form-input" placeholder="e.g. Dr. Cruz"></div><div class="field-group"><label class="field-label">X-Ray</label><input type="text" id="gx_xray" class="form-input" placeholder="e.g. Normal"></div>`},
    "dssm": { testName: "DSSM", testCode: "DSSM", title: "DSSM Microscopy", html: `<div class="field-group"><label class="field-label">TB Case No</label><input type="text" id="ds_case" class="form-input" placeholder="Case Number"></div><div class="field-group"><label class="field-label">Month of Treatment</label><input type="text" id="ds_month" class="form-input" placeholder="e.g. 2nd Month"></div>` },
    "viral": { testName: "GeneXpert Viral Load", testCode: "GXVL", isSimple: true },
    "sero": { testName: "Serology", testCode: "SERO", title: "Serology", html: `<label class="field-label">Test(s):</label><div class="chip-group" id="sero-sub-tests">${['HIV Screening','Syphilis Screening','HBsAg Screening'].map(t => `<div class="chip" onclick="toggleSub(this)" data-val="${t}">${t}</div>`).join('')}</div><div class="form-grid grid-1" style="margin-top:8px;"><div class="field-group"><label class="field-label">Classification</label><select id="sr_class" class="form-select"><option>Maternal</option><option>SHC</option><option>TB Patient</option></select></div><div class="field-group"><label class="field-label">KAP Category</label><select id="sr_kap" class="form-select"><option value="None">None</option><option>MSM</option><option>TGW</option><option>FSW</option><option>MSW</option><option>PDL</option><option>PWID</option></select></div></div>` },
    "gram": { testName: "Gram Stain", testCode: "GRAM", title: "Gram Stain", html: `<div class="field-group"><label class="field-label">Source</label><input type="text" id="gs_src" class="form-input" placeholder="e.g. Urethral Discharge"></div>` },
    "dengue": { testName: "Dengue", testCode: "DENG", title: "Dengue Setup", html: `<div class="field-group"><label class="field-label">Days of Illness</label><input type="number" id="dn_onset" class="form-input" placeholder="e.g. 3"></div> <div class="field-group" style="margin-top:12px;"><label style="cursor:pointer; display:flex; align-items:center; gap:8px; font-weight:600; color:var(--text-main); font-size:0.85rem;"><input type="checkbox" id="dn_duo_check" style="accent-color:var(--pri); width:16px; height:16px;"> Include Dengue Duo (IgG/IgM)</label></div>` },
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
function cancelDetail() { document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-buttons-container').style.display = 'flex'; }

function confirmDetail(id) {
   let details = {}; let subSelected = [];
   if(id === 'mtb') details = { "History of Treatment": document.getElementById('gx_hist').value, "Source of Request": document.getElementById('gx_src').value, "X-Ray Result": document.getElementById('gx_xray').value };
   else if(id === 'dssm') details = { "TB Case Number": document.getElementById('ds_case').value, "Month of Treatment": document.getElementById('ds_month').value };
   else if(id === 'gram') details = { "Source of Specimen": document.getElementById('gs_src').value };
   else if(id === 'dengue') { details = { "Day/s of Onset of Illness": document.getElementById('dn_onset').value }; if(document.getElementById('dn_duo_check') && document.getElementById('dn_duo_check').checked) subSelected.push('Dengue Duo'); }
   else if(['sero','hema','chem'].includes(id)) { const activeBtns = document.querySelectorAll('#test-details-area .chip.active'); if(activeBtns.length === 0) { alert("Select at least one test."); return; } subSelected = Array.from(activeBtns).map(b => b.getAttribute('data-val')); if(id === 'sero') details = { "Classification": document.getElementById('sr_class').value, "KAP Category": document.getElementById('sr_kap').value }; }
   
   labOrders[id] = { details: details, subTests: subSelected }; 
   document.getElementById('btn-'+id).classList.add('active'); 
   updateSummary(); cancelDetail(); 
}

function toggleSimple(id) { const btn = document.getElementById('btn-'+id); if(labOrders[id]) { delete labOrders[id]; btn.classList.remove('active'); } else { labOrders[id] = { details: {}, subTests: [] }; btn.classList.add('active'); } updateSummary(); }
function updateSummary() { const container = document.getElementById('order-summary'); container.innerHTML = ''; Object.keys(labOrders).forEach(key => { let label = availableTests[key].testName; if(labOrders[key].subTests && labOrders[key].subTests.length > 0) label += `: ${labOrders[key].subTests.join(', ')}`; container.innerHTML += `<div class="badge badge-warning" style="cursor:pointer;" onclick="removeOrder('${key}')">${label} &times;</div>`; }); }
function removeOrder(key) { delete labOrders[key]; document.getElementById('btn-'+key).classList.remove('active'); updateSummary(); }

function setSelectValue(id, val) { const el = document.getElementById(id); if (!el || !val) return; const searchVal = String(val).toUpperCase().trim(); for (let i = 0; i < el.options.length; i++) { if (el.options[i].value.toUpperCase().trim() === searchVal || el.options[i].text.toUpperCase().trim() === searchVal) { el.selectedIndex = i; return; } } }
function calculateAge() { const dob = new Date(document.getElementById('p_bday').value); const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--; document.getElementById('p_age').value = age; }
function generateSmartID() { if(isExistingPatient) return; const bday = document.getElementById('p_bday').value.replace(/-/g, "") || "00000000"; const name = document.getElementById('p_name').value.trim().toUpperCase(); let initials = "XX"; if(name) { const p = name.split(" "); initials = p.length > 1 ? p[0][0] + p[p.length-1][0] : name.substring(0,2); } document.getElementById('finalPatientId').value = `MHOA-${bday}-${initials}${Math.floor(Math.random()*90+10)}`; }

// SEARCH PATIENT ENTRY
let searchTimeout; 
async function runDirectSearch(q) {
  const box = document.getElementById('direct-results-box'); const stat = document.getElementById('search-status');
  if(q.length < 2) { box.style.display='none'; stat.style.display='none'; return; }
  stat.style.display='block'; clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
      try {
          const res = await apiGet("searchPatients", { query: q });
          if (res.status === "success" && res.data.length > 0) {
              box.style.display = 'block'; box.innerHTML = '';
              res.data.forEach(p => {
                  const div = document.createElement('div'); div.className = "search-item";
                  div.innerHTML = `<div style="font-weight:600;">${p.name} <span class="badge badge-success" style="margin-left:4px;">Returning</span></div><div style="font-size:0.7rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility || 'No Facility'}</div>`;
                  div.onclick = () => {
                      isExistingPatient = true; document.getElementById('finalPatientId').value = p.id;
                      document.getElementById('p_name').value = p.name || ""; document.getElementById('p_age').value = p.age || "";
                      document.getElementById('p_address').value = p.address || ""; document.getElementById('p_contact').value = p.contact || ""; 
                      setSelectValue('p_sex', p.sex); setSelectValue('p_facility', p.facility || p.Facility);
                      if (p.bday) { try { const d = new Date(p.bday); document.getElementById('p_bday').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } catch(e){} }
                      box.style.display = 'none'; 
                      fetchHistory(p.id, 'history-section', 'history-list'); // Load history below form
                  };
                  box.appendChild(div);
              });
          } else { box.style.display = 'none'; }
      } catch(e) {} finally { stat.style.display='none'; }
  }, 600);
}

// ==========================================
// 5. HISTORY & QUICK SEARCH LOGIC
// ==========================================
function openQuickSearch() { document.getElementById('quick-search-modal').style.display='flex'; document.getElementById('quick-search-input').focus(); }
async function runQuickSearch(q) {
  const box = document.getElementById('quick-search-results');
  if(q.length < 2) { box.style.display='none'; return; }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
      try {
          const res = await apiGet("searchPatients", { query: q });
          if (res.status === "success" && res.data.length > 0) {
              box.style.display = 'block'; box.innerHTML = '';
              res.data.forEach(p => {
                  const div = document.createElement('div'); div.className = "search-item";
                  div.innerHTML = `<div style="font-weight:600;">${p.name}</div><div style="font-size:0.75rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility || 'No Facility'}</div>`;
                  div.onclick = () => { viewQuickProfile(p); box.style.display = 'none'; };
                  box.appendChild(div);
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
    document.getElementById('qs-meta').innerText = `ID: ${p.id} | Age: ${p.age} | Sex: ${p.sex} | Facility: ${p.facility || 'N/A'}`;
    fetchHistory(p.id, null, 'qs-history-list', true); // true = QuickSearch mode
}

function editPatientDemographicsQS() {
    if(!currentQuickPatient) return;
    document.getElementById('qs-edit-form').style.display = 'block';
    document.getElementById('qs_edit_name').value = currentQuickPatient.name;
    document.getElementById('qs_edit_age').value = currentQuickPatient.age;
    document.getElementById('qs_edit_fac').value = currentQuickPatient.facility || currentQuickPatient.Facility;
}
function savePatientDemographicsQS() { alert("Demographics update triggered. (Need backend endpoint to save to Masterlist)."); document.getElementById('qs-edit-form').style.display = 'none'; }

// UNIVERSAL HISTORY FETCHER WITH EXPANDABLE CARDS
async function fetchHistory(id, sectionId, listId, isQuickSearch = false) {
    if(sectionId) document.getElementById(sectionId).style.display = 'block';
    const list = document.getElementById(listId);
    list.innerHTML = '<div style="text-align:center; color:var(--pri);"><i class="ph ph-spinner ph-spin"></i> Retrieving full records...</div>';
    
    try {
        const res = await apiGet("getPatientHistory", { patientId: id });
        if (res.status === 'success' && res.data.length > 0) {
            list.innerHTML = res.data.map((h, i) => {
                const uniqueId = `hist-${listId}-${i}`;
                const dateStr = new Date(h.date).toLocaleDateString();
                let fullDataHtml = '';
                if(h.fullData) {
                    for (const [key, value] of Object.entries(h.fullData)) {
                        if(value && String(value).trim() !== "") fullDataHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid var(--border-color); padding-bottom:2px;"><strong style="color:var(--text-muted);">${key}:</strong> <span>${value}</span></div>`;
                    }
                }
                
                // Card HTML
                return `
                <div class="history-card" style="display:flex; flex-direction:column; align-items:stretch;">
                    <div style="display:flex; justify-content:space-between; align-items:center; width:100%;" onclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'">
                        <div><div class="h-test">${h.test}</div><div class="h-date">${dateStr}</div></div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="badge badge-warning" style="font-size:0.6rem;">${h.result}</span>
                            <i class="ph ph-caret-down" style="color:var(--text-muted);"></i>
                        </div>
                    </div>
                    <div id="${uniqueId}" class="h-expanded-details">
                        ${fullDataHtml}
                        ${isQuickSearch ? `<div style="margin-top:10px; display:flex; gap:10px;"><button class="btn btn-secondary text-xs" onclick="alert('Inline editing of registry history coming soon!')"><i class="ph ph-pencil-simple"></i> Edit Result</button><button class="btn btn-primary text-xs" onclick="printDirect(event, '${id}', '${h.test}')"><i class="ph ph-printer"></i> Print</button></div>` : ''}
                    </div>
                </div>`;
            }).join('');
        } else { list.innerHTML = '<div class="text-muted text-xs text-center">No lab records found.</div>'; }
    } catch(e) { list.innerHTML = '<div class="text-xs text-center" style="color:var(--danger);">Failed to load history.</div>'; }
}

function clearForm() {
    document.getElementById('regForm').reset(); labOrders = {}; 
    document.querySelectorAll('.test-btn-vert.active').forEach(b => b.classList.remove('active')); updateSummary();
    document.getElementById('finalPatientId').value = ""; isExistingPatient = false; 
    document.getElementById('history-section').style.display = 'none';
    
    editingPendingId = null;
    document.getElementById('col-entry').classList.remove('edit-mode-pane');
    document.getElementById('entry-main-header').classList.remove('edit-mode-header');
    document.getElementById('entry-main-header').innerHTML = `<h2><i class="ph ph-user-plus"></i> Patient Entry</h2><button class="btn-icon" onclick="clearForm()"><i class="ph ph-eraser"></i></button>`;
    document.getElementById('entry-right-pane').style.display = 'flex';
    document.getElementById('save-btn-action').innerHTML = '<i class="ph ph-paper-plane-right"></i> Save Record';
    document.getElementById('save-btn-action').onclick = finalSubmit; 
    document.getElementById('save-btn-action').style.background = '';
}

async function finalSubmit() {
  const btn = document.getElementById('save-btn-action');
  if(!document.getElementById('p_name').value || Object.keys(labOrders).length === 0) { alert("Fill in Name and select a test."); return; }
  const originalText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true;

  let finalTestsArray = [];
  const pAge = document.getElementById('p_age').value || ""; const pSex = document.getElementById('p_sex').value || ""; const pFacility = document.getElementById('p_facility').value || "";
  Object.keys(labOrders).forEach(key => {
      const entry = { name: availableTests[key].testName, code: availableTests[key].testCode, details: { ...labOrders[key].details, age: pAge, sex: pSex, facility: pFacility, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, bday: document.getElementById('p_bday').value } };
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
          if (currentUser.role !== 'ENCODER') loadPendingData(); // Auto refresh
          setTimeout(() => { btn.disabled = false; btn.innerHTML = originalText; btn.style.background = ""; }, 2000);
      }
  } catch (err) {}
}

// ==========================================
// 6. EDIT PENDING FULL (Fix 4)
// ==========================================
function editPendingFull(id) {
    const item = window.pendingData.find(i => String(i.id) === String(id).trim()); if(!item) return;
    editingPendingId = item.id; isExistingPatient = true; 
    
    // UI Change to Edit Mode
    document.getElementById('col-entry').classList.add('edit-mode-pane');
    document.getElementById('entry-main-header').classList.add('edit-mode-header');
    document.getElementById('entry-main-header').innerHTML = `<h2><i class="ph ph-pencil-simple"></i> Editing Pending Record</h2><button class="btn-icon" onclick="cancelEditPending()" style="color:white;"><i class="ph ph-x"></i></button>`;
    
    // Left Side
    document.getElementById('finalPatientId').value = item.patientId;
    document.getElementById('p_name').value = item.name || "";
    let d = {}; try { d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; } catch(e){}
    document.getElementById('p_age').value = d.age || d.Age || "";
    document.getElementById('p_address').value = d.address || d.Address || "";
    document.getElementById('p_contact').value = d.contact || d.Contact || "";
    setSelectValue('p_sex', d.sex || d.Sex); setSelectValue('p_facility', d.facility || d.Facility);
    if(d.bday || d.Bday) { try { const bd = new Date(d.bday||d.Bday); document.getElementById('p_bday').value = `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}`; } catch(e){} }
    
    // Right Side
    const rightPane = document.getElementById('entry-right-pane');
    rightPane.innerHTML = `<label class="field-label" style="color:var(--sec); margin-bottom:10px; font-size:0.8rem;">Editing Test Specifics: ${item.test}</label><textarea id="edit-pending-details-box" class="form-input" style="min-height: 250px; font-family: monospace; font-size: 0.8rem;">${JSON.stringify(d, null, 2)}</textarea>`;
    
    const saveBtn = document.getElementById('save-btn-action');
    saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Update Pending Record';
    saveBtn.onclick = submitPendingUpdate; saveBtn.style.background = 'var(--sec)'; saveBtn.style.color = 'white';
}

function cancelEditPending() { clearForm(); } // Call clearForm to reset everything
async function submitPendingUpdate() {
    if(!editingPendingId) return; const item = window.pendingData.find(i => String(i.id) === String(editingPendingId).trim());
    const btn = document.getElementById('save-btn-action'); const oldTxt = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Updating...'; btn.disabled = true;
    try { await apiPost("updatePatientAndTestDetails", { testId: editingPendingId, patientId: item.patientId, newName: document.getElementById('p_name').value, newTestType: item.test, newJsonDetails: document.getElementById('edit-pending-details-box').value }); cancelEditPending(); loadPendingData(); } catch(e) {} finally { btn.innerHTML = oldTxt; btn.disabled = false; }
}

// ==========================================
// 7. PENDING & RESULT RENDER ENGINE
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
    const pList = document.getElementById('list-pending'); const cList = document.getElementById('list-completed'); const filterValue = document.getElementById('test-filter').value;
    if (!pList || !cList) return;
    const filterFn = (item, isCompleted) => {
        let t = (item.test || "").toUpperCase(); let typeMatch = (filterValue === "ALL") || t.includes(filterValue) || (filterValue === 'GXP' && t.includes("MTB")) || (filterValue === 'DSSM' && t.includes("AFB")) || (filterValue === 'HEMA' && t.includes("CBC")) || (filterValue === 'CHEM' && t.includes("GLUCOSE"));
        if (!typeMatch) return false;
        if (isCompleted) { if (item.isSessionCompleted) return true; const dStr = item.dateResult || item.dateEncoded || item.date; if (dStr && new Date(dStr).toDateString() !== new Date().toDateString()) return false; }
        return true;
    };
    const fPending = window.pendingData.filter(i => filterFn(i, false)); const fComp = window.completedData.filter(i => filterFn(i, true));

    pList.innerHTML = fPending.map(item => {
        const safeId = item.id.replace(/[^a-zA-Z0-9]/g, ""); let tCode = "DEFAULT"; let t = item.test.toUpperCase();
        if (t.includes("VIRAL")) tCode = "GXVL"; else if (t.includes("GXP")||t.includes("MTB")) tCode = "GXP"; else if (t.includes("DSSM")||t.includes("AFB")) tCode = "DSSM"; else if (t.includes("UA")) tCode = "UA"; else if (t.includes("FA")) tCode = "FA"; else if (t.includes("HEMA")||t.includes("CBC")) tCode = "HEMA"; else if (t.includes("CHEM")) tCode = "CHEM"; else if (t.includes("GRAM")) tCode = "GRAM"; else if (t.includes("DENGUE")) tCode = "DENGUE"; else if (t.includes("SERO")) tCode = "SERO";
        let subTxt = ""; try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; if(d.Age) subTxt = `(${d.Age}/${d.Sex})`; } catch(e){}
        return `<div class="pending-card" id="card-${safeId}"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div style="flex-grow:1; cursor:pointer;" onclick="toggleExpand('${safeId}')"><div class="pc-name">${item.name} <span style="color:var(--text-muted); font-size:0.7rem; font-weight:normal;">${subTxt}</span></div><div class="pc-meta">${item.test} • By: <span style="color:var(--pri);">${item.encoder || 'System'}</span></div></div><div style="display:flex; gap:5px;"><button onclick="editPendingFull('${item.id}')" class="btn-icon" title="Edit Full Profile"><i class="ph ph-pencil-simple"></i></button><button onclick="deleteEntry('${item.id}')" class="btn-icon" style="color:var(--danger);" title="Delete"><i class="ph ph-trash"></i></button></div></div><div id="expand-${safeId}" class="pc-expand-area"><div style="display:flex; gap:10px; margin-bottom: 16px;"><button class="btn btn-secondary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, false)"><i class="ph ph-floppy-disk"></i> Save Only</button><button class="btn btn-primary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this, true)"><i class="ph ph-printer"></i> Save & Print</button></div><div>${getResultTemplate(tCode, safeId, item)}</div></div></div>`;
    }).join('');

    cList.innerHTML = fComp.map(item => {
        let tCodePrint = "DEFAULT"; let t = item.test.toUpperCase();
        if (t.includes("VIRAL")) tCodePrint = "GXVL"; else if (t.includes("GXP")||t.includes("MTB")) tCodePrint = "GXP"; else if (t.includes("DSSM")||t.includes("AFB")) tCodePrint = "DSSM"; else if (t.includes("UA")) tCodePrint = "UA"; else if (t.includes("FA")) tCodePrint = "FA"; else if (t.includes("HEMA")||t.includes("CBC")) tCodePrint = "HEMA"; else if (t.includes("CHEM")) tCodePrint = "CHEM"; else if (t.includes("GRAM")) tCodePrint = "GRAM"; else if (t.includes("DENGUE")) tCodePrint = "DENGUE"; else if (t.includes("SERO")) tCodePrint = "SERO";
        return `<div class="completed-card" onclick="printDirect(event, '${item.id}', '${tCodePrint}')" title="Click to print"><div style="overflow:hidden;"><div class="pc-name">${item.name}</div><div class="pc-meta">${item.test}</div></div><i class="ph ph-printer" style="color: var(--success); font-size: 1.2rem;"></i></div>`;
    }).join('');
    document.getElementById('count-pending').innerText = `(${fPending.length})`;
}

function toggleExpand(safeId) { const el = document.getElementById('expand-' + safeId); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
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
          
          // Determine code for print
          let tCodePrint = "DEFAULT"; let t = item.test.toUpperCase();
          if (t.includes("VIRAL")) tCodePrint = "GXVL"; else if (t.includes("GXP")||t.includes("MTB")) tCodePrint = "GXP"; else if (t.includes("DSSM")||t.includes("AFB")) tCodePrint = "DSSM"; else if (t.includes("UA")) tCodePrint = "UA"; else if (t.includes("FA")) tCodePrint = "FA"; else if (t.includes("HEMA")||t.includes("CBC")) tCodePrint = "HEMA"; else if (t.includes("CHEM")) tCodePrint = "CHEM"; else if (t.includes("GRAM")) tCodePrint = "GRAM"; else if (t.includes("DENGUE")) tCodePrint = "DENGUE"; else if (t.includes("SERO")) tCodePrint = "SERO";
          
          if(doPrint) { setTimeout(() => { runPrintJob([{ testCode: id, testName: tCodePrint }]); }, 500); }
          const pIndex = window.pendingData.findIndex(p => p.id === id);
          if (pIndex > -1) { const moved = window.pendingData[pIndex]; moved.isSessionCompleted = true; moved.dateResult = TODAY_STR; window.completedData.unshift(moved); window.pendingData.splice(pIndex, 1); renderLists(); }
      }
  } catch (err) {}
}

function printDirect(e, id, testName) { e.stopPropagation(); runPrintJob([{ testCode: id, testName: testName }]); }
async function runPrintJob(requests) { try { const res = await apiPost("printFromRegistry", { requests: requests }); if (res.status === "success" && res.data) { const win = window.open('', '_blank'); if (win) { win.document.write(res.data); win.document.close(); } } } catch (e) { alert("Print Error"); } }

// TEMPLATES
function handleDSSM(sel, safeId, num) { const box = document.getElementById(`s${num}n-${safeId}`); if(sel.value === '+N') box.style.display = 'block'; else { box.style.display = 'none'; if(box.querySelector('input')) box.querySelector('input').value = ""; } }
function getResultTemplate(code, safeId, item) {
 const gradings = ["Negative", "Trace", "1+", "2+", "3+", "4+"]; const apps = ["Watery", "Salivary", "Mucosalivary", "Mucopurulent", "Purulent", "Blood-Streaked"];
 let req = ""; try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; req = (d["Requested Tests"] || "").toUpperCase(); } catch(e){}
 const input = (key, lbl, keys=[]) => (req==="" || keys.length===0 || keys.some(k=>req.includes(k))) ? `<div class="field-group"><label class="field-label">${lbl}</label><input type="text" class="res-${safeId} form-input" data-key="${key}"></div>` : '';
 const select = (key, lbl, opts, keys=[]) => (req==="" || keys.length===0 || keys.some(k=>req.includes(k))) ? `<div class="field-group"><label class="field-label">${lbl}</label><select class="res-${safeId} form-select" data-key="${key}">${opts.map(o=>`<option value="${o}">${o}</option>`).join('')}</select></div>` : '';
 const rem = `<div class="field-group full-width" style="margin-top:10px;"><label class="field-label">Remarks</label><input type="text" class="res-${safeId} form-input" data-key="Remarks"></div>`;
 
 switch (code) {
     case 'GXP': return `<div class="form-grid grid-2">${select('ResultCode', 'MTB Result', ['N', 'T', 'TT', 'TI', 'RR', 'I'])} ${select('Appearance', 'Appearance', apps)} <div class="full-width">${select('Grade', 'Grade', ['', 'Very Low', 'Low', 'Medium', 'High'])}</div> <div class="full-width">${select('Repeat', 'Test Type', ['Standard', 'INITIAL'])}</div></div>${rem}`;
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

// ==========================================
// 8. REGISTRY MODALS, FIT & FILTERS
// ==========================================
function showRegistrySelectionModal() { document.getElementById('registry-selection-modal').style.display = 'flex'; }

async function openRegistryModal(type) {
    document.getElementById('registry-selection-modal').style.display = 'none'; showPage('registry');
    document.getElementById('regTitle').innerHTML = `<i class="ph ph-books" style="color:var(--pri);"></i> ${type} Registry`;
    const cont = document.getElementById('registry-table-content');
    cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i></div>';
    try {
        const res = await apiGet("getRegistryData", { type: type, facility: currentUser.facility, role: currentUser.role });
        if (res.status === "success") {
            window.CURRENT_REGISTRY_HEADERS = res.data.headers; window.CURRENT_REGISTRY_TITLE = res.data.title;
            const hMap = res.data.headers.map((h, i) => h.includes("{") ? null : { index: i, text: h.replace("Date ","").replace("Patient ",""), original: h }).filter(x=>x);
            
            // Populate Column Filter Options dynamically
            const colFilter = document.getElementById('colFilter');
            colFilter.innerHTML = '<option value="ALL">All Columns</option>';
            hMap.forEach(c => colFilter.innerHTML += `<option value="${c.index}">${c.text}</option>`);

            // Sort Oldest to Newest
            const sorted = res.data.rows.sort((a, b) => new Date(a[0]) - new Date(b[0]));
            
            let html = `<table class="data-table"><thead><tr><th style="width:30px;"><input type="checkbox" onclick="document.querySelectorAll('.chk-reg').forEach(c=>c.checked=this.checked); document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></th>`;
            hMap.forEach(c => html += `<th>${c.text}</th>`); html += `</tr></thead><tbody id="regTableBody">`;
            
            sorted.forEach(row => {
                html += `<tr><td><input type="checkbox" class="chk-reg" value="${encodeURIComponent(JSON.stringify(row))}" onchange="document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></td>`;
                hMap.forEach(c => {
                    let val = row[c.index];
                    // Strict coloring: Only apply if the column is exactly "Result", "Code", "Diagnosis", etc. NOT "X-Ray Result"
                    let isResCol = c.original.toLowerCase().includes('result code') || c.original.toLowerCase() === 'result' || c.original.toLowerCase() === 'diagnosis';
                    
                    if (isResCol) {
                        let style = "res-gray"; let vU = String(val).toUpperCase();
                        if (vU==="T" || vU.includes("REAC") || vU.includes("POS")) style = "res-positive";
                        else if (vU==="N" || vU.includes("NON") || vU.includes("NEG")) style = "res-negative";
                        else if (vU==="RR" || vU.includes("RESISTANT")) style = "res-dark-red"; 
                        else if (vU==="TT"||vU==="TI") style = "res-warning";
                        else if (vU==="I" || vU.includes("ERR")) style = "res-black";
                        html += `<td><span class="res-badge ${style}">${val||''}</span></td>`;
                    } else { html += `<td>${val||''}</td>`; }
                }); html += `</tr>`;
            });
            cont.innerHTML = html + `</tbody></table>`;
        }
    } catch (e) {}
}

function filterRegistryTable() {
    const s = document.getElementById('regSearch').value.toLowerCase(); 
    const m = document.getElementById('monthFilter').value.toLowerCase();
    const colIdx = document.getElementById('colFilter').value; // Specific column filter
    
    document.querySelectorAll('#regTableBody tr').forEach(tr => { 
        let textToSearch = "";
        if (colIdx === "ALL") {
            textToSearch = tr.textContent.toLowerCase();
        } else {
            // Add 1 to colIdx because first cell is checkbox
            const cell = tr.querySelectorAll('td')[parseInt(colIdx) + 1];
            textToSearch = cell ? cell.textContent.toLowerCase() : "";
        }
        
        // Month Filter specifically targets the 2nd cell (Date Received/Examined usually index 0)
        const dateCell = tr.querySelectorAll('td')[1]; 
        const dateText = dateCell ? dateCell.textContent.toLowerCase() : "";
        
        const matchSearch = textToSearch.includes(s);
        const matchMonth = m === "" || dateText.includes(m);
        
        tr.style.display = (matchSearch && matchMonth) ? "" : "none"; 
    });
}

