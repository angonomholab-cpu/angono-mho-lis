// 🟢 PURE SUPABASE ARCHITECTURE (ULTIMATE FIX) 🟢
// Wala nang Google Apps Script! Direktang kakausapin ng app ang database mo.

let currentUser = { username: "", facility: "", role: "", fullName: "" };
let labOrders = {};
let pendingData = [];
let completedData = [];
let cachedPatients = []; 
let currentRegistryPage = 1;
let registryLimit = 20; 
let isExistingPatient = false; 
let editingPendingId = null;
let currentQuickPatient = null;
let searchTimeout; 
let confirmActionCallback = null; 
window.CURRENT_TEST_TYPE = ""; 
window.REGISTRY_SORT_ORDER = 'DESC'; // Default sorting
const ALL_PAGES = ['page-workspace', 'page-registry', 'page-reports', 'page-settings', 'page-patient'];
const TODAY_STR = new Date().toLocaleDateString(); 

const availableTests = {
    'mtb': { testName: 'GeneXpert MTB/Rif Ultra', testCode: 'GXP', title: 'GeneXpert MTB/RIF', html: '<div class="field-group"><label class="field-label">History of Treatment</label><select data-key="History of Treatment" class="form-select"><option value="New">New</option><option value="Retreatment">Retreatment</option></select></div><div class="field-group"><label class="field-label">Source of Request</label><input type="text" data-key="Source of Request" class="form-input"></div><div class="field-group full-width"><label class="field-label">X-Ray Result</label><input type="text" data-key="X-Ray Result" class="form-input"></div>' },
    'viral': { testName: 'Viral Load', testCode: 'GXVL', title: 'HIV-1 Viral Load', html: '<div class="field-group full-width" style="color:var(--text-muted); font-size:0.8rem;">Proceed to confirmation to add this test.</div>' },
    'dssm': { 
        testName: 'DSSM', 
        testCode: 'DSSM', 
        title: 'DSSM (AFB Smear)', 
        html: `
            <div class="field-group">
                <label class="field-label">Category</label>
                <select data-key="Category" class="form-select" onchange="toggleDssmCategory(this)">
                    <option value="Diagnosis">Diagnosis</option>
                    <option value="Follow-up">Follow-up</option>
                </select>
            </div>
            <div class="field-group" id="dssm-history-group">
                <label class="field-label">History of Treatment</label>
                <input type="text" data-key="History of Treatment" class="form-input" value="New" readonly style="background:var(--bg-subtle);">
            </div>
            <div class="field-group full-width" id="dssm-xray-group">
                <label class="field-label">X-Ray Result (Remarks)</label>
                <input type="text" data-key="X-Ray Result" class="form-input" placeholder="Enter X-ray remarks...">
            </div>
            <div class="field-group" id="dssm-tbcase-group" style="display:none;">
                <label class="field-label">TB Case Number</label>
                <input type="text" data-key="TB Case Number" class="form-input">
            </div>
            <div class="field-group" id="dssm-monthtreat-group" style="display:none;">
                <label class="field-label">Month of Treatment</label>
                <input type="text" data-key="Month of Treatment" class="form-input">
            </div>
        ` 
    }, // <--- SIGURADUHING MAY KUWIT DITO BAGO PUMUNTA SA 'hema'!
    'hema': { testName: 'Hematology', testCode: 'HEMA', title: 'Hematology', html: '<div class="chip-group"><div class="chip" data-val="CBC" onclick="toggleSub(this)">CBC</div><div class="chip" data-val="Blood Typing" onclick="toggleSub(this)">Blood Typing</div></div>' },
    'chem': { testName: 'Blood Chemistry', testCode: 'CHEM', title: 'Blood Chemistry', html: '<div class="chip-group"><div class="chip" data-val="FBS" onclick="toggleSub(this)">FBS</div><div class="chip" data-val="RBS" onclick="toggleSub(this)">RBS</div><div class="chip" data-val="Cholesterol" onclick="toggleSub(this)">Cholesterol</div><div class="chip" data-val="Triglycerides" onclick="toggleSub(this)">Triglycerides</div><div class="chip" data-val="HDL" onclick="toggleSub(this)">HDL</div><div class="chip" data-val="LDL" onclick="toggleSub(this)">LDL</div><div class="chip" data-val="BUN" onclick="toggleSub(this)">BUN</div><div class="chip" data-val="Creatinine" onclick="toggleSub(this)">Creatinine</div><div class="chip" data-val="Uric Acid" onclick="toggleSub(this)">Uric Acid</div><div class="chip" data-val="SGOT" onclick="toggleSub(this)">SGOT/AST</div><div class="chip" data-val="SGPT" onclick="toggleSub(this)">SGPT/ALT</div><div class="chip" data-val="HbA1c" onclick="toggleSub(this)">HbA1c</div></div>' },
    'uria': { testName: 'Urinalysis', testCode: 'UA', title: 'Clinical Microscopy - Urine', html: '<div class="field-group full-width" style="color:var(--text-muted); font-size:0.8rem;">Standard Urinalysis selected.</div>' },
    'feca': { testName: 'Fecalysis', testCode: 'FA', title: 'Clinical Microscopy - Feces', html: '<div class="field-group full-width" style="color:var(--text-muted); font-size:0.8rem;">Standard Fecalysis selected.</div>' },
    'sero': { testName: 'Serology', testCode: 'SERO', title: 'Serology / Immunology', html: '<div class="chip-group"><div class="chip" data-val="HIV" onclick="toggleSub(this)">HIV</div><div class="chip" data-val="Syphilis" onclick="toggleSub(this)">Syphilis</div><div class="chip" data-val="HBsAg" onclick="toggleSub(this)">HBsAg</div></div><div class="field-group" style="margin-top:10px;"><label class="field-label">Classification</label><select data-key="Classification" class="form-select"><option value="Maternal">Maternal</option><option value="SHC">SHC</option><option value="TB Patient">TB Patient</option></select></div><div class="field-group" style="margin-top:10px;"><label class="field-label">KAP Category</label><select data-key="KAP Category" class="form-select"><option value="None">None</option><option value="MSM">MSM</option><option value="TGW">TGW</option><option value="MSW">MSW</option><option value="FSW">FSW</option><option value="PWID">PWID</option></select></div>' },
    'dengue': { testName: 'Dengue', testCode: 'DENGUE', title: 'Dengue Rapid Test', html: '<label style="display:flex; align-items:center; gap:8px; font-weight:600;"><input type="checkbox" id="dn_duo_check" style="width:18px; height:18px; accent-color:var(--pri);"> Dengue Duo (NS1 + IgG/IgM)</label>' },
    'gram': { testName: 'Gram Stain', testCode: 'GRAM', title: 'Gram Stain', html: '<div class="field-group full-width"><label class="field-label">Source of Specimen</label><input type="text" data-key="Source" class="form-input"></div>' }
};

function toggleDssmCategory(selectEl) {
    const val = selectEl.value;
    const historyGrp = document.getElementById('dssm-history-group');
    const xrayGrp = document.getElementById('dssm-xray-group');
    const tbCaseGrp = document.getElementById('dssm-tbcase-group');
    const monthTreatGrp = document.getElementById('dssm-monthtreat-group');
    
    if (val === 'Diagnosis') {
        if(historyGrp) historyGrp.style.display = 'block';
        if(xrayGrp) xrayGrp.style.display = 'block';
        if(tbCaseGrp) tbCaseGrp.style.display = 'none';
        if(monthTreatGrp) monthTreatGrp.style.display = 'none';
    } else {
        if(historyGrp) historyGrp.style.display = 'none';
        if(xrayGrp) xrayGrp.style.display = 'none';
        if(tbCaseGrp) tbCaseGrp.style.display = 'block';
        if(monthTreatGrp) monthTreatGrp.style.display = 'block';
    }
}

function handleDSSMCategory(sel) {
    const val = sel.value;
    const caseGroup = document.getElementById('dssm-case-group');
    const monthGroup = document.getElementById('dssm-month-group');
    const historyGroup = document.getElementById('dssm-history-group');
    const xrayGroup = document.getElementById('dssm-xray-group');
    if(!caseGroup) return;
    if(val === 'Follow-up') {
        caseGroup.style.display = 'block';
        monthGroup.style.display = 'block';
        if(historyGroup) historyGroup.style.display = 'none';
        if(xrayGroup) xrayGroup.style.display = 'none';
    } else {
        caseGroup.style.display = 'none';
        monthGroup.style.display = 'none';
        if(historyGroup) historyGroup.style.display = 'block';
        if(xrayGroup) xrayGroup.style.display = 'block';
    }
}

function closeCustomAlert() { document.getElementById('custom-alert').style.display = 'none'; }
function showAppAlert(title, message, type = 'info') {
    const modal = document.getElementById('custom-alert');
    if(!modal) return console.log(title, message);
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

function parseAnyDate(dStr) {
    if(!dStr) return null;
    let d = new Date(dStr);
    if(!isNaN(d.getTime())) return d;
    let parts = String(dStr).split(/[-/]/);
    if(parts.length === 3) {
        let try1 = new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
        if(!isNaN(try1.getTime())) return try1;
        let try2 = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        if(!isNaN(try2.getTime())) return try2;
    }
    return null;
}

async function apiGet(action, params = {}) {
    try {
        switch (action) {
            case "loginUser": {
                const { data, error } = await sb.from('app_users').select('*').ilike('username', params.username).eq('password', params.password).maybeSingle();
                if (error) throw error;
                if (!data) return { status: "FAIL" };
                if (data.status === "PENDING") return { status: "PENDING" };
                if (data.status === "REJECTED" || data.status === "BANNED") return { status: "FAIL" };
                return { status: "SUCCESS", username: data.username, facility: data.facility, role: data.role, fullName: data.full_name || data.username };
            }
            case "patientLogin": {
                const { data, error } = await sb.from('patients').select('*').ilike('email', params.email).eq('password', params.password).maybeSingle();
                if (error) throw error;
                if (!data) return { status: "FAIL" };
                return { status: "SUCCESS", patientId: data.id, name: data.full_name };
            }
            case "getAllPatientsLight": {
                // Binawasan muna natin sa core columns para iwas 400 error kung may kulang sa table
                const { data, error } = await sb.from('patients').select('*');
                if (error) {
                    console.error("Patient cache error:", error);
                    return { status: "success", data: [] };
                }
                return { status: "success", data: (data || []).map(p => ({
                    id: p.id, 
                    name: p.full_name || p.name || "", 
                    age: p.age || "", 
                    sex: p.sex || "", 
                    facility: p.facility || "", 
                    address: p.address || "", 
                    contact: p.contact || "", 
                    email: p.email || "", 
                    bday: p.bday || ""
                }))};
            }
            case "getPatientHistory": {
                const { data, error } = await sb.from('lab_tests').select('*').eq('patient_id', params.patientId).order('date', { ascending: false });
                if (error) throw error;
                let rows = data || [];
                if (String(params.role).toUpperCase() !== 'ADMIN') rows = rows.filter(r => !String(r.test_name).toUpperCase().includes('VIRAL'));
                return { status: "success", data: rows.map(r => ({
                    date: r.date, test: r.test_name, result: (r.details?.ResultCode || r.details?.Diagnosis || r.details?.VL_Choice || r.details?.Dengue_Result || "Recorded"), fullData: { ...r.details, "Test Code": r.test_code || r.id }
                }))};
            }
            case "getPendingWorkload": {
                let pendingQ = sb.from('lab_tests').select('*').in('status', ['PENDING', 'FOR REPEAT']);
                if (params.facility && params.facility !== 'ALL') pendingQ = pendingQ.eq('facility', params.facility);
                const { data: pending } = await pendingQ.order('date', { ascending: false });
                
                let compQ = sb.from('lab_tests').select('*').eq('status', 'COMPLETED');
                if (params.facility && params.facility !== 'ALL') compQ = compQ.eq('facility', params.facility);
                const { data: completed } = await compQ.order('date_examined', { ascending: false }).limit(300);
                
                const toFrontend = r => ({ id: r.id, testCode: r.test_code || r.id, patientId: r.patient_id, name: r.patient_name, test: r.test_name, date: r.date, details: r.details, encoder: r.encoder, status: r.status, facility: r.facility });
                return { pending: (pending || []).map(toFrontend), encoded: (completed || []).map(toFrontend) };
            }
            case "getFacilityList": {
                const { data } = await sb.from('facilities').select('name');
                return { status: "success", data: data || [] };
            }
            case "getAuditLogs": {
                const { data } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
                return { status: "success", data: data || [] };
            }
            case "getRegistryDataOptimized": {
                const exportTables = { 'CHEM': 'export_blood_chem', 'DENGUE': 'export_dengue', 'DSSM': 'export_dssm', 'FA': 'export_fecalysis', 'GXP': 'export_genexpert', 'GRAM': 'export_gram_stain', 'HEMA': 'export_hematology', 'SERO': 'export_serology', 'UA': 'export_urinalysis', 'GXVL': 'export_viral_load' };
                const tName = exportTables[params.type] || 'lab_tests';
                
                let q = sb.from(tName).select('*'); 
                
                if (tName === 'lab_tests') {
                     const tMap = { 'GXP': 'GeneXpert MTB/Rif Ultra', 'DSSM': 'DSSM', 'GXVL': 'Viral Load', 'SERO': 'Serology', 'HEMA': 'Hematology', 'CHEM': 'Blood Chemistry', 'UA': 'Urinalysis', 'FA': 'Fecalysis', 'DENGUE': 'Dengue Rapid Test', 'GRAM': 'Gram Stain' };
                     q = q.eq('test_name', tMap[params.type] || params.type).eq('status', 'COMPLETED'); 
                }

                if (params.role !== 'ADMIN' && params.role !== 'STAFF' && params.role !== 'NTP_CHECKER' && params.role !== 'DOH_TB') {
                    if (params.facility !== 'ALL') q = q.eq('facility', params.facility);
                }
                
                if (params.searchQuery) {
                    if(tName === 'lab_tests') q = q.ilike('patient_name', `%${params.searchQuery}%`);
                    else q = q.ilike('name', `%${params.searchQuery}%`); 
                }

                const isAsc = params.sortOrder === 'ASC';
                let { data, error } = await q.order('date', { ascending: isAsc }).limit(1000); 
                if (error) throw new Error(`View/Table '${tName}': ` + error.message);
                
                // BULLETPROOF JAVASCRIPT MONTH FILTER (Based on Date Received / date)
                if (params.monthFilter && data) {
                    const [fY, fM] = params.monthFilter.split('-');
                    data = data.filter(row => {
                        let rDate = row.date || row.date_received || row.Date || row["Date Received"];
                        const d = parseAnyDate(rDate);
                        if (!d) return false;
                        return String(d.getFullYear()) === fY && String(d.getMonth() + 1).padStart(2, '0') === fM;
                    });
                }

                if (!data || data.length === 0) return { status: "success", data: { headers: ["NOTICE"], rows: [["No records found"]], totalPages: 1, currentPage: 1, totalRows: 0 } };
                
                const headers = Object.keys(data[0]).filter(h => !['details', 'count'].includes(h));
                const rows = data.map(row => headers.map(h => row[h]));
                return { status: "success", data: { headers, rows, totalPages: 1, currentPage: 1, totalRows: data.length } };
            }
            default: return { status: "error", message: "GET action not implemented: " + action };
        }
    } catch (err) { return { status: "error", message: String(err) }; }
}

async function apiPost(action, payload) {
    try {
        switch (action) {
            case "logAudit": {
                await sb.from('audit_logs').insert({ username: payload.username, action: payload.action, details: payload.details });
                return { status: "success" };
            }
            case "submitForm": {
                const f = payload.formObject;
                const tests = JSON.parse(f.testsData || "[]");
                let patientId = f.patientId || ("MHOA-" + Date.now());

                await sb.from('patients').upsert({
                    id: patientId, full_name: f.fullName, bday: f.bday || null, sex: f.sex, age: f.age, address: f.address, contact: f.contact, email: f.email || null, password: f.patientPassword || null, facility: f.facility
                }, { onConflict: 'id' });

                const rows = tests.map(t => ({
                    patient_id: patientId, patient_name: f.fullName, test_name: t.name, test_code: t.test_code || t.code,
                    details: t.details || {}, status: 'PENDING', facility: f.facility, encoder: f.encoder, encoder_full_name: f.encoderFullName, date: new Date().toISOString()
                }));
                await sb.from('lab_tests').insert(rows);
                return { status: "success", data: { email: f.email, generatedPassword: f.patientPassword, log: "Saved to Supabase." } };
            }
            case "saveLabResult": {
                const details = JSON.parse(payload.jsonDetails || "{}");
                await sb.from('lab_tests').update({ details, status: 'COMPLETED', date_examined: new Date().toISOString(), encoder: payload.encodedBy, patient_name: payload.updatedName, test_name: payload.updatedTest }).eq('id', payload.testId);
                return { status: "success" };
            }
            case "updatePatientAndTestDetails": {
                const details = JSON.parse(payload.newJsonDetails || "{}");
                await sb.from('lab_tests').update({ details, patient_name: payload.newName, test_name: payload.newTestType }).eq('id', payload.testId);
                await sb.from('patients').update({ full_name: payload.newName, age: details.age, sex: details.sex, address: details.address, contact: details.contact, facility: details.facility, email: details.email || null, bday: details.bday || null }).eq('id', payload.patientId);
                return { status: "success", data: "Updated" };
            }
            case "deletePendingTestById": {
                await sb.from('lab_tests').delete().eq('id', payload.testId);
                return { status: "success" };
            }
            case "getSettingsData": {
                const [{ data: staff }, { data: facilities }, { data: users }] = await Promise.all([
                    sb.from('staff').select('*'), sb.from('facilities').select('*'), sb.from('app_users').select('*')
                ]);
                return { status: "success", data: {
                    staff: (staff || []).map(s => ({ name: s.name, role: s.role, license: s.license, sigUrl: s.sig_url })),
                    facilities: (facilities || []).map(f => ({ name: f.name, address: f.address, person: f.contact_person, number: f.contact_number })),
                    users: (users || []).map(u => ({ username: u.username, fullname: u.full_name || u.username, role: u.role, facility: u.facility, status: u.status }))
                }};
            }
            case "saveStaffData": {
                await sb.from('staff').delete().not('id', 'is', null); 
                const rows = (payload.staffArray || []).map(s => ({ name: s.name, role: s.role, license: s.license, sig_url: s.sigUrl }));
                if (rows.length) await sb.from('staff').insert(rows);
                return { status: "success" };
            }
            case "saveNewUser": {
                const d = payload.data;
                await sb.from('app_users').insert({ username: d.username, password: d.password, full_name: d.fullName, role: d.role, facility: d.facility, status: 'ACTIVE' });
                return { status: "success" };
            }
            case "registerUser": {
                const d = payload.data;
                await sb.from('app_users').insert({ username: d.u, password: d.p, full_name: d.name, role: d.role, facility: d.fac, status: 'PENDING' });
                return { status: "success" };
            }
            case "updateUserFull": {
                const d = payload.updatedData;
                const updateObj = { username: d.u, full_name: d.name, role: d.role, facility: d.fac, status: d.status };
                if (d.p) updateObj.password = d.p;
                await sb.from('app_users').update(updateObj).eq('username', payload.oldUsername);
                return { status: "success" };
            }
            case "deleteUser": {
                await sb.from('app_users').delete().eq('username', payload.targetUsername);
                return { status: "success" };
            }
            case "approveUser": {
                const status = payload.userAction === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
                await sb.from('app_users').update({ status }).eq('username', payload.targetUsername);
                return { status: "success" };
            }
            case "editRegistryRecord": {
                const { data: row } = await sb.from('lab_tests').select('details').eq('patient_id', payload.patientId).eq('test_name', payload.testType).maybeSingle();
                const merged = { ...(row?.details || {}), ...payload.updates };
                await sb.from('lab_tests').update({ details: merged }).eq('patient_id', payload.patientId).eq('test_name', payload.testType);
                return { status: "success" };
            }
            default: return { status: "error", message: "POST action not implemented: " + action };
        }
    } catch (err) { return { status: "error", message: String(err) }; }
}

window.addEventListener('error', function(e) {
    const loader = document.getElementById('app-loader');
    if(loader) loader.style.display = 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    try {
        const style = document.createElement('style');
        style.innerHTML = `
            .pending-card, .completed-card, .history-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; background-color: var(--bg-surface) !important; }
            .pending-card:hover, .completed-card:hover, .history-card:hover { transform: translateY(-4px) scale(1.015); box-shadow: 0 10px 30px rgba(59, 130, 246, 0.25) !important; background-color: var(--bg-subtle) !important; border-left: 5px solid var(--pri) !important; z-index: 5; position: relative;}
            .dark-mode .pending-card:hover, .dark-mode .completed-card:hover, .dark-mode .history-card:hover { box-shadow: 0 10px 30px rgba(59, 130, 246, 0.45) !important; background-color: #1e293b !important; }
            
            #col-pending, #col-completed, #col-repeat, #col-entry { transition: box-shadow 0.3s ease, border 0.3s ease; border-radius: 8px; border: 1px solid transparent; }
            #col-pending:hover, #col-completed:hover, #col-repeat:hover, #col-entry:hover { box-shadow: 0 0 25px rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); }
            
            .btn, .btn-icon, .chip { transition: all 0.2s ease; }
            .btn:hover, .chip:hover { filter: brightness(1.1); transform: scale(1.02); }
            .btn-icon:hover { transform: scale(1.15); }
            
            .data-table tbody tr { transition: all 0.15s ease-in-out; }
            .data-table tbody tr:hover { transform: scale(1.005); background-color: rgba(59, 130, 246, 0.08) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.05); z-index: 2; position: relative; }
        `;
        document.head.appendChild(style);

        if (localStorage.getItem('mho-theme') === 'dark') document.body.classList.add('dark-mode');
        const isLimited = localStorage.getItem('mho-limited-mode') === 'true';
        const toggleLimit = document.getElementById('toggle-limited-mode');
        if(toggleLimit) toggleLimit.checked = isLimited;
        applyLimitedMode(isLimited);

        const savedUser = localStorage.getItem('labUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            if (!currentUser.username) throw new Error("Invalid User format");
            
            document.getElementById('login-overlay').style.display = 'none';
            
            const dName = document.getElementById('display-full-name');
            if(dName) dName.innerText = currentUser.fullName || currentUser.username;
            
            const dRole = document.getElementById('display-role-facility');
            if(dRole) dRole.innerText = `${currentUser.role} | ${currentUser.facility}`;
            
            const dAvatar = document.getElementById('pill-avatar');
            if(dAvatar) dAvatar.innerHTML = (currentUser.fullName || currentUser.username).charAt(0).toUpperCase();
            
            applyPermissions(); 
            const r = String(currentUser.role).toUpperCase().replace(/\s+/g, '_');
            if (r === 'ADMIN' || r === 'STAFF' || r === 'ENCODER') {
                loadPatientCache();
                loadSettingsData();
            }
            if(r === 'PATIENT') { showPage('patient'); loadPatientResults(); }
            else if(r === 'NTP_CHECKER' || r === 'DOH_TB' || r === 'VIEWER') showPage('registry'); 
            else showPage('workspace');
        } else {
            document.getElementById('login-overlay').style.display = 'flex';
        }
    } catch (e) { 
        localStorage.removeItem('labUser'); 
        document.getElementById('login-overlay').style.display = 'flex'; 
    } finally { 
        setTimeout(() => {
            const loader = document.getElementById('app-loader');
            if(loader) loader.style.display = 'none';
        }, 1000);
    }
});

function toggleLimitedMode() { const isChecked = document.getElementById('toggle-limited-mode').checked; localStorage.setItem('mho-limited-mode', isChecked); applyLimitedMode(isChecked); }
function applyLimitedMode(isLimited) {
    const hiddenTests = ['btn-viral', 'btn-hema', 'btn-chem', 'btn-uria', 'btn-feca']; const hiddenRegistries = ['GXVL', 'HEMA', 'CHEM', 'UA', 'FA'];
    hiddenTests.forEach(id => { const btn = document.getElementById(id); if(btn) { if(isLimited) btn.classList.add('disabled-test'); else btn.classList.remove('disabled-test'); } });
    document.querySelectorAll('#registry-selection-modal .test-card-big').forEach(card => { const onclickAttr = card.getAttribute('onclick'); if(onclickAttr) { let isHidden = hiddenRegistries.some(r => onclickAttr.includes(r)); if(isLimited && isHidden) card.classList.add('disabled-test'); else card.classList.remove('disabled-test'); } });
}
function toggleFab() { const menu = document.getElementById('fab-menu'); const icon = document.getElementById('fab-main-icon'); if (menu.classList.contains('show')) { menu.classList.remove('show'); icon.classList.replace('ph-caret-right', 'ph-caret-left'); } else { menu.classList.add('show'); icon.classList.replace('ph-caret-left', 'ph-caret-right'); } }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const icon = document.getElementById('fab-theme-icon'); if (document.body.classList.contains('dark-mode')) { localStorage.setItem('mho-theme', 'dark'); if(icon) icon.classList.replace('ph-moon-stars', 'ph-sun'); } else { localStorage.setItem('mho-theme', 'light'); if(icon) icon.classList.replace('ph-sun', 'ph-moon-stars'); } }

