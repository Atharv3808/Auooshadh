import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { debounce, evaluatePrescriptionSafety, printPrescription, shareViaWhatsApp } from './utils.js';

// Application State
export let currentPatient = null;
export let currentMedicines = [];
export let currentDocId = null;
let doctorPatients = []; // Cached CRM data

// DOM Elements
const patSearch = document.getElementById('patient-search');
const patDropdown = document.getElementById('patient-dropdown');
const patSnapshot = document.getElementById('patient-snapshot');
const manualPat = document.getElementById('manual-patient');
const btnSetPatient = document.getElementById('btn-set-patient');
const btnShowAddPatient = document.getElementById('btn-show-add-patient');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const searchPatWrapper = document.getElementById('search-pat-wrapper');
const newPatPhone = document.getElementById('new-pat-phone');
const newPatConditions = document.getElementById('new-pat-conditions');

const medSearch = document.getElementById('medicine-search');
const medDropdown = document.getElementById('medicine-dropdown');
const rxTbody = document.getElementById('rx-tbody');
const smartAlert = document.getElementById('smart-alert');
const alertText = document.getElementById('alert-text');

const prevPatName = document.getElementById('prev-pat-name');
const prevPatAge = document.getElementById('prev-pat-age');
const prevPatGender = document.getElementById('prev-pat-gender');
const prevMedicinesList = document.getElementById('prev-medicines-list');

// Init from doctor.js
window.addEventListener('doc-ready', async (e) => {
  currentDocId = e.detail.uid;
  loadDraft();
  await fetchDoctorPatients();
});

window.addEventListener('load-patient', (e) => {
  selectPatient(e.detail);
});

// Fetch all patients for this doctor to enable local fast searching
async function fetchDoctorPatients() {
  if (!currentDocId) return;
  const q = query(collection(db, "patients"), where("doctorId", "==", currentDocId));
  const snap = await getDocs(q);
  doctorPatients = snap.docs.map(d => ({id: d.id, ...d.data()}));
}

// Mock Medicines for MVP (Since there is no public API integrated for medicines yet)
const mockMedicines = [
  { id: 'm1', name: 'Paracetamol', defaultDosage: '500mg', defaultFreq: '1-1-1', defaultDuration: '3 days' },
  { id: 'm2', name: 'Ibuprofen', defaultDosage: '400mg', defaultFreq: '1-0-1', defaultDuration: '3 days' },
  { id: 'm3', name: 'Amoxicillin', defaultDosage: '500mg', defaultFreq: '1-0-1', defaultDuration: '5 days' },
  { id: 'm4', name: 'Propranolol', defaultDosage: '40mg', defaultFreq: '1-0-0', defaultDuration: '30 days' },
  { id: 'm5', name: 'Metformin', defaultDosage: '500mg', defaultFreq: '1-0-1', defaultDuration: '30 days' }
];

// Patient Search
patSearch.addEventListener('input', debounce((e) => {
  const queryText = e.target.value.toLowerCase();
  patDropdown.innerHTML = '';
  
  if (queryText.length < 2) {
    patDropdown.classList.remove('active');
    patSnapshot.style.display = 'none';
    searchPatWrapper.style.display = 'flex';
    manualPat.style.display = 'none';
    currentPatient = null;
    updatePreview();
    return;
  }

  const results = doctorPatients.filter(p => 
    p.name.toLowerCase().includes(queryText) || 
    (p.phone && p.phone.includes(queryText))
  );
  
  if (results.length > 0) {
    results.forEach(pat => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerText = `${pat.name} - ${pat.phone || 'No phone'}`;
      div.onclick = () => selectPatient(pat);
      patDropdown.appendChild(div);
    });
    patDropdown.classList.add('active');
  } else {
    patDropdown.innerHTML = '<div class="search-item" style="color:var(--text-muted); cursor:default;">No patient found. Click + New Patient</div>';
    patDropdown.classList.add('active');
  }
}, 300));

btnShowAddPatient.addEventListener('click', () => {
  searchPatWrapper.style.display = 'none';
  patSnapshot.style.display = 'none';
  manualPat.style.display = 'block';
  patDropdown.classList.remove('active');
  document.getElementById('new-pat-name').value = patSearch.value; // pre-fill
});

