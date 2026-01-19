import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan';
import { Navigation, MapPin, Clock, Edit3, Save, ArrowLeft, Info } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// --- SUPABASE CONFIG (Vite requires VITE_ prefix) ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize only if keys exist to avoid "Broken Token" crash
const supabase = (supabaseUrl && supabaseAnonKey) 
 ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- MOCK DATA (Shows if DB is empty or disconnected) ---
const MOCK_MASJIDS = [
  {
    id: 'demo-1',
    name: "Grand Masjid Al-Noor",
    lat: 21.4225, // Near Makkah
    lng: 39.8262,
    jamaat_times: { fajr: "05:15 AM", dhuhr: "12:30 PM", asr: "03:45 PM", maghrib: "05:50 PM", isha: "07:15 PM" },
    dist_meters: 500
  },
  {
    id: 'demo-2',
    name: "Community Islamic Center",
    lat: 21.4300,
    lng: 39.8350,
    jamaat_times: { fajr: "05:30 AM", dhuhr: "01:00 PM", asr: "04:00 PM", maghrib: "06:05 PM", isha: "07:30 PM" },
    dist_meters: 500
  }
];

// --- HAVERSINE FORMULA for distance calculation ---
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

export default function MasjidApp() {
  const [view, setView] = useState('discovery');
  const [userLoc, setUserLoc] = useState({ lat: 21.4225, lng: 39.8262 }); // Default to Makkah
  const [masjids, setMasjids] = useState(MOCK_MASJIDS);
  const [selectedMasjid, setSelectedMasjid] = useState(null);
  const [dbError, setDbError] = useState(!supabase);

  useEffect(() => {
    // Get real location [1]
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setUserLoc({ lat: latitude, lng: longitude });
      if (!supabase) fetchMasjids(latitude, longitude);
    }, () => console.log("Location access denied, using default."));
  },);

  async function fetchMasjids(lat, lng) {
    try {
      const { data, error } = await supabase.rpc('nearby_masjids', { user_lat: lat, user_lng: lng });
      if (error) throw error;
      if (data && data.length > 0) setMasjids(data);
    } catch (err) {
      console.error("Database error:", err.message);
      setDbError(true);
      // Manual distance calculation fallback using Haversine formula
      const masjidsWithDistance = MOCK_MASJIDS.map(masjid => ({
        ...masjid,
        dist_meters: calculateDistance(lat, lng, masjid.lat, masjid.lng)
      }));
      setMasjids(masjidsWithDistance);
    }
  }

  const getAzanTimes = (lat, lng) => {
    const coords = new Coordinates(lat, lng);
    const params = CalculationMethod.MoonsightingCommittee();
    const times = new PrayerTimes(coords, new Date(), params);
    const format = (t) => t.toLocaleTimeString({ hour: '2-digit', minute: '2-digit' });
    return { fajr: format(times.fajr), dhuhr: format(times.dhuhr), asr: format(times.asr), maghrib: format(times.maghrib), isha: format(times.isha) };
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform text-emerald-700" onClick={() => setView('discovery')}>
            <MapPin size={28} />
            <span>MasjidFinder</span>
          </h1>
          <button onClick={() => setView(view === 'admin'? 'discovery' : 'admin')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all">
            {view === 'admin'? '✕ Close' : '⚙️ Admin'}
          </button>
        </div>
      </header>

      {dbError && view === 'discovery' && (
        <div className="bg-amber-50 border-b border-amber-200 p-4 text-amber-800 flex items-center justify-center gap-2 text-sm font-semibold animate-fade-in-down">
          <Info size={16} /> Running in Demo Mode (Backend disconnected)
        </div>
      )}

      {view === 'discovery' && (
        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Heading Section */}
          <div className="mb-10 animate-fade-in-down">
            <h2 className="text-4xl font-bold text-slate-900 mb-2">Nearby Masjids</h2>
            <p className="text-slate-600 text-lg">Find prayer times and jamaat schedules near you</p>
          </div>

          {/* Masjids Grid */}
          {masjids.length === 0 ? (
            <div className="rounded-2xl p-12 text-center bg-slate-50 border-2 border-dashed border-slate-300 animate-slide-in-up">
              <MapPin size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 text-lg">No masjids found nearby</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {masjids.map((m, idx) => (
                <div 
                  key={m.id} 
                  onClick={() => { setSelectedMasjid(m); setView('profile'); }} 
                  className="bg-white rounded-xl shadow-md hover:shadow-xl border border-slate-200 overflow-hidden cursor-pointer card-hover animate-slide-in-up transition-all"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-4">
                    <h3 className="font-bold text-xl text-white">{m.name}</h3>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Navigation size={18} className="text-emerald-600" />
                      <span className="font-semibold">{(m.dist_meters / 1000).toFixed(2)} km away</span>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">Next Prayer Times</p>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(m.jamaat_times).slice(0, 3).map(([prayer, time]) => (
                          <span key={prayer} className="bg-white px-2 py-1 rounded text-xs font-semibold text-emerald-700 border border-emerald-200">
                            {prayer.slice(0, 3).toUpperCase()}: {time}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg transition-colors mt-2">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {view === 'profile' && selectedMasjid && (
        <main className="max-w-4xl mx-auto px-4 py-8">
          <button onClick={() => setView('discovery')} className="mb-6 text-emerald-600 hover:text-emerald-700 flex items-center gap-2 font-semibold transition-all group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Masjids
          </button>

          {/* Main Profile Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-slide-in-up border border-slate-200">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-8 text-white">
              <h2 className="text-4xl font-bold mb-2">{selectedMasjid.name}</h2>
              <p className="text-emerald-100 flex items-center gap-2 text-lg">
                <Navigation size={18} /> {(selectedMasjid.dist_meters / 1000).toFixed(2)} km from your location
              </p>
            </div>

            {/* Prayer Times Section */}
            <div className="p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Prayer Times Today</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="space-y-3">
                  {Object.entries(getAzanTimes(selectedMasjid.lat, selectedMasjid.lng)).slice(0, 3).map(([p, azan]) => (
                    <div key={p} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="capitalize font-bold text-slate-700 text-lg">{p}</span>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">Azan</p>
                          <p className="font-bold text-slate-900">{azan}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs text-slate-500">Jamaat</span>
                        <span className="font-bold text-emerald-600 text-lg">{selectedMasjid.jamaat_times[p]}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {Object.entries(getAzanTimes(selectedMasjid.lat, selectedMasjid.lng)).slice(3, 5).map(([p, azan]) => (
                    <div key={p} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex justify-between items-center">
                        <span className="capitalize font-bold text-slate-700 text-lg">{p}</span>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 mb-1">Azan</p>
                          <p className="font-bold text-slate-900">{azan}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                        <span className="text-xs text-slate-500">Jamaat</span>
                        <span className="font-bold text-emerald-600 text-lg">{selectedMasjid.jamaat_times[p]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Button */}
              <a href={`https://www.google.com/maps/search/?api=1&query=${selectedMasjid.lat},${selectedMasjid.lng}`} target="_blank" className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-lg font-bold text-lg transition-all shadow-md hover:shadow-lg">
                <Navigation size={22} /> Open in Google Maps
              </a>
            </div>
          </div>
        </main>
      )}

      {view === 'admin' && <AdminPortal onSaved={() => setView('discovery')} />}
    </div>
  );
}

function AdminPortal({ onSaved }) {
  const [form, setForm] = useState({ name: '', lat: 21.4225, lng: 39.8262, timings: { fajr: '', dhuhr: '', asr: '', maghrib: '', isha: '' } });

  const saveToDb = async () => {
    if (!supabase) return alert("Connect Supabase to save!");
    const { error } = await supabase.from('masjids').insert();
    if (error) alert(error.message);
    else { alert("Saved!"); onSaved(); }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 animate-slide-in-up">
      <h2 className="text-4xl font-bold text-slate-900 mb-8">Add New Masjid</h2>
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
        <div className="space-y-6">
          {/* Name Field */}
          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Masjid Name *</label>
            <input 
              placeholder="Enter masjid name..." 
              className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900" 
              onChange={e => setForm({...form, name: e.target.value})} 
            />
          </div>

          {/* Location Field */}
          <div>
            <label className="block text-slate-700 text-sm font-bold mb-2">Location (Click on map) *</label>
            <div className="h-64 rounded-lg overflow-hidden border border-slate-300 shadow-md">
              <MapContainer center={[21.4225, 39.8262]} zoom={13} style={{ height: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationSelector onSelect={(lat, lng) => setForm({...form, lat, lng})} />
              </MapContainer>
            </div>
            <p className="text-slate-600 text-sm mt-2">📍 Lat: {form.lat.toFixed(4)} | Lng: {form.lng.toFixed(4)}</p>
          </div>

          {/* Prayer Times Fields */}
          <div>
            <label className="block text-slate-700 text-sm font-bold mb-3">Prayer Jamaat Times</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(p => (
                <div key={p}>
                  <label className="block text-slate-600 text-xs font-semibold capitalize mb-1">{p} Jamaat Time</label>
                  <input 
                    placeholder="e.g. 05:45 AM" 
                    className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900" 
                    onChange={e => setForm({...form, timings: {...form.timings, [p]: e.target.value}})} 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button 
            onClick={saveToDb} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold text-lg transition-all shadow-md hover:shadow-lg mt-8"
          >
            💾 Save to Database
          </button>
        </div>
      </div>
    </main>
  );
}

function LocationSelector({ onSelect }) {
  const [pos, setPos] = useState(null);
  useMapEvents({ click(e) { setPos(e.latlng); onSelect(e.latlng.lat, e.latlng.lng); } });
  return pos? <Marker position={pos} /> : null;
}