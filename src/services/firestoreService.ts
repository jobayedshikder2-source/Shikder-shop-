import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import type {User} from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from '../lib/firebase';
import {
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SHIPPING_SETTINGS,
  DEFAULT_WEBSITE_SETTINGS,
  SEED_BANNERS,
  SEED_BRANDS,
  SEED_CATEGORIES,
  SEED_COUPONS,
  SEED_PRODUCTS,
} from '../data/seedCatalog';
import type {
  AdminLog,
  Banner,
  Brand,
  CartItem,
  Category,
  Coupon,
  CustomerShippingInfo,
  NotificationItem,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  PaymentMethod,
  PaymentSettings,
  PaymentStatus,
  Product,
  RefundRecord,
  ReturnRequest,
  Review,
  ShippingSettings,
  UserProfile,
  WebsiteSettings,
} from '../types/ecommerce';

export function isBootstrappedAdminUser(user: User | null): boolean {
  return Boolean(user && user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified);
}

function toEpochMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'toMillis' in value && typeof (value as {toMillis: () => number}).toMillis === 'function') {
    return (value as {toMillis: () => number}).toMillis();
  }
  if (typeof value === 'object' && 'seconds' in value && typeof (value as {seconds: number}).seconds === 'number') {
    return (value as {seconds: number}).seconds * 1000;
  }
  return 0;
}

