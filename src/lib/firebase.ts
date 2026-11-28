import {initializeApp, getApps, getApp} from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import {getStorage} from 'firebase/storage';
import {initializeAppCheck, ReCaptchaV3Provider} from 'firebase/app-check';
import {getMessaging, isSupported as isMessagingSupported} from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({prompt: 'select_account'});

export {browserPopupRedirectResolver};

export async function ensureBrowserLocalPersistence(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (localErr) {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch {
        console.warn('Auth persistence fallback warning:', localErr);
      }
    }
  }
}

export const authPersistenceReady: Promise<void> = ensureBrowserLocalPersistence();

if (typeof window !== 'undefined') {
  const recaptchaSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_KEY || firebaseConfig.recaptchaSiteKey;
  if (recaptchaSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      console.warn('App Check initialization skipped:', err);
    }
  }
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code?: unknown}).code || '')
      : '';
  const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Sign-in failed: "${host}" is not listed in Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'This sign-in method is currently disabled in Firebase Authentication. Enable Google and Email/Password providers in Firebase Console.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Please allow popups for this site in your browser settings and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled before completion. Please try again.';
    case 'auth/network-request-failed':
      return 'Network error while reaching Firebase Authentication. Check your internet connection and retry.';
    case 'auth/web-storage-unsupported':
      return 'Browser cookies or storage are disabled. Please enable site data/cookies in your browser to sign in.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email under a different sign-in provider.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support for assistance.';
    case 'auth/too-many-requests':
      return 'Too many authentication attempts. Please wait a moment and try again.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Unable to complete authentication. Please try again.';
  }
}

export async function getFirebaseMessagingSafe() {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isMessagingSupported();
    return supported ? getMessaging(app) : null;
  } catch {
    return null;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration — client is offline.');
      return false;
    }
    return true;
  }
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'bnagladeshbodnaparty@gmail.com';
export {app, firebaseConfig};
