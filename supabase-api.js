// ============================================================
// SUPABASE DROP-IN REPLACEMENT PARA SA apiGet / apiPost
// ============================================================
// Layunin: kapareho pa rin ng signature ang apiGet(action, params) at
// apiPost(action, payload) — kaya hindi na kailangang baguhin ang
// natitirang bahagi ng app.js. Dito na lang papasok ang mga tawag
// papunta sa Supabase sa halip na sa Google Apps Script.
//
// REQUIREMENTS: window.sb (Supabase client) dapat naka-set up na sa
// index.html BAGO ma-load ang file na ito.
// ============================================================

async function apiGet(action, params = {}) {
    try {
        switch (action) {

            case "loginUser": {
                const { data, error } = await sb.from('app_users')
                    .select('*')
                    .eq('username', params.username)
                    .eq('password', params.password)
                    .maybeSingle();
                if (error) throw error;
                if (!data) return { status: "FAIL" };
                if (data.status === "PENDING") return { status: "PENDING" };
                if (data.status !== "ACTIVE") return { status: "FAIL" };
                return { status: "SUCCESS", username: data.username, facility: data.facility, role: data.role, fullName: data.full_name };
            }

            case "patientLogin": {
                const { data, error } = await sb.from('patients')
                    .select('*')
                    .eq('email', params.email)
                    .eq('password', params.password)
                    .maybeSingle();
                if (error) throw error;
                if (!data) return { status: "FAIL" };
                return { status: "SUCCESS", patientId: data.id, name: data.full_name };
            }

            case "getAllPatientsLight": {
                const { data, error } = await sb.from('patients')
                    .select('id, full_name, age, sex, facility, address, contact, email, bday');
                if (error) throw error;
                return {
                    status: "success",
                    data: (data || []).map(p => ({
                        id: p.id, name: p.full_name, age: p.age, sex: p.sex,
                        facility: p.facility, address: p.address, contact: p.contact,
                        email: p.email, bday: p.bday
                    }))
                };
            }

            case "getPatientHistory": {
                const { data, error } = await sb.from('lab_tests')
                    .select('*')
                    .eq('patient_id', params.patientId)
                    .order('date', { ascending: false });
                if (error) throw error;

                let rows = data || [];
                // Itago ang Viral Load sa non-ADMIN, gaya ng dati
                if (String(params.role).toUpperCase() !== 'ADMIN') {
                    rows = rows.filter(r => !String(r.test_name).toUpperCase().includes('VIRAL'));
                }

                return {
                    status: "success",
                    data: rows.map(r => ({
                        date: r.date,
                        test: r.test_name,
                        result: summarizeResult(r.details),
                        fullData: { ...r.details, "Test Code": r.id }
                    }))
                };
            }

            case "getPendingWorkload": {
                let pendingQ = sb.from('lab_tests').select('*').in('status', ['PENDING', 'FOR REPEAT']);
                if (params.facility && params.facility !== 'ALL') pendingQ = pendingQ.eq('facility', params.facility);
                const { data: pending, error: e1 } = await pendingQ.order('date', { ascending: false });
                if (e1) throw e1;

                let compQ = sb.from('lab_tests').select('*').eq('status', 'COMPLETED');
                if (params.facility && params.facility !== 'ALL') compQ = compQ.eq('facility', params.facility);
                const { data: completed, error: e2 } = await compQ.order('date_encoded', { ascending: false }).limit(500);
                if (e2) throw e2;

                return {
                    pending: (pending || []).map(toFrontendRow),
                    encoded: (completed || []).map(toFrontendRow)
                };
            }

            case "getRegistryDataOptimized": {
                const page = parseInt(params.page) || 1;
                const limit = parseInt(params.limit) || 20;
                const from = (page - 1) * limit;
                const to = from + limit - 1;

                let q = sb.from('lab_tests').select('*', { count: 'exact' }).eq('test_code', params.type);
                if (params.facility && params.facility !== 'ALL') q = q.eq('facility', params.facility);
                if (params.searchQuery) q = q.ilike('patient_name', `%${params.searchQuery}%`);
                if (params.monthFilter) {
                    // Filter by month regardless of year gamit ang extract()
                    q = q.filter('date', 'not.is', null);
                }

                const { data, error, count } = await q.order('date', { ascending: false }).range(from, to);
                if (error) throw error;

                let rows = data || [];
                if (params.monthFilter) {
                    rows = rows.filter(r => (new Date(r.date).getMonth() + 1) === parseInt(params.monthFilter));
                }

                const headers = buildHeadersForType(params.type);
                const tableRows = rows.map(r => headers.map(h => extractField(r, h)));

                return {
                    status: "success",
                    data: {
                        headers,
                        rows: tableRows,
                        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
                        currentPage: page,
                        totalRows: count || 0,
                        title: `${params.type} REGISTRY`
                    }
                };
            }

            case "getFacilityList": {
                const { data, error } = await sb.from('facilities').select('name');
                if (error) throw error;
                return { status: "success", data: data || [] };
            }

            case "getSettingsData": {
                // Ginawang GET dito kahit apiPost ang tawag sa app.js (parehong
                // pupunta sa switch sa ibaba — tingnan ang apiPost function)
                return await getSettingsDataImpl();
            }

            default:
                console.warn("⚠️ Walang Supabase handler para sa GET action:", action);
                return { status: "error", message: "Not implemented: " + action };
        }
    } catch (err) {
        console.error("apiGet error (" + action + "):", err);
        return { status: "error", message: String(err.message || err) };
    }
}

