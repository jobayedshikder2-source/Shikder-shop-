import React, {useEffect, useMemo, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {z} from 'zod';
import {useStore} from '../context/StoreContext';
import {BD_DIVISIONS, formatBDT, normalizeBdPhone} from '../lib/bd-locations';
import {checkoutSchema} from '../lib/validators';
import {
  createTransactionalOrder,
  validateCouponOnFirestore,
  verifySavedOrderById,
} from '../services/firestoreService';
import type {Order, OrderVerificationStatus} from '../types/ecommerce';

type CheckoutForm = z.infer<typeof checkoutSchema>;

export const CheckoutPage: React.FC = () => {
  const {user, profile, cart, products, shippingSettings, catalogLoadedFromDb, clearCart, showToast} = useStore();
  const [searchParams] = useSearchParams();

  const [couponCode, setCouponCode] = useState(searchParams.get('coupon') || '');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );

  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<OrderVerificationStatus | null>(null);
  const [verificationIssueKind, setVerificationIssueKind] = useState<
    'ok' | 'network_error' | 'verification_error' | null
  >(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: {errors},
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      fullName: profile?.name || user?.displayName || '',
      phone: profile?.phone || '',
      email: profile?.email || user?.email || '',
      division: profile?.division || 'Dhaka',
      district: profile?.district || 'Dhaka',
      upazila: profile?.upazila || 'Banani',
      area: profile?.area || '',
      fullAddress: profile?.fullAddress || '',
      instructions: '',
      paymentMethod: 'cod',
    },
  });

  useEffect(() => {
    if (profile) {
      if (profile.name) setValue('fullName', profile.name);
      if (profile.email) setValue('email', profile.email);
      if (profile.phone) setValue('phone', profile.phone);
      if (profile.division) setValue('division', profile.division);
      if (profile.district) setValue('district', profile.district);
      if (profile.upazila) setValue('upazila', profile.upazila);
      if (profile.area) setValue('area', profile.area);
      if (profile.fullAddress) setValue('fullAddress', profile.fullAddress);
    }
  }, [profile, setValue]);

  const selectedDivision = watch('division');
  const selectedDistrict = watch('district');

  const divisionObj = useMemo(
    () => BD_DIVISIONS.find((d) => d.name === selectedDivision) || BD_DIVISIONS[0],
    [selectedDivision]
  );

  const enrichedItems = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) return null;
        const unitPrice =
          product.discountedPrice && product.discountedPrice > 0 && product.discountedPrice < product.regularPrice
            ? product.discountedPrice
            : product.regularPrice;
        return {...item, product, unitPrice, lineTotal: unitPrice * item.quantity};
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, products]);

  const subtotal = enrichedItems.reduce((sum, i) => sum + i.lineTotal, 0);

  useEffect(() => {
    if (couponCode.trim() && subtotal > 0) {
      validateCouponOnFirestore(couponCode, subtotal).then((res) => {
        setDiscountAmount(res.valid ? res.discount : 0);
      });
    }
  }, [couponCode, subtotal]);

  const isInsideDhaka = selectedDivision === 'Dhaka' && selectedDistrict === 'Dhaka';
  const deliveryCharge =
    enrichedItems.length === 0
      ? 0
      : isInsideDhaka
      ? subtotal >= shippingSettings.freeDhakaThreshold
        ? 0
        : shippingSettings.dhakaFee
      : shippingSettings.outsideDhakaFee;
  const totalPayable = Math.max(0, subtotal - discountAmount + deliveryCharge);

  const runOrderVerification = async (order: Order) => {
    if (!user) return;
    setVerifying(true);
    setVerificationStatus('Verification Pending');
    setVerificationMessage('Confirming saved order record in Firestore and running server verification...');
    try {
      const idToken = await user.getIdToken().catch(() => undefined);
      const res = await verifySavedOrderById({
        uid: user.uid,
        orderId: order.id,
        idToken,
      });
      setVerificationStatus(res.status);
      setVerificationIssueKind(res.kind);
      setVerificationMessage(res.message);
      if (res.order) {
        setCreatedOrder(res.order);
      }
      if (res.status === 'Verified') {
        showToast(`Order ${order.orderNumber} verified!`);
      }
    } finally {
      setVerifying(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <Lock className="w-10 h-10 text-light-primary dark:text-dark-primary" />
        <h1 className="font-headline text-2xl font-bold">Sign in to Complete Checkout</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Your cart items are preserved. Sign in so you can track delivery, receive push alerts, and manage returns.
        </p>
        <Link
          to="/login?redirect=/checkout"
          className="px-6 py-3 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
        >
          Sign In with Google
        </Link>
      </div>
    );
  }

  if (createdOrder) {
    const activeStatus: OrderVerificationStatus = verificationStatus || createdOrder.verificationStatus || 'Order Created';
    const isVerified = activeStatus === 'Verified';
    const isFailed = activeStatus === 'Verification Failed';
    const isNetworkIssue = verificationIssueKind === 'network_error';

    return (
      <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
        <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 md:p-8 flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-8 h-8 text-success shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-success">
                Order Created
              </span>
              <h1 className="font-headline text-2xl font-bold">
                Thank you! Order {createdOrder.orderNumber} is saved.
              </h1>
              <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant font-mono">
                Document ID: {createdOrder.id} · Total COD: {formatBDT(createdOrder.totalAmount)}
              </p>
            </div>
          </div>

          {/* Explicit Verification Status Panel */}
          <div
            role="status"
            className={`rounded-xl border p-4 flex flex-col gap-3 ${
              isVerified
                ? 'border-success/40 bg-success/10 text-light-on-surface dark:text-dark-on-surface'
                : isFailed
                ? 'border-light-error/50 bg-light-error-container text-light-on-error-container'
                : 'border-light-primary/30 bg-light-surface-container-low dark:bg-dark-surface-container'
            }`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 font-semibold text-sm">
                {verifying ? (
                  <Loader2 className="w-4 h-4 animate-spin text-light-primary dark:text-dark-primary" />
                ) : isVerified ? (
                  <ShieldCheck className="w-4 h-4 text-success" />
                ) : isFailed ? (
                  <ShieldAlert className="w-4 h-4 text-light-error" />
                ) : isNetworkIssue ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Clock className="w-4 h-4 text-light-primary dark:text-dark-primary" />
                )}
                <span>Verification Status: {activeStatus}</span>
              </div>

              {!isVerified && (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => runOrderVerification(createdOrder)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                  {verifying ? 'Verifying...' : 'Retry Verification'}
                </button>
              )}
            </div>

            {verificationMessage && (
              <p className="text-xs leading-relaxed opacity-90">{verificationMessage}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div className="rounded-lg bg-light-surface-container-lowest/80 dark:bg-dark-surface-container-low px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                <span className="font-medium">Order Created</span>
              </div>
              <div className="rounded-lg bg-light-surface-container-lowest/80 dark:bg-dark-surface-container-low px-3 py-2 flex items-center gap-2">
                {activeStatus === 'Verification Pending' ? (
                  <Clock className="w-3.5 h-3.5 text-light-primary shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                )}
                <span className="font-medium">Verification Pending</span>
              </div>
              <div className="rounded-lg bg-light-surface-container-lowest/80 dark:bg-dark-surface-container-low px-3 py-2 flex items-center gap-2">
                {isVerified ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                    <span className="font-medium">Verified</span>
                  </>
                ) : isFailed ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-light-error shrink-0" />
                    <span className="font-medium">Verification Failed</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-light-outline shrink-0" />
                    <span className="font-medium text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      Awaiting Verified
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-light-outline-variant dark:border-dark-outline-variant p-4 text-xs flex flex-col gap-1.5">
            <p className="font-semibold text-sm">Delivery Confirmation</p>
            <p>
              {createdOrder.customerInfo.fullName} ·{' '}
              <span className="font-mono">{createdOrder.customerInfo.phone}</span>
            </p>
            <p className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {createdOrder.customerInfo.fullAddress}, {createdOrder.customerInfo.upazila},{' '}
              {createdOrder.customerInfo.district}, {createdOrder.customerInfo.division}
            </p>
            <p className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Items: {createdOrder.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={`/orders/${createdOrder.id}`}
              className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
            >
              View Order Details &amp; Tracking
            </Link>
            <Link
              to="/products"
              className="px-5 py-2.5 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-sm font-semibold"
            >
              Continue Shopping
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (enrichedItems.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <h1 className="font-headline text-2xl font-bold">No items in cart</h1>
        <Link to="/products" className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
          Return to Shop
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: CheckoutForm) => {
    setErrorMsg(null);
    if (!catalogLoadedFromDb) {
      setErrorMsg('Live Firestore catalog must be initialized by an admin before placing transactional orders.');
      return;
    }
    setSubmitting(true);
    let savedOrder: Order | null = null;
    try {
      const {order, alreadyExisted} = await createTransactionalOrder({
        uid: user.uid,
        idempotencyKey,
        customerInfo: {
          ...data,
          phone: normalizeBdPhone(data.phone),
        },
        cartItems: cart,
        couponCode: couponCode.trim() || undefined,
        paymentMethod: data.paymentMethod,
      });
      savedOrder = order;
      setCreatedOrder(order);
      setVerificationStatus('Order Created');
      setVerificationIssueKind(null);
      setVerificationMessage(
        alreadyExisted
          ? 'Existing order recovered for this checkout ID. Running verification...'
          : 'Order created in Firestore. Verifying saved order details...'
      );
      clearCart();
      showToast(`Order ${order.orderNumber} created`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create order in Firestore';
      if (msg.includes('Order ID belongs')) {
        setIdempotencyKey(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }

    if (savedOrder) {
      await runOrderVerification(savedOrder);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        <h1 className="font-headline text-2xl md:text-3xl font-bold">Secure Bangladesh Checkout</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Transactional inventory reservation · Server-verified pricing · No duplicate orders
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Delivery Information */}
          <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-light-primary dark:text-dark-primary" />
              <h2 className="font-headline text-lg font-bold">Delivery Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-semibold">Full Name</span>
                <input
                  {...register('fullName')}
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                {errors.fullName && <span className="text-xs text-light-error">{errors.fullName.message}</span>}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">Bangladesh Mobile Number</span>
                <input
                  {...register('phone')}
                  placeholder="+880 17XX-XXXXXX"
                  className="rounded-lg px-3.5 py-2 text-sm font-mono bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                {errors.phone && <span className="text-xs text-light-error">{errors.phone.message}</span>}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">Email Address</span>
                <input
                  type="email"
                  {...register('email')}
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                {errors.email && <span className="text-xs text-light-error">{errors.email.message}</span>}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">Division</span>
                <select
                  {...register('division')}
                  onChange={(e) => {
                    setValue('division', e.target.value);
                    const div = BD_DIVISIONS.find((d) => d.name === e.target.value);
                    if (div?.districts[0]) {
                      setValue('district', div.districts[0].name);
                      setValue('upazila', div.districts[0].upazilas[0] || '');
                    }
                  }}
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                >
                  {BD_DIVISIONS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name} ({d.nameBn})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">District</span>
                <select
                  {...register('district')}
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                >
                  {divisionObj.districts.map((dist) => (
                    <option key={dist.name} value={dist.name}>
                      {dist.name} ({dist.nameBn})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">Upazila / Thana</span>
                <input
                  {...register('upazila')}
                  placeholder="e.g. Banani / Panchlaish"
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                {errors.upazila && <span className="text-xs text-light-error">{errors.upazila.message}</span>}
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold">Area / Sector</span>
                <input
                  {...register('area')}
                  placeholder="e.g. Block F, Road 11"
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                {errors.area && <span className="text-xs text-light-error">{errors.area.message}</span>}
              </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-semibold">Full Street & House Address</span>
                <textarea
                  rows={2}
                  {...register('fullAddress')}
                  placeholder="House, Road, Flat/Floor details"
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
                {errors.fullAddress && <span className="text-xs text-light-error">{errors.fullAddress.message}</span>}
              </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-semibold">Delivery Instructions (Optional)</span>
                <input
                  {...register('instructions')}
                  placeholder="Call upon arrival at main gate"
                  className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
              </label>
            </div>
          </section>

          {/* Payment Method — Cash on Delivery Only */}
          <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-light-primary dark:text-dark-primary" />
              <h2 className="font-headline text-lg font-bold">Payment Method</h2>
            </div>

            <label className="rounded-xl border-2 border-light-primary dark:border-dark-primary bg-light-primary/5 p-4 flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-3">
                <input type="radio" value="cod" checked readOnly {...register('paymentMethod')} />
                <div>
                  <p className="text-sm font-semibold">Cash on Delivery (COD)</p>
                  <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Only Cash on Delivery is available. Pay in BDT cash upon parcel inspection across all 64 districts.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-success inline-flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Available
              </span>
            </label>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-5 rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4">
          <h2 className="font-headline text-lg font-bold">Order Summary ({enrichedItems.length} items)</h2>

          <div className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant max-h-60 overflow-y-auto">
            {enrichedItems.map((item) => (
              <div key={`${item.productId}-${item.variantId || 'std'}`} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    Qty {item.quantity} × {formatBDT(item.unitPrice)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums shrink-0">{formatBDT(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Coupon code (optional)"
              className="flex-1 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
            />
          </div>

          <dl className="flex flex-col gap-2 text-sm pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant">
            <div className="flex justify-between">
              <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">Items Subtotal</dt>
              <dd className="font-semibold tabular-nums">{formatBDT(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">Discount</dt>
              <dd className="font-semibold text-success tabular-nums">-{formatBDT(discountAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Delivery ({isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka'})
              </dt>
              <dd className="font-semibold tabular-nums">{deliveryCharge === 0 ? 'FREE' : formatBDT(deliveryCharge)}</dd>
            </div>
            <div className="pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant flex justify-between items-baseline">
              <dt className="font-title text-base font-bold">Total Payable</dt>
              <dd className="font-headline text-2xl font-extrabold text-light-primary dark:text-dark-primary tabular-nums">
                {formatBDT(totalPayable)}
              </dd>
            </div>
          </dl>

          {errorMsg && (
            <div role="alert" className="rounded-lg bg-light-error-container text-light-on-error-container p-3 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? 'Confirming Inventory & Placing Order...' : `Place Order · ${formatBDT(totalPayable)}`}
          </button>

          <div className="flex items-center gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <ShieldCheck className="w-4 h-4 text-success shrink-0" />
            <span>Protected by Firestore transactional stock locks & duplicate-order guard.</span>
          </div>
        </aside>
      </form>
    </div>
  );
};
