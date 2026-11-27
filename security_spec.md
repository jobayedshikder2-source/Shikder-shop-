# SHIKDER SHOP — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Single-Vendor Seller Integrity**: Only verified administrators (`isAdmin()`) may create, publish, edit, or delete `products`, `categories`, `brands`, `banners`, `coupons`, and `settings`.
2. **No Self-Promoted Admins**: A customer registering or updating `/users/{uid}` may never assign `role: "admin"` or create `/admins/{uid}` unless they hold a verified admin session (`bnagladeshbodnaparty@gmail.com` with `email_verified == true` or existing `/admins/{uid}`).
3. **PII Isolation**: `/users/{uid}`, `/carts/{uid}`, `/wishlists/{uid}`, `/orders/{orderId}`, `/returns/{returnId}`, and `/refunds/{refundId}` are strictly scoped to `request.auth.uid == userId` or `isAdmin()`.
4. **Immutable Order Totals & Payment Protection**: Customers creating an order must provide `orderStatus == "Pending"`, `paymentStatus == "unpaid"`, `userId == request.auth.uid`, valid `idempotencyKey`, and `createdAt == request.time`. Customers cannot update `paymentStatus`, `totalAmount`, or arbitrary `orderStatus` values.
5. **Stock Integrity**: Customers cannot arbitrarily mutate `/products/{productId}` fields; only an atomic decrease of `stockQuantity` (and increment of `soldCount`) is permitted when accompanied by an order creation, or full mutation by `isAdmin()`.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` fields on user-created documents must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Admin Escalation**: Authenticated customer attempts `setDoc(doc(db, 'users', uid), { ..., role: 'admin' })` -> `PERMISSION_DENIED`.
2. **Admins Collection Injection**: Non-admin user attempts `setDoc(doc(db, 'admins', uid), { role: 'admin' })` -> `PERMISSION_DENIED`.
3. **Unverified Email Admin Spoof**: User with unverified email claims admin email -> `PERMISSION_DENIED`.
4. **Cross-User PII Read**: User A attempts `getDoc(doc(db, 'users', userB_uid))` -> `PERMISSION_DENIED`.
5. **Cross-User Order List Scraping**: User A runs `getDocs(collection(db, 'orders'))` without `where('userId', '==', uid)` -> `PERMISSION_DENIED`.
6. **Client-Side Price Tampering**: Customer attempts `updateDoc(doc(db, 'products', pId), { regularPrice: 1, discountedPrice: 1 })` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection on Order**: Customer creates order with extra ghost field `isVerifiedByBank: true` -> `PERMISSION_DENIED`.
8. **Forged Paid Order Creation**: Customer creates order with `paymentStatus: 'paid'` -> `PERMISSION_DENIED`.
9. **Customer Payment Status Tampering**: Customer attempts `updateDoc(doc(db, 'orders', oId), { paymentStatus: 'paid' })` -> `PERMISSION_DENIED`.
10. **Terminal State Bypass**: Customer attempts to cancel an already `Delivered` order -> `PERMISSION_DENIED`.
11. **ID Poisoning**: Attacker attempts `setDoc(doc(db, 'orders', 'a'.repeat(500)), ...)` -> `PERMISSION_DENIED`.
12. **Blanket Newsletter Scraping**: Unauthenticated or customer user attempts `getDocs(collection(db, 'newsletter_subscribers'))` -> `PERMISSION_DENIED`.
