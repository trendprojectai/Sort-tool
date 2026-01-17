
import { create } from 'zustand';
import { Job, Match, OSMRestaurant, GoogleRestaurant, AppSettings, SupabaseConfig, MapSpot, FlaggedItem, UnmatchedCacheEntry, VideoInjectionStatus, VideoDiscoveryResult } from './types';
import { calculateMatchScore, getConfidence, normalizeName } from './lib/utils';

interface AppState {
  jobs: Job[];
  unmatchedCache: UnmatchedCacheEntry[];
  currentJobId: string | null;
  pushedToSecondaryId: string | null;
  pushedToVideoId: string | null;
  secondaryProcessingStatus: 'idle' | 'processing' | 'completed';
  settings: AppSettings;
  supabaseConfig: SupabaseConfig;
  
  // Computed helpers for current active job
  currentJob: () => Job | undefined;
  
  // Actions
  createJob: (name: string, description?: string) => void;
  setCurrentJobId: (id: string) => void;
  updateCurrentJob: (updates: Partial<Job>) => void;
  updateJobWithEnrichment: (jobId: string, updatedJob: Job) => void;
  
  setOSMData: (data: OSMRestaurant[]) => void;
  setGoogleData: (data: GoogleRestaurant[]) => void;
  setMatches: (matches: Match[], unmatchedOSM: OSMRestaurant[], unmatchedGoogle: GoogleRestaurant[]) => void;
  
  updateMatchStatus: (index: number, status: Match['status']) => void;
  setReviewIndex: (index: number) => void;
  addMapSpot: (spot: Omit<MapSpot, 'id' | 'created_at'>) => void;
  addFlaggedItem: (item: Omit<FlaggedItem, 'id' | 'created_at'>) => void;
  
  linkItems: (osm: OSMRestaurant, google: GoogleRestaurant) => void;
  
  resetApp: () => void;
  saveToPersistence: () => Promise<void>;
  
  // Cache Actions
  addToUnmatchedCache: (item: OSMRestaurant | GoogleRestaurant, source: 'overpass' | 'apify') => void;
  cacheAllUnmatched: () => Promise<void>;

  // Config Actions
  setSupabaseConfig: (config: SupabaseConfig) => void;

  // Theme Actions
  toggleTheme: () => void;

  // Secondary Scrape Actions
  pushToSecondary: (id: string) => void;
  setSecondaryStatus: (status: 'idle' | 'processing' | 'completed') => void;

  // Video Injector Actions
  pushToVideoInjector: (id: string) => void;
  updateMatchVideoStatus: (jobId: string, matchIndex: number, status: VideoInjectionStatus, results?: VideoDiscoveryResult[], selected?: string[]) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  minScore: 70,
  autoConfirmThreshold: 95,
  theme: 'light'
};

const persist = (jobs: Job[], currentJobId: string | null, unmatchedCache: UnmatchedCacheEntry[], supabaseConfig: SupabaseConfig, settings: AppSettings) => {
  localStorage.setItem('rmPro_jobs', JSON.stringify(jobs));
  localStorage.setItem('rmPro_unmatchedCache', JSON.stringify(unmatchedCache));
  localStorage.setItem('rmPro_supabaseConfig', JSON.stringify(supabaseConfig));
  localStorage.setItem('rmPro_settings', JSON.stringify(settings));
  if (currentJobId) {
    localStorage.setItem('rmPro_currentJobId', currentJobId);
  }
};

