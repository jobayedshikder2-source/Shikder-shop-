import React from 'react';
import {Link} from 'react-router-dom';
import {Heart, ShoppingBag, Trash2} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatBDT} from '../lib/bd-locations';
import {ImageWithFallback} from '../components/ImageWithFallback';

export const WishlistPage: React.FC = () => {
  const {wishlist, products, toggleWishlist, addToCart} = useStore();
  const savedProducts = products.filter((p) => wishlist.includes(p.id));

  if (savedProducts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <span className="w-16 h-16 rounded-full bg-light-surface-container dark:bg-dark-surface-container flex items-center justify-center text-light-secondary dark:text-dark-secondary">
          <Heart className="w-8 h-8" />
        </span>
        <h1 className="font-headline text-2xl font-bold">Your wishlist is empty</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Save products you love so you can easily add them to your cart later.
        </p>
        <Link
          to="/products"
          className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      <h1 className="font-headline text-2xl md:text-3xl font-bold">Saved Wishlist ({savedProducts.length})</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {savedProducts.map((p) => {
          const price = p.discountedPrice && p.discountedPrice > 0 ? p.discountedPrice : p.regularPrice;
          return (
            <article key={p.id} className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-4 flex flex-col justify-between gap-3">
              <div className="flex flex-col gap-2.5">
                <Link to={`/products/${p.slug}`} className="aspect-[4/3] rounded-lg overflow-hidden bg-light-surface-container">
                  <ImageWithFallback src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover" />
                </Link>
                <Link to={`/products/${p.slug}`} className="font-title font-semibold text-sm hover:underline line-clamp-1">
                  {p.name}
                </Link>
                <span className="font-title font-bold text-base text-light-primary dark:text-dark-primary tabular-nums">
                  {formatBDT(price)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={p.stockQuantity <= 0}
                  onClick={() => addToCart(p)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold disabled:opacity-50"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Move to Cart</span>
                </button>
                <button
                  type="button"
                  aria-label="Remove from wishlist"
                  onClick={() => toggleWishlist(p.id)}
                  className="p-2 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-light-outline hover:text-light-error"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
