/**
 * What customers say, shown on the About page.
 *
 * REAL REVIEWS ONLY. Each entry is a short excerpt of something a customer
 * actually wrote, with where it was posted. Keep excerpts brief (a sentence),
 * use a first name and last initial at most, and ask the reviewer first where
 * you can - Yelp in particular asks businesses to get permission before
 * republishing a review. Never paraphrase into quote marks or invent one.
 */
export interface CustomerReview {
  quote: string;
  /** "Janet R." - or leave out to show just the source. */
  name?: string;
  source: 'Google' | 'Yelp' | 'Nextdoor' | 'Facebook';
}

export const CUSTOMER_REVIEWS: CustomerReview[] = [
  { quote: 'Great selection and overall such a welcoming and relaxing vibe.', source: 'Google' },
];

/** Where to read (and leave) reviews. */
export const GOOGLE_REVIEWS_URL = 'https://maps.app.goo.gl/UGK8t2q3Etce2Q6P7';
