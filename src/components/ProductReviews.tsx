import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {formatDhakaDateTime} from '../lib/bd-locations';
import {reviewSchema} from '../lib/validators';
import {
  deleteProductReview,
  submitProductReview,
  subscribeToProductReviews,
  updateCustomerReview,
} from '../services/firestoreService';
import type {Review} from '../types/ecommerce';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

interface ProductReviewsProps {
  productId: string;
  productName?: string;
  fallbackRatingAvg?: number;
  fallbackRatingCount?: number;
  onStatsChange?: (stats: {avg: number; count: number}) => void;
}

export const ProductReviews: React.FC<ProductReviewsProps> = ({
  productId,
  productName,
  fallbackRatingAvg = 0,
  fallbackRatingCount = 0,
  onStatsChange,
}) => {
  const {user, authReady, isAdmin, showToast} = useStore();
  const location = useLocation();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');

  // New review form state
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit / delete state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState<number>(5);
  const [editHoverRating, setEditHoverRating] = useState<number>(0);
  const [editComment, setEditComment] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onStatsChangeRef = useRef(onStatsChange);
  onStatsChangeRef.current = onStatsChange;

  useEffect(() => {
    setLoadError(null);
    setStarFilter('all');
    setEditingId(null);
    setConfirmDeleteId(null);

    if (!authReady) {
      setLoading(true);
      return;
    }

    setLoading(true);
    const unsub = subscribeToProductReviews(
      productId,
      user?.uid,
      (nextReviews) => {
        setReviews(nextReviews);
        setLoading(false);
      },
      () => {
        setLoadError('Unable to load reviews from Firestore right now. Please refresh and try again.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [authReady, productId, user?.uid]);

  const approvedReviews = useMemo(() => reviews.filter((r) => r.isApproved), [reviews]);

  const {displayAvg, displayCount, breakdown, includesPendingPreview} = useMemo(() => {
    const ratingSource =
      approvedReviews.length > 0
        ? approvedReviews
        : fallbackRatingCount === 0 && reviews.length > 0
          ? reviews
          : [];
    const counts: Record<number, number> = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
    ratingSource.forEach((r) => {
      const clamped = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[clamped] = (counts[clamped] || 0) + 1;
    });

    const count = ratingSource.length;
    const avg =
      count > 0
        ? ratingSource.reduce((sum, r) => sum + r.rating, 0) / count
        : fallbackRatingCount > 0
          ? fallbackRatingAvg
          : 0;

    return {
      displayAvg: avg,
      displayCount: count > 0 ? count : fallbackRatingCount,
      includesPendingPreview: approvedReviews.length === 0 && ratingSource.length > 0,
      breakdown: [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: counts[star] || 0,
        pct: count > 0 ? Math.round(((counts[star] || 0) / count) * 100) : 0,
      })),
    };
  }, [approvedReviews, reviews, fallbackRatingAvg, fallbackRatingCount]);

  useEffect(() => {
    if (approvedReviews.length > 0 || (fallbackRatingCount === 0 && reviews.length > 0)) {
      onStatsChangeRef.current?.({
        avg: Number(displayAvg.toFixed(2)),
        count: displayCount,
      });
    }
  }, [approvedReviews.length, reviews.length, fallbackRatingCount, displayAvg, displayCount]);

  const filteredReviews = useMemo(() => {
    if (starFilter === 'all') return reviews;
    return reviews.filter((r) => Math.round(r.rating) === starFilter);
  }, [reviews, starFilter]);

  const activeStarValue = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!user) {
      setFormError('Please sign in with Phone, Email, or Google to submit a product review.');
      return;
    }

    const parsed = reviewSchema.safeParse({rating, comment});
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Please enter a valid rating and review.');
      return;
    }

    setSubmitting(true);
    try {
      await submitProductReview(productId, user, parsed.data.rating, parsed.data.comment, isAdmin);
      setComment('');
      setRating(5);
      setHoverRating(0);
      showToast(
        isAdmin
          ? 'Review published to product page'
          : 'Review saved in Firestore and awaiting approval'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save review to Firestore.';
      setFormError(
        msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Permission denied while saving review. Make sure you are signed in to your account.'
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (rev: Review) => {
    setEditingId(rev.id);
    setEditRating(Math.min(5, Math.max(1, Math.round(rev.rating))));
    setEditHoverRating(0);
    setEditComment(rev.comment);
    setEditError(null);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = async (reviewId: string) => {
    setEditError(null);
    if (!user) return;
    const parsed = reviewSchema.safeParse({rating: editRating, comment: editComment});
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message || 'Please enter a valid rating and review.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateCustomerReview(reviewId, user, parsed.data.rating, parsed.data.comment, isAdmin);
      setEditingId(null);
      showToast(isAdmin ? 'Review updated' : 'Review updated and submitted for approval');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update review');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    setDeletingId(reviewId);
    try {
      await deleteProductReview(reviewId);
      setConfirmDeleteId(null);
      showToast('Review deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete review');
    } finally {
      setDeletingId(null);
    }
  };

  const redirectTarget = `/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <section
      aria-label={`Customer reviews${productName ? ` for ${productName}` : ''}`}
      className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 md:p-8 flex flex-col gap-8"
    >
      {/* Header & Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 flex flex-col gap-2">
          <h2 className="font-headline text-xl md:text-2xl font-bold">
            Customer Reviews
          </h2>
          <div className="flex items-baseline gap-3 pt-1">
            <span className="font-headline text-4xl font-extrabold tabular-nums text-light-on-surface dark:text-dark-on-surface">
              {displayAvg > 0 ? displayAvg.toFixed(1) : '0.0'}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1" aria-label={`Rated ${displayAvg.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(displayAvg)
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-light-outline-variant dark:text-dark-outline-variant'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                Based on {displayCount} {displayCount === 1 ? 'review' : 'reviews'}
                {includesPendingPreview ? ' (includes pending preview)' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* 5-Star Distribution Bars */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          {breakdown.map((row) => (
            <div key={row.star} className="flex items-center gap-3 text-xs">
              <span className="w-10 font-medium text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums shrink-0">
                {row.star} ★
              </span>
              <div className="flex-1 h-2 rounded-full bg-light-surface-container-high dark:bg-dark-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-200"
                  style={{width: `${row.pct}%`}}
                />
              </div>
              <span className="w-12 text-right text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums shrink-0">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Write a Review Form */}
      <div className="border-t border-light-outline-variant dark:border-dark-outline-variant pt-6">
        {!authReady ? (
          <div className="h-28 rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container animate-pulse" />
        ) : !user ? (
          <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-light-primary dark:text-dark-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Sign in to review this product</p>
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                  Verified customer reviews help shoppers across Bangladesh make confident purchases.
                </p>
              </div>
            </div>
            <Link
              to={redirectTarget}
              className="px-5 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Sign In with Google
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Write a Review
                </h3>
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Posting as {user.displayName || user.email?.split('@')[0] || 'Verified Shopper'}
                </p>
              </div>
              <span className="text-xs font-medium text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                {activeStarValue} / 5 · {RATING_LABELS[activeStarValue]}
              </span>
            </div>

            {/* Interactive Star Rating Selector */}
            <div
              role="radiogroup"
              aria-label="Select star rating"
              className="flex items-center gap-1"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= activeStarValue;
                const selected = star === rating;
                return (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${star} ${star === 1 ? 'Star' : 'Stars'} — ${RATING_LABELS[star]}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onClick={() => setRating(star)}
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-150 hover:scale-105 focus-visible:outline-2 focus-visible:outline-light-primary dark:focus-visible:outline-dark-primary"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        filled
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-light-outline-variant dark:text-dark-outline-variant'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={`review-comment-${productId}`} className="text-xs font-semibold">
                Your Review
              </label>
              <textarea
                id={`review-comment-${productId}`}
                rows={3}
                maxLength={1000}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Share build quality, delivery experience, or how well it matches expectations..."
                className="w-full rounded-xl px-3.5 py-2.5 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant focus-visible:outline-2 focus-visible:outline-light-primary dark:focus-visible:outline-dark-primary"
              />
              <div className="flex items-center justify-between text-[11px] text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                <span>Minimum 3 characters</span>
                <span>{comment.length} / 1000</span>
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-xl bg-light-error-container text-light-on-error-container px-4 py-3 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
              {!isAdmin && (
                <span className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  New reviews appear immediately to you and publish publicly after quick approval.
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Filter Controls + Review Feed */}
      <div className="border-t border-light-outline-variant dark:border-dark-outline-variant pt-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-light-primary dark:text-dark-primary" />
            <span>Reviews ({filteredReviews.length})</span>
          </h3>

          <div
            role="group"
            aria-label="Filter reviews by star rating"
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container"
          >
            <button
              type="button"
              onClick={() => setStarFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                starFilter === 'all'
                  ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface shadow-xs'
                  : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
              }`}
            >
              All ({reviews.length})
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStarFilter(star)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium tabular-nums whitespace-nowrap shrink-0 transition-colors ${
                  starFilter === star
                    ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-high text-light-on-surface dark:text-dark-on-surface shadow-xs'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
                }`}
              >
                {star} ★
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="rounded-xl bg-light-error-container text-light-on-error-container p-4 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="h-20 rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container"
              />
            ))}
          </div>
        ) : filteredReviews.length === 0 ? (
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant py-3">
            {starFilter === 'all'
              ? 'No reviews yet. Be the first signed-in customer to share feedback on this product.'
              : `No ${starFilter}-star reviews yet.`}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
            {filteredReviews.map((rev) => {
              const isAuthor = Boolean(user && rev.userId === user.uid);
              const canDelete = Boolean(isAuthor || isAdmin);
              const isEditing = editingId === rev.id;

              return (
                <article key={rev.id} className="py-4 first:pt-1 last:pb-1 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      <span className="font-semibold text-light-on-surface dark:text-dark-on-surface">
                        {rev.userName}
                      </span>
                      <span aria-hidden="true">·</span>
                      {rev.isApproved ? (
                        <span className="inline-flex items-center gap-1 text-success font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          Pending approval
                        </span>
                      )}
                      {Boolean(rev.createdAt) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{formatDhakaDateTime(rev.createdAt)}</span>
                        </>
                      )}
                    </div>

                    {(isAuthor || canDelete) && !isEditing && (
                      <div className="flex items-center gap-2">
                        {isAuthor && (
                          <button
                            type="button"
                            onClick={() => startEdit(rev)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-light-primary dark:text-dark-primary hover:underline whitespace-nowrap shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          confirmDeleteId === rev.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                disabled={deletingId === rev.id}
                                onClick={() => handleDelete(rev.id)}
                                className="text-xs font-semibold text-light-error dark:text-dark-error hover:underline whitespace-nowrap shrink-0"
                              >
                                {deletingId === rev.id ? 'Deleting...' : 'Confirm Delete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant hover:underline whitespace-nowrap shrink-0"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(rev.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-error dark:hover:text-dark-error whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="pt-1 flex flex-col gap-3">
                      <div
                        role="radiogroup"
                        aria-label="Edit star rating"
                        className="flex items-center gap-1"
                        onMouseLeave={() => setEditHoverRating(0)}
                      >
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = star <= (editHoverRating || editRating);
                          return (
                            <button
                              key={star}
                              type="button"
                              role="radio"
                              aria-checked={star === editRating}
                              aria-label={`Set rating to ${star} stars`}
                              onMouseEnter={() => setEditHoverRating(star)}
                              onClick={() => setEditRating(star)}
                              className="w-9 h-9 rounded-lg flex items-center justify-center"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  active
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-light-outline-variant dark:text-dark-outline-variant'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        rows={2}
                        maxLength={1000}
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                      />
                      {editError && (
                        <p role="alert" className="text-xs text-light-error dark:text-dark-error">
                          {editError}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingEdit}
                          onClick={() => handleSaveEdit(rev.id)}
                          className="px-4 py-1.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold disabled:opacity-50"
                        >
                          {savingEdit ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-4 py-1.5 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1" aria-label={`${rev.rating} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= Math.round(rev.rating)
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-light-outline-variant dark:text-dark-outline-variant'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm leading-relaxed text-light-on-surface-variant dark:text-dark-on-surface-variant whitespace-pre-line">
                        {rev.comment}
                      </p>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
