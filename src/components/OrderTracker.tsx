import React, {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  PackageCheck,
  Radio,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatBDT, formatDhakaDateTime} from '../lib/bd-locations';
import {subscribeToOrderLookup} from '../services/firestoreService';
import type {Order, OrderStatus} from '../types/ecommerce';

const FULFILLMENT_STEPS: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

const EXCEPTION_STATUSES: OrderStatus[] = ['Cancelled', 'Return Requested', 'Returned', 'Refunded'];

interface OrderTrackerProps {
  orderId: string;
  onOrderUpdate?: (order: Order | null) => void;
  showSummaryLink?: boolean;
  hideSteps?: boolean;
}

export const OrderTracker: React.FC<OrderTrackerProps> = ({
  orderId,
  onOrderUpdate,
  showSummaryLink = false,
  hideSteps = false,
}) => {
  const {user, authReady, isAdmin} = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const onOrderUpdateRef = useRef(onOrderUpdate);
  onOrderUpdateRef.current = onOrderUpdate;

  useEffect(() => {
    setErrorMsg(null);
    if (!authReady) {
      setLoading(true);
      return;
    }
    if (!user || !orderId.trim()) {
      setOrder(null);
      onOrderUpdateRef.current?.(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToOrderLookup({
      uid: user.uid,
      isAdminUser: isAdmin,
      lookupId: orderId,
      onData: (nextOrder) => {
        setOrder(nextOrder);
        onOrderUpdateRef.current?.(nextOrder);
        setLoading(false);
      },
      onError: () => {
        setErrorMsg('Unable to stream status updates for this order ID. Verify you are signed in with the order owner account.');
        setOrder(null);
        onOrderUpdateRef.current?.(null);
        setLoading(false);
      },
    });

    return () => unsub();
  }, [authReady, user, isAdmin, orderId]);

  if (!authReady || loading) {
    return (
      <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-3 animate-pulse">
        <div className="h-5 w-48 rounded bg-light-surface-container-high dark:bg-dark-surface-container-high" />
        <div className="h-2.5 w-full rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high" />
        <div className="h-16 w-full rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 text-center flex flex-col items-center gap-3">
        <Lock className="w-8 h-8 text-light-primary dark:text-dark-primary" />
        <h2 className="font-headline text-lg font-bold">Sign in to Track Order {orderId}</h2>
        <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-sm">
          Order tracking is private to protect your Bangladesh delivery address and mobile number.
        </p>
        <Link
          to={`/login?redirect=${encodeURIComponent(`/orders/${orderId}`)}`}
          className="px-5 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
        >
          Sign In to Track Order
        </Link>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div role="alert" className="rounded-2xl bg-light-error-container text-light-on-error-container p-5 flex items-start gap-3 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Order Lookup Error</p>
          <p className="text-xs mt-0.5">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-6 text-center flex flex-col items-center gap-2">
        <Box className="w-8 h-8 text-light-outline" />
        <h2 className="font-headline text-base font-bold">No matching order found for “{orderId}”</h2>
        <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Check your Order Number (e.g. ORD-2026-123456) or select an order from My Orders.
        </p>
      </div>
    );
  }

  const stepIndex = FULFILLMENT_STEPS.indexOf(order.orderStatus);
  const isException = EXCEPTION_STATUSES.includes(order.orderStatus);
  const timelineSorted = [...(order.timeline || [])].reverse();

  return (
    <section
      aria-label={`Live order tracking for ${order.orderNumber}`}
      className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
              <Radio className="w-3.5 h-3.5" /> Live Firestore Sync
            </span>
            <span className="text-xs text-light-outline font-mono">{order.orderNumber}</span>
          </div>
          <h2 className="font-headline text-xl font-bold">
            Status: {order.orderStatus}
          </h2>
          <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Updated {formatDhakaDateTime(order.updatedAt || order.createdAt)} · Cash on Delivery ({order.paymentStatus})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.trackingCode ? (
            <span className="px-3.5 py-1.5 rounded-lg bg-light-surface-container dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant font-mono text-xs font-semibold inline-flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-light-primary dark:text-dark-primary" />
              Courier: {order.trackingCode}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Courier tracking pending
            </span>
          )}
          {showSummaryLink && (
            <Link
              to={`/orders/${order.id}`}
              className="px-4 py-1.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
            >
              Full Order Details
            </Link>
          )}
        </div>
      </div>

      {/* Stepper or Exception Banner */}
      {!hideSteps && (isException ? (
        <div
          className={`rounded-xl p-4 flex items-center gap-3 text-sm ${
            order.orderStatus === 'Cancelled'
              ? 'bg-light-error-container text-light-on-error-container'
              : 'bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant'
          }`}
        >
          {order.orderStatus === 'Cancelled' ? (
            <XCircle className="w-5 h-5 shrink-0" />
          ) : (
            <RotateCcw className="w-5 h-5 shrink-0 text-light-secondary" />
          )}
          <div>
            <p className="font-semibold">Order {order.orderStatus}</p>
            <p className="text-xs opacity-90">
              {timelineSorted[0]?.note || 'Status updated in real time from store fulfillment.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
          {FULFILLMENT_STEPS.map((step, idx) => {
            const completed = stepIndex >= 0 && idx <= stepIndex;
            const current = idx === stepIndex;
            return (
              <div
                key={step}
                className={`rounded-xl p-2.5 border flex flex-col gap-1.5 transition-colors ${
                  current
                    ? 'border-light-primary dark:border-dark-primary bg-light-primary/10 dark:bg-dark-primary/15'
                    : completed
                    ? 'border-light-primary/30 bg-light-surface-container-low dark:bg-dark-surface-container'
                    : 'border-light-outline-variant/60 dark:border-dark-outline-variant/60 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      completed
                        ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                        : 'bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-on-surface-variant'
                    }`}
                  >
                    {completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </span>
                </div>
                <span
                  className={`text-[11px] leading-tight ${
                    completed
                      ? 'font-semibold text-light-on-surface dark:text-dark-on-surface'
                      : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Destination + Live Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3 border-t border-light-outline-variant dark:border-dark-outline-variant">
        <div className="md:col-span-5 flex flex-col gap-2 text-xs">
          <p className="font-semibold text-light-on-surface dark:text-dark-on-surface flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-light-primary dark:text-dark-primary" />
            Delivery Destination
          </p>
          <p className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {order.customerInfo.fullName} · <span className="font-mono">{order.customerInfo.phone}</span>
          </p>
          <p className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {order.customerInfo.fullAddress}, {order.customerInfo.upazila}, {order.customerInfo.district},{' '}
            {order.customerInfo.division}
          </p>
          <p className="font-semibold text-light-primary dark:text-dark-primary tabular-nums pt-1">
            Total COD Payable: {formatBDT(order.totalAmount)}
          </p>
        </div>

        <div className="md:col-span-7 flex flex-col gap-2">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-light-primary dark:text-dark-primary" />
            Status History ({timelineSorted.length} updates)
          </p>
          <ul className="flex flex-col gap-2 text-xs max-h-48 overflow-y-auto pr-1">
            {timelineSorted.map((ev, idx) => (
              <li
                key={`${ev.status}-${ev.timestamp}-${idx}`}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container"
              >
                {idx === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-light-primary shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-light-on-surface dark:text-dark-on-surface">
                    {ev.status} <span className="font-normal text-light-on-surface-variant">— {ev.note}</span>
                  </p>
                  <p className="text-[11px] text-light-outline">
                    {formatDhakaDateTime(ev.timestamp)}
                    {ev.actor ? ` · ${ev.actor}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
