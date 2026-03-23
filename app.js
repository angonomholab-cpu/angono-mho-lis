// ==========================================
// 1. API CONNECTION SETUP
// ==========================================
// PALITAN ITO NG TOTOONG WEB APP URL MO NA NAGTATAPOS SA /exec
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw6Krts8ndJr93iN103htz0zvdn9znxcm8Qqa3Z2WW9snrILKGgp6pbh-kmUqnBjg2i0w/exec"; 

async function apiGet(action, params = {}) {
    let url = new URL(SCRIPT_URL);
    url.searchParams.append('action', action);
    for (let key in params) {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    }
    try {
        const response = await fetch(url);
        const result = await response.json();
        return result; 
    } catch (error) {
        console.error("API GET Error:", error);
        throw error;
    }
}

async function apiPost(action, payload) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: action, ...payload })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("API POST Error:", error);
        throw error;
    }
}

// ==========================================
// 2. GLOBAL STATE & STARTUP
// ==========================================
let currentUser = { username: "", facility: "", role: "", fullName: "" };
const ALL_PAGES = ['page-add-patient', 'page-pending', 'page-registry', 'page-settings', 'page-reports'];

document.addEventListener('DOMContentLoaded', function() {
    const loader = document.getElementById('app-loader');
    const savedUser = localStorage.getItem('labUser');

    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Safety check for malformed data
            if (!currentUser.username || !currentUser.role) throw new Error("Invalid session");

            document.getElementById('login-overlay').style.display = 'none';
            
            // Update UI with User Details
            document.getElementById('display-full-name').innerText = currentUser.fullName || currentUser.username;
            document.getElementById('display-role-facility').innerText = `${currentUser.role} | ${currentUser.facility}`;
            document.getElementById('pill-avatar').innerHTML = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();

            applyPermissions();
            if(loader) loader.style.display = 'none';
            
            // Redirect based on role
            if(currentUser.role === 'VIEWER') showPage('page-registry');
            else showPage('page-add-patient');

        } catch (e) {
            console.error("Startup Session Error:", e);
            localStorage.removeItem('labUser');
            if(loader) loader.style.display = 'none';
            document.getElementById('login-overlay').style.display = 'flex';
        }
    } else {
        if(loader) loader.style.display = 'none';
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

// ==========================================
// 3. NAVIGATION & DATA LOADING CONTROL
// ==========================================
function showPage(targetId) {
    const elId = targetId.startsWith('page-') ? targetId : 'page-' + targetId;
    const cleanId = elId.replace('page-', '');

    // 1. RBAC Check (Role Based Access Control)
    if (!checkAccess(cleanId)) return;

    // 2. Hide all pages
    ALL_PAGES.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 3. Show target page
    const target = document.getElementById(elId);
    if (target) target.style.display = 'block';

    // 4. Update Sidebar Active State
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        // Handle pop-out menus by checking children
        const clickCode = item.getAttribute('onclick') || "";
        if (clickCode.includes(elId) || clickCode.includes(cleanId) || item.id === 'nav-'+cleanId) {
            item.classList.add('active');
        }
    });

    // 5. TRIGGER DATA LOAD BASED ON PAGE
    if (cleanId === 'pending') {
        if (typeof loadPendingData === 'function') loadPendingData();
    } else if (cleanId === 'reports') {
        // Option to pre-load or reset reports
    } else if (cleanId === 'settings') {
        if (typeof loadSettingsData === 'function') loadSettingsData();
    }
}

// FIX: permissions logic for Sidebar IDs
function checkAccess(page) {
    const role = (currentUser && currentUser.role) ? currentUser.role.toUpperCase() : "VIEWER";
    if (role === 'ADMIN') return true;
    
    if (page === 'settings') return false; // Only Admin
    if (page === 'pending' && role === 'VIEWER') return false; 
    if (page === 'add-patient' && role === 'VIEWER') return false;

    return true;
}

function applyPermissions() {
    const role = (currentUser.role || "VIEWER").toUpperCase();
    const navAdd = document.querySelector("li[onclick*='page-add-patient']");
    const navPending = document.getElementById('nav-pending');
    const navReg = document.getElementById('nav-registry');
    const navSet = document.getElementById('nav-settings');

    // Hide everything first
    if(navAdd) navAdd.style.display = 'none';
    if(navPending) navPending.style.display = 'none';
    if(navReg) navReg.style.display = 'none';
    if(navSet) navSet.style.display = 'none';

    // Show based on role
    switch (role) {
        case 'ADMIN':
            if(navAdd) navAdd.style.display = 'flex';
            if(navPending) navPending.style.display = 'flex';
            if(navReg) navReg.style.display = 'flex';
            if(navSet) navSet.style.display = 'flex';
            break;
        case 'STAFF':
            if(navAdd) navAdd.style.display = 'flex';
            if(navPending) navPending.style.display = 'flex';
            if(navReg) navReg.style.display = 'flex';
            break;
        case 'ENCODER':
            if(navAdd) navAdd.style.display = 'flex';
            if(navReg) navReg.style.display = 'flex';
            break;
        case 'VIEWER':
        default:
            if(navReg) navReg.style.display = 'flex';
            break;
    }
}

