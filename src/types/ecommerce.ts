export type Language = 'en' | 'bn';

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Return Requested'
  | 'Returned'
  | 'Refunded';

export type PaymentMethod = 'cod';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';

export interface ProductVariant {
  id: string;
  size?: string;
  color?: string;
  sku?: string;
  stock: number;
  priceDelta?: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  name: string;
  nameBn?: string;
  slug: string;
  sku: string;
  shortDescription?: string;
  description?: string;
  categoryId: string;
  brandId: string;
  regularPrice: number;
  discountedPrice?: number;
  images: string[];
  videoUrl?: string;
  variants: ProductVariant[];
  stockQuantity: number;
  specifications: ProductSpec[];
  shippingInfo?: string;
  isFeatured: boolean;
  isTrending: boolean;
  isFlashSale: boolean;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  nameBn?: string;
  slug: string;
  icon?: string;
  image?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  isActive: boolean;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  size?: string;
  color?: string;
  quantity: number;
  addedAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: 'customer' | 'admin';
  division?: string;
  district?: string;
  upazila?: string;
  area?: string;
  fullAddress?: string;
  pushEnabled?: boolean;
  fcmToken?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItemSnapshot {
  productId: string;
  name: string;
  slug: string;
  image: string;
  sku: string;
  variantLabel?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderTimelineEvent {
  status: string;
  note: string;
  timestamp: string;
  actor?: string;
}

export interface CustomerShippingInfo {
  fullName: string;
  phone: string;
  email: string;
  division: string;
  district: string;
  upazila: string;
  area: string;
  fullAddress: string;
  instructions?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  idempotencyKey: string;
  userId: string;
  customerInfo: CustomerShippingInfo;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  deliveryCharge: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingCode?: string;
  timeline: OrderTimelineEvent[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt?: unknown;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  perCustomerLimit?: number;
  expiresAt?: string;
  productIds?: string[];
  categoryIds?: string[];
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  titleBn?: string;
  subtitle?: string;
  badgeText?: string;
  imageUrl: string;
  linkUrl?: string;
  placement: 'hero' | 'promo' | 'flash_sale';
  sortOrder: number;
  isActive: boolean;
}

export interface NotificationItem {
  id: string;
  userId: string;
  targetRole: 'customer' | 'admin';
  title: string;
  body: string;
  type?: string;
  isRead: boolean;
  link?: string;
  createdAt?: unknown;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  userId: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  createdAt?: unknown;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  returnId?: string;
  userId: string;
  amount: number;
  method: string;
  status: 'pending' | 'processed' | 'failed';
  createdAt?: unknown;
}

export interface AdminLog {
  id: string;
  adminUid: string;
  adminEmail?: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary?: string;
  createdAt?: unknown;
}

export interface ShippingSettings {
  dhakaFee: number;
  outsideDhakaFee: number;
  freeDhakaThreshold: number;
  estimatedDhakaDays: string;
  estimatedOutsideDays: string;
}

export interface PaymentSettings {
  codEnabled: boolean;
}

export interface WebsiteSettings {
  brandName: string;
  announcementText: string;
  announcementTextBn: string;
  supportPhone: string;
  supportEmail: string;
  address: string;
  primaryColor: string;
  secondaryColor: string;
  showFlashSale: boolean;
  showTrending: boolean;
  showBestSelling: boolean;
  showNewArrivals: boolean;
  showReviews: boolean;
  showNewsletter: boolean;
}