function switchLoginTab(type) {
    if(type === 'staff') { document.getElementById('staff-login-form').style.display = 'block'; document.getElementById('patient-login-form').style.display = 'none'; document.getElementById('tab-staff-login').style.color = 'var(--pri)'; document.getElementById('tab-staff-login').style.borderBottom = '2px solid var(--pri)'; document.getElementById('tab-patient-login').style.color = 'var(--text-muted)'; document.getElementById('tab-patient-login').style.borderBottom = 'none'; } 
    else { document.getElementById('staff-login-form').style.display = 'none'; document.getElementById('patient-login-form').style.display = 'block'; document.getElementById('tab-patient-login').style.color = 'var(--pri)'; document.getElementById('tab-patient-login').style.borderBottom = '2px solid var(--pri)'; document.getElementById('tab-staff-login').style.color = 'var(--text-muted)'; document.getElementById('tab-staff-login').style.borderBottom = 'none'; }
}

async function attemptLogin() {
    const u = document.getElementById('login_user').value.trim(); const p = document.getElementById('login_pass').value.trim();
    const btn = document.getElementById('btn-login'); const err = document.getElementById('login-error');
    if (!u || !p) { err.style.display = 'block'; err.innerText = "Enter credentials."; return; }
    btn.innerHTML = 'Verifying...'; btn.disabled = true; err.style.display = 'none';
    
    try {
        const res = await apiGet("loginUser", { username: u, password: p });
        if (res.status === "SUCCESS") { 
            currentUser = { username: res.username, facility: res.facility, role: res.role, fullName: res.fullName }; 
            localStorage.setItem('labUser', JSON.stringify(currentUser)); 
            await apiPost("logAudit", { username: currentUser.username, action: "LOGIN", details: "Staff member logged in successfully" });
            window.location.reload(); 
        } 
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
        if (res.status === "SUCCESS") { 
            currentUser = { username: res.patientId, facility: "PATIENT", role: "PATIENT", fullName: res.name }; 
            localStorage.setItem('labUser', JSON.stringify(currentUser)); 
            await apiPost("logAudit", { username: currentUser.fullName, action: "PATIENT LOGIN", details: "Patient portal accessed" });
            window.location.reload(); 
        } 
        else { err.style.display = 'block'; err.innerHTML = "Invalid credentials."; }
    } catch (err) { err.style.display = 'block'; err.innerHTML = "Server Error."; } finally { btn.innerHTML = 'View My Results'; btn.disabled = false; }
}

function showPatientResend() { document.getElementById('login-card').style.display = 'none'; document.getElementById('patient-resend-card').style.display = 'block'; }
function showPatientInfo() { document.getElementById('login-card').style.display = 'none'; document.getElementById('patient-info-card').style.display = 'block'; }
function backToLoginFromPatient() { document.getElementById('patient-resend-card').style.display = 'none'; document.getElementById('patient-info-card').style.display = 'none'; document.getElementById('login-card').style.display = 'block'; }

async function resendPatientPassword() { 
    const email = document.getElementById('resend_pat_email').value.trim().toLowerCase(); 
    if(!email) return showAppAlert("Required", "Please enter your email.", "error"); 
    const btn = document.querySelector('#patient-resend-card .btn-primary'); 
    const oldText = btn.innerHTML; btn.innerHTML = "Sending..."; btn.disabled = true; 
    
    try { 
        const { data, error } = await sb.from('patients').select('*').ilike('email', email).maybeSingle();
        if (data) {
            let pass = data.password;
            if(!pass) { pass = Math.random().toString(36).slice(-8).toUpperCase(); await sb.from('patients').update({password: pass}).eq('id', data.id); }
            showAppAlert("Success", "Account Verified! Please save your login credentials:\n\nEmail: " + email + "\nPassword: " + pass + "\n\n(In the future, this will be emailed directly to you).", "success"); 
            backToLoginFromPatient(); 
        } else { showAppAlert("Notice", "Email is not recorded. Please contact Angono MHO Laboratory on Facebook Messenger to request access.", "error"); } 
    } catch(e) { showAppAlert("Error", "Unable to connect to the server.", "error"); } finally { btn.innerHTML = oldText; btn.disabled = false; } 
}

function logoutUser() { const modal = document.getElementById('logout-modal'); if (modal) modal.style.display = 'flex'; const menu = document.getElementById('fab-menu'); if (menu && menu.classList.contains('show')) toggleFab(); }
function closeLogoutModal() { document.getElementById('logout-modal').style.display = 'none'; }
function confirmLogout() { 
    apiPost("logAudit", { username: currentUser.fullName || currentUser.username, action: "LOGOUT", details: "User logged out" });
    localStorage.removeItem('labUser'); 
    window.location.reload(); 
}
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

function applyPermissions() {
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_');
    const navWork = document.getElementById('fab-nav-workspace'); const navReg = document.getElementById('fab-nav-registry'); const navRep = document.getElementById('fab-nav-reports'); const navSet = document.getElementById('fab-nav-settings');
    const colEntry = document.getElementById('col-entry'); const colPending = document.getElementById('col-pending'); const colCompleted = document.getElementById('col-completed'); const colRepeat = document.getElementById('col-repeat');
    
    if(navWork) navWork.style.display = 'none'; if(navReg) navReg.style.display = 'none'; if(navRep) navRep.style.display = 'none'; if(navSet) navSet.style.display = 'none';
    if(colEntry) colEntry.style.display = 'none'; if(colPending) colPending.style.display = 'none'; if(colCompleted) colCompleted.style.display = 'none'; if(colRepeat) colRepeat.style.display = 'none';

    if (role === 'PATIENT') { const fabMain = document.getElementById('fab-main-btn'); if(fabMain) fabMain.style.display = 'none'; }
    else if (role === 'ADMIN' || role === 'STAFF') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex'; if(navRep) navRep.style.display = 'flex';
        if(role === 'ADMIN' && navSet) navSet.style.display = 'flex'; 
        if(colEntry) colEntry.style.display = 'flex'; if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
        
        if (role === 'ADMIN') {
            let bell = document.getElementById('notif-bell');
            if (!bell) {
                bell = document.createElement('div');
                bell.id = 'notif-bell';
                bell.innerHTML = '<i class="ph ph-bell-ringing"></i><span id="notif-red-dot" style="display:none; position:absolute; top:-5px; right:-5px; background:var(--danger); width:10px; height:10px; border-radius:50%; box-shadow:0 0 5px red;"></span>';
                bell.style.cssText = 'position:fixed; top:15px; right:70px; z-index:99999; font-size:1.6rem; color:var(--pri); cursor:pointer; background:var(--bg-surface); padding:6px; border-radius:50%; box-shadow:0 2px 5px rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center; transition: all 0.2s ease;';
                bell.onmouseover = () => bell.style.transform = 'scale(1.1)';
                bell.onmouseout = () => bell.style.transform = 'scale(1)';
                bell.onclick = toggleAuditLogs;
                document.body.appendChild(bell);
            }
            if(typeof checkNewNotifs === 'function') checkNewNotifs();
        }

    } else if (role === 'ENCODER') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex';
        if(colEntry) colEntry.style.display = 'flex'; if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
    } else if (role === 'VIEWER') {
        if(navWork) navWork.style.display = 'flex'; if(navReg) navReg.style.display = 'flex';
        if(colPending) colPending.style.display = 'flex'; if(colCompleted) colCompleted.style.display = 'flex'; if(colRepeat) colRepeat.style.display = 'flex';
    } else if (role === 'NTP_CHECKER' || role === 'DOH_TB') {
        if(navReg) navReg.style.display = 'flex'; if(navRep) navRep.style.display = 'flex'; 
        document.querySelectorAll('#registry-tabs .chip, #registry-tabs .reg-tab-btn').forEach(card => { 
            const attr = card.getAttribute('onclick') || ''; card.style.display = 'none'; 
            if (role === 'NTP_CHECKER' && (attr.includes('GXP') || attr.includes('DSSM') || attr.includes('SERO'))) card.style.display = ''; 
            else if (role === 'DOH_TB' && (attr.includes('GXP') || attr.includes('DSSM'))) card.style.display = ''; 
        });
        setTimeout(() => { if(typeof openRegistryTab === 'function') openRegistryTab('GXP', 1); }, 800);
    }

    if (role !== 'ADMIN') {
        document.querySelectorAll('#registry-tabs .chip, #registry-tabs .reg-tab-btn').forEach(card => { const attr = card.getAttribute('onclick') || ''; if(attr.includes('GXVL')) card.style.display = 'none'; });
        const btnViral = document.getElementById('btn-viral'); if(btnViral) btnViral.style.display = 'none';
    }
    if (role !== 'ADMIN' && role !== 'STAFF') { const btnSero = document.getElementById('btn-sero'); if(btnSero) btnSero.style.display = 'none'; }
}

async function checkNewNotifs() {
    try {
        const lastViewed = localStorage.getItem('last_notif_time') || "0";
        const { data } = await sb.from('audit_logs').select('created_at').order('created_at', { ascending: false }).limit(1);
        if(data && data.length > 0) {
            const latestTime = new Date(data[0].created_at).getTime();
            const dot = document.getElementById('notif-red-dot');
            if(dot) dot.style.display = latestTime > parseInt(lastViewed) ? 'block' : 'none';
        }
    } catch(e) {}
}

async function toggleAuditLogs() {
    let dropdown = document.getElementById('audit-dropdown');
    if (dropdown && dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        localStorage.setItem('last_notif_time', Date.now().toString());
        const dot = document.getElementById('notif-red-dot');
        if(dot) dot.style.display = 'none';
        await showAuditLogs();
    }
}

async function showAuditLogs() {
    let dropdown = document.getElementById('audit-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'audit-dropdown';
        dropdown.style.cssText = 'position:fixed; top:65px; right:20px; width:300px; max-height:400px; background:var(--bg-surface); box-shadow:0 10px 25px rgba(0,0,0,0.2); border-radius:8px; z-index:99999; overflow-y:auto; display:none; flex-direction:column; border:1px solid var(--border-color);';
        document.body.appendChild(dropdown);
    }

    dropdown.innerHTML = '<div style="padding:15px; text-align:center; color:var(--text-muted); font-size:0.85rem;"><i class="ph ph-spinner ph-spin"></i> Loading logs...</div>';
    dropdown.style.display = 'block';

    const res = await apiGet("getAuditLogs", {});
    if (res.status === 'success') {
        let html = '<div style="padding:10px 15px; border-bottom:1px solid var(--border-color); font-weight:bold; color:var(--pri); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:var(--bg-surface); z-index:2; font-size:0.9rem;"><span><i class="ph ph-bell"></i> Notifications</span><i class="ph ph-x" style="cursor:pointer; color:var(--text-muted);" onclick="document.getElementById(\'audit-dropdown\').style.display=\'none\'"></i></div>';
        
        if (res.data.length === 0) html += '<div style="padding:15px; text-align:center; font-size:0.8rem; color:var(--text-muted);">No activity logs yet.</div>';
        
        res.data.forEach(log => {
            html += `<div class="notif-item" style="padding:12px 15px; border-bottom:1px solid var(--bg-subtle); cursor:pointer; font-size:0.8rem; transition:background 0.2s;" onmouseover="this.style.background='var(--bg-subtle)'" onmouseout="this.style.background='transparent'" onclick="handleNotifClick('${log.action}')">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <strong style="color:var(--text-main);"><i class="ph ph-user"></i> ${log.username}</strong>
                            <span style="font-size:0.65rem; color:var(--text-muted);">${new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div style="margin-top:4px;"><span style="color:white; background:var(--pri); padding:2px 6px; border-radius:4px; font-size:0.65rem; font-weight:bold; display:inline-block; margin-bottom:4px;">${log.action}</span></div>
                        <div style="color:var(--text-muted); line-height:1.3; font-size:0.75rem;">${log.details}</div>
                     </div>`;
        });
        dropdown.innerHTML = html;
    } else {
        dropdown.innerHTML = '<div style="padding:15px; text-align:center; color:var(--danger); font-size:0.85rem;">Failed to load logs.</div>';
    }
}

function handleNotifClick(action) {
    document.getElementById('audit-dropdown').style.display = 'none';
    const a = String(action).toUpperCase();
    if (a.includes('UNDO') || a.includes('SAVE') || a.includes('DELETE') || a.includes('BATCH SAVE')) {
        showPage('workspace');
    } else if (a.includes('PRINT') || a.includes('EDIT')) {
        showPage('registry');
    } else if (a.includes('LOGIN') || a.includes('LOGOUT')) {
        showPage('settings');
    }
}

function openTestDetails(id) { 
    const config = availableTests[id]; if (!config) return; 
    document.getElementById('test-buttons-container').style.display = 'none'; 
    const area = document.getElementById('test-details-area'); area.style.display = 'block'; 
    area.innerHTML = `<div style="font-weight: 700; color: var(--pri); margin-bottom: 8px;"><i class="ph ph-info"></i> ${config.title}</div><div class="form-grid grid-1">${config.html}</div><div style="margin-top:20px; display:flex; gap:10px; position:relative; z-index:99999; padding-bottom:15px;"><button type="button" class="btn btn-secondary" style="flex:1; cursor:pointer;" onclick="event.preventDefault(); cancelDetail()">Cancel</button><button type="button" class="btn btn-primary" style="flex:1; cursor:pointer;" onclick="event.preventDefault(); confirmDetail('${id}')">Confirm</button></div>`; 
}
function toggleSub(btn) { btn.classList.toggle('active'); }
function cancelDetail() { document.getElementById('test-details-area').style.display = 'none'; document.getElementById('test-details-area').innerHTML = ''; document.getElementById('test-buttons-container').style.display = ''; }

function confirmDetail(id) { 
    let details = {}; let subSelected = []; 
    document.querySelectorAll('#test-details-area [data-key]').forEach(el => { details[el.getAttribute('data-key')] = el.value; }); 
    
    if (id === 'dengue') { 
        let dResult = document.getElementById('dn_duo_check');
        if (dResult && dResult.checked) subSelected.push('Dengue Duo'); 
    } else if (['sero', 'hema', 'chem'].includes(id)) { 
        const activeBtns = document.querySelectorAll('#test-details-area .chip.active'); 
        if (activeBtns.length === 0) return showAppAlert("Required", "Select at least one test.", "error"); 
        subSelected = Array.from(activeBtns).map(b => b.getAttribute('data-val')); 
    } 
    
    labOrders[id] = { details: details, subTests: subSelected }; 
    const targetBtn = document.getElementById('btn-' + id); if(targetBtn) targetBtn.classList.add('active'); 
    updateSummary(); cancelDetail(); 
}

