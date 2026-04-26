import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Camera,
  Flame,
  Loader2,
  MapPin,
  Package,
  Shield,
  Signal,
  Stethoscope,
  Upload,
  Waves,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { cn } from '../lib/utils';
import { getCurrentLocation, submitSOS } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { useSocket } from '../hooks/useSocket';

type EmergencyCategory = 'Flood' | 'Fire' | 'Medical' | 'Earthquake' | 'Food Shortage' | 'Trapped Person';
type Severity = 'low' | 'medium' | 'critical';
type GeoStatus = 'locating' | 'ready' | 'error';

interface ShelterNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  occupied: number;
}

const CATEGORIES: Array<{
  id: EmergencyCategory;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  { id: 'Flood', icon: Waves, accent: 'from-cyan-500/30 to-blue-500/20' },
  { id: 'Fire', icon: Flame, accent: 'from-orange-500/30 to-red-500/20' },
  { id: 'Medical', icon: Stethoscope, accent: 'from-emerald-500/30 to-cyan-500/20' },
  { id: 'Earthquake', icon: Activity, accent: 'from-amber-500/30 to-orange-500/20' },
  { id: 'Food Shortage', icon: Package, accent: 'from-blue-500/30 to-cyan-500/20' },
  { id: 'Trapped Person', icon: AlertTriangle, accent: 'from-red-500/30 to-pink-500/20' },
];

const SHELTERS: ShelterNode[] = [
  { id: 's-1', name: 'Central Metro Shelter', lat: 12.9721, lng: 77.5933, capacity: 450, occupied: 338 },
  { id: 's-2', name: 'East Relief Camp', lat: 12.9926, lng: 77.6408, capacity: 320, occupied: 188 },
  { id: 's-3', name: 'Riverbank Safe Zone', lat: 12.9567, lng: 77.6278, capacity: 280, occupied: 241 },
];

const PHASES = [
  'Received',
  'Team Assigned',
  'On The Way',
  'Arriving',
  'Resolved',
] as const;

const SOS_STATUS_TO_PHASE: Record<'pending' | 'acknowledged' | 'in_progress' | 'resolved', number> = {
  pending: 0,
  acknowledged: 1,
  in_progress: 2,
  resolved: 4,
};

const AI_TIPS: Record<EmergencyCategory, string[]> = {
  Flood: [
    'Move to higher ground and avoid walking through flowing water.',
    'Switch off main electrical supply if water enters your home.',
    'Keep drinking water sealed and rationed.',
  ],
  Fire: [
    'Stay low to avoid smoke inhalation and cover nose with cloth.',
    'Shut doors behind you to slow fire spread.',
    'Use stairways only, avoid elevators.',
  ],
  Medical: [
    'Control severe bleeding using direct pressure immediately.',
    'Keep injured person warm and still until responders arrive.',
    'Share allergies and medications in your SOS note.',
  ],
  Earthquake: [
    'Drop, cover, and hold on until shaking fully stops.',
    'Move away from glass fronts and unstable structures.',
    'Expect aftershocks and keep emergency exits clear.',
  ],
  'Food Shortage': [
    'Prioritize children, elderly, and medical patients for supplies.',
    'Track calories per person per day to prevent overuse.',
    'Use nearest listed shelter for ration support.',
  ],
  'Trapped Person': [
    'Conserve battery and send short updates every 15-20 minutes.',
    'Use tapping sounds in sets of three to signal rescuers.',
    'Avoid unnecessary movement in unstable debris areas.',
  ],
};

const CATEGORY_TO_CRISIS_TYPE: Record<EmergencyCategory, string> = {
  Flood: 'flood',
  Fire: 'fire',
  Medical: 'medical',
  Earthquake: 'earthquake',
  'Food Shortage': 'food',
  'Trapped Person': 'other',
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
};

