/**
 * authService.js (Modular Firebase SDK + serverTimestamp)
 *
 * This version:
 * - Uses modular Firebase imports (NO compat layer).
 * - Applies serverTimestamp() for createdAt / updatedAt.
 * - Restricts which profile fields can be updated by the client.
 * - Includes: register, login, logout, reauthenticate, changePassword, resetPassword,
 *   fetchSecureDigitalID, updateProfile.
 *
 * Prerequisites:
 *  - Your firebase config file (e.g. config/firebase.js) should export:
 *      import { initializeApp } from 'firebase/app';
 *      import { getAuth } from 'firebase/auth';
 *      import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
 *      ...
 *      export const app = initializeApp(firebaseConfig);
 *      export const auth = getAuth(app);
 *      export const db = getFirestore(app);
 *      enableMultiTabIndexedDbPersistence(db).catch(()=>{});
 *
 *  - APP_CONSTANTS.COLLECTIONS.TOURISTS must be defined and equal to "tourists"
 *  - generateDigitalID(uid, fullName, nationality) should return:
 *        { id: string, hash: string, validUntil: ISOString }
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as fbUpdateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { generateDigitalID } from '../utils/digitalID';
import { APP_CONSTANTS } from '../config/constants';

/* ---------------- Error Mapping ---------------- */
function mapError(e) {
  if (!e) return 'Unknown error';
  if (e.code) {
    switch (e.code) {
      case 'auth/email-already-in-use': return 'Email already registered.';
      case 'auth/invalid-email': return 'Invalid email address.';
      case 'auth/weak-password': return 'Password is too weak.';
      case 'auth/network-request-failed': return 'Network error. Check your connection.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/user-not-found': return 'No user found with those credentials.';
      case 'auth/too-many-requests': return 'Too many attempts. Try later.';
      case 'auth/requires-recent-login': return 'Please reauthenticate and try again.';
      default: return e.message || e.code;
    }
  }
  return e.message || 'Unexpected error';
}

/* ---------------- Auth Service Class ---------------- */
class AuthService {

  listenAuth(callback) {
    return auth.onAuthStateChanged(callback);
  }

  /**
   * REGISTER
   * Creates Firebase Auth user + Firestore profile doc with immutable digital ID fields.
   */
  async register({
    fullName,
    email,
    password,
    phoneNumber,
    nationality,
    passportNumber = '',
    emergencyContact = '',
    emergencyPhone = ''
  }) {
    const timeline = [];
    const stamp = (label) => timeline.push({ label, t: Date.now() });

    try {
      stamp('start');

      // Create auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      stamp('createdUser');

      // Update displayName (non-fatal if fails)
      try {
        await fbUpdateProfile(credential.user, { displayName: fullName });
        stamp('updatedDisplayName');
      } catch (e) {
        console.warn('[AuthService.register] updateProfile failed', e);
      }

      // Generate digital ID (fallback if fails)
      let digital;
      try {
        digital = await generateDigitalID(credential.user.uid, fullName, nationality);
        stamp('digitalIDGenerated');
      } catch (e) {
        console.warn('[AuthService.register] digital ID generation failed -> fallback', e);
        digital = {
          id: `FALLBACK-${Date.now().toString(36).toUpperCase()}`,
          hash: 'FALLBACK',
          validUntil: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString()
        };
      }

      const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS;
      const userDocRef = doc(db, touristsColl, credential.user.uid);

      // Firestore profile document (serverTimestamp for createdAt/updatedAt)
      const nowISO = new Date().toISOString();
      const profileDoc = {
        uid: credential.user.uid,
        fullName,
        email,
        phoneNumber: phoneNumber || '',
        nationality: nationality || '',
        passportNumber: passportNumber || '',
        emergencyContact: emergencyContact || '',
        emergencyPhone: emergencyPhone || '',
        digitalTouristID: digital.id,
        digitalIDHash: digital.hash,
        digitalIDValidUntil: digital.validUntil,
        registrationDate: nowISO,          // Keep ISO for easy display
        lastLoginDate: nowISO,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        await setDoc(userDocRef, profileDoc, { merge: false });
        stamp('profileWritten');
      } catch (e) {
        console.warn('[AuthService.register] Firestore write failed', e);
        throw new Error(mapError(e));
      }

      stamp('end');

      return {
        user: credential.user,
        profile: profileDoc,
        meta: { timeline }
      };
    } catch (e) {
      console.warn('[AuthService.register] FATAL', e);
      throw new Error(mapError(e));
    }
  }

