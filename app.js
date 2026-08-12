const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyuAQBNWBCFmEF5KAsVf24HlbxzkqiS82Vas5YARJU2f4Tqs-ehnod2ZnoaMo02Gxs8yQ/exec"; 

let currentUser = { username: "", facility: "", role: "", fullName: "" };
let labOrders = {};
let pendingData = [];
let currentRegistryPage = 1;
let registryLimit = 20; // Pwede mong gawing 30 o 50 kung ilan gusto mo kada page
let completedData = [];
let cachedPatients = []; // 🟢 BAGO: Dito iipunin ang lahat ng patients para instant
let isExistingPatient = false; 
let editingPendingId = null;
let currentQuickPatient = null;
let searchTimeout; 
let confirmActionCallback = null; 
window.CURRENT_TEST_TYPE = ""; 
const ALL_PAGES = ['page-workspace', 'page-registry', 'page-reports', 'page-settings', 'page-patient'];
const TODAY_STR = new Date().toLocaleDateString(); 
// ==========================================
// 🔴 IDAGDAG ITO PARA GUMANA ANG MGA BUTTONS 🔴
// ==========================================
// ==========================================
// 🔴 PERFECT MATCH PARA SA INDEX.HTML MO 🔴
// ==========================================
const availableTests = {
    'mtb': { 
        testName: 'GeneXpert MTB/Rif Ultra', testCode: 'GXP', title: 'GeneXpert MTB/RIF', 
        html: '<div class="field-group"><label class="field-label">History of Treatment</label><select data-key="History of Treatment" class="form-select"><option value="New">New</option><option value="Retreatment">Retreatment</option></select></div><div class="field-group"><label class="field-label">Source of Request</label><input type="text" data-key="Source of Request" class="form-input"></div><div class="field-group full-width"><label class="field-label">X-Ray Result</label><input type="text" data-key="X-Ray Result" class="form-input"></div>' 
    },
    'viral': { 
        testName: 'Viral Load', testCode: 'GXVL', title: 'HIV-1 Viral Load', 
        html: '<div class="field-group full-width" style="color:var(--text-muted); font-size:0.8rem;">Proceed to confirmation to add this test.</div>' 
    },
    'dssm': { 
        testName: 'DSSM', testCode: 'DSSM', title: 'DSSM (AFB Smear)', 
        html: '<div class="field-group"><label class="field-label">TB Case Number</label><input type="text" data-key="TB Case Number" class="form-input"></div><div class="field-group"><label class="field-label">Month of Treatment</label><input type="text" data-key="Month of Treatment" class="form-input"></div>' 
    },
    'hema': { 
        testName: 'Hematology', testCode: 'HEMA', title: 'Hematology', 
        html: '<div class="chip-group"><div class="chip" data-val="CBC" onclick="toggleSub(this)">CBC</div><div class="chip" data-val="Blood Typing" onclick="toggleSub(this)">Blood Typing</div></div>' 
    },
    'chem': { 
        testName: 'Blood Chemistry', testCode: 'CHEM', title: 'Blood Chemistry', 
        html: '<div class="chip-group"><div class="chip" data-val="FBS" onclick="toggleSub(this)">FBS</div><div class="chip" data-val="RBS" onclick="toggleSub(this)">RBS</div><div class="chip" data-val="Cholesterol" onclick="toggleSub(this)">Cholesterol</div><div class="chip" data-val="Triglycerides" onclick="toggleSub(this)">Triglycerides</div><div class="chip" data-val="HDL" onclick="toggleSub(this)">HDL</div><div class="chip" data-val="LDL" onclick="toggleSub(this)">LDL</div><div class="chip" data-val="BUN" onclick="toggleSub(this)">BUN</div><div class="chip" data-val="Creatinine" onclick="toggleSub(this)">Creatinine</div><div class="chip" data-val="Uric Acid" onclick="toggleSub(this)">Uric Acid</div><div class="chip" data-val="SGOT" onclick="toggleSub(this)">SGOT/AST</div><div class="chip" data-val="SGPT" onclick="toggleSub(this)">SGPT/ALT</div><div class="chip" data-val="HbA1c" onclick="toggleSub(this)">HbA1c</div></div>' 
    },
    'uria': { 
        testName: 'Urinalysis', testCode: 'UA', title: 'Clinical Microscopy - Urine', 
        html: '<div class="field-group full-width" style="color:var(--text-muted); font-size:0.8rem;">Standard Urinalysis selected.</div>' 
    },
    'feca': { 
        testName: 'Fecalysis', testCode: 'FA', title: 'Clinical Microscopy - Feces', 
        html: '<div class="field-group full-width" style="color:var(--text-muted); font-size:0.8rem;">Standard Fecalysis selected.</div>' 
    },
    'sero': { 
        testName: 'Serology', testCode: 'SERO', title: 'Serology / Immunology', 
        html: '<div class="chip-group"><div class="chip" data-val="HIV" onclick="toggleSub(this)">HIV</div><div class="chip" data-val="Syphilis" onclick="toggleSub(this)">Syphilis</div><div class="chip" data-val="HBsAg" onclick="toggleSub(this)">HBsAg</div></div><div class="field-group" style="margin-top:10px;"><label class="field-label">Classification</label><select data-key="Classification" class="form-select"><option value="Maternal">Maternal</option><option value="SHC">SHC</option><option value="TB Patient">TB Patient</option></select></div><div class="field-group" style="margin-top:10px;"><label class="field-label">KAP Category</label><select data-key="KAP Category" class="form-select"><option value="None">None</option><option value="MSM">MSM</option><option value="TGW">TGW</option><option value="MSW">MSW</option><option value="FSW">FSW</option><option value="PWID">PWID</option></select></div>' 
    },
    'dengue': { 
        testName: 'Dengue', testCode: 'DENGUE', title: 'Dengue Rapid Test', 
        html: '<label style="display:flex; align-items:center; gap:8px; font-weight:600;"><input type="checkbox" id="dn_duo_check" style="width:18px; height:18px; accent-color:var(--pri);"> Dengue Duo (NS1 + IgG/IgM)</label>' 
    },
    'gram': { 
        testName: 'Gram Stain', testCode: 'GRAM', title: 'Gram Stain', 
        html: '<div class="field-group full-width"><label class="field-label">Source of Specimen</label><input type="text" data-key="Source" class="form-input"></div>' 
    }
};
// ==========================================

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
function customConfirm(message, callback) { document.getElementById('custom-confirm-msg').innerText = message; document.getElementById('custom-confirm').style.display = 'flex'; confirmActionCallback = callback; }
function closeCustomConfirm(isConfirmed) { document.getElementById('custom-confirm').style.display = 'none'; if (isConfirmed && confirmActionCallback) confirmActionCallback(); confirmActionCallback = null; }
window.alert = function(message) { showAppAlert("Notice", message, "info"); };

async function apiGet(action, params = {}) { let url = new URL(SCRIPT_URL); url.searchParams.append('action', action); for (let key in params) if (params[key] !== undefined) url.searchParams.append(key, params[key]); const res = await fetch(url); return await res.json(); }
async function apiPost(action, payload) { const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, ...payload }) }); return await res.json(); }

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (localStorage.getItem('mho-theme') === 'dark') document.body.classList.add('dark-mode');
        const isLimited = localStorage.getItem('mho-limited-mode') === 'true';
        const toggleLimit = document.getElementById('toggle-limited-mode');
        if(toggleLimit) toggleLimit.checked = isLimited;
        applyLimitedMode(isLimited);

        const savedUser = localStorage.getItem('labUser');
        
        // 🟢 FIX: KAPAG WALANG NAKA-LOG IN, DAPAT IPALABAS ANG LOGIN SCREEN 🟢
        if (!savedUser || savedUser === "null") {
            document.getElementById('login-overlay').style.display = 'flex';
            document.getElementById('app-loader').style.display = 'none';
            return; // 🛑 Hihinto na rito ang code para makapag-type yung tao
        }

        currentUser = JSON.parse(savedUser);
        if (!currentUser.username) throw new Error("Invalid");
        
        // 🟢 KAPAG MAY NAKA-LOG IN NA, ITAGO ANG LOGIN SCREEN 🟢
        document.getElementById('login-overlay').style.display = 'none';
        
        const dName = document.getElementById('display-full-name');
        if(dName) dName.innerText = currentUser.fullName || currentUser.username;
        
        const dRole = document.getElementById('display-role-facility');
        if(dRole) dRole.innerText = `${currentUser.role} | ${currentUser.facility}`;
        
        const dAvatar = document.getElementById('pill-avatar');
        if(dAvatar) dAvatar.innerHTML = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();
        
        applyPermissions(); 
        const r = String(currentUser.role).toUpperCase().replace(/\s+/g, '_');
        
        if(r === 'PATIENT') { showPage('patient'); loadPatientResults(); }
        else if(r === 'NTP_CHECKER' || r === 'DOH_TB' || r === 'VIEWER') { showPage('registry'); }
        else { 
            showPage('workspace'); 
            if (r === 'ADMIN' || r === 'STAFF' || r === 'ENCODER') {
                setTimeout(() => {
                    loadSettingsData().then(() => loadPatientCache());
                }, 1500);
            }
        }
    } catch (e) { 
        // 🟢 FALLBACK: KUNG NAGKA-ERROR SA PAGBASA NG LOCAL STORAGE, BALIK SA LOGIN
        localStorage.removeItem('labUser'); 
        document.getElementById('login-overlay').style.display = 'flex'; 
    } finally { 
        document.getElementById('app-loader').style.display = 'none'; 
    }
});

function toggleLimitedMode() { const isChecked = document.getElementById('toggle-limited-mode').checked; localStorage.setItem('mho-limited-mode', isChecked); applyLimitedMode(isChecked); }
function applyLimitedMode(isLimited) {
    const hiddenTests = ['btn-viral', 'btn-hema', 'btn-chem', 'btn-uria', 'btn-feca']; const hiddenRegistries = ['GXVL', 'HEMA', 'CHEM', 'UA', 'FA'];
    hiddenTests.forEach(id => { const btn = document.getElementById(id); if(btn) { if(isLimited) btn.classList.add('disabled-test'); else btn.classList.remove('disabled-test'); } });
    document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const onclickAttr = card.getAttribute('onclick'); if(onclickAttr) { let isHidden = hiddenRegistries.some(r => onclickAttr.includes(r)); if(isLimited && isHidden) card.classList.add('disabled-test'); else card.classList.remove('disabled-test'); } });
}
function toggleFab() { 
    const menu = document.getElementById('fab-menu'); 
    const icon = document.getElementById('fab-main-icon'); 
    if (menu.classList.contains('show')) { 
        menu.classList.remove('show'); 
        // Kapag naka-hide: Left Arrow
        icon.classList.remove('ph-caret-right'); 
        icon.classList.add('ph-caret-left'); 
    } else { 
        menu.classList.add('show'); 
        // Kapag naka-open: Right Arrow para i-close
        icon.classList.remove('ph-caret-left'); 
        icon.classList.add('ph-caret-right'); 
    } 
}
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const icon = document.getElementById('fab-theme-icon'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('mho-theme', 'dark'); if(icon) icon.classList.replace('ph-moon-stars', 'ph-sun'); } else { localStorage.setItem('mho-theme', 'light'); if(icon) icon.classList.replace('ph-sun', 'ph-moon-stars'); } }

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
    } catch (e) { showAppAlert("Error", "Server Error.", "error"); } finally { btn.innerHTML = 'Log In'; btn.disabled = false; }
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
    
    try { 
        const res = await apiPost("resendPatientPassword", { email: email }); 
        if (res.status === "success" && res.data.includes("Success")) { 
            showAppAlert("Success", "Password sent to your email.", "success"); 
            backToLoginFromPatient(); 
        } else { 
            // Ipapalabas natin ung ginawa nating error message kung not recorded
            showAppAlert("Notice", res.message, "error"); 
        } 
    } catch(e) { 
        showAppAlert("Error", "Unable to connect to the server.", "error"); 
    } finally { 
        btn.innerHTML = oldText; btn.disabled = false; 
    } 
}
function logoutUser() { const modal = document.getElementById('logout-modal'); if (modal) modal.style.display = 'flex'; const menu = document.getElementById('fab-menu'); if (menu && menu.classList.contains('show')) toggleFab(); }
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
    document.querySelectorAll('.fab-btn').forEach(item => { item.style.background = ''; item.style.color = ''; if (item.id === 'fab-nav-' + targetId) { item.style.background = 'var(--pri)'; item.style.color = 'white'; } });
    if (targetId === 'workspace' && (role === 'ADMIN' || role === 'STAFF' || role === 'ENCODER' || role === 'VIEWER')) loadPendingData();
    if (targetId === 'settings' && typeof loadSettingsData === 'function') loadSettingsData();
}

// ==========================================
// 🔴 REPLACE APPLYPERMISSIONS FUNCTION 🔴
// ==========================================

function applyPermissions() {
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
    
    // 🟢 BAGONG FAB MENU IDs
    const navWork = document.getElementById('fab-nav-workspace'); 
    const navReg = document.getElementById('fab-nav-registry'); 
    const navRep = document.getElementById('fab-nav-reports'); 
    const navSet = document.getElementById('fab-nav-settings');
    const colEntry = document.getElementById('col-entry'); 
    const colPending = document.getElementById('col-pending'); 
    const colCompleted = document.getElementById('col-completed'); 
    const colRepeat = document.getElementById('col-repeat');
    
    // Tago lahat muna by default bago i-filter
    if(navWork) navWork.style.display = 'none'; if(navReg) navReg.style.display = 'none'; if(navRep) navRep.style.display = 'none'; if(navSet) navSet.style.display = 'none';
    if(colEntry) colEntry.style.display = 'none'; if(colPending) colPending.style.display = 'none'; if(colCompleted) colCompleted.style.display = 'none'; if(colRepeat) colRepeat.style.display = 'none';

    if (role === 'PATIENT') { 
        const fabMain = document.getElementById('fab-main-btn'); 
        if(fabMain) fabMain.style.display = 'none'; // Wag ipakita ang circle menu sa patient
    }
    else if (role === 'ADMIN' || role === 'STAFF') {
        // LAB PERSONNEL - ALL ACCESS
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex'; if(navRep) navRep.style.display = 'flex';
        if(role === 'ADMIN' && navSet) navSet.style.display = 'flex'; 
        if(colEntry) colEntry.style.display = 'flex'; if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
    } 
    else if (role === 'ENCODER') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex';
        if(colEntry) colEntry.style.display = 'flex'; if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
    } 
    else if (role === 'VIEWER') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex';
        if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
    } 
    else if (role === 'NTP_CHECKER' || role === 'DOH_TB') {
        if(navReg) navReg.style.display = 'flex'; if(navRep) navRep.style.display = 'flex'; 
        
        // 🟢 RESTRICTION: Tago lahat maliban sa GXP, DSSM (At Serology para sa NTP Checker)
        document.querySelectorAll('#registry-tabs .reg-tab-btn').forEach(card => { 
            const attr = card.getAttribute('onclick') || ''; 
            if (role === 'NTP_CHECKER') {
                if (!attr.includes('GXP') && !attr.includes('DSSM') && !attr.includes('SERO')) {
                    card.style.display = 'none'; 
                }
            } else { // DOH_TB
                if (!attr.includes('GXP') && !attr.includes('DSSM')) {
                    card.style.display = 'none'; 
                }
            }
        });
        
        if(role === 'NTP_CHECKER') { 
            document.querySelectorAll('.chip-group .chip').forEach(chip => { 
                if (chip.getAttribute('onclick') && !chip.getAttribute('onclick').includes('tb')) chip.style.display = 'none'; 
            }); 
            if(typeof switchTab === 'function') switchTab('tb'); 
        }
    }

    // 🟢 VIRAL LOAD STRICTLY ADMIN ONLY 🟢
    // Kapag hindi ADMIN, itatago lang ang GXVL. Ang SERO ay bukas na sa Staff/Viewer/NTP!
    if (role !== 'ADMIN') {
        document.querySelectorAll('#registry-tabs .reg-tab-btn').forEach(card => { 
            const attr = card.getAttribute('onclick') || '';
            if(attr.includes('GXVL')) {
                card.style.display = 'none'; 
            }
        });
        
        const btnViral = document.getElementById('btn-viral');
        if(btnViral) btnViral.style.display = 'none';
    }

    // 🟢 WORKSPACE RESTRICTION (SEROLOGY ENTRY) 🟢
    // Ang makakapag-request at makakapag-encode lang ng Serology sa Workspace ay ADMIN at STAFF.
    if (role !== 'ADMIN' && role !== 'STAFF') {
        const btnSero = document.getElementById('btn-sero');
        if(btnSero) btnSero.style.display = 'none';
    }
}

// ==========================================
// 🔴 REPLACE THESE 4 FUNCTIONS IN APP.JS 🔴
// ==========================================

function openTestDetails(id) { 
    const config = availableTests[id]; 
    if (!config) return; 
    
    document.getElementById('test-buttons-container').style.display = 'none'; 
    const area = document.getElementById('test-details-area'); 
    area.style.display = 'block'; 
    
    // 🟢 FIXED: Added type="button", event.preventDefault(), and z-index: 99999 so it never gets blocked by the footer
    area.innerHTML = `
        <div style="font-weight: 700; color: var(--pri); margin-bottom: 8px;">
            <i class="ph ph-info"></i> ${config.title}
        </div>
        <div class="form-grid grid-1">${config.html}</div>
        <div style="margin-top:20px; display:flex; gap:10px; position:relative; z-index:99999; padding-bottom:15px;">
            <button type="button" class="btn btn-secondary" style="flex:1; cursor:pointer;" onclick="event.preventDefault(); cancelDetail()">Cancel</button>
            <button type="button" class="btn btn-primary" style="flex:1; cursor:pointer;" onclick="event.preventDefault(); confirmDetail('${id}')">Confirm</button>
        </div>
    `; 
}

function toggleSub(btn) { 
    btn.classList.toggle('active'); 
}

function cancelDetail() { 
    document.getElementById('test-details-area').style.display = 'none'; 
    document.getElementById('test-details-area').innerHTML = ''; // Clean up memory
    document.getElementById('test-buttons-container').style.display = ''; // Reverts to CSS default layout
}

function confirmDetail(id) { 
    let details = {}; 
    let subSelected = []; 
    
    document.querySelectorAll('#test-details-area [data-key]').forEach(el => { 
        details[el.getAttribute('data-key')] = el.value; 
    }); 
    
    if (id === 'dengue') { 
        if (document.getElementById('dn_duo_check') && document.getElementById('dn_duo_check').checked) {
            subSelected.push('Dengue Duo'); 
        }
    } else if (['sero', 'hema', 'chem'].includes(id)) { 
        const activeBtns = document.querySelectorAll('#test-details-area .chip.active'); 
        if (activeBtns.length === 0) { 
            showAppAlert("Required", "Select at least one test.", "error"); 
            return; 
        } 
        subSelected = Array.from(activeBtns).map(b => b.getAttribute('data-val')); 
    } 
    
    labOrders[id] = { details: details, subTests: subSelected }; 
    const targetBtn = document.getElementById('btn-' + id);
    if(targetBtn) targetBtn.classList.add('active'); 
    
    updateSummary(); 
    cancelDetail(); 
}

