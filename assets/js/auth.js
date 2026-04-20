import { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// DOM Elements
const loginForm = document.getElementById('form-login');
const loginError = document.getElementById('login-error');

// Handle Auth State Changes
if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Fetch user role
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const userData = docSnap.data();
          if (userData.role === 'admin') {
            window.location.href = '/admin/';
          } else {
            window.location.href = '/doctor/';
          }
        } else {
          // If the user authenticated but has no profile document, default to doctor pending
          console.warn("User document not found, creating default.");
          await setDoc(docRef, {
            name: user.email.split('@')[0], // fallback name
            email: user.email,
            license: "N/A",
            role: "doctor",
            status: "pending",
            createdAt: new Date().toISOString()
          });
          window.location.href = '/doctor/';
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        alert("Sign-in error: " + error.message + " (Check Firestore rules or console)");
        // Reset UI if possible
        if (loginForm && loginForm.querySelector('button').disabled) {
           const btn = loginForm.querySelector('button');
           btn.innerText = 'Sign In';
           btn.disabled = false;
        }
      }
    }
  });
}

// Handle Login
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = loginForm.querySelector('button');
    const originalText = btn.innerText;

    try {
      btn.innerText = 'Signing In...';
      btn.disabled = true;
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the redirect
    } catch (error) {
      loginError.innerText = error.message;
      loginError.style.display = 'block';
      btn.disabled = false;
      btn.innerText = originalText;
    }
  });
}


// Expose logout globally so any page can use it
window.logout = function() {
  auth.signOut().then(() => {
    window.location.href = '/';
  });
};