  /**
   * LOGIN
   * Updates lastLoginDate & updatedAt (serverTimestamp).
   */
  async login(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS;
      const userDocRef = doc(db, touristsColl, credential.user.uid);

      // Update lastLoginDate (ISO + updatedAt serverTimestamp)
      try {
        await updateDoc(userDocRef, {
          lastLoginDate: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('[AuthService.login] Failed to update lastLoginDate', e);
      }

      // Fetch profile
      let profileData = null;
      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) profileData = snap.data();
      } catch (e) {
        console.warn('[AuthService.login] Fetch profile failed', e);
      }

      return { user: credential.user, profile: profileData };
    } catch (e) {
      throw new Error(mapError(e));
    }
  }

  async logout() {
    await signOut(auth);
  }

  /**
   * REAUTHENTICATE
   */
  async reauthenticate(password) {
    if (!auth.currentUser?.email) throw new Error('No active user');
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, cred);
      return true;
    } catch (e) {
      throw new Error(mapError(e));
    }
  }

  /**
   * FETCH SECURE DIGITAL ID (only the locked fields)
   */
  async fetchSecureDigitalID(uid) {
    const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS;
    const userDocRef = doc(db, touristsColl, uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) throw new Error('Profile not found');
    const data = snap.data();
    return {
      digitalTouristID: data.digitalTouristID,
      digitalIDHash: data.digitalIDHash,
      digitalIDValidUntil: data.digitalIDValidUntil
    };
  }

  /**
   * UPDATE PROFILE (only allowed mutable fields)
   */
  async updateProfile(partial) {
    if (!auth.currentUser?.uid) throw new Error('Not authenticated');

    const allowed = [
      'fullName',
      'phoneNumber',
      'nationality',
      'passportNumber',
      'emergencyContact',
      'emergencyPhone'
    ];
    const update = {};
    allowed.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(partial, k)) {
        update[k] = partial[k];
      }
    });

    if (Object.keys(update).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Update displayName if fullName present
    if (update.fullName) {
      try {
        await fbUpdateProfile(auth.currentUser, { displayName: update.fullName });
      } catch (e) {
        console.warn('[AuthService.updateProfile] displayName update failed', e);
      }
    }

    update.updatedAt = serverTimestamp();

    const touristsColl = APP_CONSTANTS.COLLECTIONS.TOURISTS;
    const userDocRef = doc(db, touristsColl, auth.currentUser.uid);

    try {
      await updateDoc(userDocRef, update);
    } catch (e) {
      console.warn('[AuthService.updateProfile] Firestore update failed', e);
      throw new Error(mapError(e));
    }

    // Return fresh snapshot
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (e) {
      console.warn('[AuthService.updateProfile] fetch fresh failed', e);
      return null;
    }
  }

  /**
   * CHANGE PASSWORD (reauthorizes with current password first)
   */
  async changePassword(currentPwd, newPwd) {
    if (!auth.currentUser) throw new Error('No authenticated user');
    try {
      await this.reauthenticate(currentPwd);
      await updatePassword(auth.currentUser, newPwd);
      return true;
    } catch (e) {
      throw new Error(mapError(e));
    }
  }

  /**
   * RESET PASSWORD (sends email)
   */
  async resetPassword(email) {
    if (!email) throw new Error('Email required');
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (e) {
      throw new Error(mapError(e));
    }
  }
}

export default new AuthService();