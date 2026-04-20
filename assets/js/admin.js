import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Mock Analytics
document.getElementById('stat-rx').innerText = Math.floor(Math.random() * 500) + 120;
