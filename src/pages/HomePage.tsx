import React, {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, Backpack, CheckCircle2, Coffee, Headphones, Shirt, ShieldCheck, Truck, Watch, Zap} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {subscribeToNewsletter} from '../services/firestoreService';
import {ProductCard} from '../components/ProductCard';
import {ImageWithFallback} from '../components/ImageWithFallback';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  headphones: <Headphones className="w-6 h-6" />,
  shirt: <Shirt className="w-6 h-6" />,
  watch: <Watch className="w-6 h-6" />,
  coffee: <Coffee className="w-6 h-6" />,
  backpack: <Backpack className="w-6 h-6" />,
};

export const HomePage: React.FC = () => {
  const {products, categories, banners, websiteSettings, language, t, showToast} = useStore();
  const [activeTab, setActiveTab] = useState<'trending' | 'bestselling' | 'arrivals' | 'recommended'>('trending');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submittingNews, setSubmittingNews] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(4 * 3600 + 18 * 60 + 32);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 4 * 3600));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const countdownStr = useMemo(() => {
    const h = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
    const s = String(secondsLeft % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [secondsLeft]);

  const heroBanner = banners.find((b) => b.placement === 'hero') || banners[0];
  const promoBanner = banners.find((b) => b.placement === 'promo');

  const flashProducts = useMemo(() => products.filter((p) => p.isFlashSale).slice(0, 4), [products]);
  const tabProducts = useMemo(() => {
    if (activeTab === 'trending') return products.filter((p) => p.isTrending).slice(0, 4);
    if (activeTab === 'bestselling') return [...products].sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0)).slice(0, 4);
    if (activeTab === 'recommended') return products.filter((p) => p.isFeatured).slice(0, 4);
    return products.slice(0, 4);
  }, [activeTab, products]);

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubmittingNews(true);
    try {
      await subscribeToNewsletter(newsletterEmail);
      setSubscribed(true);
      setNewsletterEmail('');
      showToast(t('subscribedSuccess'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to subscribe');
    } finally {
      setSubmittingNews(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-10">
      {/* 1. Hero Showcase */}
      <section aria-label="Featured showcase" className="relative rounded-2xl overflow-hidden border border-light-outline-variant dark:border-dark-outline-variant bg-light-primary dark:bg-dark-surface-container min-h-[260px] md:min-h-[340px] flex items-center">
        <ImageWithFallback
          src={heroBanner?.imageUrl}
          alt={heroBanner?.title || 'SHIKDER SHOP Flagship'}
          priority
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08100D]/90 via-[#08100D]/70 to-transparent" />
        <div className="relative z-10 p-6 md:p-12 max-w-xl flex flex-col gap-3">
          <span className="self-start px-3 py-1 rounded-full bg-light-secondary-container text-light-on-secondary-container text-xs font-bold tracking-wide">
            {heroBanner?.badgeText || t('heroBadge')}
          </span>
          <h1 className="font-display text-3xl md:text-5xl font-extrabold text-white leading-tight text-balance">
            {language === 'bn' && heroBanner?.titleBn ? heroBanner.titleBn : heroBanner?.title || t('heroTitle')}
          </h1>
          <p className="text-sm md:text-base text-white/85 max-w-md">
            {heroBanner?.subtitle || t('heroSubtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/products?flash=true"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-light-secondary text-light-on-secondary text-sm font-semibold hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <span>{t('shopFlashSale')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/15 text-white border border-white/25 text-sm font-semibold hover:bg-white/25 transition-colors whitespace-nowrap"
            >
              <span>{t('browseAll')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Bangladesh Trust Strip */}
      <section aria-label="Store guarantees" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-4 flex items-center gap-3">
          <Truck className="w-5 h-5 text-light-primary dark:text-dark-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">64-District BD Delivery</p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">৳60 Dhaka · Free over ৳1,500</p>
          </div>
        </div>
        <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-light-primary dark:text-dark-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">100% Authentic Direct Seller</p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">Official SHIKDER SHOP warranty</p>
          </div>
        </div>
        <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <div>
            <p className="text-sm font-semibold">Cash on Delivery Ready</p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">Inspect parcel & 7-day easy returns</p>
          </div>
        </div>
      </section>

      {/* 2. Featured Categories */}
      <section aria-labelledby="cat-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="cat-heading" className="font-headline text-2xl font-bold">{t('shopByCategory')}</h2>
          <Link to="/categories" className="text-sm font-semibold text-light-primary dark:text-dark-primary hover:underline">
            {t('viewAll')}
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/categories/${cat.slug}`}
              className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
            >
              <span className="text-light-primary dark:text-dark-primary">
                {CATEGORY_ICONS[cat.icon || 'headphones'] || <Headphones className="w-6 h-6" />}
              </span>
              <span className="text-sm font-semibold">
                {language === 'bn' && cat.nameBn ? cat.nameBn : cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Flash Sale */}
      {websiteSettings.showFlashSale && flashProducts.length > 0 && (
        <section aria-labelledby="flash-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-light-secondary dark:text-dark-secondary" />
              <h2 id="flash-heading" className="font-headline text-2xl font-bold">{t('flashSale')}</h2>
            </div>
            <div className="px-3 py-1 rounded-lg bg-light-secondary-container/20 dark:bg-dark-secondary-container text-light-secondary dark:text-dark-on-secondary-container font-mono text-sm font-semibold tabular-nums">
              Ends in {countdownStr}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {flashProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Promotional Coupon Banner */}
      {promoBanner && (
        <section className="rounded-2xl bg-light-primary-container text-light-on-primary p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-light-on-primary-container">Special Offer</span>
            <h3 className="font-headline text-xl font-bold">
              {language === 'bn' && promoBanner.titleBn ? promoBanner.titleBn : promoBanner.title}
            </h3>
            <p className="text-sm text-light-on-primary-container">{promoBanner.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="px-4 py-2 rounded-lg bg-light-surface text-light-primary font-mono text-sm font-bold">
              {promoBanner.badgeText || 'SHIKDER250'}
            </span>
            <Link
              to="/products"
              className="px-4 py-2 rounded-full bg-light-secondary text-light-on-secondary text-sm font-semibold whitespace-nowrap"
            >
              Shop Now
            </Link>
          </div>
        </section>
      )}

      {/* 4. Curated Picks Tabs (Trending / Best Selling / New Arrivals / Recommended) */}
      <section aria-labelledby="curated-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="curated-heading" className="font-headline text-2xl font-bold">{t('curatedPicks')}</h2>
          <div role="tablist" className="flex items-center gap-1.5 p-1 rounded-xl bg-light-surface-container dark:bg-dark-surface-container overflow-x-auto no-scrollbar">
            {(
              [
                ['trending', t('trending')],
                ['bestselling', t('bestSelling')],
                ['arrivals', t('newArrivals')],
                ['recommended', t('recommended')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={activeTab === key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === key
                    ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tabProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* 5. Customer Reviews & Newsletter */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {websiteSettings.showReviews && (
          <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col justify-between gap-4">
            <h2 className="font-headline text-xl font-bold">{t('verifiedBuyers')}</h2>
            <div className="flex flex-col gap-4">
              <blockquote className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Mahmudul Hasan · Banani, Dhaka</span>
                  <span className="text-success font-semibold text-xs">5.0 ★ Verified</span>
                </div>
                <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  “Ordered the SoundPro ANC headphones in the morning and received them the same evening via Cash on Delivery. Sealed box with official SHIKDER warranty.”
                </p>
              </blockquote>
              <blockquote className="pt-3 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Nusrat Jahan · Chattogram</span>
                  <span className="text-success font-semibold text-xs">5.0 ★ Verified</span>
                </div>
                <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  “The Emerald Cotton Panjabi fabric is breathable and true to size. Arrived in Chattogram within 48 hours.”
                </p>
              </blockquote>
            </div>
          </div>
        )}

        {websiteSettings.showNewsletter && (
          <div className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col justify-center gap-3">
            <h2 className="font-headline text-xl font-bold">{t('newsletterTitle')}</h2>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {t('newsletterSubtitle')}
            </p>
            <form onSubmit={handleNewsletter} className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address for flash deals"
                className="flex-1 rounded-full px-4 py-2.5 text-sm bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <button
                type="submit"
                disabled={submittingNews}
                className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold whitespace-nowrap disabled:opacity-60"
              >
                {submittingNews ? 'Saving...' : t('subscribe')}
              </button>
            </form>
            {subscribed && (
              <p className="text-xs font-semibold text-success">{t('subscribedSuccess')}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