// ==========================================
function toggleSimple(id) { const btn = document.getElementById('btn-'+id); if(labOrders[id]) { delete labOrders[id]; btn.classList.remove('active'); } else { labOrders[id] = { details: {}, subTests: [] }; btn.classList.add('active'); } updateSummary(); }
function updateSummary() { const container = document.getElementById('order-summary'); container.innerHTML = ''; Object.keys(labOrders).forEach(key => { let label = availableTests[key].testName; if(labOrders[key].subTests && labOrders[key].subTests.length > 0) label += `: ${labOrders[key].subTests.join(', ')}`; container.innerHTML += `<div class="badge badge-warning" style="cursor:pointer;" onclick="removeOrder('${key}')">${label} &times;</div>`; }); }
function removeOrder(key) { delete labOrders[key]; document.getElementById('btn-'+key).classList.remove('active'); updateSummary(); }
function setSelectValue(id, val) { const el = document.getElementById(id); if (!el || !val) return; const searchVal = String(val).toUpperCase().trim(); for (let i = 0; i < el.options.length; i++) { if (el.options[i].value.toUpperCase().trim() === searchVal || el.options[i].text.toUpperCase().trim() === searchVal) { el.selectedIndex = i; return; } } }
function calculateAge() { const dob = new Date(document.getElementById('p_bday').value); const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--; document.getElementById('p_age').value = age; }
function generateSmartID() { if(isExistingPatient) return; const bday = document.getElementById('p_bday').value.replace(/-/g, "") || "00000000"; const name = document.getElementById('p_name').value.trim().toUpperCase(); let initials = "XX"; if(name) { const p = name.split(" "); initials = p.length > 1 ? p[0][0] + p[p.length-1][0] : name.substring(0,2); } document.getElementById('finalPatientId').value = `MHOA-${bday}-${initials}${Math.floor(Math.random()*90+10)}`; }

// ==========================================
// 🟢 BAGO: INSTANT SEARCH FUNCTIONS (LOCAL CACHE)
// ==========================================

async function loadPatientCache() {
    try {
        const res = await apiGet("getAllPatientsLight");
        if (res.status === "success") {
            cachedPatients = res.data;
            console.log("⚡ Instant Search Ready: Loaded " + cachedPatients.length + " patients locally.");
        }
    } catch(e) { console.error("Failed to load patient cache"); }
}

function runDirectSearch(q) {
    const box = document.getElementById('direct-results-box'); 
    const stat = document.getElementById('search-status');
    
    if(q.length < 2) { box.style.display='none'; return; }
    
    // ⚡ INSTANT LOCAL SEARCH (Wala nang 'await' o 'setTimeout')
    const query = q.toLowerCase();
    const results = cachedPatients.filter(p => p.name.toLowerCase().includes(query)).slice(0, 8);
    
    if (results.length > 0) {
        box.style.display = 'block'; 
        box.innerHTML = `<div style="text-align:right; padding:6px; background:var(--bg-subtle); border-bottom:1px dashed var(--border-color);"><button type="button" class="btn btn-secondary text-xs" style="padding:4px 8px;" onclick="document.getElementById('direct-results-box').style.display='none'"><i class="ph ph-x"></i> Hide / New Patient</button></div>`;
        
        results.forEach(p => {
            const div = document.createElement('div'); div.className = "search-item";
            div.innerHTML = `<div style="font-weight:600;">${p.name} <span class="badge badge-success" style="margin-left:4px;">Returning</span></div><div style="font-size:0.7rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility || p.Facility || 'No Facility'}</div>`;
            
            div.onclick = () => {
                isExistingPatient = true; 
                document.getElementById('finalPatientId').value = p.id; 
                document.getElementById('p_name').value = p.name || ""; 
                document.getElementById('p_age').value = p.age || ""; 
                document.getElementById('p_address').value = p.address || ""; 
                document.getElementById('p_contact').value = p.contact || ""; 
                if(document.getElementById('p_email')) document.getElementById('p_email').value = p.email || "";
                
                setSelectValue('p_sex', p.sex); 
                setSelectValue('p_facility', p.facility || p.Facility);
                
                if (p.bday) { 
                    try { 
                        const d = new Date(p.bday); 
                        document.getElementById('p_bday').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; 
                    } catch(e){} 
                }
                
                box.style.display = 'none'; 
                document.getElementById('new-entry-header').style.display = 'none'; 
                document.getElementById('profile-header').style.display = 'flex';
                fetchHistory(p.id, 'history-section', 'history-list'); 
            }; 
            box.appendChild(div);
        });
    } else { 
        box.style.display = 'none'; 
    }
}

function runQuickSearch(q) {
    const box = document.getElementById('quick-search-results'); 
    if(q.length < 2) { box.style.display='none'; return; }
    
    // ⚡ INSTANT LOCAL SEARCH
    const query = q.toLowerCase();
    const results = cachedPatients.filter(p => p.name.toLowerCase().includes(query)).slice(0, 15);
    
    if (results.length > 0) {
        box.style.display = 'block'; box.innerHTML = '';
        results.forEach(p => {
            const div = document.createElement('div'); div.className = "search-item";
            div.innerHTML = `<div style="font-weight:600;">${p.name}</div><div style="font-size:0.75rem; color:var(--text-muted);">${p.age}y | ${p.sex} | ${p.facility || 'No Facility'}</div>`;
            div.onclick = () => { viewQuickProfile(p); box.style.display = 'none'; }; 
            box.appendChild(div);
        });
    } else { 
        box.style.display = 'none'; 
    }
}

function openQuickSearch() { document.getElementById('quick-search-modal').style.display='flex'; const input = document.getElementById('quick-search-input'); input.value = ''; document.getElementById('quick-search-results').style.display = 'none'; document.getElementById('quick-profile-view').style.display = 'none'; input.focus(); }

async function viewQuickProfile(p) {
    currentQuickPatient = p; 
    document.getElementById('quick-profile-view').style.display = 'flex'; 
    document.getElementById('quick-profile-view').style.flexDirection = 'column';
    document.getElementById('qs-name').innerText = p.name; 
    document.getElementById('qs-meta').innerHTML = `<span><i class="ph ph-fingerprint"></i> ${p.id}</span> <span><i class="ph ph-calendar"></i> ${p.age} yrs</span> <span><i class="ph ph-gender-intersex"></i> ${p.sex}</span> <span><i class="ph ph-buildings"></i> ${p.facility || 'N/A'}</span>`;
    
    // Tatawagin ang normal na history fetcher
    fetchHistory(p.id, null, 'qs-history-list', true, false); 
    
    // 🟢 BAGO: TOTAL INVISIBILITY PARA SA VIRAL LOAD KUNG HINDI ADMIN 🟢
    if (String(currentUser.role).toUpperCase() !== 'ADMIN') {
        const qsList = document.getElementById('qs-history-list');
        
        // Susubaybayan natin ang box, kapag may pumasok na "VIRAL LOAD", BUBURAHIN agad natin!
        const observer = new MutationObserver(() => {
            const cards = qsList.querySelectorAll('.history-card');
            cards.forEach(card => {
                const content = card.innerText.toUpperCase();
                // Kung mabasa ng system na may GXVL o Viral Load, ide-delete niya yung buong element bago pa makita.
                if (content.includes('VIRAL LOAD') || content.includes('GXVL') || content.includes('HIV-1')) {
                    card.remove(); 
                }
            });
        });
        observer.observe(qsList, { childList: true, subtree: true });
    }
}

function editPatientDemographicsQS() { if(!currentQuickPatient) return; document.getElementById('qs-edit-form').style.display = 'block'; document.getElementById('qs_edit_name').value = currentQuickPatient.name; document.getElementById('qs_edit_age').value = currentQuickPatient.age; document.getElementById('qs_edit_fac').value = currentQuickPatient.facility || currentQuickPatient.Facility; }
function savePatientDemographicsQS() { showAppAlert("Feature Offline", "Demographics update requires backend linkage.", "info"); document.getElementById('qs-edit-form').style.display = 'none'; }

async function loadPatientResults() {
    const histContainer = document.getElementById('my-portal-history'); if(histContainer) histContainer.innerHTML = '<div style="text-align:center;"><i class="ph ph-spinner ph-spin"></i> Retrieving your records...</div>';
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
                
                // MAY DINAGDAG NA DOWNLOAD PDF BUTTON PARA SA PATIENT PORTAL
                let printBtnHtml = (isQuickSearch || isPatientPortal) ? `
                    <button class="btn-icon" onclick="printDirect(event, '${testCodeForPrint}', '${h.test}')" title="Print this Result" style="color:var(--success);"><i class="ph ph-printer"></i></button>
                    <button class="btn-icon" onclick="downloadDirect(event, '${testCodeForPrint}', '${h.test}')" title="Download PDF" style="color:var(--pri); margin-left: 5px;"><i class="ph ph-download-simple"></i></button>
                ` : '';
                
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
  if(!document.getElementById('p_name').value || Object.keys(labOrders).length === 0) { 
      showAppAlert("Missing Info", "Please fill in Name and select a test.", "error"); 
      return; 
  }
  const originalText = btn.innerHTML; 
  btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; 
  btn.disabled = true;

  const pEmailEl = document.getElementById('p_email');
  const pEmail = pEmailEl ? pEmailEl.value.trim().toLowerCase() : "";
  const generatedPassword = pEmail ? Math.random().toString(36).slice(-8).toUpperCase() : "";

  let finalTestsArray = []; 
  const pAge = document.getElementById('p_age').value || ""; 
  const pSex = document.getElementById('p_sex').value || ""; 
  const pFacility = document.getElementById('p_facility').value || "";
  
  Object.keys(labOrders).forEach(key => { 
      const entry = { 
          name: availableTests[key].testName, 
          code: availableTests[key].testCode, 
          details: { 
              ...labOrders[key].details, 
              age: pAge, sex: pSex, facility: pFacility, 
              address: document.getElementById('p_address').value, 
              contact: document.getElementById('p_contact').value, 
              bday: document.getElementById('p_bday').value 
          } 
      }; 
      if(labOrders[key].subTests && labOrders[key].subTests.length > 0) {
          entry.details["Requested Tests"] = labOrders[key].subTests.join(', '); 
      }
      finalTestsArray.push(entry); 
  });

  const formData = { 
      patientId: document.getElementById('finalPatientId').value, 
      fullName: document.getElementById('p_name').value, 
      bday: document.getElementById('p_bday').value, 
      sex: pSex, age: pAge, 
      address: document.getElementById('p_address').value, 
      contact: document.getElementById('p_contact').value, 
      email: pEmail, 
      patientPassword: generatedPassword, 
      facility: pFacility, 
      encoderFullName: currentUser.fullName || currentUser.username, 
      encoder: currentUser.username, 
      testsData: JSON.stringify(finalTestsArray) 
  };

  try {
      const res = await apiPost("submitForm", { formObject: formData });
      if (res.status === "success") { 
          btn.style.background = "var(--success)"; 
          btn.innerHTML = '<i class="ph ph-check"></i> Saved'; 
          clearForm(); 
          await loadPendingData(); 
          
          // 🟢 FIX: Gumamit ng optional chaining (?. ) para kapag undefined, aayos ang fallback
          const savedEmail = res.data?.email || pEmail;
          const savedPass = res.data?.generatedPassword || generatedPassword;
          const debugLog = res.data?.log || "No log available.";
          
          // 🟢 FIX: Hanapin ang exact phrase na ibinabato ng backend log natin
          if (debugLog.includes("Email Notification Sent")) {
              showAppAlert("Patient Portal Created", `Credentials automatically emailed!\n\nEmail: ${savedEmail}\nPassword: ${savedPass}\n\nSystem Log: ${debugLog}`, "success");
          } else {
              showAppAlert("Record Saved", `Record saved successfully.\n\nSystem Log: ${debugLog}`, "info");
          }
          
          setTimeout(() => { btn.disabled = false; btn.innerHTML = originalText; btn.style.background = ""; }, 4000); 
      } else { throw new Error("Server rejected the save."); }
  } catch (err) { 
      showAppAlert("Error", String(err), "error"); 
      btn.disabled = false; btn.innerHTML = originalText; 
  }
}
function editPendingFull(id) {
    const item = window.pendingData.find(i => String(i.id) === String(id).trim()); 
    if(!item) return;
    
    editingPendingId = item.id; 
    isExistingPatient = true; 
    
    document.getElementById('col-entry').classList.add('edit-mode-pane'); 
    const header = document.getElementById('entry-main-header');
    if (header) {
        header.classList.add('edit-mode-header'); 
        header.innerHTML = `<h2><i class="ph ph-pencil-simple"></i> Editing Pending Record</h2><button class="btn-icon" onclick="cancelEditPending()" style="color:white;"><i class="ph ph-x"></i></button>`;
    }
    
    const pIdEl = document.getElementById('finalPatientId'); if (pIdEl) pIdEl.value = item.patientId || "";
    const pNameEl = document.getElementById('p_name'); if (pNameEl) pNameEl.value = item.name || "";
    
    let d = {}; 
    try { d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; } catch(e){}
    
    const pAgeEl = document.getElementById('p_age'); if(pAgeEl) pAgeEl.value = d.age || d.Age || ""; 
    const pAddressEl = document.getElementById('p_address'); if(pAddressEl) pAddressEl.value = d.address || d.Address || ""; 
    const pContactEl = document.getElementById('p_contact'); if(pContactEl) pContactEl.value = d.contact || d.Contact || "";
    const pEmailEl = document.getElementById('p_email'); if(pEmailEl) pEmailEl.value = d.email || d.Email || "";
    
    if (typeof setSelectValue === 'function') {
        setSelectValue('p_sex', d.sex || d.Sex); 
        setSelectValue('p_facility', d.facility || d.Facility);
    }
    
    // 🟢 ITO ANG FIX SA "SYNTAX ERROR": SAFE DATE PARSER
    const bdayVal = d.bday || d.Bday;
    if(bdayVal) { 
        try { 
            const bd = new Date(bdayVal); 
            if (!isNaN(bd.getTime())) { // I-che-check muna kung valid ang date bago ipasok
                const pBdayEl = document.getElementById('p_bday');
                if (pBdayEl) pBdayEl.value = `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}`; 
            }
        } catch(e){} 
    }
    
    const newEntryH = document.getElementById('new-entry-header'); if(newEntryH) newEntryH.style.display = 'none'; 
    const profileH = document.getElementById('profile-header'); if(profileH) profileH.style.display = 'flex';
    
    if (typeof fetchHistory === 'function') fetchHistory(item.patientId, 'history-section', 'history-list'); 
    
    const btnCont = document.getElementById('test-buttons-container'); if(btnCont) btnCont.style.display = 'none'; 
    
    const area = document.getElementById('test-details-area'); 
    if (area) {
        area.style.display = 'block';
        let testKey = Object.keys(availableTests).find(k => availableTests[k].testName.toUpperCase() === item.test.toUpperCase() || availableTests[k].testCode.toUpperCase() === item.test.toUpperCase());
        let dynamicHtml = testKey ? availableTests[testKey].html : `<textarea class="form-input" style="min-height:100px;">${JSON.stringify(d,null,2)}</textarea>`;
        
        area.innerHTML = `<div style="font-weight: 700; color: var(--pri); margin-bottom: 8px;"><i class="ph ph-info"></i> Updating Details for ${item.test}</div><div id="temp-form-data" class="form-grid">${dynamicHtml}</div><div style="margin-top:12px; display:flex; gap:8px;"><button class="btn btn-secondary" style="flex:1;" onclick="cancelEditPending()">Cancel Edit</button></div>`;
        
        setTimeout(() => { 
            document.querySelectorAll('#test-details-area [data-key]').forEach(el => { 
                let val = d[el.getAttribute('data-key')]; 
                if(val) el.value = val; 
            }); 
        }, 100);
    }
    
    const saveBtn = document.getElementById('save-btn-action'); 
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Update Pending Record'; 
        saveBtn.onclick = submitPendingUpdate; 
        saveBtn.style.background = 'var(--warning)'; 
        saveBtn.style.color = 'white';
    }
}
function cancelEditPending() { clearForm(); } 
async function submitPendingUpdate() {
    if(!editingPendingId) return; 
    const item = window.pendingData.find(i => String(i.id) === String(editingPendingId).trim());
    if(!item) return;

    const btn = document.getElementById('save-btn-action'); 
    const oldTxt = btn ? btn.innerHTML : 'Update'; 
    if (btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Updating...'; btn.disabled = true; }
    
    try {
        let newDetails = {}; 
        document.querySelectorAll('#test-details-area [data-key]').forEach(el => { 
            newDetails[el.getAttribute('data-key')] = el.value; 
        });
        
        // 🟢 KUNIN ANG MGA DEMOGRAPHICS (Kasama na ang email at brgy para sa Masterlist sync)
        const pEmailEl = document.getElementById('p_email');
        let demogUpdates = {
            age: document.getElementById('p_age') ? document.getElementById('p_age').value : "",
            sex: document.getElementById('p_sex') ? document.getElementById('p_sex').value : "",
            address: document.getElementById('p_address') ? document.getElementById('p_address').value : "",
            contact: document.getElementById('p_contact') ? document.getElementById('p_contact').value : "",
            facility: document.getElementById('p_facility') ? document.getElementById('p_facility').value : "",
            email: pEmailEl ? pEmailEl.value.trim().toLowerCase() : ""
        };
        const pBdayEl = document.getElementById('p_bday');
        if(pBdayEl && pBdayEl.value) demogUpdates.bday = pBdayEl.value;

        let oldD = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; 
        let finalJsonStr = JSON.stringify({...oldD, ...newDetails, ...demogUpdates}); 
        const pNameEl = document.getElementById('p_name');
        
        // Ipapadala sa backend
        const res = await apiPost("updatePatientAndTestDetails", { 
            testId: editingPendingId, 
            patientId: item.patientId, 
            newName: pNameEl ? pNameEl.value : item.name, 
            newTestType: item.test, 
            newJsonDetails: finalJsonStr 
        }); 
        
        cancelEditPending(); 
        if (typeof loadPendingData === 'function') await loadPendingData(); 
        
        if (res.data && res.data.includes("Email Notification Sent")) {
            showAppAlert("Success", "Record updated and login credentials automatically emailed!", "success");
        } else {
            showAppAlert("Success", "Record updated successfully!", "success");
        }
    } catch(e) { 
        showAppAlert("Error", String(e), "error"); 
    } finally { 
        if (btn) { btn.innerHTML = oldTxt; btn.disabled = false; }
    }
}
// ==========================================
// 100% FIXED DATA LOADER (SUPER SPEED VIA POST)
// ==========================================
async function loadPendingData() {
    const refIcon = document.getElementById('refresh-icon');
    if (refIcon) refIcon.classList.add('ph-spin');
    
    // ⚡ SPEED FIX 1: I-load agad ang huling nakita (Cache)
    const cachedWorkspace = sessionStorage.getItem('workspaceCache_' + currentUser.username);
    if (cachedWorkspace && window.pendingData.length === 0) {
        try {
            const parsed = JSON.parse(cachedWorkspace);
            window.pendingData = parsed.pending || [];
            window.completedData = parsed.encoded || [];
            renderLists(); // Papalabas agad sa screen in 0.01 seconds
        } catch(e) {}
    }
    
    try {
        // ⚡ SPEED FIX 2: GUMAWA NG API POST SA HALIP NA GET (Mas mabilis sa Google Server!)
        let res = await apiPost("getPendingWorkload", { 
            facility: currentUser.facility, 
            role: currentUser.role
        }); 

        if (res && (res.pending || res.encoded)) {
            window.pendingData = res.pending || [];
            window.completedData = res.encoded || []; 
            
            // I-save sa background memory para instant sa susunod
            sessionStorage.setItem('workspaceCache_' + currentUser.username, JSON.stringify({
                pending: window.pendingData,
                encoded: window.completedData
            }));

            // Tahimik na i-update ang listahan
            renderLists();
        }
    } catch(e) { 
        console.error("Refresh Error:", e); 
    } finally { 
        if (refIcon) refIcon.classList.remove('ph-spin'); 
    }
}

function renderLists() {
    const pList = document.getElementById('list-pending'); 
    const cList = document.getElementById('list-completed'); 
    const rList = document.getElementById('list-repeat');
    const filterSelect = document.getElementById('test-filter');
    
    if (!pList || !cList) return;

    window.pendingData = window.pendingData || [];
    window.completedData = window.completedData || [];
    
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
    const isViewer = (role === 'VIEWER');
    const isEncoder = (role === 'ENCODER');
    const isLimited = localStorage.getItem('mho-limited-mode') === 'true';
    const allowedTests = ['GXP', 'DSSM', 'GRAM', 'DENGUE', 'SERO'];

    const uniqueTests = [...new Set(window.pendingData.map(item => String(item.test || "").toUpperCase()))];
    const currentVal = filterSelect ? filterSelect.value : 'ALL';
    let dropHtml = '<option value="ALL">All Sections</option>';
    uniqueTests.forEach(t => { 
        let tCode = getTestCodeFromName(t); 
        if(!isLimited || allowedTests.includes(tCode)) { dropHtml += `<option value="${t}">${t}</option>`; } 
    });
    if(filterSelect) { filterSelect.innerHTML = dropHtml; filterSelect.value = currentVal; }

    const filterFn = (item) => {
        let t = String(item.test || "").toUpperCase(); 
        let filterVal = filterSelect ? filterSelect.value : "ALL"; 
        let tCode = getTestCodeFromName(t);
        if(isLimited && !allowedTests.includes(tCode)) return false; 
        let typeMatch = (filterVal === "ALL") || t.includes(filterVal);
        return typeMatch;
    };

    // --- 1. FILTER DATA & RESET COMPLETED DAILY ---
    const fPending = window.pendingData.filter(i => filterFn(i)); 

    // 🟢 FIX 1: I-SORT ANG PENDING (LATEST DATE SA TAAS, PERO SEQUENCE 1,2,3 PABABA)
    fPending.sort((a, b) => {
        let dateA = new Date(a.date); dateA.setHours(0,0,0,0); // Tanggalin ang oras para pure date lang
        let dateB = new Date(b.date); dateB.setHours(0,0,0,0);
        
        // Paghiwalayin by Date (Latest na araw ang nasa itaas)
        if (dateB.getTime() !== dateA.getTime()) {
            return dateB.getTime() - dateA.getTime();
        }
        // Kung pareho ng araw, i-sort by Lab Number / Sequence pababa (001, 002, 003)
        return String(a.id || "").localeCompare(String(b.id || ""), undefined, { numeric: true });
    });

    const fComp = window.completedData.filter(i => {
        let encodedDateStr = TODAY_STR; 
        try {
            let d = typeof i.details === 'string' ? JSON.parse(i.details) : (i.details || {});
            // 🟢 FIX 2: Basahin ang 'dateEncoded' imbes na 'Date Received' para lumabas agad ngayon
            if (d.dateEncoded) {
                encodedDateStr = new Date(d.dateEncoded).toLocaleDateString();
            } else if (i.date) {
                encodedDateStr = new Date(i.date).toLocaleDateString();
            }
        } catch(e) {
            if (i.date) encodedDateStr = new Date(i.date).toLocaleDateString();
        }
        
        return filterFn(i) && (encodedDateStr === TODAY_STR);
    });

    // --- 2. LOGIC PARA SA FOR REPEAT LIST ---
    const fRepeat = [];
    let latestCompleted = {};
    window.completedData.forEach(item => { 
        let key = item.patientId + "_" + String(item.test || "").toUpperCase(); 
        if(!latestCompleted[key]) latestCompleted[key] = item; 
    });

    Object.values(latestCompleted).forEach(item => {
        try {
            const status = String(item.status || "").toUpperCase();
            let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
            let rpt = d.Repeat || d["Test Type"] || "";
            let resCode = d.ResultCode || d.Diagnosis || d.Result || "";
            
            const isRepeatStatus = (status === "FOR REPEAT");
            const isInitialInDetails = (String(rpt).toUpperCase() === 'INITIAL' || String(resCode).toUpperCase().includes("INITIAL"));

            if (isRepeatStatus || isInitialInDetails) {
                let isAlreadyPending = window.pendingData.some(p => p.patientId === item.patientId && String(p.test || "").toUpperCase() === String(item.test || "").toUpperCase());
                let typeMatch = !filterSelect || filterSelect.value === "ALL" || String(item.test || "").toUpperCase().includes(filterSelect.value);
                if(!isAlreadyPending && typeMatch) fRepeat.push(item); 
            }
        } catch(e) {}
    });

    // --- 3. BATCH ACTIONS HEADER ---
    let batchActionsHtml = (role === 'ADMIN' || role === 'STAFF') ? `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:var(--bg-subtle); padding:10px; border-radius:var(--radius-sm); border: 1px dashed var(--border-color);">
        <label style="font-size:0.8rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <input type="checkbox" onchange="document.querySelectorAll('.chk-pending').forEach(c=>c.checked=this.checked)" style="width:16px; height:16px; accent-color:var(--pri);"> Select All
        </label>
        <div style="display:flex; gap:6px;">
            <button class="btn btn-primary text-xs" style="padding:4px 8px;" onclick="batchSaveResults(false)"><i class="ph ph-floppy-disk"></i> Batch Save</button>
            <button class="btn btn-secondary text-xs" style="padding:4px 8px; border-color:var(--pri); color:var(--pri);" onclick="batchSaveResults(true)"><i class="ph ph-printer"></i> Save & Print</button>
        </div>
    </div>` : '';

    // --- 4. RENDER PENDING LIST ---
    const pendingCardsHtml = fPending.map(item => {
        const safeId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, ""); 
        let tCode = getTestCodeFromName(item.test);
        let subTxt = ""; let repeatBadge = ""; 
        try { 
            let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}); 
            if(d.Age) subTxt = `(${d.Age}/${d.Sex})`; 
            let hasInitial = window.completedData.some(c => c.patientId === item.patientId && String(c.test || "").toUpperCase() === String(item.test || "").toUpperCase() && (() => { 
                let cd = typeof c.details === 'string' ? JSON.parse(c.details) : (c.details || {}); 
                return String(cd.Repeat || cd["Test Type"]).toUpperCase() === 'INITIAL' || String(c.status).toUpperCase() === "FOR REPEAT"; 
            })());
            if(hasInitial) repeatBadge = `<span style="background:var(--danger); color:white; padding:3px 6px; border-radius:4px; font-size:0.6rem; font-weight:bold; margin-left:6px;">REPEAT</span>`;
        } catch(e){}
        
        let actionsHtml = '';
        let checkboxHtml = (role === 'ADMIN' || role === 'STAFF') ? `<div style="padding-top:2px;"><input type="checkbox" class="chk-pending" value="${item.id}" style="width:16px; height:16px; accent-color:var(--pri);"></div>` : '';

        if (role === 'ADMIN' || role === 'STAFF' || (isEncoder && item.encoder === currentUser.username)) {
            actionsHtml = `<div style="display:flex; gap:5px;"><button onclick="editPendingFull('${item.id}')" class="btn-icon" title="Edit Full Profile"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Delete this request?', () => deleteEntry('${item.id}'))" class="btn-icon" style="color:var(--danger);" title="Delete"><i class="ph ph-trash"></i></button></div>`;
        }

        let clickAttr = `style="flex-grow:1;"`; 
        let expandAreaHtml = '';
        
        if (role === 'ADMIN' || role === 'STAFF') {
            clickAttr = `onclick="toggleExpand('${safeId}')" style="cursor:pointer; flex-grow:1;"`;
            expandAreaHtml = `<div id="expand-${safeId}" class="pc-expand-area">
                <div style="display:flex; gap:10px; margin-bottom: 16px;">
                    <button class="btn btn-primary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this)"><i class="ph ph-floppy-disk"></i> Save Only</button>
                    <button class="btn btn-secondary" style="flex:1; border-color:var(--pri); color:var(--pri);" onclick="saveAndPrintResult('${item.id}', '${safeId}', this)"><i class="ph ph-printer"></i> Save & Print</button>
                </div>
                <div>${getResultTemplate(tCode, safeId, item)}</div>
            </div>`;
        }
        
        return `<div class="pending-card" id="card-${safeId}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        ${checkboxHtml}
                        <div ${clickAttr}>
                            <div class="pc-name">${item.name} <span style="color:var(--text-muted); font-size:0.7rem;">${subTxt}</span> ${repeatBadge}</div>
                            <div class="pc-meta" style="margin-top: 6px;">
                                <span style="background:var(--bg-subtle); color:var(--sec); padding:2px 6px; border-radius:4px; font-family:monospace; font-weight:bold; border:1px solid var(--border-color); margin-right: 5px;">${item.id}</span>
                                ${item.test} • By: <span style="color:var(--pri);">${item.encoder || 'System'}</span>
                            </div>
                        </div>
                        ${actionsHtml}
                    </div>
                    ${expandAreaHtml}
                </div>`;
    }).join('');
    
    pList.innerHTML = batchActionsHtml + pendingCardsHtml;

    // --- 5. RENDER COMPACT REPEAT LIST ---
    if (rList) {
        rList.innerHTML = fRepeat.map(item => {
            const safeId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, "");
            let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
            let fac = d.facility || d.Facility || "N/A";
            
            return `<div class="pending-card" style="border-left: 3px solid var(--warning); background: var(--warning-light-bg); padding: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div style="flex: 1; overflow: hidden;">
                    <div class="pc-name" style="color: var(--warning); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                    <div class="pc-meta" style="font-size: 0.7rem; color: var(--text-muted);">${fac} | ${item.test}</div>
                </div>
                ${isViewer || isEncoder ? '' : `<button class="btn-icon" id="btn-repeat-${safeId}" style="color:var(--warning); background: transparent; padding: 4px;" onclick="moveToPendingRepeat('${item.id}')" title="Move to Pending"><i class="ph ph-arrow-circle-left" style="font-size: 1.2rem;"></i></button>`}
            </div>`;
        }).join('');
        const cRep = document.getElementById('count-repeat'); if(cRep) cRep.innerText = `(${fRepeat.length})`;
    }

    // --- 6. RENDER COMPLETED LIST ---
    cList.innerHTML = fComp.map(item => {
        let tCodePrint = getTestCodeFromName(item.test);
        let repeatBadge = ""; 
        try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}); let rpt = d.Repeat || d["Test Type"]; if(rpt && String(rpt).toUpperCase() === 'INITIAL') repeatBadge = `<span class="badge badge-warning" style="margin-left:4px; font-size:0.55rem; background:var(--warning); color:white; padding:2px 4px; border-radius:3px;">INITIAL</span>`; } catch(e){}
        return `<div class="completed-card" style="margin-bottom:8px;">
            <div style="overflow:hidden; flex-grow:1;">
                <div class="pc-name">${item.name} ${repeatBadge}</div>
                <div class="pc-meta"><span style="background:var(--bg-subtle); color:var(--text-muted); padding:1px 4px; border-radius:3px; font-family:monospace; margin-right:5px;">${item.id}</span>${item.test}</div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-icon" onclick="printDirect(event, '${item.id}', '${tCodePrint}')" style="color: var(--success);" title="Print"><i class="ph ph-printer"></i></button>
                <button class="btn-icon" onclick="downloadDirect(event, '${item.id}', '${tCodePrint}')" style="color: var(--pri);" title="Download PDF"><i class="ph ph-download-simple"></i></button>
            </div>
        </div>`;
    }).join('');

    const cPend = document.getElementById('count-pending'); if(cPend) cPend.innerText = `(${fPending.length})`;
}