function sortByCreatedAtDesc<T extends {createdAt?: unknown}>(items: T[]): T[] {
  return [...items].sort((a, b) => toEpochMs(b.createdAt) - toEpochMs(a.createdAt));
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const isBootstrapAdmin = isBootstrappedAdminUser(user);

    if (isBootstrapAdmin) {
      const adminRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email: (user.email || BOOTSTRAPPED_ADMIN_EMAIL).trim().slice(0, 200),
          role: 'admin',
          createdAt: serverTimestamp(),
        });
      }
    }

    if (!snap.exists()) {
      const safeName = (user.displayName || user.email?.split('@')[0] || 'Customer').trim().slice(0, 120) || 'Customer';
      const safeEmail = (user.email || 'user@shikdershop.bd').trim().slice(0, 200);
      const safePhoto = (user.photoURL || '').trim().slice(0, 500);
      const newProfile: Record<string, unknown> = {
        uid: user.uid,
        name: safeName,
        email: safeEmail,
        role: isBootstrapAdmin ? 'admin' : 'customer',
        photoURL: safePhoto,
        pushEnabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
      const welcomeRef = doc(db, 'notifications', `welcome-${user.uid}`);
      const welcomeSnap = await getDoc(welcomeRef).catch(() => null);
      if (!welcomeSnap?.exists()) {
        await setDoc(welcomeRef, {
          userId: user.uid,
          targetRole: 'customer',
          title: 'Welcome to SHIKDER SHOP',
          body: 'Enjoy Cash on Delivery across 64 districts and use SHIKDER250 for ৳250 off.',
          type: 'welcome',
          isRead: false,
          link: '/products',
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
      return {
        uid: user.uid,
        name: safeName,
        email: safeEmail,
        role: isBootstrapAdmin ? 'admin' : 'customer',
        photoURL: safePhoto,
        pushEnabled: false,
      };
    }

    const data = snap.data() as UserProfile;
    let role = data.role;
    if (!isBootstrapAdmin && role !== 'admin') {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
      if (adminSnap?.exists()) role = 'admin';
    } else if (isBootstrapAdmin) {
      role = 'admin';
    }
    return {...data, uid: user.uid, role};
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCustomerProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'name' | 'email' | 'phone' | 'photoURL' | 'division' | 'district' | 'upazila' | 'area' | 'fullAddress' | 'pushEnabled' | 'fcmToken'>>
) {
  const path = `users/${uid}`;
  try {
    const cleanUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name.trim().slice(0, 120) || 'Customer';
    if (updates.email !== undefined) cleanUpdates.email = updates.email.trim().slice(0, 200);
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim().slice(0, 20);
    if (updates.photoURL !== undefined) cleanUpdates.photoURL = updates.photoURL.trim().slice(0, 500);
    if (updates.division !== undefined) cleanUpdates.division = updates.division.trim().slice(0, 60);
    if (updates.district !== undefined) cleanUpdates.district = updates.district.trim().slice(0, 60);
    if (updates.upazila !== undefined) cleanUpdates.upazila = updates.upazila.trim().slice(0, 80);
    if (updates.area !== undefined) cleanUpdates.area = updates.area.trim().slice(0, 100);
    if (updates.fullAddress !== undefined) cleanUpdates.fullAddress = updates.fullAddress.trim().slice(0, 300);
    if (updates.pushEnabled !== undefined) cleanUpdates.pushEnabled = Boolean(updates.pushEnabled);
    if (updates.fcmToken !== undefined) cleanUpdates.fcmToken = updates.fcmToken.trim().slice(0, 500);

    await updateDoc(doc(db, 'users', uid), {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedInitialCatalogIfEmpty(user: User): Promise<boolean> {
  if (!isBootstrappedAdminUser(user)) return false;
  try {
    const existingProducts = await getDocs(query(collection(db, 'products'), limit(1)));
    if (!existingProducts.empty) return false;

    const batch = writeBatch(db);
    for (const cat of SEED_CATEGORIES) {
      batch.set(doc(db, 'categories', cat.id), {
        name: cat.name,
        nameBn: cat.nameBn || '',
        slug: cat.slug,
        icon: cat.icon || 'tag',
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      });
    }
    for (const brand of SEED_BRANDS) {
      batch.set(doc(db, 'brands', brand.id), {
        name: brand.name,
        slug: brand.slug,
        isActive: brand.isActive,
      });
    }
    for (const prod of SEED_PRODUCTS) {
      const {id, ...rest} = prod;
      batch.set(doc(db, 'products', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const banner of SEED_BANNERS) {
      const {id, ...rest} = banner;
      batch.set(doc(db, 'banners', id), rest);
    }
    for (const coupon of SEED_COUPONS) {
      const {id, ...rest} = coupon;
      batch.set(doc(db, 'coupons', id), rest);
    }
    batch.set(doc(db, 'settings', 'shipping'), {
      key: 'shipping',
      data: DEFAULT_SHIPPING_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'settings', 'payments'), {
      key: 'payments',
      data: DEFAULT_PAYMENT_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'settings', 'website'), {
      key: 'website',
      data: DEFAULT_WEBSITE_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'admin_logs', `init-${Date.now()}`), {
      adminUid: user.uid,
      adminEmail: user.email || '',
      action: 'CATALOG_INITIALIZED',
      targetCollection: 'products',
      targetId: 'seed-batch',
      summary: 'Initialized starter Bangladesh catalog, categories, brands, coupons, and settings.',
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products');
  }
}

export async function fetchStorefrontCatalog(includeInactive = false) {
  try {
    const prodQuery = includeInactive
      ? query(collection(db, 'products'))
      : query(collection(db, 'products'), where('isActive', '==', true));
    const catQuery = includeInactive
      ? query(collection(db, 'categories'))
      : query(collection(db, 'categories'), where('isActive', '==', true));
    const brandQuery = includeInactive
      ? query(collection(db, 'brands'))
      : query(collection(db, 'brands'), where('isActive', '==', true));
    const bannerQuery = includeInactive
      ? query(collection(db, 'banners'))
      : query(collection(db, 'banners'), where('isActive', '==', true));

    const [prodSnap, catSnap, brandSnap, bannerSnap, shipSnap, paySnap, webSnap] = await Promise.all([
      getDocs(prodQuery),
      getDocs(catQuery),
      getDocs(brandQuery),
      getDocs(bannerQuery),
      getDoc(doc(db, 'settings', 'shipping')).catch(() => null),
      getDoc(doc(db, 'settings', 'payments')).catch(() => null),
      getDoc(doc(db, 'settings', 'website')).catch(() => null),
    ]);

    const products = sortByCreatedAtDesc(
      prodSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Product, 'id'>)}))
    );
    const categories = catSnap.docs
      .map((d) => ({id: d.id, ...(d.data() as Omit<Category, 'id'>)}))
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    const brands = brandSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Brand, 'id'>)}));
    const banners = bannerSnap.docs
      .map((d) => ({id: d.id, ...(d.data() as Omit<Banner, 'id'>)}))
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    const shippingSettings: ShippingSettings = shipSnap?.exists()
      ? (shipSnap.data().data as ShippingSettings)
      : DEFAULT_SHIPPING_SETTINGS;
    const paymentSettings: PaymentSettings = paySnap?.exists()
      ? (paySnap.data().data as PaymentSettings)
      : DEFAULT_PAYMENT_SETTINGS;
    const websiteSettings: WebsiteSettings = webSnap?.exists()
      ? (webSnap.data().data as WebsiteSettings)
      : DEFAULT_WEBSITE_SETTINGS;

    return {
      products,
      categories,
      brands,
      banners,
      shippingSettings,
      paymentSettings,
      websiteSettings,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'products');
  }
}

export async function fetchUserCart(uid: string): Promise<CartItem[]> {
  try {
    const snap = await getDoc(doc(db, 'carts', uid));
    if (!snap.exists()) return [];
    return (snap.data().items as CartItem[]) || [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `carts/${uid}`);
  }
}

export async function saveUserCart(uid: string, items: CartItem[]) {
  try {
    await setDoc(doc(db, 'carts', uid), {
      uid,
      items: items.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `carts/${uid}`);
  }
}

export async function fetchUserWishlist(uid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, 'wishlists', uid));
    if (!snap.exists()) return [];
    return (snap.data().productIds as string[]) || [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `wishlists/${uid}`);
  }
}

export async function saveUserWishlist(uid: string, productIds: string[]) {
  try {
    await setDoc(doc(db, 'wishlists', uid), {
      uid,
      productIds: productIds.slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `wishlists/${uid}`);
  }
}

export async function validateCouponOnFirestore(code: string, subtotal: number): Promise<{valid: boolean; discount: number; message: string; coupon?: Coupon}> {
  const normalized = code.trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9_-]+$/.test(normalized)) {
    return {valid: false, discount: 0, message: 'Enter a valid coupon code'};
  }
  try {
    const snap = await getDoc(doc(db, 'coupons', normalized));
    if (!snap.exists()) {
      return {valid: false, discount: 0, message: 'Coupon code not found'};
    }
    const coupon = {id: snap.id, ...(snap.data() as Omit<Coupon, 'id'>)};
    if (!coupon.isActive) {
      return {valid: false, discount: 0, message: 'This coupon is currently inactive'};
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return {valid: false, discount: 0, message: 'This coupon has expired'};
    }
    if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return {valid: false, discount: 0, message: 'Coupon usage limit reached'};
    }
    if (subtotal < coupon.minPurchase) {
      return {valid: false, discount: 0, message: `Minimum order of ৳${coupon.minPurchase.toLocaleString('en-US')} required`};
    }
    let discount = coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
    discount = Math.min(discount, subtotal);
    return {valid: true, discount, message: `${normalized} applied (-৳${discount.toLocaleString('en-US')})`, coupon};
  } catch {
    return {valid: false, discount: 0, message: 'Invalid or unavailable coupon code'};
  }
}