btnCancelAdd.addEventListener('click', () => {
  manualPat.style.display = 'none';
  searchPatWrapper.style.display = 'flex';
});

export function selectPatient(pat) {
  currentPatient = pat;
  patSearch.value = pat.name;
  patDropdown.classList.remove('active');
  
  document.getElementById('snap-name').innerText = pat.name;
  document.getElementById('snap-age-gender').innerText = `${pat.age} yrs / ${pat.gender}`;
  document.getElementById('snap-phone').innerText = pat.phone || 'N/A';
  document.getElementById('snap-conditions').innerText = pat.conditions || 'None';
  patSnapshot.style.display = 'block';
  searchPatWrapper.style.display = 'flex';
  manualPat.style.display = 'none';
  
  updatePreview();
  validateAlerts();
}

btnSetPatient.addEventListener('click', async () => {
  const name = document.getElementById('new-pat-name').value;
  const age = document.getElementById('new-pat-age').value;
  const gender = document.getElementById('new-pat-gender').value;
  const phone = newPatPhone.value || 'N/A';
  const conditions = newPatConditions.value || 'None';
  
  if(name && age) {
    const btn = btnSetPatient;
    btn.innerText = '...';
    btn.disabled = true;
    
    // Save to Firestore permanently
    try {
      const newPat = { name, age, gender, phone, conditions, doctorId: currentDocId };
      const docRef = await addDoc(collection(db, "patients"), newPat);
      newPat.id = docRef.id;
      doctorPatients.push(newPat); // Cache update
      selectPatient(newPat);
      
      // Dispatch event to refresh the Patients Tab
      window.dispatchEvent(new Event('refresh-patients'));
    } catch (e) {
      alert("Error adding patient: " + e.message);
    } finally {
      btn.innerText = 'Save to Database';
      btn.disabled = false;
    }
  }
});

// Medicine Search (Retains MVP static list behavior)
medSearch.addEventListener('input', debounce((e) => {
  const queryText = e.target.value.toLowerCase();
  medDropdown.innerHTML = '';
  if (queryText.length < 2) { medDropdown.classList.remove('active'); return; }

  const results = mockMedicines.filter(m => m.name.toLowerCase().includes(queryText));
  if (results.length > 0) {
    results.forEach(med => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerText = `${med.name} (${med.defaultDosage})`;
      div.onclick = () => addMedicine(med);
      medDropdown.appendChild(div);
    });
  } else {
    const div = document.createElement('div');
    div.className = 'search-item';
    div.innerHTML = `<em>Add "${e.target.value}" manually</em>`;
    div.onclick = () => { addMedicine({ id: 'custom_' + Date.now(), name: e.target.value, defaultDosage: '', defaultFreq: '', defaultDuration: '' }); };
    medDropdown.appendChild(div);
  }
  medDropdown.classList.add('active');
}, 300));

function addMedicine(med) {
  medSearch.value = '';
  medDropdown.classList.remove('active');
  currentMedicines.push({ id: med.id + '_' + Date.now(), name: med.name, dosage: med.defaultDosage, frequency: med.defaultFreq, duration: med.defaultDuration });
  renderMedicineTable();
  updatePreview();
  validateAlerts();
  saveDraft();
}

function removeMedicine(id) {
  currentMedicines = currentMedicines.filter(m => m.id !== id);
  renderMedicineTable();
  updatePreview();
  validateAlerts();
  saveDraft();
}

