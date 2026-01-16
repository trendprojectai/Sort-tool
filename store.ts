
import { create } from 'zustand';
import { Job, Match, OSMRestaurant, GoogleRestaurant, AppSettings, SupabaseConfig, MapSpot, FlaggedItem } from './types';
import { calculateMatchScore, getConfidence } from './lib/utils';

interface AppState {
  jobs: Job[];
  currentJobId: string | null;
  settings: AppSettings;
  supabaseConfig: SupabaseConfig;
  
  // Computed helpers for current active job
  currentJob: () => Job | undefined;
  
  // Actions
  createJob: (name: string, description?: string) => void;
  setCurrentJobId: (id: string) => void;
  updateCurrentJob: (updates: Partial<Job>) => void;
  
  setOSMData: (data: OSMRestaurant[]) => void;
  setGoogleData: (data: GoogleRestaurant[]) => void;
  setMatches: (matches: Match[], unmatchedOSM: OSMRestaurant[], unmatchedGoogle: GoogleRestaurant[]) => void;
  
  updateMatchStatus: (index: number, status: Match['status']) => void;
  setReviewIndex: (index: number) => void;
  addMapSpot: (spot: Omit<MapSpot, 'id' | 'created_at'>) => void;
  addFlaggedItem: (item: Omit<FlaggedItem, 'id' | 'created_at'>) => void;
  
  linkItems: (osm: OSMRestaurant, google: GoogleRestaurant) => void;
  
  resetApp: () => void;
  saveToPersistence: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  minScore: 70,
  autoConfirmThreshold: 95,
  theme: 'light'
};

export const useStore = create<AppState>((set, get) => ({
  jobs: JSON.parse(localStorage.getItem('rmPro_jobs') || '[]'),
  currentJobId: localStorage.getItem('rmPro_currentJobId') || null,
  settings: DEFAULT_SETTINGS,
  supabaseConfig: { url: '', key: '', tableName: 'restaurants' },

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
    const newState = {
      jobs: [newJob, ...state.jobs],
      currentJobId: newJob.id
    };
    localStorage.setItem('rmPro_jobs', JSON.stringify(newState.jobs));
    localStorage.setItem('rmPro_currentJobId', newJob.id);
    return newState;
  }),

  setCurrentJobId: (id) => set({ currentJobId: id }),

  updateCurrentJob: (updates) => set((state) => {
    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId 
        ? { ...j, ...updates, updated_at: new Date().toISOString() } 
        : j
    );
    localStorage.setItem('rmPro_jobs', JSON.stringify(newJobs));
    return { jobs: newJobs };
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
    localStorage.setItem('rmPro_jobs', JSON.stringify(newJobs));
    return { jobs: newJobs };
  }),

  setReviewIndex: (index: number) => set((state) => {
    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { ...j, currentReviewIndex: index, updated_at: new Date().toISOString() } : j
    );
    localStorage.setItem('rmPro_jobs', JSON.stringify(newJobs));
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
    localStorage.setItem('rmPro_jobs', JSON.stringify(newJobs));
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
    
    const newJobs = state.jobs.map(j => 
      j.id === state.currentJobId ? { ...j, flaggedItems: [...j.flaggedItems, newItem], updated_at: new Date().toISOString() } : j
    );
    localStorage.setItem('rmPro_jobs', JSON.stringify(newJobs));
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
    localStorage.setItem('rmPro_jobs', JSON.stringify(newJobs));
    return { jobs: newJobs };
  }),

  resetApp: () => {
    localStorage.clear();
    set({ jobs: [], currentJobId: null });
  },

  saveToPersistence: () => {
    const { jobs } = get();
    localStorage.setItem('rmPro_jobs', JSON.stringify(jobs));
  }
}));
