import React, {useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ArrowRight, Minus, Plus, ShoppingBag, Trash2, Truck} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatBDT} from '../lib/bd-locations';
import {validateCouponOnFirestore} from '../services/firestoreService';
import {ImageWithFallback} from '../components/ImageWithFallback';

export const CartPage: React.FC = () => {
  const {cart, products, updateCartQty, removeFromCart, shippingSettings, t} = useStore();
  const navigate = useNavigate();

  const [zone, setZone] = useState<'dhaka' | 'outside'>('dhaka');
  const [couponInput, setCouponInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ok: boolean; msg: string} | null>(null);

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
  const deliveryFee =
    enrichedItems.length === 0
      ? 0
      : zone === 'dhaka'
      ? subtotal >= shippingSettings.freeDhakaThreshold
        ? 0
        : shippingSettings.dhakaFee
      : shippingSettings.outsideDhakaFee;
  const finalTotal = Math.max(0, subtotal - appliedDiscount + deliveryFee);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await validateCouponOnFirestore(couponInput, subtotal);
    setCouponFeedback({ok: res.valid, msg: res.message});
    if (res.valid) {
      setAppliedDiscount(res.discount);
      setAppliedCode(couponInput.trim().toUpperCase());
    } else {
      setAppliedDiscount(0);
      setAppliedCode('');
    }
  };

  if (enrichedItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <span className="w-16 h-16 rounded-full bg-light-surface-container dark:bg-dark-surface-container flex items-center justify-center text-light-primary dark:text-dark-primary">
          <ShoppingBag className="w-8 h-8" />
        </span>
        <h1 className="font-headline text-2xl font-bold">Your shopping cart is empty</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Discover authentic tech, heritage fashion, and essentials delivered across Bangladesh.
        </p>
        <Link
          to="/products"
          className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div>
        <h1 className="font-headline text-2xl md:text-3xl font-bold">Shopping Cart</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          {enrichedItems.reduce((s, i) => s + i.quantity, 0)} items · Final prices and stock verified at checkout
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-3.5 flex items-center gap-2.5 text-sm">
            <Truck className="w-5 h-5 text-success shrink-0" />
            <span>
              {subtotal >= shippingSettings.freeDhakaThreshold
                ? 'Your order qualifies for FREE Inside Dhaka delivery.'
                : `Add ${formatBDT(shippingSettings.freeDhakaThreshold - subtotal)} more for FREE Inside Dhaka delivery.`}
            </span>
          </div>

          {enrichedItems.map((item) => (
            <article
              key={`${item.productId}-${item.variantId || 'std'}`}
              className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-4 flex gap-4"
            >
              <Link to={`/products/${item.product.slug}`} className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-light-surface-container">
                <ImageWithFallback src={item.product.images?.[0]} alt={item.product.name} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/products/${item.product.slug}`} className="font-title font-semibold text-base hover:underline truncate block">
                      {item.product.name}
                    </Link>
                    <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      {[item.color, item.size].filter(Boolean).join(' · ') || 'Standard'} · {item.product.stockQuantity} in stock
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.product.name}`}
                    onClick={() => removeFromCart(item.productId, item.variantId)}
                    className="p-1.5 rounded-lg text-light-outline hover:text-light-error dark:hover:text-dark-error"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="font-title text-lg font-bold text-light-primary dark:text-dark-primary tabular-nums">
                    {formatBDT(item.lineTotal)}
                  </span>
                  <div className="inline-flex items-center rounded-full border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => updateCartQty(item.productId, item.variantId, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateCartQty(item.productId, item.variantId, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Summary & Coupon */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
            <h2 className="font-title text-base font-semibold">Apply Coupon</h2>
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="SHIKDER250"
                aria-label="Coupon code"
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-mono uppercase bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold whitespace-nowrap"
              >
                Apply
              </button>
            </form>
            {couponFeedback && (
              <p className={`text-xs font-semibold ${couponFeedback.ok ? 'text-success' : 'text-light-error dark:text-dark-error'}`}>
                {couponFeedback.msg}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4">
            <h2 className="font-headline text-lg font-bold">{t('orderSummary')}</h2>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setZone('dhaka')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                  zone === 'dhaka'
                    ? 'border-light-primary dark:border-dark-primary bg-light-primary/10 text-light-primary dark:text-dark-primary'
                    : 'border-light-outline-variant dark:border-dark-outline-variant'
                }`}
              >
                {t('insideDhaka')} ({formatBDT(shippingSettings.dhakaFee)})
              </button>
              <button
                type="button"
                onClick={() => setZone('outside')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                  zone === 'outside'
                    ? 'border-light-primary dark:border-dark-primary bg-light-primary/10 text-light-primary dark:text-dark-primary'
                    : 'border-light-outline-variant dark:border-dark-outline-variant'
                }`}
              >
                {t('outsideDhaka')} ({formatBDT(shippingSettings.outsideDhakaFee)})
              </button>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">{t('subtotal')}</dt>
                <dd className="font-semibold tabular-nums">{formatBDT(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">{t('discount')}</dt>
                <dd className="font-semibold text-success tabular-nums">-{formatBDT(appliedDiscount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">{t('deliveryCharge')}</dt>
                <dd className="font-semibold tabular-nums">{deliveryFee === 0 ? 'FREE' : formatBDT(deliveryFee)}</dd>
              </div>
              <div className="pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant flex justify-between items-baseline">
                <dt className="font-title text-base font-bold">{t('total')}</dt>
                <dd className="font-headline text-2xl font-extrabold text-light-primary dark:text-dark-primary tabular-nums">
                  {formatBDT(finalTotal)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => navigate(`/checkout${appliedCode ? `?coupon=${encodeURIComponent(appliedCode)}` : ''}`)}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
            >
              <span>{t('proceedToCheckout')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