function renderMedicineTable() {
  rxTbody.innerHTML = '';
  currentMedicines.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${m.name}</strong></td>
      <td><input class="inline-edit" type="text" value="${m.dosage}" data-id="${m.id}" data-field="dosage" placeholder="e.g. 500mg"></td>
      <td><input class="inline-edit" type="text" value="${m.frequency}" data-id="${m.id}" data-field="frequency" placeholder="e.g. 1-0-1"></td>
      <td><input class="inline-edit" type="text" value="${m.duration}" data-id="${m.id}" data-field="duration" placeholder="e.g. 3 days"></td>
      <td><button class="btn btn-sm" style="color: var(--status-critical); padding: 0.25rem 0.5rem;" onclick="window.removeMed('${m.id}')">Remove</button></td>
    `;
    rxTbody.appendChild(tr);
  });
  document.querySelectorAll('.inline-edit').forEach(input => {
    input.addEventListener('change', (e) => {
      const med = currentMedicines.find(x => x.id === e.target.getAttribute('data-id'));
      med[e.target.getAttribute('data-field')] = e.target.value;
      updatePreview();
      validateAlerts();
      saveDraft();
    });
  });
}
window.removeMed = removeMedicine;

function updatePreview() {
  if (currentPatient) {
    prevPatName.innerText = currentPatient.name;
    prevPatAge.innerText = currentPatient.age;
    prevPatGender.innerText = currentPatient.gender;
  } else {
    prevPatName.innerText = '__________'; prevPatAge.innerText = '__'; prevPatGender.innerText = '_';
  }
  if (currentMedicines.length === 0) {
    prevMedicinesList.innerHTML = `<p style="color: var(--text-muted); font-style: italic; font-size: 0.875rem;">Add medicines to see preview...</p>`;
  } else {
    prevMedicinesList.innerHTML = '';
    currentMedicines.forEach(m => {
      const div = document.createElement('div'); div.className = 'preview-medicine-item';
      div.innerHTML = `<div class="preview-medicine-name">${m.name} ${m.dosage ? `(${m.dosage})` : ''}</div><div class="preview-medicine-instructions">Take ${m.frequency || '___'} for ${m.duration || '___'}</div>`;
      prevMedicinesList.appendChild(div);
    });
  }
}

function validateAlerts() {
  if (!currentPatient || currentMedicines.length === 0) { smartAlert.style.display = 'none'; return; }
  const { alertLevel, message } = evaluatePrescriptionSafety(currentMedicines, currentPatient.conditions || '');
  if (alertLevel !== 'safe') {
    smartAlert.style.display = 'block'; alertText.innerText = message;
    smartAlert.style.backgroundColor = alertLevel === 'critical' ? 'var(--status-critical-bg)' : 'var(--status-warning-bg)';
    smartAlert.style.borderColor = alertLevel === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)';
    alertText.style.color = alertLevel === 'critical' ? 'var(--status-critical)' : 'var(--status-warning)';
  } else { smartAlert.style.display = 'none'; }
}

function saveDraft() { localStorage.setItem('rx_draft', JSON.stringify({ patient: currentPatient, medicines: currentMedicines })); }
function loadDraft() {
  const dStr = localStorage.getItem('rx_draft');
  if (dStr) {
    const d = JSON.parse(dStr);
    if (d.patient) selectPatient(d.patient);
    if (d.medicines) { currentMedicines = d.medicines; renderMedicineTable(); updatePreview(); validateAlerts(); }
  }
}

document.getElementById('btn-clear-rx').addEventListener('click', () => {
  currentPatient = null; currentMedicines = []; patSearch.value = ''; patSnapshot.style.display = 'none';
  localStorage.removeItem('rx_draft'); renderMedicineTable(); updatePreview(); validateAlerts();
});

document.getElementById('btn-print').addEventListener('click', () => { if(currentMedicines.length > 0) printPrescription(); });
document.getElementById('btn-share-wa').addEventListener('click', () => {
  if (currentPatient && currentMedicines.length > 0) shareViaWhatsApp(currentPatient.phone, currentPatient.name, currentMedicines);
  else alert("Please select a patient and add medicines first.");
});

// Finalize & Save logic
document.getElementById('btn-finalize')?.addEventListener('click', async (e) => {
  if (!currentPatient || currentMedicines.length === 0) {
    alert("Please select a patient and add at least one medicine to finalize.");
    return;
  }
  
  const btn = e.target;
  const originalText = btn.innerText;
  btn.innerText = "Saving...";
  btn.disabled = true;

  try {
    const rxRef = await addDoc(collection(db, "prescriptions"), {
      doctorId: currentDocId,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      patientPhone: currentPatient.phone || '',
      medicines: currentMedicines,
      date: new Date().toISOString()
    });
    
    alert("Prescription saved securely to History!");
    window.dispatchEvent(new Event('refresh-history'));
    
  } catch(err) {
    alert("Error saving prescription: " + err.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
});
