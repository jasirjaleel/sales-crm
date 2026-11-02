// Known fields the app understands
export const TARGET_FIELDS = [
  { value: 'name',           label: 'Business Name' },
  { value: 'phone',          label: 'Phone Number' },
  { value: 'website',        label: 'Website URL' },
  { value: 'location',       label: 'Location / Area' },
  { value: 'googleMapsUrl',  label: 'Google Maps Link' },
  { value: 'businessType',   label: 'Business Type' },
  { value: 'category',       label: 'Category' },
  { value: 'reviews',        label: 'Number of Reviews' },
  { value: 'averageRating',  label: 'Average Rating' },
  { value: 'notes',          label: 'Notes' },
  { value: 'skip',           label: '— Skip this column —' },
];

// Whole-word patterns, most specific first. Order matters: "Number of Reviews" has to
// reach reviews before phone, and "Google Maps Link" has to reach maps before website.
const FIELD_PATTERNS = [
  ['googleMapsUrl', /\b(google|maps?|gmaps?|directions?)\b/],
  ['reviews',       /\b(reviews?|ratings? count)\b/],
  ['averageRating', /\b(ratings?|average|avg|stars?|score)\b/],
  ['businessType',  /\b(type|kind|sector)\b/],
  ['category',      /\b(categor(y|ies)|cat|industry|vertical)\b/],
  ['website',       /\b(websites?|web|urls?|site|link)\b/],
  ['notes',         /\b(notes?|remarks?|comments?|description)\b/],
  ['name',          /\b(names?|business|company|shop|store)\b/],
  ['phone',         /\b(phones?|mobile|contact|number|ph|tel|telephone|whatsapp)\b/],
  ['location',      /\b(location|area|place|address|city|district)\b/],
];

export function autoMapColumns(headers) {
  const used = new Set();
  return headers.map(header => {
    const h = String(header).toLowerCase().trim();
    for (const [field, pattern] of FIELD_PATTERNS) {
      if (pattern.test(h)) {
        // A second "Phone 2" column would overwrite the first, so only map each field once.
        if (used.has(field)) return 'skip';
        used.add(field);
        return field;
      }
    }
    return 'skip';  // no match found
  });
}

// Calculate lead score client-side before sending to backend
export function calculateScore(averageRating, reviews) {
  const rating = parseFloat(averageRating) || 0;
  const rev = parseInt(reviews, 10) || 0;
  if (rating === 0 && rev === 0) return 0;

  const ratingScore  = (rating / 5) * 6;
  const reviewScore  = (Math.min(rev, 200) / 200) * 4;
  return Math.round((ratingScore + reviewScore) * 10) / 10;
}
