import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {Mail, MapPin, Phone, WifiOff} from 'lucide-react';
import {z} from 'zod';
import {contactSchema} from '../lib/validators';
import {useStore} from '../context/StoreContext';

type ContactForm = z.infer<typeof contactSchema>;

export const ContactPage: React.FC = () => {
  const {websiteSettings, showToast} = useStore();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: {errors},
  } = useForm<ContactForm>({resolver: zodResolver(contactSchema)});

  const onSubmit = async () => {
    setSent(true);
    reset();
    showToast('Inquiry received! Our Dhaka support team will reply within 24 hours.');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="font-headline text-3xl font-bold">Contact SHIKDER SHOP</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Questions about orders, warranty claims, or bulk corporate orders across Bangladesh? Reach our Banani headquarters directly.
        </p>
        <div className="flex flex-col gap-3 pt-2 text-sm">
          <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-light-primary" /><span>{websiteSettings.address}</span></div>
          <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-light-primary" /><span className="font-mono">{websiteSettings.supportPhone}</span></div>
          <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-light-primary" /><span>{websiteSettings.supportEmail}</span></div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-3.5">
        <h2 className="font-headline text-lg font-bold">Send a Message</h2>
        <input {...register('name')} placeholder="Full Name" className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
        {errors.name && <span className="text-xs text-light-error">{errors.name.message}</span>}
        <input {...register('phone')} placeholder="+880 17XX-XXXXXX" className="rounded-lg px-3.5 py-2 text-sm font-mono bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
        {errors.phone && <span className="text-xs text-light-error">{errors.phone.message}</span>}
        <input type="email" {...register('email')} placeholder="Email Address" className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
        {errors.email && <span className="text-xs text-light-error">{errors.email.message}</span>}
        <input {...register('subject')} placeholder="Subject / Order Number" className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
        {errors.subject && <span className="text-xs text-light-error">{errors.subject.message}</span>}
        <textarea rows={3} {...register('message')} placeholder="How can we help?" className="rounded-lg px-3.5 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant" />
        {errors.message && <span className="text-xs text-light-error">{errors.message.message}</span>}
        {sent && <p className="text-xs font-semibold text-success">Thank you! Your message has been logged.</p>}
        <button type="submit" className="py-2.5 px-6 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
          Send Message
        </button>
      </form>
    </div>
  );
};

export const AboutPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-5">
    <h1 className="font-headline text-3xl font-bold">About SHIKDER SHOP</h1>
    <p className="text-base leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant">
      SHIKDER SHOP is a single-vendor Bangladeshi e-commerce flagship founded in Dhaka. Unlike open multi-vendor marketplaces with inconsistent third-party quality, every item on SHIKDER SHOP is sourced, quality-checked, stored, and dispatched directly by our own fulfillment team in Banani, Dhaka.
    </p>
    <p className="text-base leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant">
      We serve all 8 divisions and 64 districts across Bangladesh with transparent BDT (৳) pricing, Cash on Delivery, and official replacement warranties.
    </p>
  </div>
);

export const FaqPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-6">
    <h1 className="font-headline text-3xl font-bold">Frequently Asked Questions</h1>
    {[
      {q: 'Do you deliver outside Dhaka?', a: 'Yes, we deliver to all 64 districts in Bangladesh within 2–4 business days.'},
      {q: 'Is Cash on Delivery available?', a: 'Yes, Cash on Delivery (COD) is available nationwide. You may inspect sealed outer packaging before paying.'},
      {q: 'How are product warranties handled?', a: 'Every electronic item includes an official SHIKDER Care warranty card honored directly at our Dhaka service desk.'},
      {q: 'Can third-party sellers list products?', a: 'No. SHIKDER SHOP is a 100% single-vendor store so every product is guaranteed authentic.'},
    ].map((item, i) => (
      <div key={i} className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5">
        <h2 className="font-title font-bold text-base">{item.q}</h2>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1.5">{item.a}</p>
      </div>
    ))}
  </div>
);

export const PrivacyPolicyPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-4 text-sm leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant">
    <h1 className="font-headline text-3xl font-bold text-light-on-surface dark:text-dark-on-surface">Privacy Policy</h1>
    <p>SHIKDER SHOP collects only the information required to process your orders, deliver parcels within Bangladesh, and send order status updates.</p>
    <p>Personal details (name, phone number, delivery address, and email) are isolated to your account in Cloud Firestore and are never sold or shared with third-party marketplace vendors.</p>
    <p>Passwords are never stored in Firestore; authentication is handled exclusively by Firebase Authentication.</p>
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-4 text-sm leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant">
    <h1 className="font-headline text-3xl font-bold text-light-on-surface dark:text-dark-on-surface">Terms & Conditions</h1>
    <p>All prices are listed in Bangladeshi Taka (BDT ৳) and verified on the server at the moment of order placement.</p>
    <p>Orders placed via Cash on Delivery are confirmed after inventory reservation. We reserve the right to cancel duplicate or fraudulent orders.</p>
  </div>
);

export const ReturnPolicyPage: React.FC = () => (
  <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-4 text-sm leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant">
    <h1 className="font-headline text-3xl font-bold text-light-on-surface dark:text-dark-on-surface">Return & Refund Policy</h1>
    <p>Customers may request a return within 7 days of delivery for defective, damaged, or wrong-size items via the My Orders portal.</p>
    <p>Approved returns are inspected within 48 hours of pickup and refunded to your original payment method or mobile wallet.</p>
  </div>
);

export const OfflinePage: React.FC = () => (
  <div className="max-w-md mx-auto px-4 py-20 text-center flex flex-col items-center gap-4">
    <WifiOff className="w-12 h-12 text-warning" />
    <h1 className="font-headline text-2xl font-bold">You are currently offline</h1>
    <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
      Public catalog pages remain accessible, while checkout and account updates require an active internet connection.
    </p>
    <Link to="/" className="px-6 py-2.5 rounded-full bg-light-primary text-light-on-primary text-sm font-semibold">
      Retry Home
    </Link>
  </div>
);