const formatDistance = (km: number) => {
  if (!Number.isFinite(km)) {
    return '--';
  }
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

export default function SOSApp() {
  const { addNotification } = useNotifications();
  const { joinDashboard, on } = useSocket();

  const [category, setCategory] = useState<EmergencyCategory>('Medical');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [message, setMessage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<GeoStatus>('locating');
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSOSId, setSubmittedSOSId] = useState<string | null>(null);
  const [trackerPhase, setTrackerPhase] = useState(0);
  const [pulseNonce, setPulseNonce] = useState(0);

  const simulationTimer = useRef<number | null>(null);

  const refreshLocation = useCallback(async () => {
    setLocationStatus('locating');
    try {
      const coords = await getCurrentLocation();
      const label = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      setLocation({
        lat: coords.lat,
        lng: coords.lng,
        label,
      });
      setLocationStatus('ready');
    } catch (error) {
      console.error('Location fetch failed:', error);
      setLocationStatus('error');
      setLocation(null);
    }
  }, []);

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    joinDashboard();
    const unsubscribe = on<{ id: string; status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' }>(
      'sos_updated',
      (payload) => {
        if (!submittedSOSId || payload.id !== submittedSOSId) {
          return;
        }

        setTrackerPhase((prev) => Math.max(prev, SOS_STATUS_TO_PHASE[payload.status]));
      }
    );

    return () => unsubscribe();
  }, [joinDashboard, on, submittedSOSId]);

  useEffect(() => {
    if (!submittedSOSId) {
      return;
    }

    if (simulationTimer.current) {
      window.clearInterval(simulationTimer.current);
    }

    simulationTimer.current = window.setInterval(() => {
      setTrackerPhase((prev) => {
        if (prev >= 4) {
          if (simulationTimer.current) {
            window.clearInterval(simulationTimer.current);
            simulationTimer.current = null;
          }
          return 4;
        }
        return prev + 1;
      });
    }, 12000);

    return () => {
      if (simulationTimer.current) {
        window.clearInterval(simulationTimer.current);
        simulationTimer.current = null;
      }
    };
  }, [submittedSOSId]);

  const nearbyShelters = useMemo(() => {
    if (!location) {
      return SHELTERS.map((shelter) => ({
        ...shelter,
        distance: Number.NaN,
      }));
    }

    return SHELTERS.map((shelter) => ({
      ...shelter,
      distance: distanceKm(location.lat, location.lng, shelter.lat, shelter.lng),
    })).sort((a, b) => a.distance - b.distance);
  }, [location]);

  const activeTips = useMemo(() => AI_TIPS[category], [category]);

  const onImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const maxBytes = 1.5 * 1024 * 1024;
    if (file.size > maxBytes) {
      addNotification({
        type: 'warning',
        title: 'Image Too Large',
        message: 'Please upload an image up to 1.5 MB.',
      });
      return;
    }

    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value === 'string') {
        setImagePreview(value);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageName('');
  };

  const triggerSOS = async (source: 'hero' | 'cta') => {
    if (submitting) {
      return;
    }

    const token = localStorage.getItem('reliefos_token');
    if (!token) {
      addNotification({
        type: 'warning',
        title: 'Login Required',
        message: 'Please sign in before sending SOS alerts.',
      });
      return;
    }

    if (!location || locationStatus !== 'ready') {
      addNotification({
        type: 'warning',
        title: 'Location Pending',
        message: 'Enable location and retry SOS transmission.',
      });
      return;
    }

    const messagePayload = `${source === 'hero' ? '[Quick SOS]' : '[Detailed SOS]'} [${category}] ${message.trim()}`.trim();
    setSubmitting(true);
    setPulseNonce((prev) => prev + 1);

    try {
      const response = await submitSOS({
        latitude: location.lat,
        longitude: location.lng,
        locationLabel: location.label,
        severity,
        crisisType: CATEGORY_TO_CRISIS_TYPE[category],
        region: location.label,
        message: messagePayload,
        mediaUrl: imageName ? `attachment:${imageName}` : undefined,
      });

      setSubmittedSOSId(response.sos._id);
      setTrackerPhase(0);

      addNotification({
        type: 'critical',
        title: 'SOS Sent',
        message: 'Your emergency alert was received. Teams are being assigned.',
      });
    } catch (error) {
      console.error('SOS submit failed:', error);
      addNotification({
        type: 'critical',
        title: 'SOS Failed',
        message: 'Unable to send SOS right now. Retry with network enabled.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relief-page text-white">
      <div className="relief-orb left-[8%] top-[10%] h-72 w-72 bg-[rgba(255,90,58,0.16)]" />
      <div className="relief-orb right-[10%] top-[24%] h-60 w-60 bg-[rgba(139,0,0,0.2)]" />
      <div className="dashboard-particles absolute inset-0 opacity-28" />

      <div className="relative z-10 max-w-6xl mx-auto px-1 sm:px-2 pb-10 pt-4 space-y-6">
      <div>
        <BackToDashboardButton />
      </div>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-3 py-3 sm:px-4 sm:py-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-cyan-200">
              <Shield className="w-5 h-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-white font-bold tracking-tight">ReliefOS AI</div>
              <div className="relief-kicker text-[10px] uppercase tracking-[0.25em] font-mono">Citizen Emergency Node</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold text-white">Need urgent help?</div>
            <div className="text-[11px] text-cyan-100/80 flex items-center justify-end gap-1.5">
              <MapPin className="w-3 h-3" />
              <span>
                {locationStatus === 'ready' && location ? location.label : locationStatus === 'locating' ? 'Locating...' : 'Location unavailable'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="px-3 py-2 text-xs text-gray-200 flex items-center justify-between">
            <span className="uppercase tracking-widest text-[10px] font-mono text-gray-400">Signal</span>
            <span className="inline-flex items-center gap-1 text-cyan-200">
              <Signal className="w-3 h-3" /> Strong
            </span>
          </div>
          <div className="px-3 py-2 text-xs text-gray-200 flex items-center justify-between">
            <span className="uppercase tracking-widest text-[10px] font-mono text-gray-400">Network</span>
            <span className={cn('inline-flex items-center gap-1', isOnline ? 'text-emerald-200' : 'text-red-300')}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshLocation()}
            className="px-3 py-2 text-xs text-cyan-100 hover:text-white transition-colors text-left"
          >
            Refresh Location
          </button>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relief-panel rounded-[1.75rem] bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.18),rgba(28,12,12,0.16)_60%)] p-5 sm:p-6"
          >
            <div className="text-center mb-5">
              <h2 className="text-2xl sm:text-3xl text-white font-display font-bold tracking-tight">Emergency SOS</h2>
              <p className="text-gray-300 text-sm mt-2">Tap once to request emergency assistance</p>
            </div>

            <div className="relative flex items-center justify-center py-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => void triggerSOS('hero')}
                disabled={submitting}
                className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border border-red-300/40 bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_80px_rgba(239,68,68,0.45)] flex flex-col items-center justify-center text-white"
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex flex-col items-center"
                >
                  {submitting ? (
                    <Loader2 className="w-12 h-12 animate-spin mb-2" />
                  ) : (
                    <AlertOctagon className="w-12 h-12 mb-2" />
                  )}
                  <span className="text-3xl font-extrabold tracking-tight">SOS</span>
                </motion.div>
              </motion.button>

              <motion.div
                className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full border border-red-400/30"
                animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.35, 0.08, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              />
              <motion.div
                className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-red-400/20"
                animate={{ scale: [0.82, 1.18, 0.82], opacity: [0.26, 0.04, 0.26] }}
                transition={{ duration: 3.1, repeat: Infinity }}
              />

              <AnimatePresence>
                <motion.div
                  key={pulseNonce}
                  initial={{ scale: 1, opacity: 0.35 }}
                  animate={{ scale: 1.42, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7 }}
                  className="absolute w-64 h-64 rounded-full bg-red-400/20"
                />
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relief-panel rounded-[1.5rem] p-4"
          >
            <h3 className="text-sm uppercase tracking-widest font-mono text-gray-400 mb-3">Emergency Category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CATEGORIES.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setCategory(item.id)}
                  className={cn(
                    'px-3 py-3 text-left transition-all',
                    category === item.id
                      ? 'text-cyan-50'
                      : 'text-white hover:bg-white/[0.03]'
                  )}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl mb-2 flex items-center justify-center bg-gradient-to-br',
                      item.accent,
                      category === item.id ? 'text-cyan-100' : 'text-gray-200'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="text-sm text-white font-semibold">{item.id}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relief-panel rounded-[1.5rem] p-4 space-y-4"
          >
            <div>
              <h3 className="text-sm uppercase tracking-widest font-mono text-gray-400 mb-2">Severity</h3>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'critical'] as Severity[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeverity(value)}
                    className={cn(
                      'py-2.5 text-sm font-semibold capitalize transition-all',
                      severity === value
                        ? value === 'critical'
                          ? 'text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
                          : 'text-cyan-100'
                        : 'text-gray-300'
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 space-y-3">
              <h4 className="text-[11px] uppercase tracking-widest font-mono text-gray-400">Quick Details</h4>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Optional short message (injuries, trapped count, hazards)..."
                rows={3}
                className="relief-input w-full rounded-[1rem] px-3 py-2 text-sm outline-none resize-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="px-3 py-2 text-sm text-gray-200 cursor-pointer flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-200" />
                    {imageName || 'Upload image'}
                  </span>
                  <Upload className="w-4 h-4 text-gray-500" />
                  <input type="file" accept="image/*" className="hidden" onChange={onImageSelected} />
                </label>

                <div className="px-3 py-2 text-sm text-gray-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-200 shrink-0" />
                  <span className="truncate">
                    {locationStatus === 'ready' && location
                      ? location.label
                      : locationStatus === 'locating'
                      ? 'Attaching location...'
                      : 'Location unavailable'}
                  </span>
                </div>
              </div>

              {imagePreview && (
                <div className="relative overflow-hidden">
                  <img src={imagePreview} alt="Attachment preview" className="w-full h-32 object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 text-xs bg-black/70 px-2 py-1 text-white"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void triggerSOS('cta')}
              disabled={submitting}
              className="w-full rounded-2xl py-3.5 text-base font-bold tracking-wide bg-gradient-to-r from-red-600 to-red-500 text-white shadow-[0_0_35px_rgba(239,68,68,0.35)] hover:from-red-500 hover:to-red-400 transition-all disabled:opacity-70 inline-flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Send SOS Alert
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relief-panel rounded-[1.5rem] p-4"
          >
            <h3 className="text-sm uppercase tracking-widest font-mono text-gray-400 mb-3">Status Tracker</h3>
            <div className="space-y-3">
              {PHASES.map((phase, index) => {
                const active = trackerPhase >= index;
                const previousActive = trackerPhase >= index - 1;
                return (
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3"
                  >
                    <div className="flex flex-col items-center mt-0.5">
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded-full border',
                          active ? 'bg-cyan-300 border-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.7)]' : 'bg-white/10 border-white/25'
                        )}
                      />
                      {index < PHASES.length - 1 && (
                        <div className={cn('w-[2px] h-7 mt-1', previousActive ? 'bg-cyan-300/70' : 'bg-white/15')} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={cn('text-sm font-semibold', active ? 'text-white' : 'text-gray-500')}>{phase}</div>
                      <div className="text-xs text-gray-500">
                        {active
                          ? 'Live status updated'
                          : submittedSOSId
                          ? 'Waiting for progression'
                          : 'Awaiting SOS submission'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </section>

        <aside className="lg:col-span-4 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relief-panel rounded-[1.5rem] p-4"
          >
            <h3 className="text-sm uppercase tracking-widest font-mono text-gray-400 mb-3">Nearby Shelters</h3>

            <div className="p-3 mb-3">
              <div className="text-xs text-gray-400 mb-2">Shelter Radar</div>
              <div className="h-20 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),rgba(3,8,18,0.8)_65%)] relative overflow-hidden">
                {nearbyShelters.slice(0, 3).map((shelter, idx) => (
                  <motion.span
                    key={shelter.id}
                    className="absolute w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
                    style={{ left: `${22 + idx * 26}%`, top: `${35 + idx * 13}%` }}
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 1.6 + idx * 0.3, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {nearbyShelters.map((shelter) => {
                const occupancyPct = Math.round((shelter.occupied / shelter.capacity) * 100);
                return (
                  <div key={shelter.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{shelter.name}</div>
                        <div className="text-xs text-gray-400">{formatDistance(shelter.distance)}</div>
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-1 rounded-full',
                          occupancyPct > 85 ? 'bg-red-500/15 text-red-200' : 'bg-cyan-500/15 text-cyan-100'
                        )}
                      >
                        {occupancyPct}% full
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="relief-panel rounded-[1.5rem] bg-gradient-to-b from-[rgba(255,88,58,0.1)] to-transparent p-4 lg:sticky lg:top-24"
          >
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-cyan-200" />
              <h3 className="text-sm font-bold text-white">AI Safety Assistant</h3>
            </div>

            <div className="space-y-2.5">
              {activeTips.map((tip, index) => (
                <motion.div
                  key={`${category}-${index}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.03 * index }}
                  className="p-3 text-sm text-cyan-100/90 leading-relaxed"
                >
                  {tip}
                </motion.div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-300 space-y-1">
              <div className="uppercase tracking-widest font-mono text-gray-400">Hotlines</div>
              <a href="tel:112" className="block text-cyan-100 hover:text-white">
                National Emergency: 112
              </a>
              <a href="tel:108" className="block text-cyan-100 hover:text-white">
                Ambulance: 108
              </a>
              <a href="tel:101" className="block text-cyan-100 hover:text-white">
                Fire: 101
              </a>
            </div>
          </motion.div>
        </aside>
      </div>
      </div>
    </div>
  );
}