async function moveToPendingRepeat(idStr) {
    const item = window.completedData.find(i => String(i.id) === String(idStr)); if(!item) return;
    const btn = document.getElementById('btn-repeat-' + item.id.replace(/[^a-zA-Z0-9]/g, ""));
    if(btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Moving...'; btn.disabled = true; }

    let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
    let cleanDetails = { age: d.age || d.Age || "", sex: d.sex || d.Sex || "", facility: d.facility || d.Facility || "", address: d.address || d.Address || "", contact: d.contact || d.Contact || "", bday: d.bday || d.Bday || "", "History of Treatment": d["History of Treatment"] || "", "Source of Request": d["Source of Request"] || "", "X-Ray Result": d["X-Ray Result"] || "" };
    
    let tCode = ""; try { tCode = getTestCodeFromName(item.test); } catch(e){}
    const testEntry = { name: item.test, code: tCode, details: cleanDetails };
    const formData = { patientId: item.patientId, fullName: item.name, bday: cleanDetails.bday, sex: cleanDetails.sex, age: cleanDetails.age, address: cleanDetails.address, contact: cleanDetails.contact, email: "", facility: cleanDetails.facility, encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify([testEntry]) };

    try { 
        const res = await apiPost("submitForm", { formObject: formData }); 
        if (res && res.status === "success") { 
            // 🟢 BAGO: BUBURAHIN NA ANG LUMANG "FOR REPEAT" TICKET PARA HINDI NA MAGDOBLE 🟢
            await apiPost("deletePendingTestById", { testId: item.id });
            await loadPendingData(); 
        } else { 
            showAppAlert("Error", res ? res.message : "Error", "error"); 
            if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } 
        } 
    } catch (err) { 
        showAppAlert("Error", "Error moving.", "error"); 
        if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } 
    }
}


function toggleExpand(safeId) { const el = document.getElementById('expand-' + safeId); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
async function deleteEntry(id) { try { await apiPost("deletePendingTestById", { testId: id }); loadPendingData(); } catch(e) {} }

   

// BAGO: DOWNLOAD PDF DIRECTLY


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
     case 'DENGUE': 
    return `<div class="form-grid grid-3">
        ${select('Dengue_Result', 'Dengue NS1', ['', 'Negative', 'Positive'])}
        ${select('Dengue_IgG', 'Dengue IgG', ['', 'Negative', 'Positive'])}
        ${select('Dengue_IgM', 'Dengue IgM', ['', 'Negative', 'Positive'])}
    </div>${rem}`;
     default: return `<div class="form-grid grid-1">${input('Result','Result')}</div>${rem}`;
 }
}

async function openRegistryTab(type, page = 1, forceSearch = null, forceMonth = null, forceCol = null) {
    window.CURRENT_TEST_TYPE = type; 
    currentRegistryPage = page; 
    
    const titleEl = document.getElementById('regTitle');
    if(titleEl) titleEl.innerHTML = `<i class="ph ph-books" style="color:var(--pri);"></i> Laboratory Registry - ${type}`;
    
    // Highlight active tab
    document.querySelectorAll('#registry-tabs .chip').forEach(c => c.classList.remove('active'));
    const activeBtn = document.querySelector(`#registry-tabs .chip[data-tab="${type}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    const cont = document.getElementById('registry-table-content');
    if(!cont) return;
    cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i> Loading registry data...</div>';
    
    try {
        const searchInput = document.getElementById('regSearch');
        const monthInput = document.getElementById('monthFilter');
        const colInput = document.getElementById('colFilter');
        
        // Use the forced values from filterRegistryTable if provided, otherwise check the DOM elements
        const sQuery = forceSearch !== null ? forceSearch : (searchInput ? searchInput.value.trim() : "");
        const mQuery = forceMonth !== null ? forceMonth : (monthInput ? monthInput.value.trim() : "");
        const cQuery = forceCol !== null ? forceCol : ((colInput && colInput.value !== "ALL") ? colInput.options[colInput.selectedIndex].text : "ALL"); 

        const res = await apiGet("getRegistryDataOptimized", {
            type: type, 
            facility: currentUser.facility, 
            role: currentUser.role,
            page: currentRegistryPage,
            limit: registryLimit,
            searchQuery: sQuery,
            monthFilter: mQuery,
            colFilter: cQuery
        });
        
        if (res && res.status === "success" && res.data) {
            const registryData = res.data;
            
            // Safety check kung restricted o walang laman
            if (registryData.error || (registryData.rows && registryData.rows.length > 0 && registryData.rows[0][0] && String(registryData.rows[0][0]).includes("RESTRICTED"))) {
                cont.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger); font-weight:bold;"><i class="ph ph-lock-key" style="font-size:2rem; display:block; margin-bottom:10px;"></i>${registryData.rows ? registryData.rows[0][0] : "Access Restricted."}</div>`;
                return;
            }

            window.CURRENT_REGISTRY_HEADERS = registryData.headers || []; 
            window.CURRENT_REGISTRY_TITLE = registryData.title || type;
            
            const hMap = registryData.headers.map((h, i) => h.includes("{") ? null : { index: i, text: h.replace("Date ","").replace("Patient ",""), original: h }).filter(x=>x);
            
            const colFilter = document.getElementById('colFilter'); 
            if(colFilter) {
                colFilter.innerHTML = '<option value="ALL">All Columns</option>'; 
                hMap.forEach((c, displayIndex) => colFilter.innerHTML += `<option value="${displayIndex}">${c.text}</option>`);
            }

            const rows = registryData.rows || [];
            
            let html = `<table class="data-table"><thead><tr><th style="width:30px; z-index:6;"><input type="checkbox" onclick="document.querySelectorAll('#regTableBody tr:not([style*=\\'display: none\\']) .chk-reg').forEach(c=>c.checked=this.checked); document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></th>`;
            hMap.forEach(c => html += `<th>${c.text}</th>`); 
            html += `</tr></thead><tbody id="regTableBody">`;
            
            rows.forEach((row) => {
                html += `<tr onclick="this.classList.toggle('expanded-row')"><td><input type="checkbox" class="chk-reg" value="${encodeURIComponent(JSON.stringify(row))}" onclick="event.stopPropagation()" onchange="document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></td>`;
                
                let isInitialRow = false;
                hMap.forEach(c => {
                    let hName = c.original.toUpperCase().trim();
                    if (hName === 'REPEAT' || hName === 'TEST TYPE') {
                        if (String(row[c.index]).toUpperCase().trim() === 'INITIAL') isInitialRow = true;
                    }
                });

                hMap.forEach(c => {
                    let val = row[c.index] || '';
                    let hName = c.original.toUpperCase().trim();
                    let isResCol = hName.includes('RESULT') || hName.includes('DIAGNOSIS') || hName === 'HIV' || hName === 'SYPHILIS' || hName === 'HBSAG';
                    let isPerformedBy = hName === 'PERFORMED BY';

                    if (isResCol && val !== "") {
                        let vU = String(val).toUpperCase().trim();
                        let bg = "transparent", col = "inherit"; 
                        
                        if (vU === "CONFIDENTIAL" || isInitialRow) { bg = "#f1f5f9"; col = "#64748b"; } 
                        else if (vU === "I" || vU.includes("INVALID") || vU.includes("ERR")) { bg = "#000000"; col = "#ffffff"; } 
                        else if (vU === "T" || vU === "POSITIVE" || vU === "REACTIVE") { bg = "#fee2e2"; col = "#b91c1c"; } 
                        else if (vU === "N" || vU === "NEGATIVE" || vU === "NONREACTIVE" || vU === "NON-REACTIVE") { bg = "#dcfce7"; col = "#15803d"; } 
                        else if (vU === "RR" || vU.includes("RESISTANT")) { bg = "#991b1b"; col = "#ffffff"; } 
                        else if (vU === "TI") { bg = "#ffedd5"; col = "#c2410c"; } 
                        else if (vU === "TT") { bg = "#fef9c3"; col = "#b45309"; } 
                        
                        html += `<td><span class="res-badge" style="${bg !== 'transparent' ? `background-color:${bg}; color:${col}; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;` : ''}">${val}</span></td>`;
                    } 
                    else if (isPerformedBy && val !== "") {
                        html += `<td style="font-size:0.65rem; color:var(--text-muted);">${val}</td>`;
                    } 
                    else { 
                        html += `<td>${val}</td>`; 
                    }
                }); 
                html += `</tr>`;
            });
            
            // Palitan ang pagbuo ng paginationHtml sa loob ng openRegistryTab:
            html += `</tbody></table>`;
            
            const totalPages = registryData.totalPages || 1;
            const currentPage = registryData.currentPage || 1;
            
            // 🟢 UPDATED: Center Layout ( < Page [1] of X (Total) > )
            let paginationHtml = `
                <button type="button" class="btn-icon" style="width:26px; height:26px; border:1px solid var(--border-color); background:var(--bg-surface);" ${currentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="openRegistryTab('${type}', ${currentPage - 1})" title="Previous Page">
                    <i class="ph ph-caret-left"></i>
                </button>
                
                <div style="display:flex; align-items:center; gap:6px;">
                    <span>Page</span>
                    <input type="number" id="jumpPageInput" min="1" max="${totalPages}" value="${currentPage}" style="width:45px; padding:2px; text-align:center; border:1px solid var(--pri); outline:none; border-radius:4px; height:26px; font-size:0.8rem; font-weight:bold; color:var(--pri);" onkeydown="if(event.key==='Enter'){ let p=parseInt(this.value)||1; p=Math.max(1, Math.min(${totalPages}, p)); openRegistryTab('${type}', p); }">
                    <span>of <strong>${totalPages}</strong> <span style="color:var(--text-muted); font-size:0.7rem;">(Total: ${registryData.totalRows})</span></span>
                </div>

                <button type="button" class="btn-icon" style="width:26px; height:26px; border:1px solid var(--border-color); background:var(--bg-surface);" ${currentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="openRegistryTab('${type}', ${currentPage + 1})" title="Next Page">
                    <i class="ph ph-caret-right"></i>
                </button>
            `;
            
            // I-hiwalay ang pag-inject ng HTML
            cont.innerHTML = html;
            const topPagControls = document.getElementById('top-pagination-controls');
            if (topPagControls) topPagControls.innerHTML = paginationHtml;
            
        } else { 
            cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">No records found in this logbook.</div>'; 
            if(document.getElementById('top-pagination-controls')) document.getElementById('top-pagination-controls').innerHTML = '';
        }
    } catch (e) { 
        cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--danger);">Error loading registry data. Please try again.</div>'; 
        if(document.getElementById('top-pagination-controls')) document.getElementById('top-pagination-controls').innerHTML = '';
    }
}

