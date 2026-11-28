import React, {useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {browserPopupRedirectResolver, signInWithPopup, signInWithRedirect} from 'firebase/auth';
import {Loader2, ShieldCheck} from 'lucide-react';
import {auth, authPersistenceReady, formatFirebaseAuthError, googleProvider} from '../lib/firebase';
import {
  AUTH_REDIRECT_PATH_KEY,
  GOOGLE_REDIRECT_PENDING_KEY,
  useStore,
} from '../context/StoreContext';

function sanitizeRedirectPath(raw: string | null): string {
  if (!raw) return '/profile';
  const trimmed = raw.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return '/profile';
}

function isEmbeddedIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    user,
    authReady,
    redirectChecked,
    redirectAuthError,
    clearRedirectAuthError,
    showToast,
  } = useStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<'redirect' | 'popup' | null>(null);

  const requestedRedirect = sanitizeRedirectPath(
    searchParams.get('redirect') ||
      (typeof window !== 'undefined' ? sessionStorage.getItem(AUTH_REDIRECT_PATH_KEY) : null)
  );

  useEffect(() => {
    if (authReady && redirectChecked && user) {
      const target = sanitizeRedirectPath(
        searchParams.get('redirect') || sessionStorage.getItem(AUTH_REDIRECT_PATH_KEY)
      );
      sessionStorage.removeItem(AUTH_REDIRECT_PATH_KEY);
      navigate(target, {replace: true});
    }
  }, [authReady, redirectChecked, user, navigate, searchParams]);

  const handleGooglePopupSignIn = async () => {
    setAuthError(null);
    clearRedirectAuthError();
    setBusyMode('popup');
    try {
      await authPersistenceReady;
      sessionStorage.setItem(AUTH_REDIRECT_PATH_KEY, requestedRedirect);
      await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
      sessionStorage.removeItem(AUTH_REDIRECT_PATH_KEY);
      showToast('Signed in with Google');
      navigate(requestedRedirect, {replace: true});
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as {code?: unknown}).code || '')
          : '';
      if (code === 'auth/popup-blocked' && !isEmbeddedIframe()) {
        try {
          sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, String(Date.now()));
          await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
          return;
        } catch (redirectErr) {
          sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
          setAuthError(formatFirebaseAuthError(redirectErr));
        }
      } else {
        setAuthError(formatFirebaseAuthError(err));
      }
      setBusyMode(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    clearRedirectAuthError();

    // Google OAuth blocks cross-origin iframe redirects via X-Frame-Options: DENY
    if (isEmbeddedIframe()) {
      await handleGooglePopupSignIn();
      return;
    }

    setBusyMode('redirect');
    try {
      await authPersistenceReady;
      sessionStorage.setItem(AUTH_REDIRECT_PATH_KEY, requestedRedirect);
      sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, String(Date.now()));
      await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    } catch (err) {
      sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
      setAuthError(formatFirebaseAuthError(err));
      setBusyMode(null);
    }
  };

  const combinedError = authError || redirectAuthError;
  const checkingRedirect = !authReady || !redirectChecked;
  const busy = busyMode !== null || checkingRedirect;

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 md:p-8 flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-2.5">
          <img
            src="/assets/aistudio/file_00000000c1e88211b6f9ba18d88de282_18b6663a.png"
            alt="SHIKDER SHOP logo"
            className="w-16 h-16 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant"
          />
          <h1 className="font-headline text-2xl font-bold">Sign In to SHIKDER SHOP</h1>
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Sign in with your Google account to track orders, save delivery addresses, and manage your wishlist.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleGoogleSignIn}
          className="w-full py-3 px-5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2.5"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1H12v2.98h5.35c-.23 1.47-1.74 4.31-5.35 4.31-3.22 0-5.85-2.67-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.69 3.96 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.19 0 8.63-3.65 8.63-8.79 0-.59-.06-1.04-.14-1.11z"
              />
            </svg>
          )}
          <span>
            {checkingRedirect
              ? 'Verifying Google sign-in...'
              : busyMode === 'redirect'
              ? 'Redirecting to Google...'
              : busyMode === 'popup'
              ? 'Connecting to Google...'
              : 'Continue with Google'}
          </span>
        </button>

        {combinedError && (
          <div role="alert" className="rounded-lg bg-light-error-container text-light-on-error-container p-3 text-xs font-semibold flex flex-col gap-2">
            <span>{combinedError}</span>
          </div>
        )}

        {!checkingRedirect && (
          <button
            type="button"
            disabled={busy}
            onClick={handleGooglePopupSignIn}
            className="w-full py-2.5 px-4 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container transition-colors disabled:opacity-60"
          >
            Having trouble redirecting? Sign in with Google Popup
          </button>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant pt-1">
          <ShieldCheck className="w-4 h-4 text-success shrink-0" />
          <span>Secured by Google Sign-In &amp; Firebase Authentication</span>
        </div>
      </div>
    </div>
  );
};