export const useStore = create<AppState>((set, get) => ({
  jobs: JSON.parse(localStorage.getItem('rmPro_jobs') || '[]'),
  unmatchedCache: JSON.parse(localStorage.getItem('rmPro_unmatchedCache') || '[]'),
  currentJobId: localStorage.getItem('rmPro_currentJobId') || null,
  pushedToSecondaryId: localStorage.getItem('rmPro_pushedToSecondaryId') || null,
  pushedToVideoId: localStorage.getItem('rmPro_pushedToVideoId') || null,
  secondaryProcessingStatus: 'idle',
  settings: JSON.parse(localStorage.getItem('rmPro_settings') || JSON.stringify(DEFAULT_SETTINGS)),
  supabaseConfig: JSON.parse(localStorage.getItem('rmPro_supabaseConfig') || '{"url": "", "key": "", "tableName": "restaurants"}'),

  currentJob: () => {
    const { jobs, currentJobId } = get();
    return jobs.find(j => j.id === currentJobId);
  },

  createJob: (name, description) => set((state) => {
    const newJob: Job = {
      id: crypto.randomUUID(),
      name,
      description,
      status: 'in_progress',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      osmData: [],
      googleData: [],
      matches: [],
      unmatchedOSM: [],
      unmatchedGoogle: [],
      mapSpots: [],
      flaggedItems: [],
      currentReviewIndex: 0
    };
    const nextJobs = [newJob, ...state.jobs];
    persist(nextJobs, newJob.id, state.unmatchedCache, state.supabaseConfig, state.settings);
    return {
      jobs: nextJobs,
      currentJobId: newJob.id
    };
  }),

  setCurrentJobId: (id) => {
    localStorage.setItem('rmPro_currentJobId', id);
    set({ currentJobId: id });
  },

  updateCurrentJob: (updates) => set((state) => {
    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId 
        ? { ...j, ...updates, updated_at: new Date().toISOString() } 
        : j
    );
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  }),

  updateJobWithEnrichment: (jobId, updatedJob) => set((state) => {
    const nextJobs = state.jobs.map(j => j.id === jobId ? updatedJob : j);
    persist(nextJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: nextJobs };
  }),

  setOSMData: (data) => get().updateCurrentJob({ osmData: data }),
  setGoogleData: (data) => get().updateCurrentJob({ googleData: data }),
  
  setMatches: (matches, unmatchedOSM, unmatchedGoogle) => 
    get().updateCurrentJob({ matches, unmatchedOSM, unmatchedGoogle, currentReviewIndex: 0 }),

  updateMatchStatus: (index, status) => set((state) => {
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (!job) return state;

    const newMatches = [...job.matches];
    if (newMatches[index]) {
      newMatches[index] = { 
        ...newMatches[index], 
        status, 
        reviewed_at: new Date().toISOString() 
      };
    }

    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { ...j, matches: newMatches, updated_at: new Date().toISOString() } : j
    );
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  }),

  setReviewIndex: (index: number) => set((state) => {
    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { ...j, currentReviewIndex: index, updated_at: new Date().toISOString() } : j
    );
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  }),

  addMapSpot: (spot) => set((state) => {
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (!job) return state;

    const newSpot: MapSpot = {
      ...spot,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { ...j, mapSpots: [...j.mapSpots, newSpot], updated_at: new Date().toISOString() } : j
    );
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  }),

  addFlaggedItem: (item) => set((state) => {
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (!job) return state;

    const newItem: FlaggedItem = {
      ...item,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    // Auto-record to unmatched memory cache when item is manually flagged
    get().addToUnmatchedCache(item.restaurant, item.source === 'osm' ? 'overpass' : 'apify');

    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { ...j, flaggedItems: [...j.flaggedItems, newItem], updated_at: new Date().toISOString() } : j
    );
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  }),

  linkItems: (osm, google) => set((state) => {
    const job = state.jobs.find(j => j.id === state.currentJobId);
    if (!job) return state;

    const { score, method } = calculateMatchScore(osm, google);
    const newMatch: Match = {
      osmData: osm,
      googleData: google,
      score,
      method,
      confidence: getConfidence(score),
      status: 'confirmed',
      reviewed_at: new Date().toISOString()
    };

    const newMatches = [...job.matches, newMatch];
    const newUnmatchedOSM = job.unmatchedOSM.filter(item => item['@id'] !== osm['@id']);
    const newUnmatchedGoogle = job.unmatchedGoogle.filter(item => item.url !== google.url);

    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { 
        ...j, 
        matches: newMatches, 
        unmatchedOSM: newUnmatchedOSM, 
        unmatchedGoogle: newUnmatchedGoogle, 
        updated_at: new Date().toISOString() 
      } : j
    );
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  }),

  resetApp: () => {
    localStorage.clear();
    set({ jobs: [], currentJobId: null, pushedToSecondaryId: null, pushedToVideoId: null, unmatchedCache: [], settings: DEFAULT_SETTINGS, supabaseConfig: { url: '', key: '', tableName: 'restaurants' } });
  },

  saveToPersistence: async () => {
    const { jobs, currentJobId, unmatchedCache, supabaseConfig, settings } = get();
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        persist(jobs, currentJobId, unmatchedCache, supabaseConfig, settings);
        resolve();
      }, 600);
    });
  },

  addToUnmatchedCache: (item, source) => set((state) => {
    const name = 'name' in item ? item.name : item.title;
    const normalized_name = normalizeName(name);
    const lat = item.latitude || 0;
    const lng = item.longitude || 0;
    const address = 'street' in item ? item.street : item['addr:street'];
    const placeId = item.google_place_id;

    const existingIndex = state.unmatchedCache.findIndex(e => 
      (placeId && e.google_place_id === placeId) || 
      (e.normalized_name === normalized_name && Math.abs(e.latitude - lat) < 0.001 && Math.abs(e.longitude - lng) < 0.001)
    );

    let newCache = [...state.unmatchedCache];
    const now = new Date().toISOString();

    if (existingIndex > -1) {
      const entry = newCache[existingIndex];
      newCache[existingIndex] = {
        ...entry,
        last_seen_at: now,
        seen_count: entry.seen_count + 1
      };
    } else {
      newCache.push({
        normalized_name,
        original_name: name,
        latitude: lat,
        longitude: lng,
        normalized_address: address ? normalizeName(address) : undefined,
        google_place_id: placeId,
        source,
        first_seen_at: now,
        last_seen_at: now,
        seen_count: 1
      });
    }

    localStorage.setItem('rmPro_unmatchedCache', JSON.stringify(newCache));
    return { unmatchedCache: newCache };
  }),

  cacheAllUnmatched: async () => {
    const job = get().currentJob();
    if (!job) return;

    // Process OSM
    job.unmatchedOSM.forEach(item => get().addToUnmatchedCache(item, 'overpass'));
    // Process Google
    job.unmatchedGoogle.forEach(item => get().addToUnmatchedCache(item, 'apify'));

    return Promise.resolve();
  },

  setSupabaseConfig: (config) => set((state) => {
    localStorage.setItem('rmPro_supabaseConfig', JSON.stringify(config));
    return { supabaseConfig: config };
  }),

  toggleTheme: () => set((state) => {
    const nextTheme = state.settings.theme === 'light' ? 'dark' : 'light';
    const nextSettings = { ...state.settings, theme: nextTheme };
    localStorage.setItem('rmPro_settings', JSON.stringify(nextSettings));
    return { settings: nextSettings };
  }),

  pushToSecondary: (id) => {
    localStorage.setItem('rmPro_pushedToSecondaryId', id);
    set({ pushedToSecondaryId: id, secondaryProcessingStatus: 'idle' });
  },

  setSecondaryStatus: (status) => set({ secondaryProcessingStatus: status }),

  pushToVideoInjector: (id) => set((state) => {
    localStorage.setItem('rmPro_pushedToVideoId', id);
    const newJobs = state.jobs.map(j => {
      if (j.id === id) {
        return {
          ...j,
          matches: j.matches.map(m => ({ ...m, videoStatus: m.videoStatus || 'idle' }))
        };
      }
      return j;
    });
    return { pushedToVideoId: id, jobs: newJobs };
  }),

  updateMatchVideoStatus: (jobId, matchIndex, status, results, selected) => set((state) => {
    const newJobs = state.jobs.map(j => {
      if (j.id === jobId) {
        const newMatches = [...j.matches];
        newMatches[matchIndex] = {
          ...newMatches[matchIndex],
          videoStatus: status,
          ...(results && { discoveryResults: results }),
          ...(selected && { selectedVideos: selected })
        };
        return { ...j, matches: newMatches };
      }
      return j;
    });
    persist(newJobs, state.currentJobId, state.unmatchedCache, state.supabaseConfig, state.settings);
    return { jobs: newJobs };
  })
}));
