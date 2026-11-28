import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, Bell, CheckCircle2, PackageCheck, RotateCcw, Truck, X, XCircle} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import type {OrderStatus} from '../types/ecommerce';

function renderStatusIcon(status: OrderStatus) {
  if (status === 'Delivered') {
    return <PackageCheck className="w-5 h-5 text-success shrink-0" aria-hidden="true" />;
  }
  if (status === 'Shipped' || status === 'Out for Delivery') {
    return <Truck className="w-5 h-5 text-light-primary dark:text-dark-primary shrink-0" aria-hidden="true" />;
  }
  if (status === 'Confirmed' || status === 'Processing' || status === 'Packed') {
    return <CheckCircle2 className="w-5 h-5 text-light-primary dark:text-dark-primary shrink-0" aria-hidden="true" />;
  }
  if (status === 'Cancelled') {
    return <XCircle className="w-5 h-5 text-light-error shrink-0" aria-hidden="true" />;
  }
  if (status === 'Return Requested' || status === 'Returned' || status === 'Refunded') {
    return <RotateCcw className="w-5 h-5 text-light-secondary dark:text-dark-secondary shrink-0" aria-hidden="true" />;
  }
  return <Bell className="w-5 h-5 text-light-primary dark:text-dark-primary shrink-0" aria-hidden="true" />;
}

export const OrderStatusToast: React.FC = () => {
  const {orderStatusToasts, dismissOrderStatusToast} = useStore();

  if (orderStatusToasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Order status updates"
      className="flex flex-col gap-2.5 w-full max-w-sm pointer-events-auto"
    >
      {orderStatusToasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-high border border-light-outline-variant dark:border-dark-outline-variant shadow-lg p-4 flex items-start gap-3"
        >
          <div className="mt-0.5">{renderStatusIcon(toast.newStatus)}</div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="text-xs font-bold text-light-on-surface dark:text-dark-on-surface">
              Order Status Updated
            </p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed">
              Order <span className="font-mono font-semibold text-light-on-surface dark:text-dark-on-surface">{toast.orderNumber}</span>{' '}
              moved from <span className="font-semibold">{toast.previousStatus}</span> to{' '}
              <span className="font-semibold text-light-primary dark:text-dark-primary">{toast.newStatus}</span>.
            </p>
            <div className="pt-1">
              <Link
                to={`/orders/${toast.orderId}`}
                onClick={() => dismissOrderStatusToast(toast.id)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-light-primary dark:text-dark-primary hover:underline"
              >
                <span>View Order Details</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissOrderStatusToast(toast.id)}
            aria-label={`Dismiss notification for ${toast.orderNumber}`}
            className="p-1 rounded-lg text-light-outline dark:text-dark-outline hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