function toggleSimple(id) { const btn = document.getElementById('btn-'+id); if(labOrders[id]) { delete labOrders[id]; btn.classList.remove('active'); } else { labOrders[id] = { details: {}, subTests: [] }; btn.classList.add('active'); } updateSummary(); }
function updateSummary() { const container = document.getElementById('order-summary'); container.innerHTML = ''; Object.keys(labOrders).forEach(key => { let label = availableTests[key].testName; if(labOrders[key].subTests && labOrders[key].subTests.length > 0) label += `: ${labOrders[key].subTests.join(', ')}`; container.innerHTML += `<div class="badge badge-warning" style="cursor:pointer;" onclick="removeOrder('${key}')">${label} &times;</div>`; }); }
function removeOrder(key) { delete labOrders[key]; document.getElementById('btn-'+key).classList.remove('active'); updateSummary(); }
function setSelectValue(id, val) { const el = document.getElementById(id); if (!el || !val) return; const searchVal = String(val).toUpperCase().trim(); for (let i = 0; i < el.options.length; i++) { if (el.options[i].value.toUpperCase().trim() === searchVal || el.options[i].text.toUpperCase().trim() === searchVal) { el.selectedIndex = i; return; } } }
function calculateAge() { const dob = new Date(document.getElementById('p_bday').value); const today = new Date(); let age = today.getFullYear() - dob.getFullYear(); if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--; document.getElementById('p_age').value = age; }
function generateSmartID() { if(isExistingPatient) return; const bday = document.getElementById('p_bday').value.replace(/-/g, "") || "00000000"; const name = document.getElementById('p_name').value.trim().toUpperCase(); let initials = "XX"; if(name) { const p = name.split(" "); initials = p.length > 1 ? p[0][0] + p[p.length-1][0] : name.substring(0,2); } document.getElementById('finalPatientId').value = `MHOA-${bday}-${initials}${Math.floor(Math.random()*90+10)}`; }

async function loadPatientCache() {
    try {
        const res = await apiGet("getAllPatientsLight");
        if (res.status === "success") cachedPatients = res.data;
    } catch(e) { console.error("Failed to load patient cache"); }
}

function runDirectSearch(q) {
    const box = document.getElementById('direct-results-box'); 
    if(q.length < 2) { box.style.display='none'; return; }
    
    const query = q.toLowerCase();
    const results = cachedPatients.filter(p => (p.name || "").toLowerCase().includes(query)).slice(0, 8);
    
    if (results.length > 0) {
        box.style.display = 'block'; 
        box.innerHTML = `<div style="text-align:right; padding:6px; background:var(--bg-subtle); border-bottom:1px dashed var(--border-color);"><button type="button" class="btn btn-secondary text-xs" style="padding:4px 8px;" onclick="document.getElementById('direct-results-box').style.display='none'"><i class="ph ph-x"></i> Hide / New Patient</button></div>`;
        results.forEach(p => {
            const div = document.createElement('div'); div.className = "search-item";
            div.innerHTML = `<div style="font-weight:600;">${p.name || "Unnamed"} <span class="badge badge-success" style="margin-left:4px;">Returning</span></div><div style="font-size:0.7rem; color:var(--text-muted);">${p.age || "?"}y | ${p.sex || "?"} | ${p.facility || 'No Facility'}</div>`;
            div.onclick = () => {
                isExistingPatient = true; document.getElementById('finalPatientId').value = p.id; document.getElementById('p_name').value = p.name || ""; document.getElementById('p_age').value = p.age || ""; document.getElementById('p_address').value = p.address || ""; document.getElementById('p_contact').value = p.contact || ""; if(document.getElementById('p_email')) document.getElementById('p_email').value = p.email || "";
                setSelectValue('p_sex', p.sex); setSelectValue('p_facility', p.facility);
                if (p.bday) { try { const d = new Date(p.bday); document.getElementById('p_bday').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; } catch(e){} }
                box.style.display = 'none'; document.getElementById('new-entry-header').style.display = 'none'; document.getElementById('profile-header').style.display = 'flex';
                fetchHistory(p.id, 'history-section', 'history-list'); 
            }; 
            box.appendChild(div);
        });
    } else { box.style.display = 'none'; }
}

function runQuickSearch(q) {
    const box = document.getElementById('quick-search-results'); if(q.length < 2) { box.style.display='none'; return; }
    const query = q.toLowerCase(); const results = cachedPatients.filter(p => (p.name || "").toLowerCase().includes(query)).slice(0, 15);
    if (results.length > 0) {
        box.style.display = 'block'; box.innerHTML = '';
        results.forEach(p => {
            const div = document.createElement('div'); div.className = "search-item";
            div.innerHTML = `<div style="font-weight:600;">${p.name || "Unnamed"}</div><div style="font-size:0.75rem; color:var(--text-muted);">${p.age || "?"}y | ${p.sex || "?"} | ${p.facility || 'No Facility'}</div>`;
            div.onclick = () => { viewQuickProfile(p); box.style.display = 'none'; }; box.appendChild(div);
        });
    } else { box.style.display = 'none'; }
}

function openQuickSearch() { document.getElementById('quick-search-modal').style.display='flex'; const input = document.getElementById('quick-search-input'); input.value = ''; document.getElementById('quick-search-results').style.display = 'none'; document.getElementById('quick-profile-view').style.display = 'none'; input.focus(); }

async function viewQuickProfile(p) {
    currentQuickPatient = p; document.getElementById('quick-profile-view').style.display = 'flex'; document.getElementById('quick-profile-view').style.flexDirection = 'column'; document.getElementById('qs-name').innerText = p.name; document.getElementById('qs-meta').innerHTML = `<span><i class="ph ph-fingerprint"></i> ${p.id}</span> <span><i class="ph ph-calendar"></i> ${p.age} yrs</span> <span><i class="ph ph-gender-intersex"></i> ${p.sex}</span> <span><i class="ph ph-buildings"></i> ${p.facility || 'N/A'}</span>`;
    fetchHistory(p.id, null, 'qs-history-list', true, false); 
    if (String(currentUser.role).toUpperCase() !== 'ADMIN') {
        const qsList = document.getElementById('qs-history-list');
        const observer = new MutationObserver(() => { qsList.querySelectorAll('.history-card').forEach(card => { if (card.innerText.toUpperCase().includes('VIRAL LOAD') || card.innerText.toUpperCase().includes('GXVL') || card.innerText.toUpperCase().includes('HIV-1')) card.remove(); }); });
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
    if (t.includes("VIRAL") || t.includes("VL")) return "GXVL"; if (t.includes("GXP") || t.includes("MTB") || t.includes("GENEXPERT")) return "GXP"; if (t.includes("DSSM") || t.includes("AFB")) return "DSSM"; if (t.includes("UA") || t.includes("URINALYSIS")) return "UA"; if (t.includes("FA") || t.includes("FECALYSIS")) return "FA"; if (t.includes("HEMA") || t.includes("CBC")) return "HEMA"; if (t.includes("CHEM") || t.includes("BLOOD CHEM")) return "CHEM"; if (t.includes("GRAM")) return "GRAM"; if (t.includes("DENGUE") || t.includes("NS1")) return "DENGUE"; if (t.includes("SERO") || t.includes("HIV") || t.includes("SYPHILIS") || t.includes("HBSAG")) return "SERO"; return t; 
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
                let printBtnHtml = (isQuickSearch || isPatientPortal) ? `<button class="btn-icon" onclick="printDirect(event, '${testCodeForPrint}', '${h.test}')" title="Print this Result" style="color:var(--success);"><i class="ph ph-printer"></i></button><button class="btn-icon" onclick="downloadDirect(event, '${testCodeForPrint}', '${h.test}')" title="Download PDF" style="color:var(--pri); margin-left: 5px;"><i class="ph ph-download-simple"></i></button>` : '';
                let updateBtnHtml = (isQuickSearch && !isPatientPortal) ? `<button class="btn btn-primary text-xs" onclick="saveHistoryEdit('${id}', '${h.test}', '${uniqueId}')"><i class="ph ph-floppy-disk"></i> Update Record</button>` : '';
                
                return `<div class="history-card" style="display:flex; flex-direction:column; align-items:stretch;"><div style="display:flex; justify-content:space-between; align-items:center; width:100%; cursor:pointer;" ondblclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'" title="Double click to view full details"><div><div class="h-test">${h.test}</div><div class="h-date">${dateStr}</div></div><div style="display:flex; align-items:center; gap:8px;"><span style="font-size:0.8rem; font-weight:bold; color:var(--text-main);">${h.result}</span>${printBtnHtml}<i class="ph ph-caret-down" style="color:var(--text-muted);" onclick="document.getElementById('${uniqueId}').style.display = document.getElementById('${uniqueId}').style.display === 'none' ? 'block' : 'none'"></i></div></div><div id="${uniqueId}" class="h-expanded-details"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:6px;"><span style="font-size:0.75rem; font-weight:bold; color:var(--text-muted);">RESULT SUMMARY</span>${editBtnHtml}</div><div id="summary-view-${uniqueId}">${summaryHtml}</div><div id="edit-view-${uniqueId}" style="display:none; background:var(--bg-body); padding:10px; border-radius:var(--radius-sm); border:1px dashed var(--warning);"><div>${editInputsHtml}</div><div style="margin-top:10px; display:flex; gap:10px;"><button class="btn btn-secondary text-xs" onclick="toggleHistoryEdit('${uniqueId}')">Cancel</button>${updateBtnHtml}</div></div></div></div>`;
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

  const pEmailEl = document.getElementById('p_email'); const pEmail = pEmailEl ? pEmailEl.value.trim().toLowerCase() : "";
  const generatedPassword = pEmail ? Math.random().toString(36).slice(-8).toUpperCase() : "";

  let finalTestsArray = []; const pAge = document.getElementById('p_age').value || ""; const pSex = document.getElementById('p_sex').value || ""; const pFacility = document.getElementById('p_facility').value || "";
  
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

  Object.keys(labOrders).forEach(key => { 
      const randNum = String(Math.floor(Math.random() * 900) + 100);
      const generatedTestCode = `${availableTests[key].testCode}-${dateStr}-${randNum}`;

      const entry = { 
          test_code: generatedTestCode, 
          name: availableTests[key].testName, 
          code: availableTests[key].testCode, 
          details: { ...labOrders[key].details, age: pAge, sex: pSex, facility: pFacility, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, bday: document.getElementById('p_bday').value } 
      }; 
      if(labOrders[key].subTests && labOrders[key].subTests.length > 0) { entry.details["Requested Tests"] = labOrders[key].subTests.join(', '); } 
      finalTestsArray.push(entry); 
  });

  const formData = { patientId: document.getElementById('finalPatientId').value, fullName: document.getElementById('p_name').value, bday: document.getElementById('p_bday').value, sex: pSex, age: pAge, address: document.getElementById('p_address').value, contact: document.getElementById('p_contact').value, email: pEmail, patientPassword: generatedPassword, facility: pFacility, encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify(finalTestsArray) };

  try {
      const res = await apiPost("submitForm", { formObject: formData });
      if (res.status === "success") { 
          btn.style.background = "var(--success)"; btn.innerHTML = '<i class="ph ph-check"></i> Saved'; clearForm(); await loadPendingData(); 
          const savedPass = res.data?.generatedPassword || generatedPassword;
          showAppAlert("Record Saved", `Successfully saved to Supabase!${pEmail ? '\n\nPatient Password: ' + savedPass + '\n(Please provide this directly to the patient since Javascript email is disabled)' : ''}`, "success");
          setTimeout(() => { btn.disabled = false; btn.innerHTML = originalText; btn.style.background = ""; }, 4000); 
      } else { throw new Error("Server rejected the save."); }
  } catch (err) { showAppAlert("Error", String(err), "error"); btn.disabled = false; btn.innerHTML = originalText; }
}

function editPendingFull(id) {
    const item = window.pendingData.find(i => String(i.id) === String(id).trim()); if(!item) return;
    editingPendingId = item.id; isExistingPatient = true; 
    document.getElementById('col-entry').classList.add('edit-mode-pane'); const header = document.getElementById('entry-main-header');
    if (header) { header.classList.add('edit-mode-header'); header.innerHTML = `<h2><i class="ph ph-pencil-simple"></i> Editing Pending Record</h2><button class="btn-icon" onclick="cancelEditPending()" style="color:white;"><i class="ph ph-x"></i></button>`; }
    
    const pIdEl = document.getElementById('finalPatientId'); if (pIdEl) pIdEl.value = item.patientId || "";
    const pNameEl = document.getElementById('p_name'); if (pNameEl) pNameEl.value = item.name || "";
    let d = {}; try { d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; } catch(e){}
    
    const pAgeEl = document.getElementById('p_age'); if(pAgeEl) pAgeEl.value = d.age || d.Age || ""; 
    const pAddressEl = document.getElementById('p_address'); if(pAddressEl) pAddressEl.value = d.address || d.Address || ""; 
    const pContactEl = document.getElementById('p_contact'); if(pContactEl) pContactEl.value = d.contact || d.Contact || "";
    const pEmailEl = document.getElementById('p_email'); if(pEmailEl) pEmailEl.value = d.email || d.Email || "";
    if (typeof setSelectValue === 'function') { setSelectValue('p_sex', d.sex || d.Sex); setSelectValue('p_facility', d.facility || d.Facility); }
    const bdayVal = d.bday || d.Bday; if(bdayVal) { try { const bd = new Date(bdayVal); if (!isNaN(bd.getTime())) { const pBdayEl = document.getElementById('p_bday'); if (pBdayEl) pBdayEl.value = `${bd.getFullYear()}-${String(bd.getMonth()+1).padStart(2,'0')}-${String(bd.getDate()).padStart(2,'0')}`; } } catch(e){} }
    
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
        setTimeout(() => { document.querySelectorAll('#test-details-area [data-key]').forEach(el => { let val = d[el.getAttribute('data-key')]; if(val) el.value = val; }); }, 100);
    }
    const saveBtn = document.getElementById('save-btn-action'); if (saveBtn) { saveBtn.innerHTML = '<i class="ph ph-check-circle"></i> Update Pending Record'; saveBtn.onclick = submitPendingUpdate; saveBtn.style.background = 'var(--warning)'; saveBtn.style.color = 'white'; }
}

function cancelEditPending() { clearForm(); } 
async function submitPendingUpdate() {
    if(!editingPendingId) return; const item = window.pendingData.find(i => String(i.id) === String(editingPendingId).trim()); if(!item) return;
    const btn = document.getElementById('save-btn-action'); const oldTxt = btn ? btn.innerHTML : 'Update'; if (btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Updating...'; btn.disabled = true; }
    try {
        let newDetails = {}; document.querySelectorAll('#test-details-area [data-key]').forEach(el => { newDetails[el.getAttribute('data-key')] = el.value; });
        const pEmailEl = document.getElementById('p_email');
        let demogUpdates = { age: document.getElementById('p_age') ? document.getElementById('p_age').value : "", sex: document.getElementById('p_sex') ? document.getElementById('p_sex').value : "", address: document.getElementById('p_address') ? document.getElementById('p_address').value : "", contact: document.getElementById('p_contact') ? document.getElementById('p_contact').value : "", facility: document.getElementById('p_facility') ? document.getElementById('p_facility').value : "", email: pEmailEl ? pEmailEl.value.trim().toLowerCase() : "" };
        const pBdayEl = document.getElementById('p_bday'); if(pBdayEl && pBdayEl.value) demogUpdates.bday = pBdayEl.value;

        let oldD = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; let finalJsonStr = JSON.stringify({...oldD, ...newDetails, ...demogUpdates}); const pNameEl = document.getElementById('p_name');
        
        const res = await apiPost("updatePatientAndTestDetails", { testId: editingPendingId, patientId: item.patientId, newName: pNameEl ? pNameEl.value : item.name, newTestType: item.test, newJsonDetails: finalJsonStr }); 
        cancelEditPending(); if (typeof loadPendingData === 'function') await loadPendingData(); showAppAlert("Success", "Record updated successfully!", "success");
    } catch(e) { showAppAlert("Error", String(e), "error"); } finally { if (btn) { btn.innerHTML = oldTxt; btn.disabled = false; } }
}

async function loadPendingData() {
    const refIcon = document.getElementById('refresh-icon'); if (refIcon) refIcon.classList.add('ph-spin');
    try {
        let res = await apiGet("getPendingWorkload", { facility: currentUser.facility, role: currentUser.role, _t: new Date().getTime() }); 
        if (res && (res.pending || res.encoded)) { window.pendingData = res.pending || []; window.completedData = res.encoded || []; renderLists(); }
    } catch(e) { console.error("Refresh Error:", e); } finally { if (refIcon) refIcon.classList.remove('ph-spin'); }
}

window.undoResult = function(id) {
    customConfirm("Are you sure you want to UNDO this result? It will go back to Pending.", async () => {
        const btn = document.getElementById('btn-undo-'+id);
        if(btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
        try {
            const { data } = await sb.from('lab_tests').select('*').eq('id', id).single();
            if (!data) throw new Error("Record not found");
            
            let d = typeof data.details === 'string' ? JSON.parse(data.details) : data.details;
            delete d.date_examined;
            delete d.dateEncoded;
            
            await sb.from('lab_tests').update({ status: 'PENDING', details: d }).eq('id', id);
            await apiPost("logAudit", { username: currentUser.fullName || currentUser.username, action: "UNDO RESULT", details: `Undid result for Test ID: ${id}` });
            
            showAppAlert("Success", "Record reverted to Pending.", "success");
            loadPendingData();
        } catch (e) {
            showAppAlert("Error", "Could not undo record: " + e.message, "error");
            if(btn) btn.innerHTML = '<i class="ph ph-arrow-u-up-left"></i>';
        }
    });
};

function renderLists() {
    const pList = document.getElementById('list-pending'); const cList = document.getElementById('list-completed'); const rList = document.getElementById('list-repeat'); const filterSelect = document.getElementById('test-filter');
    if (!pList || !cList) return; window.pendingData = window.pendingData || []; window.completedData = window.completedData || [];
    const role = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_'); const isViewer = (role === 'VIEWER'); const isEncoder = (role === 'ENCODER'); const isLimited = localStorage.getItem('mho-limited-mode') === 'true'; const allowedTests = ['GXP', 'DSSM', 'GRAM', 'DENGUE', 'SERO'];

    const uniqueTests = [...new Set(window.pendingData.map(item => String(item.test || "").toUpperCase()))];
    const currentVal = filterSelect ? filterSelect.value : 'ALL'; let dropHtml = '<option value="ALL">All Sections</option>';
    uniqueTests.forEach(t => { let tCode = getTestCodeFromName(t); if(!isLimited || allowedTests.includes(tCode)) { dropHtml += `<option value="${t}">${t}</option>`; } });
    if(filterSelect) { filterSelect.innerHTML = dropHtml; filterSelect.value = currentVal; }

    const filterFn = (item) => { let t = String(item.test || "").toUpperCase(); let filterVal = filterSelect ? filterSelect.value : "ALL"; let tCode = getTestCodeFromName(t); if(isLimited && !allowedTests.includes(tCode)) return false; let typeMatch = (filterVal === "ALL") || t.includes(filterVal); return typeMatch; };

    const fPending = window.pendingData.filter(i => filterFn(i) && String(i.status).toUpperCase() !== 'FOR REPEAT'); 
    const fRepeat = window.pendingData.filter(i => filterFn(i) && String(i.status).toUpperCase() === 'FOR REPEAT');

    fPending.sort((a, b) => { let dateA = new Date(a.date); dateA.setHours(0,0,0,0); let dateB = new Date(b.date); dateB.setHours(0,0,0,0); if (dateB.getTime() !== dateA.getTime()) { return dateB.getTime() - dateA.getTime(); } return String(a.testCode || a.id || "").localeCompare(String(b.testCode || b.id || ""), undefined, { numeric: true }); });

    const fComp = window.completedData.filter(i => {
        let encodedDateStr = TODAY_STR; 
        try { let d = typeof i.details === 'string' ? JSON.parse(i.details) : (i.details || {}); if (d.date_examined) { encodedDateStr = new Date(d.date_examined).toLocaleDateString(); } else if (i.date) { encodedDateStr = new Date(i.date).toLocaleDateString(); } } catch(e) { if (i.date) encodedDateStr = new Date(i.date).toLocaleDateString(); }
        return filterFn(i) && (encodedDateStr === TODAY_STR);
    });

    let batchActionsHtml = (role === 'ADMIN' || role === 'STAFF') ? `<div style="position: sticky; top: 0; z-index: 10; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:var(--bg-surface); padding:10px; border-radius:var(--radius-sm); border: 1px solid var(--pri); box-shadow: 0 4px 10px rgba(0,0,0,0.1);"><label style="font-size:0.8rem; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px;"><input type="checkbox" onchange="document.querySelectorAll('.chk-pending').forEach(c=>c.checked=this.checked)" style="width:16px; height:16px; accent-color:var(--pri);"> Select All</label><div style="display:flex; gap:6px;"><button class="btn btn-primary text-xs" style="padding:4px 8px;" onclick="batchSaveResults(false)"><i class="ph ph-floppy-disk"></i> Batch Save</button><button class="btn btn-secondary text-xs" style="padding:4px 8px; border-color:var(--pri); color:var(--pri);" onclick="batchSaveResults(true)"><i class="ph ph-printer"></i> Save & Print</button></div></div>` : '';

    const pendingCardsHtml = fPending.map(item => {
        const safeId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, ""); let tCode = getTestCodeFromName(item.test); let subTxt = ""; let repeatBadge = ""; 
        try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}); if(d.Age) subTxt = `(${d.Age}/${d.Sex})`; } catch(e){}
        
        let actionsHtml = ''; let checkboxHtml = (role === 'ADMIN' || role === 'STAFF') ? `<div style="padding-top:2px;"><input type="checkbox" class="chk-pending" value="${item.id}" style="width:16px; height:16px; accent-color:var(--pri);"></div>` : '';

        if (role === 'ADMIN' || role === 'STAFF' || (isEncoder && item.encoder === currentUser.username)) { actionsHtml = `<div style="display:flex; gap:5px;"><button onclick="editPendingFull('${item.id}')" class="btn-icon" title="Edit Full Profile"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Delete this request?', () => deleteEntry('${item.id}'))" class="btn-icon" style="color:var(--danger);" title="Delete"><i class="ph ph-trash"></i></button></div>`; }

        let clickAttr = `style="flex-grow:1;"`; let expandAreaHtml = '';
        if (role === 'ADMIN' || role === 'STAFF') {
            clickAttr = `onclick="toggleExpand('${safeId}')" style="cursor:pointer; flex-grow:1;"`;
            expandAreaHtml = `<div id="expand-${safeId}" class="pc-expand-area"><div style="display:flex; gap:10px; margin-bottom: 16px;"><button class="btn btn-primary" style="flex:1;" onclick="saveResult('${item.id}', '${safeId}', this)"><i class="ph ph-floppy-disk"></i> Save Only</button><button class="btn btn-secondary" style="flex:1; border-color:var(--pri); color:var(--pri);" onclick="saveAndPrintResult('${item.id}', '${safeId}', this)"><i class="ph ph-printer"></i> Save & Print</button></div><div>${getResultTemplate(tCode, safeId, item)}</div></div>`;
        }
        
        // Display full test_code (e.g. GXP-20260921-123)
        const displaySerial = item.testCode || item.id;

        return `<div class="pending-card" id="card-${safeId}"><div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">${checkboxHtml}<div ${clickAttr}><div class="pc-name">${item.name} <span style="color:var(--text-muted); font-size:0.7rem;">${subTxt}</span> ${repeatBadge}</div><div class="pc-meta" style="margin-top: 6px;"><span style="background:var(--bg-subtle); color:var(--sec); padding:2px 6px; border-radius:4px; font-family:monospace; font-weight:bold; border:1px solid var(--border-color); margin-right: 5px;">${displaySerial}</span>${item.test} • By: <span style="color:var(--pri);">${item.encoder || 'System'}</span></div></div>${actionsHtml}</div>${expandAreaHtml}</div>`;
    }).join('');
    
    pList.innerHTML = batchActionsHtml + pendingCardsHtml;

    if (rList) {
        rList.innerHTML = fRepeat.map(item => {
            const safeId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, ""); let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}); let fac = d.facility || d.Facility || "N/A";
            return `<div class="pending-card" style="border-left: 3px solid var(--warning); padding: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;"><div style="flex: 1; overflow: hidden;"><div class="pc-name" style="color: var(--warning); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div><div class="pc-meta" style="font-size: 0.7rem; color: var(--text-muted);">${fac} | ${item.test}</div></div>${isViewer || isEncoder ? '' : `<button class="btn-icon" id="btn-repeat-${safeId}" style="color:var(--warning); background: transparent; padding: 4px;" onclick="moveToPendingRepeat('${item.id}')" title="Move to Pending"><i class="ph ph-arrow-circle-left" style="font-size: 1.2rem;"></i></button>`}</div>`;
        }).join('');
        const cRep = document.getElementById('count-repeat'); if(cRep) cRep.innerText = `(${fRepeat.length})`;
    }

    cList.innerHTML = fComp.map(item => {
        let tCodePrint = getTestCodeFromName(item.test); let repeatBadge = ""; 
        try { let d = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}); let rpt = d.Repeat || d["Test Type"]; if(rpt && String(rpt).toUpperCase() === 'INITIAL') repeatBadge = `<span class="badge badge-warning" style="margin-left:4px; font-size:0.55rem; background:var(--warning); color:white; padding:2px 4px; border-radius:3px;">INITIAL</span>`; } catch(e){}
        const displaySerial = item.testCode || item.id;
        return `<div class="completed-card" style="margin-bottom:8px;"><div style="overflow:hidden; flex-grow:1;"><div class="pc-name">${item.name} ${repeatBadge}</div><div class="pc-meta"><span style="background:var(--bg-subtle); color:var(--text-muted); padding:1px 4px; border-radius:3px; font-family:monospace; margin-right:5px;">${displaySerial}</span>${item.test}</div></div><div style="display:flex; gap:8px;"><button class="btn-icon" id="btn-undo-${item.id}" onclick="undoResult('${item.id}')" style="color: var(--warning);" title="Undo Result"><i class="ph ph-arrow-u-up-left"></i></button><button class="btn-icon" onclick="printDirect(event, '${item.id}', '${tCodePrint}')" style="color: var(--success);" title="Print"><i class="ph ph-printer"></i></button><button class="btn-icon" onclick="downloadDirect(event, '${item.id}', '${tCodePrint}')" style="color: var(--pri);" title="Download PDF"><i class="ph ph-download-simple"></i></button></div></div>`;
    }).join('');

    const cPend = document.getElementById('count-pending'); if(cPend) cPend.innerText = `(${fPending.length})`;
}

