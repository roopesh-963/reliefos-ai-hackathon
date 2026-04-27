import api from './http';
import type { GlobalCrisisOverview } from './globalIntel';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantAction {
  id: string;
  type:
    | 'create_shipment'
    | 'highlight_critical_sos'
    | 'export_analytics_report'
    | 'open_nearest_shelters'
    | 'filter_delayed_deliveries'
    | 'reroute_shipment';
  label: string;
  payload?: Record<string, any>;
  confirmation?: string;
}

export interface AssistantContextSnapshot {
  page: string;
  mode: string;
  generatedAt: string;
  aiBriefing: {
    headline: string;
    summary: string;
    topPriorityReason: string;
    shortageHeadline: string;
    dispatchHeadline: string;
  };
  activeIncidents: number;
  criticalZones: Array<{ name: string; score: number }>;
  prioritizedIncidents: Array<{
    id: string;
    region: string;
    severity: string;
    crisisType: string;
    status: string;
    assignedTeam: string | null;
    createdAt: string;
    label: string;
    ageMinutes: number;
    priorityScore: number;
    priorityLabel: string;
    recommendedAction: string;
    why: string[];
  }>;
  avgResponseTimeMinutes: number;
  avgResponseTimeLabel: string;
  lowStockResources: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    location: string;
  }>;
  activeAlerts: Array<{
    id: string;
    title: string;
    type: string;
    affectedCity: string;
  }>;
  supplySummary: {
    activeShipments: number;
    delayedDeliveries: number;
    deliveredToday: number;
  };
  delayedShipments: Array<{
    _id: string;
    shipmentId: string;
    to: string;
    status: string;
    etaMinutes: number;
    blockedReason: string;
  }>;
  activeShipments: Array<{
    _id: string;
    shipmentId: string;
    to: string;
    status: string;
    etaMinutes: number;
  }>;
  shortagePredictions: Array<{
    id: string;
    type: string;
    name: string;
    location: string;
    currentQuantity: number;
    unit: string;
    daysRemaining: number;
    riskScore: number;
    riskLevel: string;
    recommendedAction: string;
    why: string[];
  }>;
  dispatchRecommendations: Array<{
    id: string;
    incidentId: string;
    to: string;
    from: string;
    resourceType: string;
    quantity: number;
    unit: string;
    etaMinutes: number;
    action: string;
    existingShipmentId: string | null;
    shipmentId: string | null;
    priorityLabel: string;
    why: string[];
  }>;
  warehouses: Array<{
    name: string;
    coords: { lat: number; lng: number };
    totals: Record<string, number>;
    totalUnits: number;
  }>;
  nearestShelters: Array<{
    name: string;
    kind: string;
    lat: number;
    lng: number;
    distanceKm: number;
  }>;
  todayIncidentCount: number;
  lastWeekDailyAverage: number;
  priorWeekDailyAverage: number;
  totalUsers: number;
  rescueTeams: number;
  currentLocation: { lat: number; lng: number };
  suggestedPrompts: string[];
  globalOverview?: GlobalCrisisOverview;
}

export interface AssistantContextResponse {
  sessionId: string;
  role: string;
  page: string;
  mode: string;
  history: ChatMessage[];
  context: AssistantContextSnapshot;
}

export interface AssistantChatResponse {
  reply: string;
  actions: AssistantAction[];
  suggestedPrompts: string[];
  context: AssistantContextSnapshot;
}

export const defaultAssistantContext: AssistantContextSnapshot = {
  page: 'dashboard',
  mode: 'admin',
  generatedAt: new Date(0).toISOString(),
  aiBriefing: {
    headline: 'Operational network stable',
    summary: 'AI briefing is waiting for live context.',
    topPriorityReason: 'No priority rationale available yet.',
    shortageHeadline: 'No shortage forecast available yet.',
    dispatchHeadline: 'No dispatch recommendation available yet.',
  },
  activeIncidents: 0,
  criticalZones: [],
  prioritizedIncidents: [],
  avgResponseTimeMinutes: 0,
  avgResponseTimeLabel: '0 min',
  lowStockResources: [],
  activeAlerts: [],
  supplySummary: {
    activeShipments: 0,
    delayedDeliveries: 0,
    deliveredToday: 0,
  },
  delayedShipments: [],
  activeShipments: [],
  shortagePredictions: [],
  dispatchRecommendations: [],
  warehouses: [],
  nearestShelters: [],
  todayIncidentCount: 0,
  lastWeekDailyAverage: 0,
  priorWeekDailyAverage: 0,
  totalUsers: 0,
  rescueTeams: 0,
  currentLocation: { lat: 20.5937, lng: 78.9629 },
  suggestedPrompts: [],
  globalOverview: undefined,
};

export const normalizeAssistantContext = (input: Partial<AssistantContextSnapshot> | null | undefined): AssistantContextSnapshot => {
  const source = input || {};

  return {
    ...defaultAssistantContext,
    ...source,
    aiBriefing: {
      ...defaultAssistantContext.aiBriefing,
      ...(source.aiBriefing || {}),
    },
    criticalZones: Array.isArray(source.criticalZones) ? source.criticalZones : [],
    prioritizedIncidents: Array.isArray(source.prioritizedIncidents) ? source.prioritizedIncidents : [],
    lowStockResources: Array.isArray(source.lowStockResources) ? source.lowStockResources : [],
    activeAlerts: Array.isArray(source.activeAlerts) ? source.activeAlerts : [],
    supplySummary: {
      ...defaultAssistantContext.supplySummary,
      ...(source.supplySummary || {}),
    },
    delayedShipments: Array.isArray(source.delayedShipments) ? source.delayedShipments : [],
    activeShipments: Array.isArray(source.activeShipments) ? source.activeShipments : [],
    shortagePredictions: Array.isArray(source.shortagePredictions) ? source.shortagePredictions : [],
    dispatchRecommendations: Array.isArray(source.dispatchRecommendations) ? source.dispatchRecommendations : [],
    warehouses: Array.isArray(source.warehouses) ? source.warehouses : [],
    nearestShelters: Array.isArray(source.nearestShelters) ? source.nearestShelters : [],
    currentLocation: source.currentLocation || defaultAssistantContext.currentLocation,
    suggestedPrompts: Array.isArray(source.suggestedPrompts) ? source.suggestedPrompts : [],
    globalOverview: source.globalOverview,
  };
};

export const getAssistantContext = async (params: {
  sessionId: string;
  role: string;
  page: string;
  mode: string;
  lat?: number;
  lng?: number;
}): Promise<AssistantContextResponse> => {
  const { data } = await api.get('/assistant/context', { params });
  return {
    ...data,
    history: Array.isArray(data?.history) ? data.history : [],
    context: normalizeAssistantContext(data?.context),
  };
};

export const sendAssistantChatMessage = async (payload: {
  sessionId: string;
  role: string;
  page: string;
  mode: string;
  messages: ChatMessage[];
  lat?: number;
  lng?: number;
}): Promise<AssistantChatResponse> => {
  const { data } = await api.post('/assistant/chat', payload);
  return {
    ...data,
    actions: Array.isArray(data?.actions) ? data.actions : [],
    suggestedPrompts: Array.isArray(data?.suggestedPrompts) ? data.suggestedPrompts : [],
    context: normalizeAssistantContext(data?.context),
  };
};

export const clearAssistantHistory = async (payload: { sessionId: string }): Promise<{ message: string }> => {
  const { data } = await api.delete('/assistant/history', { data: payload });
  return data;
};