export async function placeTransactionalOrder(params: {
  uid: string;
  idempotencyKey: string;
  customerInfo: CustomerShippingInfo;
  cartItems: CartItem[];
  couponCode?: string;
  paymentMethod: PaymentMethod;
  idToken?: string;
}): Promise<Order> {
  const {uid, idempotencyKey, customerInfo, cartItems, couponCode, paymentMethod, idToken} = params;
  if (!cartItems.length) {
    throw new Error('Your cart is empty');
  }

  // Server-side validation call (verifies payload shape, BD phone, rate limit, payment availability)
  const verifyRes = await fetch('/api/checkout/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? {Authorization: `Bearer ${idToken}`} : {}),
    },
    body: JSON.stringify({
      idempotencyKey,
      customerInfo,
      items: cartItems,
      couponCode: couponCode || '',
      paymentMethod,
    }),
  });
  if (!verifyRes.ok) {
    const errBody = await verifyRes.json().catch(() => ({}));
    throw new Error(errBody.error || 'Checkout verification failed');
  }

  const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderRef = doc(db, 'orders', idempotencyKey);

  try {
    const result = await runTransaction(db, async (tx) => {
      const existingOrderSnap = await tx.get(orderRef);
      if (existingOrderSnap.exists()) {
        throw new Error('Duplicate order submission detected. This order was already placed.');
      }

      const shipSnap = await tx.get(doc(db, 'settings', 'shipping'));
      const shipCfg: ShippingSettings = shipSnap.exists()
        ? (shipSnap.data().data as ShippingSettings)
        : DEFAULT_SHIPPING_SETTINGS;

      const uniqueProductIds = Array.from(new Set(cartItems.map((item) => item.productId)));
      const productSnaps = await Promise.all(
        uniqueProductIds.map((pid) => tx.get(doc(db, 'products', pid)))
      );
      const productMap = new Map<string, Product>();
      for (const snap of productSnaps) {
        if (snap.exists()) {
          productMap.set(snap.id, snap.data() as Product);
        }
      }

      const normalizedCode = couponCode?.trim().toUpperCase() || '';
      const couponRef = normalizedCode ? doc(db, 'coupons', normalizedCode) : null;
      const couponSnap = couponRef ? await tx.get(couponRef) : null;

      // Aggregate quantities per productId so multi-variant lines never collide
      const totalQtyByProduct = new Map<string, number>();
      for (const cartItem of cartItems) {
        totalQtyByProduct.set(
          cartItem.productId,
          (totalQtyByProduct.get(cartItem.productId) || 0) + cartItem.quantity
        );
      }

      const stockUpdates: {ref: ReturnType<typeof doc>; newStock: number; newSold: number}[] = [];
      for (const [productId, totalQty] of totalQtyByProduct.entries()) {
        const prod = productMap.get(productId);
        if (!prod) {
          throw new Error(`Product ${productId} is no longer available.`);
        }
        if (!prod.isActive) {
          throw new Error(`${prod.name} is currently unavailable.`);
        }
        if (prod.stockQuantity < totalQty) {
          throw new Error(`Insufficient stock for ${prod.name}. Only ${prod.stockQuantity} remaining.`);
        }
        stockUpdates.push({
          ref: doc(db, 'products', productId),
          newStock: prod.stockQuantity - totalQty,
          newSold: (prod.soldCount || 0) + totalQty,
        });
      }

      let subtotal = 0;
      const snapshots: OrderItemSnapshot[] = [];
      for (const cartItem of cartItems) {
        const prod = productMap.get(cartItem.productId)!;
        const unitPrice =
          prod.discountedPrice && prod.discountedPrice > 0 && prod.discountedPrice < prod.regularPrice
            ? prod.discountedPrice
            : prod.regularPrice;
        const lineTotal = unitPrice * cartItem.quantity;
        subtotal += lineTotal;

        const variantParts = [cartItem.color, cartItem.size].filter(Boolean);
        snapshots.push({
          productId: cartItem.productId,
          name: prod.name,
          slug: prod.slug,
          image: prod.images?.[0] || '',
          sku: prod.sku,
          variantLabel: variantParts.length ? variantParts.join(' · ') : 'Standard',
          unitPrice,
          quantity: cartItem.quantity,
          lineTotal,
        });
      }

      let discountAmount = 0;
      let couponRefToUpdate: ReturnType<typeof doc> | null = null;
      let nextUsedCount = 0;

      if (couponRef && couponSnap?.exists()) {
        const coupon = couponSnap.data() as Coupon;
        const notExpired = !coupon.expiresAt || new Date(coupon.expiresAt).getTime() >= Date.now();
        const underLimit = !coupon.usageLimit || coupon.usageLimit === 0 || (coupon.usedCount || 0) < coupon.usageLimit;
        if (coupon.isActive && notExpired && underLimit && subtotal >= coupon.minPurchase) {
          let calc = coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
          if (coupon.maxDiscount && coupon.maxDiscount > 0) calc = Math.min(calc, coupon.maxDiscount);
          discountAmount = Math.min(calc, subtotal);
          couponRefToUpdate = couponRef;
          nextUsedCount = (coupon.usedCount || 0) + 1;
        }
      }

      const isDhaka = customerInfo.division.toLowerCase() === 'dhaka' && customerInfo.district.toLowerCase() === 'dhaka';
      let deliveryCharge = isDhaka ? shipCfg.dhakaFee : shipCfg.outsideDhakaFee;
      if (isDhaka && shipCfg.freeDhakaThreshold > 0 && subtotal >= shipCfg.freeDhakaThreshold) {
        deliveryCharge = 0;
      }

      // Guarantee totalAmount > 0 AND totalAmount == (subtotal - discountAmount + deliveryCharge)
      const maxAllowedDiscount = deliveryCharge > 0 ? subtotal : Math.max(0, subtotal - 1);
      discountAmount = Math.min(discountAmount, maxAllowedDiscount);
      const totalAmount = subtotal - discountAmount + deliveryCharge;

      const safeCustomerInfo: CustomerShippingInfo = {
        fullName: customerInfo.fullName.trim().slice(0, 120),
        phone: customerInfo.phone.trim().slice(0, 20),
        email: customerInfo.email.trim().slice(0, 200),
        division: customerInfo.division.trim().slice(0, 60),
        district: customerInfo.district.trim().slice(0, 60),
        upazila: customerInfo.upazila.trim().slice(0, 80),
        area: customerInfo.area.trim().slice(0, 100),
        fullAddress: customerInfo.fullAddress.trim().slice(0, 300),
        instructions: (customerInfo.instructions || '').trim().slice(0, 240),
      };

      const nowIso = new Date().toISOString();
      const timeline = [
        {
          status: 'Pending',
          note: `Order placed via ${paymentMethod.toUpperCase()}`,
          timestamp: nowIso,
          actor: safeCustomerInfo.fullName,
        },
      ];

      for (const upd of stockUpdates) {
        tx.update(upd.ref, {
          stockQuantity: upd.newStock,
          soldCount: upd.newSold,
          updatedAt: serverTimestamp(),
        });
      }

      if (couponRefToUpdate) {
        tx.update(couponRefToUpdate, {usedCount: nextUsedCount});
      }

      const orderDocData = {
        orderNumber,
        idempotencyKey,
        userId: uid,
        customerInfo: safeCustomerInfo,
        items: snapshots,
        subtotal,
        discountAmount,
        couponCode: normalizedCode.slice(0, 40),
        deliveryCharge,
        totalAmount,
        paymentMethod,
        paymentStatus: 'unpaid' as PaymentStatus,
        orderStatus: 'Pending' as OrderStatus,
        trackingCode: '',
        timeline,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      tx.set(orderRef, orderDocData);
      tx.set(doc(db, 'notifications', `ord-${idempotencyKey}`), {
        userId: uid,
        targetRole: 'customer',
        title: `Order ${orderNumber} Confirmed`.slice(0, 140),
        body: `Your order of ৳${totalAmount.toLocaleString('en-US')} is pending dispatch.`.slice(0, 500),
        type: 'order',
        isRead: false,
        link: `/orders/${idempotencyKey}`.slice(0, 200),
        createdAt: serverTimestamp(),
      });
      tx.set(doc(db, 'carts', uid), {
        uid,
        items: [],
        updatedAt: serverTimestamp(),
      });

      return {
        id: idempotencyKey,
        ...orderDocData,
        createdAt: nowIso,
        updatedAt: nowIso,
      } as Order;
    });

    return result;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Insufficient stock') ||
        error.message.includes('Duplicate order') ||
        error.message.includes('unavailable'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `orders/${idempotencyKey}`);
  }
}

