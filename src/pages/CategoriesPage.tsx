import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, Grid} from 'lucide-react';
import {useStore} from '../context/StoreContext';

export const CategoriesPage: React.FC = () => {
  const {categories, products, language} = useStore();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">Product Categories</h1>
        <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Explore curated collections shipped directly from our Dhaka fulfillment center.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const count = products.filter((p) => p.categoryId === cat.id && p.isActive).length;
          return (
            <Link
              key={cat.id}
              to={`/categories/${cat.slug}`}
              className="rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex items-center justify-between gap-4 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-xl bg-light-surface-container dark:bg-dark-surface-container text-light-primary dark:text-dark-primary flex items-center justify-center">
                  <Grid className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="font-title text-lg font-semibold">
                    {language === 'bn' && cat.nameBn ? cat.nameBn : cat.name}
                  </h2>
                  <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                    {count} {count === 1 ? 'product' : 'products'}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-light-outline dark:text-dark-outline" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};
