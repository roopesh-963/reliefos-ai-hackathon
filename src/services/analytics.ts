import api from './http';

export interface AnalyticsSummary {
  totalSOS: number;
  resolvedSOS: number;
  pendingSOS: number;
  inProgressSOS: number;
  activeRescueTeams: number;
  totalResources: number;
  resourcesByType: { _id: string; count: number; totalQty: number }[];
}

export type AnalyticsRange = 'today' | '7d' | '30d' | 'custom';
export type AnalyticsGroupBy = 'region' | 'crisisType';

export interface AnalyticsFilters {
  range?: AnalyticsRange;
  startDate?: string;
  endDate?: string;
  region?: string;
  crisisType?: string;
}

export interface AnalyticsOverview {
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalIncidents: number;
    activeEmergencies: number;
    avgResponseTime: number;
    resolutionRate: number;
    livesAssisted: number;
    resourcesDeployed: number;
  };
  deltas: {
    totalIncidents: number;
    activeEmergencies: number;
    avgResponseTime: number;
    resolutionRate: number;
    livesAssisted: number;
    resourcesDeployed: number;
  };
  context: {
    activeTeams: number;
    activeAlerts: number;
    trackedRegions: number;
    trackedCrisisTypes: number;
  };
  geoIntelligence: {
    clusters: Array<{
      name: string;
      incidents: number;
      critical: number;
      avgResponseMinutes: number;
      dominantCrisisType: string;
      position: [number, number];
    }>;
    frequentIncidents: Array<{
      name: string;
      incidents: number;
      critical: number;
      avgResponseMinutes: number;
      dominantCrisisType: string;
      position: [number, number];
    }>;
    delayedZones: Array<{
      name: string;
      incidents: number;
      critical: number;
      avgResponseMinutes: number;
      dominantCrisisType: string;
      position: [number, number];
    }>;
    affectedClusters: Array<{
      name: string;
      incidents: number;
      critical: number;
      avgResponseMinutes: number;
      dominantCrisisType: string;
      position: [number, number];
    }>;
  };
  lastUpdated: string;
}

export interface IncidentTrendPoint {
  name: string;
  dateKey: string;
  total: number;
  resolved: number;
  critical: number;
  avgResponseMinutes: number;
}

export interface ResponseTimePoint {
  name: string;
  avgMinutes: number;
  incidents: number;
  resolvedRate: number;
  criticalCount: number;
}

export interface ResourceUsagePoint {
  name: string;
  value: number;
  allocated: number;
  deployed: number;
  stock: number;
}

export interface SeverityPoint {
  name: string;
  value: number;
}

export interface AnalyticsInsight {
  tone: 'critical' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
}

export interface AnalyticsInsights {
  generatedAt: string;
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
  insights: AnalyticsInsight[];
  geoIntelligence: AnalyticsOverview['geoIntelligence'];
}

export const getAnalyticsSummary = async (): Promise<AnalyticsSummary> => {
  const { data } = await api.get('/analytics/summary');
  return data;
};

export const getSOSByDay = async (): Promise<
  { name: string; saved: number; target: number; total: number }[]
> => {
  const { data } = await api.get('/analytics/sos-by-day');
  return data;
};

export const getSOSBySeverity = async (): Promise<{ name: string; value: number }[]> => {
  const { data } = await api.get('/analytics/sos-severity');
  return data;
};

export const getAnalyticsOverview = async (
  params: AnalyticsFilters = {}
): Promise<AnalyticsOverview> => {
  const { data } = await api.get('/analytics/overview', { params });
  return data;
};

export const getAnalyticsIncidentsTrend = async (
  params: AnalyticsFilters = {}
): Promise<IncidentTrendPoint[]> => {
  const { data } = await api.get('/analytics/incidents-trend', { params });
  return data;
};

export const getAnalyticsResponseTimes = async (
  params: AnalyticsFilters & { groupBy?: AnalyticsGroupBy } = {}
): Promise<ResponseTimePoint[]> => {
  const { data } = await api.get('/analytics/response-times', { params });
  return data;
};

export const getAnalyticsResources = async (
  params: AnalyticsFilters = {}
): Promise<ResourceUsagePoint[]> => {
  const { data } = await api.get('/analytics/resources', { params });
  return data;
};

export const getAnalyticsSeverity = async (
  params: AnalyticsFilters = {}
): Promise<SeverityPoint[]> => {
  const { data } = await api.get('/analytics/severity', { params });
  return data;
};

export const getAnalyticsInsights = async (
  params: AnalyticsFilters = {}
): Promise<AnalyticsInsights> => {
  const { data } = await api.get('/analytics/insights', { params });
  return data;
};
