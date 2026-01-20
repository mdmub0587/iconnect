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
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white text-slate-900 pb-10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-slate-800 border-b-4 border-amber-600">
        <div className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform text-amber-400" onClick={() => setView('discovery')}>
            <MapPin size={32} strokeWidth={1.5} />
            <span className="tracking-wide">MASJID FINDER</span>
          </h1>
          <button onClick={() => setView(view === 'admin'? 'discovery' : 'admin')} className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-sm transition-all shadow-md hover:shadow-lg">
            {view === 'admin'? '✕ Close' : '⚙️ Admin'}
          </button>
        </div>
      </header>

      {dbError && view === 'discovery' && (
        <div className="bg-amber-50 border-b border-amber-300 p-4 text-amber-900 flex items-center justify-center gap-2 text-sm font-semibold">
          <Info size={16} /> Running in Demo Mode (Backend disconnected)
        </div>
      )}

      {view === 'discovery' && (
        <main className="w-full">
          {/* Hero Section */}
          <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-16 px-6">
            <div className="max-w-5xl mx-auto text-center">
              <h2 className="text-5xl md:text-6xl font-light mb-4 tracking-wide">DISCOVER NEARBY MASJIDS</h2>
              <div className="w-16 h-1 bg-amber-500 mx-auto mb-6"></div>
              <p className="text-amber-100 text-xl md:text-2xl font-light max-w-3xl mx-auto">Find prayer times and jamaat schedules near you</p>
            </div>
          </section>

          {/* Main Content */}
          <section className="max-w-6xl mx-auto px-6 py-16">
            {/* Masjids Grid */}
            {masjids.length === 0 ? (
              <div className="rounded-lg p-16 text-center bg-stone-100 border border-stone-300">
                <MapPin size={56} className="mx-auto mb-6 text-stone-400" />
                <p className="text-stone-600 text-xl font-light">No masjids found nearby</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {masjids.map((m, idx) => (
                  <div 
                    key={m.id} 
                    onClick={() => { setSelectedMasjid(m); setView('profile'); }} 
                    className="bg-white rounded-none shadow-lg hover:shadow-2xl border border-stone-200 overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    {/* Card Header */}
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b-4 border-amber-600">
                      <h3 className="font-light text-2xl text-amber-400 tracking-wide">{m.name}</h3>
                    </div>

                    {/* Card Body */}
                    <div className="p-8 space-y-6">
                      <div className="flex items-center gap-3 text-slate-700">
                        <Navigation size={20} className="text-amber-600" strokeWidth={1.5} />
                        <span className="font-light text-lg">{(m.dist_meters / 1000).toFixed(2)} km away</span>
                      </div>
                      <div className="bg-stone-50 rounded-none p-5 border border-stone-200">
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest mb-4">Prayer Times</p>
                        <div className="space-y-2">
                          {Object.entries(m.jamaat_times).slice(0, 3).map(([prayer, time]) => (
                            <div key={prayer} className="flex justify-between items-center pb-2 border-b border-stone-200 last:border-b-0">
                              <span className="capitalize font-light text-slate-700">{prayer}</span>
                              <span className="font-semibold text-amber-700">{time}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-none transition-colors shadow-md hover:shadow-lg">
                        VIEW DETAILS
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      {view === 'profile' && selectedMasjid && (
        <main className="w-full">
          <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-8 px-6">
            <div className="max-w-5xl mx-auto">
              <button onClick={() => setView('discovery')} className="mb-6 text-amber-400 hover:text-amber-300 flex items-center gap-2 font-semibold transition-all group text-lg">
                <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" strokeWidth={1.5} /> BACK
              </button>
            </div>
          </section>

          {/* Main Profile Section */}
          <section className="max-w-5xl mx-auto px-6 py-12">
            <div className="bg-white rounded-none shadow-xl overflow-hidden border border-stone-200">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-12 text-white border-b-4 border-amber-600">
                <h2 className="text-5xl font-light mb-4 tracking-wide">{selectedMasjid.name}</h2>
                <p className="text-amber-200 flex items-center gap-3 text-lg font-light">
                  <Navigation size={20} strokeWidth={1.5} /> {(selectedMasjid.dist_meters / 1000).toFixed(2)} km from your location
                </p>
              </div>

              {/* Prayer Times Section */}
              <div className="p-12">
                <h3 className="text-4xl font-light text-slate-900 mb-2 tracking-wide">PRAYER TIMES TODAY</h3>
                <div className="w-16 h-1 bg-amber-600 mb-12"></div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  <div className="space-y-6">
                    {Object.entries(getAzanTimes(selectedMasjid.lat, selectedMasjid.lng)).slice(0, 3).map(([p, azan]) => (
                      <div key={p} className="border-l-4 border-amber-600 pl-6 py-2">
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest mb-2">Azan</p>
                        <h4 className="capitalize font-light text-2xl text-slate-900 mb-3">{p}</h4>
                        <p className="text-3xl font-light text-slate-700">{azan}</p>
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest mt-4 mb-1">Jamaat</p>
                        <p className="text-2xl font-semibold text-amber-700">{selectedMasjid.jamaat_times[p]}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-6">
                    {Object.entries(getAzanTimes(selectedMasjid.lat, selectedMasjid.lng)).slice(3, 5).map(([p, azan]) => (
                      <div key={p} className="border-l-4 border-amber-600 pl-6 py-2">
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest mb-2">Azan</p>
                        <h4 className="capitalize font-light text-2xl text-slate-900 mb-3">{p}</h4>
                        <p className="text-3xl font-light text-slate-700">{azan}</p>
                        <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest mt-4 mb-1">Jamaat</p>
                        <p className="text-2xl font-semibold text-amber-700">{selectedMasjid.jamaat_times[p]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location Button */}
                <a href={`https://www.google.com/maps/search/?api=1&query=${selectedMasjid.lat},${selectedMasjid.lng}`} target="_blank" className="flex items-center justify-center gap-3 w-full bg-amber-600 hover:bg-amber-700 text-white py-5 rounded-none font-bold text-lg transition-all shadow-md hover:shadow-lg">
                  <Navigation size={24} strokeWidth={1.5} /> OPEN IN GOOGLE MAPS
                </a>
              </div>
            </div>
          </section>
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
    <main className="w-full">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-light mb-4 tracking-wide">ADD NEW MASJID</h2>
          <div className="w-16 h-1 bg-amber-500 mx-auto"></div>
        </div>
      </section>

      {/* Form Section */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-none shadow-xl p-12 border border-stone-200">
          <div className="space-y-8">
            {/* Name Field */}
            <div>
              <label className="block text-slate-900 text-sm font-semibold mb-3 uppercase tracking-wide">Masjid Name *</label>
              <input 
                placeholder="Enter masjid name..." 
                className="w-full p-4 border border-stone-300 rounded-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-900 bg-stone-50" 
                onChange={e => setForm({...form, name: e.target.value})} 
              />
            </div>

            {/* Location Field */}
            <div>
              <label className="block text-slate-900 text-sm font-semibold mb-3 uppercase tracking-wide">Location (Click on map) *</label>
              <div className="h-80 rounded-none overflow-hidden border border-stone-300 shadow-lg mb-4">
                <MapContainer center={[21.4225, 39.8262]} zoom={13} style={{ height: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationSelector onSelect={(lat, lng) => setForm({...form, lat, lng})} />
                </MapContainer>
              </div>
              <p className="text-slate-600 text-sm font-light">📍 Lat: {form.lat.toFixed(4)} | Lng: {form.lng.toFixed(4)}</p>
            </div>

            {/* Prayer Times Fields */}
            <div>
              <label className="block text-slate-900 text-sm font-semibold mb-6 uppercase tracking-wide">Prayer Jamaat Times</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map(p => (
                  <div key={p}>
                    <label className="block text-slate-700 text-xs font-semibold capitalize mb-2 uppercase tracking-wider">{p} Jamaat Time</label>
                    <input 
                      placeholder="e.g. 05:45 AM" 
                      className="w-full p-4 border border-stone-300 rounded-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-900 bg-stone-50" 
                      onChange={e => setForm({...form, timings: {...form.timings, [p]: e.target.value}})} 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button 
              onClick={saveToDb} 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-none font-bold text-lg transition-all shadow-lg hover:shadow-xl mt-8 uppercase tracking-wide"
            >
              💾 SAVE TO DATABASE
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function LocationSelector({ onSelect }) {
  const [pos, setPos] = useState(null);
  useMapEvents({ click(e) { setPos(e.latlng); onSelect(e.latlng.lat, e.latlng.lng); } });
  return pos? <Marker position={pos} /> : null;
}