
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC2XO8RMqTV1mYHGH5BM9zu86LN5TseQ0c",
    authDomain: "soft-rose-2.firebaseapp.com",
    projectId: "soft-rose-2",
    storageBucket: "soft-rose-2.firebasestorage.app",
    messagingSenderId: "509521218361",
    appId: "1:509521218361:web:1098fda7a357fafaa2f6e8",
    measurementId: "G-HS6JP3KSW5"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
