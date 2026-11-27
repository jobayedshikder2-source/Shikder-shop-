# SHIKDER SHOP — Architecture & Engineering Plan

## 1. Platform Overview & Single-Vendor Model
**SHIKDER SHOP** is a production-ready, single-vendor e-commerce platform tailored for **Bangladesh** (`BDT ৳`, `Asia/Dhaka`, **Bengali & English** bilingual support, Division/District/Upazila/Area addressing, Cash on Delivery + optional bKash, Nagad, and SSLCommerz).

- **Seller Model**: Single-vendor only. The store owner is the sole merchant. Customers can register, browse, review, wishlist, and purchase, but cannot register as sellers or publish products.
- **Frontend & BFF**: Next.js App Router (TypeScript, React, Tailwind CSS, Zod, React Hook Form, Lucide icons) deployed on Vercel.
- **Backend & Data**: Firebase Authentication, Cloud Firestore, Firebase Storage, Firebase Admin SDK, Firebase Cloud Functions, Firebase Cloud Messaging (FCM), and Firebase App Check.

---

## 2. Complete Folder Structure

```text
shikder-shop/
├── src/
│   ├── app/
│   │   ├── (storefront)/
│   │   │   ├── page.tsx                     # 1. Homepage (SSR/ISR + Admin-managed sections)
│   │   │   ├── products/
│   │   │   │   ├── page.tsx                 # 2. All Products (filtering, sorting, pagination)
│   │   │   │   └── [slug]/page.tsx          # 4. Product Details (variants, reviews, JSON-LD)
│   │   │   ├── categories/
│   │   │   │   ├── page.tsx                 # 3. Product Categories
│   │   │   │   └── [slug]/page.tsx          # Category filtered products
│   │   │   ├── search/page.tsx              # 5. Search Results
│   │   │   ├── cart/page.tsx                # 6. Shopping Cart
│   │   │   ├── wishlist/page.tsx            # 7. Wishlist
│   │   │   ├── checkout/page.tsx            # 8. Checkout (BD address + COD/Gateways)
│   │   │   ├── contact/page.tsx             # 16. Contact Us
│   │   │   ├── about/page.tsx               # 17. About Us
│   │   │   ├── faq/page.tsx                 # 18. FAQ
│   │   │   ├── privacy-policy/page.tsx      # 19. Privacy Policy
│   │   │   ├── terms/page.tsx               # 20. Terms & Conditions
│   │   │   └── return-policy/page.tsx       # 21. Return & Refund Policy
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx               # 9. Login
│   │   │   ├── register/page.tsx            # 10. Registration
│   │   │   └── forgot-password/page.tsx     # 11. Forgot Password
│   │   ├── (account)/
│   │   │   ├── profile/page.tsx             # 12. Customer Profile
│   │   │   ├── orders/page.tsx              # 13. My Orders
│   │   │   ├── orders/[orderId]/page.tsx    # 14. Order Tracking & Timeline
│   │   │   └── notifications/page.tsx       # 15. Notifications
│   │   ├── admin/                           # Protected Admin Dashboard (17 modules)
│   │   │   ├── layout.tsx                   # Server-verified admin session guard
│   │   │   ├── page.tsx                     # Analytics overview
│   │   │   ├── products/page.tsx            # Product Management
│   │   │   ├── categories/page.tsx          # Category Management
│   │   │   ├── brands/page.tsx              # Brand Management
│   │   │   ├── orders/page.tsx              # Order Management
│   │   │   ├── customers/page.tsx           # Customer Management
│   │   │   ├── inventory/page.tsx           # Inventory Management
│   │   │   ├── coupons/page.tsx             # Coupon Management
│   │   │   ├── banners/page.tsx             # Banner & Homepage Sections
│   │   │   ├── flash-sales/page.tsx         # Flash Sales
│   │   │   ├── reviews/page.tsx             # Reviews Management
│   │   │   ├── returns/page.tsx             # Return & Refund Management
│   │   │   ├── notifications/page.tsx       # Notification Management
│   │   │   ├── settings/
│   │   │   │   ├── shipping/page.tsx        # Shipping Settings
│   │   │   │   ├── payments/page.tsx        # Payment Settings
│   │   │   │   └── website/page.tsx         # Website & Theme Settings
│   │   │   ├── reports/page.tsx             # Reports & Analytics
│   │   │   └── logs/page.tsx                # Admin Activity Logs
│   │   ├── api/
│   │   │   ├── auth/session/route.ts        # HttpOnly session cookie mint/clear
│   │   │   ├── cart/validate/route.ts       # Server price & stock validation
│   │   │   ├── coupons/validate/route.ts    # Server coupon eligibility check
│   │   │   ├── orders/route.ts              # Transactional order creation
│   │   │   ├── payments/webhook/route.ts    # Gateway verification webhook
│   │   │   └── upload/sign/route.ts         # Admin image upload validation
│   │   ├── offline/page.tsx                 # PWA Offline fallback
│   │   ├── sitemap.ts                       # Dynamic Sitemap.xml
│   │   └── robots.ts                        # Robots.txt
│   ├── components/                          # Design-system-driven UI components
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts                    # Firebase Web SDK + App Check
│   │   │   ├── admin.ts                     # Firebase Admin SDK (server-only)
│   │   │   └── messaging.ts                 # FCM foreground/background helpers
│   │   ├── i18n/                            # EN / BN dictionaries & formatter
│   │   ├── bd-locations.ts                  # Bangladesh Divisions, Districts, Upazilas
│   │   └── validators/                      # Zod schemas (checkout, product, auth, coupon)
├── functions/                               # Firebase Cloud Functions
│   └── src/
│       ├── orders.ts                        # Order notifications & audit trails
│       ├── inventory.ts                     # Low-stock admin alerts
│       └── users.ts                         # Welcome notification & safe profile init
├── scripts/
│   └── provision-admin.ts                   # Trusted CLI script to grant admin claim
├── firestore.rules                          # Firestore Security Rules
├── firestore.indexes.json                   # Composite Firestore indexes
├── storage.rules                            # Firebase Storage Security Rules
└── public/
    ├── manifest.webmanifest                 # PWA Web App Manifest
    └── sw.js                                # Service Worker (public assets only)
```

