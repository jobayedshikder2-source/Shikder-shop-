# SHIKDER SHOP — Single-Vendor Bangladesh E-Commerce Platform

SHIKDER SHOP is a production-ready, single-vendor e-commerce platform designed for Bangladesh (`BDT ৳`, `Asia/Dhaka` timezone, English & Bengali bilingual storefront, Light & Dark modes, Cash on Delivery nationwide across 64 districts, and Progressive Web App offline support).

## Key Capabilities

- **Single-Vendor Seller Security**: Only the bootstrapped store owner (`bnagladeshbodnaparty@gmail.com`) and explicitly provisioned admins can manage products, orders, inventory, coupons, banners, reviews, refunds, and site settings. Customers cannot register as sellers.
- **21 Customer Storefront Views + PWA Offline Page**: Homepage, All Products, Categories, Product Details, Search Results, Shopping Cart, Wishlist, Checkout, Login, Registration, Forgot Password, Profile, My Orders, Order Tracking/Detail, Notifications, Contact, About, FAQ, Privacy Policy, Terms & Conditions, Return Policy, and `/offline`.
- **17-Module Admin Dashboard (`/admin`)**: Overview Analytics, Products, Categories, Brands, Orders (11-stage workflow), Customers, Inventory, Coupons, Banners, Flash Sales, Reviews Moderation, Returns & Refunds, Notifications Broadcast, Shipping Settings, Payment Gateways, Website/Homepage Controls, and CSV Reports + Immutable Admin Audit Logs.
- **Transactional Checkout & Security Hardening**:
  - Client prices and totals are never trusted: `placeTransactionalOrder` calls `/api/checkout/verify` and executes a Firestore `runTransaction` that computes unit prices, coupon discounts, and Dhaka/outside-Dhaka delivery charges from authoritative Firestore documents, atomically decrements product stock, prevents duplicate orders via `idempotencyKey`, and locks immutable order-item snapshots.
  - bKash, Nagad, and SSLCommerz remain disabled until merchant credentials and webhook verification secrets are configured in `.env`.

## Folder Structure

- `src/pages/` — 21 customer views + `AdminDashboardPage.tsx`
- `src/components/` — `Layout.tsx`, `ProductCard.tsx`, `ImageWithFallback.tsx`, `PWAWidgets.tsx`, `ErrorBoundary.tsx`
- `src/context/StoreContext.tsx` — Global Auth, Cart/Wishlist sync, i18n (`en`/`bn`), Dark mode, Notifications
- `src/services/firestoreService.ts` — Transactional checkout, catalog queries, and admin CRUD operations
- `src/lib/` — `firebase.ts`, `bd-locations.ts` (all 8 divisions / 64 districts), `i18n.ts`, `validators.ts`
- `server.ts` — Express server with Vite dev middleware, rate-limited `/api/*` validation, payment webhook HMAC verification, `/robots.txt`, and `/sitemap.xml`
- `functions/` — Firebase Cloud Functions (`onOrderStatusUpdated`, `onProductStockLow`, `onReturnRequested`)
- `scripts/provision-admin.ts` — Admin SDK custom claim & `/admins/{uid}` provisioning CLI
- `firestore.rules` & `storage.rules` — Hardened security rules (linted cleanly via `@firebase/eslint-plugin-security-rules`)

## Environment Setup

Copy `.env.example` to `.env` and populate secrets where required:
- `VITE_FIREBASE_APP_CHECK_KEY`: Google reCAPTCHA v3 site key for Firebase App Check
- `VITE_FIREBASE_VAPID_KEY`: Web Push VAPID key for Firebase Cloud Messaging
- `BKASH_APP_KEY` / `BKASH_APP_SECRET`, `NAGAD_MERCHANT_ID` / `NAGAD_PRIVATE_KEY`, `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD`, `PAYMENT_WEBHOOK_SECRET`: Leave unset to keep online gateways safely disabled with Cash on Delivery active.

## Authentication Provider (Firebase Console)

SHIKDER SHOP uses **Google Sign-In** only via Firebase Authentication:
1. Open Firebase Console -> **Authentication** -> **Sign-in method**.
2. Ensure **Google** is enabled (enabled by default).

## Commands

```bash
npm install
npm run test     # Runs Zod, BD location/phone, and security invariant tests
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production Vite + PWA bundle build
npm run dev      # Express + Vite middleware on port 3000
```

## Deploying from an Android Phone (Termux + GitHub + Vercel)

1. Install **Termux** (from F-Droid), then install Node.js 22 and Git:
   ```bash
   pkg update && pkg upgrade -y
   pkg install -y nodejs-lts git
   ```
2. Clone or push your repository to GitHub:
   ```bash
   git init && git add . && git commit -m "Deploy SHIKDER SHOP"
   git remote add origin https://github.com/<your-username>/shikder-shop.git
   git push -u origin main
   ```
3. Connect the GitHub repository in **Vercel** via mobile browser, set build command `npm run build` and output directory `dist` (or deploy `server.ts` via Node runtime / Railway / Cloud Run), and add your environment variables.
4. For Firebase Cloud Functions and rules CLI deployment on Termux:
   ```bash
   npm install -g firebase-tools
   firebase login --no-localhost
   firebase deploy --only firestore:rules,storage,functions
   ```