async function saveAndPrintResult(id, safeId, btn) {
    const inputs = document.querySelectorAll('.res-' + safeId); const item = window.pendingData.find(d => String(d.id) === String(id).trim());
    let newResults = {}; inputs.forEach(inp => { newResults[inp.getAttribute('data-key')] = inp.value; }); let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; let tCodePrint = getTestCodeFromName(item.test);
    if (tCodePrint === "GXP" && (!newResults["Remarks"] || newResults["Remarks"].trim() === "")) { if (detailsObj["X-Ray Result"]) { newResults["Remarks"] = "X-Ray: " + detailsObj["X-Ray Result"]; } }
    let finalStr = JSON.stringify({ ...detailsObj, ...newResults }); const oldText = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';
    try {
        const res = await apiPost("saveLabResult", { patientId: item.patientId, testId: id, jsonDetails: finalStr, encodedBy: currentUser.fullName || currentUser.username, updatedName: item.name, updatedTest: item.test });
        if (res.status === "success") { btn.style.background = "var(--success)"; btn.style.color = "white"; btn.innerHTML = '<i class="ph ph-check"></i> Saved'; await loadPendingData(); printDirect(null, id, tCodePrint); }
    } catch (err) { btn.disabled = false; btn.innerHTML = oldText; showAppAlert("Error", "Failed to save and print.", "error"); }
}

async function moveToPendingRepeat(idStr) {
    const item = window.completedData.find(i => String(i.id) === String(idStr)); if(!item) return;
    const btn = document.getElementById('btn-repeat-' + item.id.replace(/[^a-zA-Z0-9]/g, "")); if(btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Moving...'; btn.disabled = true; }
    let d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details; let cleanDetails = { age: d.age || d.Age || "", sex: d.sex || d.Sex || "", facility: d.facility || d.Facility || "", address: d.address || d.Address || "", contact: d.contact || d.Contact || "", bday: d.bday || d.Bday || "", "History of Treatment": d["History of Treatment"] || "", "Source of Request": d["Source of Request"] || "", "X-Ray Result": d["X-Ray Result"] || "" };
    let tCode = ""; try { tCode = getTestCodeFromName(item.test); } catch(e){} const testEntry = { name: item.test, code: tCode, details: cleanDetails }; const formData = { patientId: item.patientId, fullName: item.name, bday: cleanDetails.bday, sex: cleanDetails.sex, age: cleanDetails.age, address: cleanDetails.address, contact: cleanDetails.contact, email: "", facility: cleanDetails.facility, encoderFullName: currentUser.fullName || currentUser.username, encoder: currentUser.username, testsData: JSON.stringify([testEntry]) };
    try { const res = await apiPost("submitForm", { formObject: formData }); if (res && res.status === "success") { await apiPost("deletePendingTestById", { testId: item.id }); await loadPendingData(); } else { showAppAlert("Error", res ? res.message : "Error", "error"); if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } } } catch (err) { showAppAlert("Error", "Error moving.", "error"); if(btn) { btn.innerHTML = "Move to Pending"; btn.disabled = false; } }
}

function toggleExpand(safeId) { const el = document.getElementById('expand-' + safeId); el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
async function deleteEntry(id) { 
    try { 
        await apiPost("deletePendingTestById", { testId: id }); 
        await apiPost("logAudit", { username: currentUser.username, action: "DELETE", details: `Deleted test entry ${id}` });
        loadPendingData(); 
    } catch(e) {} 
}

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
     case 'DENGUE': { let showDuo = req.includes('DUO'); return `<div class="form-grid grid-3">${select('Dengue_Result', 'Dengue NS1', ['', 'Negative', 'Positive'])}${showDuo ? select('Dengue_IgG', 'Dengue IgG', ['', 'Negative', 'Positive']) : ''}${showDuo ? select('Dengue_IgM', 'Dengue IgM', ['', 'Negative', 'Positive']) : ''}</div>${rem}`; }
     default: return `<div class="form-grid grid-1">${input('Result','Result')}</div>${rem}`;
 }
}