---

## 3. Firestore Database Design (17 Collections)

| Collection | Document ID | Visibility | Key Fields |
| :--- | :--- | :--- | :--- |
| `users/` | `uid` | Owner / Admin | `name`, `email`, `phone`, `photoURL`, `role` (`customer` \| `admin` read-only mirror), `fcmTokens[]`, `addresses[]`, `createdAt`, `updatedAt` |
| `products/` | `productId` | Public (if `isActive: true`) / Admin | `name`, `nameBn`, `slug`, `sku`, `description`, `shortDescription`, `categoryId`, `brandId`, `regularPrice`, `discountedPrice`, `images[]`, `videoUrl`, `variants[]` (`size`, `color`, `stock`, `sku`), `stockQuantity`, `specifications[]`, `shippingInfo`, `isFeatured`, `isActive`, `seoTitle`, `seoDescription`, `ratingAvg`, `ratingCount`, `createdAt`, `updatedAt` |
| `categories/` | `categoryId` | Public / Admin | `name`, `nameBn`, `slug`, `image`, `parentId`, `sortOrder`, `isActive` |
| `brands/` | `brandId` | Public / Admin | `name`, `slug`, `logo`, `isActive` |
| `carts/` | `uid` | Owner only | `items[]` (`productId`, `variantId`, `quantity`, `addedAt`), `updatedAt` (prices never trusted from client) |
| `wishlists/` | `uid` | Owner only | `productIds[]`, `updatedAt` |
| `orders/` | `orderId` | Owner (read) / Admin | `orderNumber` (unique), `idempotencyKey`, `userId`, `customerInfo` (`fullName`, `phone`, `email`, `division`, `district`, `upazila`, `area`, `fullAddress`, `instructions`), `items[]` (immutable price/title/variant snapshot), `subtotal`, `discountAmount`, `couponCode`, `deliveryCharge`, `totalAmount`, `paymentMethod` (`cod` \| `bkash` \| `nagad` \| `sslcommerz`), `paymentStatus`, `orderStatus`, `trackingCode`, `timeline[]`, `createdAt`, `updatedAt` |
| `reviews/` | `reviewId` | Public (read) / Verified Buyer | `productId`, `userId`, `userName`, `rating` (1–5), `comment`, `isApproved`, `createdAt` |
| `coupons/` | `code` | Admin (write) / Server (read) | `type` (`percentage` \| `fixed`), `value`, `minPurchase`, `maxDiscount`, `expiresAt`, `usageLimit`, `usedCount`, `perCustomerLimit`, `productIds[]`, `categoryIds[]`, `isActive` |
| `banners/` | `bannerId` | Public / Admin | `title`, `titleBn`, `subtitle`, `imageUrl`, `linkUrl`, `placement` (`hero` \| `promo` \| `flash_sale`), `sortOrder`, `isActive` |
| `notifications/` | `notificationId` | Recipient / Admin | `userId` (`null` for admin broadcast), `targetRole` (`customer` \| `admin`), `title`, `body`, `type`, `isRead`, `link`, `createdAt` |
| `returns/` | `returnId` | Owner / Admin | `orderId`, `userId`, `reason`, `items[]`, `status` (`requested` \| `approved` \| `rejected` \| `completed`), `createdAt` |
| `refunds/` | `refundId` | Owner / Admin | `orderId`, `returnId`, `userId`, `amount`, `method`, `status` (`pending` \| `processed` \| `failed`), `processedAt` |
| `settings/` | `global`, `shipping`, `payments`, `homepage` | Public (safe subset) / Admin | Theme tokens, logo, EN/BN labels, Dhaka vs Outside-Dhaka delivery charges, gateway enabled flags, homepage section order |
| `admin_logs/` | `logId` | Admin (read) / Server (write) | `adminUid`, `action`, `targetCollection`, `targetId`, `metadata`, `createdAt` |
| `newsletter_subscribers/` | `emailHash` | Public (create) / Admin (read) | `email`, `subscribedAt`, `isActive` |

