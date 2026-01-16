
export interface OSMRestaurant {
  name: string;
  latitude: number;
  longitude: number;
  'addr:street'?: string;
  'addr:postcode'?: string;
  '@id'?: string;
  amenity?: string;
  cuisine?: string;
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
}

export type Confidence = 'High' | 'Medium' | 'Low' | 'Unmatched';
export type MatchStatus = 'pending' | 'confirmed' | 'rejected' | 'skipped' | 'auto_confirmed';

export interface Match {
  id?: string;
  osmData: OSMRestaurant;
  googleData: GoogleRestaurant;
  score: number;
  confidence: Confidence;
  method: string;
  status: MatchStatus;
  reviewed_at?: string;
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
