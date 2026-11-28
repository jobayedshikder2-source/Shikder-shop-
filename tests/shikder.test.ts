import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {BD_DIVISIONS, BD_PHONE_REGEX, formatBDT, normalizeBdPhone} from '../src/lib/bd-locations.ts';
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

test('Google Authentication uses signInWithRedirect, getRedirectResult, IndexedDB persistence, and Vercel SPA rewrites', () => {
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
  assert.match(vercelConfig, /\/index\.html/);
});


