import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const workspaceArea = document.getElementById('workspace-area');
const pendingArea = document.getElementById('pending-area');
const docName = document.getElementById('doc-name');
const docInitials = document.getElementById('doc-initials');
const docStatus = document.getElementById('doc-status');
const btnLogout = document.getElementById('btn-logout');
const prevDocName = document.getElementById('prev-doc-name');

// Today's date for prescription
const todayStr = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric'});
document.getElementById('prev-date').innerText = todayStr;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        
        // Prevent admin from viewing doctor panel
        if(userData.role === 'admin') {
          window.location.href = '/admin/';
          return;
        }

        // Setup Header
        docName.innerText = "Dr. " + userData.name;
        prevDocName.innerText = "Dr. " + userData.name;
        docInitials.innerText = userData.name.substring(0, 2).toUpperCase();
        
        // Handle Access based on status
        if (userData.status === 'approved') {
          docStatus.className = 'badge badge-safe';
          docStatus.innerText = 'Online / Approved';
          workspaceArea.style.display = 'grid'; // because it uses CSS grid
          pendingArea.style.display = 'none';

          // Setup clinic settings payload
          setupClinicProfile(userData);

          // Tell prescription builder to initialize
          window.dispatchEvent(new CustomEvent('doc-ready', { detail: { uid: user.uid } }));
        } else {
          docStatus.className = 'badge badge-warning';
          docStatus.innerText = 'Pending Approval';
          workspaceArea.style.display = 'none';
          pendingArea.style.display = 'block';
        }
      }
    } catch (e) {
      console.error(e);
      window.location.href = '/';
    }
  } else {
    // Not logged in
    window.location.href = '/';
  }
});

btnLogout.addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = '/';
  });
});

// Tab Switching Navigation
const navWorkspace = document.getElementById('nav-workspace');
const navPatients = document.getElementById('nav-patients');
const navHistory = document.getElementById('nav-history');

const navSettings = document.getElementById('nav-settings');

const patientsArea = document.getElementById('patients-area');
const historyArea = document.getElementById('history-area');
const settingsArea = document.getElementById('settings-area');

function switchTab(activeNav, activeArea) {
  // Only allow switching if approved (pending area is not showing)
  if(pendingArea.style.display === 'block') return;
  
  // Reset Navs
  [navWorkspace, navPatients, navHistory, navSettings].forEach(el => el.classList.remove('active'));
  activeNav.classList.add('active');

  // Hide all areas
  workspaceArea.style.display = 'none';
  patientsArea.style.display = 'none';
  historyArea.style.display = 'none';
  settingsArea.style.display = 'none';

  // Show active area
  activeArea.style.display = activeArea === workspaceArea ? 'grid' : 'block';
}

navWorkspace.addEventListener('click', (e) => { e.preventDefault(); switchTab(navWorkspace, workspaceArea); });
navPatients.addEventListener('click', (e) => { e.preventDefault(); switchTab(navPatients, patientsArea); });
navHistory.addEventListener('click', (e) => { e.preventDefault(); switchTab(navHistory, historyArea); });
navSettings.addEventListener('click', (e) => { e.preventDefault(); switchTab(navSettings, settingsArea); });

// ==============================
// Data Loading Logic for Tabs
// ==============================
let currentDocUid = null;
window.addEventListener('doc-ready', (e) => {
  currentDocUid = e.detail.uid;
  loadPatients();
  loadHistory();
});

window.addEventListener('refresh-patients', loadPatients);
window.addEventListener('refresh-history', loadHistory);

async function loadPatients() {
  if (!currentDocUid) return;
  const tbody = document.getElementById('patients-tbody');
  try {
    const q = query(collection(db, "patients"), where("doctorId", "==", currentDocUid));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No patients found. Search or add a new patient in the workspace.</td></tr>';
      return;
    }
    
    let html = '';
    snap.forEach(doc => {
      const p = doc.data();
      html += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.age} / ${p.gender}</td>
          <td>${p.phone || 'N/A'}</td>
          <td>${p.conditions || 'None'}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="window.loadPatientToWorkspace('${doc.id}', '${p.name.replace(/'/g, "\\'")}', '${p.age}', '${p.gender}', '${p.phone}', '${p.conditions}')">Prescribe</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color:red;">Error loading patients.</td></tr>';
  }
}

