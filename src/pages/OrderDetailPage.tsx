import React, {useCallback, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {ArrowLeft} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {cancelCustomerOrder, requestCustomerReturn} from '../services/firestoreService';
import {formatBDT} from '../lib/bd-locations';
import type {Order} from '../types/ecommerce';
import {ImageWithFallback} from '../components/ImageWithFallback';
import {OrderTracker} from '../components/OrderTracker';
import {OrderProgressTracker} from '../components/OrderProgressTracker';

export const OrderDetailPage: React.FC = () => {
  const {orderId = ''} = useParams<{orderId: string}>();
  const {showToast} = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnBox, setShowReturnBox] = useState(false);

  const handleOrderUpdate = useCallback((nextOrder: Order | null) => {
    setOrder(nextOrder);
  }, []);

  const handleCancel = async () => {
    if (!order) return;
    try {
      await cancelCustomerOrder(order);
      showToast('Order cancelled');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not cancel order');
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (returnReason.trim().length < 5) {
      showToast('Please explain the return reason (min 5 characters)');
      return;
    }
    try {
      await requestCustomerReturn(order, returnReason.trim());
      setShowReturnBox(false);
      showToast('Return request submitted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit return request');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-light-primary dark:text-dark-primary">
          <ArrowLeft className="w-4 h-4" /> My Orders
        </Link>
        {order && <span className="font-mono text-sm font-bold">{order.orderNumber}</span>}
      </div>

      {/* Visual 3-Stage Order Progress Tracker (Pending -> Shipped -> Delivered) */}
      {order && <OrderProgressTracker order={order} />}

      {/* Live Firestore Order Tracking */}
      <OrderTracker orderId={orderId} onOrderUpdate={handleOrderUpdate} hideSteps />

      {order && (
        <>
          {/* Customer Actions */}
          {(['Pending', 'Confirmed'].includes(order.orderStatus) || order.orderStatus === 'Delivered') && (
            <section className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {['Pending', 'Confirmed'].includes(order.orderStatus) && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 rounded-full border border-light-error text-light-error text-xs font-semibold"
                  >
                    Request Cancellation
                  </button>
                )}
                {order.orderStatus === 'Delivered' && (
                  <button
                    type="button"
                    onClick={() => setShowReturnBox((s) => !s)}
                    className="px-4 py-2 rounded-full border border-light-primary text-light-primary dark:text-dark-primary text-xs font-semibold"
                  >
                    Request Return / Refund
                  </button>
                )}
              </div>

              {showReturnBox && (
                <form onSubmit={handleReturn} className="flex flex-col gap-2 pt-2">
                  <textarea
                    rows={2}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Describe why you want to return or refund this order..."
                    className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
                  />
                  <button type="submit" className="self-start px-5 py-2 rounded-full bg-light-primary text-light-on-primary text-xs font-semibold">
                    Submit Return Request
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Immutable Order Items Snapshot */}
          <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
            <h2 className="font-headline text-base font-bold">Items Snapshot</h2>
            <div className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {order.items.map((item, i) => (
                <div key={i} className="py-3 flex items-center gap-3">
                  <ImageWithFallback src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      {item.variantLabel} · Qty {item.quantity} × {formatBDT(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-semibold text-sm tabular-nums">{formatBDT(item.lineTotal)}</span>
                </div>
              ))}
            </div>
            <dl className="pt-3 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatBDT(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Discount</dt><dd className="text-success tabular-nums">-{formatBDT(order.discountAmount)}</dd></div>
              <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{formatBDT(order.deliveryCharge)}</dd></div>
              <div className="flex justify-between font-bold text-base pt-1">
                <dt>Total (Cash on Delivery)</dt>
                <dd className="text-light-primary dark:text-dark-primary tabular-nums">{formatBDT(order.totalAmount)}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
};
