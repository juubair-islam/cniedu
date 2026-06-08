// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Ei duto notun import korte hobe Auth ar Database er jonno
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0G73L4VeGNZDCYAI6YiNBi0_xNIEJZvs",
  authDomain: "cniedu.firebaseapp.com",
  projectId: "cniedu",
  storageBucket: "cniedu.firebasestorage.app",
  messagingSenderId: "1044786022662",
  appId: "1:1044786022662:web:52369c49d92de272dfb687",
  measurementId: "G-XT1JMMEKPE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Ei duto export na korle onno page theke database pawea jabe na
export { auth, db };