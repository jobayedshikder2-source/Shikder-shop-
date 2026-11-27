import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {Package, Search, X} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {fetchCustomerOrders} from '../services/firestoreService';
import {formatBDT, formatDhakaDateTime} from '../lib/bd-locations';
import type {Order} from '../types/ecommerce';
import {OrderTracker} from '../components/OrderTracker';

export const OrdersPage: React.FC = () => {
  const {user, authReady} = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupInput, setLookupInput] = useState('');
  const [trackedOrderId, setTrackedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchCustomerOrders(user.uid)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authReady, user]);

  if (!user && authReady) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <Package className="w-10 h-10 text-light-primary dark:text-dark-primary" />
        <h1 className="font-headline text-2xl font-bold">Track Your Orders</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Sign in with Google to view your order history, live Firestore tracking updates, and return requests.
        </p>
        <Link to="/login?redirect=/orders" className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
          Sign In with Google
        </Link>
      </div>
    );
  }

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = lookupInput.trim();
    setTrackedOrderId(cleaned || null);
  };

  const filtered = orders.filter((o) =>
    !lookupInput.trim()
      ? true
      : o.orderNumber.toLowerCase().includes(lookupInput.trim().toLowerCase()) ||
        o.id.toLowerCase().includes(lookupInput.trim().toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl md:text-3xl font-bold">My Orders & Live Tracking</h1>
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Enter an Order ID or select an order to pull real-time status updates from Firestore.
          </p>
        </div>

        <form onSubmit={handleTrackSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-light-outline" />
            <input
              type="search"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Order ID (e.g. ORD-2026-...)"
              className="rounded-full pl-9 pr-4 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold whitespace-nowrap"
          >
            Track Live
          </button>
        </form>
      </div>

      {/* Live Order Tracker Panel when an Order ID is selected or searched */}
      {trackedOrderId && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Tracking ID: <span className="font-mono">{trackedOrderId}</span>
            </span>
            <button
              type="button"
              onClick={() => setTrackedOrderId(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-light-on-surface-variant hover:text-light-error"
            >
              <X className="w-3.5 h-3.5" /> Close Tracker
            </button>
          </div>
          <OrderTracker orderId={trackedOrderId} showSummaryLink />
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm">Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-10 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">No orders found yet.</p>
          <Link to="/products" className="px-5 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((order) => (
            <article key={order.id} className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold">{order.orderNumber}</span>
                  <span className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    · {formatDhakaDateTime(order.createdAt)}
                  </span>
                </div>
                <span className="px-3 py-1 rounded-full bg-light-primary/10 dark:bg-dark-primary/15 text-light-primary dark:text-dark-primary text-xs font-semibold">
                  {order.orderStatus}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'items'} · {order.paymentMethod.toUpperCase()} ({order.paymentStatus})
                </span>
                <span className="font-headline text-lg font-bold text-light-primary dark:text-dark-primary tabular-nums">
                  {formatBDT(order.totalAmount)}
                </span>
              </div>

              <div className="pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Ship to: {order.customerInfo.district}, {order.customerInfo.division}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackedOrderId(order.id)}
                    className="px-4 py-1.5 rounded-full border border-light-primary dark:border-dark-primary text-light-primary dark:text-dark-primary text-xs font-semibold"
                  >
                    Live Status
                  </button>
                  <Link
                    to={`/orders/${order.id}`}
                    className="px-4 py-1.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
                  >
                    Track & Details
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
