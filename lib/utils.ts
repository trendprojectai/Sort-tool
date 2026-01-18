import { OSMRestaurant, GoogleRestaurant, Match, Confidence, UnmatchedCacheEntry } from '../types';

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
 * Deterministic name normalization as per unmatched assistant requirements
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  const stopWords = ["restaurant", "cafe", "kitchen", "bar", "grill", "ltd", "limited"];
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .split(/\s+/)
    .filter(word => word && !stopWords.includes(word))
    .join(' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Standard Haversine distance in meters
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Wrapped Dice Coefficient similarity
 */
export function safeSimilarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  return compareStrings(normA, normB);
}

/**
 * Aggressive normalization for restaurant names (legacy used by global matching)
 */
export function normalizeRestaurantName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['\-\.]/g, '')
    .replace(/\b(soho|london|restaurant|bar|cafe|kitchen|grill|the|street|st|piccadilly|carnaby|cuisine)\b/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
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

export function calculateMatchScore(osm: OSMRestaurant, google: GoogleRestaurant): { score: number; method: string } {
  // Global matching logic remains separate for stability
  if (MANUAL_MATCHES[osm.name] === google.title) {
    return { score: 100, method: 'manual_verified' };
  }
  const osmCore = normalizeRestaurantName(osm.name);
  const googleCore = normalizeRestaurantName(google.title);
  if (osmCore && googleCore && osmCore === googleCore) {
    return { score: 100, method: 'exact_core' };
  }
  let score = compareStrings(osmCore, googleCore) * 100;
  let method = 'normalized';
  if (score < 85 && osmCore && googleCore && osmCore.length >= 4) {
    if (osmCore.includes(googleCore) || googleCore.includes(osmCore)) {
      score = Math.max(score, 85);
      method = 'substring';
    }
  }
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

/**
 * Check if an item has a historical presence in the Unmatched Cache
 */
export function checkUnmatchedMemoryCache(item: OSMRestaurant | GoogleRestaurant, cache: UnmatchedCacheEntry[]) {
  const name = 'name' in item ? item.name : item.title;
  const normalized_name = normalizeName(name);
  const placeId = item.google_place_id;
  const lat = item.latitude || 0;
  const lng = item.longitude || 0;

  const found = cache.find(e => {
    // Exact Place ID match
    if (placeId && e.google_place_id === placeId) return true;
    
    // Name + Distance (100m) match
    const dist = haversineDistance(lat, lng, e.latitude, e.longitude);
    if (dist <= 100) {
        const similarity = compareStrings(normalized_name, e.normalized_name);
        if (similarity > 0.85) return true;
    }
    return false;
  });

  if (found) {
    return {
        seen_before: true,
        reason: `Previously unmatched (${found.seen_count}x). First seen: ${new Date(found.first_seen_at).toLocaleDateString()}`,
        count: found.seen_count
    };
  }

  return { seen_before: false };
}

/**
 * Deterministic Ranked Suggestions for Unmatched Assistant
 */
export function getDeterministicSuggestions(osm: OSMRestaurant, candidates: GoogleRestaurant[], cache: UnmatchedCacheEntry[]) {
  const normOSMName = normalizeName(osm.name);

  return candidates
    .map((google, index) => {
      // 1. Google Place ID Gating
      if (osm.google_place_id && google.google_place_id) {
        if (osm.google_place_id !== google.google_place_id) return null;
      }

      // 2. Distance Gating (Hard 150m cutoff)
      let dist = Infinity;
      if (osm.latitude && osm.longitude && google.latitude && google.longitude) {
        dist = haversineDistance(osm.latitude, osm.longitude, google.latitude, google.longitude);
        if (dist > 150) return null;
      }

      // 3. Name Similarity
      const normGoogleName = normalizeName(google.title);
      const nameSim = safeSimilarity(osm.name, google.title);
      
      // Substring check
      const isSubstring = normGoogleName.includes(normOSMName) || normOSMName.includes(normGoogleName);
      const effectiveNameSim = isSubstring ? Math.max(nameSim, 0.8) : nameSim;

      // 4. Address overlap
      const addrOverlap = safeSimilarity(osm['addr:street'] || '', google.street || '');

      // 5. Memory Cache Check (Deterministic matching helper)
      const cacheInfo = checkUnmatchedMemoryCache(google, cache);

      // 6. Confidence Calculation
      let score = 0;
      score += effectiveNameSim * 0.5;
      
      // Distance Scoring
      if (dist !== Infinity) {
        if (dist <= 75) score += 0.3; // Higher rank for < 75m
        else if (dist <= 150) score += 0.15;
      } else {
        score += 0.15; // Neutral if missing coords
      }

      score += addrOverlap * 0.2;

      // Bonus for Place ID match
      if (osm.google_place_id && google.google_place_id && osm.google_place_id === google.google_place_id) {
        score = Math.min(1, score + 0.2);
      }

      let reason = "Possible match";
      if (effectiveNameSim > 0.9 && dist < 50) reason = "Name + distance";
      else if (osm.google_place_id === google.google_place_id && google.google_place_id) reason = "Matched Place ID";
      else if (isSubstring) reason = "Core name overlap";
      else if (addrOverlap > 0.8) reason = "Address match";
      
      if (cacheInfo.seen_before) {
        reason += ` | ${cacheInfo.reason}`;
      }

      return {
        apify_id: google.url || `idx-${index}`,
        index: index + 1,
        name: google.title,
        distance_meters: dist === Infinity ? null : Math.round(dist),
        confidence_score: Math.round(score * 100) / 100,
        reason,
        seen_before: cacheInfo.seen_before,
        source: 'deterministic'
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null && s.confidence_score > 0.4)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 10);
}

export function generateExportData(matches: Match[]) {
  return matches.map(match => {
    const osm = match.osmData;
    const google = match.googleData;
    const googlePlaceId = google.google_place_id || google.url?.split('query_place_id=')[1]?.split('&')[0] || `g-${google.title.replace(/\s+/g, '-')}`;
    const address = [google.street, osm['addr:postcode']].filter(Boolean).join(', ');
    
    // Helper to ensure we don't send empty strings to potentially typed columns (boolean/numeric)
    const nullIfEmpty = (val: any) => (val === '' || val === undefined || val === null) ? null : val;
    
    // Robust numeric parsing
    const parseNum = (val: any) => {
      const n = Number(String(val).replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? 0 : n;
    };

    return {
      name: google.title,
      latitude: parseNum(osm.latitude),
      longitude: parseNum(osm.longitude),
      address: nullIfEmpty(address),
      city: 'London',
      area: 'Soho',
      country: 'GB',
      cover_image: nullIfEmpty(match.cover_image || google.imageUrl),
      tiktok_url: null,
      google_place_id: googlePlaceId,
      external_place_id: nullIfEmpty(osm['@id']),
      rating: parseNum(google.totalScore),
      reviews_count: Math.floor(parseNum(google.reviewsCount)),
      opening_hours: match.enriched_opening_hours ? JSON.stringify(match.enriched_opening_hours) : null,
      source: 'OSM + Google Maps',
      claimed: null, 
      phone: nullIfEmpty(match.enriched_phone || google.phone),
      website: nullIfEmpty(google.website),
      category_name: nullIfEmpty(google.categoryName),
      google_maps_url: nullIfEmpty(google.url),
      osm_name: osm.name,
      postcode: nullIfEmpty(osm['addr:postcode']),
      match_confidence: match.confidence,
      match_score: parseNum(match.score),
      match_method: match.method,
      menu_url: nullIfEmpty(match.menu_url),
      menu_pdf_url: nullIfEmpty(match.menu_pdf_url),
      gallery_images: match.gallery_images ? JSON.stringify(match.gallery_images) : null,
      enriched_phone: nullIfEmpty(match.enriched_phone),
      tripadvisor_url: nullIfEmpty(match.tripadvisor_url),
      tripadvisor_confidence: nullIfEmpty(match.tripadvisor_confidence),
      tripadvisor_distance_m: nullIfEmpty(match.tripadvisor_distance_m),
      tripadvisor_status: nullIfEmpty(match.tripadvisor_status),
      tripadvisor_match_notes: nullIfEmpty(match.tripadvisor_match_notes)
    };
  });
}