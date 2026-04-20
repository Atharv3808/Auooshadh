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
const signupForm = document.getElementById('form-signup');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

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
        if (signupForm && signupForm.querySelector('button').disabled) {
           const btn = signupForm.querySelector('button');
           btn.innerText = 'Create Account';
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

// Handle Signup
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.style.display = 'none';
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const license = document.getElementById('signup-license').value;
    const password = document.getElementById('signup-password').value;
    const btn = signupForm.querySelector('button');
    const originalText = btn.innerText;

    try {
      btn.innerText = 'Creating Account...';
      btn.disabled = true;
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const isAdminAccount = email.toLowerCase().startsWith('admin');
      
      // Save additional info to Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        license: isAdminAccount ? "ADMIN-KEY" : license,
        role: isAdminAccount ? "admin" : "doctor",
        status: isAdminAccount ? "approved" : "pending", // Requires admin approval if doctor
        createdAt: new Date().toISOString()
      });

      // Redirect will be handled by onAuthStateChanged
    } catch (error) {
      signupError.innerText = error.message;
      signupError.style.display = 'block';
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