---

## 4. Authentication & Authorization Design
- **Providers**: Google Sign-In, Facebook Login, Email & Password (with Email Verification & Password Reset).
- **Session Persistence**: Client authenticates via Firebase Auth SDK, then posts its ID token to `/api/auth/session` to mint an `HttpOnly`, `Secure`, `SameSite=Lax` Firebase session cookie for SSR & Admin route protection.
- **Single-Vendor Admin Provisioning**: Admin access requires Firebase Auth Custom Claim `admin: true`, granted **only** via `scripts/provision-admin.ts` using Firebase Admin SDK. Users can never self-assign `role: "admin"` in Firestore.

---

## 5. Security & Rules Design
- **Firestore Security Rules**:
  - Public read on `products` (where `isActive == true`), `categories`, `brands`, `banners`, approved `reviews`, and public `settings`.
  - `users/{uid}`, `carts/{uid}`, `wishlists/{uid}` restricted to `request.auth.uid == uid`, with field-level locks preventing `role` or `customClaims` tampering.
  - `orders/{orderId}` readable by owner (`resource.data.userId == request.auth.uid`) or admin; **creation and price/status mutations occur exclusively via Admin SDK** in `/api/orders` using Firestore transactions (atomic stock decrement + idempotency key check to prevent overselling and duplicate orders).
  - `admin_logs/` and `settings/` writable only by `request.auth.token.admin == true`.
- **Storage Security Rules**:
  - Product/banner images writable only by `admin == true`; customer avatars writable only by owner `uid`; enforced `contentType.matches('image/(jpeg|png|webp)')` and `size < 5 * 1024 * 1024`.
- **App Check & Headers**: ReCAPTCHA Enterprise / v3 App Check enforced on Firestore, Storage, and Functions; CSP, `X-Frame-Options: DENY`, `Strict-Transport-Security`, and rate limiting on checkout/auth endpoints.

---

## 6. UI & Bilingual (EN/BN) Design Plan
- **Centralized Design System**: Driven by `DESIGN.md` and `tailwind.config.js` with light/dark mode tokens, `BDT ৳` tabular-nums formatting, and EN/BN language switcher.
- **Mobile-First Storefront**: Sticky top bar (logo, search with live suggestions, EN/BN toggle, account, wishlist, cart badge), bottom mobile navigation bar, hero slider, flash sale countdown, category strip, product cards with quick-add & discount badges, trust bar (COD, Fast BD Delivery, Easy Returns), and footer.
- **PWA**: `manifest.webmanifest` + Service Worker caching only static shell & public product assets (never `/checkout`, `/api/orders`, or authenticated customer data).
