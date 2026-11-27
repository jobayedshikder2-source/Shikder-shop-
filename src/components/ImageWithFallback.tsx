import React, {useState} from 'react';
import {Package} from 'lucide-react';

interface Props {
  src?: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export const ImageWithFallback: React.FC<Props> = ({src, alt, className = '', priority = false}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-1.5 bg-light-surface-container dark:bg-dark-surface-container text-light-primary/60 dark:text-dark-primary/60 p-3 text-center ${className}`}
      >
        <Package className="w-7 h-7" />
        <span className="text-xs font-medium line-clamp-2 text-light-on-surface-variant dark:text-dark-on-surface-variant">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
