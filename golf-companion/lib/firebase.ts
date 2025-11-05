import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA2DRwI0ht9w0on0ZpwwlMRuvaxxZZerSc",
  authDomain: "golfcompanion-41cf9.firebaseapp.com",
  projectId: "golfcompanion-41cf9",
  storageBucket: "golfcompanion-41cf9.firebasestorage.app",
  messagingSenderId: "732200427793",
  appId: "1:732200427793:web:cd6565c453a2629ad22cb0",
  measurementId: "G-1E38VPLSZJ"
};

export const firebaseApp = initializeApp(firebaseConfig);