import React, {useState} from 'react';
import {Download, WifiOff, X} from 'lucide-react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWA';
import {useStore} from '../context/StoreContext';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const {t} = useStore();

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-light-primary-container text-light-on-primary text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{t('installApp')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-light-primary-container text-light-on-primary text-xs font-semibold whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t('installApp')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-light-surface-bright dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-lg font-bold">Install SHIKDER SHOP</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="p-1 rounded-full hover:bg-light-surface-container dark:hover:bg-dark-surface-container-high"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                1. Tap the <strong>Share</strong> icon in your Safari toolbar.
                <br />
                2. Scroll down and select <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-2 w-full py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const {t} = useStore();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-warning text-on-warning px-4 py-2 text-xs font-semibold shadow-md"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>{t('offlineNotice')}</span>
    </div>
  );
};