export async function fetchCustomerOrders(uid: string): Promise<Order[]> {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', uid));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(
      snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Order, 'id'>)}))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function fetchOrderById(orderId: string): Promise<Order | null> {
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (!snap.exists()) return null;
    return {id: snap.id, ...(snap.data() as Omit<Order, 'id'>)};
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `orders/${orderId}`);
  }
}

export function subscribeToOrder(
  orderId: string,
  onData: (order: Order | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const cleanId = orderId.trim();
  if (!cleanId || !/^[a-zA-Z0-9_-]{1,128}$/.test(cleanId)) {
    onData(null);
    return () => {};
  }
  const path = `orders/${cleanId}`;
  return onSnapshot(
    doc(db, 'orders', cleanId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData({id: snap.id, ...(snap.data() as Omit<Order, 'id'>)});
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToOrderLookup(params: {
  uid: string;
  isAdminUser: boolean;
  lookupId: string;
  onData: (order: Order | null) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  const clean = params.lookupId.trim();
  if (!clean || !/^[a-zA-Z0-9_-]{2,128}$/.test(clean)) {
    params.onData(null);
    return () => {};
  }

  // Admin direct document ID lookup works across all customer orders
  if (params.isAdminUser && !clean.toUpperCase().startsWith('ORD-')) {
    return subscribeToOrder(clean, params.onData, params.onError);
  }

  const ordersQ = params.isAdminUser
    ? query(collection(db, 'orders'), limit(100))
    : query(collection(db, 'orders'), where('userId', '==', params.uid), limit(100));

  return onSnapshot(
    ordersQ,
    (snap) => {
      const upper = clean.toUpperCase();
      const match = snap.docs.find((d) => {
        const data = d.data() as Omit<Order, 'id'>;
        return d.id === clean || (data.orderNumber && data.orderNumber.toUpperCase() === upper);
      });
      if (!match) {
        params.onData(null);
        return;
      }
      params.onData({id: match.id, ...(match.data() as Omit<Order, 'id'>)});
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      } catch (wrapped) {
        params.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function cancelCustomerOrder(order: Order) {
  try {
    const nextTimeline = [
      ...(order.timeline || []),
      {
        status: 'Cancelled',
        note: 'Cancelled by customer prior to dispatch',
        timestamp: new Date().toISOString(),
        actor: 'Customer',
      },
    ].slice(-30);
    await updateDoc(doc(db, 'orders', order.id), {
      orderStatus: 'Cancelled',
      timeline: nextTimeline,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function requestCustomerReturn(order: Order, reason: string) {
  try {
    const batch = writeBatch(db);
    const returnId = `ret-${order.id}`;
    const safeReason = reason.trim().slice(0, 500);
    batch.set(doc(db, 'returns', returnId), {
      orderId: order.id,
      orderNumber: order.orderNumber.slice(0, 40),
      userId: order.userId,
      reason: safeReason,
      status: 'requested',
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', order.id), {
      orderStatus: 'Return Requested',
      timeline: [
        ...(order.timeline || []),
        {
          status: 'Return Requested',
          note: safeReason,
          timestamp: new Date().toISOString(),
          actor: 'Customer',
        },
      ].slice(-30),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `returns/ret-${order.id}`);
  }
}

export async function fetchProductReviews(productId: string, uid?: string): Promise<Review[]> {
  try {
    const approvedQ = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      where('isApproved', '==', true)
    );
    const approvedSnap = await getDocs(approvedQ);
    const reviews = approvedSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Review, 'id'>)}));

    if (uid) {
      const ownQ = query(collection(db, 'reviews'), where('userId', '==', uid));
      const ownSnap = await getDocs(ownQ);
      ownSnap.docs.forEach((d) => {
        const data = d.data() as Omit<Review, 'id'>;
        if (data.productId === productId && !reviews.some((r) => r.id === d.id)) {
          reviews.push({id: d.id, ...data});
        }
      });
    }
    return sortByCreatedAtDesc(reviews);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'reviews');
  }
}

export async function submitProductReview(productId: string, user: User, rating: number, comment: string, isAdminUser: boolean) {
  const reviewId = `rev-${Date.now()}-${user.uid.slice(0, 6)}`;
  try {
    await setDoc(doc(db, 'reviews', reviewId), {
      productId,
      userId: user.uid,
      userName: (user.displayName || user.email?.split('@')[0] || 'Verified Shopper').trim().slice(0, 100) || 'Verified Shopper',
      rating,
      comment: comment.trim().slice(0, 1000),
      isApproved: isAdminUser,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reviews/${reviewId}`);
  }
}

export async function fetchUserNotifications(uid: string): Promise<NotificationItem[]> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(100));
    const snap = await getDocs(q);
    return sortByCreatedAtDesc(
      snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>)}))
    ).slice(0, 40);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'notifications');
  }
}

export async function markNotificationRead(id: string) {
  try {
    await updateDoc(doc(db, 'notifications', id), {isRead: true});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

export async function subscribeToNewsletter(email: string) {
  const normalized = email.trim().toLowerCase();
  const id = normalized.replace(/[^a-z0-9]/g, '_').slice(0, 100);
  try {
    await setDoc(doc(db, 'newsletter_subscribers', id), {
      email: normalized,
      isActive: true,
      subscribedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `newsletter_subscribers/${id}`);
  }
}

// =========================================================================
// ADMIN DASHBOARD OPERATIONS
// =========================================================================
async function logAdminAction(user: User, action: string, targetCollection: string, targetId: string, summary: string) {
  const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db, 'admin_logs', logId), {
    adminUid: user.uid,
    adminEmail: user.email || '',
    action,
    targetCollection,
    targetId,
    summary,
    createdAt: serverTimestamp(),
  });
}

export async function fetchAdminWorkspaceData() {
  try {
    const [ordersSnap, usersSnap, couponsSnap, reviewsSnap, returnsSnap, refundsSnap, logsSnap, notifSnap] = await Promise.all([
      getDocs(query(collection(db, 'orders'), limit(100))),
      getDocs(query(collection(db, 'users'), limit(100))),
      getDocs(collection(db, 'coupons')),
      getDocs(query(collection(db, 'reviews'), limit(100))),
      getDocs(query(collection(db, 'returns'), limit(50))),
      getDocs(query(collection(db, 'refunds'), limit(50))),
      getDocs(query(collection(db, 'admin_logs'), limit(60))),
      getDocs(query(collection(db, 'notifications'), limit(50))),
    ]);

    return {
      orders: sortByCreatedAtDesc(ordersSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Order, 'id'>)}))),
      customers: usersSnap.docs.map((d) => ({...(d.data() as UserProfile), uid: d.id})),
      coupons: couponsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Coupon, 'id'>)})),
      reviews: sortByCreatedAtDesc(reviewsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Review, 'id'>)}))),
      returns: sortByCreatedAtDesc(returnsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<ReturnRequest, 'id'>)}))),
      refunds: sortByCreatedAtDesc(refundsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<RefundRecord, 'id'>)}))),
      logs: sortByCreatedAtDesc(logsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdminLog, 'id'>)}))),
      notifications: sortByCreatedAtDesc(notifSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>)}))),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function saveAdminProduct(user: User, id: string | null, data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
  const productId = id || `prod-${data.slug.slice(0, 40)}-${Date.now().toString(36)}`;
  const {id: _ignoredId, createdAt: _ignoredCreated, updatedAt: _ignoredUpdated, ...cleanData} = data as Product;
  try {
    const prodRef = doc(db, 'products', productId);
    const existingSnap = id ? await getDoc(prodRef).catch(() => null) : null;
    if (id && existingSnap?.exists()) {
      await updateDoc(prodRef, {
        ...cleanData,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(user, 'UPDATE_PRODUCT', 'products', productId, `Updated ${cleanData.name}`);
    } else {
      await setDoc(prodRef, {
        ...cleanData,
        ratingAvg: cleanData.ratingAvg ?? 5,
        ratingCount: cleanData.ratingCount ?? 0,
        soldCount: cleanData.soldCount ?? 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(user, 'CREATE_PRODUCT', 'products', productId, `Created ${cleanData.name}`);
    }
    return productId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `products/${productId}`);
  }
}

export async function deleteAdminProduct(user: User, productId: string, name: string) {
  try {
    await deleteDoc(doc(db, 'products', productId));
    await logAdminAction(user, 'DELETE_PRODUCT', 'products', productId, `Deleted ${name}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
  }
}

export async function saveAdminCategory(user: User, id: string | null, data: Omit<Category, 'id'>) {
  const catId = id || `cat-${data.slug.slice(0, 40)}`;
  try {
    await setDoc(doc(db, 'categories', catId), data);
    await logAdminAction(user, id ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY', 'categories', catId, data.name);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${catId}`);
  }
}

export async function deleteAdminCategory(user: User, catId: string) {
  try {
    await deleteDoc(doc(db, 'categories', catId));
    await logAdminAction(user, 'DELETE_CATEGORY', 'categories', catId, `Deleted category ${catId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${catId}`);
  }
}

export async function saveAdminBrand(user: User, id: string | null, data: Omit<Brand, 'id'>) {
  const brandId = id || `brand-${data.slug.slice(0, 40)}`;
  try {
    await setDoc(doc(db, 'brands', brandId), data);
    await logAdminAction(user, id ? 'UPDATE_BRAND' : 'CREATE_BRAND', 'brands', brandId, data.name);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `brands/${brandId}`);
  }
}

export async function deleteAdminBrand(user: User, brandId: string) {
  try {
    await deleteDoc(doc(db, 'brands', brandId));
    await logAdminAction(user, 'DELETE_BRAND', 'brands', brandId, `Deleted brand ${brandId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `brands/${brandId}`);
  }
}

export async function updateAdminOrder(
  user: User,
  order: Order,
  updates: {orderStatus: OrderStatus; paymentStatus: PaymentStatus; trackingCode: string}
) {
  try {
    const timeline = [...(order.timeline || [])];
    if (updates.orderStatus !== order.orderStatus) {
      timeline.push({
        status: updates.orderStatus,
        note: updates.trackingCode ? `Tracking: ${updates.trackingCode}` : `Updated to ${updates.orderStatus}`,
        timestamp: new Date().toISOString(),
        actor: user.email || 'Admin',
      });
    }
    await updateDoc(doc(db, 'orders', order.id), {
      orderStatus: updates.orderStatus,
      paymentStatus: updates.paymentStatus,
      trackingCode: updates.trackingCode.trim().slice(0, 80),
      timeline: timeline.slice(-30),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notifications', `ord-upd-${order.id}-${Date.now()}`), {
      userId: order.userId,
      targetRole: 'customer',
      title: `Order ${order.orderNumber}: ${updates.orderStatus}`.slice(0, 140),
      body: (updates.trackingCode
        ? `Tracking reference ${updates.trackingCode} added.`
        : `Your order status is now ${updates.orderStatus}.`).slice(0, 500),
      type: 'order_update',
      isRead: false,
      link: `/orders/${order.id}`.slice(0, 200),
      createdAt: serverTimestamp(),
    });
    await logAdminAction(
      user,
      'UPDATE_ORDER',
      'orders',
      order.id,
      `${order.orderNumber} -> ${updates.orderStatus} (${updates.paymentStatus})`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }
}

export async function saveAdminCoupon(user: User, coupon: Omit<Coupon, 'id'>) {
  const {id: _ignoredId, ...cleanCoupon} = coupon as Coupon;
  const code = cleanCoupon.code.trim().toUpperCase();
  try {
    await setDoc(doc(db, 'coupons', code), {
      ...cleanCoupon,
      code,
      usedCount: typeof cleanCoupon.usedCount === 'number' ? cleanCoupon.usedCount : 0,
    });
    await logAdminAction(user, 'SAVE_COUPON', 'coupons', code, `Coupon ${code} (${cleanCoupon.type}: ${cleanCoupon.value})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `coupons/${code}`);
  }
}

export async function deleteAdminCoupon(user: User, code: string) {
  try {
    await deleteDoc(doc(db, 'coupons', code));
    await logAdminAction(user, 'DELETE_COUPON', 'coupons', code, `Deleted coupon ${code}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `coupons/${code}`);
  }
}

export async function saveAdminBanner(user: User, id: string | null, banner: Omit<Banner, 'id'>) {
  const bannerId = id || `banner-${Date.now().toString(36)}`;
  try {
    await setDoc(doc(db, 'banners', bannerId), banner);
    await logAdminAction(user, id ? 'UPDATE_BANNER' : 'CREATE_BANNER', 'banners', bannerId, banner.title);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `banners/${bannerId}`);
  }
}

export async function deleteAdminBanner(user: User, bannerId: string) {
  try {
    await deleteDoc(doc(db, 'banners', bannerId));
    await logAdminAction(user, 'DELETE_BANNER', 'banners', bannerId, `Deleted banner ${bannerId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `banners/${bannerId}`);
  }
}

export async function moderateReviewAdmin(user: User, reviewId: string, isApproved: boolean) {
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {isApproved});
    await logAdminAction(user, 'MODERATE_REVIEW', 'reviews', reviewId, isApproved ? 'Approved review' : 'Hidden review');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reviews/${reviewId}`);
  }
}

export async function processReturnAndRefundAdmin(
  user: User,
  ret: ReturnRequest,
  status: 'approved' | 'rejected' | 'completed',
  refundAmount?: number
) {
  try {
    await updateDoc(doc(db, 'returns', ret.id), {status});
    if (status === 'approved' && refundAmount && refundAmount > 0) {
      const refundId = `ref-${ret.id}`;
      await setDoc(doc(db, 'refunds', refundId), {
        orderId: ret.orderId,
        returnId: ret.id,
        userId: ret.userId,
        amount: refundAmount,
        method: 'Bank / Mobile Wallet',
        status: 'processed',
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'orders', ret.orderId), {
        orderStatus: 'Refunded',
        paymentStatus: 'refunded',
        updatedAt: serverTimestamp(),
      });
    }
    await logAdminAction(user, 'PROCESS_RETURN', 'returns', ret.id, `Return ${ret.orderNumber} -> ${status}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `returns/${ret.id}`);
  }
}

export async function sendAdminNotification(user: User, targetUserId: string, title: string, body: string) {
  const notifId = `adm-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const safeTitle = title.trim().slice(0, 140);
  const safeBody = body.trim().slice(0, 500);
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      userId: targetUserId,
      targetRole: 'customer',
      title: safeTitle,
      body: safeBody,
      type: 'promo',
      isRead: false,
      link: '/products',
      createdAt: serverTimestamp(),
    });
    await logAdminAction(user, 'SEND_NOTIFICATION', 'notifications', notifId, `${safeTitle} -> ${targetUserId}`.slice(0, 300));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${notifId}`);
  }
}

export async function saveAdminSetting(
  user: User,
  key: 'shipping' | 'payments' | 'website',
  data: ShippingSettings | PaymentSettings | WebsiteSettings
) {
  try {
    await setDoc(doc(db, 'settings', key), {
      key,
      data,
      updatedAt: serverTimestamp(),
    });
    await logAdminAction(user, 'UPDATE_SETTINGS', 'settings', key, `Updated ${key} configuration`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `settings/${key}`);
  }
}

export async function uploadProductImage(file: File, folder = 'products/uploads'): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be smaller than 5MB.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `${folder}/${Date.now()}-${safeName}`);
  const snap = await uploadBytes(storageRef, file, {contentType: file.type});
  return getDownloadURL(snap.ref);
}
