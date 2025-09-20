import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef
} from 'react';

import AuthService from '../services/authService';
import {
  cacheProfile,
  getCachedProfile,
  clearCachedProfile
} from '../utils/profileCache';
import { isDigitalIDValid } from '../utils/digitalID';

import { auth, firebase } from '../firebase';

import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import { base64urlEncode } from '../utils/base64url';

WebBrowser.maybeCompleteAuthSession();

// Runtime config (prefer extra.google.webClientId; fall back to env)
const expoConfig = Constants.expoConfig || {};
const { extra = {} } = expoConfig;
const { google = {} } = extra;

const GOOGLE_WEB_CLIENT_ID =
  google.webClientId ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  null;

console.log('[AuthContext] Google Web Client ID:', GOOGLE_WEB_CLIENT_ID || 'MISSING');

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/* ---------------- PKCE Helpers ---------------- */

async function createCodeVerifier() {
  try {
    const bytes = await Crypto.getRandomBytesAsync(64); // Uint8Array
    let verifier = base64urlEncode(bytes); // ~86 chars
    if (verifier.length < 43) {
      while (verifier.length < 43) verifier += verifier;
      verifier = verifier.slice(0, 64);
    }
    if (verifier.length > 128) verifier = verifier.slice(0, 128);
    return verifier;
  } catch (e) {
    console.warn('[AuthContext][PKCE] Fallback Math.random due to crypto error:', e);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let out = '';
    for (let i = 0; i < 64; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }
}

async function codeChallengeFromVerifier(codeVerifier) {
  const digestB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digestB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ---------------- Provider ---------------- */

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load cached profile once (fast paint)
  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedProfile();
        if (cached && mountedRef.current) setProfile(cached);
      } catch {
        // ignore cache errors
      }
    })();
  }, []);

  // Remove sensitive fields before storing to state/cache
  const redactSensitive = (p) => {
    if (!p) return p;
    const {
      digitalTouristID,
      digitalIDHash,
      digitalIDValidUntil,
      digitalIDIssuedAt,
      blockchainTxHash,
      blockchainBlockNumber,
      blockchainNetwork,
      blockchainChainId,
      ...safe
    } = p;
    return safe;
  };

  // Fetch/create and cache profile whenever we have a Firebase user
  const loadAndCacheProfile = useCallback(async (fbUser) => {
    if (!fbUser || !fbUser.uid) return;

    let p = null;

    try {
      if (typeof AuthService.getProfile === 'function') {
        p = await AuthService.getProfile(fbUser.uid);
      } else if (typeof AuthService.fetchProfile === 'function') {
        p = await AuthService.fetchProfile(fbUser.uid);
      }
    } catch (e) {
      console.warn('[AuthContext] getProfile failed:', e?.message || e);
    }

    if (!p) {
      // Synthesize a minimal profile so UI has data immediately
      const minimal = {
        uid: fbUser.uid,
        fullName: fbUser.displayName || '',
        email: fbUser.email || fbUser.providerData?.[0]?.email || '',
        phone: fbUser.phoneNumber || '',
        nationality: '',
        identityVerified: false,
        emergencyContact: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      // Best-effort persist
      try {
        if (typeof AuthService.updateProfile === 'function') {
          await AuthService.updateProfile(minimal);
        }
      } catch (e) {
        console.warn('[AuthContext] Persist minimal profile failed (non-fatal):', e?.message || e);
      }
      p = minimal;
    }

    const safe = redactSensitive(p);
    if (mountedRef.current) {
      setProfile(safe);
      cacheProfile(safe).catch(() => {});
    }
  }, []);

  // Auth state listener — ALWAYS load profile on sign-in
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (firebaseUser) => {
      if (!mountedRef.current) return;

      setUser(firebaseUser || null);

      if (firebaseUser) {
        await loadAndCacheProfile(firebaseUser);
      } else {
        setProfile(null);
        clearCachedProfile().catch(() => {});
      }

      setInitializing(false);
    });

    return unsub;
  }, [loadAndCacheProfile]);

  // Guarded action wrapper
  const guarded = (fn) => async (...args) => {
    if (actionLoading) return;
    setActionLoading(true);
    try { return await fn(...args); }
    finally { mountedRef.current && setActionLoading(false); }
  };

  /* ---------------- Email/Password Auth ---------------- */

  const register = useCallback(guarded(async (data) => {
    const { user: u, profile: p } = await AuthService.register(data);
    if (!mountedRef.current) return;
    setUser(u);
    if (p) {
      const safe = redactSensitive(p);
      setProfile(safe);
      cacheProfile(safe).catch(()=>{});
    } else if (u) {
      await loadAndCacheProfile(u);
    }
  }), [actionLoading, loadAndCacheProfile]);

  const login = useCallback(guarded(async (email, password) => {
    const { user: u, profile: p } = await AuthService.login(email, password);
    if (!mountedRef.current) return;
    setUser(u);
    if (p) {
      const safe = redactSensitive(p);
      setProfile(safe);
      cacheProfile(safe).catch(()=>{});
    } else if (u) {
      await loadAndCacheProfile(u);
    }
  }), [actionLoading, loadAndCacheProfile]);

  const logout = useCallback(guarded(async () => {
    await AuthService.logout();
    if (!mountedRef.current) return;
    setUser(null);
    setProfile(null);
    clearCachedProfile().catch(()=>{});
  }), [actionLoading]);

  const reauthenticate = useCallback(async (pwd) => AuthService.reauthenticate(pwd), []);
  const fetchSecureDigitalID = useCallback(async (uid) => AuthService.fetchSecureDigitalID(uid), []);

  const updateProfile = useCallback(guarded(async (partial) => {
    const fresh = await AuthService.updateProfile(partial);
    if (fresh && mountedRef.current) {
      const safe = redactSensitive(fresh);
      setProfile(safe);
      cacheProfile(safe).catch(()=>{});
    }
  }), [actionLoading]);

  const changePassword = useCallback(guarded(async (currentPwd, newPwd) => {
    await AuthService.changePassword(currentPwd, newPwd);
  }), [actionLoading]);

  const resetPassword = useCallback(guarded(async (email) => {
    await AuthService.resetPassword(email);
  }), [actionLoading]);

  /* ---------------- Google Sign-In (PKCE) ---------------- */

  const signInWithGoogle = useCallback(async () => {
    if (actionLoading) {
      console.log('[AuthContext][Google] Ignored duplicate tap.');
      return;
    }
    if (!GOOGLE_WEB_CLIENT_ID) {
      console.warn('[AuthContext][Google] Missing web client ID (extra.google.webClientId or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)');
      return;
    }

    setActionLoading(true);
    try {
      // Use AuthSession proxy for Expo Go / Dev Client
      const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
      console.log('[AuthContext][Google] redirectUri:', redirectUri);

      const codeVerifier = await createCodeVerifier();
      const codeChallenge = await codeChallengeFromVerifier(codeVerifier);

      const params = {
        response_type: 'code',
        client_id: GOOGLE_WEB_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        prompt: 'select_account',
        access_type: 'offline',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      };

      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');

      console.log('[AuthContext][Google] Launching browser...');
      const result = await AuthSession.startAsync({ authUrl });

      if (result.type !== 'success' || !result.params?.code) {
        console.log('[AuthContext][Google] Cancelled or no code. type:', result.type);
        return;
      }

      console.log('[AuthContext][Google] Exchanging code for tokens...');
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: [
          'grant_type=authorization_code',
          'code=' + encodeURIComponent(result.params.code),
          'client_id=' + encodeURIComponent(GOOGLE_WEB_CLIENT_ID),
          'redirect_uri=' + encodeURIComponent(redirectUri),
          'code_verifier=' + encodeURIComponent(codeVerifier)
        ].join('&')
      }).then(r => r.json());

      if (tokenRes.error) {
        console.warn('[AuthContext][Google] Token exchange error:', tokenRes);
        return;
      }
      if (!tokenRes.id_token) {
        console.warn('[AuthContext][Google] No id_token returned.');
        return;
      }

      console.log('[AuthContext][Google] Signing into Firebase...');
      const credential = firebase.auth.GoogleAuthProvider.credential(tokenRes.id_token);
      await auth.signInWithCredential(credential);

      // Ensure profile is loaded immediately
      const current = auth.currentUser;
      if (current) {
        await loadAndCacheProfile(current);
      }

      console.log('[AuthContext][Google] Firebase sign-in success.');
    } catch (e) {
      console.warn('[AuthContext][Google] Sign-in failed:', e);
    } finally {
      mountedRef.current && setActionLoading(false);
    }
  }, [actionLoading, GOOGLE_WEB_CLIENT_ID, loadAndCacheProfile]);

  // Optional manual refresh
  const refreshProfile = useCallback(async () => {
    if (user) await loadAndCacheProfile(user);
  }, [user, loadAndCacheProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    initializing,
    actionLoading,
    isAuthenticated: !!user,
    register,
    login,
    logout,
    reauthenticate,
    fetchSecureDigitalID,
    updateProfile,
    changePassword,
    resetPassword,
    signInWithGoogle,
    refreshProfile,
    isDigitalIDValid
  }), [
    user,
    profile,
    initializing,
    actionLoading,
    register,
    login,
    logout,
    reauthenticate,
    fetchSecureDigitalID,
    updateProfile,
    changePassword,
    resetPassword,
    signInWithGoogle,
    refreshProfile
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthProvider };