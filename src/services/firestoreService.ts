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
          email: user.email || BOOTSTRAPPED_ADMIN_EMAIL,
          role: 'admin',
          createdAt: serverTimestamp(),
        });
      }
    }

    if (!snap.exists()) {
      const newProfile: Record<string, unknown> = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Customer',
        email: user.email || '',
        role: isBootstrapAdmin ? 'admin' : 'customer',
        photoURL: user.photoURL || '',
        pushEnabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
      await setDoc(doc(db, 'notifications', `welcome-${user.uid}`), {
        userId: user.uid,
        targetRole: 'customer',
        title: 'Welcome to SHIKDER SHOP',
        body: 'Enjoy Cash on Delivery across 64 districts and use SHIKDER250 for ৳250 off.',
        type: 'welcome',
        isRead: false,
        link: '/products',
        createdAt: serverTimestamp(),
      });
      return {
        uid: user.uid,
        name: String(newProfile.name),
        email: String(newProfile.email),
        role: isBootstrapAdmin ? 'admin' : 'customer',
        photoURL: user.photoURL || '',
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
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
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
      ? query(collection(db, 'products'), orderBy('createdAt', 'desc'))
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

    const products = prodSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Product, 'id'>)}));
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

      const productSnaps = await Promise.all(
        cartItems.map((item) => tx.get(doc(db, 'products', item.productId)))
      );

      let subtotal = 0;
      const snapshots: OrderItemSnapshot[] = [];
      const stockUpdates: {ref: ReturnType<typeof doc>; newStock: number; newSold: number}[] = [];

      for (let i = 0; i < cartItems.length; i++) {
        const cartItem = cartItems[i];
        const snap = productSnaps[i];
        if (!snap.exists()) {
          throw new Error(`Product ${cartItem.productId} is no longer available.`);
        }
        const prod = snap.data() as Product;
        if (!prod.isActive) {
          throw new Error(`${prod.name} is currently unavailable.`);
        }
        if (prod.stockQuantity < cartItem.quantity) {
          throw new Error(`Insufficient stock for ${prod.name}. Only ${prod.stockQuantity} remaining.`);
        }
        const unitPrice = prod.discountedPrice && prod.discountedPrice > 0 ? prod.discountedPrice : prod.regularPrice;
        const lineTotal = unitPrice * cartItem.quantity;
        subtotal += lineTotal;

        const variantParts = [cartItem.color, cartItem.size].filter(Boolean);
        snapshots.push({
          productId: snap.id,
          name: prod.name,
          slug: prod.slug,
          image: prod.images?.[0] || '',
          sku: prod.sku,
          variantLabel: variantParts.length ? variantParts.join(' · ') : 'Standard',
          unitPrice,
          quantity: cartItem.quantity,
          lineTotal,
        });

        stockUpdates.push({
          ref: doc(db, 'products', snap.id),
          newStock: prod.stockQuantity - cartItem.quantity,
          newSold: (prod.soldCount || 0) + cartItem.quantity,
        });
      }

      let discountAmount = 0;
      const normalizedCode = couponCode?.trim().toUpperCase() || '';
      let couponRefToUpdate: ReturnType<typeof doc> | null = null;
      let nextUsedCount = 0;

      if (normalizedCode) {
        const couponSnap = await tx.get(doc(db, 'coupons', normalizedCode));
        if (couponSnap.exists()) {
          const coupon = couponSnap.data() as Coupon;
          const notExpired = !coupon.expiresAt || new Date(coupon.expiresAt).getTime() >= Date.now();
          const underLimit = !coupon.usageLimit || coupon.usageLimit === 0 || (coupon.usedCount || 0) < coupon.usageLimit;
          if (coupon.isActive && notExpired && underLimit && subtotal >= coupon.minPurchase) {
            let calc = coupon.type === 'percentage' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
            if (coupon.maxDiscount && coupon.maxDiscount > 0) calc = Math.min(calc, coupon.maxDiscount);
            discountAmount = Math.min(calc, subtotal);
            couponRefToUpdate = doc(db, 'coupons', normalizedCode);
            nextUsedCount = (coupon.usedCount || 0) + 1;
          }
        }
      }

      const isDhaka = customerInfo.division.toLowerCase() === 'dhaka' && customerInfo.district.toLowerCase() === 'dhaka';
      let deliveryCharge = isDhaka ? shipCfg.dhakaFee : shipCfg.outsideDhakaFee;
      if (isDhaka && shipCfg.freeDhakaThreshold > 0 && subtotal >= shipCfg.freeDhakaThreshold) {
        deliveryCharge = 0;
      }

      const totalAmount = Math.max(1, subtotal - discountAmount + deliveryCharge);
      const nowIso = new Date().toISOString();
      const timeline = [
        {
          status: 'Pending',
          note: `Order placed via ${paymentMethod.toUpperCase()}`,
          timestamp: nowIso,
          actor: customerInfo.fullName,
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
        customerInfo,
        items: snapshots,
        subtotal,
        discountAmount,
        couponCode: normalizedCode,
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
        title: `Order ${orderNumber} Confirmed`,
        body: `Your order of ৳${totalAmount.toLocaleString('en-US')} is pending dispatch.`,
        type: 'order',
        isRead: false,
        link: `/orders/${idempotencyKey}`,
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
    if (error instanceof Error && (error.message.includes('Insufficient stock') || error.message.includes('Duplicate order'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `orders/${idempotencyKey}`);
  }
}

export async function fetchCustomerOrders(uid: string): Promise<Order[]> {
  try {
    const q = query(collection(db, 'orders'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Order, 'id'>)}));
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
    ];
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
    batch.set(doc(db, 'returns', returnId), {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      reason,
      status: 'requested',
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orders', order.id), {
      orderStatus: 'Return Requested',
      timeline: [
        ...(order.timeline || []),
        {
          status: 'Return Requested',
          note: reason,
          timestamp: new Date().toISOString(),
          actor: 'Customer',
        },
      ],
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
      where('isApproved', '==', true),
      orderBy('createdAt', 'desc')
    );
    const approvedSnap = await getDocs(approvedQ);
    const reviews = approvedSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Review, 'id'>)}));

    if (uid) {
      const ownQ = query(collection(db, 'reviews'), where('userId', '==', uid));
      const ownSnap = await getDocs(ownQ);
      ownSnap.docs.forEach((d) => {
        const data = d.data() as Omit<Review, 'id'>;
        if (data.productId === productId && !reviews.some((r) => r.id === d.id)) {
          reviews.unshift({id: d.id, ...data});
        }
      });
    }
    return reviews;
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
      userName: user.displayName || user.email?.split('@')[0] || 'Verified Shopper',
      rating,
      comment,
      isApproved: isAdminUser,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reviews/${reviewId}`);
  }
}

export async function fetchUserNotifications(uid: string): Promise<NotificationItem[]> {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(40));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>)}));
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
      getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'users'), limit(100))),
      getDocs(collection(db, 'coupons')),
      getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'returns'), orderBy('createdAt', 'desc'), limit(50))),
      getDocs(query(collection(db, 'refunds'), orderBy('createdAt', 'desc'), limit(50))),
      getDocs(query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(60))),
      getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50))),
    ]);

    return {
      orders: ordersSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Order, 'id'>)})),
      customers: usersSnap.docs.map((d) => ({...(d.data() as UserProfile), uid: d.id})),
      coupons: couponsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Coupon, 'id'>)})),
      reviews: reviewsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<Review, 'id'>)})),
      returns: returnsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<ReturnRequest, 'id'>)})),
      refunds: refundsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<RefundRecord, 'id'>)})),
      logs: logsSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<AdminLog, 'id'>)})),
      notifications: notifSnap.docs.map((d) => ({id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>)})),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'orders');
  }
}

export async function saveAdminProduct(user: User, id: string | null, data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) {
  const productId = id || `prod-${data.slug.slice(0, 40)}-${Date.now().toString(36)}`;
  try {
    if (id) {
      await updateDoc(doc(db, 'products', productId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(user, 'UPDATE_PRODUCT', 'products', productId, `Updated ${data.name}`);
    } else {
      await setDoc(doc(db, 'products', productId), {
        ...data,
        ratingAvg: data.ratingAvg || 5,
        ratingCount: data.ratingCount || 0,
        soldCount: data.soldCount || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(user, 'CREATE_PRODUCT', 'products', productId, `Created ${data.name}`);
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
      trackingCode: updates.trackingCode,
      timeline,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notifications', `ord-upd-${order.id}-${Date.now()}`), {
      userId: order.userId,
      targetRole: 'customer',
      title: `Order ${order.orderNumber}: ${updates.orderStatus}`,
      body: updates.trackingCode
        ? `Tracking reference ${updates.trackingCode} added.`
        : `Your order status is now ${updates.orderStatus}.`,
      type: 'order_update',
      isRead: false,
      link: `/orders/${order.id}`,
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
  const code = coupon.code.toUpperCase();
  try {
    await setDoc(doc(db, 'coupons', code), {...coupon, code});
    await logAdminAction(user, 'SAVE_COUPON', 'coupons', code, `Coupon ${code} (${coupon.type}: ${coupon.value})`);
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
  const notifId = `adm-notif-${Date.now()}`;
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      userId: targetUserId,
      targetRole: 'customer',
      title,
      body,
      type: 'promo',
      isRead: false,
      link: '/products',
      createdAt: serverTimestamp(),
    });
    await logAdminAction(user, 'SEND_NOTIFICATION', 'notifications', notifId, `${title} -> ${targetUserId}`);
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
