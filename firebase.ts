import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAklmsuYWvws9GiMuKLRRG9NrW8wKgryeA",
  authDomain: "happyhome-bc5e7.firebaseapp.com",
  databaseURL: "https://happyhome-bc5e7-default-rtdb.firebaseio.com",
  projectId: "happyhome-bc5e7",
  storageBucket: "happyhome-bc5e7.firebasestorage.app",
  messagingSenderId: "1057692254640",
  appId: "1:1057692254640:web:529edffc6161fee4025675",
  measurementId: "G-8SQ0EGSFN1"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);