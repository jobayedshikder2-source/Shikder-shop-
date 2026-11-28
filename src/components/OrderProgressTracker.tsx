import React from 'react';
import {AlertCircle, CheckCircle2, Clock, PackageCheck, RotateCcw, Truck, XCircle} from 'lucide-react';
import {formatDhakaDateTime} from '../lib/bd-locations';
import type {Order, OrderStatus} from '../types/ecommerce';

export type OrderProgressStage = 'Pending' | 'Shipped' | 'Delivered';

export const ORDER_PROGRESS_STAGES: {
  key: OrderProgressStage;
  label: string;
  description: string;
}[] = [
  {
    key: 'Pending',
    label: 'Pending',
    description: 'Order received & preparing for dispatch',
  },
  {
    key: 'Shipped',
    label: 'Shipped',
    description: 'Handed over to courier & in transit',
  },
  {
    key: 'Delivered',
    label: 'Delivered',
    description: 'Parcel delivered to recipient',
  },
];

const EXCEPTION_STATUSES: OrderStatus[] = ['Cancelled', 'Return Requested', 'Returned', 'Refunded'];

export function mapOrderStatusToProgressStage(status: OrderStatus): {
  stage: OrderProgressStage | null;
  stageIndex: number;
  isException: boolean;
} {
  if (EXCEPTION_STATUSES.includes(status)) {
    return {stage: null, stageIndex: -1, isException: true};
  }
  if (status === 'Delivered') {
    return {stage: 'Delivered', stageIndex: 2, isException: false};
  }
  if (status === 'Shipped' || status === 'Out for Delivery') {
    return {stage: 'Shipped', stageIndex: 1, isException: false};
  }
  return {stage: 'Pending', stageIndex: 0, isException: false};
}

function getStageTimestamp(order: Order, stage: OrderProgressStage): unknown {
  const timeline = order.timeline || [];
  if (stage === 'Pending') {
    const match = timeline.find((ev) =>
      ['Pending', 'Confirmed', 'Processing', 'Packed'].includes(ev.status)
    );
    return match?.timestamp || order.createdAt;
  }
  if (stage === 'Shipped') {
    const match = timeline.find((ev) => ['Shipped', 'Out for Delivery'].includes(ev.status));
    return match?.timestamp;
  }
  const match = timeline.find((ev) => ev.status === 'Delivered');
  return match?.timestamp;
}

interface OrderProgressTrackerProps {
  order: Order;
}

export const OrderProgressTracker: React.FC<OrderProgressTrackerProps> = ({order}) => {
  const {stage, stageIndex, isException} = mapOrderStatusToProgressStage(order.orderStatus);
  const railScale = stageIndex <= 0 ? 0 : stageIndex === 1 ? 0.5 : 1;

  const renderStageIcon = (key: OrderProgressStage, completed: boolean) => {
    if (completed) {
      return <CheckCircle2 className="w-5 h-5" aria-hidden="true" />;
    }
    if (key === 'Pending') return <Clock className="w-5 h-5" aria-hidden="true" />;
    if (key === 'Shipped') return <Truck className="w-5 h-5" aria-hidden="true" />;
    return <PackageCheck className="w-5 h-5" aria-hidden="true" />;
  };

  return (
    <section
      aria-label={`Order progress for ${order.orderNumber}`}
      className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-headline text-lg md:text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
            Order Progress
          </h2>
          <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
            <span className="font-mono font-semibold text-light-on-surface dark:text-dark-on-surface">
              {order.orderNumber}
            </span>
            <span aria-hidden="true"> · </span>
            <span>Stage: {stage || order.orderStatus}</span>
            {stage && order.orderStatus !== stage && (
              <>
                <span aria-hidden="true"> · </span>
                <span>Detail: {order.orderStatus}</span>
              </>
            )}
          </p>
        </div>

        <div className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant font-mono tabular-nums">
          {order.trackingCode ? `Courier Tracking: ${order.trackingCode}` : `Updated ${formatDhakaDateTime(order.updatedAt || order.createdAt)}`}
        </div>
      </div>

      {isException ? (
        <div
          role="status"
          className={`rounded-xl p-4 flex items-start gap-3 text-sm ${
            order.orderStatus === 'Cancelled'
              ? 'bg-light-error-container text-light-on-error-container'
              : 'bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant dark:border-dark-outline-variant'
          }`}
        >
          {order.orderStatus === 'Cancelled' ? (
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          ) : order.orderStatus === 'Return Requested' || order.orderStatus === 'Returned' || order.orderStatus === 'Refunded' ? (
            <RotateCcw className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold">Order Status: {order.orderStatus}</p>
            <p className="text-xs opacity-90">
              {order.timeline?.[order.timeline.length - 1]?.note ||
                'Fulfillment stopped due to cancellation or return processing.'}
            </p>
          </div>
        </div>
      ) : (
        <div
          role="progressbar"
          aria-label="Order fulfillment progress"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={stageIndex + 1}
          aria-valuetext={`${stage} (${order.orderStatus})`}
          className="relative"
        >
          {/* Desktop connecting progress rail */}
          <div
            aria-hidden="true"
            className="hidden sm:block absolute top-5 left-[16.666%] right-[16.666%] h-1 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high overflow-hidden"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-light-primary dark:bg-dark-primary transition-transform duration-300 ease-out"
              style={{transform: `scaleX(${railScale})`}}
            />
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4 relative">
            {ORDER_PROGRESS_STAGES.map((item, idx) => {
              const isCompleted = idx < stageIndex || (stageIndex === 2 && idx === 2);
              const isCurrent = idx === stageIndex && !isCompleted;
              const isReached = idx <= stageIndex;
              const ts = isReached ? getStageTimestamp(order, item.key) : undefined;
              const statusText = isCompleted ? 'Completed' : isCurrent ? 'Current Stage' : 'Upcoming';

              return (
                <li
                  key={item.key}
                  aria-current={idx === stageIndex ? 'step' : undefined}
                  className="flex sm:flex-col items-start sm:items-center sm:text-center gap-3.5 sm:gap-2.5"
                >
                  <div
                    className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors duration-200 ${
                      isCompleted
                        ? 'bg-light-primary dark:bg-dark-primary border-light-primary dark:border-dark-primary text-light-on-primary dark:text-dark-on-primary'
                        : isCurrent
                        ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-low border-light-primary dark:border-dark-primary text-light-primary dark:text-dark-primary ring-4 ring-light-primary/15 dark:ring-dark-primary/20'
                        : 'bg-light-surface-container-low dark:bg-dark-surface-container border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface-variant dark:text-dark-on-surface-variant'
                    }`}
                  >
                    {renderStageIcon(item.key, isCompleted)}
                  </div>

                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className={`text-sm font-bold ${
                        isReached
                          ? 'text-light-on-surface dark:text-dark-on-surface'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isCompleted || isCurrent
                          ? 'text-light-primary dark:text-dark-primary'
                          : 'text-light-outline dark:text-dark-outline'
                      }`}
                    >
                      {statusText}
                    </span>
                    <span className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      {ts ? formatDhakaDateTime(ts) : item.description}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
};
