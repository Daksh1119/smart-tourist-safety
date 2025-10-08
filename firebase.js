// Root-level Firebase initialization using Compat API (Auth + Firestore + Realtime DB)

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database'; // <-- Realtime Database compat import

// IMPORTANT: Added databaseURL so RTDB works correctly.
const firebaseConfig = {
  apiKey: 'AIzaSyAUalPp62BeJVFTomoIXSAVkq18pdDqb08',
  authDomain: 'smart-tourist-safety-sih.firebaseapp.com',
  projectId: 'smart-tourist-safety-sih',
  storageBucket: 'smart-tourist-safety-sih.appspot.com',
  messagingSenderId: '169149732238',
  appId: '1:169149732238:web:9477e15263e10fddb140df',
  measurementId: 'G-D404PX42C6',
  databaseURL: 'https://smart-tourist-safety-sih-default-rtdb.firebaseio.com' // <-- ADDED
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database(); // <-- export this for live location writes

export { firebase, auth, db, rtdb };