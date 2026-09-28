// Review form par "Skip" dabaye gaye ride ids.
//
// Asli source of truth backend hai — skipReview API booking par flag laga deti
// hai, isliye doosre device par bhi form dobara nahi aata. Ye local list uske
// upar ek guard hai: agar skip call fail ho jaye, ya response aane se pehle user
// dashboard par pahunch jaye, tab bhi form wapas na khule.
const SKIPPED_REVIEWS_KEY = 'skipped_review_rides';

export function getSkippedReviewRides(): string[] {
  try {
    const raw = localStorage.getItem(SKIPPED_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markReviewRideSkipped(rideId: string): void {
  try {
    const ids = new Set(getSkippedReviewRides());
    ids.add(rideId);
    localStorage.setItem(SKIPPED_REVIEWS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage unavailable — backend flag hi kaafi hai
  }
}
