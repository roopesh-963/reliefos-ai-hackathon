import api from './http';

export interface CrisisMarker {
  id: string;
  position: [number, number];
  label: string;
  type: 'critical' | 'warning' | 'stable';
  role?: 'city' | 'vehicle';
  magnitude?: number;
  depthKm?: number;
  occurredAt?: number;
  sourceUrl?: string;
  tsunami?: boolean;
  significance?: number;
}

export interface CrisisHeadline {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
}

export interface CrisisOverview {
  updatedAt: string;
  markers: CrisisMarker[];
  headlines: CrisisHeadline[];
  summary: {
    activeEarthquakes: number;
    criticalEarthquakes: number;
    warningEarthquakes: number;
    crisisArticles: number;
    maxMagnitude: number;
  };
}

export interface IntelSourceStatus {
  weatherEnabled: boolean;
  newsEnabled: boolean;
  geocodingEnabled: boolean;
  usgsFeedUrl: string;
  mode: 'live' | 'partial';
}

export interface LocationIntelReport {
  city: string;
  country: string;
  status: 'Critical' | 'Warning' | 'Stable';
  threatLevel: number;
  populationAtRisk: string;
  environmentalStatus: string;
  recentIncidents: string[];
  recommendation: string;
  weather: {
    temperature: string;
    precipitation: string;
    windSpeed: string;
    condition: string;
    aqi: number;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
  headlines: CrisisHeadline[];
  stats: {
    nearbyEarthquakes: number;
    strongestMagnitude: number;
  };
  mapUrl: string;
}

export const fetchCrisisOverview = async (): Promise<CrisisOverview> => {
  const { data } = await api.get('/intel/overview');
  return data;
};

export const fetchIntelSourceStatus = async (): Promise<IntelSourceStatus> => {
  const { data } = await api.get('/intel/sources');
  return data;
};

export const fetchLocationIntel = async (params: {
  label: string;
  lat?: number;
  lng?: number;
}): Promise<LocationIntelReport> => {
  const { data } = await api.get('/intel/report', { params });
  return data;
};

export const fetchCityReport = async (cityName: string): Promise<LocationIntelReport> => {
  const { data } = await api.get('/intel/report', {
    params: { label: cityName },
  });
  return data;
};