async function apiPost(action, payload) {
    try {
        switch (action) {

            case "submitForm": {
                const f = payload.formObject;
                const tests = JSON.parse(f.testsData || "[]");

                let patientId = f.patientId;
                if (!patientId) patientId = "MHOA-" + Date.now();

                const { error: pErr } = await sb.from('patients').upsert({
                    id: patientId,
                    full_name: f.fullName,
                    bday: f.bday || null,
                    sex: f.sex,
                    age: f.age,
                    address: f.address,
                    contact: f.contact,
                    email: f.email || null,
                    password: f.patientPassword || null,
                    facility: f.facility
                }, { onConflict: 'id' });
                if (pErr) throw pErr;

                const rows = tests.map(t => ({
                    id: `${patientId}-${t.code}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    patient_id: patientId,
                    patient_name: f.fullName,
                    test_name: t.name,
                    test_code: t.code,
                    details: t.details || {},
                    status: 'PENDING',
                    facility: f.facility,
                    encoder: f.encoder,
                    encoder_full_name: f.encoderFullName,
                    date: new Date().toISOString()
                }));
                const { error: tErr } = await sb.from('lab_tests').insert(rows);
                if (tErr) throw tErr;

                return { status: "success", data: { email: f.email, generatedPassword: f.patientPassword, log: "Naisave sa Supabase." } };
            }

            case "saveLabResult": {
                const details = JSON.parse(payload.jsonDetails || "{}");
                const { error } = await sb.from('lab_tests').update({
                    details,
                    status: 'COMPLETED',
                    date_encoded: new Date().toISOString(),
                    encoder: payload.encodedBy,
                    patient_name: payload.updatedName,
                    test_name: payload.updatedTest
                }).eq('id', payload.testId);
                if (error) throw error;
                return { status: "success" };
            }

            case "deletePendingTestById": {
                const { error } = await sb.from('lab_tests').delete().eq('id', payload.testId);
                if (error) throw error;
                return { status: "success" };
            }

            case "updatePatientAndTestDetails": {
                const details = JSON.parse(payload.newJsonDetails || "{}");
                const { error: e1 } = await sb.from('lab_tests').update({
                    details, patient_name: payload.newName, test_name: payload.newTestType
                }).eq('id', payload.testId);
                if (e1) throw e1;

                const { error: e2 } = await sb.from('patients').update({
                    full_name: payload.newName,
                    age: details.age, sex: details.sex, address: details.address,
                    contact: details.contact, facility: details.facility,
                    email: details.email || null, bday: details.bday || null
                }).eq('id', payload.patientId);
                if (e2) throw e2;

                return { status: "success", data: "Updated (walang na-send na email — kailangan ng Supabase Edge Function para dito)." };
            }

            case "editRegistryRecord": {
                const { data: row, error: e0 } = await sb.from('lab_tests').select('details')
                    .eq('patient_id', payload.patientId).eq('test_name', payload.testType).maybeSingle();
                if (e0) throw e0;
                const merged = { ...(row?.details || {}), ...payload.updates };
                const { error } = await sb.from('lab_tests').update({ details: merged })
                    .eq('patient_id', payload.patientId).eq('test_name', payload.testType);
                if (error) throw error;
                return { status: "success" };
            }

            case "getSettingsData":
                return await getSettingsDataImpl();

            case "saveStaffData": {
                await sb.from('staff').delete().not('id', 'is', null); // clear all, re-insert
                const rows = (payload.staffArray || []).map(s => ({ name: s.name, role: s.role, license: s.license, sig_url: s.sigUrl }));
                if (rows.length) {
                    const { error } = await sb.from('staff').insert(rows);
                    if (error) throw error;
                }
                return { status: "success" };
            }

            case "saveNewUser": {
                const d = payload.data;
                const { error } = await sb.from('app_users').insert({
                    username: d.username, password: d.password, full_name: d.fullName,
                    role: d.role, facility: d.facility, status: 'ACTIVE'
                });
                if (error) throw error;
                return { status: "success" };
            }

            case "registerUser": {
                const d = payload.data;
                const { error } = await sb.from('app_users').insert({
                    username: d.u, password: d.p, full_name: d.name,
                    role: d.role, facility: d.fac, status: 'PENDING'
                });
                if (error) throw error;
                return { status: "success" };
            }

            case "updateUserFull": {
                const d = payload.updatedData;
                const updateObj = {
                    username: d.u, full_name: d.name, role: d.role, facility: d.fac, status: d.status
                };
                if (d.p) updateObj.password = d.p;
                const { error } = await sb.from('app_users').update(updateObj).eq('username', payload.oldUsername);
                if (error) throw error;
                return { status: "success" };
            }

            case "deleteUser": {
                const { error } = await sb.from('app_users').delete().eq('username', payload.targetUsername);
                if (error) throw error;
                return { status: "success" };
            }

            case "approveUser": {
                const status = payload.userAction === 'APPROVE' ? 'ACTIVE' : 'REJECTED';
                const { error } = await sb.from('app_users').update({ status }).eq('username', payload.targetUsername);
                if (error) throw error;
                return { status: "success" };
            }

            case "printFromRegistry":
            case "resendPatientPassword":
                // Kailangan ng email service (Resend/SendGrid) via Supabase Edge
                // Function, o panatilihin muna ang lumang Apps Script endpoint
                // para sa email lang habang inaayos ito.
                return { status: "error", message: action + " ay hindi pa suportado sa Supabase migration na ito." };

            default:
                console.warn("⚠️ Walang Supabase handler para sa POST action:", action);
                return { status: "error", message: "Not implemented: " + action };
        }
    } catch (err) {
        console.error("apiPost error (" + action + "):", err);
        return { status: "error", message: String(err.message || err) };
    }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getSettingsDataImpl() {
    const [{ data: staff }, { data: facilities }, { data: users }] = await Promise.all([
        sb.from('staff').select('*'),
        sb.from('facilities').select('*'),
        sb.from('app_users').select('*')
    ]);
    return {
        status: "success",
        data: {
            staff: (staff || []).map(s => ({ name: s.name, role: s.role, license: s.license, sigUrl: s.sig_url })),
            facilities: (facilities || []).map(f => ({ name: f.name, address: f.address, person: f.contact_person, number: f.contact_number })),
            users: (users || []).map(u => ({ username: u.username, fullname: u.full_name, role: u.role, facility: u.facility, status: u.status }))
        }
    };
}

function toFrontendRow(r) {
    return {
        id: r.id, patientId: r.patient_id, name: r.patient_name, test: r.test_name,
        date: r.date, details: r.details, encoder: r.encoder, status: r.status, facility: r.facility
    };
}

function summarizeResult(details) {
    if (!details) return "";
    return details.ResultCode || details.Diagnosis || details.VL_Choice || details.Dengue_Result || "Pending";
}

// 🔴 I-ADJUST MO ITO kung gusto mo ng eksaktong kaparehong column order
// ng dating Google Sheets registry tabs mo (per test type).
function buildHeadersForType(type) {
    const common = ["Date", "Patient ID", "Name", "Age", "Sex"];
    const perType = {
        GXP: ["History of Treatment", "Source of Request", "X-Ray Result", "Appearance", "Grade", "ResultCode", "Repeat", "Performed By"],
        DSSM: ["TB Case Number", "Month of Treatment", "Smear1", "Smear2", "Diagnosis", "Performed By"],
        GXVL: ["VL_Choice", "VL_Number", "Performed By"],
        SERO: ["HIV", "HBSAG", "SYPHILIS", "Classification", "KAP Category", "Performed By"],
        HEMA: ["Hemoglobin", "Hematocrit", "WBC_Count", "RBC_Count", "Platelet", "Performed By"],
        CHEM: ["FBS", "RBS", "Cholesterol", "Triglycerides", "HDL", "LDL", "Performed By"],
        UA: ["Color", "Transparency", "pH", "SG", "Protein", "Glucose", "Performed By"],
        FA: ["Color", "Consistency", "parasite", "Performed By"],
        DENGUE: ["Dengue_Result", "Dengue_IgG", "Dengue_IgM", "Performed By"],
        GRAM: ["GP_Quantity", "GP_Morphology", "GN_Quantity", "GN_Morphology", "Performed By"]
    };
    return [...common, ...(perType[type] || [])];
}

function extractField(row, header) {
    switch (header) {
        case "Date": return new Date(row.date).toLocaleDateString();
        case "Patient ID": return row.patient_id;
        case "Name": return row.patient_name;
        case "Test Code": return row.id;
        case "Performed By": return row.encoder;
        default: return (row.details && row.details[header] !== undefined) ? row.details[header] : "";
    }
}
