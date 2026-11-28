import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {getRedirectResult, onAuthStateChanged, signOut, type User, type UserCredential} from 'firebase/auth';
import {
  auth,
  authPersistenceReady,
  browserPopupRedirectResolver,
  ensureBrowserLocalPersistence,
  formatFirebaseAuthError,
  testConnection,
} from '../lib/firebase';
import {
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SHIPPING_SETTINGS,
  DEFAULT_WEBSITE_SETTINGS,
  SEED_BANNERS,
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
} from '../data/seedCatalog';
import {
  ensureUserProfile,
  fetchStorefrontCatalog,
  fetchUserCart,
  fetchUserNotifications,
  fetchUserWishlist,
  isBootstrappedAdminUser,
  saveUserCart,
  saveUserWishlist,
  seedInitialCatalogIfEmpty,
  subscribeToUserOrders,
} from '../services/firestoreService';
import {TRANSLATIONS} from '../lib/i18n';
import type {
  Banner,
  Brand,
  CartItem,
  Category,
  Language,
  NotificationItem,
  OrderStatus,
  PaymentSettings,
  Product,
  ShippingSettings,
  UserProfile,
  WebsiteSettings,
} from '../types/ecommerce';

export interface OrderStatusToastItem {
  id: string;
  orderId: string;
  orderNumber: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  createdAt: string;
}

