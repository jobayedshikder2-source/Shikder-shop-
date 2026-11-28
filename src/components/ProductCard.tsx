import React from 'react';
import {Link} from 'react-router-dom';
import {Heart, ShoppingBag, Star} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatBDT} from '../lib/bd-locations';
import type {Product} from '../types/ecommerce';
import {ImageWithFallback} from './ImageWithFallback';

export const ProductCard: React.FC<{product: Product}> = ({product}) => {
  const {addToCart, toggleWishlist, wishlist, language, t, categories} = useStore();
  const isSaved = wishlist.includes(product.id);
  const effectivePrice =
    product.discountedPrice && product.discountedPrice > 0 && product.discountedPrice < product.regularPrice
      ? product.discountedPrice
      : product.regularPrice;
  const discountPct =
    effectivePrice < product.regularPrice
      ? Math.round(((product.regularPrice - effectivePrice) / product.regularPrice) * 100)
      : 0;
  const categoryName = categories.find((c) => c.id === product.categoryId)?.name || 'Catalog';
  const displayName = language === 'bn' && product.nameBn ? product.nameBn : product.name;

  return (
    <article className="group h-full rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-3.5 flex flex-col justify-between gap-3 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="flex flex-col gap-3">
        <div className="relative rounded-lg overflow-hidden bg-light-surface-container-low dark:bg-dark-surface-container aspect-[4/3]">
          <Link to={`/products/${product.slug}`} className="block w-full h-full">
            <ImageWithFallback
              src={product.images?.[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </Link>
          {discountPct > 0 && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary text-[11px] font-semibold tabular-nums">
              -{discountPct}%
            </span>
          )}
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${
              isSaved
                ? 'bg-light-secondary text-light-on-secondary border-light-secondary'
                : 'bg-light-surface-bright/90 dark:bg-dark-surface-container/90 text-light-on-surface dark:text-dark-on-surface border-light-outline-variant dark:border-dark-outline-variant'
            }`}
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <span className="truncate">{categoryName}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums shrink-0">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span className="font-medium text-light-on-surface dark:text-dark-on-surface">
                {(product.ratingAvg ?? 0) > 0 ? product.ratingAvg.toFixed(1) : 'New'}
              </span>
              {(product.ratingCount ?? 0) > 0 && (
                <span className="text-light-outline dark:text-dark-outline">({product.ratingCount})</span>
              )}
            </span>
          </div>

          <Link to={`/products/${product.slug}`} className="hover:underline">
            <h3 className="font-title text-[15px] font-semibold text-light-on-surface dark:text-dark-on-surface line-clamp-1">
              {displayName}
            </h3>
          </Link>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="font-title text-lg font-semibold text-light-primary dark:text-dark-primary tabular-nums">
              {formatBDT(effectivePrice)}
            </span>
            {discountPct > 0 && (
              <span className="text-xs text-light-outline dark:text-dark-outline line-through tabular-nums">
                {formatBDT(product.regularPrice)}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={product.stockQuantity <= 0}
        onClick={() => addToCart(product)}
        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-transform active:scale-95 ${
          product.stockQuantity > 0
            ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary hover:opacity-95'
            : 'bg-light-surface-container-high dark:bg-dark-surface-container-high text-light-outline dark:text-dark-outline cursor-not-allowed'
        }`}
      >
        <ShoppingBag className="w-4 h-4 shrink-0" />
        <span>{product.stockQuantity > 0 ? t('addToCart') : t('outOfStock')}</span>
      </button>
    </article>
  );
};