let registrySearchTimeout = null;

function filterRegistryTable() {
    clearTimeout(registrySearchTimeout);
    
    const cont = document.getElementById('registry-table-content');
    if (cont && document.getElementById('regSearch') === document.activeElement) {
       cont.style.opacity = '0.5';
    }

    registrySearchTimeout = setTimeout(() => {
        if(cont) cont.style.opacity = '1';
        
        // Grab the search queries directly here before passing them
        const searchInput = document.getElementById('regSearch');
        const monthInput = document.getElementById('monthFilter');
        const colInput = document.getElementById('colFilter');
        
        const sQuery = searchInput ? searchInput.value.trim() : "";
        const mQuery = monthInput ? monthInput.value.trim() : "";
        const cQuery = (colInput && colInput.value !== "ALL") ? colInput.options[colInput.selectedIndex].text : "ALL"; 

        // We bypass the global variables and pass the values directly 
        // to ensure the server request catches the current input state
        openRegistryTab(window.CURRENT_TEST_TYPE, 1, sQuery, mQuery, cQuery);
    }, 800); 
}

function printRegistryLogbook() {
    const checkedBoxes = document.querySelectorAll('.chk-reg:checked');
    if (checkedBoxes.length === 0) { showAppAlert("Required", "Please select at least one record to print.", "error"); return; }
    let rowsData = []; checkedBoxes.forEach(chk => { rowsData.push(JSON.parse(decodeURIComponent(chk.value))); });
    
    let excludeCols = ["PATIENT ID", "ID"]; 
    if (window.CURRENT_TEST_TYPE === 'GXP') excludeCols.push("SOURCE OF REQUEST"); 
    else if (window.CURRENT_TEST_TYPE === 'GRAM') excludeCols.push("VERIFIED BY");
    
    let printHeaders = []; let headerIndices = [];
    window.CURRENT_REGISTRY_HEADERS.forEach((h, idx) => {
        const upperH = h.toUpperCase();
        if (excludeCols.some(ex => upperH === ex)) return; 
        if (h.includes("{") || h.includes("}")) return; 
        printHeaders.push(h.replace("Date ", "").replace("Patient ", "")); headerIndices.push(idx);
    });
    if (window.CURRENT_TEST_TYPE === 'SERO') {
        const kapIdx = window.CURRENT_REGISTRY_HEADERS.findIndex(h => h.toUpperCase() === "KAP CATEGORY");
        if (kapIdx > -1) rowsData.forEach(row => { if (String(row[kapIdx]).toUpperCase() === "NONE") row[kapIdx] = ""; });
    }
    
    const is10Rows = (window.CURRENT_TEST_TYPE === 'GXP' || window.CURRENT_TEST_TYPE === 'DSSM');
    const chunk = is10Rows ? 10 : 20;
    let fontSize = is10Rows ? "11px" : "8px"; 
    let tdPadding = is10Rows ? "6px" : "3px"; 
    
    // GXP overrides to maintain 10 patients per page
    if(window.CURRENT_TEST_TYPE === 'GXP') {
        fontSize = "9px";
        tdPadding = "4px";
    }

    let html = `<html><head><title>Registry Logbook</title>
        <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 15px; font-size: ${fontSize}; color: #000; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff;} 
            .page { page-break-after: always; position: relative; min-height: 95vh; display: flex; flex-direction: column;} 
            .page:last-child { page-break-after: auto; } 
            .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; } 
            .header h2 { margin: 0; font-size: 14px; text-transform: uppercase; } 
            .header p { margin: 2px 0; font-size: 10px; font-weight: bold;} 
            table { width: 100%; border-collapse: collapse; table-layout: auto; flex-grow: 1; } 
            th, td { border: 1px solid #000; padding: ${tdPadding}; text-align: center; word-wrap: break-word; font-size: ${fontSize};} 
            tr { height: auto; } 
            th { background-color: #e2e8f0 !important; font-weight: bold; } 
            .footer { margin-top: auto; border-top: 1px solid #000; padding-top: 5px; font-size: 7px; text-align: justify; line-height: 1.2; display: flex; gap: 20px;} 
            .footer-col { flex: 1; }
        </style>
    </head><body>`;
    
    for (let i = 0; i < rowsData.length; i += chunk) {
        const pageRows = rowsData.slice(i, i + chunk);
        html += `<div class="page"><div class="header"><h2>MUNICIPAL HEALTH OFFICE - ANGONO, RIZAL</h2><p>${window.CURRENT_REGISTRY_TITLE || window.CURRENT_TEST_TYPE + ' REGISTRY'}</p></div><table><thead><tr>`;
        
        printHeaders.forEach(h => {
            // Pinababa natin from 25% to 15% ang width para mas narrow
            let widthStyle = (h.toUpperCase() === 'X-RAY RESULT' && window.CURRENT_TEST_TYPE === 'GXP') ? 'style="width: 15%; max-width: 100px;"' : '';
            html += `<th ${widthStyle}>${h}</th>`
        }); 
        
        html += `</tr></thead><tbody>`;
        
        pageRows.forEach(row => { 
            html += `<tr>`; 
            
            let isInitialRow = false;
            headerIndices.forEach((idx, i) => {
                let hName = printHeaders[i].toUpperCase().trim();
                if (hName === 'REPEAT' || hName === 'TEST TYPE') {
                    if (String(row[idx]).toUpperCase().trim() === 'INITIAL') isInitialRow = true;
                }
            });

            headerIndices.forEach((idx, i) => { 
                let val = row[idx] || '';
                let hName = printHeaders[i].toUpperCase().trim();
                let isResCol = hName.includes('RESULT') || hName.includes('DIAGNOSIS') || hName === 'HIV' || hName === 'SYPHILIS' || hName === 'HBSAG';
                let isPerformedBy = hName === 'PERFORMED BY';
                let isXrayCol = (hName === 'X-RAY RESULT' && window.CURRENT_TEST_TYPE === 'GXP');
                
                // 🟢 BAGO: BUBURAHIN ANG "REACTIVE" HIV PARA BLANK LANG ANG LALABAS SA LOGBOOK 🟢
                if (hName === 'HIV' && String(val).toUpperCase().includes('REACTIVE') && !String(val).toUpperCase().includes('NON')) {
                    val = ""; 
                }

                let bgStyle = "";
                let textWeight = "normal";
                let fontStyle = "";
                
                if (isResCol && val !== "") {
                    let vU = String(val).toUpperCase().trim();
                    textWeight = "bold";
                    
                    if (vU === "CONFIDENTIAL" || isInitialRow) bgStyle = "background-color: #f1f5f9 !important; color: #64748b !important;"; 
                    else if (vU === "I" || vU.includes("INVALID") || vU.includes("ERR")) bgStyle = "background-color: #000000 !important; color: #ffffff !important;"; 
                    else if (vU === "T" || vU === "POSITIVE" || vU === "REACTIVE") bgStyle = "background-color: #fee2e2 !important; color: #b91c1c !important;"; 
                    else if (vU === "N" || vU === "NEGATIVE" || vU === "NONREACTIVE" || vU === "NON-REACTIVE") bgStyle = "background-color: #dcfce7 !important; color: #15803d !important;"; 
                    else if (vU === "RR" || vU.includes("RESISTANT")) bgStyle = "background-color: #991b1b !important; color: #ffffff !important;"; 
                    else if (vU === "TI") bgStyle = "background-color: #ffedd5 !important; color: #c2410c !important;"; 
                    else if (vU === "TT") bgStyle = "background-color: #fef9c3 !important; color: #b45309 !important;"; 
                } 
                else if (isPerformedBy && val !== "") {
                    const pfSize = is10Rows ? "7px" : "6px";
                    fontStyle = `font-size: ${pfSize}; color: #555;`; 
                }

                if (isXrayCol) {
                    fontStyle += `font-size: 7px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
                }

                html += `<td style="${bgStyle} font-weight: ${textWeight}; ${fontStyle}">${val}</td>`; 
            }); 
            html += `</tr>`; 
        });
        
        html += `</tbody></table>
            <div class="footer"><div class="footer-col"><strong>System Generated Report:</strong> This document is generated by the Angono MHO Laboratory Information System. No signature is required for system-generated summaries. However, official individual result forms must be signed by a licensed Medical Technologist and Pathologist.<br><strong>Confidentiality Notice:</strong> This document contains sensitive personal health information protected by the Data Privacy Act of 2012 (RA 10173). Unauthorized disclosure, copying, or distribution of this information is strictly prohibited.</div><div class="footer-col"><strong>Data Validity:</strong> The data presented is based on the records encoded by the facility personnel as of the generated date. Any discrepancies should be reported to the Laboratory Head for immediate verification and correction.<br><strong>Certification:</strong> This report is intended for internal monitoring, surveillance, and official submission to the Department of Health (DOH) and Municipal Health Office (MHO) only.</div></div></div>`;
    }
    html += `</body></html>`;
    const printWin = window.open('', '_blank'); printWin.document.write(html); printWin.document.close(); 
    
    setTimeout(() => { printWin.print(); printWin.close(); }, 800);
}

// ==========================================
// SILENT SETTINGS LOADER (NO ANNOYING POP-UPS)
// ==========================================
async function loadSettingsData() { 
    try {
        const res = await apiPost("getSettingsData", {}); 
        
        if (res && res.status === "success") {
            const data = res.data;
            globalStaffList = data.staff || [];
            globalFacilityList = data.facilities || [];
            
            renderFacilityList();
            renderStaffList();
            renderSettings(data.users); 
            
            const dropdowns = [document.getElementById('u_facility'), document.getElementById('edit_u_fac')];
            dropdowns.forEach(drop => {
                if(drop) {
                    drop.innerHTML = '<option value="ALL">ALL / MAIN</option>';
                    globalFacilityList.forEach(f => {
                        drop.innerHTML += `<option value="${f.name}">${f.name}</option>`;
                    });
                }
            });
        } else {
            // 🟢 FIX: Tinanggal natin ang showAppAlert dito.
            // Kapag nag-hiccup ang Google server, mananahimik na lang ang app sa halip na mag-pop up.
            console.warn("Settings background sync delayed. Will automatically retry later.");
        }
    } catch(e) { 
        console.warn("Settings Load Error: ", e); 
    } 
}

function renderSettings(users) { 
    const uList = document.getElementById('list-users'); 
    if (!uList) return; 
    if (!users || users.length === 0) { uList.innerHTML = '<div style="text-align:center; color:var(--text-muted);">No users found.</div>'; return; } 
    
    const isAdmin = (String(currentUser.role || "").toUpperCase() === 'ADMIN'); 
    uList.innerHTML = users.map(u => { 
        const status = String(u.status || "").toUpperCase(); 
        const isPending = (status === 'PENDING'); 
        let statusDisplay = ''; let cardBorder = 'border-color: var(--border-color);'; 
        
        if (isPending && isAdmin) { 
            cardBorder = 'border-color: var(--warning); background: var(--warning-bg);'; 
            statusDisplay = `<div style="display:flex; gap:8px; margin-top:8px;"><button onclick="decideUser('${u.username}', 'APPROVE')" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.7rem; background: var(--success);"><i class="ph ph-check"></i></button><button onclick="decideUser('${u.username}', 'REJECT')" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.7rem;"><i class="ph ph-x"></i></button></div>`; 
        } else { 
            let badgeClass = status === 'ACTIVE' ? 'badge-negative' : (status === 'REJECTED' ? 'badge-positive' : 'badge-warning'); 
            statusDisplay = `<div style="margin-top:8px;"><span class="badge ${badgeClass}">${status}</span></div>`; 
        } 
        
        let editBtn = isAdmin ? `<button onclick="openEditUser('${u.username}', '${u.fullname}', '${u.role}', '${u.status}', '${u.facility}')" class="btn-icon"><i class="ph ph-pencil-simple"></i></button>` : ''; 
        
        return `<div class="pending-card" style="margin-bottom: 8px; ${cardBorder} flex-direction: row; justify-content: space-between; align-items: flex-start;"><div><div class="pc-name">${u.fullname}</div><div class="pc-meta" style="margin-top:2px;">@${u.username} • ${u.role} • ${u.facility}</div>${statusDisplay}</div>${editBtn}</div>`; 
    }).join(''); 
}

let currentEditTarget = ""; 
function openEditUser(username, name, role, status, fac) { 
    currentEditTarget = username; 
    document.getElementById('edit_u_user').value = username;
    document.getElementById('edit_u_name').value = name;
    document.getElementById('edit_u_role').value = role; 
    document.getElementById('edit_u_status').value = status; 
    document.getElementById('edit_u_fac').value = fac;
    document.getElementById('edit_u_pass').value = ""; 
    document.getElementById('edit-user-modal').style.display = 'flex'; 
} 

function closeEditModal() { document.getElementById('edit-user-modal').style.display = 'none'; } 

async function saveUserChangesFull() { 
    const updatedData = {
        u: document.getElementById('edit_u_user').value,
        name: document.getElementById('edit_u_name').value,
        p: document.getElementById('edit_u_pass').value,
        role: document.getElementById('edit_u_role').value,
        status: document.getElementById('edit_u_status').value,
        fac: document.getElementById('edit_u_fac').value
    };
    
    if(!updatedData.u || !updatedData.name) { showAppAlert("Required", "Username and Name cannot be blank.", "error"); return; }
    
    const btn = document.getElementById('btn-save-user-full'); 
    const oldText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true; 
    try { 
        await apiPost("updateUserFull", { oldUsername: currentEditTarget, updatedData: updatedData, adminRole: currentUser.role }); 
        showAppAlert("Updated", "User details saved.", "success");
        closeEditModal(); loadSettingsData(); 
    } catch(e) { showAppAlert("Error", String(e), "error"); } finally { btn.innerHTML = oldText; btn.disabled = false; } 
} 

async function deleteUserRecord() {
    customConfirm(`Are you sure you want to permanently delete @${currentEditTarget}?`, async () => {
        try { 
            await apiPost("deleteUser", { targetUsername: currentEditTarget, adminRole: currentUser.role }); 
            showAppAlert("Deleted", "User has been removed.", "success");
            closeEditModal(); loadSettingsData(); 
        } catch(e) { showAppAlert("Error", String(e), "error"); }
    });
}

async function decideUser(username, action) { customConfirm(action + " access for " + username + "?", async () => { try { await apiPost("approveUser", { targetUsername: username, userAction: action, adminRole: currentUser.role }); loadSettingsData(); } catch(e) {} }); } 

async function saveUser() { 
    const user = { 
        u: document.getElementById('u_user').value, 
        p: document.getElementById('u_pass').value, 
        role: document.getElementById('u_role').value, 
        fac: document.getElementById('u_facility').value, 
        name: document.getElementById('u_fullname').value 
    }; 
    if(!user.u || !user.p || !user.role || !user.name) { showAppAlert("Required", "Please fill all fields.", "error"); return; } 
    const btn = document.querySelector('#user-form button'); 
    const oldText = btn.innerText; btn.innerHTML = "SAVING..."; btn.disabled = true; 
    try { 
        await apiPost("saveNewUser", { data: { username: user.u, password: user.p, facility: user.fac, role: user.role, fullName: user.name, roleCheck: currentUser.role }}); 
        toggleForm('user-form'); 
        document.getElementById('u_user').value = ""; document.getElementById('u_pass').value = ""; document.getElementById('u_fullname').value = ""; 
        loadSettingsData(); 
    } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } 
}

let globalFacilityList = []; 
function renderFacilityList() { 
    const container = document.getElementById('list-facilities'); 
    if(!container) return;
    container.innerHTML = globalFacilityList.map((f, index) => `<div class="pending-card" style="margin-bottom: 8px; border-left: 3px solid var(--warning); flex-direction: row; justify-content: space-between; align-items: flex-start;"><div><div class="pc-name">${f.name}</div><div class="pc-meta" style="margin-top:2px;">${f.address || ""}</div>${ f.person ? `<div class="pc-meta" style="margin-top:2px; color:var(--pri);">${f.person} (${f.number})</div>` : '' }</div><div style="display:flex; gap:4px;"><button onclick="editFacility(${index})" class="btn-icon"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Remove facility?', () => deleteFacility(${index}))" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button></div></div>`).join(''); 
} 
let editingFacilityIndex = -1; 
async function handleSaveFacility() { 
    const name = document.getElementById('f_name').value; if (!name) return; 
    const newItem = { name: name, address: document.getElementById('f_address').value, person: document.getElementById('f_person').value, number: document.getElementById('f_number').value }; 
    if (editingFacilityIndex >= 0) { globalFacilityList[editingFacilityIndex] = newItem; editingFacilityIndex = -1; } else { globalFacilityList.push(newItem); } 
    renderFacilityList(); clearFacilityForm(); toggleForm('fac-form'); 
} 
function editFacility(index) { const f = globalFacilityList[index]; document.getElementById('f_name').value = f.name; document.getElementById('f_address').value = f.address; document.getElementById('f_person').value = f.person; document.getElementById('f_number').value = f.number; editingFacilityIndex = index; document.getElementById('fac-form').style.display = 'block'; } 
function deleteFacility(index) { globalFacilityList.splice(index, 1); renderFacilityList(); } 
function clearFacilityForm() { document.getElementById('f_name').value = ""; document.getElementById('f_address').value = ""; document.getElementById('f_person').value = ""; document.getElementById('f_number').value = ""; editingFacilityIndex = -1; }

let globalStaffList = []; let editingStaffIndex = -1; 
function renderStaffList() { 
    const container = document.getElementById('staffListContainer'); if (!container) return; 
    if (globalStaffList.length === 0) { container.innerHTML = '<div style="text-align:center; color:var(--text-muted);">No staff found.</div>'; return; } 
    container.innerHTML = globalStaffList.map((s, index) => { let previewUrl = cleanDriveLink(s.sigUrl); const sigBadge = previewUrl ? `<img src="${previewUrl}" style="height:30px; border:1px solid var(--border-color); border-radius:4px; padding:2px; object-fit:contain;" onerror="this.style.display='none'">` : `<span class="badge badge-neutral">No Sig</span>`; return `<div class="pending-card" style="margin-bottom: 8px; border-left: 3px solid var(--danger); flex-direction: row; justify-content: space-between; align-items: center;"><div style="flex:1;"><div class="pc-name">${s.name}</div><div class="pc-meta" style="margin-top:2px;">${s.role} • Lic: ${s.license || "N/A"}</div></div><div style="margin-right: 12px;">${sigBadge}</div><div style="display:flex; gap:4px;"><button onclick="editStaff(${index})" class="btn-icon"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Remove staff?', () => deleteStaff(${index}))" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button></div></div>`; }).join(''); 
} 
function cleanDriveLink(url) { if (!url) return ""; if (url.includes("drive.google.com")) { let id = ""; let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); if (match) id = match[1]; else { match = url.match(/id=([a-zA-Z0-9_-]+)/); if (match) id = match[1]; } if (id) return "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000"; } return url; } 
async function handleSaveStaff() { const name = document.getElementById('staffName').value; if (!name) return; const btn = document.querySelector('#staff-form .btn-primary'); const oldText = btn.innerText; btn.innerHTML = "PROCESSING..."; btn.disabled = true; const newItem = { name: name, role: document.getElementById('staffRole').value, license: document.getElementById('staffLicense').value, sigUrl: cleanDriveLink(document.getElementById('staffSigUrl').value) }; if (editingStaffIndex >= 0) { globalStaffList[editingStaffIndex] = newItem; editingStaffIndex = -1; } else { globalStaffList.push(newItem); } renderStaffList(); clearStaffForm(); try { await apiPost("saveStaffData", { staffArray: globalStaffList }); toggleForm('staff-form'); } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } } 
function editStaff(index) { const s = globalStaffList[index]; document.getElementById('staffName').value = s.name; document.getElementById('staffRole').value = s.role; document.getElementById('staffLicense').value = s.license; document.getElementById('staffSigUrl').value = s.sigUrl || ""; editingStaffIndex = index; document.getElementById('staff-form').style.display = 'block'; } 
async function deleteStaff(index) { globalStaffList.splice(index, 1); renderStaffList(); try { await apiPost("saveStaffData", { staffArray: globalStaffList }); } catch(e) {} } 
function clearStaffForm() { document.getElementById('staffName').value = ""; document.getElementById('staffRole').value = "Medical Technologist"; document.getElementById('staffLicense').value = ""; document.getElementById('staffSigUrl').value = ""; editingStaffIndex = -1; } 
function toggleForm(id) { const el = document.getElementById(id); if(el) el.style.display = (el.style.display === 'block') ? 'none' : 'block'; }

function switchTab(id) { document.querySelectorAll('.tab-view').forEach(el => el.style.display = 'none'); document.querySelectorAll('.chip').forEach(el => el.classList.remove('active')); document.getElementById('tab-' + id).style.display = 'block'; const btn = document.getElementById('tab-btn-' + id); if(btn) btn.classList.add('active'); }
function togglePeriod() { const type = document.querySelector('input[name="rep_type"]:checked').value; document.getElementById('rep_month').style.display = (type === 'monthly') ? 'inline-block' : 'none'; document.getElementById('rep_quarter').style.display = (type === 'quarterly') ? 'inline-block' : 'none'; }
async function generateReport() { const type = document.querySelector('input[name="rep_type"]:checked').value; const year = document.getElementById('rep_year').value; let targetFacility = "ALL"; let userRole = "VIEWER"; try { if (typeof currentUser !== 'undefined') { userRole = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_'); if (userRole === 'VIEWER' || userRole === 'ENCODER') { targetFacility = currentUser.facility || "ALL"; } } } catch (e) {} let val = 0; let text = ""; if (type === 'monthly') { const sel = document.getElementById('rep_month'); val = sel.value; text = sel.options[sel.selectedIndex].text.toUpperCase() + " " + year; } else if (type === 'quarterly') { const sel = document.getElementById('rep_quarter'); val = sel.value; text = sel.options[sel.selectedIndex].text.toUpperCase() + " " + year; } else { val = 0; text = "ANNUAL REPORT " + year; } let facLabel = (targetFacility === "ALL") ? "(CONSOLIDATED)" : `(${targetFacility})`; document.querySelectorAll('.rep-period').forEach(el => el.innerText = `- ${text} ${facLabel}`); const btn = document.getElementById('btn-generate-rep'); const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> PROCESSING...'; btn.disabled = true; try { const res = await apiGet("getReportData", { type: type, value: val, year: year, facility: targetFacility }); if (res.status === "success") { const d = res.data; renderTB(d.tb); renderHIV(d.hiv); renderSTI(d.sti); renderDengue(d.dengue); renderWorkload(d.workload); if (d.fhsis_maternal) renderFHSIS(d.fhsis_maternal); } } catch (err) {} finally { btn.innerHTML = oldHtml; btn.disabled = false; } }
function renderFHSIS(data) { if (!data) return; const facMap = { "SAN ISIDRO": "SI", "SAN VICENTE": "SV", "KALAYAAN": "KA", "STO. NIÑO": "SN", "SAN ROQUE": "SR", "MAHABANG PARANG": "MP", "POB. ITAAS": "PI", "POB. IBABA": "PB", "BAGUMBAYAN": "BA", "SAN PEDRO": "SP", "ANGONO RHU I": "R1" }; const keys = [ "syp_s_t", "syp_s_10", "syp_s_15", "syp_s_20", "syp_p_t", "syp_p_10", "syp_p_15", "syp_p_20", "hiv_s_t", "hiv_s_10", "hiv_s_15", "hiv_s_20", "hiv_r_t", "hiv_r_10", "hiv_r_15", "hiv_r_20", "hbs_s_t", "hbs_s_10", "hbs_s_15", "hbs_s_20", "hbs_r_t", "hbs_r_10", "hbs_r_15", "hbs_r_20" ]; keys.forEach(key => { let rowTotal = 0; Object.keys(facMap).forEach(facName => { let val = (data[facName] && data[facName][key]) ? data[facName][key] : 0; let cellId = key + "_" + facMap[facName]; let cell = document.getElementById(cellId); if (cell) { cell.innerText = val; rowTotal += val; } }); let totalCell = document.getElementById(key + "_TOT"); if (totalCell) totalCell.innerText = rowTotal; }); }
function renderTB(tb) { 
    const row = (lbl, n, r) => `<tr><td style="font-weight:600; text-align:left;">${lbl}</td><td class="text-center">${n || 0}</td><td class="text-center">${r || 0}</td></tr>`; 
    document.getElementById('tb-exam-body').innerHTML = row("EXAMINED", tb.exam.new, tb.exam.ret) + row("INVALID / ERROR", tb.invalid.new, tb.invalid.ret) + row("INITIAL RESULT", tb.initial.new, tb.initial.ret); 
    document.getElementById('tb-res-body').innerHTML = row("MTB DETECTED", tb.pos.new, tb.pos.ret) + row(" > RIF RESISTANT", tb.rr.new, tb.rr.ret) + row(" > TRACE DETECTED", tb.tt.new, tb.tt.ret) + row(" > INDETERMINATE", tb.ti.new, tb.ti.ret) + row(" > SENSITIVE", tb.t.new, tb.t.ret) + row("MTB NOT DETECTED", tb.n.new, tb.n.ret); 
    document.getElementById('tb-cart').innerText = tb.cartridges || 0; 
    
    // 🟢 BAGO: PANG-UPDATE NG DSSM COUNT 🟢
    const dssmEl = document.getElementById('tb-dssm');
    if(dssmEl) dssmEl.innerText = tb.dssm || 0;
}
function renderHIV(h) { const buildRow = (grid) => `<tr><td style="font-weight:600; text-align:left;">ANGONO</td><td class="text-center">${grid.m.c15}</td><td class="text-center">${grid.m.c1524}</td><td class="text-center">${grid.m.c2534}</td><td class="text-center">${grid.m.c3549}</td><td class="text-center">${grid.m.c50}</td><td class="text-center">${grid.f.c15}</td><td class="text-center">${grid.f.c1524}</td><td class="text-center">${grid.f.c2534}</td><td class="text-center">${grid.f.c3549}</td><td class="text-center">${grid.f.c50}</td><td class="text-center" style="color:var(--danger); font-weight:700;">${grid.f.mat}</td><td class="text-center">${grid.kap.msm}</td><td class="text-center">${grid.kap.tgw}</td><td class="text-center">${grid.kap.msw}</td><td class="text-center">${grid.kap.fsw}</td><td class="text-center">${grid.kap.pwid}</td><td class="text-center" style="font-weight:700; color:var(--text-main); background:var(--warning-bg);">${grid.kap.tb}</td><td class="text-center font-bold" style="background:var(--bg-subtle);">${grid.total}</td></tr>`; document.getElementById('hiv-test-body').innerHTML = buildRow(h.tested); document.getElementById('hiv-react-body').innerHTML = buildRow(h.reactive); }
function renderSTI(s) { const buildSTI = (name, d) => `<tr><td rowspan="3" style="font-weight:700; vertical-align:middle;">${name}</td><td>NON-REACTIVE</td><td class="text-center">${d.m - d.m_r}</td><td class="text-center">${d.f - d.f_r}</td><td class="text-center">${d.mat - d.mat_r}</td><td class="text-center">${d.total - d.react}</td></tr><tr style="color:var(--danger); font-weight:600;"><td>REACTIVE</td><td class="text-center">${d.m_r}</td><td class="text-center">${d.f_r}</td><td class="text-center">${d.mat_r}</td><td class="text-center">${d.react}</td></tr><tr style="background:var(--bg-subtle); font-weight:700;"><td>TOTAL</td><td class="text-center">${d.m}</td><td class="text-center">${d.f}</td><td class="text-center">${d.mat}</td><td class="text-center">${d.total}</td></tr>`; document.getElementById('sti-body').innerHTML = buildSTI("HIV", s.hiv) + buildSTI("SYPHILIS", s.syph) + buildSTI("HBsAg", s.hbsag); }
function renderDengue(d) { document.getElementById('dengue-body').innerHTML = `<tr><td>POSITIVE</td><td class="text-center" style="color:var(--danger); font-weight:700;">${d.pos}</td></tr><tr><td>NEGATIVE</td><td class="text-center">${d.neg}</td></tr><tr style="background:var(--bg-subtle); font-weight:700;"><td>TOTAL</td><td class="text-center">${d.total}</td></tr>`; }
function renderWorkload(w) { let html = ""; for (const [key, val] of Object.entries(w)) { html += `<tr><td style="text-align:left; text-transform:uppercase; font-weight:600;">${key.replace('Registry - ','')}</td><td class="text-center" style="font-weight:700;">${val}</td></tr>`; } document.getElementById('workload-body').innerHTML = html; }
function printReport() {
    let activeTab = "";
    document.querySelectorAll('.tab-view').forEach(tab => { if (tab.style.display === 'block') activeTab = tab.outerHTML; });

    // 🟢 BAGO: NAKA-TABLE FORMAT ANG HEADER PARA UMA-APPEAR SA BAWAT PAGE 🟢
    const headerHtml = `
        <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 10px; padding-bottom: 5px;">
            <tr>
                <td style="width: 70px; text-align: left; vertical-align: middle;"><img src="https://drive.google.com/thumbnail?id=1ZX23SKg3CAe8JYPoaJbF5HHCT4UUZjQG&sz=w1000" style="width: 50px; height: 50px;"></td>
                <td style="text-align: center; vertical-align: middle;">
                    <h1 style="font-size: 15px; margin: 2px 0; color: #00695C;">MUNICIPAL HEALTH OFFICE</h1>
                    <h3 style="font-size: 11px; margin: 2px 0; color: #555;">Republic of the Philippines<br>Province of Rizal | Municipality of Angono</h3>
                    <p style="font-size: 9px; margin: 2px 0; color: #555;">P. Tolentino St. Brgy. San Isidro, Angono, Rizal</p>
                </td>
                <td style="width: 70px; text-align: right; vertical-align: middle;"><img src="https://drive.google.com/thumbnail?id=1BqWTCHhIrJXMNDC4juCEC8FmxWtC3iBs&sz=w1000" style="width: 50px; height: 50px;"></td>
            </tr>
        </table>`;

    const footerHtml = document.querySelector('.rep-footer').outerHTML;

    const htmlContent = `<html><head><title>Print Report</title>
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/sf-pro-display">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'SF Pro Display', sans-serif; padding: 0; color: #333; margin: 0; -webkit-print-color-adjust: exact; background: white;}
            table.main-layout { width: 100%; border-collapse: collapse; }
            .data-table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: auto; margin-top: 15px; }
            .data-table th, .data-table td { border: 1px solid #000; padding: 6px; text-align: left; word-wrap: break-word; }
            .data-table th { background-color: #f0f0f0 !important; }
            .text-center { text-align: center; }
            .rep-footer { display: flex; justify-content: space-between; font-size: 9px; border-top: 1px dashed #000; padding-top: 10px; margin-top: 20px; }
            .rep-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #00695C; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            .controls-area, .chip-group, button { display: none !important; }
        </style>
        </head><body>
            <table class="main-layout">
                <thead><tr><td>${headerHtml}</td></tr></thead>
                <tbody><tr><td>${activeTab}</td></tr></tbody>
                <tfoot><tr><td>${footerHtml}</td></tr></tfoot>
            </table>
            <script>window.onload = function() { setTimeout(function(){ window.print(); window.close(); }, 800); };</script>
        </body></html>`;
    
    const win = window.open('', '_blank');
    win.document.write(htmlContent);
    win.document.close();
}

async function downloadReport() {
    showAppAlert("PDF Download", "Wait for the preview to load, then click 'PRINT / SAVE AS PDF' and choose 'Save as PDF'.", "info");
    
    let activeTab = "";
    document.querySelectorAll('.tab-view').forEach(tab => { if (tab.style.display === 'block') activeTab = tab.outerHTML; });

    const headerHtml = `
        <table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 10px; padding-bottom: 5px;">
            <tr>
                <td style="width: 70px; text-align: left; vertical-align: middle;"><img src="https://drive.google.com/thumbnail?id=1ZX23SKg3CAe8JYPoaJbF5HHCT4UUZjQG&sz=w1000" style="width: 50px; height: 50px;"></td>
                <td style="text-align: center; vertical-align: middle;">
                    <h1 style="font-size: 15px; margin: 2px 0; color: #00695C;">MUNICIPAL HEALTH OFFICE</h1>
                    <h3 style="font-size: 11px; margin: 2px 0; color: #555;">Republic of the Philippines<br>Province of Rizal | Municipality of Angono</h3>
                    <p style="font-size: 9px; margin: 2px 0; color: #555;">P. Tolentino St. Brgy. San Isidro, Angono, Rizal</p>
                </td>
                <td style="width: 70px; text-align: right; vertical-align: middle;"><img src="https://drive.google.com/thumbnail?id=1BqWTCHhIrJXMNDC4juCEC8FmxWtC3iBs&sz=w1000" style="width: 50px; height: 50px;"></td>
            </tr>
        </table>`;

    const footerHtml = document.querySelector('.rep-footer').outerHTML;

    const htmlContent = `<html><head><title>Print Report</title>
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/sf-pro-display">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'SF Pro Display', sans-serif; padding: 0; color: #333; margin: 0; background: #e2e8f0; padding-top: 70px; display: flex; flex-direction: column; align-items: center;}
            .report-container { width: 297mm; min-height: 210mm; background: white; padding: 10mm; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
            table.main-layout { width: 100%; border-collapse: collapse; }
            .data-table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: auto; margin-top: 15px; }
            .data-table th, .data-table td { border: 1px solid #000; padding: 6px; text-align: left; word-wrap: break-word; }
            .data-table th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;}
            .text-center { text-align: center; }
            .rep-footer { display: flex; justify-content: space-between; font-size: 9px; border-top: 1px dashed #000; padding-top: 10px; margin-top: 20px; }
            .rep-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #00695C; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            .controls-area, .chip-group, button { display: none !important; }
            
            .no-print { position: fixed; top: 0; left: 0; width: 100%; background: #1e293b; padding: 12px; text-align: center; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); } 
            .no-print button { padding: 10px 20px; margin: 0 5px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-family: sans-serif; font-size: 14px; } 
            .btn-print { background: #10b981; color: white; } 
            .btn-close { background: #ef4444; color: white; } 
            .preview-text { color: white; font-family: sans-serif; font-size: 14px; margin-right: 20px; font-weight: normal; }
            
            @media print { .no-print { display: none !important; } body { background: white; padding-top: 0 !important; display: block; margin: 0; } .report-container { width: auto; min-height: auto; padding: 0; border: none; box-shadow: none;} }
        </style>
        </head><body>
            <div class="no-print">
                <span class="preview-text">⏳ PREVIEW: Wait for logos to load</span>
                <button class="btn-print" onclick="window.print()">🖨️ PRINT / SAVE AS PDF</button>
                <button class="btn-close" onclick="window.close()">❌ CLOSE</button>
            </div>
            <div class="report-container">
                <table class="main-layout">
                    <thead><tr><td>${headerHtml}</td></tr></thead>
                    <tbody><tr><td>${activeTab}</td></tr></tbody>
                    <tfoot><tr><td>${footerHtml}</td></tr></tfoot>
                </table>
            </div>
        </body></html>`;
    
    const win = window.open('', '_blank');
    win.document.write(htmlContent);
    win.document.close();
}

async function downloadReport() {
    showAppAlert("PDF Download", "Wait for the preview to load, then click 'PRINT / SAVE AS PDF' and choose 'Save as PDF'.", "info");
    printReport();
}

async function saveResult(id, safeId, btn) {
  const inputs = document.querySelectorAll('.res-' + safeId); 
  const item = window.pendingData.find(d => String(d.id) === String(id).trim());
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
          await loadPendingData(); 
      }
  } catch (err) { btn.disabled = false; btn.innerHTML = "Save Result"; }
}

// 🟢 BAGO: LOGIC PARA SA CREATE STAFF ACCOUNT 🟢
function showStaffRegister() {
    document.getElementById('login-card').style.display = 'none';
    document.getElementById('staff-register-card').style.display = 'block';
    
    // Kunin ang facilities galing sa server
    apiGet("getFacilityList").then(res => {
        if(res.status === 'success') {
            const sel = document.getElementById('reg_fac');
            sel.innerHTML = '<option value="ALL">ALL / MAIN</option>';
            res.data.forEach(f => sel.innerHTML += `<option value="${f.name}">${f.name}</option>`);
        }
    });
}

// ==========================================
// SILENT BACKGROUND AUTO-SYNC (Every 60 secs)
// ==========================================
function startAutoSync() {
    const syncInterval = 60000; 
    
    setInterval(async () => {
        // 🟢 FIX: Pinalitan ang 'pending-section' ng 'col-pending'
        const pendingSection = document.getElementById('col-pending'); 
        const isEditing = document.getElementById('col-entry') && document.getElementById('col-entry').classList.contains('edit-mode-pane');
        
        // Mag-sync lang kung nasa Workspace tab at HINDI kasalukuyang nag-eedit
        if (pendingSection && pendingSection.style.display !== 'none' && !isEditing) {
            console.log("Auto-syncing background data...");
            
            try {
                const res = await apiGet("getPendingWorkload", { 
                    role: currentUser.role, 
                    facility: currentUser.facility,
                    _t: new Date().getTime() 
                });
                
                if (res && (res.pending || res.encoded)) {
                    window.pendingData = res.pending || [];
                    window.completedData = res.encoded || [];
                    
                    if (typeof renderLists === 'function') {
                        renderLists();
                    }
                }
            } catch (e) {
                console.error("Silent sync failed, will try again later.");
            }
        }
    }, syncInterval);
}

// I-trigger ang auto-sync pagka-load ng mismong app
window.addEventListener('load', () => {
    startAutoSync();
});

function backToLoginFromRegister() {
    document.getElementById('staff-register-card').style.display = 'none';
    document.getElementById('login-card').style.display = 'block';
}

async function submitStaffRegister() {
    const name = document.getElementById('reg_name').value.trim();
    const fac = document.getElementById('reg_fac').value;
    const role = document.getElementById('reg_role').value;
    const user = document.getElementById('reg_user').value.trim();
    const pass1 = document.getElementById('reg_pass').value;
    const pass2 = document.getElementById('reg_pass2').value;
    
    if(!name || !role || !user || !pass1 || !pass2) return showAppAlert("Required", "Please fill all fields.", "error");
    
    // 🟢 BAGO: PASSWORD MISMATCH LOGIC 🟢
    if(pass1 !== pass2) {
        document.getElementById('reg_pass2').value = ''; // Buburahin yung tinype niya
        return showAppAlert("Mismatch", "Passwords do not match! Please try again.", "error");
    }

    const btn = document.querySelector('#staff-register-card .btn-primary');
    const oldText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Submitting...'; btn.disabled = true;
    
    try {
        const res = await apiPost("registerUser", { data: { u: user, p: pass1, fac: fac, role: role, name: name }});
        if(res.status === "success") {
            showAppAlert("Success", "Account requested successfully! Please wait for the Admin to approve your account before logging in.", "success");
            
            document.getElementById('reg_name').value = ''; document.getElementById('reg_user').value = '';
            document.getElementById('reg_pass').value = ''; document.getElementById('reg_pass2').value = '';
            document.getElementById('reg_role').value = '';
            backToLoginFromRegister();
        } else { showAppAlert("Error", res.message, "error"); }
    } catch(e) { showAppAlert("Error", "Server error. Please try again.", "error"); }
    finally { btn.innerHTML = oldText; btn.disabled = false; }
}

async function downloadDirect(e, id, testName) {
    if(e) e.stopPropagation(); 
    showAppAlert("PDF Download", "Wait for the preview to load all logos, then click 'PRINT / SAVE AS PDF' and choose 'Save as PDF' as your destination.", "info");
    printDirect(e, id, testName);
}

async function batchDownload() {
    const checked = document.querySelectorAll('.chk-reg:checked'); 
    if(checked.length === 0) { showAppAlert("Required", "Select at least one record.", "error"); return; }
    showAppAlert("PDF Download", "Wait for the preview to load all logos, then click 'PRINT / SAVE AS PDF' and choose 'Save as PDF' as your destination.", "info");
    batchPrint(); 
}


// 🟢 Taga-process ng data para sa NTP Form
function processNtpResultsClient(p) {
    p.gxpText = ""; p.gxpClass = ""; p.dssmText = ""; p.dssmClass = ""; p.smear1 = ""; p.smear2 = "";
    p.dateCollected = p.dateRequest || ""; p.dateDispatched = p.dateRequest || ""; p.dateSpecReceived = p.dateRequest || ""; p.dateExaminedStr = p.dateExamined || ""; p.dateReleasedStr = p.dateResult || ""; p.labSerialNumber = p.testCode || p.id;

    const tName = (p.testName || "").toUpperCase();
    p.isDSSM = tName.includes("DSSM") || tName.includes("AFB");
    p.isGXP = tName.includes("GXP") || tName.includes("GEN");
    
    const initialWarning = " (INITIAL RESULT ONLY. FOR REPEAT COLLECTION AND TESTING)";
    const findRes = (key) => p.results?.find(r => r.param.toUpperCase() === key.toUpperCase())?.res || "";
    
    // 🟢 FIX: Kukuha ng Address at Contact sa local cache kung blangko, at papalitan ng "" ang "undefined"
    const cachedP = cachedPatients.find(cp => cp.id === p.id) || {};
    p.address = (p.address && p.address !== "undefined") ? p.address : (cachedP.address || "");
    p.contact = (p.contact && p.contact !== "undefined") ? p.contact : (cachedP.contact || "");

    p.history = findRes("History of Treatment");
    
    // 🟢 FIX: Para mawala ang salitang "undefined" sa Physician
    let phys = findRes("Source of Request") || p.physician || "";
    p.physician = (phys === "undefined") ? "" : phys;

    p.xray = findRes("X-Ray Result");
    p.monthTreat = findRes("Month of Treatment");
    p.reason = findRes("Reason for Examination") || "Diagnosis";

    if(p.results) {
        p.results.forEach(r => {
            const k = String(r.param).trim(); const v = String(r.res || "").trim(); const vUpper = v.toUpperCase();
            if (k === "ResultCode") {
                let gradeRaw = findRes("Grade"); let repeatTag = findRes("Repeat");
                let grades = { 'VL': 'Very Low', 'L': 'Low', 'M': 'Medium', 'H': 'High' };
                let fullGrade = grades[gradeRaw.toUpperCase()] || gradeRaw;
                let isInitial = repeatTag.toUpperCase().includes("INITIAL") || vUpper.includes("INITIAL");

                if (vUpper === "N") { p.gxpText = "MTB NOT DETECTED."; p.gxpClass = "res-n"; } 
                else if (vUpper === "T") { p.gxpText = `MTB DETECTED ${fullGrade}; Rifampicin resistance NOT detected.`; p.gxpClass = "res-t"; } 
                else if (vUpper.startsWith("TT")) { p.gxpText = `MTB TRACE DETECTED; Rifampicin resistance INDETERMINATE.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-tt"; } 
                else if (vUpper.startsWith("TI")) { p.gxpText = `MTB DETECTED; Rifampicin resistance INDETERMINATE.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-ti"; } 
                else if (vUpper.startsWith("RR")) { p.gxpText = `MTB DETECTED ${fullGrade}; Rifampicin resistance DETECTED.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-rr"; } 
                else if (vUpper === "I" || vUpper.includes("ERR") || vUpper.includes("INV")) { p.gxpText = `INVALID / ERROR.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-i"; }
            }
            if (k === "Smear1") { let countVal = findRes("Smear1_Count"); if (countVal !== "" && !countVal.includes("#")) p.smear1 = "+" + countVal; else p.smear1 = v; }
            if (k === "Smear2") { let countVal = findRes("Smear2_Count"); if (countVal !== "" && !countVal.includes("#")) p.smear2 = "+" + countVal; else p.smear2 = v; }
            if (k === "Diagnosis") { p.dssmText = v; p.dssmClass = vUpper.includes("POS") ? "res-rr" : "res-n"; }
        });
    }
}

function localGenerateNTPHtml(patientsArray) {
    const logos = { 
        left: "https://lh3.googleusercontent.com/d/1ZX23SKg3CAe8JYPoaJbF5HHCT4UUZjQG", 
        lab: "https://lh3.googleusercontent.com/d/1xYN202dyNGl7cO1E8qokOkX8m6mepXyK", 
        right: "https://lh3.googleusercontent.com/d/1BqWTCHhIrJXMNDC4juCEC8FmxWtC3iBs" 
    };

    const getStaff = (name) => {
        if(!name) return { name: "", role: "Medical Technologist", license: "", sigUrl: "" };
        const nLower = String(name).trim().toLowerCase();
        const words = nLower.replace(/\./g, '').split(/\s+/);
        
        const found = (globalStaffList || []).find(s => {
            const sLower = s.name.toLowerCase();
            if (sLower === nLower) return true;
            if (words.length > 1 && sLower.includes(words[0]) && sLower.includes(words[words.length-1])) return true;
            return sLower.includes(nLower) || nLower.includes(sLower);
        });
        
        return found || { name: name, role: "Medical Technologist", license: "", sigUrl: "" };
    };

    let combinedHtml = "";

    patientsArray.forEach((p, index) => {
        processNtpResultsClient(p);
        
        // 🟢 FIX: Kukuha ng Address at Contact sa local cache kung blangko
        const cachedP = cachedPatients.find(cp => cp.id === p.id) || {};
        p.address = (p.address && p.address !== "undefined") ? p.address : (cachedP.address || "");
        p.contact = (p.contact && p.contact !== "undefined") ? p.contact : (cachedP.contact || "");
        let phys = p.physician || "";
        p.physician = (phys === "undefined") ? "" : phys;

        let performer = getStaff(p.encoder);

        const pageHtml = `
        <div class="page-container">
            <div class="header">
                <img src="${logos.left}" class="logo-side" onerror="this.style.display='none'">
                <div class="header-center">
                    <img src="${logos.lab}" class="logo-lab" onerror="this.style.display='none'">
                    <h3 style="font-size:8px; margin:0;">REPUBLIC OF THE PHILIPPINES</h3>
                    <h3 style="font-size:8px; margin:0;">PROVINCE OF RIZAL</h3>
                    <h2 style="font-size:10px; margin:1px 0;">Municipality of ANGONO</h2>
                    <h1 style="font-size:14px; margin:1px 0;">Municipal Health Office</h1>
                    <p style="font-size:8px; margin:0;">P. Tolentino St. Brgy. San Isidro, Angono, Rizal</p>
                </div>
                <img src="${logos.right}" class="logo-side" onerror="this.style.display='none'">
            </div>

            <div class="form-title">FORM 2A. LABORATORY REQUEST AND RESULT FORM</div>
            <div class="content-spacer"></div> 
            <div class="section-bar">To be filled out by the requesting facility health care worker</div>

            <table class="main-table">
            <tr>
                <td width="60%">Name of Requesting Facility/Unit: <span class="line" style="width:200px;">${p.facility}</span></td>
                <td width="40%">Date of Request: <span class="line" style="width:140px;">${p.dateRequest}</span></td>
            </tr>
            <tr>
                <td>Facility Contact Information: <span class="line" style="width:220px;">&nbsp;</span></td>
                <td>Requesting Physician: <span class="line" style="width:150px;">${p.physician}</span></td>
            </tr>
            <tr>
                <td colspan="2">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Patient's Full Name: <span class="line" style="width:300px; text-transform:uppercase;">${p.name}</span></span>
                        <span>Age: <span class="line" style="width:30px; text-align:center;">${p.age}</span></span>
                        <span>Sex: <span class="line" style="width:50px; text-align:center;">${p.sex}</span></span>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Address: <span class="line" style="width:420px; font-size:9px;">${p.address}</span></span>
                        <span>Patient's Contact No.: <span class="line" style="width:120px;">${p.contact}</span></span>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2" style="padding-top: 8px;">
                    <div style="display:flex; align-items:flex-start;">
                        <strong style="width:130px;">Reason for Examination:</strong>
                        <div style="display:flex; gap:15px;">
                                <span class="chk-item"><input type="checkbox" ${(!p.isDSSM && p.reason == 'Diagnosis') ? 'checked' : ''}> Diagnosis</span>
                                <span class="chk-item"><input type="checkbox" ${(!p.isDSSM && p.reason == 'Baseline') ? 'checked' : ''}> Baseline</span>
                                <span class="chk-item"><input type="checkbox" ${(p.isDSSM || p.reason == 'Follow-up') ? 'checked' : ''}> Follow-up</span>
                        </div>
                        <span style="margin-left:auto;">TB Case No.: <span class="line" style="width:70px;">${p.tbCase || ''}</span></span>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                    <div style="display:flex; align-items:center;">
                        <strong style="width:130px;">History of Treatment:</strong>
                            <div style="display:flex; gap:15px;">
                            <span class="chk-item"><input type="checkbox" ${(!p.isDSSM && String(p.history).toUpperCase() == 'NEW') ? 'checked' : ''}> New</span>
                            <span class="chk-item"><input type="checkbox" ${(!p.isDSSM && String(p.history).toUpperCase() != 'NEW') ? 'checked' : ''}> Retreatment</span>
                        </div>
                        <span style="margin-left:auto;">Month of Treatment: <span class="line" style="width:70px;">${p.monthTreat || ''}</span></span>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2" style="padding-top: 8px;">
                    <div style="display:flex; align-items:flex-start;">
                        <strong style="width:130px;">Test Requested:</strong>
                        <table style="width:100%; border:none; margin:0;">
                            <tr>
                                <td style="border:none; padding:0; vertical-align:top; width:50%;">
                                    <div class="chk-item"><input type="checkbox" ${(p.isGXP && !p.testName.includes("XDR")) ? 'checked' : ''}> Xpert MTB/RIF Ultra</div><br>
                                    <div class="chk-item"><input type="checkbox" ${(p.testName.includes("XDR")) ? 'checked' : ''}> Xpert MTB/XDR</div><br>
                                    <div class="chk-item"><input type="checkbox"> Line Probe Assay</div>
                                </td>
                                <td style="border:none; padding:0; vertical-align:top; width:50%;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <div>
                                            <div class="chk-item"><input type="checkbox"> TB LAMP</div><br>
                                            <div class="chk-item"><input type="checkbox"> Truenat MTB-RIF</div><br>
                                            <div class="chk-item"><input type="checkbox" ${(p.isDSSM) ? 'checked' : ''}> Smear Microscopy</div>
                                        </div>
                                        <div>
                                            <div class="chk-item"><input type="checkbox"> TB Culture</div><br>
                                            <div class="chk-item"><input type="checkbox"> Phenotypic DST</div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2" class="pad-top-lg">Type of Specimen: <span class="line" style="width:200px; text-align:center;">Sputum</span></td>
            </tr>
            </table>

            <table class="res-table-inner" style="margin-bottom:5px;">
            <tr style="background:#ccc;">
                <th width="20%">Specimen</th>
                <th width="40%">Date Collected</th>
                <th width="40%">Date Dispatched to Laboratory</th>
            </tr>
            <tr><td>1</td><td>${p.dateCollected}</td><td>${p.dateCollected}</td></tr>
            <tr><td>2</td><td></td><td></td></tr>
            </table>
            
            <div style="margin-bottom:15px;">
            <strong>Remarks:</strong>
            <div style="border-bottom:1px solid #000; width:100%; height:18px; line-height:18px; font-weight:bold; font-size:9px; text-align:center;">
                ${p.remarks}
            </div>
            <div style="text-align:center; font-size:8px; font-style:italic;">(i.e. precollection details, existing medical conditions, medications...)</div>
            </div>

            <div style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div style="width: 50%;">
                    <strong>Prepared By:</strong>
                    <span class="line" style="width:200px; text-align:center; text-transform:uppercase;">${p.encoder}</span>
                </div>
                <div style="width: 50%;">
                    <strong>Designation:</strong>
                    <span class="line" style="width:200px;">&nbsp;</span>
                </div>
            </div>
            <div style="font-size:8px; margin-left:100px;">Signature over Printed Name</div>
            </div>

            <div class="section-bar">To be filled out by the receiving Medical Technologist/Microscopist/Xpert Technician</div>

            <table class="main-table">
            <tr>
                <td width="60%" style="padding: 8px;">Name of Laboratory: <strong>ANGONO RTDL</strong></td>
                <td width="40%" style="padding: 8px;">
                    <div style="display:flex; justify-content:space-between;">
                            <span>Date Specimen Received:</span>
                            <strong>${p.dateCollected}</strong>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2">
                        <div style="display:flex; gap:10px; align-items: center; padding: 5px 0;">
                        <span>Specimen Volume and Quality: <span class="line" style="width:150px;">${p.appearance || ''}</span></span>
                        <span class="chk-item"><input type="checkbox" checked> Accepted</span>
                        <span class="chk-item"><input type="checkbox"> Rejected, reason: <span class="line" style="width:100px;"></span></span>
                    </div>
                </td>
            </tr>
            <tr>
                <td colspan="2" style="padding-top:10px; padding-bottom:5px;">
                    <div style="display:flex; justify-content:space-between;">
                        <div>
                                Laboratory Serial Number: <span class="line" style="width:180px; font-weight:bold;">${p.labSerialNumber}</span>
                        </div>
                        <div>
                                Date Specimen Examined: <strong>${p.dateResult || p.dateExaminedStr || ''}</strong>
                        </div>
                    </div>
                </td>
            </tr>
            </table>

            <table class="res-table-inner">
        <tr style="background:#d9d9d9;">
            <th width="40%">DIAGNOSTIC TESTS</th>
            <th width="60%">RESULTS</th>
        </tr>
        <tr>
            <td style="text-align:left; padding-left:20px; height:50px; vertical-align:middle; width:40%;">Xpert MTB/RIF Ultra</td>
            <td class="${p.gxpClass}" style="font-weight:bold; font-size:9.5pt; vertical-align:middle; text-align:center; padding: 8px; line-height: 1.3;">
                ${p.gxpText}
            </td>
        </tr>
        <tr>
        <td style="padding:0; vertical-align:middle;">
            <div style="padding:10px;">Smear Microscopy</div>
        </td>
        <td style="padding:0;">
            <table style="width:100%; border:none; margin:0;" cellspacing="0">
                <tr>
                    <td rowspan="2" style="border:none; border-right:1px solid #000; border-bottom:1px solid #000; width:25%; vertical-align:middle;">Reading</td>
                    <td style="border:none; border-right:1px solid #000; border-bottom:1px solid #000; width:37.5%;">1</td>
                    <td style="border:none; border-bottom:1px solid #000; width:37.5%;">2</td>
                </tr>
                <tr>
                    <td class="smear-reading-box" style="border:none; border-right:1px solid #000; border-bottom:1px solid #000;">
                        ${p.smear1}
                    </td>
                    <td class="smear-reading-box" style="border:none; border-bottom:1px solid #000;">
                        ${p.smear2}
                    </td>
                </tr>
                <tr>
                    <td style="border:none; border-right:1px solid #000; font-size:8.5pt; vertical-align:middle;">Laboratory Diagnosis</td>
                    <td class="${p.dssmClass} diagnosis-text-large" colspan="2" style="border:none;">
                        ${p.dssmText}
                    </td>
                </tr>
            </table>
        </td>
        </tr>
        </table>

        <div class="content-spacer"></div>

        <div class="footer-section">
            <div class="sig-container">
                <div class="sig-block" style="text-align:left;">
                    <div class="sig-label">Performed By:</div>
                    <div class="sig-visual-area" style="justify-content: flex-start;">
                        ${performer.sigUrl ? `<img src="${performer.sigUrl}" class="esig-img" style="left:0; transform:none;">` : ""}
                        <div class="sig-name" style="text-align:left;">${p.encoder}</div>
                    </div>
                    <div class="sig-info" style="text-align:left;">${performer.role}<br>Lic No. ${performer.license || "__________"}</div>
                </div>

                <div class="sig-block" style="text-align:right;">
                    <div class="sig-label" style="text-align:right;">Noted By:</div>
                    <div class="sig-visual-area" style="justify-content: flex-end;">
                        <div class="sig-name" style="text-align:right;">RODOLFO S. NARCISO JR. MD</div>
                    </div>
                    <div class="sig-info" style="font-weight:bold; text-transform:uppercase; text-align:right;">
                        Municipal Health Officer
                    </div>
                </div>
            </div>

            <div style="margin-top:8px; font-size:8px;">
                Date and Time Released: <span class="line" style="width:200px;">${new Date().toLocaleString()}</span>
            </div>
            <div style="padding-top:2px; border-top:1px solid #ddd; text-align:center; margin-top:5px;">
                <div style="font-size:4px; color:#555; font-style:italic;">
                    This report is system generated by the Angono MHO Laboratory Information System.<br>Please note that these results are confidential and intended only for the use of the individual or entity to whom they are addressed.<br>
                Any alteration to this document renders it invalid.
                </div>
            </div>
            <div class="footer-red">"Angono Dream, Artist Paradise, Keep Moving"</div>
            </div>
        </div>`;
        
        const breakTag = (index < patientsArray.length - 1) ? '<div class="page-break"></div>' : '';
        combinedHtml += pageHtml + breakTag;
    });

    return `<!DOCTYPE html><html><head><title>NTP Form 2A Batch</title>
    <style>
        @page { size: portrait; margin: 5mm; } 
        body { font-family: 'Inter', Arial, sans-serif; font-size: 9pt; margin: 0; padding: 0; -webkit-print-color-adjust: exact; background: #e2e8f0; display: flex; flex-direction: column; align-items: center; padding-top: 70px; }
        body, table, td, th, .line, div, span { font-size: 9pt !important; font-family: 'Inter', Arial, sans-serif !important; }
        .smear-reading-box { height: 25px !important; vertical-align: middle !important; font-weight: bold !important; font-size: 10pt !important; text-align: center !important; }
        .diagnosis-text-large { height: 25px !important; vertical-align: middle !important; font-weight: bold !important; font-size: 10pt !important; text-transform: uppercase; text-align: center !important; }

        .page-container { width: 100%; max-width: 210mm; height: auto; min-height: 275mm; padding: 10mm 10mm 15mm 10mm; box-sizing: border-box; background: white; display: flex; flex-direction: column; overflow: hidden; position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }

        .header { background: linear-gradient(to bottom, #ff0000 0%, #ffb6c1 100%); border: 2px solid #000; padding: 10px 5px; height: auto; min-height: 90px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .logo-side { width: 80px; height: 80px; background: #fff; border-radius: 50%; object-fit: contain; }
        .logo-lab { width: 35px; height: 35px; background: #fff; border-radius: 50%; border: 1px solid #ddd; margin-bottom: 2px; }
        .header-center { flex-grow: 1; text-align: center; }
        .header h1 { font-size: 15pt; margin: 0; }
        .header h2 { font-size: 11pt; margin: 0; }
        .header h3 { font-size: 9pt; margin: 0; }
        .header p { font-size: 8px; margin: 2px 0 0 0; font-weight: bold; color: #000; }

        .form-title { text-align: center; font-weight: bold; font-size: 11px; margin: 8px 0 4px 0; }
        .main-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 2px; }
        .main-table td { padding: 3px 5px; border: 1px solid #000; }
        .line { border-bottom: 1px solid #000; display: inline-block; padding-left: 5px; font-weight: bold; min-height: 13px; }
        .chk-item { display: inline-flex; align-items: center; gap: 3px; margin-right: 10px; font-size: 9px; }
        input[type="checkbox"] { margin: 0; width: 11px; height: 11px; }
        .res-table-inner { width: 100%; border-collapse: collapse; }
        .res-table-inner th, .res-table-inner td { border: 1px solid #000; text-align: center; padding: 4px; font-size: 9px; }
        .section-bar { background: #d9d9d9; font-size: 9px; text-align: center; border: 1px solid #000; padding: 3px; font-weight: bold; }

        .res-n { background-color: #C8E6C9 !important; color: #1B5E20 !important; } 
        .res-t { background-color: #FFCDD2 !important; color: #B71C1C !important; } 
        .res-rr { background-color: #B71C1C !important; color: white !important; }   
        .res-ti { background-color: #FFE0B2 !important; color: #E65100 !important; } 
        .res-tt { background-color: #FFF9C4 !important; color: #827717 !important; } 
        .res-i { background-color: #000000 !important; color: white !important; }    
        .res-init { background-color: #EEEEEE !important; color: #757575 !important; } 

        .footer-section { width: 100%; margin-top: auto; padding-bottom: 5px; flex-shrink: 0; }
        .content-spacer { flex-grow: 1; }
        .sig-container { display: flex; justify-content: space-between; margin-top: 5px; }
        .sig-block { width: 32%; text-align: center; display: flex; flex-direction: column; min-height: 90px; }
        .sig-label { font-size: 9px; margin-bottom: 2px; text-align: left; }
        .sig-visual-area { position: relative; width: 100%; height: 40px; display: flex; align-items: flex-end; }
        .esig-img { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); height: 50px; mix-blend-mode: multiply; }
        .sig-name { font-weight: bold; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #000; width: 100%; padding-top: 5px; }
        .sig-info { font-size: 8px; margin-top: 3px; line-height: 1.2; }
        .footer-red { background: #ff0000; color: white; font-weight: bold; text-align: center; padding: 5px; font-size: 13px; margin-top: 5px; border: 1px solid #000; }

        .no-print { position: fixed; top: 0; left: 0; width: 100%; background: #1e293b; padding: 12px; text-align: center; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); } 
        .no-print button { padding: 10px 20px; margin: 0 5px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-family: sans-serif; font-size: 14px; } 
        .btn-print { background: #10b981; color: white; } 
        .btn-close { background: #ef4444; color: white; } 
        .preview-text { color: white; font-family: sans-serif; font-size: 14px; margin-right: 20px; font-weight: normal; }

        /* 🟢 FORCED A5 PORTRAIT WITH PROPORTIONAL FIT 🟢 */
        @media print { 
            .no-print { display: none !important; } 
            body { background: white; padding-top: 0 !important; display: block; margin: 0; } 
            
            /* 🟢 1. I-lock ang printer sa A5 Portrait size (Lapad x Taas) */
            @page { size: 148mm 210mm; margin: 5mm; } 
            
            .page-container { 
                /* 🟢 2. Panatilihin ang A4 na sukat sa loob para hindi masira ang mga tables */
                width: 190mm !important; 
                max-width: 190mm !important;
                height: auto !important; 
                min-height: 275mm !important; 
                margin: 0 auto !important; 
                padding: 6mm 10mm !important; 
                border: none !important; 
                box-shadow: none !important; 
                overflow: visible !important; 
                page-break-after: always;
                page-break-inside: avoid;
                
                /* 🟢 3. MAGIC: Paliitin nang 70% ang buong A4 design para sumakto sa A5! */
                zoom: 0.70; 
            } 
            .page-break { display: none !important; } 
        }
    </style>
    </head><body>
    <div class="no-print">
        <span class="preview-text">⏳ PREVIEW: Wait for logos to load before printing</span>
        <button class="btn-print" onclick="window.print()">🖨️ PRINT / SAVE AS PDF</button>
        <button class="btn-close" onclick="window.close()">❌ CLOSE</button>
    </div>
    ${combinedHtml}
    ${(String(currentUser.role).toUpperCase() === 'ADMIN' || String(currentUser.role).toUpperCase() === 'STAFF') ? '<script>setTimeout(function(){ window.print(); }, 800);</script>' : ''}
    </body></html>`;
}

function localGenerateA5Html(patientsArray) {
    const logos = { left: "https://lh3.googleusercontent.com/d/1ZX23SKg3CAe8JYPoaJbF5HHCT4UUZjQG", lab: "https://lh3.googleusercontent.com/d/1xYN202dyNGl7cO1E8qokOkX8m6mepXyK", right: "https://lh3.googleusercontent.com/d/1BqWTCHhIrJXMNDC4juCEC8FmxWtC3iBs" };
    let combinedHtml = "";
    
    const getUnit = (pName) => { const n = String(pName).toUpperCase(); if (n.includes("HEMOGLOBIN")) return "g/L"; if (n.includes("HEMATOCRIT")) return "L/L"; if (n.includes("WBC") || n.includes("PLATELET")) return "x10⁹/L"; if (n.includes("RBC")) return "x10¹²/L"; if (n.includes("NEUTROPHIL") || n.includes("LYMPHOCYTE") || n.includes("MONOCYTE") || n.includes("EOSINOPHIL") || n.includes("BASOPHIL")) return "Frac"; if (n.includes("HBA1C")) return "%"; if (n.includes("GLUCOSE") || n.includes("FBS") || n.includes("RBS") || n.includes("OG")) return "mmol/L"; if (n.includes("CHOLESTEROL") || n.includes("TRIG") || n.includes("HDL") || n.includes("LDL")) return "mmol/L"; if (n.includes("URIC") || n.includes("BUA")) return "mmol/L"; if (n.includes("BUN") || n.includes("UREA")) return "mmol/L"; if (n.includes("CREATININE")) return "µmol/L"; if (n.includes("SGPT") || n.includes("ALT")) return "U/L"; if (n.includes("SGOT") || n.includes("AST")) return "U/L"; return ""; };
    const getNormal = (pName) => { const n = String(pName).toUpperCase(); if (n.includes("HEMOGLOBIN")) return "M:140-170 F:120-150"; if (n.includes("HEMATOCRIT")) return "M:0.40-0.54 F:0.37-0.47"; if (n.includes("WBC")) return "4.5 - 11.0"; if (n.includes("RBC")) return "4.0 - 6.0"; if (n.includes("PLATELET")) return "150 - 450"; if (n.includes("NEUTROPHIL")) return "0.50 - 0.70"; if (n.includes("LYMPHOCYTE")) return "0.20 - 0.40"; if (n.includes("MONOCYTE")) return "0.02 - 0.08"; if (n.includes("EOSINOPHIL")) return "0.01 - 0.04"; if (n.includes("BASOPHIL")) return "0.00 - 0.01"; if (n.includes("HBA1C")) return "4.0 - 6.0"; if (n.includes("RBS")) return "< 7.8"; if (n.includes("OG0") || n.includes("FASTING")) return "< 5.1"; if (n.includes("OG1") || n.includes("1 HR")) return "< 10.0"; if (n.includes("OG2") || n.includes("2 HR")) return "< 8.5"; if (n.includes("GLUCOSE") || n.includes("FBS")) return "3.89 - 6.11"; if (n.includes("CHOLESTEROL")) return "< 5.17"; if (n.includes("TRIGLYCERIDE")) return "< 2.2"; if (n.includes("HDL")) return "> 0.9"; if (n.includes("LDL")) return "< 3.3"; if (n.includes("CREATININE")) return "M:62-106 F:44-80"; if (n.includes("URIC") || n.includes("BUA")) return "M:0.21-0.42 F:0.16-0.36"; if (n.includes("BUN")) return "2.5 - 7.1"; if (n.includes("SGPT") || n.includes("ALT")) return "M:<41 F:<31"; if (n.includes("SGOT") || n.includes("AST")) return "M:<40 F:<32"; return ""; };

    const getStaff = (name) => {
        if(!name) return { name: "", role: "Medical Technologist", license: "", sigUrl: "" };
        const nLower = String(name).trim().toLowerCase();
        const words = nLower.replace(/\./g, '').split(/\s+/);
        
        const found = (globalStaffList || []).find(s => {
            const sLower = s.name.toLowerCase();
            if (sLower === nLower) return true;
            if (words.length > 1 && sLower.includes(words[0]) && sLower.includes(words[words.length-1])) return true;
            return sLower.includes(nLower) || nLower.includes(sLower);
        });
        
        return found || { name: name, role: "Medical Technologist", license: "", sigUrl: "" };
    };

    patientsArray.forEach((p, index) => {
        let verifier = getStaff(p.verifier); let performer = getStaff(p.encoder);
        const tName = (p.testName || "").toUpperCase(); 
        const isDengue = tName.includes("DENGUE") || tName.includes("NS1"); 
        const isGram = tName.includes("GRAM"); 
        const isViral = tName.includes("VIRAL") || tName.includes("HIV-1") || tName.includes("GXVL"); 
        const isFecal = tName.includes("FECAL"); 
        const isUrine = tName.includes("URIN") || tName.includes("UA"); 
        const isSero = tName.includes("SERO") || tName.includes("HIV") || tName.includes("SYPHILIS") || tName.includes("HBSAG"); 
        const isChem = tName.includes("CHEM"); 
        const isHema = tName.includes("HEMA") || tName.includes("CBC");
        
        // 🟢 FIX: Kukuha ng Address at Contact sa local cache kung blangko
        const cachedP = cachedPatients.find(cp => cp.id === p.id) || {};
        p.address = (p.address && p.address !== "undefined") ? p.address : (cachedP.address || "");
        p.contact = (p.contact && p.contact !== "undefined") ? p.contact : (cachedP.contact || "");

        if (!p.remarks && p.results) { let remarkObj = p.results.find(r => r.param === "Remarks" || r.param === "REMARKS"); if (remarkObj) { p.remarks = remarkObj.res; } }
        if (p.results) { p.results = p.results.filter(r => { const P = String(r.param).toUpperCase(); if (P === "REMARKS" || P.includes("REMARK")) return false; if (P.includes("REQUEST")) return false; if (isSero && (P.includes("KAP") || P.includes("CLASSIFICATION"))) return false; if (isUrine && (P.includes("KETONES") || P.includes("BLOOD") || P.includes("BILIRUBIN") || P.includes("NITRITE"))) return false; return true; }); }

        let mainContent = "";
        
        if (isViral) { let choiceObj = p.results.find(r => r.param.toUpperCase().includes("CHOIC") || r.param.toUpperCase().includes("RESULT")); let numObj = p.results.find(r => r.param.toUpperCase().includes("NUMB") || r.param.toUpperCase().includes("COPIES")); let resultVal = choiceObj ? choiceObj.res : "N/A"; let copiesVal = numObj ? numObj.res : ""; let logVal = "N/A"; let cleanNum = String(copiesVal).replace(/[^0-9.]/g, ''); if (cleanNum && !isNaN(cleanNum)) { logVal = Math.log10(parseFloat(cleanNum)).toFixed(2); } else if (String(copiesVal).includes("<")) { logVal = "< 1.60"; } mainContent = `<div style="width:90%; margin-top:10px; border:2px solid #000; padding:15px;"><div style="font-weight:bold; font-size:12px; text-decoration:underline; margin-bottom:15px; text-align:center;">HIV-1 VIRAL LOAD QUANTIFICATION</div><table style="width:100%; border:none;"><tr><td style="border:none; width:40%; font-weight:bold; font-size:11px;">HIV-1 QUALITATIVE RESULT:</td><td style="border-bottom:1px solid #000; font-weight:bold; font-size:12px; text-align:center;">${resultVal}</td></tr><tr><td colspan="2" style="border:none; height:10px;"></td></tr><tr><td style="border:none; width:40%; font-weight:bold; font-size:11px;">RESULT (Copies/mL):</td><td style="border-bottom:1px solid #000; font-weight:bold; font-size:12px; text-align:center;">${copiesVal || "N/A"}</td></tr><tr><td colspan="2" style="border:none; height:10px;"></td></tr><tr><td style="border:none; width:40%; font-weight:bold; font-size:11px;">LOG VALUE (log10):</td><td style="border-bottom:1px solid #000; font-weight:bold; font-size:12px; text-align:center;">${logVal}</td></tr></table><div style="font-size:8px; font-style:italic; margin-top:15px; text-align:center;">Test Method: Real-Time PCR (GeneXpert). Linear Range: 40 to 10,000,000 copies/mL.</div></div>`; }
        else if (isGram) { const findRes = (keyPart) => { let found = p.results.find(r => r.param.toUpperCase().includes(keyPart)); return (found && found.res && found.res.trim() !== "") ? found.res : "NONE SEEN"; }; let posQuant = findRes("GP_QUANT"); let posMorph = findRes("GP_MORPH"); let posArr = findRes("GP_ARRANG"); let negQuant = findRes("GN_QUANT"); let negMorph = findRes("GN_MORPH"); let negArr = findRes("GN_ARRANG"); mainContent = `<table class="res-table" style="width: 100%; margin-top: 10px;"><thead><tr><th width="20%">TEST</th><th width="20%">QUANTITY</th><th width="30%">MORPHOLOGY</th><th width="30%">ARRANGEMENT</th></tr></thead><tbody><tr><td style="font-weight:bold; padding:8px;">Gram Positive</td><td style="text-align:center;">${posQuant}</td><td style="text-align:center;">${posMorph}</td><td style="text-align:center;">${posArr}</td></tr><tr><td style="font-weight:bold; padding:8px;">Gram Negative</td><td style="text-align:center;">${negQuant}</td><td style="text-align:center;">${negMorph}</td><td style="text-align:center;">${negArr}</td></tr></tbody></table>`; }
        else if (isDengue) { let resVal = p.results.find(r => r.param.toUpperCase().includes("RESULT") || r.param.toUpperCase().includes("ANTIGEN"))?.res || ""; let color = (resVal.toUpperCase().includes("POS") || resVal.toUpperCase().includes("REACTIVE")) ? "red" : "black"; mainContent = `<div style="flex-grow:1; display:flex; align-items:center; justify-content:center; width:100%;"><table class="res-table" style="width: 90%; margin-top: 10px;"><thead><tr><th width="50%" style="padding:10px; font-size:11px;">TEST</th><th width="50%" style="padding:10px; font-size:11px;">RESULT</th></tr></thead><tbody><tr><td style="padding:15px; font-weight:bold; font-size:12px;">DENGUE NS1 ANTIGEN</td><td style="padding:15px; text-align:center; font-weight:bold; font-size:14px; color:${color};">${resVal}</td></tr></tbody></table></div>`; }
        else if (isSero) {
            let hivRes = p.results.find(r => r.param.toUpperCase().includes("HIV"))?.res;
            let syphRes = p.results.find(r => r.param.toUpperCase().includes("SYPHILIS"))?.res;
            let hbsagRes = p.results.find(r => r.param.toUpperCase().includes("HBSAG"))?.res;
            let rowsHtml = "";
            if (hivRes !== undefined) rowsHtml += `<tr><td style="padding:10px; font-weight:bold; font-size:12px;">HIV 1/2 SCREENING</td><td style="padding:10px; text-align:center; font-weight:bold; font-size:12px;">${hivRes}</td></tr>`;
            if (syphRes !== undefined) rowsHtml += `<tr><td style="padding:10px; font-weight:bold; font-size:12px;">SYPHILIS SCREENING</td><td style="padding:10px; text-align:center; font-weight:bold; font-size:12px;">${syphRes}</td></tr>`;
            if (hbsagRes !== undefined) rowsHtml += `<tr><td style="padding:10px; font-weight:bold; font-size:12px;">HBsAg SCREENING</td><td style="padding:10px; text-align:center; font-weight:bold; font-size:12px;">${hbsagRes}</td></tr>`;
            mainContent = `<div style="flex-grow:1; display:flex; align-items:center; justify-content:center; width:100%;"><table class="res-table" style="width: 85%; margin-top: 10px;"><thead><tr><th width="50%" style="padding:10px; font-size:11px;">TEST</th><th width="50%" style="padding:10px; font-size:11px;">RESULT</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
        }
        else if (isHema || isChem || isUrine) { const mid = Math.ceil(p.results.length / 2); const left = p.results.slice(0, mid); const right = p.results.slice(mid); let rowsHtml = ""; const hasUnits = isHema || isChem; for(let i=0; i < mid; i++) { const l = left[i]; const r = right[i]; let leftHtml = ""; if (l) { if (hasUnits) { leftHtml = `<td style="font-weight:bold; padding-left:5px;">${l.param}</td><td style="text-align:center; font-weight:bold;">${l.res||""}</td><td style="text-align:center; font-size:8px;">${getUnit(l.param)}</td><td style="text-align:center; font-size:8px;">${getNormal(l.param)}</td>`; } else { leftHtml = `<td style="font-weight:bold; padding-left:5px;">${l.param}</td><td style="text-align:center; font-weight:bold;">${l.res||""}</td>`; } } else { leftHtml = hasUnits ? `<td colspan="4"></td>` : `<td colspan="2"></td>`; } let rightHtml = ""; if (r) { if (hasUnits) { rightHtml = `<td style="font-weight:bold; padding-left:5px;">${r.param}</td><td style="text-align:center; font-weight:bold;">${r.res||""}</td><td style="text-align:center; font-size:8px;">${getUnit(r.param)}</td><td style="text-align:center; font-size:8px;">${getNormal(r.param)}</td>`; } else { rightHtml = `<td style="font-weight:bold; padding-left:5px;">${r.param}</td><td style="text-align:center; font-weight:bold;">${r.res||""}</td>`; } } else { rightHtml = hasUnits ? `<td colspan="4"></td>` : `<td colspan="2"></td>`; } rowsHtml += `<tr>${leftHtml}${rightHtml}</tr>`; } let headerHtml = hasUnits ? `<tr><th width="20%">TEST</th><th width="10%">RESULT</th><th width="10%">UNIT</th><th width="10%">NORMAL</th><th width="20%">TEST</th><th width="10%">RESULT</th><th width="10%">UNIT</th><th width="10%">NORMAL</th></tr>` : `<tr><th width="30%">TEST</th><th width="20%">RESULT</th><th width="30%">TEST</th><th width="20%">RESULT</th></tr>`; mainContent = `<table class="res-table" style="width: 100%; margin-top: 5px; font-size: 9px;"><thead>${headerHtml}</thead><tbody>${rowsHtml}</tbody></table>`; }
        else { let rowsHtml = ""; const tableStyle = isFecal ? "width: 75%; margin: 10px auto;" : "width: 100%; margin-top: 10px;"; const padStyle = "padding:4px;"; p.results.forEach(r => { const val = (r.res === "" || r.res === undefined || r.res === null) ? "&nbsp;" : r.res; rowsHtml += `<tr><td style="text-align:left; padding-left:10px; font-weight:bold; ${padStyle} width:40%;">${r.param}</td><td style="font-weight:bold; text-align:center; ${padStyle} width:60%;">${val}</td></tr>`; }); mainContent = `<div style="flex-grow:1; display:flex; justify-content:center; width:100%;"><table class="res-table" style="${tableStyle}"><thead><tr><th width="40%">TEST / PARAMETER</th><th width="60%">RESULT</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`; }

        const pageHtml = `
        <div class="page-container">
            <div class="header">
                <img src="${logos.left}" class="logo-side">
                <div class="header-center">
                    <img src="${logos.lab}" class="logo-lab">
                    <h3>Republic of the Philippines<br>Province of Rizal<br>Municipality of Angono</h3>
                    <h1>Municipal Health Office</h1>
                    <h3>P. Tolentino St. Brgy. San Isidro, Angono, Rizal</h3>
                </div>
                <img src="${logos.right}" class="logo-side">
            </div>
            <div class="form-title">${p.testName}</div>
            <table class="info-table">
                <tr><td width="12%" class="label">Name:</td><td width="48%" class="data"><strong>${p.name}</strong></td><td width="15%" class="label">Age/Sex:</td><td width="25%" class="data">${p.age} / ${p.sex}</td></tr>
                <tr><td class="label">Patient ID:</td><td class="data">${p.id} <span style="font-size:8px; color:#555; margin-left:8px;">(${p.testCode || ""})</span></td><td class="label">Date Recv:</td><td class="data">${p.dateRequest || ""}</td></tr>
                <tr><td class="label">Facility:</td><td class="data">${p.facility}</td><td class="label">Date Rel:</td><td class="data">${p.dateResult || p.dateRequest || ""}</td></tr>
            </table>
            <div style="flex-grow:1; display:flex; flex-direction:column; width:100%;">
                ${mainContent}
            </div>
            <div class="remarks-box"><strong>Remarks:</strong> ${p.remarks || ""}</div>
            <div class="footer-section">
              <div class="sig-container">
                    <div class="sig-block" style="text-align:left;">
                        <div class="sig-label">Performed By:</div>
                        <div class="sig-visual-area" style="justify-content: flex-start;">
                            ${performer.sigUrl ? `<img src="${performer.sigUrl}" class="esig-img" style="left:0; transform:none;">` : ""}
                            <div class="sig-name" style="text-align:left;">${p.encoder}</div>
                        </div>
                        <div class="sig-info">${performer.role}<br>Lic No. ${performer.license}</div>
                    </div>
                    <div class="sig-block" style="text-align:right;">
                        <div class="sig-label" style="text-align:right;">Noted By:</div>
                        <div class="sig-visual-area" style="justify-content: flex-end;">
                            <div class="sig-name" style="text-align:right;">RODOLFO S. NARCISO JR. MD</div>
                        </div>
                        <div class="sig-info">Municipal Health Officer</div>
                    </div>
                </div>
                <div class="system-footer">This report is system generated by the Angono MHO Laboratory Information System.<br>Please note that these results are confidential and intended only for the use of the individual or entity to whom they are addressed.</div>
                <div class="footer-red">"Angono Dream, Artist Paradise, Keep Moving"</div>
            </div>
        </div>`;

        const breakTag = (index < patientsArray.length - 1) ? '<div class="page-break"></div>' : '';
        combinedHtml += pageHtml + breakTag;
    });

    return `<!DOCTYPE html><html><head><title>Batch Print</title>
    <style>
        @page { size: A5 landscape; margin: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 11px; background: #e2e8f0; display: flex; flex-direction: column; align-items: center; padding-top: 70px; }
        .page-container { width: 210mm; height: 148mm; background: white; padding: 5mm 10mm; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.2); margin-bottom: 20px;}
        .header { background: linear-gradient(to bottom, #ff0000 0%, #ffb6c1 100%); border: 2px solid #000; padding: 5px; height: 90px; display: flex; align-items: center; justify-content: space-between; -webkit-print-color-adjust: exact; flex-shrink: 0; }
        .header-center { text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
        .header h3 { font-size: 9px; margin: 0; font-weight: normal; line-height: 1.0; }
        .header h1 { font-size: 11px; margin: 2px 0; font-weight: bold; line-height: 1.0; }
        .header p { font-size: 9px; margin: 2px 0 0 0; font-weight: bold; line-height: 1.0; }
        .logo-side { width: 65px; height: 65px; background: #fff; border-radius: 50%; object-fit: contain; }
        .logo-lab { width: 40px; height: 40px; background: #fff; border-radius: 50%; margin-bottom: 2px; align-self: center; margin-top: 10px; }
        .form-title { text-align: center; font-weight: bold; font-size: 14px; margin: 5px 0; text-transform: uppercase; border: 1px solid black; background: #eee; -webkit-print-color-adjust: exact; flex-shrink: 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .info-table td { border: 1px solid black; padding: 2px 5px; }
        .label { background: #f0f0f0; font-weight: bold; -webkit-print-color-adjust: exact; width: 15%; }
        .res-table { border: 2px solid black; }
        .res-table th { background: #ddd; border: 1px solid black; padding: 4px; font-size: 10px; -webkit-print-color-adjust: exact; }
        .res-table td { border: 1px solid black; padding: 2px; font-size: 10px; }
        .remarks-box { border: 1px solid black; padding: 2px 5px; margin-top: 5px; font-size: 10px; min-height: 20px; flex-shrink: 0; }
        .footer-section { margin-top: auto; padding-bottom: 5px; flex-shrink: 0; }
        .sig-container { display: flex; justify-content: space-between; }
        .sig-block { width: 32%; text-align: center; }
        .sig-visual-area { height: 40px; position: relative; display: flex; align-items: flex-end; justify-content: center; }
        .esig-img { position: absolute; bottom: 5px; height: 45px; mix-blend-mode: multiply; }
        .sig-name { font-weight: bold; font-size: 10px; border-top: 1px solid black; width: 100%; padding-top: 2px; }
        .sig-info { font-size: 9px; }
        .system-footer { font-size: 7px; text-align: center; color: #555; margin-top: 4px; font-style: italic; }
        .footer-red { background: #ff0000; color: white; font-weight: bold; text-align: center; font-size: 10px; padding: 3px; border: 1px solid black; margin-top: 2px; -webkit-print-color-adjust: exact; }
        
        .no-print { position: fixed; top: 0; left: 0; width: 100%; background: #1e293b; padding: 12px; text-align: center; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); } 
        .no-print button { padding: 10px 20px; margin: 0 5px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-family: sans-serif; font-size: 14px; } 
        .btn-print { background: #10b981; color: white; } 
        .btn-close { background: #ef4444; color: white; } 
        .preview-text { color: white; font-family: sans-serif; font-size: 14px; margin-right: 20px; font-weight: normal; }
        
        /* 🟢 FORCED A5 LANDSCAPE WITH MANUAL ADJUSTMENT READY 🟢 */
        @media print { 
            .no-print { display: none !important; } 
            body { background: white; padding-top: 0 !important; display: block; margin: 0; } 
            
            /* 🟢 1. I-lock ang printer sa A5 Landscape (Lapad 210mm x Taas 148mm) */
            @page { size: 210mm 148mm; margin: 0; } 
            
            .page-container { 
                /* 🟢 2. Saktong sukat ng A5 */
                width: 210mm !important; 
                max-width: 210mm !important;
                height: 148mm !important; 
                max-height: 148mm !important;
                margin: 0 auto !important; 
                padding: 4mm 10mm !important; /* Dito mo i-adjust ang space sa loob */
                border: none !important; 
                box-shadow: none !important; 
                
                /* 🟢 3. MAGIC CHEAT CODE: Babaan ito kung putol ang footer (e.g., 0.95 o 0.90) */
                zoom: 0.95; 
                
                overflow: visible !important; /* Para laging lumabas ang text kahit sumagad */
                page-break-after: always;
                page-break-inside: avoid;
            } 
            .page-break { display: none !important; } 
        }
    </style>
    </head><body>
    <div class="no-print">
        <span class="preview-text">⏳ PREVIEW: Wait for logos to load before printing or saving</span>
        <button class="btn-print" onclick="window.print()">🖨️ PRINT / SAVE AS PDF</button>
        <button class="btn-close" onclick="window.close()">❌ CLOSE</button>
    </div>
    ${combinedHtml}
    ${(String(currentUser.role).toUpperCase() === 'ADMIN' || String(currentUser.role).toUpperCase() === 'STAFF') ? '<script>setTimeout(function(){ window.print(); }, 800);</script>' : ''}
    </body></html>`;
}

function showPrintModal(htmlContent) {
    let modal = document.getElementById('print-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'print-modal-overlay';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0,0,0,0.6)'; 
        modal.style.zIndex = '999999';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';      
        modal.style.justifyContent = 'center';  
        
        // 🟢 BAGO: Kapag kinlick ang maitim na background sa labas, magsasara din agad!
        modal.onclick = function(e) {
            if (e.target === modal) window.closePrintModal();
        };

        const iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.width = '90%';
        iframe.style.maxWidth = '1100px'; 
        iframe.style.height = '90%';
        iframe.style.maxHeight = '850px'; 
        iframe.style.border = 'none';
        iframe.style.borderRadius = '12px'; 
        iframe.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)'; 
        iframe.style.backgroundColor = '#e2e8f0';
        
        modal.appendChild(iframe);
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    
    // 🟢 FIX: Nilagyan ng backslash (\) para hindi magdoble ang parenthesis at gumana ang Close Button!
    const safeHtml = htmlContent.replace(/window\.close\(\)/g, 'window.parent.closePrintModal()');
    
    const iframe = document.getElementById('print-iframe');
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(safeHtml);
    iframe.contentWindow.document.close();
}

// ==========================================
// ⚡ SUPER SPEED FIX: Instant Local Printing
// ==========================================
async function printDirect(e, id, testName) { 
    if(e) e.stopPropagation(); 
    const correctCode = getTestCodeFromName(testName);
    showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #64748b;"><i class="ph ph-spinner ph-spin"></i> Generating Document...</h2>');
    
    // 🟢 FIX: Kunin na lang sa local data para instant, wag nang maghintay sa server!
    let item = window.completedData.find(d => String(d.id) === String(id).trim()) || window.pendingData.find(d => String(d.id) === String(id).trim());

    if (item) {
        let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
        let resultsArr = [];
        for (let key in detailsObj) { resultsArr.push({ param: key, res: detailsObj[key] }); }

        let patientData = {
            id: item.patientId, name: item.name || detailsObj.name || "", age: detailsObj.age || detailsObj.Age || "", sex: detailsObj.sex || detailsObj.Sex || "",
            facility: detailsObj.facility || detailsObj.Facility || item.facility || "", address: detailsObj.address || detailsObj.Address || "", contact: detailsObj.contact || detailsObj.Contact || "",
            dateRequest: item.date ? new Date(item.date).toLocaleDateString() : TODAY_STR, 
            dateExamined: detailsObj.dateEncoded ? new Date(detailsObj.dateEncoded).toLocaleDateString() : TODAY_STR, 
            dateResult: detailsObj.dateEncoded ? new Date(detailsObj.dateEncoded).toLocaleDateString() : TODAY_STR, 
            testCode: item.id, testName: item.test,
            encoder: item.encoder || "System", verifier: "", results: resultsArr
        };

        const isNTP = correctCode === "GXP" || correctCode === "DSSM";
        let finalHtml = isNTP ? localGenerateNTPHtml([patientData]) : localGenerateA5Html([patientData]);
        showPrintModal(finalHtml);
    } else {
        // Fallback: Kapag wala sa local cache (e.g. galing Registry), tsaka lang tatawag sa server
        try { 
            const res = await apiPost("printFromRegistry", { requests: [{testCode: id, testName: correctCode}], role: currentUser.role }); 
            if (res.status === "success" && res.data) { 
                let printData = res.data;
                let finalHtml = printData.type === "HTML" ? printData.content : ((correctCode === "GXP" || correctCode === "DSSM") ? localGenerateNTPHtml(printData.content) : localGenerateA5Html(printData.content));
                showPrintModal(finalHtml); 
            } else { showPrintModal('<h2 style="text-align:center;">Document not found.</h2>'); } 
        } catch (err) { showPrintModal('<h2 style="text-align:center;">Print Error.</h2>'); } 
    }
}

// ⚡ SUPER SPEED FIX: Magpa-pop up ang form habang tahimik na nagse-save ang server
async function saveAndPrintResult(id, safeId, btn) {
    const inputs = document.querySelectorAll('.res-' + safeId); 
    const item = window.pendingData.find(d => String(d.id) === String(id).trim());
    let newResults = {}; inputs.forEach(inp => { newResults[inp.getAttribute('data-key')] = inp.value; });
    let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
    let tCodePrint = getTestCodeFromName(item.test);
    
    if (tCodePrint === "GXP" && (!newResults["Remarks"] || newResults["Remarks"].trim() === "")) {
        if (detailsObj["X-Ray Result"]) { newResults["Remarks"] = "X-Ray: " + detailsObj["X-Ray Result"]; }
    }
    
    let finalStr = JSON.stringify({ ...detailsObj, ...newResults });
    btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';

    // 🟢 FIX: Ilalabas natin AGAD ang form para walang delay sa mata mo!
    let resultsArr = [];
    let finalDetails = { ...detailsObj, ...newResults };
    for (let key in finalDetails) { resultsArr.push({ param: key, res: finalDetails[key] }); }
    
    let patientData = {
        id: item.patientId, name: item.name || finalDetails.name || "", age: finalDetails.age || finalDetails.Age || "", sex: finalDetails.sex || finalDetails.Sex || "",
        facility: finalDetails.facility || finalDetails.Facility || "", address: finalDetails.address || finalDetails.Address || "", contact: finalDetails.contact || finalDetails.Contact || "",
        dateRequest: TODAY_STR, dateExamined: TODAY_STR, dateResult: TODAY_STR, testCode: item.id, testName: item.test,
        encoder: currentUser.fullName || currentUser.username, verifier: "", results: resultsArr
    };
    
    const isNTP = tCodePrint === "GXP" || tCodePrint === "DSSM";
    let finalHtml = isNTP ? localGenerateNTPHtml([patientData]) : localGenerateA5Html([patientData]);
    showPrintModal(finalHtml); 

    // Hayaan lang nating tapusin ng server ang pag-save sa background
    apiPost("saveLabResult", { patientId: item.patientId, testId: id, jsonDetails: finalStr, encodedBy: currentUser.fullName || currentUser.username, updatedName: item.name, updatedTest: item.test })
    .then(res => {
        if (res.status === "success") {
            btn.style.background = "var(--success)"; btn.style.color = "white"; btn.innerHTML = '<i class="ph ph-check"></i> Saved';
            loadPendingData(); 
        }
    }).catch(err => {
        btn.disabled = false; btn.innerHTML = "Save Error"; 
        showAppAlert("Error", "Failed to save to server. Please try again.", "error");
    });
}

async function batchSaveResults(isPrint) {
    const checked = document.querySelectorAll('.chk-pending:checked');
    if(checked.length === 0) return showAppAlert("Required", "Select at least one record to batch process.", "error");

    const btnSave = document.querySelector('button[onclick="batchSaveResults(false)"]');
    const btnPrint = document.querySelector('button[onclick="batchSaveResults(true)"]');
    if(btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...'; }
    if(btnPrint) { btnPrint.disabled = true; btnPrint.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...'; }

    let successCount = 0; let printRequests = [];

    for (let chk of checked) {
        const id = chk.value; const item = window.pendingData.find(d => String(d.id) === String(id).trim()); if(!item) continue;
        const safeId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, "");
        const inputs = document.querySelectorAll('.res-' + safeId);

        let newResults = {}; inputs.forEach(inp => { newResults[inp.getAttribute('data-key')] = inp.value; });
        let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {});
        let tCodePrint = getTestCodeFromName(item.test);

        if (tCodePrint === "GXP" && (!newResults["Remarks"] || newResults["Remarks"].trim() === "")) { if (detailsObj["X-Ray Result"]) { newResults["Remarks"] = "X-Ray: " + detailsObj["X-Ray Result"]; } }
        let finalStr = JSON.stringify({ ...detailsObj, ...newResults });

        try {
            const res = await apiPost("saveLabResult", { patientId: item.patientId, testId: id, jsonDetails: finalStr, encodedBy: currentUser.fullName || currentUser.username, updatedName: item.name, updatedTest: item.test });
            if (res.status === "success") { successCount++; if (isPrint) printRequests.push({testCode: id, testName: tCodePrint}); }
        } catch(e) {}
    }

    showAppAlert("Batch Complete", `Successfully saved ${successCount} records.`, "success");
    
    // ⚡ SPEED FIX: Background refresh na lang, walang await
    loadPendingData();

    if (isPrint && printRequests.length > 0) {
        showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #64748b;"><i class="ph ph-spinner ph-spin"></i> Generating Batch Print...</h2>');
        try {
            const res = await apiPost("printFromRegistry", { requests: printRequests, role: currentUser.role });
            if (res.status === "success" && res.data) {
                const printData = res.data; let finalHtml = "";
                const firstTestCode = printRequests[0].testName;
                const isNTP = firstTestCode === "GXP" || firstTestCode === "DSSM";
                
                if (printData.type === "HTML") { finalHtml = printData.content; } 
                else if (isNTP) { finalHtml = localGenerateNTPHtml(printData.content); } 
                else { finalHtml = localGenerateA5Html(printData.content); }
                
                showPrintModal(finalHtml);
            } else { showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Error generating print view.</h2>'); }
        } catch(e) { showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Print Error. Please try again.</h2>'); }
    }
}

// ⚡ SPEED FIX: Inalis ang redundant settings download sa Batch Print
async function batchPrint() {
    const checked = document.querySelectorAll('.chk-reg:checked');
    if (checked.length === 0) { showAppAlert("Required", "Select at least one record.", "error"); return; }

    let requests = [];
    checked.forEach(chk => {
        const rowData = JSON.parse(decodeURIComponent(chk.value));
        const codeCol = window.CURRENT_REGISTRY_HEADERS.findIndex(h => h.toUpperCase().includes('TEST CODE'));
        const tCode = rowData[codeCol];
        requests.push({ testCode: tCode, testName: window.CURRENT_TEST_TYPE });
    });

    showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #64748b;"><i class="ph ph-spinner ph-spin"></i> Generating Batch Print...</h2>');

    try {
        const res = await apiPost("printFromRegistry", { requests: requests, role: currentUser.role });
        
        if (res.status === "success" && res.data) {
            const printData = res.data;
            let finalHtml = "";
            const isNTP = window.CURRENT_TEST_TYPE === "GXP" || window.CURRENT_TEST_TYPE === "DSSM";
            
            if (printData.type === "HTML") { finalHtml = printData.content; } 
            else if (isNTP) { finalHtml = localGenerateNTPHtml(printData.content); } 
            else { finalHtml = localGenerateA5Html(printData.content); }
            
            showPrintModal(finalHtml);
        } else { 
            showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Error generating print view.</h2>'); 
        }
    } catch (err) { 
        showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Print Error. Please try again.</h2>'); 
    }
}
