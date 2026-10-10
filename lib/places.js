// Google Places API (New) Text Search. Server only: uses the secret GOOGLE_PLACES_API_KEY.
// https://developers.google.com/maps/documentation/places/web-service/text-search

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

// Only the fields we store. Phone and website put requests in Google's higher-priced tier,
// which has its own free monthly allowance.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',');

// One page (up to 20 results). Follow-up pages repeat the same request plus the page token.
export async function searchPlaces({ textQuery, pageToken }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY is not set (.env.local locally, Netlify environment variables live).');

  const body = { textQuery, pageSize: 20, languageCode: 'en', regionCode: 'IN', includedType: 'real_estate_agency', strictTypeFiltering: true };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const hint = res.status === 429 ? ' Google\'s daily limit for this key is reached; try again tomorrow.' : '';
    throw new Error(`Google refused the search: ${data?.error?.message || `HTTP ${res.status}`}.${hint}`);
  }
  return { places: data.places ?? [], nextPageToken: data.nextPageToken ?? null };
}
