import React, {useMemo, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';
import {Filter, Search} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {ProductCard} from '../components/ProductCard';

const PAGE_SIZE = 12;

export const ProductsPage: React.FC<{mode?: 'all' | 'category' | 'search'}> = ({mode = 'all'}) => {
  const {products, categories, brands} = useStore();
  const {slug} = useParams<{slug: string}>();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get('q') || '';
  const isFlashOnly = searchParams.get('flash') === 'true';

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'rating'>('featured');
  const [page, setPage] = useState(1);

  const activeCategoryObj = useMemo(
    () => (mode === 'category' && slug ? categories.find((c) => c.slug === slug) : undefined),
    [categories, mode, slug]
  );

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.isActive);
    if (activeCategoryObj) {
      list = list.filter((p) => p.categoryId === activeCategoryObj.id);
    } else if (selectedCategory !== 'all') {
      list = list.filter((p) => p.categoryId === selectedCategory);
    }
    if (selectedBrand !== 'all') {
      list = list.filter((p) => p.brandId === selectedBrand);
    }
    if (isFlashOnly) {
      list = list.filter((p) => p.isFlashSale);
    }
    if (urlQuery.trim()) {
      const q = urlQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameBn && p.nameBn.toLowerCase().includes(q)) ||
          p.sku.toLowerCase().includes(q) ||
          (p.shortDescription && p.shortDescription.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => (a.discountedPrice || a.regularPrice) - (b.discountedPrice || b.regularPrice));
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => (b.discountedPrice || b.regularPrice) - (a.discountedPrice || a.regularPrice));
    } else if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
    }
    return list;
  }, [activeCategoryObj, isFlashOnly, products, selectedBrand, selectedCategory, sortBy, urlQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const heading =
    mode === 'search'
      ? `Search results${urlQuery ? ` for "${urlQuery}"` : ''}`
      : activeCategoryObj
      ? activeCategoryObj.name
      : isFlashOnly
      ? 'Flash Sale Deals'
      : 'All Products';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-light-outline-variant dark:border-dark-outline-variant pb-4">
        <div>
          <h1 className="font-headline text-2xl md:text-3xl font-bold">{heading}</h1>
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            {filtered.length} products available · Single-vendor verified stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
            <Filter className="w-4 h-4" />
            <span>Filter:</span>
          </div>
          {!activeCategoryObj && (
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="rounded-lg px-3 py-1.5 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Filter by brand"
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setPage(1);
            }}
            className="rounded-lg px-3 py-1.5 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort products"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg px-3 py-1.5 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-10 text-center flex flex-col items-center gap-3">
          <Search className="w-8 h-8 text-light-outline dark:text-dark-outline" />
          <h2 className="font-headline text-lg font-bold">No matching products found</h2>
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Try clearing your search query or switching categories.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedBrand('all');
              setSearchParams({});
            }}
            className="px-5 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginated.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({length: totalPages}, (_, idx) => idx + 1).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setPage(num)}
              className={`w-9 h-9 rounded-full text-sm font-semibold tabular-nums ${
                page === num
                  ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                  : 'bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
