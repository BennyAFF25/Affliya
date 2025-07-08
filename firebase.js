import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbkgC5o_tyjHNaa1NKPawmzruD65k-bDs",
  authDomain: "falconx-8c628.firebaseapp.com",
  projectId: "falconx-8c628",
  storageBucket: "falconx-8c628.appspot.com",
  messagingSenderId: "1029116864976",
  appId: "1:1029116864976:web:b30ffa7b8be637669571d5",
  measurementId: "G-HHHFJWPF43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, provider, db };