// ==========================================
// 4. LOGIN & REGISTRATION API
// ==========================================
async function attemptLogin() {
    const uInput = document.getElementById('login_user');
    const pInput = document.getElementById('login_pass');
    const btn = document.getElementById('btn-login');
    const err = document.getElementById('login-error');

    if (!uInput || !pInput) return;
    const u = uInput.value.trim();
    const p = pInput.value.trim();

    if (!u || !p) { err.style.display = 'block'; err.innerText = "Enter credentials."; return; }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>SF Verifying...';
    btn.disabled = true;
    err.style.display = 'none';

    try {
        const res = await apiGet("loginUser", { username: u, password: p });

        if (res.status === "SUCCESS") {
            currentUser = { username: res.username, facility: res.facility, role: res.role, fullName: res.fullName };
            
            document.getElementById('display-full-name').innerText = res.fullName || res.username;
            document.getElementById('display-role-facility').innerText = `${res.role} | ${res.facility}`;
            document.getElementById('pill-avatar').innerHTML = (res.fullName || res.username).charAt(0).toUpperCase();

            applyPermissions();
            localStorage.setItem('labUser', JSON.stringify(currentUser));              
            
            document.getElementById('login-overlay').style.display = 'none';

            if (currentUser.role === 'VIEWER') showPage('page-registry');
            else showPage('page-add-patient');
        } 
        else if (res.status === "PENDING") {
            err.style.display = 'block';
            err.innerHTML = "<i class='ph ph-clock'></i> Pending Approval";
        } 
        else {
            err.style.display = 'block';
            err.innerHTML = "Invalid credentials";
        }
    } catch (error) {
        alert("Server Error. Check connection.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// FIX: Logout logic
function logoutUser() { document.getElementById('logout-modal').style.display = 'flex'; }
function closeLogoutModal() { document.getElementById('logout-modal').style.display = 'none'; }
function confirmLogout() {
    localStorage.removeItem('labUser');
    window.location.reload();
}

// Registration Functions (Kept for completeness)
function showRegister() { document.getElementById('login-card').style.display = 'none'; document.getElementById('register-card').style.display = 'block'; loadRegisterFacilities(); }
function hideRegister() { document.getElementById('register-card').style.display = 'none'; document.getElementById('login-card').style.display = 'block'; }
async function loadRegisterFacilities() {
    const dropdown = document.getElementById('reg_fac');
    if(!dropdown) return;
    dropdown.innerHTML = '<option value="" disabled selected>Loading...</option>';
    try {
        const res = await apiGet("getFacilityList");
        dropdown.innerHTML = '<option value="" disabled selected>Select Facility</option>';
        if (res.status === "success" && res.data) {
            res.data.forEach(fac => { dropdown.innerHTML += `<option value="${fac.name}">${fac.name}</option>`; });
        }
    } catch(e) { dropdown.innerHTML = '<option value="" disabled>Error loading</option>'; }
}
async function submitRegister() {
    const n = document.getElementById('reg_name').value;
    const u = document.getElementById('reg_user').value;
    const p = document.getElementById('reg_pass').value;
    const f = document.getElementById('reg_fac').value;
    if(!n || !u || !p || !f) { alert("Fields required"); return; }
    try {
        const res = await apiPost("registerUser", { data: { username: u, password: p, facility: f, fullName: n }});
        if(res.status === "success") { alert("Sent! Wait for Admin approval."); hideRegister(); } 
        else { alert("Error: " + res.message); }
    } catch(e) { alert("Error connecting."); }
}

// ==========================================
// 5. REGISTRY & MODAL LOGIC
// ==========================================
function openRegistryModal(type) {
    // Navigate to registry page first
    showPage('page-registry');
    
    // Set Title
    const titleEl = document.getElementById('regTitle');
    if(titleEl) titleEl.innerText = type + " Registry";
    
    // Show Loading in table area
    const cont = document.getElementById('registry-table-content');
    if(cont) cont.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);"><i class="ph ph-circle-notch ph-spin" style="font-size:2rem; margin-bottom:8px; color:var(--sys-blue);"></i>Querying SF Database...</div>';

    // Fetch Data
    apiGet("getRegistryData", { type: type, facility: currentUser.facility, role: currentUser.role })
    .then(res => {
        if (res.status === "success") {
            // CALLS RENDER FUNCTION IN THE ADD_PATIENT HTML BLOCK
            if (typeof renderRegistryTable === 'function') {
                renderRegistryTable(res.data);
            } else {
                console.error("renderRegistryTable function not loaded.");
                if(cont) cont.innerHTML = "Error: Render engine not ready.";
            }
        } else {
            throw new Error(res.message);
        }
    })
    .catch(err => {
        if(cont) cont.innerHTML = `<div style="text-align:center; padding:50px; color:var(--sys-red);">Error: ${err.message}</div>`;
    });
}

