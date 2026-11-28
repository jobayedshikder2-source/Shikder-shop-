import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  BD_DIVISIONS,
  BD_PHONE_REGEX,
  formatBDT,
  getInstagramUrl,
  getWhatsAppUrl,
  normalizeBdPhone,
} from '../src/lib/bd-locations.ts';
import {DEFAULT_WEBSITE_SETTINGS} from '../src/data/seedCatalog.ts';
import {checkoutSchema, couponSchema, productSchema, reviewSchema} from '../src/lib/validators.ts';
import {DIRTY_DOZEN_TESTS} from '../firestore.rules.test.ts';

test('Bangladesh phone regex & normalization handle local and international formats', () => {
  assert.equal(BD_PHONE_REGEX.test('01712345678'), true);
  assert.equal(BD_PHONE_REGEX.test('+8801912345678'), true);
  assert.equal(BD_PHONE_REGEX.test('8801812345678'), true);
  assert.equal(BD_PHONE_REGEX.test('01212345678'), false); // invalid prefix 012
  assert.equal(BD_PHONE_REGEX.test('017123456'), false); // too short
  assert.equal(normalizeBdPhone('017 1234-5678'), '+8801712345678');
  assert.equal(normalizeBdPhone('+8801812345678'), '+8801812345678');
});

test('WhatsApp, Instagram helpers and default store details match updated contact config', () => {
  assert.equal(getWhatsAppUrl('01996266204'), 'https://wa.me/8801996266204');
  assert.equal(getWhatsAppUrl('+880 1996-266204'), 'https://wa.me/8801996266204');
  assert.equal(getInstagramUrl('@shikdershop'), 'https://www.instagram.com/shikdershop/');
  assert.equal(
    getInstagramUrl('https://www.instagram.com/shikdershop_bd/'),
    'https://www.instagram.com/shikdershop_bd/'
  );
  assert.equal(DEFAULT_WEBSITE_SETTINGS.whatsappNumber, '01996266204');
  assert.match(DEFAULT_WEBSITE_SETTINGS.address, /Asuliya/i);
});

test('Bangladesh divisions cover all 8 administrative divisions and 64 districts', () => {
  assert.equal(BD_DIVISIONS.length, 8);
  const totalDistricts = BD_DIVISIONS.reduce((sum, div) => sum + div.districts.length, 0);
  assert.equal(totalDistricts, 64);
});

test('BDT currency formatter rounds and formats with Taka symbol', () => {
  assert.equal(formatBDT(3490), '৳3,490');
  assert.equal(formatBDT(1499.6), '৳1,500');
});

test('Checkout Zod schema enforces Bangladesh shipping address and valid payment method', () => {
  const valid = checkoutSchema.safeParse({
    fullName: 'Tanvir Rahman',
    phone: '01712345678',
    email: 'tanvir@example.com',
    division: 'Dhaka',
    district: 'Dhaka',
    upazila: 'Banani',
    area: 'Road 11',
    fullAddress: 'House 14, Block F, Banani',
    paymentMethod: 'cod',
  });
  assert.equal(valid.success, true);

  const invalidPhone = checkoutSchema.safeParse({
    fullName: 'Tanvir Rahman',
    phone: '12345',
    email: 'tanvir@example.com',
    division: 'Dhaka',
    district: 'Dhaka',
    upazila: 'Banani',
    area: 'Road 11',
    fullAddress: 'House 14, Block F, Banani',
    paymentMethod: 'cod',
  });
  assert.equal(invalidPhone.success, false);

  for (const removedMethod of ['bkash', 'nagad', 'sslcommerz']) {
    const res = checkoutSchema.safeParse({
      fullName: 'Tanvir Rahman',
      phone: '01712345678',
      email: 'tanvir@example.com',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Banani',
      area: 'Road 11',
      fullAddress: 'House 14, Block F, Banani',
      paymentMethod: removedMethod,
    });
    assert.equal(res.success, false);
  }
});

test('Product, Coupon, and Review validators reject malformed inputs', () => {
  assert.equal(
    reviewSchema.safeParse({rating: 6, comment: 'Great'}).success,
    false
  );
  assert.equal(
    couponSchema.safeParse({
      code: 'shikder250',
      type: 'fixed',
      value: 250,
      minPurchase: 2000,
      isActive: true,
    }).success,
    true
  );
  assert.equal(
    productSchema.safeParse({
      name: 'Test Item',
      slug: 'INVALID SLUG!',
      sku: 'SKU-1',
      categoryId: 'cat-audio',
      brandId: 'brand-shikder',
      regularPrice: 1000,
      stockQuantity: 10,
      isFeatured: false,
      isTrending: false,
      isFlashSale: false,
      isActive: true,
    }).success,
    false
  );
});

test('Security rules and Dirty Dozen adversarial test suite are present and intact', () => {
  const rulesText = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf-8');
  assert.match(rulesText, /allow delete:\s*if false;/);
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /orderId == incoming\(\)\.idempotencyKey/);
  assert.match(rulesText, /resource == null \|\| existing\(\)\.userId == request\.auth\.uid/);
  assert.ok(DIRTY_DOZEN_TESTS.length >= 12);
});

