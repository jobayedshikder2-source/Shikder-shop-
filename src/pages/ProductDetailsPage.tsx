import React, {useEffect, useMemo, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {Heart, Minus, Plus, ShieldCheck, ShoppingBag, Star, Truck} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatBDT} from '../lib/bd-locations';
import {ImageWithFallback} from '../components/ImageWithFallback';
import {ProductCard} from '../components/ProductCard';
import {ProductReviews} from '../components/ProductReviews';

export const ProductDetailsPage: React.FC = () => {
  const {slug} = useParams<{slug: string}>();
  const {products, categories, brands, addToCart, toggleWishlist, wishlist, language} = useStore();

  const product = useMemo(() => products.find((p) => p.slug === slug), [products, slug]);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [liveReviewStats, setLiveReviewStats] = useState<{avg: number; count: number} | null>(null);

  useEffect(() => {
    if (product) {
      setSelectedVariantId(product.variants?.[0]?.id || '');
      setSelectedImageIdx(0);
      setQuantity(1);
      setLiveReviewStats(null);
      document.title = product.seoTitle || `${product.name} — SHIKDER SHOP`;
    }
  }, [product]);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <h1 className="font-headline text-2xl font-bold">Product Not Found</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          This item may have been removed or unpublished.
        </p>
        <Link to="/products" className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold">
          Browse Catalog
        </Link>
      </div>
    );
  }

  const category = categories.find((c) => c.id === product.categoryId);
  const brand = brands.find((b) => b.id === product.brandId);
  const activeVariant = product.variants?.find((v) => v.id === selectedVariantId) || product.variants?.[0];
  const price =
    product.discountedPrice && product.discountedPrice > 0 && product.discountedPrice < product.regularPrice
      ? product.discountedPrice
      : product.regularPrice;
  const isSaved = wishlist.includes(product.id);
  const related = products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    image: product.images,
    description: product.shortDescription || product.description,
    brand: {'@type': 'Brand', name: brand?.name || 'SHIKDER SHOP'},
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BDT',
      price: String(price),
      availability: product.stockQuantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-10">
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
        <Link to="/" className="hover:underline">Home</Link>
        <span>/</span>
        {category && (
          <>
            <Link to={`/categories/${category.slug}`} className="hover:underline">{category.name}</Link>
            <span>/</span>
          </>
        )}
        <span className="truncate font-medium text-light-on-surface dark:text-dark-on-surface">{product.name}</span>
      </nav>

      {/* Main Product Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Gallery */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container aspect-[4/3]">
            <ImageWithFallback
              src={product.images?.[selectedImageIdx] || product.images?.[0]}
              alt={product.name}
              priority
              className="w-full h-full object-cover"
            />
          </div>
          {product.images?.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 ${
                    selectedImageIdx === idx
                      ? 'border-light-primary dark:border-dark-primary'
                      : 'border-light-outline-variant dark:border-dark-outline-variant'
                  }`}
                >
                  <ImageWithFallback src={img} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Contiguous Purchase Module */}
        <div className="lg:col-span-6 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <span>{brand?.name || 'SHIKDER Originals'}</span>
              <span>·</span>
              <span className="font-mono">SKU: {product.sku}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                {(liveReviewStats?.avg ?? product.ratingAvg)?.toFixed(1) || '4.8'} ({liveReviewStats?.count ?? product.ratingCount ?? 0})
              </span>
            </div>
            <h1 className="font-headline text-2xl md:text-3xl font-bold">
              {language === 'bn' && product.nameBn ? product.nameBn : product.name}
            </h1>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {product.shortDescription}
            </p>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="font-headline text-3xl font-extrabold text-light-primary dark:text-dark-primary tabular-nums">
              {formatBDT(price)}
            </span>
            {price < product.regularPrice && (
              <span className="text-base text-light-outline dark:text-dark-outline line-through tabular-nums">
                {formatBDT(product.regularPrice)}
              </span>
            )}
            <span className={`ml-auto text-xs font-semibold ${product.stockQuantity > 0 ? 'text-success' : 'text-light-error dark:text-dark-error'}`}>
              {product.stockQuantity > 0 ? `In Stock (${product.stockQuantity} left)` : 'Out of Stock'}
            </span>
          </div>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Select Option
              </span>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const label = [v.color, v.size].filter(Boolean).join(' · ') || 'Standard';
                  const active = activeVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'border-light-primary dark:border-dark-primary bg-light-primary/10 dark:bg-dark-primary/15 text-light-primary dark:text-dark-primary'
                          : 'border-light-outline-variant dark:border-dark-outline-variant'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity & Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="inline-flex items-center rounded-full border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => Math.min(product.stockQuantity || 1, q + 1))}
                className="w-10 h-10 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={product.stockQuantity <= 0}
              onClick={() =>
                addToCart(product, {
                  variantId: activeVariant?.id,
                  color: activeVariant?.color,
                  size: activeVariant?.size,
                  quantity,
                })
              }
              className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{product.stockQuantity > 0 ? 'Add to Cart' : 'Out of Stock'}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label="Toggle wishlist"
              className={`w-11 h-11 rounded-full border flex items-center justify-center ${
                isSaved
                  ? 'border-light-secondary bg-light-secondary text-light-on-secondary'
                  : 'border-light-outline-variant dark:border-dark-outline-variant'
              }`}
            >
              <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="pt-3 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-light-primary dark:text-dark-primary shrink-0" />
              <span>{product.shippingInfo || 'Fast delivery across all 64 districts of Bangladesh.'}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-success shrink-0" />
              <span>Cash on Delivery & 7-day easy returns available.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description & Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-3">
          <h2 className="font-headline text-xl font-bold">Product Details</h2>
          <p className="text-sm leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant whitespace-pre-line">
            {product.description || product.shortDescription}
          </p>
        </section>

        <section className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-3">
          <h2 className="font-headline text-xl font-bold">Specifications</h2>
          <dl className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant text-sm">
            {(product.specifications || []).map((spec, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-light-on-surface-variant dark:text-dark-on-surface-variant">{spec.label}</dt>
                <dd className="font-semibold text-right">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <ProductReviews
        productId={product.id}
        productName={product.name}
        fallbackRatingAvg={product.ratingAvg}
        fallbackRatingCount={product.ratingCount}
        onStatsChange={setLiveReviewStats}
      />

      {related.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-headline text-xl font-bold">Related Products</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
