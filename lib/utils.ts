
import { OSMRestaurant, GoogleRestaurant, Match, Confidence } from '../types';

export const MANUAL_MATCHES: Record<string, string> = {
  "Joyce's Jerk Joint": "Joyce's Authentic Caribbean",
  "Soju & Co": "Soju Hanjan",
  "Patty & Bun": "Patty&Bun Kingly Street",
  "Ceconi's": "Cecconi's Pizza Bar",
  "Rudy's Neapolitan Pizza": "Rudy's Pizza Napoletana",
  "Co & Ko": "Co&Ko (Jeon's Kitchen)",
  "Senor Cevice": "Señor Ceviche Peruvian Restaurant Soho"
};

/**
 * Aggressive normalization for restaurant names
 */
export function normalizeRestaurantName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['\-\.]/g, '') // Remove punctuation (apostrophes, hyphens, periods)
    .replace(/\b(soho|london|restaurant|bar|cafe|kitchen|grill|the|street|st|piccadilly|carnaby|cuisine)\b/gi, ' ') // Remove common words/suffixes
    .replace(/\([^)]*\)/g, ' ') // Remove content in parentheses e.g. (Georgian Cuisine)
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Simple Dice's Coefficient for string similarity
export function compareStrings(s1: string, s2: string): number {
  const str1 = s1.replace(/\s+/g, '').toLowerCase();
  const str2 = s2.replace(/\s+/g, '').toLowerCase();

  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;

  const firstBigrams = new Map();
  for (let i = 0; i < str1.length - 1; i++) {
    const bigram = str1.substring(i, i + 2);
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) + 1 : 1;
    firstBigrams.set(bigram, count);
  }

  let intersectionSize = 0;
  for (let i = 0; i < str2.length - 1; i++) {
    const bigram = str2.substring(i, i + 2);
    const count = firstBigrams.has(bigram) ? firstBigrams.get(bigram) : 0;

    if (count > 0) {
      firstBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (str1.length + str2.length - 2);
}

/**
 * Client-side fuzzy matching fallback
 */
export function findFuzzyMatches(osmName: string, googleList: GoogleRestaurant[]) {
  const osmNormalized = normalizeRestaurantName(osmName);
  
  const matches = googleList
    .map((google, index) => {
      const googleNameNormalized = normalizeRestaurantName(google.title);
      const similarity = compareStrings(osmNormalized, googleNameNormalized);
      
      let confidence = Math.round(similarity * 100);
      let reason = "Possible match";

      // Match if one name is contained in the other (e.g. "Violet" in "Violet's Soho")
      if (osmNormalized.length > 3 && googleNameNormalized.length > 3) {
        if (googleNameNormalized.includes(osmNormalized) || osmNormalized.includes(googleNameNormalized)) {
          confidence = Math.max(confidence, 85);
          reason = "Name containment match";
        }
      }

      if (confidence > 90) reason = "Very similar names";
      else if (confidence > 75) reason = "Similar names";

      return {
        index: index + 1, // Store as 1-based index
        confidence,
        reason,
        source: 'fuzzy' as const
      };
    })
    .filter(m => m.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  
  return matches;
}

export function calculateMatchScore(osm: OSMRestaurant, google: GoogleRestaurant): { score: number; method: string } {
  // 1. Manual match check
  if (MANUAL_MATCHES[osm.name] === google.title) {
    return { score: 100, method: 'manual_verified' };
  }

  // 2. Core name exact match
  const osmCore = normalizeRestaurantName(osm.name);
  const googleCore = normalizeRestaurantName(google.title);
  if (osmCore && googleCore && osmCore === googleCore) {
    return { score: 100, method: 'exact_core' };
  }

  // 3. Normalized fuzzy match
  let score = compareStrings(osmCore, googleCore) * 100;
  let method = 'normalized';

  // 4. Substring check
  if (score < 85 && osmCore && googleCore && osmCore.length >= 4) {
    if (osmCore.includes(googleCore) || googleCore.includes(osmCore)) {
      score = Math.max(score, 85);
      method = 'substring';
    }
  }

  // 5. Street bonus
  const osmStreet = (osm['addr:street'] || '').toLowerCase();
  const googleStreet = (google.street || '').toLowerCase();
  if (osmStreet && googleStreet && (osmStreet.includes(googleStreet) || googleStreet.includes(osmStreet))) {
    score = Math.min(100, score + 5);
  }

  return { score: Math.round(score * 100) / 100, method };
}

export function getConfidence(score: number): Confidence {
  if (score >= 85) return 'High';
  if (score >= 70) return 'Medium';
  return 'Low';
}

export function generateExportData(matches: Match[]) {
  return matches.map(match => {
    const osm = match.osmData;
    const google = match.googleData;
    const googlePlaceId = google.url?.split('query_place_id=')[1]?.split('&')[0] || `g-${google.title.replace(/\s+/g, '-')}`;
    const address = [google.street, osm['addr:postcode']].filter(Boolean).join(', ');
    
    return {
      name: google.title,
      latitude: osm.latitude,
      longitude: osm.longitude,
      address: address,
      city: 'London',
      area: 'Soho',
      country: 'GB',
      cover_image: google.imageUrl || '',
      tiktok_url: '',
      google_place_id: googlePlaceId,
      external_place_id: osm['@id'] || '',
      rating: google.totalScore || 0,
      reviews_count: parseInt(google.reviewsCount?.replace(/,/g, '') || '0'),
      opening_hours: '',
      source: 'OSM + Google Maps',
      claimed: '',
      phone: google.phone || '',
      website: google.website || '',
      category: google.categoryName || '',
      google_maps_url: google.url || '',
      osm_name: osm.name,
      postcode: osm['addr:postcode'] || '',
      match_confidence: match.confidence,
      match_score: match.score,
      match_method: match.method
    };
  });
}
