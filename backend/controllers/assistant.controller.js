const { GoogleGenAI, Type } = require('@google/genai');
const AssistantChat = require('../models/AssistantChat.model');
const SOS = require('../models/SOS.model');
const Resource = require('../models/Resource.model');
const Supply = require('../models/Supply.model');
const Alert = require('../models/Alert.model');
const User = require('../models/User.model');

const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const DAY_MS = 24 * 60 * 60 * 1000;

const FALLBACK_SHELTERS = [
  { name: 'Zone C Shelter', lat: 26.9124, lng: 75.7873, kind: 'Shelter' },
  { name: 'Harbor Relief Camp', lat: 13.0827, lng: 80.2707, kind: 'Camp' },
  { name: 'Hill Base Camp', lat: 30.3165, lng: 78.0322, kind: 'Camp' },
  { name: 'Sector 7 Clinic', lat: 22.5726, lng: 88.3639, kind: 'Clinic' },
];

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
  if (['citizen', 'admin', 'logistics', 'analytics'].includes(next)) {
    return next;
  }
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

  return prompts[mode] || prompts.admin;
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

const composeRuleBasedReply = ({ message, mode, page, context }) => {
  const query = String(message || '').toLowerCase();
  const actions = [];
  const lines = [];

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
  }

  return { reply: lines.join(' '), actions };
};

const maybeGenerateAIReply = async ({ message, mode, page, context, actionCandidates }) => {
  if (!ai) {
    return null;
  }

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Mode: ${mode}`,
              `Page: ${page}`,
              `User message: ${message}`,
              `Context JSON: ${JSON.stringify(context)}`,
              `Available actions JSON: ${JSON.stringify(actionCandidates)}`,
              'Respond as ReliefOS Operations Copilot. Prefer grounded, concise operational language. Keep actions only if truly relevant.',
            ].join('\n'),
          },
        ],
      },
    ],
    config: {
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
  });

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

const loadOperationalContext = async ({ page, mode, lat, lng }) => {
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

  return {
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
  chat.messages = messages.slice(-24);
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
    const fallback = composeRuleBasedReply({
      message: latestUserMessage.text,
      mode,
      page,
      context,
    });

    let result = fallback;
    try {
      const aiResult = await maybeGenerateAIReply({
        message: latestUserMessage.text,
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