async function openRegistryTab(type, page = 1, forceSearch = null, forceMonth = null, forceCol = null) {
    window.CURRENT_TEST_TYPE = type; currentRegistryPage = page; 
    const titleEl = document.getElementById('regTitle'); 
    if(titleEl) {
        titleEl.innerHTML = `<i class="ph ph-books" style="color:var(--pri);"></i> Laboratory Registry - ${type} <button onclick="window.REGISTRY_SORT_ORDER = window.REGISTRY_SORT_ORDER === 'ASC' ? 'DESC' : 'ASC'; openRegistryTab('${type}');" class="btn btn-secondary text-xs" style="margin-left:15px; padding:4px 8px;"><i class="ph ph-sort-ascending"></i> Toggle Sort (${window.REGISTRY_SORT_ORDER})</button>`;
    }
    
    document.querySelectorAll('#registry-tabs .chip').forEach(c => c.classList.remove('active')); const activeBtn = document.querySelector(`#registry-tabs .chip[data-tab="${type}"]`); if(activeBtn) activeBtn.classList.add('active');
    const cont = document.getElementById('registry-table-content'); if(!cont) return;
    cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="ph ph-spinner ph-spin" style="font-size:2rem;"></i> Loading registry data...</div>';
    
    try {
        const sQuery = forceSearch !== null ? forceSearch : (document.getElementById('regSearch') ? document.getElementById('regSearch').value.trim() : "");
        const mQuery = forceMonth !== null ? forceMonth : (document.getElementById('monthFilter') ? document.getElementById('monthFilter').value.trim() : "");
        const cQuery = forceCol !== null ? forceCol : ((document.getElementById('colFilter') && document.getElementById('colFilter').value !== "ALL") ? document.getElementById('colFilter').options[document.getElementById('colFilter').selectedIndex].text : "ALL"); 

        const res = await apiGet("getRegistryDataOptimized", { type: type, facility: currentUser.facility, role: currentUser.role, page: currentRegistryPage, limit: registryLimit, searchQuery: sQuery, monthFilter: mQuery, colFilter: cQuery, sortOrder: window.REGISTRY_SORT_ORDER });
        
        if (res && res.status === "success" && res.data) {
            const registryData = res.data;
            if (registryData.error || (registryData.rows && registryData.rows.length > 0 && registryData.rows[0][0] && String(registryData.rows[0][0]).includes("RESTRICTED"))) { cont.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger); font-weight:bold;"><i class="ph ph-lock-key" style="font-size:2rem; display:block; margin-bottom:10px;"></i>${registryData.rows ? registryData.rows[0][0] : "Access Restricted."}</div>`; return; }

            window.CURRENT_REGISTRY_HEADERS = registryData.headers || []; window.CURRENT_REGISTRY_TITLE = registryData.title || type;
            
            const formatHeader = (str) => {
                if(!str) return '';
                if(str.toUpperCase() === 'ID') return 'ID';
                return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            };
            const displayHeaders = window.CURRENT_REGISTRY_HEADERS.map(formatHeader);

            const hMap = displayHeaders.map((h, i) => window.CURRENT_REGISTRY_HEADERS[i].includes("{") ? null : { index: i, text: h.replace("Date ","").replace("Patient ",""), original: window.CURRENT_REGISTRY_HEADERS[i] }).filter(x=>x);
            const colFilter = document.getElementById('colFilter'); if(colFilter) { colFilter.innerHTML = '<option value="ALL">All Columns</option>'; hMap.forEach((c, displayIndex) => colFilter.innerHTML += `<option value="${displayIndex}">${c.text}</option>`); }

            const rows = registryData.rows || [];
            let html = `<table class="data-table"><thead><tr><th style="width:30px; z-index:6;"><input type="checkbox" onclick="document.querySelectorAll('#regTableBody tr:not([style*=\\'display: none\\']) .chk-reg').forEach(c=>c.checked=this.checked); document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></th>`;
            hMap.forEach(c => html += `<th>${c.text}</th>`); html += `</tr></thead><tbody id="regTableBody">`;
            
            rows.forEach((row) => {
                html += `<tr onclick="this.classList.toggle('expanded-row')" style="cursor:pointer;"><td><input type="checkbox" class="chk-reg" value="${encodeURIComponent(JSON.stringify(row))}" onclick="event.stopPropagation()" onchange="document.getElementById('reg-selected-count').innerText=document.querySelectorAll('.chk-reg:checked').length;"></td>`;
                let isInitialRow = false; hMap.forEach(c => { let hName = c.original.toUpperCase().trim(); if (hName === 'REPEAT' || hName === 'TEST TYPE') { if (String(row[c.index]).toUpperCase().trim() === 'INITIAL') isInitialRow = true; } });
                hMap.forEach(c => {
                    let val = row[c.index] || ''; let hName = c.original.toUpperCase().trim();
                    let isResCol = hName.includes('RESULT') || hName.includes('DIAGNOSIS') || hName === 'HIV' || hName === 'SYPHILIS' || hName === 'HBSAG'; let isPerformedBy = hName === 'PERFORMED_BY';
                    if (isResCol && val !== "") {
                        let vU = String(val).toUpperCase().trim(); let bg = "transparent", col = "inherit"; 
                        if (vU === "CONFIDENTIAL" || isInitialRow) { bg = "#f1f5f9"; col = "#64748b"; } else if (vU === "I" || vU.includes("INVALID") || vU.includes("ERR")) { bg = "#000000"; col = "#ffffff"; } else if (vU === "T" || vU === "POSITIVE" || vU === "REACTIVE") { bg = "#fee2e2"; col = "#b91c1c"; } else if (vU === "N" || vU === "NEGATIVE" || vU === "NONREACTIVE" || vU === "NON-REACTIVE") { bg = "#dcfce7"; col = "#15803d"; } else if (vU === "RR" || vU.includes("RESISTANT")) { bg = "#991b1b"; col = "#ffffff"; } else if (vU === "TI") { bg = "#ffedd5"; col = "#c2410c"; } else if (vU === "TT") { bg = "#fef9c3"; col = "#b45309"; } 
                        html += `<td><span class="res-badge" style="${bg !== 'transparent' ? `background-color:${bg}; color:${col}; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;` : ''}">${val}</span></td>`;
                    } else if (isPerformedBy && val !== "") { html += `<td style="font-size:0.65rem; color:var(--text-muted);">${val}</td>`; } else { html += `<td>${val}</td>`; }
                }); html += `</tr>`;
            });
            html += `</tbody></table>`;
            cont.innerHTML = html; const topPagControls = document.getElementById('top-pagination-controls'); if (topPagControls) topPagControls.innerHTML = `<span class="badge badge-neutral" style="font-size:0.8rem;">Showing Top ${registryData.totalRows} Records</span>`;
        } else { cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">No records found in this logbook.</div>'; if(document.getElementById('top-pagination-controls')) document.getElementById('top-pagination-controls').innerHTML = ''; }
    } catch (e) { cont.innerHTML = '<div style="padding:40px; text-align:center; color:var(--danger);">Error loading registry data. Please try again.</div>'; if(document.getElementById('top-pagination-controls')) document.getElementById('top-pagination-controls').innerHTML = ''; }
}

let registrySearchTimeout = null;
function filterRegistryTable() {
    clearTimeout(registrySearchTimeout); const cont = document.getElementById('registry-table-content'); if (cont && document.getElementById('regSearch') === document.activeElement) cont.style.opacity = '0.5';
    registrySearchTimeout = setTimeout(() => { if(cont) cont.style.opacity = '1'; const sQuery = document.getElementById('regSearch') ? document.getElementById('regSearch').value.trim() : ""; const mQuery = document.getElementById('monthFilter') ? document.getElementById('monthFilter').value.trim() : ""; const cQuery = (document.getElementById('colFilter') && document.getElementById('colFilter').value !== "ALL") ? document.getElementById('colFilter').options[document.getElementById('colFilter').selectedIndex].text : "ALL"; openRegistryTab(window.CURRENT_TEST_TYPE, 1, sQuery, mQuery, cQuery); }, 800); 
}

function printRegistryLogbook() {
    const checkedBoxes = document.querySelectorAll('.chk-reg:checked');
    if (checkedBoxes.length === 0) { showAppAlert("Required", "Please select at least one record to print.", "error"); return; }
    let rowsData = []; checkedBoxes.forEach(chk => { rowsData.push(JSON.parse(decodeURIComponent(chk.value))); });
    
    let excludeCols = ["PATIENT_ID", "ID"]; 
    if (window.CURRENT_TEST_TYPE === 'GXP') excludeCols.push("SOURCE_OF_REQUEST"); 
    else if (window.CURRENT_TEST_TYPE === 'GRAM') excludeCols.push("VERIFIED_BY");
    
    let printHeaders = []; let headerIndices = [];
    window.CURRENT_REGISTRY_HEADERS.forEach((h, idx) => {
        const upperH = h.toUpperCase();
        if (excludeCols.some(ex => upperH === ex)) return; 
        if (h.includes("{") || h.includes("}")) return; 
        
        let prettyH = h.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        printHeaders.push(prettyH.replace("Date ", "").replace("Patient ", "")); headerIndices.push(idx);
    });
    if (window.CURRENT_TEST_TYPE === 'SERO') {
        const kapIdx = window.CURRENT_REGISTRY_HEADERS.findIndex(h => h.toUpperCase() === "KAP_CATEGORY");
        if (kapIdx > -1) rowsData.forEach(row => { if (String(row[kapIdx]).toUpperCase() === "NONE") row[kapIdx] = ""; });
    }
    
    const is10Rows = (window.CURRENT_TEST_TYPE === 'GXP' || window.CURRENT_TEST_TYPE === 'DSSM');
    const chunk = is10Rows ? 10 : 20; let fontSize = is10Rows ? "11px" : "8px"; let tdPadding = is10Rows ? "6px" : "3px"; 
    if(window.CURRENT_TEST_TYPE === 'GXP') { fontSize = "9px"; tdPadding = "4px"; }

    let html = `<html><head><title>Registry Logbook</title><style>body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 15px; font-size: ${fontSize}; color: #000; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff;} .page { page-break-after: always; position: relative; min-height: 95vh; display: flex; flex-direction: column;} .page:last-child { page-break-after: auto; } .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px; } .header h2 { margin: 0; font-size: 14px; text-transform: uppercase; } .header p { margin: 2px 0; font-size: 10px; font-weight: bold;} table { width: 100%; border-collapse: collapse; table-layout: auto; flex-grow: 1; } th, td { border: 1px solid #000; padding: ${tdPadding}; text-align: center; word-wrap: break-word; font-size: ${fontSize};} tr { height: auto; } th { background-color: #e2e8f0 !important; font-weight: bold; } .footer { margin-top: auto; border-top: 1px solid #000; padding-top: 5px; font-size: 7px; text-align: justify; line-height: 1.2; display: flex; gap: 20px;} .footer-col { flex: 1; }</style></head><body>`;
    
    for (let i = 0; i < rowsData.length; i += chunk) {
        const pageRows = rowsData.slice(i, i + chunk);
        html += `<div class="page"><div class="header"><h2>MUNICIPAL HEALTH OFFICE - ANGONO, RIZAL</h2><p>${window.CURRENT_REGISTRY_TITLE || window.CURRENT_TEST_TYPE + ' REGISTRY'}</p></div><table><thead><tr>`;
        printHeaders.forEach(h => { let widthStyle = (h.toUpperCase() === 'X-RAY RESULT' && window.CURRENT_TEST_TYPE === 'GXP') ? 'style="width: 15%; max-width: 100px;"' : ''; html += `<th ${widthStyle}>${h}</th>` }); 
        html += `</tr></thead><tbody>`;
        
        pageRows.forEach(row => { 
            html += `<tr>`; let isInitialRow = false;
            headerIndices.forEach((idx, i) => { let hName = printHeaders[i].toUpperCase().trim(); if (hName === 'REPEAT' || hName === 'TEST TYPE') { if (String(row[idx]).toUpperCase().trim() === 'INITIAL') isInitialRow = true; } });

            headerIndices.forEach((idx, i) => { 
                let val = row[idx] || ''; let hName = printHeaders[i].toUpperCase().trim();
                let isResCol = hName.includes('RESULT') || hName.includes('DIAGNOSIS') || hName === 'HIV' || hName === 'SYPHILIS' || hName === 'HBSAG'; let isPerformedBy = hName === 'PERFORMED BY'; let isXrayCol = (hName === 'X-RAY RESULT' && window.CURRENT_TEST_TYPE === 'GXP');
                if (hName === 'HIV' && String(val).toUpperCase().includes('REACTIVE') && !String(val).toUpperCase().includes('NON')) val = ""; 

                let bgStyle = ""; let textWeight = "normal"; let fontStyle = "";
                if (isResCol && val !== "") {
                    let vU = String(val).toUpperCase().trim(); textWeight = "bold";
                    if (vU === "CONFIDENTIAL" || isInitialRow) bgStyle = "background-color: #f1f5f9 !important; color: #64748b !important;"; 
                    else if (vU === "I" || vU.includes("INVALID") || vU.includes("ERR")) bgStyle = "background-color: #000000 !important; color: #ffffff !important;"; 
                    else if (vU === "T" || vU === "POSITIVE" || vU === "REACTIVE") bgStyle = "background-color: #fee2e2 !important; color: #b91c1c !important;"; 
                    else if (vU === "N" || vU === "NEGATIVE" || vU === "NONREACTIVE" || vU === "NON-REACTIVE") bgStyle = "background-color: #dcfce7 !important; color: #15803d !important;"; 
                    else if (vU === "RR" || vU.includes("RESISTANT")) bgStyle = "background-color: #991b1b !important; color: #ffffff !important;"; 
                    else if (vU === "TI") bgStyle = "background-color: #ffedd5 !important; color: #c2410c !important;"; 
                    else if (vU === "TT") bgStyle = "background-color: #fef9c3 !important; color: #b45309 !important;"; 
                } else if (isPerformedBy && val !== "") { const pfSize = is10Rows ? "7px" : "6px"; fontStyle = `font-size: ${pfSize}; color: #555;`; }
                if (isXrayCol) { fontStyle += `font-size: 7px; max-width: 100px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`; }
                html += `<td style="${bgStyle} font-weight: ${textWeight}; ${fontStyle}">${val}</td>`; 
            }); 
            html += `</tr>`; 
        });
        html += `</tbody></table><div class="footer"><div class="footer-col"><strong>System Generated Report:</strong> This document is generated by the Angono MHO Laboratory Information System. No signature is required for system-generated summaries. However, official individual result forms must be signed by a licensed Medical Technologist and Pathologist.<br><strong>Confidentiality Notice:</strong> This document contains sensitive personal health information protected by the Data Privacy Act of 2012 (RA 10173). Unauthorized disclosure, copying, or distribution of this information is strictly prohibited.</div><div class="footer-col"><strong>Data Validity:</strong> The data presented is based on the records encoded by the facility personnel as of the generated date. Any discrepancies should be reported to the Laboratory Head for immediate verification and correction.<br><strong>Certification:</strong> This report is intended for internal monitoring, surveillance, and official submission to the Department of Health (DOH) and Municipal Health Office (MHO) only.</div></div></div>`;
    }
    html += `</body></html>`;
    const printWin = window.open('', '_blank'); printWin.document.write(html); printWin.document.close(); setTimeout(() => { printWin.print(); printWin.close(); }, 800);
}

async function loadSettingsData() { 
    try {
        const res = await apiPost("getSettingsData", {}); 
        if (res.status === "success") {
            const data = res.data; globalStaffList = data.staff || []; globalFacilityList = data.facilities || [];
            renderFacilityList(); renderStaffList(); renderSettings(data.users); 
            const dropdowns = [document.getElementById('u_facility'), document.getElementById('edit_u_fac')];
            dropdowns.forEach(drop => { if(drop) { drop.innerHTML = '<option value="ALL">ALL / MAIN</option>'; globalFacilityList.forEach(f => { drop.innerHTML += `<option value="${f.name}">${f.name}</option>`; }); } });
        } else { showAppAlert("Error", "Failed to load settings. Please try again.", "error"); }
    } catch(e) { console.log("Settings Load Error: ", e); } 
}

function renderSettings(users) { 
    const uList = document.getElementById('list-users'); if (!uList) return; 
    if (!users || users.length === 0) { uList.innerHTML = '<div style="text-align:center; color:var(--text-muted);">No users found.</div>'; return; } 
    const isAdmin = (String(currentUser.role || "").toUpperCase() === 'ADMIN'); 
    uList.innerHTML = users.map(u => { 
        const status = String(u.status || "").toUpperCase(); const isPending = (status === 'PENDING'); let statusDisplay = ''; let cardBorder = 'border-color: var(--border-color);'; 
        if (isPending && isAdmin) { cardBorder = 'border-color: var(--warning); background: var(--warning-bg);'; statusDisplay = `<div style="display:flex; gap:8px; margin-top:8px;"><button onclick="decideUser('${u.username}', 'APPROVE')" class="btn btn-primary" style="padding: 4px 8px; font-size: 0.7rem; background: var(--success);"><i class="ph ph-check"></i></button><button onclick="decideUser('${u.username}', 'REJECT')" class="btn btn-danger" style="padding: 4px 8px; font-size: 0.7rem;"><i class="ph ph-x"></i></button></div>`; } else { let badgeClass = status === 'ACTIVE' ? 'badge-negative' : (status === 'REJECTED' ? 'badge-positive' : 'badge-warning'); statusDisplay = `<div style="margin-top:8px;"><span class="badge ${badgeClass}">${status}</span></div>`; } 
        let editBtn = isAdmin ? `<button onclick="openEditUser('${u.username}', '${u.fullname}', '${u.role}', '${u.status}', '${u.facility}')" class="btn-icon"><i class="ph ph-pencil-simple"></i></button>` : ''; 
        return `<div class="pending-card" style="margin-bottom: 8px; ${cardBorder} flex-direction: row; justify-content: space-between; align-items: flex-start;"><div><div class="pc-name">${u.fullname}</div><div class="pc-meta" style="margin-top:2px;">@${u.username} • ${u.role} • ${u.facility}</div>${statusDisplay}</div>${editBtn}</div>`; 
    }).join(''); 
}

let currentEditTarget = ""; 
function openEditUser(username, name, role, status, fac) { currentEditTarget = username; document.getElementById('edit_u_user').value = username; document.getElementById('edit_u_name').value = name; document.getElementById('edit_u_role').value = role; document.getElementById('edit_u_status').value = status; document.getElementById('edit_u_fac').value = fac; document.getElementById('edit_u_pass').value = ""; document.getElementById('edit-user-modal').style.display = 'flex'; } 
function closeEditModal() { document.getElementById('edit-user-modal').style.display = 'none'; } 

async function saveUserChangesFull() { 
    const updatedData = { u: document.getElementById('edit_u_user').value, name: document.getElementById('edit_u_name').value, p: document.getElementById('edit_u_pass').value, role: document.getElementById('edit_u_role').value, status: document.getElementById('edit_u_status').value, fac: document.getElementById('edit_u_fac').value };
    if(!updatedData.u || !updatedData.name) { showAppAlert("Required", "Username and Name cannot be blank.", "error"); return; }
    const btn = document.getElementById('btn-save-user-full'); const oldText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true; 
    try { await apiPost("updateUserFull", { oldUsername: currentEditTarget, updatedData: updatedData, adminRole: currentUser.role }); showAppAlert("Updated", "User details saved.", "success"); closeEditModal(); loadSettingsData(); } catch(e) { showAppAlert("Error", String(e), "error"); } finally { btn.innerHTML = oldText; btn.disabled = false; } 
} 

async function deleteUserRecord() { customConfirm(`Are you sure you want to permanently delete @${currentEditTarget}?`, async () => { try { await apiPost("deleteUser", { targetUsername: currentEditTarget, adminRole: currentUser.role }); showAppAlert("Deleted", "User has been removed.", "success"); closeEditModal(); loadSettingsData(); } catch(e) { showAppAlert("Error", String(e), "error"); } }); }
async function decideUser(username, action) { customConfirm(action + " access for " + username + "?", async () => { try { await apiPost("approveUser", { targetUsername: username, userAction: action, adminRole: currentUser.role }); loadSettingsData(); } catch(e) {} }); } 

async function saveUser() { 
    const user = { u: document.getElementById('u_user').value, p: document.getElementById('u_pass').value, role: document.getElementById('u_role').value, fac: document.getElementById('u_facility').value, name: document.getElementById('u_fullname').value }; 
    if(!user.u || !user.p || !user.role || !user.name) { showAppAlert("Required", "Please fill all fields.", "error"); return; } 
    const btn = document.querySelector('#user-form button'); const oldText = btn.innerText; btn.innerHTML = "SAVING..."; btn.disabled = true; 
    try { await apiPost("saveNewUser", { data: { username: user.u, password: user.p, facility: user.fac, role: user.role, fullName: user.name, roleCheck: currentUser.role }}); toggleForm('user-form'); document.getElementById('u_user').value = ""; document.getElementById('u_pass').value = ""; document.getElementById('u_fullname').value = ""; loadSettingsData(); } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } 
}

let globalFacilityList = []; 
function renderFacilityList() { const container = document.getElementById('list-facilities'); if(!container) return; container.innerHTML = globalFacilityList.map((f, index) => `<div class="pending-card" style="margin-bottom: 8px; border-left: 3px solid var(--warning); flex-direction: row; justify-content: space-between; align-items: flex-start;"><div><div class="pc-name">${f.name}</div><div class="pc-meta" style="margin-top:2px;">${f.address || ""}</div>${ f.person ? `<div class="pc-meta" style="margin-top:2px; color:var(--pri);">${f.person} (${f.number})</div>` : '' }</div><div style="display:flex; gap:4px;"><button onclick="editFacility(${index})" class="btn-icon"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Remove facility?', () => deleteFacility(${index}))" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button></div></div>`).join(''); } 
let editingFacilityIndex = -1; 
async function handleSaveFacility() { const name = document.getElementById('f_name').value; if (!name) return; const newItem = { name: name, address: document.getElementById('f_address').value, person: document.getElementById('f_person').value, number: document.getElementById('f_number').value }; if (editingFacilityIndex >= 0) { globalFacilityList[editingFacilityIndex] = newItem; editingFacilityIndex = -1; } else { globalFacilityList.push(newItem); } renderFacilityList(); clearFacilityForm(); toggleForm('fac-form'); } 
function editFacility(index) { const f = globalFacilityList[index]; document.getElementById('f_name').value = f.name; document.getElementById('f_address').value = f.address; document.getElementById('f_person').value = f.person; document.getElementById('f_number').value = f.number; editingFacilityIndex = index; document.getElementById('fac-form').style.display = 'block'; } 
function deleteFacility(index) { globalFacilityList.splice(index, 1); renderFacilityList(); } 
function clearFacilityForm() { document.getElementById('f_name').value = ""; document.getElementById('f_address').value = ""; document.getElementById('f_person').value = ""; document.getElementById('f_number').value = ""; editingFacilityIndex = -1; }

let globalStaffList = []; let editingStaffIndex = -1; 
function renderStaffList() { const container = document.getElementById('staffListContainer'); if (!container) return; if (globalStaffList.length === 0) { container.innerHTML = '<div style="text-align:center; color:var(--text-muted);">No staff found.</div>'; return; } container.innerHTML = globalStaffList.map((s, index) => { let previewUrl = cleanDriveLink(s.sigUrl); const sigBadge = previewUrl ? `<img src="${previewUrl}" style="height:30px; border:1px solid var(--border-color); border-radius:4px; padding:2px; object-fit:contain;" onerror="this.style.display='none'">` : `<span class="badge badge-neutral">No Sig</span>`; return `<div class="pending-card" style="margin-bottom: 8px; border-left: 3px solid var(--danger); flex-direction: row; justify-content: space-between; align-items: center;"><div style="flex:1;"><div class="pc-name">${s.name}</div><div class="pc-meta" style="margin-top:2px;">${s.role} • Lic: ${s.license || "N/A"}</div></div><div style="margin-right: 12px;">${sigBadge}</div><div style="display:flex; gap:4px;"><button onclick="editStaff(${index})" class="btn-icon"><i class="ph ph-pencil-simple"></i></button><button onclick="customConfirm('Remove staff?', () => deleteStaff(${index}))" class="btn-icon" style="color:var(--danger);"><i class="ph ph-trash"></i></button></div></div>`; }).join(''); } 
function cleanDriveLink(url) { if (!url) return ""; if (url.includes("drive.google.com")) { let id = ""; let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/); if (match) id = match[1]; else { match = url.match(/id=([a-zA-Z0-9_-]+)/); if (match) id = match[1]; } if (id) return "https://drive.google.com/thumbnail?id=" + id + "&sz=w1000"; } return url; } 
async function handleSaveStaff() { const name = document.getElementById('staffName').value; if (!name) return; const btn = document.querySelector('#staff-form .btn-primary'); const oldText = btn.innerText; btn.innerHTML = "PROCESSING..."; btn.disabled = true; const newItem = { name: name, role: document.getElementById('staffRole').value, license: document.getElementById('staffLicense').value, sigUrl: cleanDriveLink(document.getElementById('staffSigUrl').value) }; if (editingStaffIndex >= 0) { globalStaffList[editingStaffIndex] = newItem; editingStaffIndex = -1; } else { globalStaffList.push(newItem); } renderStaffList(); clearStaffForm(); try { await apiPost("saveStaffData", { staffArray: globalStaffList }); toggleForm('staff-form'); } catch(e) {} finally { btn.innerText = oldText; btn.disabled = false; } } 
function editStaff(index) { const s = globalStaffList[index]; document.getElementById('staffName').value = s.name; document.getElementById('staffRole').value = s.role; document.getElementById('staffLicense').value = s.license; document.getElementById('staffSigUrl').value = s.sigUrl || ""; editingStaffIndex = index; document.getElementById('staff-form').style.display = 'block'; } 
async function deleteStaff(index) { globalStaffList.splice(index, 1); renderStaffList(); try { await apiPost("saveStaffData", { staffArray: globalStaffList }); } catch(e) {} } 
function clearStaffForm() { document.getElementById('staffName').value = ""; document.getElementById('staffRole').value = "Medical Technologist"; document.getElementById('staffLicense').value = ""; document.getElementById('staffSigUrl').value = ""; editingStaffIndex = -1; } 
function toggleForm(id) { const el = document.getElementById(id); if(el) el.style.display = (el.style.display === 'block') ? 'none' : 'block'; }

function switchTab(id) { document.querySelectorAll('.tab-view').forEach(el => el.style.display = 'none'); document.querySelectorAll('.chip').forEach(el => el.classList.remove('active')); document.getElementById('tab-' + id).style.display = 'block'; const btn = document.getElementById('tab-btn-' + id); if(btn) btn.classList.add('active'); }
function togglePeriod() { const type = document.querySelector('input[name="rep_type"]:checked').value; document.getElementById('rep_month').style.display = (type === 'monthly') ? 'inline-block' : 'none'; document.getElementById('rep_quarter').style.display = (type === 'quarterly') ? 'inline-block' : 'none'; }

async function generateReport() { 
    const type = document.querySelector('input[name="rep_type"]:checked').value; const year = document.getElementById('rep_year').value; let targetFacility = "ALL"; let userRole = "VIEWER"; 
    try { if (typeof currentUser !== 'undefined') { userRole = String(currentUser.role || "VIEWER").toUpperCase().replace(/\s+/g, '_'); if (userRole === 'VIEWER' || userRole === 'ENCODER') { targetFacility = currentUser.facility || "ALL"; } } } catch (e) {} 
    let val = 0; let text = ""; if (type === 'monthly') { const sel = document.getElementById('rep_month'); val = sel.value; text = sel.options[sel.selectedIndex].text.toUpperCase() + " " + year; } else if (type === 'quarterly') { const sel = document.getElementById('rep_quarter'); val = sel.value; text = sel.options[sel.selectedIndex].text.toUpperCase() + " " + year; } else { val = 0; text = "ANNUAL REPORT " + year; } let facLabel = (targetFacility === "ALL") ? "(CONSOLIDATED)" : `(${targetFacility})`; document.querySelectorAll('.rep-period').forEach(el => el.innerText = `- ${text} ${facLabel}`); 
    const btn = document.getElementById('btn-generate-rep'); const oldHtml = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> PROCESSING...'; btn.disabled = true; 
    
    try { 
        let q = sb.from('lab_tests').select('*').eq('status', 'COMPLETED');
        if(targetFacility !== "ALL") q = q.eq('facility', targetFacility);
        const { data, error } = await q;
        if (data) { 
            const d = buildReportData(data, type, val, year, targetFacility);
            renderTB(d.tb); renderHIV(d.hiv); renderSTI(d.sti); renderDengue(d.dengue); renderWorkload(d.workload); renderFHSIS(d.fhsis_maternal); 
        } 
    } catch (err) {} finally { btn.innerHTML = oldHtml; btn.disabled = false; } 
}