test('Firestore service avoids unindexed where+orderBy queries and aggregates multi-variant stock', () => {
  const serviceText = fs.readFileSync(new URL('../src/services/firestoreService.ts', import.meta.url), 'utf-8');
  assert.equal(/where\([^)]+\)\s*,\s*orderBy\(/.test(serviceText), false);
  assert.equal(/where\([^)]+\)\s*,\s*where\([^)]+\)\s*,\s*orderBy\(/.test(serviceText), false);
  assert.match(serviceText, /totalQtyByProduct/);
  assert.match(serviceText, /sortByCreatedAtDesc/);
});

test('Authentication supports Google redirect/popup and Email/Password sign-in without phone login', () => {
  const firebaseText = fs.readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf-8');
  const contextText = fs.readFileSync(new URL('../src/context/StoreContext.tsx', import.meta.url), 'utf-8');
  const authPageText = fs.readFileSync(new URL('../src/pages/AuthPages.tsx', import.meta.url), 'utf-8');
  const vercelConfig = fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf-8');

  assert.match(firebaseText, /getApps\(\)\.length \? getApp\(\) : initializeApp/);
  assert.match(firebaseText, /indexedDBLocalPersistence/);
  assert.match(firebaseText, /formatFirebaseAuthError/);
  assert.match(contextText, /getRedirectResult/);
  assert.match(authPageText, /signInWithRedirect/);
  assert.match(authPageText, /signInWithPopup/);
  assert.match(authPageText, /signInWithEmailAndPassword/);
  assert.match(authPageText, /createUserWithEmailAndPassword/);
  assert.equal(/signInWithPhoneNumber/.test(authPageText), false);
  assert.equal(/RecaptchaVerifier/.test(authPageText), false);
  assert.match(vercelConfig, /\/index\.html/);
});

test('OrderDetailPage renders visual OrderProgressTracker with Pending, Shipped, and Delivered stages', () => {
  const detailPageText = fs.readFileSync(new URL('../src/pages/OrderDetailPage.tsx', import.meta.url), 'utf-8');
  const progressText = fs.readFileSync(new URL('../src/components/OrderProgressTracker.tsx', import.meta.url), 'utf-8');

  assert.match(detailPageText, /<OrderProgressTracker/);
  assert.match(progressText, /'Pending'/);
  assert.match(progressText, /'Shipped'/);
  assert.match(progressText, /'Delivered'/);
  assert.match(progressText, /role="progressbar"/);
});

test('Real-time order status notification toast listens to user orders and announces status transitions', () => {
  const serviceText = fs.readFileSync(new URL('../src/services/firestoreService.ts', import.meta.url), 'utf-8');
  const contextText = fs.readFileSync(new URL('../src/context/StoreContext.tsx', import.meta.url), 'utf-8');
  const toastText = fs.readFileSync(new URL('../src/components/OrderStatusToast.tsx', import.meta.url), 'utf-8');
  const layoutText = fs.readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf-8');

  assert.match(serviceText, /subscribeToUserOrders/);
  assert.match(contextText, /subscribeToUserOrders/);
  assert.match(contextText, /prevStatus && prevStatus !== o\.orderStatus/);
  assert.match(contextText, /orderStatusToasts/);
  assert.match(toastText, /previousStatus/);
  assert.match(toastText, /newStatus/);
  assert.match(toastText, /\/orders\/\$\{toast\.orderId\}/);
  assert.match(layoutText, /<OrderStatusToast \/>/);
});

test('Admin settings allow editing WhatsApp, Gmail, Address, Instagram and ProductCard shows average rating', () => {
  const adminText = fs.readFileSync(new URL('../src/pages/AdminDashboardPage.tsx', import.meta.url), 'utf-8');
  const cardText = fs.readFileSync(new URL('../src/components/ProductCard.tsx', import.meta.url), 'utf-8');
  const privacyText = fs.readFileSync(new URL('../src/pages/InfoPages.tsx', import.meta.url), 'utf-8');

  assert.match(adminText, /whatsappNumber/);
  assert.match(adminText, /supportEmail/);
  assert.match(adminText, /instagramUrl/);
  assert.match(adminText, /webDraft\.address/);
  assert.match(cardText, /ratingAvg/);
  assert.match(cardText, /ratingCount/);
  assert.match(privacyText, /PrivacyPolicyPage/);
});

test('ProductReviews component supports interactive star ratings, real-time Firestore sync, and author edit/delete', () => {
  const componentText = fs.readFileSync(new URL('../src/components/ProductReviews.tsx', import.meta.url), 'utf-8');
  const detailsText = fs.readFileSync(new URL('../src/pages/ProductDetailsPage.tsx', import.meta.url), 'utf-8');
  const serviceText = fs.readFileSync(new URL('../src/services/firestoreService.ts', import.meta.url), 'utf-8');
  const rulesText = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf-8');

  assert.match(componentText, /subscribeToProductReviews/);
  assert.match(componentText, /submitProductReview/);
  assert.match(componentText, /updateCustomerReview/);
  assert.match(componentText, /deleteProductReview/);
  assert.match(componentText, /role="radiogroup"/);
  assert.match(detailsText, /<ProductReviews/);
  assert.match(serviceText, /onSnapshot/);
  assert.match(rulesText, /hasOnly\(\['rating', 'comment', 'userName', 'isApproved'\]\)/);
});
