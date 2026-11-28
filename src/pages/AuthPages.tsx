import React, {useEffect, useState} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import {Eye, EyeOff, Loader2, Mail, ShieldCheck} from 'lucide-react';
import {auth, authPersistenceReady, formatFirebaseAuthError, googleProvider} from '../lib/firebase';
import {
  AUTH_REDIRECT_PATH_KEY,
  GOOGLE_REDIRECT_PENDING_KEY,
  useStore,
} from '../context/StoreContext';

type AuthTab = 'google' | 'email';

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

  const [activeTab, setActiveTab] = useState<AuthTab>('google');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<'redirect' | 'popup' | 'email' | null>(null);

  // Email / Password state
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setAuthError(null);
    setAuthInfo(null);
    clearRedirectAuthError();
  };

  const handleGooglePopupSignIn = async () => {
    setAuthError(null);
    setAuthInfo(null);
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
    setAuthInfo(null);
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);
    clearRedirectAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (emailMode === 'signup' && fullName.trim().length < 2) {
      setAuthError('Please enter your full name.');
      return;
    }

    setBusyMode('email');
    try {
      await authPersistenceReady;
      if (emailMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, {displayName: fullName.trim().slice(0, 120)}).catch(() => {});
        showToast('Account created and signed in');
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
        showToast('Signed in with Email');
      }
      sessionStorage.removeItem(AUTH_REDIRECT_PATH_KEY);
      navigate(requestedRedirect, {replace: true});
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setBusyMode(null);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError(null);
    setAuthInfo(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthError('Enter your email address above first to receive a password reset link.');
      return;
    }
    setBusyMode('email');
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setAuthInfo(`Password reset link sent to ${cleanEmail}. Check your inbox or spam folder.`);
      showToast('Password reset email sent');
    } catch (err) {
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setBusyMode(null);
    }
  };

  const combinedError = authError || redirectAuthError;
  const checkingRedirect = !authReady || !redirectChecked;
  const busy = busyMode !== null || checkingRedirect;

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 md:p-8 flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-2.5">
          <img
            src="/assets/aistudio/file_00000000c1e88211b6f9ba18d88de282_18b6663a.png"
            alt="SHIKDER SHOP logo"
            className="w-16 h-16 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant"
          />
          <h1 className="font-headline text-2xl font-bold">Sign In to SHIKDER SHOP</h1>
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Sign in with Google or Email &amp; Password to track orders and submit product reviews.
          </p>
        </div>

        {/* Auth Method Selector */}
        <div
          role="tablist"
          aria-label="Sign-in methods"
          className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'google'}
            onClick={() => switchTab('google')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'google'
                ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface shadow-xs'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
            }`}
          >
            Google
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'email'}
            onClick={() => switchTab('email')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'email'
                ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface shadow-xs'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
        </div>

        {/* Google Tab */}
        {activeTab === 'google' && (
          <div className="flex flex-col gap-3">
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
          </div>
        )}

        {/* Email & Password Tab */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-light-on-surface dark:text-dark-on-surface">
                {emailMode === 'signin' ? 'Sign in with Email' : 'Create Email Account'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEmailMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                  setAuthError(null);
                  setAuthInfo(null);
                }}
                className="font-semibold text-light-primary dark:text-dark-primary hover:underline"
              >
                {emailMode === 'signin' ? 'Create Account' : 'Already have an account?'}
              </button>
            </div>

            {emailMode === 'signup' && (
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Full Name
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="rounded-xl px-3.5 py-2.5 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
              </label>
            )}

            <label className="flex flex-col gap-1 text-xs font-semibold">
              Email Address
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="rounded-xl px-3.5 py-2.5 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-semibold">
              Password
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl pl-3.5 pr-10 py-2.5 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 text-light-outline dark:text-dark-outline"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {emailMode === 'signin' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePasswordReset}
                  className="text-xs font-medium text-light-primary dark:text-dark-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 px-5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busyMode === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {busyMode === 'email'
                  ? 'Please wait...'
                  : emailMode === 'signup'
                  ? 'Create Account'
                  : 'Sign In with Email'}
              </span>
            </button>
          </form>
        )}

        {authInfo && (
          <div role="status" className="rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container border border-success/40 text-success p-3 text-xs font-semibold">
            {authInfo}
          </div>
        )}

        {combinedError && (
          <div role="alert" className="rounded-lg bg-light-error-container text-light-on-error-container p-3 text-xs font-semibold flex flex-col gap-2">
            <span>{combinedError}</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-1.5 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant pt-1 text-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success shrink-0" />
            <span>Secured by Firebase Authentication</span>
          </div>
          <p className="text-[11px]">
            By signing in, you agree to our{' '}
            <Link to="/privacy-policy" className="font-semibold text-light-primary dark:text-dark-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
};