function buildReportData(data, type, val, year, targetFacility) {
    let report = { tb: { exam: {new:0, ret:0}, pos: {new:0, ret:0}, rr: {new:0, ret:0}, t: {new:0, ret:0}, ti: {new:0, ret:0}, n: {new:0, ret:0}, tt: {new:0, ret:0}, invalid: {new:0, ret:0}, initial: {new:0, ret:0}, cartridges: 0, dssm: 0 }, hiv: { tested: createHivGrid(), reactive: createHivGrid() }, sti: { hiv: {m:0, f:0, mat:0, m_r:0, f_r:0, mat_r:0, total:0, react:0}, syph: {m:0, f:0, mat:0, m_r:0, f_r:0, mat_r:0, total:0, react:0}, hbsag: {m:0, f:0, mat:0, m_r:0, f_r:0, mat_r:0, total:0, react:0} }, dengue: { pos:0, neg:0, total:0 }, fhsis_maternal: {}, workload: {} };
    const FACILITIES = ["SAN ISIDRO", "SAN VICENTE", "KALAYAAN", "STO. NIÑO", "SAN ROQUE", "MAHABANG PARANG", "POB. ITAAS", "POB. IBABA", "BAGUMBAYAN", "SAN PEDRO", "ANGONO RHU I"];
    FACILITIES.forEach(f => report.fhsis_maternal[f] = { syp_s_t:0, syp_s_10:0, syp_s_15:0, syp_s_20:0, syp_p_t:0, syp_p_10:0, syp_p_15:0, syp_p_20:0, hiv_s_t:0, hiv_s_10:0, hiv_s_15:0, hiv_s_20:0, hiv_r_t:0, hiv_r_10:0, hiv_r_15:0, hiv_r_20:0, hbs_s_t:0, hbs_s_10:0, hbs_s_15:0, hbs_s_20:0, hbs_r_t:0, hbs_r_10:0, hbs_r_15:0, hbs_r_20:0 });

    let filterFac = (targetFacility || "").trim().toUpperCase(); if (filterFac === "ADMIN" || filterFac === "ALL" || filterFac === "MAIN") filterFac = "";

    data.forEach(row => {
        let rDate = row.date || row.date_received || row.Date || row["Date Received"];
        if (!isDateInPeriod(rDate, type, val, year)) return;
        let rowFac = String(row.facility || "").toUpperCase().trim(); if (filterFac !== "" && rowFac !== filterFac) return;

        let tName = String(row.test_name || "").toUpperCase(); report.workload[tName] = (report.workload[tName] || 0) + 1;
        let details = row.details || {};

        if (tName.includes('GENEXPERT') || tName.includes('GXP')) {
            report.tb.cartridges++; let ptType = String(details["History of Treatment"] || "").toUpperCase().includes("RETREAT") ? "ret" : "new";
            let res = String(details.ResultCode || "").toUpperCase(); let rem = String(details.Remarks || "").toUpperCase(); let full = res + " " + rem;
            if (res === "I" || full.includes("INVALID") || full.includes("ERROR")) report.tb.invalid[ptType]++;
            else if (full.includes("INITIAL")) report.tb.initial[ptType]++;
            else if (res === "RR" || full.includes("RR")) { report.tb.rr[ptType]++; report.tb.pos[ptType]++; report.tb.exam[ptType]++; }
            else if (res === "TT" || full.includes("TRACE")) { report.tb.tt[ptType]++; report.tb.pos[ptType]++; report.tb.exam[ptType]++; }
            else if (res === "TI" || full.includes("INDETERMINATE")) { report.tb.ti[ptType]++; report.tb.pos[ptType]++; report.tb.exam[ptType]++; }
            else if (res === "T" || full.includes("SENSITIVE")) { report.tb.t[ptType]++; report.tb.pos[ptType]++; report.tb.exam[ptType]++; }
            else if (res === "N" || full.includes("NOT DETECTED")) { report.tb.n[ptType]++; report.tb.exam[ptType]++; }
        }
        if (tName.includes('DSSM') || tName.includes('AFB')) report.tb.dssm++;

        if (tName.includes('DENGUE')) {
            report.dengue.total++; let dRes = String(details.Dengue_Result || details.Result || "").toUpperCase();
            if (dRes.includes("POS")) report.dengue.pos++; else report.dengue.neg++;
        }

        if (tName.includes('SERO')) {
            let age = parseInt(details.age || details.Age) || 0; let sex = String(details.sex || details.Sex).toUpperCase().charAt(0);
            let classification = String(details.Classification || "").toUpperCase(); let isMat = classification.includes("MATERNAL") || classification.includes("PREGNANT"); let isTB = classification.includes("TB") || classification.includes("TUBER"); let kap = String(details["KAP Category"] || "").toUpperCase();
            let ageKey = ""; if (age >= 10 && age <= 14) ageKey = "10"; else if (age >= 15 && age <= 19) ageKey = "15"; else if (age >= 20 && age <= 49) ageKey = "20";

            let facRow = rowFac;
            let hiv = String(details.HIV || "").toUpperCase();
            if (hiv && hiv !== "-") {
                fillHivGrid(report.hiv.tested, age, sex, isMat, kap, isTB); report.sti.hiv.total++;
                if (sex === 'M') report.sti.hiv.m++; else { report.sti.hiv.f++; if(isMat) report.sti.hiv.mat++; }
                if (isMat && report.fhsis_maternal[facRow]) { report.fhsis_maternal[facRow].hiv_s_t++; if (ageKey) report.fhsis_maternal[facRow]["hiv_s_" + ageKey]++; }
                if (hiv.includes("REACTIVE") && !hiv.includes("NON")) {
                    fillHivGrid(report.hiv.reactive, age, sex, isMat, kap, isTB); report.sti.hiv.react++;
                    if (sex === 'M') report.sti.hiv.m_r++; else { report.sti.hiv.f_r++; if(isMat) report.sti.hiv.mat_r++; }
                    if (isMat && report.fhsis_maternal[facRow]) { report.fhsis_maternal[facRow].hiv_r_t++; if (ageKey) report.fhsis_maternal[facRow]["hiv_r_" + ageKey]++; }
                }
            }
            
            let syph = String(details.Syphilis || details.SYPHILIS || "").toUpperCase();
            if (syph && syph !== "-") {
                report.sti.syph.total++; if (sex === 'M') report.sti.syph.m++; else { report.sti.syph.f++; if(isMat) report.sti.syph.mat++; }
                if (isMat && report.fhsis_maternal[facRow]) { report.fhsis_maternal[facRow].syp_s_t++; if (ageKey) report.fhsis_maternal[facRow]["syp_s_" + ageKey]++; }
                if (syph.includes("REACTIVE") && !syph.includes("NON")) {
                    report.sti.syph.react++; if (sex === 'M') report.sti.syph.m_r++; else { report.sti.syph.f_r++; if(isMat) report.sti.syph.mat_r++; }
                    if (isMat && report.fhsis_maternal[facRow]) { report.fhsis_maternal[facRow].syp_p_t++; if (ageKey) report.fhsis_maternal[facRow]["syp_p_" + ageKey]++; }
                }
            }

            let hbs = String(details.HBsAg || details.HBSAG || "").toUpperCase();
            if (hbs && hbs !== "-") {
                report.sti.hbsag.total++; if (sex === 'M') report.sti.hbsag.m++; else { report.sti.hbsag.f++; if(isMat) report.sti.hbsag.mat++; }
                if (isMat && report.fhsis_maternal[facRow]) { report.fhsis_maternal[facRow].hbs_s_t++; if (ageKey) report.fhsis_maternal[facRow]["hbs_s_" + ageKey]++; }
                if (hbs.includes("REACTIVE") && !hbs.includes("NON")) {
                    report.sti.hbsag.react++; if (sex === 'M') report.sti.hbsag.m_r++; else { report.sti.hbsag.f_r++; if(isMat) report.sti.hbsag.mat_r++; }
                    if (isMat && report.fhsis_maternal[facRow]) { report.fhsis_maternal[facRow].hbs_r_t++; if (ageKey) report.fhsis_maternal[facRow]["hbs_r_" + ageKey]++; }
                }
            }
        }
    });
    return report;
}

function createHivGrid() { return { m: {c15:0, c1524:0, c2534:0, c3549:0, c50:0}, f: {c15:0, c1524:0, c2534:0, c3549:0, c50:0, mat:0}, kap: {msm:0, tgw:0, msw:0, fsw:0, pwid:0, tb:0}, total: 0 }; }
function fillHivGrid(grid, age, sex, isMat, kap, isTB) { grid.total++; let bucket = "c50"; if(age<15) bucket="c15"; else if(age<=24) bucket="c1524"; else if(age<=34) bucket="c2534"; else if(age<=49) bucket="c3549"; if(sex==='M') grid.m[bucket]++; else { grid.f[bucket]++; if(isMat) grid.f.mat++; } if(kap.includes("MSM")) grid.kap.msm++; if(kap.includes("TGW")) grid.kap.tgw++; if(kap.includes("MSW")) grid.kap.msw++; if(kap.includes("FSW")) grid.kap.fsw++; if(kap.includes("PWID")) grid.kap.pwid++; if(isTB) grid.kap.tb++; }
function isDateInPeriod(dStr, type, val, year) { 
    const d = parseAnyDate(dStr);
    if(!d) return false; 
    if (String(d.getFullYear()) !== String(year)) return false; 
    if (type === 'annual') return true; 
    let m = d.getMonth() + 1; 
    if (type === 'monthly') return String(m) === String(val); 
    if (type === 'quarterly') { 
        if (val == 1) return (m >= 1 && m <= 3); 
        if (val == 2) return (m >= 4 && m <= 6); 
        if (val == 3) return (m >= 7 && m <= 9); 
        if (val == 4) return (m >= 10 && m <= 12); 
    } 
    return false; 
}

function renderFHSIS(data) { if (!data) return; const facMap = { "SAN ISIDRO": "SI", "SAN VICENTE": "SV", "KALAYAAN": "KA", "STO. NIÑO": "SN", "SAN ROQUE": "SR", "MAHABANG PARANG": "MP", "POB. ITAAS": "PI", "POB. IBABA": "PB", "BAGUMBAYAN": "BA", "SAN PEDRO": "SP", "ANGONO RHU I": "R1" }; const keys = [ "syp_s_t", "syp_s_10", "syp_s_15", "syp_s_20", "syp_p_t", "syp_p_10", "syp_p_15", "syp_p_20", "hiv_s_t", "hiv_s_10", "hiv_s_15", "hiv_s_20", "hiv_r_t", "hiv_r_10", "hiv_r_15", "hiv_r_20", "hbs_s_t", "hbs_s_10", "hbs_s_15", "hbs_s_20", "hbs_r_t", "hbs_r_10", "hbs_r_15", "hbs_r_20" ]; keys.forEach(key => { let rowTotal = 0; Object.keys(facMap).forEach(facName => { let val = (data[facName] && data[facName][key]) ? data[facName][key] : 0; let cellId = key + "_" + facMap[facName]; let cell = document.getElementById(cellId); if (cell) { cell.innerText = val; rowTotal += val; } }); let totalCell = document.getElementById(key + "_TOT"); if (totalCell) totalCell.innerText = rowTotal; }); }
function renderTB(tb) { const row = (lbl, n, r) => `<tr><td style="font-weight:600; text-align:left;">${lbl}</td><td class="text-center">${n || 0}</td><td class="text-center">${r || 0}</td></tr>`; document.getElementById('tb-exam-body').innerHTML = row("EXAMINED", tb.exam.new, tb.exam.ret) + row("INVALID / ERROR", tb.invalid.new, tb.invalid.ret) + row("INITIAL RESULT", tb.initial.new, tb.initial.ret); document.getElementById('tb-res-body').innerHTML = row("MTB DETECTED", tb.pos.new, tb.pos.ret) + row(" > RIF RESISTANT", tb.rr.new, tb.rr.ret) + row(" > TRACE DETECTED", tb.tt.new, tb.tt.ret) + row(" > INDETERMINATE", tb.ti.new, tb.ti.ret) + row(" > SENSITIVE", tb.t.new, tb.t.ret) + row("MTB NOT DETECTED", tb.n.new, tb.n.ret); document.getElementById('tb-cart').innerText = tb.cartridges || 0; const dssmEl = document.getElementById('tb-dssm'); if(dssmEl) dssmEl.innerText = tb.dssm || 0; }
function renderHIV(h) { const buildRow = (grid) => `<tr><td style="font-weight:600; text-align:left;">ANGONO</td><td class="text-center">${grid.m.c15}</td><td class="text-center">${grid.m.c1524}</td><td class="text-center">${grid.m.c2534}</td><td class="text-center">${grid.m.c3549}</td><td class="text-center">${grid.m.c50}</td><td class="text-center">${grid.f.c15}</td><td class="text-center">${grid.f.c1524}</td><td class="text-center">${grid.f.c2534}</td><td class="text-center">${grid.f.c3549}</td><td class="text-center">${grid.f.c50}</td><td class="text-center" style="color:var(--danger); font-weight:700;">${grid.f.mat}</td><td class="text-center">${grid.kap.msm}</td><td class="text-center">${grid.kap.tgw}</td><td class="text-center">${grid.kap.msw}</td><td class="text-center">${grid.kap.fsw}</td><td class="text-center">${grid.kap.pwid}</td><td class="text-center" style="font-weight:700; color:var(--text-main); background:var(--warning-bg);">${grid.kap.tb}</td><td class="text-center font-bold" style="background:var(--bg-subtle);">${grid.total}</td></tr>`; document.getElementById('hiv-test-body').innerHTML = buildRow(h.tested); document.getElementById('hiv-react-body').innerHTML = buildRow(h.reactive); }
function renderSTI(s) { const buildSTI = (name, d) => `<tr><td rowspan="3" style="font-weight:700; vertical-align:middle;">${name}</td><td>NON-REACTIVE</td><td class="text-center">${d.m - d.m_r}</td><td class="text-center">${d.f - d.f_r}</td><td class="text-center">${d.mat - d.mat_r}</td><td class="text-center">${d.total - d.react}</td></tr><tr style="color:var(--danger); font-weight:600;"><td>REACTIVE</td><td class="text-center">${d.m_r}</td><td class="text-center">${d.f_r}</td><td class="text-center">${d.mat_r}</td><td class="text-center">${d.react}</td></tr><tr style="background:var(--bg-subtle); font-weight:700;"><td>TOTAL</td><td class="text-center">${d.m}</td><td class="text-center">${d.f}</td><td class="text-center">${d.mat}</td><td class="text-center">${d.total}</td></tr>`; document.getElementById('sti-body').innerHTML = buildSTI("HIV", s.hiv) + buildSTI("SYPHILIS", s.syph) + buildSTI("HBsAg", s.hbsag); }
function renderDengue(d) { document.getElementById('dengue-body').innerHTML = `<tr><td>POSITIVE</td><td class="text-center" style="color:var(--danger); font-weight:700;">${d.pos}</td></tr><tr><td>NEGATIVE</td><td class="text-center">${d.neg}</td></tr><tr style="background:var(--bg-subtle); font-weight:700;"><td>TOTAL</td><td class="text-center">${d.total}</td></tr>`; }
function renderWorkload(w) { let html = ""; for (const [key, val] of Object.entries(w)) { html += `<tr><td style="text-align:left; text-transform:uppercase; font-weight:600;">${key.replace('Registry - ','')}</td><td class="text-center" style="font-weight:700;">${val}</td></tr>`; } document.getElementById('workload-body').innerHTML = html; }

function printReport() {
    let activeTab = ""; document.querySelectorAll('.tab-view').forEach(tab => { if (tab.style.display === 'block') activeTab = tab.outerHTML; });
    const headerHtml = `<table style="width: 100%; border-bottom: 2px solid #000; margin-bottom: 10px; padding-bottom: 5px;"><tr><td style="width: 70px; text-align: left; vertical-align: middle;"><img src="./icon-192.png" style="width: 50px; height: 50px;"></td><td style="text-align: center; vertical-align: middle;"><h1 style="font-size: 15px; margin: 2px 0; color: #00695C;">MUNICIPAL HEALTH OFFICE</h1><h3 style="font-size: 11px; margin: 2px 0; color: #555;">Republic of the Philippines<br>Province of Rizal | Municipality of Angono</h3><p style="font-size: 9px; margin: 2px 0; color: #555;">P. Tolentino St. Brgy. San Isidro, Angono, Rizal</p></td><td style="width: 70px; text-align: right; vertical-align: middle;"><img src="./icon-512.png" style="width: 50px; height: 50px;"></td></tr></table>`;
    const footerHtml = document.querySelector('.rep-footer').outerHTML;
    const htmlContent = `<html><head><title>Print Report</title><link rel="stylesheet" href="https://fonts.cdnfonts.com/css/sf-pro-display"><style>@page { size: A4 landscape; margin: 10mm; } body { font-family: 'SF Pro Display', sans-serif; padding: 0; color: #333; margin: 0; -webkit-print-color-adjust: exact; background: white;} table.main-layout { width: 100%; border-collapse: collapse; } .data-table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: auto; margin-top: 15px; } .data-table th, .data-table td { border: 1px solid #000; padding: 6px; text-align: left; word-wrap: break-word; } .data-table th { background-color: #f0f0f0 !important; } .text-center { text-align: center; } .rep-footer { display: flex; justify-content: space-between; font-size: 9px; border-top: 1px dashed #000; padding-top: 10px; margin-top: 20px; } .rep-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 15px; color: #00695C; } thead { display: table-header-group; } tfoot { display: table-footer-group; } .controls-area, .chip-group, button { display: none !important; }</style></head><body><table class="main-layout"><thead><tr><td>${headerHtml}</td></tr></thead><tbody><tr><td>${activeTab}</td></tr></tbody><tfoot><tr><td>${footerHtml}</td></tr></tfoot></table><script>window.onload = function() { setTimeout(function(){ window.print(); window.close(); }, 800); };</script></html>`;
    const win = window.open('', '_blank'); win.document.write(htmlContent); win.document.close();
}

async function downloadReport() { showAppAlert("PDF Download", "Wait for the preview to load, then click 'PRINT / SAVE AS PDF' and choose 'Save as PDF'.", "info"); printReport(); }

function showStaffRegister() {
    document.getElementById('login-card').style.display = 'none'; document.getElementById('staff-register-card').style.display = 'block';
    const sel = document.getElementById('reg_fac'); sel.innerHTML = '<option value="ALL">ALL / MAIN</option>';
    globalFacilityList.forEach(f => sel.innerHTML += `<option value="${f.name}">${f.name}</option>`);
}

function startAutoSync() {
    setInterval(async () => {
        if(typeof checkNewNotifs === 'function') checkNewNotifs();
        const pendingSection = document.getElementById('col-pending'); const isEditing = document.getElementById('col-entry') && document.getElementById('col-entry').classList.contains('edit-mode-pane');
        if (pendingSection && pendingSection.style.display !== 'none' && !isEditing) {
            try {
                let q = sb.from('lab_tests').select('*').in('status', ['PENDING', 'COMPLETED', 'FOR REPEAT']).order('date', { ascending: false }).limit(1000);
                if(currentUser.role !== 'ADMIN' && currentUser.role !== 'STAFF' && currentUser.facility !== 'ALL') q = q.eq('facility', currentUser.facility);
                const { data } = await q;
                if (data) {
                    window.pendingData = data.filter(d => d.status === 'PENDING').map(d => ({id: d.id, testCode: d.test_code || d.id, patientId: d.patient_id, name: d.patient_name, test: d.test_name, details: d.details, status: d.status, facility: d.facility, encoder: d.encoder, date: d.date}));
                    window.completedData = data.filter(d => d.status === 'COMPLETED' || d.status === 'FOR REPEAT').map(d => ({id: d.id, testCode: d.test_code || d.id, patientId: d.patient_id, name: d.patient_name, test: d.test_name, details: d.details, status: d.status, facility: d.facility, encoder: d.encoder, date: d.date}));
                    renderLists();
                }
            } catch (e) {}
        }
    }, 60000);
}

function backToLoginFromRegister() { document.getElementById('staff-register-card').style.display = 'none'; document.getElementById('login-card').style.display = 'block'; }

async function submitStaffRegister() {
    const name = document.getElementById('reg_name').value.trim(); const fac = document.getElementById('reg_fac').value; const role = document.getElementById('reg_role').value; const user = document.getElementById('reg_user').value.trim(); const pass1 = document.getElementById('reg_pass').value; const pass2 = document.getElementById('reg_pass2').value;
    if(!name || !role || !user || !pass1 || !pass2) return showAppAlert("Required", "Please fill all fields.", "error");
    if(pass1 !== pass2) { document.getElementById('reg_pass2').value = ''; return showAppAlert("Mismatch", "Passwords do not match! Please try again.", "error"); }
    const btn = document.querySelector('#staff-register-card .btn-primary'); const oldText = btn.innerHTML; btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Submitting...'; btn.disabled = true;
    try {
        const { error } = await sb.from('app_users').insert({ username: user, password: pass1, facility: fac, role: role, full_name: name, status: 'PENDING' });
        if(error) throw error;
        showAppAlert("Success", "Account requested successfully! Please wait for the Admin to approve your account before logging in.", "success");
        document.getElementById('reg_name').value = ''; document.getElementById('reg_user').value = ''; document.getElementById('reg_pass').value = ''; document.getElementById('reg_pass2').value = ''; document.getElementById('reg_role').value = ''; backToLoginFromRegister();
    } catch(e) { showAppAlert("Error", e.message || "Server error.", "error"); } finally { btn.innerHTML = oldText; btn.disabled = false; }
}

