import {z} from 'zod';
import {BD_PHONE_REGEX} from './bd-locations';

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  phone: z.string().trim().regex(BD_PHONE_REGEX, 'Valid Bangladesh mobile number required').or(z.literal('')),
  division: z.string().max(60).optional(),
  district: z.string().max(60).optional(),
  upazila: z.string().max(80).optional(),
  area: z.string().max(100).optional(),
  fullAddress: z.string().max(300).optional(),
});

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  phone: z.string().trim().regex(BD_PHONE_REGEX, 'Enter a valid Bangladesh phone number (013-019)'),
  email: z.string().email('Valid email is required').max(200),
  division: z.string().min(2, 'Select a division').max(60),
  district: z.string().min(2, 'Select a district').max(60),
  upazila: z.string().trim().min(2, 'Enter upazila / thana').max(80),
  area: z.string().trim().min(1, 'Enter area / sector').max(100),
  fullAddress: z.string().trim().min(5, 'Enter complete street & house address').max(300),
  instructions: z.string().max(240).optional(),
  paymentMethod: z.enum(['cod']),
});

export const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().trim().min(3, 'Write at least 3 characters').max(1000),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name required').max(160),
  nameBn: z.string().max(200).optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens').max(160),
  sku: z.string().trim().min(2).max(64),
  shortDescription: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  categoryId: z.string().min(1).max(128),
  brandId: z.string().min(1).max(128),
  regularPrice: z.number().min(0),
  discountedPrice: z.number().min(0).optional(),
  stockQuantity: z.number().int().min(0),
  shippingInfo: z.string().max(300).optional(),
  seoTitle: z.string().max(120).optional(),
  seoDescription: z.string().max(240).optional(),
  isFeatured: z.boolean(),
  isTrending: z.boolean(),
  isFlashSale: z.boolean(),
  isActive: z.boolean(),
});

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, numbers, - or _ only').min(2).max(40),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minPurchase: z.number().min(0),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().int().min(0).optional(),
  perCustomerLimit: z.number().int().min(0).optional(),
  expiresAt: z.string().max(60).optional(),
  isActive: z.boolean(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().trim().regex(BD_PHONE_REGEX, 'Valid BD phone required'),
  subject: z.string().trim().min(3).max(140),
  message: z.string().trim().min(10).max(1500),
});
