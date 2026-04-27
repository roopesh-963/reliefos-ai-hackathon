import api from './http';

export type GlobalCrisisType =
  | 'natural_disaster'
  | 'financial_crisis'
  | 'war_conflict'
  | 'food_shortage'
  | 'health_outbreak'
  | 'energy_water_crisis';

export interface GlobalCrisisArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl?: string | null;
  classification: GlobalCrisisType;
  confidence: number;
}

export interface GlobalCrisisMetric {
  label: string;
  value: string;
}

export interface GlobalCrisisSource {
  provider: string;
  label: string;
  url?: string;
}

export interface GlobalCrisisCard {
  type: GlobalCrisisType;
  label: string;
  severity: 'Critical' | 'Warning' | 'Stable';
  score: number;
  summary: string;
  executiveSummary: string;
  classification: GlobalCrisisType;
  topSignals: string[];
  preventionRecommendations: string[];
  responseActions: string[];
  metrics: GlobalCrisisMetric[];
  articles: GlobalCrisisArticle[];
  sources: GlobalCrisisSource[];
}

export interface GlobalExecutiveSummary {
  headline: string;
  summary: string;
  watchwords: string[];
  preventionFocus: string;
  responseFocus: string;
}

export interface GlobalSourceStatus {
  newsApiEnabled: boolean;
  aiEnabled: boolean;
  usgsEnabled: boolean;
  worldBankEnabled: boolean;
  outbreakEnabled: boolean;
  mode: 'live' | 'partial';
}

export interface GlobalCrisisOverview {
  updatedAt: string;
  executiveSummary: GlobalExecutiveSummary;
  cards: GlobalCrisisCard[];
  sourceStatus: GlobalSourceStatus;
}

export const fetchGlobalCrisisOverview = async (): Promise<GlobalCrisisOverview> => {
  const { data } = await api.get('/global-intel/overview');
  return data;
};
