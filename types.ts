
export interface OSMRestaurant {
  name: string;
  latitude: number;
  longitude: number;
  'addr:street'?: string;
  'addr:postcode'?: string;
  '@id'?: string;
  amenity?: string;
  cuisine?: string;
  google_place_id?: string;
}

export interface GoogleRestaurant {
  title: string;
  street?: string;
  totalScore?: number;
  reviewsCount?: string;
  phone?: string;
  website?: string;
  categoryName?: string;
  url?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  google_place_id?: string;
}

export interface UnmatchedCacheEntry {
  normalized_name: string;
  original_name: string;
  latitude: number;
  longitude: number;
  normalized_address?: string;
  google_place_id?: string;
  source: 'overpass' | 'apify';
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
}

export type Confidence = 'High' | 'Medium' | 'Low' | 'Unmatched';
export type MatchStatus = 'pending' | 'confirmed' | 'rejected' | 'skipped' | 'auto_confirmed';
export type VideoInjectionStatus = 'idle' | 'discovering' | 'ready_for_review' | 'injected' | 'error';

export interface VideoDiscoveryResult {
  id: string;
  source_url: string;
  thumbnail_url: string;
  view_count: number;
  like_count: number;
  caption: string;
  author_handle: string;
}

export interface Match {
  id?: string;
  osmData: OSMRestaurant;
  googleData: GoogleRestaurant;
  score: number;
  confidence: Confidence;
  method: string;
  status: MatchStatus;
  reviewed_at?: string;
  
  // Secondary enrichment fields
  cover_image?: string | null;
  menu_url?: string | null;
  menu_pdf_url?: string | null;
  gallery_images?: string[];
  enriched_phone?: string | null;
  enriched_opening_hours?: Record<string, string> | null;

  // Video Injector fields
  videoStatus?: VideoInjectionStatus;
  discoveryResults?: VideoDiscoveryResult[];
  selectedVideos?: string[]; // IDs of results
}

export interface MapSpot {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  notes?: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface FlaggedItem {
  id: string;
  source: 'osm' | 'google';
  restaurant: OSMRestaurant | GoogleRestaurant;
  reason: string;
  notes?: string;
  created_at: string;
}

export interface Job {
  id: string;
  name: string;
  description?: string;
  status: 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  osmData: OSMRestaurant[];
  googleData: GoogleRestaurant[];
  matches: Match[];
  unmatchedOSM: OSMRestaurant[];
  unmatchedGoogle: GoogleRestaurant[];
  mapSpots: MapSpot[];
  flaggedItems: FlaggedItem[];
  currentReviewIndex: number;
  enriched_at?: string;
}

export interface AppSettings {
  minScore: number;
  autoConfirmThreshold: number;
  theme: 'light' | 'dark';
}

export interface SupabaseConfig {
  url: string;
  key: string;
  tableName: string;
}
