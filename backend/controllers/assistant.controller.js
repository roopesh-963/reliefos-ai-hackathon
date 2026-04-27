const { GoogleGenAI, Type } = require('@google/genai');
const AssistantChat = require('../models/AssistantChat.model');
const SOS = require('../models/SOS.model');
const Resource = require('../models/Resource.model');
const Supply = require('../models/Supply.model');
const Alert = require('../models/Alert.model');
const User = require('../models/User.model');
const { buildGlobalOverview } = require('./globalIntel.controller');

const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const DAY_MS = 24 * 60 * 60 * 1000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 12000;

const FALLBACK_SHELTERS = [
  { name: 'Zone C Shelter', lat: 26.9124, lng: 75.7873, kind: 'Shelter' },
  { name: 'Harbor Relief Camp', lat: 13.0827, lng: 80.2707, kind: 'Camp' },
  { name: 'Hill Base Camp', lat: 30.3165, lng: 78.0322, kind: 'Camp' },
  { name: 'Sector 7 Clinic', lat: 22.5726, lng: 88.3639, kind: 'Clinic' },
];

const GENERAL_MODE_CONTEXT = {
  activeIncidents: 0,
  criticalZones: [],
  prioritizedIncidents: [],
  avgResponseTimeMinutes: 0,
  avgResponseTimeLabel: 'N/A',
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
  globalOverview: undefined,
};

const SUPPLY_COORDS = {
  'Central Hub': { lat: 28.6139, lng: 77.209 },
  'East Depot': { lat: 28.7041, lng: 77.1025 },
  'North Warehouse': { lat: 28.5355, lng: 77.391 },
  'Coastal Depot': { lat: 19.076, lng: 72.8777 },
  'River Camp': { lat: 25.4358, lng: 81.8463 },
  'Zone C Shelter': { lat: 26.9124, lng: 75.7873 },
  'Sector 7 Clinic': { lat: 22.5726, lng: 88.3639 },
  'Hill Base Camp': { lat: 30.3165, lng: 78.0322 },
  'Harbor Relief Camp': { lat: 13.0827, lng: 80.2707 },
  'Airport Triage': { lat: 17.385, lng: 78.4867 },
};

const ROLE_MODES = {
  citizen: 'citizen',
  rescue_team: 'logistics',
  admin: 'admin',
  guest: 'citizen',
};

const normalizePage = (page = '') => {
  const next = String(page).toLowerCase();
  if (next.includes('global')) return 'global';
  if (next.includes('resource')) return 'resources';
  if (next.includes('supply')) return 'supply';
  if (next.includes('analytic')) return 'analytics';
  if (next.includes('sos')) return 'sos';
  if (next.includes('assistant')) return 'assistant';
  if (next.includes('map')) return 'map';
  return 'dashboard';
};

const normalizeMode = (mode = '', role = 'guest', page = 'dashboard') => {
  const next = String(mode).toLowerCase();
  if (['general', 'citizen', 'admin', 'logistics', 'analytics', 'global'].includes(next)) {
    if (page === 'assistant') {
      return 'general';
    }
    return next;
  }
  if (page === 'global') return 'admin';
  if (page === 'assistant') return 'general';
  if (page === 'resources' || page === 'supply') return 'logistics';
  if (page === 'analytics') return 'analytics';
  return ROLE_MODES[role] || 'admin';
};

const getRequestRole = (req) => req.user?.role || 'guest';

const getSessionId = (req) =>
  String(req.body?.sessionId || req.query?.sessionId || `reliefos-${req.user?._id || 'guest'}`).trim();

const toLocationKey = (value = '') => String(value).trim().toLowerCase();

const deriveCoords = (label, fallback = { lat: 20.5937, lng: 78.9629 }) => {
  return SUPPLY_COORDS[label] || fallback;
};

const haversineKm = (a, b) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const base =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(base), Math.sqrt(1 - base));
};

