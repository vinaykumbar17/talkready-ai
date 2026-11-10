// Import the functions you need from the SDKs you need

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArUf1IXsZNAs5pL1By-xFhopdNb6qRCrM",
  authDomain: "talkready-ai.firebaseapp.com",
  projectId: "talkready-ai",
  storageBucket: "talkready-ai.firebasestorage.app",
  messagingSenderId: "591431734594",
  appId: "1:591431734594:web:9ecc1c5f35fdf3f657a4db",
  measurementId: "G-T2KHQT9BN9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);