interface StoreContextValue {
  user: User | null;
  profile: UserProfile | null;
  profileSynced: boolean;
  syncUserProfile: (firebaseUser: User) => Promise<UserProfile>;
  authReady: boolean;
  redirectChecked: boolean;
  redirectAuthError: string | null;
  clearRedirectAuthError: () => void;
  isAdmin: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  darkMode: boolean;
  toggleDarkMode: () => void;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  banners: Banner[];
  shippingSettings: ShippingSettings;
  paymentSettings: PaymentSettings;
  websiteSettings: WebsiteSettings;
  catalogLoadedFromDb: boolean;
  cart: CartItem[];
  wishlist: string[];
  notifications: NotificationItem[];
  toastMessage: string | null;
  showToast: (msg: string) => void;
  orderStatusToasts: OrderStatusToastItem[];
  dismissOrderStatusToast: (id: string) => void;
  addToCart: (product: Product, opts?: {variantId?: string; size?: string; color?: string; quantity?: number}) => void;
  updateCartQty: (productId: string, variantId: string | undefined, qty: number) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  refreshCatalog: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  logout: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const GUEST_CART_KEY = 'shikder_guest_cart_v1';
const GUEST_WISH_KEY = 'shikder_guest_wish_v1';
const LANG_KEY = 'shikder_lang_v1';
const THEME_KEY = 'shikder_theme_v1';
export const GOOGLE_REDIRECT_PENDING_KEY = 'shikder_google_redirect_pending';
export const AUTH_REDIRECT_PATH_KEY = 'shikder_auth_redirect';

let redirectResultPromise: Promise<UserCredential | null> | null = null;

export const StoreProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileSynced, setProfileSynced] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [redirectChecked, setRedirectChecked] = useState(false);
  const [redirectAuthError, setRedirectAuthError] = useState<string | null>(null);
  const clearRedirectAuthError = useCallback(() => setRedirectAuthError(null), []);

  const syncUserProfile = useCallback(async (firebaseUser: User): Promise<UserProfile> => {
    const prof = await ensureUserProfile(firebaseUser);
    setProfile(prof);
    setProfileSynced(true);
    return prof;
  }, []);

  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    return (localStorage.getItem(LANG_KEY) as Language) === 'bn' ? 'bn' : 'en';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(THEME_KEY) === 'dark';
  });

  const [products, setProducts] = useState<Product[]>(
    SEED_PRODUCTS.map((p) => ({...p}))
  );
  const [categories, setCategories] = useState<Category[]>(SEED_CATEGORIES);
  const [brands, setBrands] = useState<Brand[]>(SEED_BRANDS);
  const [banners, setBanners] = useState<Banner[]>(SEED_BANNERS);
  const [shippingSettings, setShippingSettings] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [websiteSettings, setWebsiteSettings] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [catalogLoadedFromDb, setCatalogLoadedFromDb] = useState(false);

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(GUEST_WISH_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [orderStatusToasts, setOrderStatusToasts] = useState<OrderStatusToastItem[]>([]);
  const orderToastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const dismissOrderStatusToast = useCallback((id: string) => {
    if (orderToastTimersRef.current[id]) {
      clearTimeout(orderToastTimersRef.current[id]);
      delete orderToastTimersRef.current[id];
    }
    setOrderStatusToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_KEY, lang);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  const t = useCallback(
    (key: string) => TRANSLATIONS[language][key] || TRANSLATIONS.en[key] || key,
    [language]
  );

  const refreshCatalog = useCallback(async () => {
    try {
      const includeAll = isBootstrappedAdminUser(auth.currentUser);
      const data = await fetchStorefrontCatalog(includeAll);
      if (data.products.length > 0) {
        setProducts(data.products);
        setCatalogLoadedFromDb(true);
      }
      if (data.categories.length > 0) setCategories(data.categories);
      if (data.brands.length > 0) setBrands(data.brands);
      if (data.banners.length > 0) setBanners(data.banners);
      setShippingSettings(data.shippingSettings);
      setPaymentSettings(data.paymentSettings);
      setWebsiteSettings(data.websiteSettings);
    } catch (err) {
      console.warn('Catalog sync warning:', err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!auth.currentUser) {
      setNotifications([]);
      return;
    }
    try {
      const list = await fetchUserNotifications(auth.currentUser.uid);
      setNotifications(list);
    } catch (err) {
      console.warn('Notifications load warning:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    testConnection();
    refreshCatalog();

    (async () => {
      try {
        await authPersistenceReady;
        await ensureBrowserLocalPersistence();
        if (!redirectResultPromise) {
          redirectResultPromise = getRedirectResult(auth, browserPopupRedirectResolver);
        }
        const result = await redirectResultPromise;
        if (cancelled) return;
        const hadPendingRedirect = Boolean(sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY));
        sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);

        if (result?.user) {
          setUser(result.user);
          await syncUserProfile(result.user).catch((profileErr) => {
            console.warn('Redirect profile save warning:', profileErr);
          });
          showToast('Signed in with Google');
        } else if (hadPendingRedirect && !auth.currentUser) {
          setRedirectAuthError(
            'Google redirect did not return a session because your browser blocked cross-site redirect storage. Please use Google sign-in below or enable site cookies.'
          );
        }
      } catch (err) {
        if (!cancelled) {
          sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
          setRedirectAuthError(formatFirebaseAuthError(err));
        }
      } finally {
        if (!cancelled) {
          setRedirectChecked(true);
        }
      }
    })();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser);
      if (firebaseUser) {
        setRedirectAuthError(null);
        try {
          await syncUserProfile(firebaseUser);
          if (cancelled) return;
          if (isBootstrappedAdminUser(firebaseUser)) {
            await seedInitialCatalogIfEmpty(firebaseUser);
            await refreshCatalog();
          }
          const [dbCart, dbWish, dbNotifs] = await Promise.all([
            fetchUserCart(firebaseUser.uid).catch(() => []),
            fetchUserWishlist(firebaseUser.uid).catch(() => []),
            fetchUserNotifications(firebaseUser.uid).catch(() => []),
          ]);
          let guestCart: CartItem[] = [];
          try {
            guestCart = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
          } catch {
            guestCart = [];
          }
          if (guestCart.length > 0) {
            const merged = [...dbCart];
            for (const item of guestCart) {
              const existing = merged.find((m) => m.productId === item.productId && m.variantId === item.variantId);
              if (existing) existing.quantity += item.quantity;
              else merged.push(item);
            }
            setCart(merged);
            await saveUserCart(firebaseUser.uid, merged).catch(() => {});
            localStorage.removeItem(GUEST_CART_KEY);
          } else {
            setCart(dbCart);
          }
          setWishlist(dbWish);
          setNotifications(dbNotifs);
        } catch (err) {
          console.error('Auth hydration error:', err);
        }
      } else {
        setProfile(null);
        setProfileSynced(false);
        setNotifications([]);
        refreshCatalog();
      }
      if (!cancelled) {
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [refreshCatalog, showToast, syncUserProfile]);

  // Real-time order status watcher: notifies signed-in user whenever an order transitions status
  useEffect(() => {
    if (!authReady || !user) {
      setOrderStatusToasts([]);
      return;
    }

    let initialized = false;
    const statusByOrderId = new Map<string, OrderStatus>();

    const unsub = subscribeToUserOrders(
      user.uid,
      (orders) => {
        if (!initialized) {
          orders.forEach((o) => {
            statusByOrderId.set(o.id, o.orderStatus);
          });
          initialized = true;
          return;
        }

        const changed: OrderStatusToastItem[] = [];
        for (const o of orders) {
          const prevStatus = statusByOrderId.get(o.id);
          if (prevStatus && prevStatus !== o.orderStatus) {
            changed.push({
              id: `${o.id}-${o.orderStatus}-${Date.now()}`,
              orderId: o.id,
              orderNumber: o.orderNumber,
              previousStatus: prevStatus,
              newStatus: o.orderStatus,
              createdAt: new Date().toISOString(),
            });
          }
          statusByOrderId.set(o.id, o.orderStatus);
        }

        if (changed.length > 0) {
          setOrderStatusToasts((prev) => [...changed, ...prev].slice(0, 3));
          for (const item of changed) {
            orderToastTimersRef.current[item.id] = setTimeout(() => {
              dismissOrderStatusToast(item.id);
            }, 8500);
          }
          refreshNotifications();
        }
      },
      (err) => {
        console.warn('Order status listener warning:', err);
      }
    );

    return () => {
      unsub();
      Object.values(orderToastTimersRef.current).forEach((timer) => clearTimeout(timer));
      orderToastTimersRef.current = {};
    };
  }, [authReady, user, dismissOrderStatusToast, refreshNotifications]);

  const persistCart = useCallback(
    (next: CartItem[]) => {
      setCart(next);
      if (auth.currentUser) {
        saveUserCart(auth.currentUser.uid, next).catch(() => {});
      } else {
        localStorage.setItem(GUEST_CART_KEY, JSON.stringify(next));
      }
    },
    []
  );

  const addToCart = useCallback(
    (product: Product, opts?: {variantId?: string; size?: string; color?: string; quantity?: number}) => {
      const qty = opts?.quantity ?? 1;
      if (product.stockQuantity <= 0) {
        showToast(`${product.name} is currently out of stock`);
        return;
      }
      const next = [...cart];
      const variantId = opts?.variantId || product.variants?.[0]?.id;
      const existing = next.find((item) => item.productId === product.id && item.variantId === variantId);
      if (existing) {
        existing.quantity = Math.min(product.stockQuantity, existing.quantity + qty);
      } else {
        next.push({
          productId: product.id,
          variantId,
          size: opts?.size || product.variants?.[0]?.size,
          color: opts?.color || product.variants?.[0]?.color,
          quantity: Math.min(product.stockQuantity, qty),
          addedAt: new Date().toISOString(),
        });
      }
      persistCart(next);
      showToast(`Added ${product.name} to cart`);
    },
    [cart, persistCart, showToast]
  );

  const updateCartQty = useCallback(
    (productId: string, variantId: string | undefined, qty: number) => {
      if (qty <= 0) {
        persistCart(cart.filter((i) => !(i.productId === productId && i.variantId === variantId)));
        return;
      }
      const prod = products.find((p) => p.id === productId);
      const maxStock = prod?.stockQuantity ?? 99;
      persistCart(
        cart.map((i) =>
          i.productId === productId && i.variantId === variantId
            ? {...i, quantity: Math.min(maxStock, qty)}
            : i
        )
      );
    },
    [cart, persistCart, products]
  );

  const removeFromCart = useCallback(
    (productId: string, variantId?: string) => {
      persistCart(cart.filter((i) => !(i.productId === productId && i.variantId === variantId)));
    },
    [cart, persistCart]
  );

  const clearCart = useCallback(() => {
    persistCart([]);
  }, [persistCart]);

  const toggleWishlist = useCallback(
    (productId: string) => {
      const exists = wishlist.includes(productId);
      const next = exists ? wishlist.filter((id) => id !== productId) : [...wishlist, productId];
      setWishlist(next);
      if (auth.currentUser) {
        saveUserWishlist(auth.currentUser.uid, next).catch(() => {});
      } else {
        localStorage.setItem(GUEST_WISH_KEY, JSON.stringify(next));
      }
      showToast(exists ? 'Removed from wishlist' : 'Saved to wishlist');
    },
    [wishlist, showToast]
  );

  const logout = useCallback(async () => {
    sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    sessionStorage.removeItem(AUTH_REDIRECT_PATH_KEY);
    await signOut(auth);
    setProfile(null);
    setProfileSynced(false);
    setCart([]);
    setWishlist([]);
    setNotifications([]);
    showToast('Signed out');
  }, [showToast]);

  const isAdmin = useMemo(() => {
    return isBootstrappedAdminUser(user) || profile?.role === 'admin';
  }, [user, profile?.role]);

  const value = useMemo<StoreContextValue>(
    () => ({
      user,
      profile,
      profileSynced,
      syncUserProfile,
      authReady,
      redirectChecked,
      redirectAuthError,
      clearRedirectAuthError,
      isAdmin,
      language,
      setLanguage,
      t,
      darkMode,
      toggleDarkMode,
      products,
      categories,
      brands,
      banners,
      shippingSettings,
      paymentSettings,
      websiteSettings,
      catalogLoadedFromDb,
      cart,
      wishlist,
      notifications,
      toastMessage,
      showToast,
      orderStatusToasts,
      dismissOrderStatusToast,
      addToCart,
      updateCartQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      refreshCatalog,
      refreshNotifications,
      logout,
    }),
    [
      user,
      profile,
      profileSynced,
      syncUserProfile,
      authReady,
      redirectChecked,
      redirectAuthError,
      clearRedirectAuthError,
      isAdmin,
      language,
      setLanguage,
      t,
      darkMode,
      toggleDarkMode,
      products,
      categories,
      brands,
      banners,
      shippingSettings,
      paymentSettings,
      websiteSettings,
      catalogLoadedFromDb,
      cart,
      wishlist,
      notifications,
      toastMessage,
      showToast,
      orderStatusToasts,
      dismissOrderStatusToast,
      addToCart,
      updateCartQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      refreshCatalog,
      refreshNotifications,
      logout,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
