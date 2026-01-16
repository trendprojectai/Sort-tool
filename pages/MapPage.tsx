
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store';
// Added CheckCircle2 to the imports
import { AlertTriangle, MapPin, Bookmark, Plus, X, List, ZoomIn, Database, Clock, CheckCircle2 } from 'lucide-react';

// Helper component to handle map size invalidation and reactive updates
const MapController: React.FC<{ filters: any }> = ({ filters }) => {
  const map = useMap();
  
  useEffect(() => {
    // Force Leaflet to recalculate its container bounds
    // Small timeout ensures the DOM has settled (e.g., sidebar transition)
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [map, filters]);

  return null;
};

const createIcon = (color: string, iconType: 'check' | 'warn' | 'quest' | 'star' | 'database') => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; items-center; justify-center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
      <div style="width: 14px; height: 14px; background: white; clip-path: ${
        iconType === 'check' ? 'polygon(28% 38%, 41% 53%, 75% 24%, 86% 38%, 40% 78%, 15% 50%)' :
        iconType === 'warn' ? 'polygon(50% 10%, 90% 90%, 10% 90%)' :
        iconType === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' :
        iconType === 'database' ? 'inset(10% 10% 10% 10% round 2px)' :
        'circle(50% at 50% 50%)'
      }"></div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
};

const MapPage: React.FC = () => {
  const { currentJob, addMapSpot, unmatchedCache } = useStore();
  const job = currentJob();
  
  const [filters, setFilters] = useState({
    matched: true,
    review: true,
    unmatched: false,
    bookmarks: true,
    cached: false // New filter for historical unmatched data
  });
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSpotName, setNewSpotName] = useState('');

  if (!job) return null;

  const center: [number, number] = [51.5136, -0.1347];

  const icons = {
    matched: createIcon('#10B981', 'check'),
    review: createIcon('#F59E0B', 'warn'),
    unmatched: createIcon('#6B7280', 'quest'),
    cached: createIcon('#3B82F6', 'star'), // Blue for cached
    bookmark: (color: string) => createIcon(color, 'star'),
  };

  const handleAddBookmark = () => {
    if (newSpotName) {
      addMapSpot({
        name: newSpotName,
        latitude: 51.5136,
        longitude: -0.1347,
        color: '#3B82F6',
        icon: 'star',
        notes: 'Manually added marker'
      });
      setNewSpotName('');
      setShowAddModal(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] relative rounded-3xl overflow-hidden shadow-2xl border border-gray-200 flex">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-80 bg-white border-r border-gray-200 z-[1001] flex flex-col animate-in slide-in-from-left-4 duration-300">
           <div className="p-6 border-b border-gray-100 flex justify-between items-center">
             <h3 className="font-black text-gray-900 flex items-center gap-2"><Bookmark size={18} className="text-blue-600"/> Saved Spots</h3>
             <button onClick={() => setShowSidebar(false)}><X size={20}/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {job.mapSpots.length === 0 ? (
               <p className="text-xs text-gray-400 text-center py-8">No bookmarks yet</p>
             ) : (
               job.mapSpots.map(spot => (
                 <div key={spot.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 group">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: spot.color }} />
                       <span className="font-bold text-sm text-gray-900">{spot.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-3">{spot.notes}</p>
                    <button className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:underline">
                      <ZoomIn size={12}/> Zoom to Spot
                    </button>
                 </div>
               ))
             )}
           </div>
        </div>
      )}

      <div className="flex-1 relative h-full">
        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-white flex gap-2 pointer-events-auto">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-xl transition-all ${showSidebar ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <List size={20} />
            </button>
            <div className="h-8 w-px bg-gray-200 self-center" />
            
            <div className="flex items-center gap-1 overflow-x-auto max-w-[500px] no-scrollbar">
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={filters.matched} onChange={e => setFilters({...filters, matched: e.target.checked})} />
                <span className="text-xs font-bold text-gray-700">Matched</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={filters.review} onChange={e => setFilters({...filters, review: e.target.checked})} />
                <span className="text-xs font-bold text-gray-700">Review</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={filters.cached} onChange={e => setFilters({...filters, cached: e.target.checked})} />
                <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                  <Database size={12} /> Cached
                </span>
              </label>
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={filters.bookmarks} onChange={e => setFilters({...filters, bookmarks: e.target.checked})} />
                <span className="text-xs font-bold text-gray-700">Saved</span>
              </label>
            </div>
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white p-3 rounded-2xl shadow-xl pointer-events-auto hover:bg-blue-700 transition-all flex items-center gap-2 font-bold text-sm"
          >
            <Plus size={20} /> Add Bookmark
          </button>
        </div>

        <MapContainer center={center} zoom={16} zoomControl={false} className="w-full h-full">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          
          <MapController filters={filters} />

          {/* Matched Layer */}
          {filters.matched && job.matches.filter(m => m.status === 'confirmed' || m.status === 'auto_confirmed').map((m, i) => (
            <Marker key={`matched-${i}`} position={[m.osmData.latitude, m.osmData.longitude]} icon={icons.matched}>
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <h4 className="font-bold text-gray-900">{m.googleData.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">{m.googleData.street}</p>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase tracking-tight">
                    <CheckCircle2 size={12} /> Confirmed Match
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Review Layer */}
          {filters.review && job.matches.filter(m => m.status === 'pending').map((m, i) => (
            <Marker key={`review-${i}`} position={[m.osmData.latitude, m.osmData.longitude]} icon={icons.review}>
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <h4 className="font-bold text-gray-900">{m.googleData.title}</h4>
                  <div className="bg-amber-50 p-2 rounded-lg text-[10px] mt-2 border border-amber-100">
                    <span className="text-amber-700 font-bold uppercase tracking-widest flex items-center gap-1">
                      <AlertTriangle size={10} /> Needs Review
                    </span>
                    <p className="text-amber-600 mt-1">Confidence Score: {Math.round(m.score)}%</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Cached Layer */}
          {filters.cached && unmatchedCache.map((entry, i) => (
            <Marker key={`cached-${i}`} position={[entry.latitude, entry.longitude]} icon={icons.cached}>
              <Popup>
                <div className="p-2 min-w-[180px]">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1.5">
                    <Database size={10} /> Unmatched Memory Cache
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm leading-tight">{entry.original_name}</h4>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-tighter">Source: {entry.source}</p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-gray-50">
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase">Seen Count</p>
                      <p className="text-xs font-black text-gray-700">{entry.seen_count}x</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold text-gray-400 uppercase">Last Seen</p>
                      <p className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                         <Clock size={8} /> {new Date(entry.last_seen_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Bookmarks Layer */}
          {filters.bookmarks && job.mapSpots.map(spot => (
            <Marker key={spot.id} position={[spot.latitude, spot.longitude]} icon={icons.bookmark(spot.color)}>
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold">{spot.name}</h4>
                  <p className="text-xs text-gray-500">{spot.notes}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-[2000] backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
             <h3 className="text-2xl font-black mb-6">Create Bookmark</h3>
             <input 
               type="text" 
               value={newSpotName}
               onChange={(e) => setNewSpotName(e.target.value)}
               placeholder="Bookmark Name"
               className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
               autoFocus
             />
             <div className="flex justify-end gap-3">
               <button onClick={() => setShowAddModal(false)} className="px-6 py-3 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
               <button onClick={handleAddBookmark} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95">Save Spot</button>
             </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-marker {
          background: transparent;
          border: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
};

export default MapPage;
