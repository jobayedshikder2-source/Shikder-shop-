import {initializeApp} from 'firebase-admin/app';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {onDocumentCreated, onDocumentUpdated} from 'firebase-functions/v2/firestore';

initializeApp();
const db = getFirestore();

/**
 * Sends an FCM push notification when a customer order status transitions
 * (Confirmed, Processing, Packed, Shipped, Out for Delivery, Delivered, Refunded).
 */
export const onOrderStatusUpdated = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.orderStatus === after.orderStatus) {
    return;
  }

  const userId = String(after.userId || '');
  const orderNumber = String(after.orderNumber || event.params.orderId);
  const newStatus = String(after.orderStatus);

  const userSnap = await db.collection('users').doc(userId).get();
  const fcmToken = userSnap.data()?.fcmToken as string | undefined;
  const pushEnabled = Boolean(userSnap.data()?.pushEnabled);

  if (pushEnabled && fcmToken) {
    await getMessaging()
      .send({
        token: fcmToken,
        notification: {
          title: `SHIKDER SHOP · ${orderNumber}`,
          body: `Your order status is now: ${newStatus}`,
        },
        data: {
          orderId: event.params.orderId,
          orderStatus: newStatus,
        },
      })
      .catch((err) => {
        console.warn('FCM send warning:', err);
      });
  }
});

/**
 * Creates a server-side low-stock alert for the single-vendor admin when inventory drops under 10 units.
 */
export const onProductStockLow = onDocumentUpdated('products/{productId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const prevStock = Number(before.stockQuantity ?? 0);
  const nextStock = Number(after.stockQuantity ?? 0);
  if (prevStock >= 10 && nextStock < 10) {
    const adminsSnap = await db.collection('admins').limit(10).get();
    const batch = db.batch();
    for (const adminDoc of adminsSnap.docs) {
      const notifRef = db.collection('notifications').doc(`lowstock-${event.params.productId}-${Date.now()}`);
      batch.set(notifRef, {
        userId: adminDoc.id,
        targetRole: 'admin',
        title: `Low Stock Alert: ${after.name}`,
        body: `SKU ${after.sku} dropped to ${nextStock} remaining units.`,
        type: 'inventory',
        isRead: false,
        link: '/admin',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
});

/**
 * Logs new return requests to admin notification stream.
 */
export const onReturnRequested = onDocumentCreated('returns/{returnId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const adminsSnap = await db.collection('admins').limit(10).get();
  const batch = db.batch();
  for (const adminDoc of adminsSnap.docs) {
    const notifRef = db.collection('notifications').doc(`ret-${event.params.returnId}-${adminDoc.id}`);
    batch.set(notifRef, {
      userId: adminDoc.id,
      targetRole: 'admin',
      title: `Return Requested: ${data.orderNumber}`,
      body: String(data.reason || 'Customer submitted a return request.'),
      type: 'return',
      isRead: false,
      link: '/admin',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
});
