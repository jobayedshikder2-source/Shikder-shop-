import React from 'react';
import {Link} from 'react-router-dom';
import {Bell, Check} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {markNotificationRead} from '../services/firestoreService';
import {formatDhakaDateTime} from '../lib/bd-locations';

export const NotificationsPage: React.FC = () => {
  const {user, notifications, refreshNotifications} = useStore();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <Bell className="w-10 h-10 text-light-primary dark:text-dark-primary" />
        <h1 className="font-headline text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Sign in to view your order updates and promotional alerts.
        </p>
        <Link to="/login" className="px-6 py-2.5 rounded-full bg-light-primary text-light-on-primary text-sm font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    await refreshNotifications();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-2xl font-bold">Notifications</h1>
        <span className="text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
          {notifications.filter((n) => !n.isRead).length} unread
        </span>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-8 text-center text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          No notifications yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${
                n.isRead
                  ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-low border-light-outline-variant dark:border-dark-outline-variant opacity-80'
                  : 'bg-light-primary/5 dark:bg-dark-primary/10 border-light-primary/30 dark:border-dark-primary/30'
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="font-title text-sm font-bold">{n.title}</span>
                <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">{n.body}</p>
                <div className="flex items-center gap-3 text-xs text-light-outline pt-1">
                  <span>{formatDhakaDateTime(n.createdAt)}</span>
                  {n.link && (
                    <Link to={n.link} className="text-light-primary dark:text-dark-primary font-semibold hover:underline">
                      View Details
                    </Link>
                  )}
                </div>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-light-surface-bright dark:bg-dark-surface-container border border-light-outline-variant text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5" /> Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