async function loadHistory() {
  if (!currentDocUid) return;
  const tbody = document.getElementById('history-tbody');
  try {
    const q = query(collection(db, "prescriptions"), where("doctorId", "==", currentDocUid));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No history found. Try finalizing a prescription.</td></tr>';
      return;
    }
    
    // Sort by date descending locally since we didn't setup a composite index in Firestore
    const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
    docs.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    docs.forEach(rx => {
      const dateStr = new Date(rx.date).toLocaleDateString();
      const medsStr = rx.medicines.map(m => m.name).join(', ');
      
      html += `
        <tr>
          <td>${dateStr}</td>
          <td><strong>${rx.patientName}</strong> <br> <small class="text-muted">${rx.patientPhone}</small></td>
          <td>${medsStr}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="alert('Reuse feature coming soon!')">View / Reuse</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color:red;">Error loading history.</td></tr>';
  }
}

// Global hook to jump from Patient CRM Tab to Workspace
window.loadPatientToWorkspace = function(id, name, age, gender, phone, conditions) {
  // Switch tab natively
  navWorkspace.click();
  // Trigger prescription.js export hook (Since selectPatient is exported in prescription.js, we can't easily call it directly here without importing, 
  // but we can cheat by doing a small custom event)
  const p = { id, name, age, gender, phone, conditions };
  window.dispatchEvent(new CustomEvent('load-patient', { detail: p }));
};

// ==============================
// Profile & Settings Logic
// ==============================

function setupClinicProfile(userData) {
  // Fallbacks if not set
  const cName = userData.clinicName || 'AUOOSHADH CLINIC';
  const cAddress = userData.clinicAddress || '123 Medical Park, Health City';
  const cPhone = userData.clinicPhone || 'Phone: ---';
  
  // 1. Update Live Preview
  document.getElementById('prev-clinic-name').innerText = cName;
  document.getElementById('prev-clinic-address').innerText = cAddress;
  document.getElementById('prev-clinic-phone').innerText = cPhone;
  
  if (userData.signatureBase64) {
    document.getElementById('prev-signature-img').src = userData.signatureBase64;
    document.getElementById('prev-signature-img').style.display = 'block';
    document.getElementById('prev-signature-line').style.display = 'none'; // hide the standard line
    
    // Also show it in the settings preview
    document.getElementById('set-signature-preview').src = userData.signatureBase64;
    document.getElementById('set-signature-preview').style.display = 'block';
    document.getElementById('set-signature-placeholder').style.display = 'none';
  }

  // 2. Pre-fill Settings Form
  document.getElementById('set-clinic-name').value = userData.clinicName || '';
  document.getElementById('set-clinic-address').value = userData.clinicAddress || '';
  document.getElementById('set-clinic-phone').value = userData.clinicPhone || '';
}

// Handle Image File -> Base64
let tempBase64Signature = null;

document.getElementById('set-signature-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    tempBase64Signature = event.target.result;
    document.getElementById('set-signature-preview').src = tempBase64Signature;
    document.getElementById('set-signature-preview').style.display = 'block';
    document.getElementById('set-signature-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

// Save Settings Button
document.getElementById('btn-save-settings').addEventListener('click', async (e) => {
  if (!currentDocUid) return;
  
  const btn = e.target;
  const originalText = btn.innerText;
  btn.innerText = "Saving...";
  btn.disabled = true;
  
  try {
    const payload = {
      clinicName: document.getElementById('set-clinic-name').value.trim(),
      clinicAddress: document.getElementById('set-clinic-address').value.trim(),
      clinicPhone: document.getElementById('set-clinic-phone').value.trim()
    };
    
    if (tempBase64Signature) {
      payload.signatureBase64 = tempBase64Signature;
    }
    
    await updateDoc(doc(db, "users", currentDocUid), payload);
    
    // Immediately reflect changes in preview
    setupClinicProfile(payload);
    
    alert("Profile Settings Updated successfully!");
  } catch (err) {
    console.error("Error saving profile", err);
    alert("Failed to save profile: " + err.message);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
});
