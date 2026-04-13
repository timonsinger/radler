'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Review {
  rating: number;
  comment?: string;
  date: string;
  customer_name: string;
}

interface Distribution {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ReviewsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [distribution, setDistribution] = useState<Distribution>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { router.replace('/login'); return; }
    setUserId(stored.id);
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiFetch(`/api/drivers/${userId}/reviews?page=${page}&limit=10`)
      .then((data) => {
        setAverageRating(data.average_rating);
        setTotalReviews(data.total_reviews);
        setDistribution(data.distribution);
        if (page === 1) setReviews(data.reviews || []);
        else setReviews((prev) => [...prev, ...(data.reviews || [])]);
        setTotalPages(data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, page]);

  const maxDistCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </Link>
          <h1 className="text-xl font-black text-white">Meine Bewertungen</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Gesamtbewertung */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p className="text-4xl font-black text-gray-900">
                {averageRating ? Number(averageRating).toFixed(1) : '–'}
              </p>
              <div className="flex justify-center mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className={`text-lg ${averageRating && s <= Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{totalReviews} Bewertungen</p>
            </div>

            {/* Balkendiagramm */}
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-4 text-right">{star}</span>
                  <span className="text-yellow-400 text-xs">★</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-yellow-400 h-full rounded-full transition-all"
                      style={{ width: `${(distribution[star as keyof Distribution] / maxDistCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-6 text-right">{distribution[star as keyof Distribution]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews Liste */}
        {reviews.length === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-3xl shadow-sm">
            <div className="text-4xl mb-3">⭐</div>
            <p className="text-gray-500">Noch keine Bewertungen erhalten</p>
          </div>
        )}

        {reviews.map((review, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1,2,3,4,5].map((s) => (
                    <span key={s} className={`text-base ${s <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700">{review.customer_name}</span>
              </div>
              {review.date && (
                <span className="text-xs text-gray-400">{formatDate(review.date)}</span>
              )}
            </div>
            {review.comment && (
              <p className="text-sm text-gray-600">{review.comment}</p>
            )}
          </div>
        ))}

        {page < totalPages && (
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading}
            className="w-full bg-white text-primary font-semibold py-4 rounded-2xl shadow-sm active:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Laden...' : 'Mehr laden'}
          </button>
        )}

        {loading && page === 1 && (
          <div className="py-8"><LoadingSpinner /></div>
        )}
      </div>
    </div>
  );
}