async function batchSaveResults(isPrint) {
    const checked = document.querySelectorAll('.chk-pending:checked');
    if(checked.length === 0) return showAppAlert("Required", "Select at least one record to batch process.", "error");
    const btnSave = document.querySelector('button[onclick="batchSaveResults(false)"]'); const btnPrint = document.querySelector('button[onclick="batchSaveResults(true)"]');
    if(btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...'; } if(btnPrint) { btnPrint.disabled = true; btnPrint.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...'; }
    let successCount = 0; let printRequests = [];
    for (let chk of checked) {
        const id = chk.value; const item = window.pendingData.find(d => String(d.id) === String(id).trim()); if(!item) continue;
        const safeId = String(item.id || "").replace(/[^a-zA-Z0-9]/g, ""); const inputs = document.querySelectorAll('.res-' + safeId);
        let newResults = {}; inputs.forEach(inp => { newResults[inp.getAttribute('data-key')] = inp.value; });
        let detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : (item.details || {}); let tCodePrint = getTestCodeFromName(item.test);
        if (tCodePrint === "GXP" && (!newResults["Remarks"] || newResults["Remarks"].trim() === "")) { if (detailsObj["X-Ray Result"]) { newResults["Remarks"] = "X-Ray: " + detailsObj["X-Ray Result"]; } }
        let finalStr = { ...detailsObj, ...newResults, "Performed By": currentUser.fullName || currentUser.username, date_examined: new Date().toISOString() };
        try { const { error } = await sb.from('lab_tests').update({ details: finalStr, status: 'COMPLETED' }).eq('id', id); if (!error) { successCount++; if (isPrint) printRequests.push({testCode: id, testName: tCodePrint}); } } catch(e) {}
    }
    await apiPost("logAudit", { username: currentUser.fullName || currentUser.username, action: "BATCH SAVE", details: `Batch processed ${successCount} records.` });
    showAppAlert("Batch Complete", `Successfully saved ${successCount} records.`, "success"); await loadPendingData();
    if (isPrint && printRequests.length > 0) {
        showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #64748b;"><i class="ph ph-spinner ph-spin"></i> Generating Batch Print...</h2>');
        try {
            const isNTP = printRequests[0].testName === "GXP" || printRequests[0].testName === "DSSM";
            let printContent = [];
            for(let r of printRequests) {
                const { data } = await sb.from('lab_tests').select('*').eq('id', r.testCode).maybeSingle();
                if(data) printContent.push(mapSupabaseToPrintObject(data));
            }
            let finalHtml = isNTP ? localGenerateNTPHtml(printContent) : localGenerateA5Html(printContent);
            showPrintModal(finalHtml);
        } catch(e) { showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Print Error. Please try again.</h2>'); }
    }
    if(btnSave) { btnSave.disabled = false; btnSave.innerHTML = '<i class="ph ph-floppy-disk"></i> Batch Save'; } if(btnPrint) { btnPrint.disabled = false; btnPrint.innerHTML = '<i class="ph ph-printer"></i> Save & Print'; }
}

function processNtpResultsClient(p) {
    p.gxpText = ""; p.gxpClass = ""; p.dssmText = ""; p.dssmClass = ""; p.smear1 = ""; p.smear2 = "";
    p.dateCollected = p.dateRequest || ""; p.dateDispatched = p.dateRequest || ""; p.dateSpecReceived = p.dateRequest || ""; p.dateExaminedStr = p.dateExamined || ""; p.dateReleasedStr = p.dateResult || ""; p.labSerialNumber = p.testCode || p.id;
    const tName = (p.testName || "").toUpperCase(); p.isDSSM = tName.includes("DSSM") || tName.includes("AFB"); p.isGXP = tName.includes("GXP") || tName.includes("GEN");
    const initialWarning = " (INITIAL RESULT ONLY. FOR REPEAT COLLECTION AND TESTING)"; const findRes = (key) => p.results?.find(r => r.param && r.param.toUpperCase() === key.toUpperCase())?.res || "";
    const cachedP = cachedPatients.find(cp => cp.id === p.id) || {}; p.address = (p.address && p.address !== "undefined") ? p.address : (cachedP.address || ""); p.contact = (p.contact && p.contact !== "undefined") ? p.contact : (cachedP.contact || "");
    p.history = findRes("History of Treatment"); let phys = findRes("Source of Request") || p.physician || ""; p.physician = (phys === "undefined") ? "" : phys; p.xray = findRes("X-Ray Result"); p.monthTreat = findRes("Month of Treatment"); p.reason = findRes("Reason for Examination") || "Diagnosis";
    if(p.results) { p.results.forEach(r => {
        const k = String(r.param).trim(); const v = String(r.res || "").trim(); const vUpper = v.toUpperCase();
        if (k === "ResultCode") {
            let gradeRaw = findRes("Grade"); let repeatTag = findRes("Repeat"); let grades = { 'VL': 'Very Low', 'L': 'Low', 'M': 'Medium', 'H': 'High' }; let fullGrade = grades[gradeRaw.toUpperCase()] || gradeRaw; let isInitial = repeatTag.toUpperCase().includes("INITIAL") || vUpper.includes("INITIAL");
            if (vUpper === "N") { p.gxpText = "MTB NOT DETECTED."; p.gxpClass = "res-n"; } else if (vUpper === "T") { p.gxpText = `MTB DETECTED ${fullGrade}; Rifampicin resistance NOT detected.`; p.gxpClass = "res-t"; } else if (vUpper.startsWith("TT")) { p.gxpText = `MTB TRACE DETECTED; Rifampicin resistance INDETERMINATE.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-tt"; } else if (vUpper.startsWith("TI")) { p.gxpText = `MTB DETECTED; Rifampicin resistance INDETERMINATE.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-ti"; } else if (vUpper.startsWith("RR")) { p.gxpText = `MTB DETECTED ${fullGrade}; Rifampicin resistance DETECTED.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-rr"; } else if (vUpper === "I" || vUpper.includes("ERR") || vUpper.includes("INV")) { p.gxpText = `INVALID / ERROR.${isInitial ? initialWarning : ""}`; p.gxpClass = "res-i"; }
        }
        if (k === "Smear1") { let countVal = findRes("Smear1_Count"); if (countVal !== "" && !countVal.includes("#")) p.smear1 = "+" + countVal; else p.smear1 = v; } if (k === "Smear2") { let countVal = findRes("Smear2_Count"); if (countVal !== "" && !countVal.includes("#")) p.smear2 = "+" + countVal; else p.smear2 = v; } if (k === "Diagnosis") { p.dssmText = v; p.dssmClass = vUpper.includes("POS") ? "res-rr" : "res-n"; }
    });}
}

function mapSupabaseToPrintObject(d) {
    let detailsObj = typeof d.details === 'string' ? JSON.parse(d.details) : (d.details || {});
    let resultsArr = []; for (let key in detailsObj) { resultsArr.push({ param: key, res: detailsObj[key] }); }
    return {
        id: d.patient_id || d.patientId, name: d.patient_name || d.name || detailsObj.name || "", age: detailsObj.age || detailsObj.Age || "", sex: detailsObj.sex || detailsObj.Sex || "",
        facility: detailsObj.facility || detailsObj.Facility || d.facility || "", address: detailsObj.address || detailsObj.Address || "", contact: detailsObj.contact || detailsObj.Contact || "",
        dateRequest: d.date ? new Date(d.date).toLocaleDateString() : TODAY_STR, 
        dateExamined: detailsObj.date_examined || detailsObj.dateEncoded ? new Date(detailsObj.date_examined || detailsObj.dateEncoded).toLocaleDateString() : TODAY_STR, 
        dateResult: new Date().toLocaleDateString(), 
        testCode: d.test_code || d.id, testName: d.test_name || d.test, encoder: d.encoder || "System", verifier: "", results: resultsArr
    };
}

async function printDirect(e, id, testName) { 
    if(e) e.stopPropagation(); 
    const correctCode = getTestCodeFromName(testName); 
    showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #64748b;"><i class="ph ph-spinner ph-spin"></i> Generating Document...</h2>');
    
    let item = window.completedData.find(d => String(d.id) === String(id).trim()) || window.pendingData.find(d => String(d.id) === String(id).trim());
    try {
        if (!item) { 
            const { data, error } = await sb.from('lab_tests').select('*').eq('id', id).maybeSingle(); 
            if(data) item = { id: data.id, testCode: data.test_code || data.id, patientId: data.patient_id, name: data.patient_name, test: data.test_name, details: data.details, status: data.status, facility: data.facility, encoder: data.encoder, date: data.date }; 
        }
        if (item) {
            if (!globalStaffList || globalStaffList.length === 0) await loadSettingsData();
            let pObj = mapSupabaseToPrintObject(item);
            const isNTP = correctCode === "GXP" || correctCode === "DSSM"; 
            let finalHtml = isNTP ? localGenerateNTPHtml([pObj]) : localGenerateA5Html([pObj]);
            
            await apiPost("logAudit", { username: currentUser.fullName || currentUser.username, action: "PRINT", details: `Printed result for Test ID: ${id}` });
            showPrintModal(finalHtml);
        } else {
            showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Document not found. Test Code: ' + id + '</h2>'); 
        }
    } catch (err) { showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Print Error. Please try again.</h2>'); }
}

async function batchPrint() {
    const checked = document.querySelectorAll('.chk-reg:checked'); if (checked.length === 0) { showAppAlert("Required", "Select at least one record.", "error"); return; }
    let requests = []; checked.forEach(chk => { const rowData = JSON.parse(decodeURIComponent(chk.value)); const codeCol = window.CURRENT_REGISTRY_HEADERS.findIndex(h => h.toUpperCase().includes('TEST CODE') || h.toUpperCase() === 'ID'); requests.push({ testCode: rowData[codeCol] || rowData[0], testName: window.CURRENT_TEST_TYPE }); });
    showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #64748b;"><i class="ph ph-spinner ph-spin"></i> Generating Batch Print...</h2>');
    try {
        if (!globalStaffList || globalStaffList.length === 0) await loadSettingsData(); 
        const isNTP = window.CURRENT_TEST_TYPE === "GXP" || window.CURRENT_TEST_TYPE === "DSSM"; let printContent = [];
        for(let r of requests) { 
            const { data } = await sb.from('lab_tests').select('*').eq('id', r.testCode).maybeSingle(); 
            if(data) printContent.push(mapSupabaseToPrintObject(data)); 
        }
        
        await apiPost("logAudit", { username: currentUser.fullName || currentUser.username, action: "BATCH PRINT", details: `Batch printed ${requests.length} records.` });
        let finalHtml = isNTP ? localGenerateNTPHtml(printContent) : localGenerateA5Html(printContent); showPrintModal(finalHtml);
    } catch (err) { showPrintModal('<h2 style="font-family:\'Poppins\', sans-serif; text-align:center; margin-top:50px; color: #ef4444;">Print Error. Please try again.</h2>'); }
}

function localGenerateNTPHtml(patientsArray) {
    const logos = { left: "./icon-512.png", lab: "./icon-192.png", right: "./icon-512.png" };
    const getStaff = (name) => { if(!name) return { name: "", role: "Medical Technologist", license: "", sigUrl: "" }; const nLower = String(name).trim().toLowerCase(); const words = nLower.replace(/\./g, '').split(/\s+/); const found = (globalStaffList || []).find(s => { const sLower = s.name.toLowerCase(); if (sLower === nLower) return true; if (words.length > 1 && sLower.includes(words[0]) && sLower.includes(words[words.length-1])) return true; return sLower.includes(nLower) || nLower.includes(sLower); }); return found || { name: name, role: "Medical Technologist", license: "", sigUrl: "" }; };
    let combinedHtml = "";
    patientsArray.forEach((p, index) => {
        processNtpResultsClient(p); const cachedP = cachedPatients.find(cp => cp.id === p.id) || {}; p.address = (p.address && p.address !== "undefined") ? p.address : (cachedP.address || ""); p.contact = (p.contact && p.contact !== "undefined") ? p.contact : (cachedP.contact || ""); let phys = p.physician || ""; p.physician = (phys === "undefined") ? "" : phys; let performer = getStaff(p.encoder);
        const pageHtml = `<div class="page-container"><div class="header"><img src="${logos.left}" class="logo-side" onerror="this.style.display='none'"><div class="header-center"><img src="${logos.lab}" class="logo-lab" onerror="this.style.display='none'"><h3 style="font-size:8px; margin:0;">REPUBLIC OF THE PHILIPPINES</h3><h3 style="font-size:8px; margin:0;">PROVINCE OF RIZAL</h3><h2 style="font-size:10px; margin:1px 0;">Municipality of ANGONO</h2><h1 style="font-size:14px; margin:1px 0;">Municipal Health Office</h1><p style="font-size:8px; margin:0;">P. Tolentino St. Brgy. San Isidro, Angono, Rizal</p></div><img src="${logos.right}" class="logo-side" onerror="this.style.display='none'"></div><div class="form-title">FORM 2A. LABORATORY REQUEST AND RESULT FORM</div><div class="content-spacer"></div><div class="section-bar">To be filled out by the requesting facility health care worker</div><table class="main-table"><tr><td width="60%">Name of Requesting Facility/Unit: <span class="line" style="width:200px;">${p.facility}</span></td><td width="40%">Date of Request: <span class="line" style="width:140px;">${p.dateRequest}</span></td></tr><tr><td>Facility Contact Information: <span class="line" style="width:220px;">&nbsp;</span></td><td>Requesting Physician: <span class="line" style="width:150px;">${p.physician}</span></td></tr><tr><td colspan="2"><div style="display:flex; justify-content:space-between;"><span>Patient's Full Name: <span class="line" style="width:300px; text-transform:uppercase;">${p.name}</span></span><span>Age: <span class="line" style="width:30px; text-align:center;">${p.age}</span></span><span>Sex: <span class="line" style="width:50px; text-align:center;">${p.sex}</span></span></div></td></tr><tr><td colspan="2"><div style="display:flex; justify-content:space-between;"><span>Address: <span class="line" style="width:420px; font-size:9px;">${p.address}</span></span><span>Patient's Contact No.: <span class="line" style="width:120px;">${p.contact}</span></span></div></td></tr><tr><td colspan="2" style="padding-top: 8px;"><div style="display:flex; align-items:flex-start;"><strong style="width:130px;">Reason for Examination:</strong><div style="display:flex; gap:15px;"><span class="chk-item"><input type="checkbox" ${(!p.isDSSM && p.reason == 'Diagnosis') ? 'checked' : ''}> Diagnosis</span><span class="chk-item"><input type="checkbox" ${(!p.isDSSM && p.reason == 'Baseline') ? 'checked' : ''}> Baseline</span><span class="chk-item"><input type="checkbox" ${(p.isDSSM || p.reason == 'Follow-up') ? 'checked' : ''}> Follow-up</span></div><span style="margin-left:auto;">TB Case No.: <span class="line" style="width:70px;">${p.tbCase || ''}</span></span></div></td></tr><tr><td colspan="2"><div style="display:flex; align-items:center;"><strong style="width:130px;">History of Treatment:</strong><div style="display:flex; gap:15px;"><span class="chk-item"><input type="checkbox" ${(!p.isDSSM && String(p.history).toUpperCase() == 'NEW') ? 'checked' : ''}> New</span><span class="chk-item"><input type="checkbox" ${(!p.isDSSM && String(p.history).toUpperCase() != 'NEW') ? 'checked' : ''}> Retreatment</span></div><span style="margin-left:auto;">Month of Treatment: <span class="line" style="width:70px;">${p.monthTreat || ''}</span></span></div></td></tr><tr><td colspan="2" style="padding-top: 8px;"><div style="display:flex; align-items:flex-start;"><strong style="width:130px;">Test Requested:</strong><table style="width:100%; border:none; margin:0;"><tr><td style="border:none; padding:0; vertical-align:top; width:50%;"><div class="chk-item"><input type="checkbox" ${(p.isGXP && !p.testName.includes("XDR")) ? 'checked' : ''}> Xpert MTB/RIF Ultra</div><br><div class="chk-item"><input type="checkbox" ${(p.testName.includes("XDR")) ? 'checked' : ''}> Xpert MTB/XDR</div><br><div class="chk-item"><input type="checkbox"> Line Probe Assay</div></td><td style="border:none; padding:0; vertical-align:top; width:50%;"><div style="display: flex; justify-content: space-between;"><div><div class="chk-item"><input type="checkbox"> TB LAMP</div><br><div class="chk-item"><input type="checkbox"> Truenat MTB-RIF</div><br><div class="chk-item"><input type="checkbox" ${(p.isDSSM) ? 'checked' : ''}> Smear Microscopy</div></div><div><div class="chk-item"><input type="checkbox"> TB Culture</div><br><div class="chk-item"><input type="checkbox"> Phenotypic DST</div></div></div></td></tr></table></div></td></tr><tr><td colspan="2" class="pad-top-lg">Type of Specimen: <span class="line" style="width:200px; text-align:center;">Sputum</span></td></tr></table><table class="res-table-inner" style="margin-bottom:5px;"><tr style="background:#ccc;"><th width="20%">Specimen</th><th width="40%">Date Collected</th><th width="40%">Date Dispatched to Laboratory</th></tr><tr><td>1</td><td>${p.dateCollected}</td><td>${p.dateCollected}</td></tr><tr><td>2</td><td></td><td></td></tr></table><div style="margin-bottom:15px;"><strong>Remarks:</strong><div style="border-bottom:1px solid #000; width:100%; height:18px; line-height:18px; font-weight:bold; font-size:9px; text-align:center;">${p.remarks}</div><div style="text-align:center; font-size:8px; font-style:italic;">(i.e. precollection details, existing medical conditions, medications...)</div></div><div style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 5px;"><div style="display:flex; justify-content:space-between; align-items:flex-end;"><div style="width: 50%;"><strong>Prepared By:</strong><span class="line" style="width:200px; text-align:center; text-transform:uppercase;">${p.encoder}</span></div><div style="width: 50%;"><strong>Designation:</strong><span class="line" style="width:200px;">&nbsp;</span></div></div><div style="font-size:8px; margin-left:100px;">Signature over Printed Name</div></div><div class="section-bar">To be filled out by the receiving Medical Technologist/Microscopist/Xpert Technician</div><table class="main-table"><tr><td width="60%" style="padding: 8px;">Name of Laboratory: <strong>ANGONO RTDL</strong></td><td width="40%" style="padding: 8px;"><div style="display:flex; justify-content:space-between;"><span>Date Specimen Received:</span><strong>${p.dateCollected}</strong></div></td></tr><tr><td colspan="2"><div style="display:flex; gap:10px; align-items: center; padding: 5px 0;"><span>Specimen Volume and Quality: <span class="line" style="width:150px;">${p.appearance || ''}</span></span><span class="chk-item"><input type="checkbox" checked> Accepted</span><span class="chk-item"><input type="checkbox"> Rejected, reason: <span class="line" style="width:100px;"></span></span></div></td></tr><tr><td colspan="2" style="padding-top:10px; padding-bottom:5px;"><div style="display:flex; justify-content:space-between;"><div>Laboratory Serial Number: <span class="line" style="width:180px; font-weight:bold;">${p.labSerialNumber}</span></div><div>Date Specimen Examined: <strong>${p.dateResult || p.dateExaminedStr || ''}</strong></div></div></td></tr></table><table class="res-table-inner"><tr style="background:#d9d9d9;"><th width="40%">DIAGNOSTIC TESTS</th><th width="60%">RESULTS</th></tr><tr><td style="text-align:left; padding-left:20px; height:50px; vertical-align:middle; width:40%;">Xpert MTB/RIF Ultra</td><td class="${p.gxpClass}" style="font-weight:bold; font-size:9.5pt; vertical-align:middle; text-align:center; padding: 8px; line-height: 1.3;">${p.gxpText}</td></tr><tr><td style="padding:0; vertical-align:middle;"><div style="padding:10px;">Smear Microscopy</div></td><td style="padding:0;"><table style="width:100%; border:none; margin:0;" cellspacing="0"><tr><td rowspan="2" style="border:none; border-right:1px solid #000; border-bottom:1px solid #000; width:25%; vertical-align:middle;">Reading</td><td style="border:none; border-right:1px solid #000; border-bottom:1px solid #000; width:37.5%;">1</td><td style="border:none; border-bottom:1px solid #000; width:37.5%;">2</td></tr><tr><td class="smear-reading-box" style="border:none; border-right:1px solid #000; border-bottom:1px solid #000;">${p.smear1}</td><td class="smear-reading-box" style="border:none; border-bottom:1px solid #000;">${p.smear2}</td></tr><tr><td style="border:none; border-right:1px solid #000; font-size:8.5pt; vertical-align:middle;">Laboratory Diagnosis</td><td class="${p.dssmClass} diagnosis-text-large" colspan="2" style="border:none;">${p.dssmText}</td></tr></table></td></tr></table><div class="content-spacer"></div><div class="footer-section"><div class="sig-container"><div class="sig-block" style="text-align:left;"><div class="sig-label">Performed By:</div><div class="sig-visual-area" style="justify-content: flex-start;">${performer.sigUrl ? `<img src="${performer.sigUrl}" class="esig-img" style="left:0; transform:none;">` : ""}<div class="sig-name" style="text-align:left;">${p.encoder}</div></div><div class="sig-info" style="text-align:left;">${performer.role}<br>Lic No. ${performer.license || "__________"}</div></div><div class="sig-block" style="text-align:right;"><div class="sig-label" style="text-align:right;">Noted By:</div><div class="sig-visual-area" style="justify-content: flex-end;"><div class="sig-name" style="text-align:right;">RODOLFO S. NARCISO JR. MD</div></div><div class="sig-info" style="font-weight:bold; text-transform:uppercase; text-align:right;">Municipal Health Officer</div></div></div><div style="margin-top:8px; font-size:8px;">Date and Time Released: <span class="line" style="width:200px;">${new Date().toLocaleString()}</span></div><div style="padding-top:2px; border-top:1px solid #ddd; text-align:center; margin-top:5px;"><div style="font-size:4px; color:#555; font-style:italic;">This report is system generated by the Angono MHO Laboratory Information System.<br>Please note that these results are confidential and intended only for the use of the individual or entity to whom they are addressed.<br>Any alteration to this document renders it invalid.</div></div><div class="footer-red">"Angono Dream, Artist Paradise, Keep Moving"</div></div></div>`;
        const breakTag = (index < patientsArray.length - 1) ? '<div class="page-break"></div>' : ''; combinedHtml += pageHtml + breakTag;
    });

    return `<!DOCTYPE html><html><head><title>NTP Form 2A Batch</title><style>@page { size: portrait; margin: 5mm; } body { font-family: 'Inter', Arial, sans-serif; font-size: 9pt; margin: 0; padding: 0; -webkit-print-color-adjust: exact; background: #e2e8f0; display: flex; flex-direction: column; align-items: center; padding-top: 70px; } body, table, td, th, .line, div, span { font-size: 9pt !important; font-family: 'Inter', Arial, sans-serif !important; } .smear-reading-box { height: 25px !important; vertical-align: middle !important; font-weight: bold !important; font-size: 10pt !important; text-align: center !important; } .diagnosis-text-large { height: 25px !important; vertical-align: middle !important; font-weight: bold !important; font-size: 10pt !important; text-transform: uppercase; text-align: center !important; } .page-container { width: 100%; max-width: 210mm; height: auto; min-height: 275mm; padding: 10mm; box-sizing: border-box; background: white; display: flex; flex-direction: column; overflow: hidden; position: relative; margin-bottom: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); margin-left: auto; margin-right: auto; } .header { background: linear-gradient(to bottom, #ff0000 0%, #ffb6c1 100%); border: 2px solid #000; padding: 10px 5px; height: auto; min-height: 90px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; } .logo-side { width: 80px; height: 80px; background: #fff; border-radius: 50%; object-fit: contain; } .logo-lab { width: 35px; height: 35px; background: #fff; border-radius: 50%; border: 1px solid #ddd; margin-bottom: 2px; } .header-center { flex-grow: 1; text-align: center; } .header h1 { font-size: 15pt; margin: 0; } .header h2 { font-size: 11pt; margin: 0; } .header h3 { font-size: 9pt; margin: 0; } .header p { font-size: 8px; margin: 2px 0 0 0; font-weight: bold; color: #000; } .form-title { text-align: center; font-weight: bold; font-size: 11px; margin: 8px 0 4px 0; } .main-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 2px; } .main-table td { padding: 3px 5px; border: 1px solid #000; } .line { border-bottom: 1px solid #000; display: inline-block; padding-left: 5px; font-weight: bold; min-height: 13px; } .chk-item { display: inline-flex; align-items: center; gap: 3px; margin-right: 10px; font-size: 9px; } input[type="checkbox"] { margin: 0; width: 11px; height: 11px; } .res-table-inner { width: 100%; border-collapse: collapse; } .res-table-inner th, .res-table-inner td { border: 1px solid #000; text-align: center; padding: 4px; font-size: 9px; } .section-bar { background: #d9d9d9; font-size: 9px; text-align: center; border: 1px solid #000; padding: 3px; font-weight: bold; } .res-n { background-color: #C8E6C9 !important; color: #1B5E20 !important; } .res-t { background-color: #FFCDD2 !important; color: #B71C1C !important; } .res-rr { background-color: #B71C1C !important; color: white !important; } .res-ti { background-color: #FFE0B2 !important; color: #E65100 !important; } .res-tt { background-color: #FFF9C4 !important; color: #827717 !important; } .res-i { background-color: #000000 !important; color: white !important; } .res-init { background-color: #EEEEEE !important; color: #757575 !important; } .footer-section { width: 100%; margin-top: auto; padding-bottom: 5px; flex-shrink: 0; } .content-spacer { flex-grow: 1; } .sig-container { display: flex; justify-content: space-between; margin-top: 5px; } .sig-block { width: 32%; text-align: center; display: flex; flex-direction: column; min-height: 90px; } .sig-label { font-size: 9px; margin-bottom: 2px; text-align: left; } .sig-visual-area { position: relative; width: 100%; height: 40px; display: flex; align-items: flex-end; } .esig-img { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); height: 50px; mix-blend-mode: multiply; } .sig-name { font-weight: bold; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #000; width: 100%; padding-top: 5px; } .sig-info { font-size: 8px; margin-top: 3px; line-height: 1.2; } .footer-red { background: #ff0000; color: white; font-weight: bold; text-align: center; padding: 5px; font-size: 13px; margin-top: 5px; border: 1px solid #000; } .no-print { position: fixed; top: 0; left: 0; width: 100%; background: #1e293b; padding: 12px; text-align: center; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); } .no-print button { padding: 10px 20px; margin: 0 5px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-family: sans-serif; font-size: 14px; } .btn-print { background: #10b981; color: white; } .btn-close { background: #ef4444; color: white; } .preview-text { color: white; font-family: sans-serif; font-size: 14px; margin-right: 20px; font-weight: normal; } @media print { .no-print { display: none !important; } body { background: white; padding-top: 0 !important; display: block; margin: 0; } @page { size: auto; margin: 5mm; } .page-container { width: 200mm !important; min-height: 275mm !important; margin: 0 auto !important; padding: 10mm !important; border: none !important; box-shadow: none !important; overflow: hidden !important; page-break-after: always; page-break-inside: avoid; zoom: 0.96 !important; } .page-break { display: none !important; } } @media print and (max-width: 160mm) { .page-container { zoom: 0.65 !important; } } </style></head><body><div class="no-print"><span class="preview-text">⏳ PREVIEW: Wait for logos to load before printing</span><button class="btn-print" onclick="window.print()">🖨️ PRINT / SAVE AS PDF</button><button class="btn-close" onclick="window.close()">❌ CLOSE</button></div>${combinedHtml}</body></html>`;
}

function localGenerateA5Html(patientsArray) {
    const logos = { left: "./icon-512.png", lab: "./icon-192.png", right: "./icon-512.png" };
    let combinedHtml = "";
    
    const getUnit = (pName) => { const n = String(pName).toUpperCase(); if (n.includes("HEMOGLOBIN")) return "g/L"; if (n.includes("HEMATOCRIT")) return "L/L"; if (n.includes("WBC") || n.includes("PLATELET")) return "x10⁹/L"; if (n.includes("RBC")) return "x10¹²/L"; if (n.includes("NEUTROPHIL") || n.includes("LYMPHOCYTE") || n.includes("MONOCYTE") || n.includes("EOSINOPHIL") || n.includes("BASOPHIL")) return "Frac"; if (n.includes("HBA1C")) return "%"; if (n.includes("GLUCOSE") || n.includes("FBS") || n.includes("RBS") || n.includes("OG")) return "mmol/L"; if (n.includes("CHOLESTEROL") || n.includes("TRIG") || n.includes("HDL") || n.includes("LDL")) return "mmol/L"; if (n.includes("URIC") || n.includes("BUA")) return "mmol/L"; if (n.includes("BUN") || n.includes("UREA")) return "mmol/L"; if (n.includes("CREATININE")) return "µmol/L"; if (n.includes("SGPT") || n.includes("ALT")) return "U/L"; if (n.includes("SGOT") || n.includes("AST")) return "U/L"; return ""; };
    const getNormal = (pName) => { const n = String(pName).toUpperCase(); if (n.includes("HEMOGLOBIN")) return "M:140-170 F:120-150"; if (n.includes("HEMATOCRIT")) return "M:0.40-0.54 F:0.37-0.47"; if (n.includes("WBC")) return "4.5 - 11.0"; if (n.includes("RBC")) return "4.0 - 6.0"; if (n.includes("PLATELET")) return "150 - 450"; if (n.includes("NEUTROPHIL")) return "0.50 - 0.70"; if (n.includes("LYMPHOCYTE")) return "0.20 - 0.40"; if (n.includes("MONOCYTE")) return "0.02 - 0.08"; if (n.includes("EOSINOPHIL")) return "0.01 - 0.04"; if (n.includes("BASOPHIL")) return "0.00 - 0.01"; if (n.includes("HBA1C")) return "4.0 - 6.0"; if (n.includes("RBS")) return "< 7.8"; if (n.includes("OG0") || n.includes("FASTING")) return "< 5.1"; if (n.includes("OG1") || n.includes("1 HR")) return "< 10.0"; if (n.includes("OG2") || n.includes("2 HR")) return "< 8.5"; if (n.includes("GLUCOSE") || n.includes("FBS")) return "3.89 - 6.11"; if (n.includes("CHOLESTEROL")) return "< 5.17"; if (n.includes("TRIGLYCERIDE")) return "< 2.2"; if (n.includes("HDL")) return "> 0.9"; if (n.includes("LDL")) return "< 3.3"; if (n.includes("CREATININE")) return "M:62-106 F:44-80"; if (n.includes("URIC") || n.includes("BUA")) return "M:0.21-0.42 F:0.16-0.36"; if (n.includes("BUN")) return "2.5 - 7.1"; if (n.includes("SGPT") || n.includes("ALT")) return "M:<41 F:<31"; if (n.includes("SGOT") || n.includes("AST")) return "M:<40 F:<32"; return ""; };

    const getStaff = (name) => { if(!name) return { name: "", role: "Medical Technologist", license: "", sigUrl: "" }; const nLower = String(name).trim().toLowerCase(); const words = nLower.replace(/\./g, '').split(/\s+/); const found = (globalStaffList || []).find(s => { const sLower = s.name.toLowerCase(); if (sLower === nLower) return true; if (words.length > 1 && sLower.includes(words[0]) && sLower.includes(words[words.length-1])) return true; return sLower.includes(nLower) || nLower.includes(sLower); }); return found || { name: name, role: "Medical Technologist", license: "", sigUrl: "" }; };

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
        
        const cachedP = cachedPatients.find(cp => cp.id === p.id) || {};
        p.address = (p.address && p.address !== "undefined") ? p.address : (cachedP.address || "");
        p.contact = (p.contact && p.contact !== "undefined") ? p.contact : (cachedP.contact || "");

        if (!p.remarks && p.results) { let remarkObj = p.results.find(r => r.param === "Remarks" || r.param === "REMARKS"); if (remarkObj) { p.remarks = remarkObj.res; } }
        if (p.results) { p.results = p.results.filter(r => { const P = String(r.param).toUpperCase(); if (P === "REMARKS" || P.includes("REMARK")) return false; if (P.includes("REQUEST")) return false; if (isSero && (P.includes("KAP") || P.includes("CLASSIFICATION"))) return false; if (isUrine && (P.includes("KETONES") || P.includes("BLOOD") || P.includes("BILIRUBIN") || P.includes("NITRITE"))) return false; return true; }); }

        let mainContent = "";
        
        if (isViral) { let choiceObj = p.results.find(r => r.param.toUpperCase().includes("CHOIC") || r.param.toUpperCase().includes("RESULT")); let numObj = p.results.find(r => r.param.toUpperCase().includes("NUMB") || r.param.toUpperCase().includes("COPIES")); let resultVal = choiceObj ? choiceObj.res : "N/A"; let copiesVal = numObj ? numObj.res : ""; let logVal = "N/A"; let cleanNum = String(copiesVal).replace(/[^0-9.]/g, ''); if (cleanNum && !isNaN(cleanNum)) { logVal = Math.log10(parseFloat(cleanNum)).toFixed(2); } else if (String(copiesVal).includes("<")) { logVal = "< 1.60"; } mainContent = `<div style="width:90%; margin-top:10px; border:2px solid #000; padding:15px;"><div style="font-weight:bold; font-size:12px; text-decoration:underline; margin-bottom:15px; text-align:center;">HIV-1 VIRAL LOAD QUANTIFICATION</div><table style="width:100%; border:none;"><tr><td style="border:none; width:40%; font-weight:bold; font-size:11px;">HIV-1 QUALITATIVE RESULT:</td><td style="border-bottom:1px solid #000; font-weight:bold; font-size:12px; text-align:center;">${resultVal}</td></tr><tr><td colspan="2" style="border:none; height:10px;"></td></tr><tr><td style="border:none; width:40%; font-weight:bold; font-size:11px;">RESULT (Copies/mL):</td><td style="border-bottom:1px solid #000; font-weight:bold; font-size:12px; text-align:center;">${copiesVal || "N/A"}</td></tr><tr><td colspan="2" style="border:none; height:10px;"></td></tr><tr><td style="border:none; width:40%; font-weight:bold; font-size:11px;">LOG VALUE (log10):</td><td style="border-bottom:1px solid #000; font-weight:bold; font-size:12px; text-align:center;">${logVal}</td></tr></table><div style="font-size:8px; font-style:italic; margin-top:15px; text-align:center;">Test Method: Real-Time PCR (GeneXpert). Linear Range: 40 to 10,000,000 copies/mL.</div></div>`; }
        else if (isGram) { const findRes = (keyPart) => { let found = p.results.find(r => r.param.toUpperCase().includes(keyPart)); return (found && found.res && found.res.trim() !== "") ? found.res : "NONE SEEN"; }; let posQuant = findRes("GP_QUANT"); let posMorph = findRes("GP_MORPH"); let posArr = findRes("GP_ARRANG"); let negQuant = findRes("GN_QUANT"); let negMorph = findRes("GN_MORPH"); let negArr = findRes("GN_ARRANG"); mainContent = `<table class="res-table" style="width: 100%; margin-top: 10px;"><thead><tr><th width="20%">TEST</th><th width="20%">QUANTITY</th><th width="30%">MORPHOLOGY</th><th width="30%">ARRANGEMENT</th></tr></thead><tbody><tr><td style="font-weight:bold; padding:8px;">Gram Positive</td><td style="text-align:center;">${posQuant}</td><td style="text-align:center;">${posMorph}</td><td style="text-align:center;">${posArr}</td></tr><tr><td style="font-weight:bold; padding:8px;">Gram Negative</td><td style="text-align:center;">${negQuant}</td><td style="text-align:center;">${negMorph}</td><td style="text-align:center;">${negArr}</td></tr></tbody></table>`; }
        else if (isDengue) { 
            let resObj = p.results.find(r => r.param.toUpperCase() === "DENGUE_RESULT" || r.param.toUpperCase().includes("ANTIGEN")); let resVal = resObj ? resObj.res : ""; let igg = p.results.find(r => r.param.toUpperCase().includes("IGG")); let igm = p.results.find(r => r.param.toUpperCase().includes("IGM")); let color = (String(resVal).toUpperCase().includes("POS") || String(resVal).toUpperCase().includes("REACTIVE")) ? "red" : "black"; 
            let rows = `<tr><td style="padding:15px; font-weight:bold; font-size:12px;">DENGUE NS1 ANTIGEN</td><td style="padding:15px; text-align:center; font-weight:bold; font-size:14px; color:${color};">${resVal}</td></tr>`;
            if (igg && igg.res) { let iggColor = String(igg.res).toUpperCase().includes("POS") ? "red" : "black"; rows += `<tr><td style="padding:15px; font-weight:bold; font-size:12px;">DENGUE IgG</td><td style="padding:15px; text-align:center; font-weight:bold; font-size:14px; color:${iggColor};">${igg.res}</td></tr>`; }
            if (igm && igm.res) { let igmColor = String(igm.res).toUpperCase().includes("POS") ? "red" : "black"; rows += `<tr><td style="padding:15px; font-weight:bold; font-size:12px;">DENGUE IgM</td><td style="padding:15px; text-align:center; font-weight:bold; font-size:14px; color:${igmColor};">${igm.res}</td></tr>`; }
            mainContent = `<div style="flex-grow:1; display:flex; align-items:center; justify-content:center; width:100%;"><table class="res-table" style="width: 90%; margin-top: 10px;"><thead><tr><th width="50%" style="padding:10px; font-size:11px;">TEST</th><th width="50%" style="padding:10px; font-size:11px;">RESULT</th></tr></thead><tbody>${rows}</tbody></table></div>`; 
        }
        else if (isSero) {
            let hivRes = p.results.find(r => r.param.toUpperCase().includes("HIV"))?.res; let syphRes = p.results.find(r => r.param.toUpperCase().includes("SYPHILIS"))?.res; let hbsagRes = p.results.find(r => r.param.toUpperCase().includes("HBSAG"))?.res; let rowsHtml = "";
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
        
        @media print { 
            .no-print { display: none !important; } 
            body { background: white; padding-top: 0 !important; display: block; margin: 0; } 
            @page { size: 210mm 148mm; margin: 0; } 
            .page-container { width: 210mm !important; max-width: 210mm !important; height: 148mm !important; max-height: 148mm !important; margin: 0 auto !important; padding: 4mm 10mm !important; border: none !important; box-shadow: none !important; zoom: 1.05 !important; overflow: visible !important; page-break-after: always; page-break-inside: avoid; } 
            .page-break { display: none !important; } 
        }
    </style>
    </head><body>
    <div class="no-print">
        <span class="preview-text">⏳ PREVIEW: Wait for logos to load before printing or saving</span>
        <button class="btn-print" onclick="window.print()">🖨️ PRINT / SAVE AS PDF</button>
        <button class="btn-close" onclick="window.close()">❌ CLOSE</button>
    </div>
    ${combinedHtml}</body></html>`;
}

function showPrintModal(htmlContent) {
    let modal = document.getElementById('print-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'print-modal-overlay';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background-color:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center;';
        const iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.cssText = 'width:90%; max-width:1100px; height:90%; max-height:850px; border:none; border-radius:12px; background-color:#e2e8f0;';
        modal.appendChild(iframe);
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    const iframe = document.getElementById('print-iframe');
    iframe.srcdoc = htmlContent;
}

window.closePrintModal = function() {
    const modal = document.getElementById('print-modal-overlay');
    if (modal) modal.style.display = 'none';
};
