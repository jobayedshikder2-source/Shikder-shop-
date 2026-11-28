import React, {useMemo, useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {
  Bell,
  Grid,
  Heart,
  Home,
  Instagram,
  MessageCircle,
  Moon,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  User,
  Zap,
} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatBDT, getInstagramUrl, getWhatsAppUrl} from '../lib/bd-locations';
import {OfflineIndicator, PWAInstallButton} from './PWAWidgets';

export const Layout: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {
    user,
    isAdmin,
    language,
    setLanguage,
    t,
    darkMode,
    toggleDarkMode,
    cart,
    wishlist,
    notifications,
    products,
    websiteSettings,
    toastMessage,
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const unreadNotifs = notifications.filter((n) => !n.isRead).length;

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 4);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameBn && p.nameBn.toLowerCase().includes(q)) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [products, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFocused(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
        {children}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary px-5 py-2.5 text-sm font-semibold shadow-lg">
            {toastMessage}
          </div>
        )}
        <OfflineIndicator />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Slim Announcement Bar (<= 40px) */}
      <div className="bg-light-primary dark:bg-dark-primary-container text-light-on-primary dark:text-dark-on-primary-container px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <p className="text-xs font-medium truncate">
            {language === 'bn' ? websiteSettings.announcementTextBn : websiteSettings.announcementText}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="px-2.5 py-0.5 rounded-full bg-light-primary-container dark:bg-dark-surface text-light-on-primary dark:text-dark-primary border border-light-on-primary-container/30 text-xs font-semibold whitespace-nowrap shrink-0"
              aria-label="Switch language between English and Bengali"
            >
              {language === 'en' ? 'EN / বাং' : 'বাং / EN'}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Header: Brand — Nav Links — Actions */}
      <header className="sticky top-0 z-30 bg-light-surface-bright dark:bg-dark-surface-container-low border-b border-light-outline-variant dark:border-dark-outline-variant">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Brand Logo & Wordmark */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src="/assets/aistudio/file_00000000c1e88211b6f9ba18d88de282_18b6663a.png"
              alt="SHIKDER SHOP logo"
              className="w-10 h-10 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
            />
            <span className="font-headline font-extrabold text-lg tracking-tight text-light-on-surface dark:text-dark-on-surface whitespace-nowrap">
              {t('brandName')}
            </span>
          </Link>

          {/* Zone 2: Concise Nav Links (Desktop) */}
          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-6 text-sm font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <Link to="/products" className="hover:text-light-primary dark:hover:text-dark-primary hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t('products')}
            </Link>
            <Link to="/categories" className="hover:text-light-primary dark:hover:text-dark-primary hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t('categories')}
            </Link>
            <Link to="/products?flash=true" className="hover:text-light-secondary dark:hover:text-dark-secondary hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t('deals')}
            </Link>
            <Link to="/orders" className="hover:text-light-primary dark:hover:text-dark-primary hover:underline underline-offset-4 whitespace-nowrap shrink-0">
              {t('trackOrder')}
            </Link>
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1 text-light-primary dark:text-dark-primary hover:underline underline-offset-4 whitespace-nowrap shrink-0">
                <ShieldCheck className="w-4 h-4" />
                <span>{t('admin')}</span>
              </Link>
            )}
          </nav>

          {/* Search & Actions */}
          <div className="flex items-center gap-2 flex-1 lg:flex-initial justify-end max-w-md">
            <div className="relative flex-1 max-w-xs hidden sm:block">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-3 text-light-outline dark:text-dark-outline pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                  placeholder={t('searchPlaceholder')}
                  aria-label="Search products"
                  className="w-full rounded-full pl-9 pr-3 py-1.5 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface placeholder:text-light-outline focus:outline-none focus:border-light-primary dark:focus:border-dark-primary"
                />
              </form>
              {searchFocused && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-light-surface-bright dark:bg-dark-surface-container-high border border-light-outline-variant dark:border-dark-outline-variant p-2 shadow-lg z-40">
                  {suggestions.map((item) => (
                    <Link
                      key={item.id}
                      to={`/products/${item.slug}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container text-sm"
                    >
                      <span className="truncate font-medium">{item.name}</span>
                      <span className="text-xs font-semibold text-light-primary dark:text-dark-primary tabular-nums shrink-0">
                        {formatBDT(item.discountedPrice || item.regularPrice)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="w-9 h-9 rounded-full inline-flex items-center justify-center bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative w-9 h-9 rounded-full inline-flex items-center justify-center bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifs}
                </span>
              )}
            </Link>

            <Link
              to="/wishlist"
              aria-label={`Wishlist (${wishlist.length})`}
              className="relative w-9 h-9 rounded-full inline-flex items-center justify-center bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
            >
              <Heart className="w-4 h-4" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link
              to="/cart"
              aria-label={`Shopping cart (${cartCount})`}
              className="relative w-9 h-9 rounded-full inline-flex items-center justify-center bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              )}
            </Link>

            <Link
              to={user ? '/profile' : '/login'}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold whitespace-nowrap shrink-0"
            >
              <User className="w-4 h-4" />
              <span>{user ? t('account') : t('login')}</span>
            </Link>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="sm:hidden px-4 pb-2.5">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-light-outline dark:text-dark-outline pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label="Search products on mobile"
              className="w-full rounded-full pl-9 pr-4 py-1.5 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface"
            />
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-12">{children}</main>

      {/* Storefront Footer */}
      <footer className="bg-light-surface-container-low dark:bg-dark-surface-container border-t border-light-outline-variant dark:border-dark-outline-variant pt-10 pb-24 md:pb-10 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/aistudio/file_00000000c1e88211b6f9ba18d88de282_18b6663a.png"
                alt="SHIKDER SHOP logo"
                className="w-9 h-9 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
              />
              <span className="font-headline font-extrabold text-base">{websiteSettings.brandName}</span>
            </div>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Single-vendor official storefront serving all 64 districts of Bangladesh with verified products and Cash on Delivery.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <h3 className="font-title font-semibold text-light-on-surface dark:text-dark-on-surface">Shop</h3>
            <Link to="/products" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('products')}</Link>
            <Link to="/categories" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('categories')}</Link>
            <Link to="/products?flash=true" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('deals')}</Link>
            <Link to="/orders" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('trackOrder')}</Link>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <h3 className="font-title font-semibold text-light-on-surface dark:text-dark-on-surface">Information</h3>
            <Link to="/about" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('aboutUs')}</Link>
            <Link to="/contact" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('contactUs')}</Link>
            <Link to="/faq" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('faq')}</Link>
            <Link to="/return-policy" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('returnPolicy')}</Link>
            <Link to="/privacy-policy" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('privacyPolicy')}</Link>
            <Link to="/terms" className="text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline">{t('termsConditions')}</Link>
          </div>

          <div className="flex flex-col gap-2 text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <h3 className="font-title font-semibold text-light-on-surface dark:text-dark-on-surface">Store &amp; Support</h3>
            <p>{websiteSettings.address}</p>
            <a
              href={`mailto:${websiteSettings.supportEmail}`}
              className="text-xs hover:underline break-all"
            >
              {websiteSettings.supportEmail}
            </a>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold">
              <a
                href={getWhatsAppUrl(websiteSettings.whatsappNumber || websiteSettings.supportPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-success hover:underline"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp: {websiteSettings.whatsappNumber || websiteSettings.supportPhone}</span>
              </a>
              <a
                href={getInstagramUrl(websiteSettings.instagramUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-light-primary dark:text-dark-primary hover:underline"
              >
                <Instagram className="w-4 h-4" />
                <span>Instagram</span>
              </a>
            </div>
            {isAdmin && (
              <Link to="/admin" className="mt-1 inline-flex items-center gap-1.5 text-light-primary dark:text-dark-primary font-semibold hover:underline">
                <ShieldCheck className="w-4 h-4" />
                Open Admin Dashboard
              </Link>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-wrap items-center justify-between gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
          <span>© {new Date().getFullYear()} SHIKDER SHOP Bangladesh. All rights reserved.</span>
          <span>Currency: BDT (৳) · Timezone: Asia/Dhaka</span>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-light-surface-bright dark:bg-dark-surface-container-low border-t border-light-outline-variant dark:border-dark-outline-variant px-2 py-1.5 grid grid-cols-5 items-center"
      >
        <Link to="/" className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${location.pathname === '/' ? 'text-light-primary dark:text-dark-primary' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
          <Home className="w-5 h-5" />
          <span>{t('home')}</span>
        </Link>
        <Link to="/categories" className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${location.pathname.startsWith('/categories') ? 'text-light-primary dark:text-dark-primary' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
          <Grid className="w-5 h-5" />
          <span>{t('categories')}</span>
        </Link>
        <Link to="/products?flash=true" className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${location.search.includes('flash') ? 'text-light-secondary dark:text-dark-secondary' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
          <Zap className="w-5 h-5" />
          <span>{t('deals')}</span>
        </Link>
        <Link to="/cart" className={`relative flex flex-col items-center gap-0.5 text-[11px] font-medium ${location.pathname === '/cart' ? 'text-light-primary dark:text-dark-primary' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute top-0 right-4 min-w-4 h-4 px-1 rounded-full bg-light-secondary text-light-on-secondary text-[10px] font-bold flex items-center justify-center tabular-nums">
              {cartCount}
            </span>
          )}
          <span>{t('cart')}</span>
        </Link>
        <Link to={user ? '/profile' : '/login'} className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${location.pathname === '/profile' || location.pathname === '/login' ? 'text-light-primary dark:text-dark-primary' : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'}`}>
          <User className="w-5 h-5" />
          <span>{user ? t('account') : t('login')}</span>
        </Link>
      </nav>

      {/* Live Toast */}
      {toastMessage && (
        <div role="status" className="fixed bottom-16 md:bottom-6 right-4 z-50 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary px-5 py-2.5 text-sm font-semibold shadow-lg">
          {toastMessage}
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
};
