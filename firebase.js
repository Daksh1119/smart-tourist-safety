// Root-level Firebase initialization using Compat API

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// If you prefer env values, you can import Constants and use them.
// Keeping hard-coded here because you already supplied them.
const firebaseConfig = {
  apiKey: 'AIzaSyAUalPp62BeJVFTomoIXSAVkq18pdDqb08',
  authDomain: 'smart-tourist-safety-sih.firebaseapp.com',
  projectId: 'smart-tourist-safety-sih',
  storageBucket: 'smart-tourist-safety-sih.appspot.com',
  messagingSenderId: '169149732238',
  appId: '1:169149732238:web:9477e15263e10fddb140df',
  measurementId: 'G-D404PX42C6'
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

export { firebase, auth, db };