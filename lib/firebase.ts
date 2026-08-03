import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAf5OJTy6cMq19o6iJKwV5fzofUnBkvjPw",
  authDomain: "edge-journal-f3179.firebaseapp.com",
  projectId: "edge-journal-f3179",
  storageBucket: "edge-journal-f3179.firebasestorage.app",
  messagingSenderId: "641522580699",
  appId: "1:641522580699:web:4d9352cbb490399fa120fe",
  measurementId: "G-CBRPPGRXF4"
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