const formatMinutes = (value) => {
  const minutes = Math.max(0, Math.round(Number(value) || 0));
  if (minutes === 0) return 'Arrived';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (error) => error?.code === 'AI_TIMEOUT' || RETRYABLE_STATUS_CODES.has(Number(error?.status));

const withTimeout = async (promise, timeoutMs, label) => {
  let timer = null;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const timeoutError = new Error(`${label} timed out after ${timeoutMs}ms`);
          timeoutError.code = 'AI_TIMEOUT';
          reject(timeoutError);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const generateAssistantContentWithRetry = async (payload, label, options = {}) => {
  if (!ai) {
    const error = new Error('GEMINI_API_KEY is not configured');
    error.code = 'AI_UNAVAILABLE';
    throw error;
  }

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await withTimeout(
        ai.models.generateContent({
          model: AI_MODEL,
          ...payload,
        }),
        timeoutMs,
        label
      );
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }

      const delayMs = attempt * 1000;
      console.warn(`${label} failed with status ${error.status || error.code || 'unknown'}. Retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError;
};

const inferShipmentStatus = (shipment) => {
  if (shipment.status === 'En-route') return 'In Transit';
  if (shipment.status === 'Idle' || shipment.status === 'Loading') return 'Queued';
  if (shipment.status === 'Cancelled') return 'Delayed';
  return shipment.status || 'Queued';
};

const inferShipmentEtaMinutes = (shipment) => {
  if (typeof shipment.etaMinutes === 'number') return shipment.etaMinutes;
  const etaText = String(shipment.eta || '').trim().toLowerCase();
  if (!etaText || etaText === '-') return inferShipmentStatus(shipment) === 'Delivered' ? 0 : 90;
  if (etaText.endsWith('min')) return Number.parseInt(etaText, 10) || 0;
  if (etaText.endsWith('h')) return Math.round((Number.parseFloat(etaText) || 0) * 60);
  return Number.parseInt(etaText, 10) || 90;
};

const normalizeShipment = (shipmentDoc) => {
  const shipment = typeof shipmentDoc.toObject === 'function' ? shipmentDoc.toObject() : shipmentDoc;
  const from = shipment.from || shipment.warehouse || 'Central Hub';
  const to = shipment.to || shipment.destination || 'Relief Zone';
  return {
    _id: String(shipment._id),
    shipmentId: shipment.shipmentId || shipment.trackingId || `SC-${String(shipment._id).slice(-3)}`,
    resourceType: shipment.resourceType || shipment.cargoType || 'Equipment',
    quantity: Number(shipment.quantity || 0),
    from,
    to,
    vehicle: shipment.vehicle || shipment.assignedTruck || 'Field Vehicle',
    driver: shipment.driver || `${shipment.assignedTruck || 'Ops'} Driver`,
    status: inferShipmentStatus(shipment),
    etaMinutes: inferShipmentEtaMinutes(shipment),
    priority: shipment.priority || 'Medium',
    routeState: shipment.routeState || (inferShipmentStatus(shipment) === 'Delayed' ? 'Blocked' : 'Clear'),
    blockedReason: shipment.blockedReason || '',
    destinationType: shipment.destinationType || 'Zone',
    fromCoords: shipment.fromCoords || deriveCoords(from),
    toCoords: shipment.toCoords || deriveCoords(to, { lat: 24.8607, lng: 67.0011 }),
    deliveredAt: shipment.deliveredAt || null,
  };
};

const buildWarehouseSummaries = (resources) => {
  const map = new Map();

  resources.forEach((resourceDoc) => {
    const resource = typeof resourceDoc.toObject === 'function' ? resourceDoc.toObject() : resourceDoc;
    const name = resource.location || 'Central Hub';
    const key = toLocationKey(name);
    const entry =
      map.get(key) ||
      {
        name,
        coords: deriveCoords(name),
        totals: { Medicine: 0, Food: 0, Water: 0, Fuel: 0, Equipment: 0, Ambulance: 0, Blankets: 0 },
        totalUnits: 0,
      };
    entry.totalUnits += Number(resource.quantity || 0);
    const type = resource.type === 'Equipment' ? 'Blankets' : resource.type;
    if (Object.prototype.hasOwnProperty.call(entry.totals, type)) {
      entry.totals[type] += Number(resource.quantity || 0);
    }
    map.set(key, entry);
  });

  return Array.from(map.values()).sort((a, b) => b.totalUnits - a.totalUnits);
};

const summarizeCriticalZones = (sosList) => {
  const counts = new Map();
  sosList.forEach((sosDoc) => {
    const sos = typeof sosDoc.toObject === 'function' ? sosDoc.toObject() : sosDoc;
    const label = sos.region || sos.location?.label || 'Unknown zone';
    const score = sos.severity === 'critical' ? 4 : sos.severity === 'high' ? 3 : sos.severity === 'medium' ? 2 : 1;
    counts.set(label, (counts.get(label) || 0) + score);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, score]) => ({ name, score }));
};

const getAverageResponseMinutes = (resolvedIncidents) => {
  if (resolvedIncidents.length === 0) return 0;
  const total = resolvedIncidents.reduce((sum, sosDoc) => {
    const sos = typeof sosDoc.toObject === 'function' ? sosDoc.toObject() : sosDoc;
    if (!sos.resolvedAt) return sum;
    return sum + Math.max(0, (new Date(sos.resolvedAt) - new Date(sos.createdAt)) / 60000);
  }, 0);
  return Math.round(total / resolvedIncidents.length);
};

const buildShelterDirectory = (shipments, resources, sosList) => {
  const shelters = new Map();
  const remember = (name, kind, coords) => {
    if (!name) return;
    const key = toLocationKey(name);
    if (!shelters.has(key)) {
      shelters.set(key, { name, kind, ...coords });
    }
  };

  shipments.forEach((shipment) => {
    if (['Shelter', 'Camp', 'Clinic'].includes(shipment.destinationType) || /(shelter|camp|clinic|triage)/i.test(shipment.to)) {
      remember(shipment.to, shipment.destinationType || 'Shelter', shipment.toCoords);
    }
  });

  resources.forEach((resourceDoc) => {
    const resource = typeof resourceDoc.toObject === 'function' ? resourceDoc.toObject() : resourceDoc;
    if (resource.deploymentTarget && /(shelter|camp|clinic|triage)/i.test(resource.deploymentTarget)) {
      remember(resource.deploymentTarget, 'Shelter', deriveCoords(resource.deploymentTarget));
    }
  });

  sosList.forEach((sosDoc) => {
    const sos = typeof sosDoc.toObject === 'function' ? sosDoc.toObject() : sosDoc;
    const label = sos.region || sos.location?.label;
    if (label && /(shelter|camp|clinic|triage)/i.test(label)) {
      remember(label, 'Shelter', deriveCoords(label));
    }
  });

  FALLBACK_SHELTERS.forEach((shelter) => remember(shelter.name, shelter.kind, shelter));
  return Array.from(shelters.values());
};

const buildSuggestedPrompts = (page, mode) => {
  const prompts = {
    general: [
      'What are the most urgent issues right now?',
      'Explain this situation in simple terms.',
      'What should I do next?',
      'Summarize today in 5 bullet points.',
      'Compare the current risk picture across operations.',
      'Answer my custom question directly.',
    ],
    citizen: [
      'Where is the nearest shelter right now?',
      'Give me first aid guidance for burns.',
      'What should I do during flash flooding?',
      'How do I report my SOS status clearly?',
      'What emergency kit should I prepare first?',
      'What are the safest evacuation steps tonight?',
    ],
    admin: [
      'Which zones need urgent help?',
      'Summarize active incidents right now.',
      'Which resources are running low?',
      'What should command prioritize in the next hour?',
      'Which rescue teams are under the most pressure?',
      'Give me an executive briefing for leadership.',
    ],
    logistics: [
      'Which shipments are delayed?',
      'Find the nearest warehouse with medicine.',
      'Should any truck be rerouted now?',
      'Which convoy should dispatch next?',
      'What inventory transfer prevents the biggest stockout?',
      'Which zone needs fuel or comms support first?',
    ],
    analytics: [
      'Summarize the current analytics charts.',
      'Compare today vs last week.',
      'What trend looks most worrying?',
      'Which KPI changed most sharply today?',
      'What should I present to judges from this data?',
      'Which incident cluster is escalating fastest?',
    ],
    global: [
      'What is the top global crisis right now?',
      'Summarize war and financial crisis pressure.',
      'What are the main prevention recommendations?',
      'What control and response actions are needed first?',
      'Compare health, food, and energy risks.',
      'Answer my custom question from the current global crisis data.',
    ],
  };

  if (page === 'resources') {
    return [
      'Which inventory items need restocking first?',
      'Show low-stock resources.',
      'Where are medicine reserves lowest?',
      'Which warehouse can rebalance stock fastest?',
      'What shortage is most likely in the next 24 hours?',
      'Which resource allocation reduces the most risk?',
    ];
  }
  if (page === 'supply') {
    return [
      'Which trucks are delayed?',
      'Recommend a reroute now.',
      'Where should we dispatch the next shipment?',
      'Which delivery is blocking operations most?',
      'What is the best convoy sequence for the next hour?',
      'Which shipment should be escalated immediately?',
    ];
  }
  if (page === 'analytics') {
    return [
      'Summarize these metrics.',
      'What changed today vs last week?',
      'What trend needs attention?',
      'Which metric best shows response impact?',
      'Where is operational performance slipping?',
      'What is the clearest headline from this data?',
    ];
  }
  if (page === 'sos') {
    return [
      'What should a citizen do right now?',
      'Give flood safety tips.',
      'Show urgent SOS status guidance.',
      'How do I stay safe until rescue arrives?',
      'What should I tell responders first?',
      'Where should vulnerable people move immediately?',
    ];
  }
  if (page === 'global') {
    return [
      'What is the top global crisis right now?',
      'Summarize financial and food risks globally.',
      'Which crisis lanes need executive attention first?',
      'What prevention actions should leadership prioritize?',
      'Compare war, health, and energy pressures.',
      'Give me a cross-crisis executive briefing.',
    ];
  }
  if (page === 'assistant') {
    return prompts[mode] || prompts.general;
  }

  return prompts[mode] || prompts.admin;
};

const buildGlobalAssistantContext = async ({ page, mode }) => {
  const overview = await buildGlobalOverview();
  const topCard = overview.cards[0] || null;

  return {
    page,
    mode,
    generatedAt: overview.updatedAt,
    aiBriefing: {
      headline: overview.executiveSummary.headline,
      summary: overview.executiveSummary.summary,
      topPriorityReason: topCard?.topSignals?.[0] || overview.executiveSummary.preventionFocus,
      shortageHeadline: overview.executiveSummary.preventionFocus,
      dispatchHeadline: overview.executiveSummary.responseFocus,
    },
    activeIncidents: overview.cards.filter((card) => card.severity !== 'Stable').length,
    criticalZones: overview.cards.map((card) => ({
      name: card.label,
      score: card.score,
    })),
    prioritizedIncidents: overview.cards.map((card, index) => ({
      id: `global-${card.type}`,
      region: card.label,
      severity: card.severity.toLowerCase(),
      crisisType: card.type,
      status: card.severity === 'Critical' ? 'escalating' : card.severity === 'Warning' ? 'watch' : 'stable',
      assignedTeam: 'Global Monitoring Cell',
      createdAt: overview.updatedAt,
      label: card.executiveSummary,
      ageMinutes: 0,
      priorityScore: card.score,
      priorityLabel: card.severity === 'Critical' ? 'Critical' : card.severity === 'Warning' ? 'High' : 'Watch',
      recommendedAction: card.responseActions[0] || 'Maintain cross-sector monitoring.',
      why: card.topSignals.slice(0, 3),
    })),
    avgResponseTimeMinutes: 0,
    avgResponseTimeLabel: 'Global',
    lowStockResources: [],
    activeAlerts: [],
    supplySummary: {
      activeShipments: 0,
      delayedDeliveries: 0,
      deliveredToday: 0,
    },
    delayedShipments: [],
    activeShipments: [],
    shortagePredictions: overview.cards.map((card) => ({
      id: `global-shortage-${card.type}`,
      type: card.label,
      name: `${card.label} prevention`,
      location: 'Global',
      currentQuantity: card.score,
      unit: 'risk score',
      daysRemaining: Number((Math.max(1, (100 - card.score) / 18)).toFixed(1)),
      riskScore: card.score,
      riskLevel: card.severity === 'Critical' ? 'Critical' : card.severity === 'Warning' ? 'High' : 'Stable',
      recommendedAction: card.preventionRecommendations[0] || 'Maintain prevention monitoring.',
      why: card.preventionRecommendations.slice(0, 2),
    })),
    dispatchRecommendations: overview.cards.map((card) => ({
      id: `global-dispatch-${card.type}`,
      incidentId: `global-${card.type}`,
      to: card.label,
      from: 'Executive Command',
      resourceType: 'Coordination',
      quantity: 1,
      unit: 'priority package',
      etaMinutes: 60,
      action: card.responseActions[0] || 'Review response posture.',
      existingShipmentId: null,
      shipmentId: null,
      priorityLabel: card.severity === 'Critical' ? 'Critical' : card.severity === 'Warning' ? 'High' : 'Watch',
      why: card.responseActions.slice(0, 2),
    })),
    warehouses: [],
    nearestShelters: [],
    todayIncidentCount: overview.cards.filter((card) => card.severity === 'Critical').length,
    lastWeekDailyAverage: 0,
    priorWeekDailyAverage: 0,
    totalUsers: 0,
    rescueTeams: 0,
    currentLocation: { lat: 20.5937, lng: 78.9629 },
    suggestedPrompts: buildSuggestedPrompts(page, mode),
    globalOverview: overview,
  };
};

const SEVERITY_WEIGHT = {
  critical: 100,
  high: 72,
  medium: 46,
  low: 24,
};

const STATUS_WEIGHT = {
  pending: 24,
  acknowledged: 14,
  in_progress: 6,
  resolved: 0,
};

const PRIORITY_LABELS = [
  { min: 160, label: 'Critical' },
  { min: 120, label: 'High' },
  { min: 80, label: 'Elevated' },
  { min: 0, label: 'Watch' },
];

const CRISIS_RESOURCE_MAP = {
  flood: ['Water', 'Food', 'Fuel'],
  fire: ['Medicine', 'Water', 'Equipment'],
  medical: ['Medicine', 'Ambulance', 'Water'],
  earthquake: ['Medicine', 'Food', 'Equipment'],
  food: ['Food', 'Water'],
  fuel: ['Fuel', 'Equipment'],
  other: ['Medicine', 'Water'],
};

const getPriorityLabel = (score) => PRIORITY_LABELS.find((item) => score >= item.min)?.label || 'Watch';

const getIncidentAgeMinutes = (incident) => Math.max(0, Math.round((Date.now() - new Date(incident.createdAt).getTime()) / 60000));

const toIncidentView = (sosDoc) => {
  const sos = typeof sosDoc.toObject === 'function' ? sosDoc.toObject() : sosDoc;
  return {
    id: String(sos._id),
    region: sos.region || sos.location?.label || 'Unknown zone',
    severity: sos.severity || 'medium',
    crisisType: sos.crisisType || 'other',
    status: sos.status || 'pending',
    assignedTeam: sos.assignedTeam || null,
    createdAt: sos.createdAt,
    label: sos.location?.label || sos.region || 'Unknown zone',
  };
};

const buildEmergencyPriorities = (sosList, activeAlerts) => {
  const incidents = sosList
    .filter((item) => item.status !== 'resolved')
    .map(toIncidentView);

  const zoneLoad = incidents.reduce((map, incident) => {
    map.set(incident.region, (map.get(incident.region) || 0) + 1);
    return map;
  }, new Map());

  return incidents
    .map((incident) => {
      const ageMinutes = getIncidentAgeMinutes(incident);
      const alertMatch = activeAlerts.some((alert) =>
        [alert.affectedCity, alert.title].some((value) =>
          String(value || '').toLowerCase().includes(incident.region.toLowerCase())
        )
      );
      const clusterPressure = (zoneLoad.get(incident.region) || 1) * 9;
      const unassignedBoost = incident.assignedTeam ? 0 : 12;
      const score =
        (SEVERITY_WEIGHT[incident.severity] || 32) +
        (STATUS_WEIGHT[incident.status] || 0) +
        Math.min(28, Math.floor(ageMinutes / 18)) +
        clusterPressure +
        unassignedBoost +
        (alertMatch ? 10 : 0);

      const why = [
        `${incident.severity} severity incident`,
        `${ageMinutes} minutes since reported`,
        `${zoneLoad.get(incident.region) || 1} active incidents in ${incident.region}`,
      ];

      if (!incident.assignedTeam) {
        why.push('no rescue team assigned yet');
      }
      if (alertMatch) {
        why.push('region overlaps an active alert');
      }
      if (incident.status === 'pending') {
        why.push('incident still waiting for first response');
      }

      const recommendedAction =
        incident.status === 'pending'
          ? `Dispatch first-response team to ${incident.region}`
          : `Escalate support and maintain live monitoring in ${incident.region}`;

      return {
        ...incident,
        ageMinutes,
        priorityScore: score,
        priorityLabel: getPriorityLabel(score),
        recommendedAction,
        why,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5);
};

const buildShortagePredictions = ({ resources, shipments, prioritizedIncidents }) => {
  const incidentDemand = prioritizedIncidents.reduce((map, incident) => {
    const targetTypes = CRISIS_RESOURCE_MAP[incident.crisisType] || CRISIS_RESOURCE_MAP.other;
    targetTypes.forEach((type, index) => {
      const weight = Math.max(1, 3 - index);
      map.set(type, (map.get(type) || 0) + weight * (incident.priorityLabel === 'Critical' ? 2 : 1));
    });
    return map;
  }, new Map());

  return resources
    .map((resourceDoc) => {
      const resource = typeof resourceDoc.toObject === 'function' ? resourceDoc.toObject() : resourceDoc;
      const outgoingUnits = shipments
        .filter(
          (shipment) =>
            shipment.resourceType === resource.type &&
            shipment.from === resource.location &&
            shipment.status !== 'Delivered'
        )
        .reduce((sum, shipment) => sum + Number(shipment.quantity || 0), 0);
      const recentAllocations = Array.isArray(resource.allocations)
        ? resource.allocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0)
        : 0;
      const demandPressure = incidentDemand.get(resource.type) || 0;
      const estimatedDailyBurn = Math.max(6, Math.round(demandPressure * 7 + outgoingUnits * 0.18 + recentAllocations * 0.12));
      const daysRemaining = Number((Number(resource.quantity || 0) / estimatedDailyBurn).toFixed(1));
      const riskScore =
        (resource.status === 'Critical' ? 60 : resource.status === 'Low' ? 34 : 10) +
        Math.max(0, 36 - Number(resource.quantity || 0) / 10) +
        demandPressure * 8 +
        Math.min(24, outgoingUnits / 10);

      const riskLevel = riskScore >= 90 ? 'Critical' : riskScore >= 65 ? 'High' : riskScore >= 40 ? 'Watch' : 'Stable';
      const why = [
        `${resource.quantity} ${resource.unit || 'units'} currently on hand`,
        `${estimatedDailyBurn} ${resource.unit || 'units'} projected daily burn`,
      ];

      if (outgoingUnits > 0) {
        why.push(`${outgoingUnits} ${resource.unit || 'units'} already committed to active shipments`);
      }
      if (demandPressure > 0) {
        why.push(`${demandPressure} demand pressure points from live incidents`);
      }

      return {
        id: String(resource._id),
        type: resource.type,
        name: resource.name,
        location: resource.location,
        currentQuantity: Number(resource.quantity || 0),
        unit: resource.unit || 'units',
        daysRemaining,
        riskScore: Math.round(riskScore),
        riskLevel,
        recommendedAction:
          riskLevel === 'Critical' || riskLevel === 'High'
            ? `Pre-position additional ${resource.type.toLowerCase()} near ${resource.location}`
            : `Monitor ${resource.type.toLowerCase()} burn rate at ${resource.location}`,
        why,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 4);
};

const buildDispatchRecommendations = ({ prioritizedIncidents, warehouses, shipments }) => {
  return prioritizedIncidents
    .slice(0, 3)
    .map((incident) => {
      const preferredTypes = CRISIS_RESOURCE_MAP[incident.crisisType] || CRISIS_RESOURCE_MAP.other;
      const bestWarehouse = [...warehouses]
        .map((warehouse) => ({
          ...warehouse,
          fitScore: preferredTypes.reduce((sum, type, index) => sum + (warehouse.totals[type] || 0) / (index + 1), 0),
          distanceKm: haversineKm(warehouse.coords, deriveCoords(incident.region, warehouse.coords)),
        }))
        .filter((warehouse) => warehouse.fitScore > 0)
        .sort((a, b) => b.fitScore - a.fitScore || a.distanceKm - b.distanceKm)[0];

      const existingShipment = shipments.find(
        (shipment) => shipment.to === incident.region && shipment.status !== 'Delivered'
      );
      const resourceType = preferredTypes.find((type) => (bestWarehouse?.totals[type] || 0) > 0) || preferredTypes[0] || 'Medicine';
      const quantity = incident.priorityLabel === 'Critical' ? 80 : incident.priorityLabel === 'High' ? 50 : 24;

      const why = [
        `${incident.region} is ranked ${incident.priorityLabel.toLowerCase()} priority`,
        `${resourceType} best matches the ${incident.crisisType} incident profile`,
      ];

      if (bestWarehouse) {
        why.push(`${bestWarehouse.name} has the strongest nearby reserve`);
      }
      if (existingShipment) {
        why.push(`existing shipment ${existingShipment.shipmentId} is already moving toward this zone`);
      }

      return {
        id: `dispatch-${incident.id}`,
        incidentId: incident.id,
        to: incident.region,
        from: bestWarehouse?.name || 'Central Hub',
        resourceType,
        quantity,
        unit: 'units',
        etaMinutes: existingShipment?.etaMinutes || Math.max(35, Math.round((bestWarehouse?.distanceKm || 120) * 2.2)),
        action:
          existingShipment
            ? `Reroute support behind ${existingShipment.shipmentId}`
            : `Dispatch ${resourceType.toLowerCase()} convoy from ${bestWarehouse?.name || 'Central Hub'}`,
        existingShipmentId: existingShipment?._id || null,
        shipmentId: existingShipment?.shipmentId || null,
        priorityLabel: incident.priorityLabel,
        why,
      };
    })
    .filter(Boolean);
};

const buildAIOperationsBrief = ({ prioritizedIncidents, shortagePredictions, dispatchRecommendations, context }) => {
  const topIncident = prioritizedIncidents[0];
  const topShortage = shortagePredictions[0];
  const topDispatch = dispatchRecommendations[0];
  const summaryParts = [
    `${context.activeIncidents} live incidents`,
    `${context.supplySummary.activeShipments} active shipments`,
    `${shortagePredictions.filter((item) => item.riskLevel === 'Critical' || item.riskLevel === 'High').length} shortage risks`,
  ];

  return {
    headline: topIncident
      ? `${topIncident.region} needs immediate attention`
      : 'Operational network stable',
    summary: `AI is tracking ${summaryParts.join(', ')} across the response network.`,
    topPriorityReason: topIncident ? topIncident.why[0] : 'No unresolved incidents in the queue.',
    shortageHeadline: topShortage
      ? `${topShortage.type} is the next likely shortage`
      : 'No high-probability shortages predicted',
    dispatchHeadline: topDispatch
      ? topDispatch.action
      : 'No urgent dispatch recommendation pending',
  };
};

const createAction = (type, label, payload = {}, confirmation = '') => ({
  id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  label,
  payload,
  confirmation,
});

const isGreetingMessage = (query = '') =>
  /^(hi|hello|hey|yo|hola|namaste|good morning|good afternoon|good evening)\b/.test(query.trim());

const RESOURCE_TOPIC_ALIASES = {
  fuel: ['fuel', 'diesel', 'petrol', 'gas', 'generator', 'power'],
  medicine: ['medicine', 'medical', 'medicines', 'drug', 'drugs', 'antibiotic', 'ambulance'],
  water: ['water', 'drinking water'],
  food: ['food', 'ration', 'meal', 'meals'],
  equipment: ['equipment', 'gear', 'kit', 'kits', 'blanket', 'blankets'],
};

const inferResourceTopic = (query = '') =>
  Object.entries(RESOURCE_TOPIC_ALIASES).find(([, aliases]) => aliases.some((alias) => query.includes(alias)))?.[0] || null;

const toResourceLabel = (topic = '') => {
  if (topic === 'medicine') return 'Medicine';
  if (topic === 'water') return 'Water';
  if (topic === 'food') return 'Food';
  if (topic === 'fuel') return 'Fuel';
  return 'Equipment';
};

const summarizeResourceTopic = (context, topic) => {
  const label = toResourceLabel(topic);
  const warehouseSnapshots = (context.warehouses || [])
    .map((warehouse) => ({
      name: warehouse.name,
      units: Number(warehouse.totals?.[label] || 0),
    }))
    .filter((warehouse) => warehouse.units > 0)
    .sort((a, b) => b.units - a.units);

  const lowStockSignals = (context.lowStockResources || []).filter((resource) => {
    const haystack = `${resource.name} ${resource.location}`.toLowerCase();
    return haystack.includes(topic) || haystack.includes(label.toLowerCase());
  });

  const shortageSignals = (context.shortagePredictions || []).filter((item) => {
    const haystack = `${item.type} ${item.name} ${item.location}`.toLowerCase();
    return haystack.includes(topic) || haystack.includes(label.toLowerCase());
  });

  const shipmentSignals = (context.activeShipments || []).filter((shipment) => {
    const haystack = `${shipment.resourceType} ${shipment.to} ${shipment.from}`.toLowerCase();
    return haystack.includes(topic) || haystack.includes(label.toLowerCase());
  });

  return {
    label,
    topWarehouses: warehouseSnapshots.slice(0, 3),
    lowStockSignals: lowStockSignals.slice(0, 3),
    shortageSignals: shortageSignals.slice(0, 2),
    shipmentSignals: shipmentSignals.slice(0, 3),
    totalUnits: warehouseSnapshots.reduce((sum, warehouse) => sum + warehouse.units, 0),
  };
};

const buildAssistantContextDigest = (context) => ({
  page: context.page,
  mode: context.mode,
  generatedAt: context.generatedAt,
  aiBriefing: context.aiBriefing,
  activeIncidents: context.activeIncidents,
  criticalZones: (context.criticalZones || []).slice(0, 5),
  prioritizedIncidents: (context.prioritizedIncidents || []).slice(0, 5),
  lowStockResources: (context.lowStockResources || []).slice(0, 6),
  activeAlerts: (context.activeAlerts || []).slice(0, 6),
  supplySummary: context.supplySummary,
  delayedShipments: (context.delayedShipments || []).slice(0, 5),
  activeShipments: (context.activeShipments || []).slice(0, 6),
  shortagePredictions: (context.shortagePredictions || []).slice(0, 5),
  dispatchRecommendations: (context.dispatchRecommendations || []).slice(0, 5),
  warehouses: (context.warehouses || []).slice(0, 5),
  nearestShelters: (context.nearestShelters || []).slice(0, 4),
  todayIncidentCount: context.todayIncidentCount,
  lastWeekDailyAverage: context.lastWeekDailyAverage,
  priorWeekDailyAverage: context.priorWeekDailyAverage,
  totalUsers: context.totalUsers,
  rescueTeams: context.rescueTeams,
  globalOverview: context.globalOverview
    ? {
        updatedAt: context.globalOverview.updatedAt,
        executiveSummary: context.globalOverview.executiveSummary,
        cards: (context.globalOverview.cards || []).slice(0, 5),
      }
    : undefined,
});

const composeRuleBasedReply = ({ message, mode, page, context }) => {
  const query = String(message || '').toLowerCase();
  const actions = [];
  const lines = [];
  const globalCards = Array.isArray(context.globalOverview?.cards) ? context.globalOverview.cards : [];
  const topGlobalCard = globalCards[0];
  const resourceTopic = inferResourceTopic(query);

  if (isGreetingMessage(query)) {
    if (mode === 'general') {
      return {
        reply:
          'Hi. I am ReliefOS AI. You can ask me anything, or switch into operations questions about incidents, shelters, logistics, inventory, and analytics whenever you want.',
        actions,
      };
    }

    return {
      reply:
        `Hi. ${mode === 'global' ? 'Global' : 'Operations'} copilot is online. Ask for a summary, recommendations, or any specific question and I will help from the current context.`,
      actions,
    };
  }

  if (
    mode === 'global' ||
    page === 'global' ||
    query.includes('global') ||
    query.includes('executive briefing') ||
    query.includes('financial') ||
    query.includes('war') ||
    query.includes('food') ||
    query.includes('health') ||
    query.includes('energy') ||
    query.includes('water')
  ) {
    if (topGlobalCard) {
      lines.push(
        `Global briefing: ${topGlobalCard.label} is the lead watch area at ${topGlobalCard.score}/100. ${topGlobalCard.executiveSummary}`
      );

      const mentionedCard =
        globalCards.find((card) =>
          [card.label, card.type.replaceAll('_', ' ')].some((value) => query.includes(String(value).toLowerCase()))
        ) || topGlobalCard;

      if (mentionedCard) {
        lines.push(
          `${mentionedCard.label} key signals include ${mentionedCard.topSignals.slice(0, 3).join(', ')}. Prevention priority: ${mentionedCard.preventionRecommendations[0] || 'maintain early warning'}. Response priority: ${mentionedCard.responseActions[0] || 'maintain executive coordination'}.`
        );
      }

      if (
        query.includes('solution') ||
        query.includes('recommendation') ||
        query.includes('prevent') ||
        query.includes('response') ||
        query.includes('control') ||
        query.includes('action')
      ) {
        lines.push(
          `Recommended actions: prevention should focus on ${mentionedCard?.preventionRecommendations?.slice(0, 2).join(', ') || topGlobalCard.preventionRecommendations.slice(0, 2).join(', ')}. Response should focus on ${mentionedCard?.responseActions?.slice(0, 2).join(', ') || topGlobalCard.responseActions.slice(0, 2).join(', ')}.`
        );
      }
    }
  }

  if (query.includes('nearest shelter')) {
    const nearest = context.nearestShelters.slice(0, 3);
    if (nearest.length > 0) {
      lines.push(`Nearest shelter options are ${nearest.map((item) => `${item.name} (${item.distanceKm.toFixed(1)} km)`).join(', ')}.`);
      actions.push(
        createAction(
          'open_nearest_shelters',
          'Open nearest shelters',
          { shelters: nearest, path: '/map' },
          'Open the crisis map and pin the nearest shelters?'
        )
      );
    } else {
      lines.push('I do not have a verified shelter list yet, so I recommend moving toward the nearest clinic or official relief camp.');
    }
  }

  if (query.includes('sos') && query.includes('status')) {
    lines.push(
      context.activeIncidents > 0
        ? `${context.activeIncidents} SOS incidents are currently active. ${context.criticalZones.length > 0 ? `${context.criticalZones[0].name} is the hottest zone.` : ''}`
        : 'There are no active SOS incidents in the current command feed.'
    );
  }

  if (query.includes('urgent help') || query.includes('critical zone') || query.includes('active incident')) {
    if (context.criticalZones.length > 0) {
      lines.push(
        `Zones needing urgent help right now: ${context.criticalZones
          .map((zone) => `${zone.name} (${zone.score} pressure)`)
          .join(', ')}.`
      );
      actions.push(
        createAction(
          'highlight_critical_sos',
          'Highlight critical SOS',
          { path: '/dashboard', zones: context.criticalZones },
          'Open the dashboard with critical-zone focus?'
        )
      );
    } else {
      lines.push('No critical zone cluster is standing out from current SOS severity data.');
    }
  }

  if (query.includes('response time')) {
    lines.push(`Average response time across resolved incidents is ${context.avgResponseTimeLabel}.`);
  }

  if (query.includes('low stock') || query.includes('resource')) {
    if (context.lowStockResources.length > 0) {
      lines.push(
        `Lowest stock resources right now: ${context.lowStockResources
          .map((resource) => `${resource.name} at ${resource.location} (${resource.quantity} ${resource.unit})`)
          .join(', ')}.`
      );
    } else {
      lines.push('Resource inventory is currently above low-stock thresholds.');
    }
  }

  if (resourceTopic) {
    const resourceSummary = summarizeResourceTopic(context, resourceTopic);

    if (query.includes('cost') || query.includes('price')) {
      lines.push(
        `ReliefOS does not currently track live ${resourceTopic} market pricing or unit cost. It tracks operational inventory, shortage risk, and deliveries instead.`
      );
    }

    if (resourceSummary.totalUnits > 0) {
      lines.push(
        `${resourceSummary.label} visibility: ${resourceSummary.totalUnits} units are visible across tracked warehouses${
          resourceSummary.topWarehouses.length > 0
            ? `, led by ${resourceSummary.topWarehouses.map((warehouse) => `${warehouse.name} (${warehouse.units})`).join(', ')}`
            : ''
        }.`
      );
    }

    if (resourceSummary.lowStockSignals.length > 0) {
      lines.push(
        `Low-stock ${resourceTopic} signals: ${resourceSummary.lowStockSignals
          .map((resource) => `${resource.name} at ${resource.location} (${resource.quantity} ${resource.unit})`)
          .join(', ')}.`
      );
    }

    if (resourceSummary.shortageSignals.length > 0) {
      lines.push(
        `${resourceSummary.label} shortage outlook: ${resourceSummary.shortageSignals
          .map((item) => `${item.location} is ${item.riskLevel.toLowerCase()} risk with ${item.daysRemaining} days remaining`)
          .join(', ')}.`
      );
    }

    if (resourceSummary.shipmentSignals.length > 0) {
      lines.push(
        `${resourceSummary.label} shipments in motion: ${resourceSummary.shipmentSignals
          .map((shipment) => `${shipment.shipmentId} to ${shipment.to} (${shipment.status}, ${formatMinutes(shipment.etaMinutes)})`)
          .join(', ')}.`
      );
    }

    if (
      lines.length === 0 ||
      query.includes('what is') ||
      query.includes('status') ||
      query.includes('situation') ||
      query.includes('summary')
    ) {
      if (
        resourceSummary.totalUnits === 0 &&
        resourceSummary.lowStockSignals.length === 0 &&
        resourceSummary.shortageSignals.length === 0 &&
        resourceSummary.shipmentSignals.length === 0
      ) {
        lines.push(
          `I do not have a direct ${resourceTopic} inventory signal in the current dataset, but I can still answer nearby logistics questions from incidents, shipments, and low-stock alerts.`
        );
      }
    }
  }

  if (query.includes('delayed') || query.includes('truck') || query.includes('shipment')) {
    if (context.delayedShipments.length > 0) {
      lines.push(
        `Delayed or blocked shipments: ${context.delayedShipments
          .map((shipment) => `${shipment.shipmentId} to ${shipment.to} (${shipment.status}, ${formatMinutes(shipment.etaMinutes)})`)
          .join(', ')}.`
      );
      actions.push(
        createAction(
          'filter_delayed_deliveries',
          'Filter delayed deliveries',
          { path: '/supply', filter: 'delayed' },
          'Open the Supply Chain page filtered to delayed deliveries?'
        )
      );
    } else {
      lines.push('No delayed trucks are currently visible in the logistics feed.');
    }
  }

  if (query.includes('reroute')) {
    const shipment = context.delayedShipments[0] || context.activeShipments[0];
    if (shipment) {
      lines.push(
        `${shipment.shipmentId} is the best reroute candidate. ${shipment.blockedReason || `${shipment.to} is carrying route pressure.`}`
      );
      actions.push(
        createAction(
          'reroute_shipment',
          `Reroute ${shipment.shipmentId}`,
          { shipmentId: shipment._id, reason: shipment.blockedReason || `Alternate corridor approved for ${shipment.to}` },
          `Reroute ${shipment.shipmentId} now?`
        )
      );
    }
  }

  if (query.includes('warehouse') && query.includes('medicine')) {
    const medicineWarehouse = context.warehouses.find((warehouse) => warehouse.totals.Medicine > 0);
    if (medicineWarehouse) {
      lines.push(
        `${medicineWarehouse.name} has the strongest medicine reserve at ${medicineWarehouse.totals.Medicine} units.`
      );
    } else {
      lines.push('No warehouse currently shows a positive medicine reserve.');
    }
  }

  if (query.includes('compare today') || query.includes('last week')) {
    lines.push(
      `Incidents today: ${context.todayIncidentCount}. Last 7-day daily average: ${context.lastWeekDailyAverage}. ${context.todayIncidentCount > context.lastWeekDailyAverage ? 'Today is running hotter than the weekly baseline.' : 'Today is below the weekly incident baseline.'}`
    );
  }

  if (query.includes('summarize chart') || query.includes('trend insight') || query.includes('analytics')) {
    lines.push(
      `Analytics snapshot: ${context.activeIncidents} active incidents, ${context.supplySummary.activeShipments} live shipments, ${context.supplySummary.delayedDeliveries} delayed deliveries, and ${context.lowStockResources.length} low-stock resources.`
    );
    actions.push(
      createAction(
        'export_analytics_report',
        'Export analytics report',
        { path: '/analytics' },
        'Generate and download a fresh analytics report?'
      )
    );
  }

  if (query.includes('create shipment') || query.includes('dispatch')) {
    const warehouse = context.warehouses[0];
    const target = context.criticalZones[0]?.name || context.nearestShelters[0]?.name || 'Zone C Shelter';
    if (warehouse) {
      lines.push(`I can stage a shipment from ${warehouse.name} to ${target}. Review and confirm before dispatch.`);
      actions.push(
        createAction(
          'create_shipment',
          'Create suggested shipment',
          {
            resourceType: 'Medicine',
            quantity: 20,
            unit: 'units',
            from: warehouse.name,
            to: target,
            vehicle: 'SC-204',
            driver: 'Ops Auto-Assign',
            etaMinutes: 90,
            priority: 'High',
            destinationType: 'Shelter',
            notes: 'Assistant-generated dispatch proposal',
          },
          `Create a medicine shipment from ${warehouse.name} to ${target}?`
        )
      );
    }
  }

  if (query.includes('safety') || query.includes('first aid') || query.includes('contact')) {
    lines.push(
      'For immediate safety: move to higher ground if flooding is active, avoid downed power lines, control bleeding with steady pressure, and use official local emergency numbers first. Seek the nearest shelter or clinic if symptoms are worsening.'
    );
  }

  if (lines.length === 0) {
    if (mode === 'global' && topGlobalCard) {
      lines.push(
        `Global assistant mode is active. ${topGlobalCard.label} currently leads the watchlist at ${topGlobalCard.score}/100. Key signals: ${topGlobalCard.topSignals.slice(0, 3).join(', ')}. Prevention focus: ${topGlobalCard.preventionRecommendations[0] || 'maintain early warning'}. Response focus: ${topGlobalCard.responseActions[0] || 'maintain executive coordination'}.`
      );
    } else
    if (mode === 'citizen') {
      lines.push(
        `Citizen support is live. I can help with nearest shelters, safety guidance, SOS status, and emergency contacts. Right now there are ${context.activeIncidents} active incidents in the system.`
      );
    } else if (mode === 'logistics') {
      lines.push(
        `Logistics view is active. There are ${context.supplySummary.activeShipments} live shipments, ${context.supplySummary.delayedDeliveries} delayed deliveries, and ${context.lowStockResources.length} low-stock resource signals.`
      );
    } else if (mode === 'analytics') {
      lines.push(
        `Analytics mode is active. Today has ${context.todayIncidentCount} incidents against a ${context.lastWeekDailyAverage} daily baseline, with average response time at ${context.avgResponseTimeLabel}.`
      );
    } else if (page === 'global' && topGlobalCard) {
      lines.push(
        `Global crisis mode is active. ${topGlobalCard.label} currently carries the highest score at ${topGlobalCard.score}/100, and ReliefOS is tracking ${globalCards.length} cross-sector crisis lanes.`
      );
    } else {
      lines.push(
        `Operations snapshot: ${context.activeIncidents} active incidents, ${context.criticalZones.length} critical zone clusters, ${context.lowStockResources.length} low-stock resources, and ${context.supplySummary.activeShipments} live shipments.`
      );
    }
  }

  if (page === 'resources') {
    lines.push('You are on the Resource page, so inventory and warehouse signals are weighted more heavily in this answer.');
  } else if (page === 'supply') {
    lines.push('You are on the Supply Chain page, so convoy routes and delivery pressure are prioritized.');
  } else if (page === 'analytics') {
    lines.push('You are on the Analytics page, so incident trend and KPI interpretation are prioritized.');
  } else if (page === 'dashboard') {
    lines.push('You are on the Dashboard, so live incident severity and operational pressure are in focus.');
  } else if (page === 'global') {
    lines.push('You are on the Global Crisis page, so cross-sector executive risk and prevention priorities are in focus.');
  }

  return { reply: lines.join(' '), actions };
};

const maybeGenerateAIReply = async ({ messages, mode, page, context, actionCandidates }) => {
  if (!ai) {
    return null;
  }

  const recentMessages = Array.isArray(messages) ? messages.slice(-20) : [];
  const contents = recentMessages.map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(item.text || '') }],
  }));

  contents.unshift({
    role: 'user',
    parts: [
      {
        text: [
          `Mode: ${mode}`,
          `Page: ${page}`,
          `Live operational context JSON: ${JSON.stringify(buildAssistantContextDigest(context))}`,
          `Allowed assistant actions JSON: ${JSON.stringify(actionCandidates)}`,
        ].join('\n'),
      },
    ],
  });

  const response = await generateAssistantContentWithRetry(
    {
      contents,
      config: {
        systemInstruction: [
          'You are ReliefOS Operations Copilot, a capable general AI assistant inside a disaster response platform.',
          mode === 'general'
            ? 'General mode is active. Default to a broad ChatGPT-style assistant behavior, and only bring in live operational context when the user asks about ReliefOS, emergencies, logistics, analytics, shelters, incidents, or resources.'
            : `The active copilot mode is ${mode}. Prioritize answers that fit that operational mode while still answering naturally.`,
          'Answer any user question naturally, not just predefined prompts.',
          'When the question is about ReliefOS operations, incidents, logistics, analytics, shelters, or resources, ground the answer in the provided live context and recent chat history.',
          'When the question is broader or outside the tracked ReliefOS data, answer it with normal general knowledge and clearly distinguish that from live platform data.',
          'If the user asks for a metric the system does not track, say that clearly. If helpful, then add the nearest operational signal you do have.',
          'Be concise, useful, and specific. Do not invent database fields, prices, incidents, or measurements that are not available.',
          'Only return actions that exactly match the provided allowed assistant actions.',
        ].join(' '),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  label: { type: Type.STRING },
                },
                required: ['type', 'label'],
              },
            },
          },
          required: ['reply'],
        },
      },
    },
    'Operations Copilot chat generation',
    { maxRetries: 2, timeoutMs: 12000 }
  );

  if (!response.text) {
    return null;
  }

  const parsed = JSON.parse(response.text);
  const allowed = Array.isArray(parsed.actions)
    ? parsed.actions
        .map((action) => actionCandidates.find((candidate) => candidate.type === action.type && candidate.label === action.label))
        .filter(Boolean)
    : [];
  return {
    reply: parsed.reply,
    actions: allowed,
  };
};

const maybeGenerateGeneralChatReply = async ({ messages }) => {
  if (!ai) {
    return null;
  }

  const recentMessages = Array.isArray(messages) ? messages.slice(-24) : [];
  const contents = recentMessages.map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(item.text || '') }],
  }));

  const response = await generateAssistantContentWithRetry(
    {
      contents,
      config: {
        systemInstruction: [
          'You are ReliefOS AI in General mode.',
          'Behave like a normal, helpful ChatGPT-style assistant.',
          'Answer the user directly from Gemini using the conversation history.',
          'Do not force operational summaries, crisis briefings, or predefined templates unless the user explicitly asks for ReliefOS operations, incidents, logistics, shelters, analytics, or resources.',
          'Be natural, conversational, and useful.',
        ].join(' '),
      },
    },
    'General mode Gemini chat generation',
    { maxRetries: 2, timeoutMs: 12000 }
  );

  if (!response.text) {
    return null;
  }

  return {
    reply: String(response.text).trim(),
    actions: [],
  };
};

const loadOperationalContext = async ({ page, mode, lat, lng }) => {
  if (page === 'assistant' && mode === 'general') {
    return {
      ...GENERAL_MODE_CONTEXT,
      page: 'assistant',
      mode: 'general',
      generatedAt: new Date().toISOString(),
      aiBriefing: {
        headline: 'General AI mode active',
        summary: 'Gemini direct chat is active on this page.',
        topPriorityReason: 'Operational overlays are disabled unless you move to an operations page.',
        shortageHeadline: 'No operational shortage summary in general mode.',
        dispatchHeadline: 'No dispatch recommendation in general mode.',
      },
      suggestedPrompts: [
        'Hi',
        'Explain climate change simply.',
        'Help me write a short email.',
        'Summarize today in 5 bullet points.',
        'What is the difference between AI and ML?',
        'How should I learn JavaScript?',
      ],
    };
  }

  if (page === 'global' || mode === 'global') {
    return buildGlobalAssistantContext({ page: 'global', mode: 'global' });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [sosList, resourceDocs, shipmentDocs, alerts, totalUsers, rescueTeams] = await Promise.all([
    SOS.find().sort({ createdAt: -1 }).limit(120),
    Resource.find().sort({ updatedAt: -1 }).limit(160),
    Supply.find().sort({ createdAt: -1 }).limit(120),
    Alert.find({ isActive: true }).sort({ createdAt: -1 }).limit(12),
    User.countDocuments(),
    User.countDocuments({ role: 'rescue_team' }),
  ]);

  const activeIncidents = sosList.filter((item) => item.status !== 'resolved');
  const resolvedIncidents = sosList.filter((item) => item.status === 'resolved' && item.resolvedAt);
  const criticalZones = summarizeCriticalZones(activeIncidents);
  const avgResponseMinutes = getAverageResponseMinutes(resolvedIncidents);
  const lowStockResources = resourceDocs
    .filter((resource) => Number(resource.quantity || 0) <= 120 || resource.status === 'Low' || resource.status === 'Critical')
    .slice(0, 6)
    .map((resource) => ({
      id: String(resource._id),
      name: resource.name,
      quantity: Number(resource.quantity || 0),
      unit: resource.unit || 'units',
      location: resource.location,
    }));

  const shipments = shipmentDocs.map(normalizeShipment);
  const delayedShipments = shipments
    .filter((shipment) => shipment.status === 'Delayed' || shipment.routeState === 'Blocked' || shipment.status === 'Rerouted')
    .slice(0, 5);
  const activeShipments = shipments.filter((shipment) => shipment.status !== 'Delivered');
  const warehouses = buildWarehouseSummaries(resourceDocs);
  const shelterDirectory = buildShelterDirectory(shipments, resourceDocs, sosList);
  const prioritizedIncidents = buildEmergencyPriorities(sosList, alerts);
  const shortagePredictions = buildShortagePredictions({
    resources: resourceDocs,
    shipments: activeShipments,
    prioritizedIncidents,
  });
  const dispatchRecommendations = buildDispatchRecommendations({
    prioritizedIncidents,
    warehouses,
    shipments: activeShipments,
  });

  const currentLocation =
    typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : { lat: 20.5937, lng: 78.9629 };

  const nearestShelters = shelterDirectory
    .map((shelter) => ({
      ...shelter,
      distanceKm: haversineKm(currentLocation, shelter),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 4);

  const todayIncidentCount = sosList.filter((item) => new Date(item.createdAt) >= todayStart).length;
  const lastWeekCount = sosList.filter((item) => new Date(item.createdAt) >= sevenDaysAgo && new Date(item.createdAt) < now).length;
  const priorWeekCount = sosList.filter((item) => new Date(item.createdAt) >= fourteenDaysAgo && new Date(item.createdAt) < sevenDaysAgo).length;

  const context = {
    page,
    mode,
    generatedAt: now.toISOString(),
    activeIncidents: activeIncidents.length,
    criticalZones,
    avgResponseTimeMinutes: avgResponseMinutes,
    avgResponseTimeLabel: formatMinutes(avgResponseMinutes),
    lowStockResources,
    activeAlerts: alerts.map((alert) => ({
      id: String(alert._id),
      title: alert.title,
      type: alert.type,
      affectedCity: alert.affectedCity,
    })),
    supplySummary: {
      activeShipments: activeShipments.length,
      delayedDeliveries: delayedShipments.length,
      deliveredToday: shipments.filter((shipment) => shipment.deliveredAt && new Date(shipment.deliveredAt) >= todayStart).length,
    },
    delayedShipments,
    activeShipments: activeShipments.slice(0, 6),
    warehouses,
    nearestShelters,
    todayIncidentCount,
    lastWeekDailyAverage: Number((lastWeekCount / 7).toFixed(1)),
    priorWeekDailyAverage: Number((priorWeekCount / 7).toFixed(1)),
    totalUsers,
    rescueTeams,
    currentLocation,
    suggestedPrompts: buildSuggestedPrompts(page, mode),
  };

  const baseContext = {
    ...context,
    prioritizedIncidents,
    shortagePredictions,
    dispatchRecommendations,
    aiBriefing: buildAIOperationsBrief({
      prioritizedIncidents,
      shortagePredictions,
      dispatchRecommendations,
      context,
    }),
  };

  if (page === 'assistant') {
    try {
      const globalOverview = await buildGlobalOverview();
      return {
        ...baseContext,
        globalOverview,
        suggestedPrompts: buildSuggestedPrompts('global', 'global'),
      };
    } catch (error) {
      console.warn('Assistant global overview fallback engaged:', error.message);
    }
  }

  return baseContext;
};

const readHistory = async ({ sessionId, role, page, mode, userId = null }) => {
  const filter = userId ? { sessionId, userId } : { sessionId };
  let chat = await AssistantChat.findOne(filter).sort({ updatedAt: -1 });
  if (!chat) {
    chat = await AssistantChat.create({ sessionId, role, page, mode, userId, messages: [] });
  }
  return chat;
};

const writeHistory = async ({ chat, role, page, mode, userId = null, messages }) => {
  chat.role = role;
  chat.page = page;
  chat.mode = mode;
  chat.userId = userId || chat.userId || null;
  chat.messages = messages.slice(-40);
  await chat.save();
  return chat;
};

const getContext = async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const role = getRequestRole(req);
    const page = normalizePage(req.query.page);
    const mode = normalizeMode(req.query.mode, role, page);
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lng = req.query.lng ? Number(req.query.lng) : undefined;
    const chat = await readHistory({ sessionId, role, page, mode, userId: req.user?._id || null });
    const context = await loadOperationalContext({ page, mode, lat, lng });

    res.json({
      sessionId,
      mode,
      role,
      page,
      history: chat.messages,
      context,
    });
  } catch (error) {
    console.error('Assistant context error:', error);
    res.status(500).json({ message: 'Failed to load assistant context' });
  }
};

const chat = async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    const role = getRequestRole(req);
    const page = normalizePage(req.body?.page);
    const mode = normalizeMode(req.body?.mode, role, page);
    const lat = typeof req.body?.lat === 'number' ? req.body.lat : undefined;
    const lng = typeof req.body?.lng === 'number' ? req.body.lng : undefined;
    const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const latestUserMessage = [...incomingMessages].reverse().find((item) => item.role === 'user');

    if (!latestUserMessage || !String(latestUserMessage.text || '').trim()) {
      return res.status(400).json({ message: 'A user message is required' });
    }

    const chatDoc = await readHistory({ sessionId, role, page, mode, userId: req.user?._id || null });
    const context = await loadOperationalContext({ page, mode, lat, lng });
    const isPureGeneralChat = page === 'assistant' && mode === 'general';
    let result;

    if (isPureGeneralChat) {
      try {
        const aiResult = await maybeGenerateGeneralChatReply({
          messages: incomingMessages,
        });

        if (aiResult?.reply) {
          result = aiResult;
        } else {
          result = {
            reply: 'I could not generate a Gemini response right now. Please try again.',
            actions: [],
          };
        }
      } catch (error) {
        console.warn('General Gemini chat fallback engaged:', error.message);
        result = {
          reply:
            'Gemini chat is temporarily unavailable right now. Please try again in a moment.',
          actions: [],
        };
      }
    } else {
      const fallback = composeRuleBasedReply({
        message: latestUserMessage.text,
        mode,
        page,
        context,
      });

      result = fallback;
      try {
        const aiResult = await maybeGenerateAIReply({
          messages: incomingMessages,
          mode,
          page,
          context,
          actionCandidates: fallback.actions,
        });
        if (aiResult?.reply) {
          result = {
            reply: aiResult.reply,
            actions: Array.isArray(aiResult.actions) ? aiResult.actions : fallback.actions,
          };
        }
      } catch (error) {
        console.warn('Assistant AI fallback engaged:', error.message);
      }
    }

    const persistedMessages = [
      ...incomingMessages.map((message) => ({
        role: message.role,
        text: message.text,
        page,
        mode,
        createdAt: new Date(),
      })),
      {
        role: 'assistant',
        text: result.reply,
        page,
        mode,
        createdAt: new Date(),
      },
    ];
    await writeHistory({ chat: chatDoc, role, page, mode, userId: req.user?._id || null, messages: persistedMessages });

    res.json({
      reply: result.reply,
      actions: result.actions,
      suggestedPrompts: context.suggestedPrompts,
      context,
    });
  } catch (error) {
    console.error('Assistant chat error:', error);
    res.status(500).json({ message: 'Failed to generate assistant response' });
  }
};

const clearHistory = async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    await AssistantChat.findOneAndUpdate(
      { sessionId, userId: req.user?._id || null },
      {
        $set: {
          messages: [],
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    res.json({ message: 'Assistant history cleared' });
  } catch (error) {
    console.error('Assistant history clear error:', error);
    res.status(500).json({ message: 'Failed to clear assistant history' });
  }
};

module.exports = {
  chat,
  getContext,
  clearHistory,
};
