import { Job, Match } from '../types';
import Papa from 'papaparse';

export interface EnrichedData {
  google_place_id: string;
  cover_image?: string | null;
  menu_url?: string | null;
  menu_pdf_url?: string | null;
  gallery_images?: string; // Expecting JSON string from Python
  phone?: string | null;
  opening_hours?: string; // Expecting JSON string from Python
  // TripAdvisor fields that might be returned by the scraper
  tripadvisor_status?: string | null;
  tripadvisor_url?: string | null;
  tripadvisor_confidence?: number | null;
  tripadvisor_distance_m?: number | null;
  tripadvisor_match_notes?: string | null;
}

/**
 * Exports current job matches to CSV format for the Python script.
 * Now includes TripAdvisor validation fields to ensure no data loss in the multi-stage pipeline.
 */
export function exportJobToCSV(job: Job): string {
  // Only export confirmed or auto_confirmed matches
  const exportMatches = job.matches.filter(m => 
    m.status === 'confirmed' || m.status === 'auto_confirmed'
  );

  const data = exportMatches.map(match => {
    const google = match.googleData;
    
    // Extract place ID consistently
    const googlePlaceId = google.google_place_id || 
                         google.url?.split('query_place_id=')[1]?.split('&')[0] || 
                         `g-${google.title.replace(/\s+/g, '-')}`;

    // Include the core fields expected by the secondary scraper
    // PLUS the TripAdvisor validation fields to satisfy "Do NOT drop or ignore them"
    return {
      google_place_id: String(googlePlaceId || ''),
      name: String(google.title || ''),
      website: String(google.website || ''),
      area: 'Soho', 
      city: 'London',
      address: String(google.street || ''),
      tripadvisor_status: match.tripadvisor_status || '',
      tripadvisor_url: match.tripadvisor_url || '',
      tripadvisor_confidence: match.tripadvisor_confidence || '',
      tripadvisor_distance_m: match.tripadvisor_distance_m || '',
      tripadvisor_match_notes: match.tripadvisor_match_notes || ''
    };
  });

  return Papa.unparse(data);
}

/**
 * Parses the enriched CSV output from the Python script
 */
export function parseEnrichedCSV(csvText: string): EnrichedData[] {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true
  });
  return result.data as EnrichedData[];
}

/**
 * Merges enriched data fields back into the job matches
 */
export function mergeEnrichedData(job: Job, enrichedData: EnrichedData[]): Job {
  const dataMap = new Map<string, EnrichedData>();
  enrichedData.forEach(item => {
    if (item.google_place_id) {
      dataMap.set(item.google_place_id, item);
    }
  });

  const updatedMatches = job.matches.map(match => {
    const google = match.googleData;
    const googlePlaceId = google.google_place_id || 
                         google.url?.split('query_place_id=')[1]?.split('&')[0] || 
                         `g-${google.title.replace(/\s+/g, '-')}`;

    const enrichment = dataMap.get(googlePlaceId);

    if (!enrichment) return match;

    // Helper to safely parse JSON strings from Python
    const safeJsonParse = (val: any, fallback: any) => {
      if (!val || val === 'null') return fallback;
      if (typeof val !== 'string') return val || fallback;
      try {
        return JSON.parse(val);
      } catch (e) {
        console.warn('Failed to parse enrichment field:', e);
        return fallback;
      }
    };

    // Return a Match object, explicitly casting properties to satisfy TypeScript union types
    return {
      ...match,
      cover_image: enrichment.cover_image || match.cover_image,
      menu_url: enrichment.menu_url || match.menu_url,
      menu_pdf_url: enrichment.menu_pdf_url || match.menu_pdf_url,
      gallery_images: safeJsonParse(enrichment.gallery_images, match.gallery_images || []),
      enriched_phone: enrichment.phone || match.enriched_phone,
      enriched_opening_hours: safeJsonParse(enrichment.opening_hours, match.enriched_opening_hours || null),
      // Update TA fields if present in enrichment.
      // Fix: Type 'string' is not assignable to type '"pending" | "found" | "not_found"'.
      tripadvisor_status: (enrichment.tripadvisor_status as any) || match.tripadvisor_status,
      tripadvisor_url: enrichment.tripadvisor_url || match.tripadvisor_url,
      tripadvisor_confidence: enrichment.tripadvisor_confidence !== undefined ? enrichment.tripadvisor_confidence : match.tripadvisor_confidence,
      tripadvisor_distance_m: enrichment.tripadvisor_distance_m !== undefined ? enrichment.tripadvisor_distance_m : match.tripadvisor_distance_m,
      tripadvisor_match_notes: enrichment.tripadvisor_match_notes || match.tripadvisor_match_notes
    } as Match;
  });

  return {
    ...job,
    matches: updatedMatches,
    enriched_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}