import { auth, db, firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const doctorsTbody = document.getElementById('doctors-tbody');
const statDocs = document.getElementById('stat-doctors');
const statPending = document.getElementById('stat-pending');

// Auth Guard
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().role === 'admin') {
        loadDoctors();
        loadDashboardAnalytics();
      } else {
        window.location.href = '/';
      }
    } catch(e) {
      window.location.href = '/';
    }
  } else {
    window.location.href = '/';
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = '/';
  });
});

// Tab Switching
const navDash = document.getElementById('nav-dash');
const navDoctors = document.getElementById('nav-doctors');
const areaDash = document.getElementById('area-dash');
const areaDoctors = document.getElementById('area-doctors');

function switchAdminTab(activeNav, activeArea) {
  [navDash, navDoctors].forEach(el => { if(el) el.classList.remove('active'); });
  if(activeNav) activeNav.classList.add('active');

  areaDash.style.display = 'none';
  areaDoctors.style.display = 'none';
  if(activeArea) activeArea.style.display = 'block';
}

if(navDash) navDash.addEventListener('click', (e) => { e.preventDefault(); switchAdminTab(navDash, areaDash); });
if(navDoctors) navDoctors.addEventListener('click', (e) => { e.preventDefault(); switchAdminTab(navDoctors, areaDoctors); });

async function loadDoctors() {
  try {
    const q = query(collection(db, "users"), where("role", "==", "doctor"));
    const querySnapshot = await getDocs(q);
    
    let docsHtml = '';
    let total = 0;
    let pending = 0;

    querySnapshot.forEach((d) => {
      total++;
      const data = d.data();
      const isPending = data.status === 'pending';
      if (isPending) pending++;
      
      docsHtml += `
        <tr>
          <td><strong>Dr. ${data.name}</strong></td>
          <td>${data.email}</td>
          <td>${data.license}</td>
          <td>
            <span class="badge ${isPending ? 'badge-warning' : 'badge-safe'}">
              ${isPending ? 'Pending' : 'Approved'}
            </span>
          </td>
          <td>
            ${isPending 
              ? `<button class="btn btn-primary btn-sm" onclick="window.approveDoc('${d.id}')">Approve</button>`
              : `<button class="btn btn-outline btn-sm" onclick="window.revokeDoc('${d.id}')">Revoke</button>`
            }
          </td>
        </tr>
      `;
    });

    statDocs.innerText = total;
    statPending.innerText = pending;
    doctorsTbody.innerHTML = docsHtml || '<tr><td colspan="5" style="text-align:center;">No doctors found.</td></tr>';

  } catch (error) {
    console.error("Error loading doctors:", error);
    doctorsTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading data. See console.</td></tr>';
  }
}

// Expose actions to global scope for inline handlers
window.approveDoc = async function(id) {
  try {
    await updateDoc(doc(db, "users", id), { status: "approved" });
    loadDoctors();
  } catch (e) { alert("Error updating doctor: " + e.message); }
}

window.revokeDoc = async function(id) {
  try {
    if(confirm('Are you sure you want to revoke access?')) {
      await updateDoc(doc(db, "users", id), { status: "pending" });
      loadDoctors();
    }
  } catch (e) { alert("Error updating doctor: " + e.message); }
}

// Provision New Doctor Logic (Secondary App Workaround)
const btnCreateDoctor = document.getElementById('btn-create-doctor');
if (btnCreateDoctor) {
  btnCreateDoctor.addEventListener('click', async () => {
    const name = document.getElementById('new-doc-name').value.trim();
    const email = document.getElementById('new-doc-email').value.trim();
    const license = document.getElementById('new-doc-lic').value.trim();
    const password = document.getElementById('new-doc-pass').value.trim();

    if(!name || !email || !license || !password) {
      alert("Please fill all fields.");
      return;
    }

    const originalText = btnCreateDoctor.innerText;
    btnCreateDoctor.innerText = "Provisioning...";
    btnCreateDoctor.disabled = true;

    try {
      // 1. Initialize Secondary Auth Session
      const secondaryApp = initializeApp(firebaseConfig, "Secondary" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Create User using Secondary Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = userCredential.user.uid;

      // 3. Document provisioning using Primary DB (Admin privileges)
      await setDoc(doc(db, "users", newUid), {
        name: name,
        email: email,
        license: license,
        role: "doctor",
        status: "approved", // Automatically approved
        createdAt: new Date().toISOString()
      });

      // 4. Clean up
      await secondaryAuth.signOut();

      // Reset UI
      document.getElementById('new-doc-name').value = '';
      document.getElementById('new-doc-email').value = '';
      document.getElementById('new-doc-lic').value = '';
      document.getElementById('new-doc-pass').value = '';

      alert("Doctor account successfully provisioned!");
      loadDoctors();
    } catch(error) {
      console.error("Error creating doctor:", error);
      alert("Failed to provision doctor: " + error.message);
    } finally {
      btnCreateDoctor.innerText = originalText;
      btnCreateDoctor.disabled = false;
    }
  });
}
const statPatients = document.getElementById('stat-patients');
const statRx = document.getElementById('stat-rx');

async function loadDashboardAnalytics() {
  try {
    // 1. Fetch Aggregated Counts
    const patSnap = await getDocs(collection(db, "patients"));
    const rxSnap = await getDocs(collection(db, "prescriptions"));
    
    if(statPatients) statPatients.innerText = patSnap.size;
    if(statRx) statRx.innerText = rxSnap.size;

    // 2. Process Activity data (Last 7 days)
    const activityData = {};
    const medicineCounts = {};

    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      activityData[dateStr] = 0;
    }

    rxSnap.forEach(r => {
      const data = r.data();
      // Date processing
      if (data.date) {
        const pd = new Date(data.date);
        const dateStr = pd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (activityData[dateStr] !== undefined) {
          activityData[dateStr]++;
        }
      }

      // Medicines processing
      if (data.medicines && Array.isArray(data.medicines)) {
        data.medicines.forEach(m => {
          const name = m.name.toLowerCase();
          medicineCounts[name] = (medicineCounts[name] || 0) + 1;
        });
      }
    });

    // 3. Render Activity Chart
    renderActivityChart(Object.keys(activityData), Object.values(activityData));
    
    // 4. Render Medicines Chart
    // Sort and get top 5
    const sortedMeds = Object.entries(medicineCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
    renderMedicineChart(sortedMeds.map(m => m[0]), sortedMeds.map(m => m[1]));

  } catch (error) {
    console.error("Failed to load analytics: ", error);
  }
}

let actChartInst = null;
function renderActivityChart(labels, data) {
  const ctx = document.getElementById('activityChart');
  if(!ctx || !window.Chart) return;
  if(actChartInst) actChartInst.destroy();
  
  actChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Prescriptions Created',
        data: data,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

let medChartInst = null;
function renderMedicineChart(labels, data) {
  const ctx = document.getElementById('medicineChart');
  if(!ctx || !window.Chart) return;
  if(medChartInst) medChartInst.destroy();

  if(labels.length === 0) {
    labels = ['No Data Yet']; data = [1];
  }

  medChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });
}

