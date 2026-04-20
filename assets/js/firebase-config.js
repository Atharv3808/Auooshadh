import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAi7LTRytWSnGtc23pHVYYg5yo8vrgnfj0",
  authDomain: "doctor-prescription-97faa.firebaseapp.com",
  projectId: "doctor-prescription-97faa",
  storageBucket: "doctor-prescription-97faa.firebasestorage.app",
  messagingSenderId: "673482379996",
  appId: "1:673482379996:web:62815f696dced3f04f5a19",
  measurementId: "G-0DR9N77LKN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage, firebaseConfig };
