const SOS = require('../models/SOS.model');
const Resource = require('../models/Resource.model');
const User = require('../models/User.model');
const Alert = require('../models/Alert.model');

const RESOURCE_TYPES = ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Ambulance'];
const SEVERITY_BUCKETS = ['low', 'medium', 'critical'];
const CRISIS_RULES = [
  { type: 'flood', pattern: /(flood|water|rain|storm|cyclone|typhoon)/i },
  { type: 'fire', pattern: /(fire|smoke|burn|wildfire|blaze)/i },
  { type: 'medical', pattern: /(medical|injur|ambulance|hospital|patient|bleed)/i },
  { type: 'earthquake', pattern: /(earthquake|quake|tremor|seismic)/i },
  { type: 'food', pattern: /(food|hunger|ration|meal|supply)/i },
  { type: 'fuel', pattern: /(fuel|diesel|petrol|gas|generator|power)/i },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVERITY_WEIGHT = {
  low: 1,
  medium: 3,
  critical: 8,
};

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseRange = (query = {}) => {
  const range = String(query.range || '7d').toLowerCase();
  const now = new Date();
  const endDate = query.endDate ? new Date(query.endDate) : now;
  let startDate;
  let label = 'Last 7 Days';

  if (range === 'today') {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    label = 'Today';
  } else if (range === '30d') {
    startDate = new Date(now.getTime() - 29 * DAY_MS);
    label = 'Last 30 Days';
  } else if (range === 'custom') {
    const candidate = query.startDate ? new Date(query.startDate) : new Date(now.getTime() - 6 * DAY_MS);
    startDate = Number.isNaN(candidate.getTime()) ? new Date(now.getTime() - 6 * DAY_MS) : candidate;
    label = 'Custom Range';
  } else {
    startDate = new Date(now.getTime() - 6 * DAY_MS);
  }

  if (Number.isNaN(endDate.getTime())) {
    endDate.setTime(now.getTime());
  }

  if (range !== 'today' && range !== 'custom' && range !== '30d') {
    label = 'Last 7 Days';
  }

  return {
    range,
    label,
    startDate,
    endDate,
    previousStartDate: new Date(startDate.getTime() - Math.max(endDate.getTime() - startDate.getTime(), DAY_MS)),
    previousEndDate: new Date(startDate.getTime() - DAY_MS),
  };
};

const crisisSearchExpression = {
  $toLower: {
    $concat: [
      { $ifNull: ['$crisisType', ''] },
      ' ',
      { $ifNull: ['$message', ''] },
      ' ',
      { $ifNull: ['$location.label', ''] },
      ' ',
      { $ifNull: ['$region', ''] },
    ],
  },
};

const buildCrisisTypeExpression = () => {
  const searchable = crisisSearchExpression;
  const branches = CRISIS_RULES.map(({ type, pattern }) => ({
    case: { $regexMatch: { input: searchable, regex: pattern } },
    then: type,
  }));

  return {
    $switch: {
      branches,
      default: {
        $let: {
          vars: { existing: { $toLower: { $ifNull: ['$crisisType', ''] } } },
          in: {
            $cond: [
              { $gt: [{ $strLenCP: '$$existing' }, 0] },
              '$$existing',
              'other',
            ],
          },
        },
      },
    },
  };
};

const buildSeverityExpression = () => ({
  $switch: {
    branches: [
      { case: { $eq: [{ $toLower: { $ifNull: ['$severity', ''] } }, 'low'] }, then: 'low' },
      { case: { $eq: [{ $toLower: { $ifNull: ['$severity', ''] } }, 'medium'] }, then: 'medium' },
      {
        case: {
          $in: [
            { $toLower: { $ifNull: ['$severity', ''] } },
            ['high', 'critical'],
          ],
        },
        then: 'critical',
      },
    ],
    default: 'medium',
  },
});

const buildIncidentPipeline = (startDate, endDate, filters = {}) => {
  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $addFields: {
        normalizedRegion: {
          $trim: {
            input: {
              $ifNull: ['$region', '$location.label'],
            },
          },
        },
        normalizedCrisisType: buildCrisisTypeExpression(),
        normalizedSeverity: buildSeverityExpression(),
        responseMinutes: {
          $divide: [
            {
              $subtract: [
                { $ifNull: ['$resolvedAt', '$$NOW'] },
                '$createdAt',
              ],
            },
            60000,
          ],
        },
        hourOfDay: { $hour: '$createdAt' },
      },
    },
  ];

  const matchConditions = [];
  if (filters.region) {
    matchConditions.push({
      normalizedRegion: { $regex: escapeRegex(filters.region), $options: 'i' },
    });
  }
  if (filters.crisisType) {
    matchConditions.push({
      normalizedCrisisType: { $regex: `^${escapeRegex(filters.crisisType.toLowerCase())}$`, $options: 'i' },
    });
  }

  if (matchConditions.length > 0) {
    pipeline.push({ $match: { $and: matchConditions } });
  }

  pipeline.push({
    $project: {
      createdAt: 1,
      updatedAt: 1,
      resolvedAt: 1,
      status: 1,
      severity: 1,
      normalizedRegion: 1,
      normalizedCrisisType: 1,
      normalizedSeverity: 1,
      responseMinutes: 1,
      hourOfDay: 1,
      location: 1,
      assignedTeam: 1,
      message: 1,
    },
  });

  pipeline.push({ $sort: { createdAt: 1 } });
  return pipeline;
};

const getEnrichedIncidents = async (startDate, endDate, filters = {}) => {
  return SOS.aggregate(buildIncidentPipeline(startDate, endDate, filters));
};

const getEnrichedResources = async (filters = {}) => {
  const pipeline = [
    {
      $project: {
        type: 1,
        name: 1,
        quantity: 1,
        unit: 1,
        status: 1,
        priority: 1,
        location: 1,
        deploymentTarget: 1,
        isDeployed: 1,
        lastUpdated: 1,
        createdAt: 1,
        allocations: 1,
      },
    },
  ];

  const resources = await Resource.aggregate(pipeline);

  if (filters.region) {
    const region = String(filters.region).toLowerCase();
    return resources.filter((resource) => {
      const haystack = [
        resource.location,
        resource.deploymentTarget,
        ...(resource.allocations || []).map((allocation) => allocation.target),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(region);
    });
  }

  return resources;
};

const sumBy = (items, selector) => items.reduce((total, item) => total + Number(selector(item) || 0), 0);

const avgBy = (items, selector) => {
  if (!items.length) return 0;
  return sumBy(items, selector) / items.length;
};

const percentChange = (current, previous) => {
  if (!previous && !current) return 0;
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const buildResolutionStageCounts = (incidents) => {
  const received = incidents.length;
  const assigned = incidents.filter((item) => item.status !== 'pending').length;
  const enRoute = incidents.filter((item) => ['in_progress', 'resolved'].includes(item.status)).length;
  const resolved = incidents.filter((item) => item.status === 'resolved').length;

  return [
    { name: 'Received', value: received },
    { name: 'Assigned', value: assigned },
    { name: 'En Route', value: enRoute },
    { name: 'Resolved', value: resolved },
  ];
};

const buildTrendSeries = (incidents, startDate, endDate) => {
  const bucket = new Map();

  incidents.forEach((incident) => {
    const key = new Date(incident.createdAt).toISOString().slice(0, 10);
    const current = bucket.get(key) || {
      total: 0,
      resolved: 0,
      critical: 0,
      avgResponseMinutes: 0,
      responseSamples: 0,
    };

    current.total += 1;
    if (incident.status === 'resolved') {
      current.resolved += 1;
    }
    if (incident.normalizedSeverity === 'critical') {
      current.critical += 1;
    }
    current.avgResponseMinutes += Number(incident.responseMinutes || 0);
    current.responseSamples += 1;
    bucket.set(key, current);
  });

  const rows = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const finalDate = new Date(endDate);
  finalDate.setHours(0, 0, 0, 0);

  while (cursor <= finalDate) {
    const key = cursor.toISOString().slice(0, 10);
    const row = bucket.get(key) || {
      total: 0,
      resolved: 0,
      critical: 0,
      avgResponseMinutes: 0,
      responseSamples: 0,
    };

    rows.push({
      name: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateKey: key,
      total: row.total,
      resolved: row.resolved,
      critical: row.critical,
      avgResponseMinutes: row.responseSamples ? Number((row.avgResponseMinutes / row.responseSamples).toFixed(1)) : 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
};

const buildResponseGroups = (incidents, groupBy = 'region') => {
  const groupKey = groupBy === 'crisisType' ? 'normalizedCrisisType' : 'normalizedRegion';
  const grouped = new Map();

  incidents.forEach((incident) => {
    const key = String(incident[groupKey] || 'Unknown').trim() || 'Unknown';
    const current = grouped.get(key) || {
      name: key,
      totalMinutes: 0,
      incidents: 0,
      resolved: 0,
      critical: 0,
    };

    current.totalMinutes += Number(incident.responseMinutes || 0);
    current.incidents += 1;
    if (incident.status === 'resolved') {
      current.resolved += 1;
    }
    if (incident.normalizedSeverity === 'critical') {
      current.critical += 1;
    }
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      name: entry.name,
      avgMinutes: entry.incidents ? Number((entry.totalMinutes / entry.incidents).toFixed(1)) : 0,
      incidents: entry.incidents,
      resolvedRate: entry.incidents ? Number(((entry.resolved / entry.incidents) * 100).toFixed(1)) : 0,
      criticalCount: entry.critical,
    }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes);
};

const buildSeverityDistribution = (incidents) => {
  const counts = incidents.reduce(
    (acc, incident) => {
      const bucket = incident.normalizedSeverity || 'medium';
      if (acc[bucket] !== undefined) {
        acc[bucket] += 1;
      }
      return acc;
    },
    { low: 0, medium: 0, critical: 0 }
  );

  return SEVERITY_BUCKETS.map((bucket) => ({
    name: bucket.charAt(0).toUpperCase() + bucket.slice(1),
    value: counts[bucket],
  }));
};

const buildResourceUsage = (resources) => {
  const grouped = new Map();

  resources.forEach((resource) => {
    const current = grouped.get(resource.type) || {
      name: resource.type,
      allocated: 0,
      deployed: 0,
      stock: 0,
    };

    const allocationsTotal = sumBy(resource.allocations || [], (allocation) => allocation.quantity);
    current.allocated += allocationsTotal;
    current.deployed += resource.isDeployed ? Number(resource.quantity || 0) : 0;
    current.stock += Number(resource.quantity || 0);
    grouped.set(resource.type, current);
  });

  return RESOURCE_TYPES.map((type) => {
    const entry = grouped.get(type) || { name: type, allocated: 0, deployed: 0, stock: 0 };
    const value =
      entry.allocated > 0
        ? entry.allocated
        : entry.deployed > 0
          ? entry.deployed
          : entry.stock;
    return {
      name: type,
      value,
      allocated: entry.allocated,
      deployed: entry.deployed,
      stock: entry.stock,
    };
  }).filter((item) => item.value > 0 || item.stock > 0);
};

const buildGeoIntelligence = (incidents) => {
  const grouped = new Map();

  incidents.forEach((incident) => {
    const region = String(incident.normalizedRegion || 'Unknown').trim() || 'Unknown';
    const coords = Array.isArray(incident.location?.coordinates) ? incident.location.coordinates : [];
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    const current = grouped.get(region) || {
      name: region,
      count: 0,
      critical: 0,
      totalResponseMinutes: 0,
      responseSamples: 0,
      latTotal: 0,
      lngTotal: 0,
      coordinateSamples: 0,
      crisisTypeCounts: {},
    };

    current.count += 1;
    current.totalResponseMinutes += Number(incident.responseMinutes || 0);
    current.responseSamples += 1;
    if (incident.normalizedSeverity === 'critical') {
      current.critical += 1;
    }
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      current.latTotal += latitude;
      current.lngTotal += longitude;
      current.coordinateSamples += 1;
    }

    const crisis = String(incident.normalizedCrisisType || 'other');
    current.crisisTypeCounts[crisis] = (current.crisisTypeCounts[crisis] || 0) + 1;
    grouped.set(region, current);
  });

  const clusters = Array.from(grouped.values()).map((entry) => {
    const dominantCrisisType = Object.entries(entry.crisisTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
    return {
      name: entry.name,
      incidents: entry.count,
      critical: entry.critical,
      avgResponseMinutes: entry.responseSamples
        ? Number((entry.totalResponseMinutes / entry.responseSamples).toFixed(1))
        : 0,
      dominantCrisisType,
      position: entry.coordinateSamples
        ? [Number((entry.latTotal / entry.coordinateSamples).toFixed(4)), Number((entry.lngTotal / entry.coordinateSamples).toFixed(4))]
        : [0, 0],
    };
  });

  const frequentIncidents = [...clusters]
    .sort((a, b) => b.incidents - a.incidents)
    .slice(0, 5);
  const delayedZones = [...clusters]
    .filter((item) => item.avgResponseMinutes >= 30)
    .sort((a, b) => b.avgResponseMinutes - a.avgResponseMinutes)
    .slice(0, 5);
  const affectedClusters = [...clusters]
    .sort((a, b) => b.critical - a.critical || b.incidents - a.incidents)
    .slice(0, 5);

  return {
    clusters,
    frequentIncidents,
    delayedZones,
    affectedClusters,
  };
};

const buildInsights = (currentIncidents, previousIncidents, resources, geoIntelligence) => {
  const insights = [];
  const currentByRegion = new Map();
  const previousByRegion = new Map();
  const currentByType = new Map();
  const previousByType = new Map();
  const medicalHourBuckets = new Map();

  currentIncidents.forEach((incident) => {
    const region = String(incident.normalizedRegion || 'Unknown').trim() || 'Unknown';
    const crisisType = String(incident.normalizedCrisisType || 'other').trim() || 'other';

    currentByRegion.set(region, (currentByRegion.get(region) || 0) + 1);
    currentByType.set(crisisType, (currentByType.get(crisisType) || 0) + 1);
    if (crisisType === 'medical') {
      medicalHourBuckets.set(incident.hourOfDay, (medicalHourBuckets.get(incident.hourOfDay) || 0) + 1);
    }
  });

  previousIncidents.forEach((incident) => {
    const region = String(incident.normalizedRegion || 'Unknown').trim() || 'Unknown';
    const crisisType = String(incident.normalizedCrisisType || 'other').trim() || 'other';

    previousByRegion.set(region, (previousByRegion.get(region) || 0) + 1);
    previousByType.set(crisisType, (previousByType.get(crisisType) || 0) + 1);
  });

  const regionGainers = Array.from(currentByRegion.entries()).map(([region, count]) => {
    const previousCount = previousByRegion.get(region) || 0;
    return {
      region,
      count,
      previousCount,
      delta: previousCount ? ((count - previousCount) / previousCount) * 100 : count > 0 ? 100 : 0,
    };
  }).sort((a, b) => b.delta - a.delta);

  if (regionGainers[0] && regionGainers[0].count > 1 && regionGainers[0].delta > 0) {
    const type = Array.from(currentByType.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'incident';
    insights.push({
      tone: 'critical',
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} reports spiking`,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} reports increased ${Math.round(regionGainers[0].delta)}% in ${regionGainers[0].region}.`,
    });
  }

  const currentAvgResponse = avgBy(currentIncidents, (incident) => incident.responseMinutes);
  const previousAvgResponse = avgBy(previousIncidents, (incident) => incident.responseMinutes);
  if (currentIncidents.length && previousIncidents.length) {
    const responseDelta = previousAvgResponse ? ((previousAvgResponse - currentAvgResponse) / previousAvgResponse) * 100 : 0;
    if (responseDelta !== 0) {
      insights.push({
        tone: responseDelta > 0 ? 'success' : 'warning',
        title: responseDelta > 0 ? 'Response improvement detected' : 'Response time drift',
        message: `Avg response ${responseDelta > 0 ? 'improved' : 'slipped'} ${Math.abs(Math.round(responseDelta))}% versus the previous window.`,
      });
    }
  }

  const waterRisk = resources
    .filter((resource) => resource.type === 'Water')
    .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))[0];
  if (waterRisk && Number(waterRisk.quantity || 0) <= 250) {
    insights.push({
      tone: 'warning',
      title: 'Water reserves are tightening',
      message: `Water shortage likely in ${waterRisk.location || 'a deployed zone'} based on current inventory pressure.`,
    });
  }

  const medicalPeak = Array.from(medicalHourBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .find(([hour]) => hour >= 18 && hour <= 21);
  if (medicalPeak) {
    insights.push({
      tone: 'info',
      title: 'Medical demand peak window',
      message: `Medical requests are highest between ${formatHourWindow(medicalPeak[0])}.`,
    });
  }

  if (!medicalPeak && currentByType.get('medical')) {
    const fallbackMedicalPeak = Array.from(medicalHourBuckets.entries()).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      tone: 'info',
      title: 'Medical demand remains elevated',
      message: fallbackMedicalPeak
        ? `Medical requests are clustering around ${formatHourWindow(fallbackMedicalPeak[0])}.`
        : 'Medical requests are contributing a large share of the current incident load.',
    });
  }

  if (geoIntelligence.delayedZones[0]) {
    insights.push({
      tone: 'warning',
      title: 'Delayed zone flagged',
      message: `${geoIntelligence.delayedZones[0].name} is averaging ${geoIntelligence.delayedZones[0].avgResponseMinutes} minutes response time.`,
    });
  }

  return insights.slice(0, 5);
};

const formatHourWindow = (hour) => {
  const start = hour % 12 === 0 ? 12 : hour % 12;
  const endHour = (hour + 3) % 24;
  const end = endHour % 12 === 0 ? 12 : endHour % 12;
  const startSuffix = hour < 12 ? 'AM' : 'PM';
  const endSuffix = endHour < 12 ? 'AM' : 'PM';
  return `${start}${startSuffix} - ${end}${endSuffix}`;
};

const getCurrentSnapshot = async (query = {}) => {
  const range = parseRange(query);
  const filter = {
    region: query.region,
    crisisType: query.crisisType,
  };

  const [currentIncidents, previousIncidents, resources, activeTeams, activeAlerts] =
    await Promise.all([
      getEnrichedIncidents(range.startDate, range.endDate, filter),
      getEnrichedIncidents(range.previousStartDate, range.previousEndDate, filter),
      getEnrichedResources(filter),
      User.countDocuments({ role: 'rescue_team' }),
      Alert.countDocuments({ isActive: true }),
    ]);

  const totalIncidents = currentIncidents.length;
  const resolvedIncidents = currentIncidents.filter((incident) => incident.status === 'resolved').length;
  const activeEmergencies = currentIncidents.filter((incident) => incident.status !== 'resolved').length;
  const avgResponseTime = totalIncidents
    ? Number(avgBy(currentIncidents, (incident) => incident.responseMinutes).toFixed(1))
    : 0;
  const resolutionRate = totalIncidents ? Number(((resolvedIncidents / totalIncidents) * 100).toFixed(1)) : 0;
  const livesAssisted = currentIncidents.reduce((total, incident) => {
    if (incident.status !== 'resolved') {
      return total;
    }
    return total + (SEVERITY_WEIGHT[incident.normalizedSeverity] || 2);
  }, 0);

  const deployedResources = resources.filter((resource) => resource.isDeployed || resource.deploymentTarget || (resource.allocations || []).length > 0).length;
  const previousTotal = previousIncidents.length;
  const previousResolved = previousIncidents.filter((incident) => incident.status === 'resolved').length;
  const previousActive = previousIncidents.filter((incident) => incident.status !== 'resolved').length;
  const previousAvgResponse = previousTotal
    ? Number(avgBy(previousIncidents, (incident) => incident.responseMinutes).toFixed(1))
    : 0;
  const previousResolutionRate = previousTotal ? Number(((previousResolved / previousTotal) * 100).toFixed(1)) : 0;
  const previousLivesAssisted = previousIncidents.reduce((total, incident) => {
    if (incident.status !== 'resolved') {
      return total;
    }
    return total + (SEVERITY_WEIGHT[incident.normalizedSeverity] || 2);
  }, 0);
  const previousResourcesDeployed = resources.filter((resource) => resource.isDeployed || resource.deploymentTarget || (resource.allocations || []).length > 0).length;

  const geoIntelligence = buildGeoIntelligence(currentIncidents);

  return {
    range,
    currentIncidents,
    previousIncidents,
    resources,
    metrics: {
      totalIncidents,
      activeEmergencies,
      avgResponseTime,
      resolutionRate,
      livesAssisted,
      resourcesDeployed: deployedResources,
    },
    previousMetrics: {
      totalIncidents: previousTotal,
      activeEmergencies: previousActive,
      avgResponseTime: previousAvgResponse,
      resolutionRate: previousResolutionRate,
      livesAssisted: previousLivesAssisted,
      resourcesDeployed: previousResourcesDeployed,
    },
    context: {
      activeTeams,
      activeAlerts,
      trackedRegions: new Set(currentIncidents.map((incident) => incident.normalizedRegion).filter(Boolean)).size,
      trackedCrisisTypes: new Set(currentIncidents.map((incident) => incident.normalizedCrisisType).filter(Boolean)).size,
    },
    geoIntelligence,
  };
};

const getOverview = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const { metrics, previousMetrics, context, geoIntelligence, range } = snapshot;

    res.json({
      period: {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      metrics,
      deltas: {
        totalIncidents: Number(percentChange(metrics.totalIncidents, previousMetrics.totalIncidents).toFixed(1)),
        activeEmergencies: Number(percentChange(metrics.activeEmergencies, previousMetrics.activeEmergencies).toFixed(1)),
        avgResponseTime: Number(percentChange(previousMetrics.avgResponseTime, metrics.avgResponseTime).toFixed(1)),
        resolutionRate: Number((metrics.resolutionRate - previousMetrics.resolutionRate).toFixed(1)),
        livesAssisted: Number(percentChange(metrics.livesAssisted, previousMetrics.livesAssisted).toFixed(1)),
        resourcesDeployed: Number(percentChange(metrics.resourcesDeployed, previousMetrics.resourcesDeployed).toFixed(1)),
      },
      context,
      geoIntelligence,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getIncidentsTrend = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const { range, currentIncidents } = snapshot;
    const trend = buildTrendSeries(currentIncidents, range.startDate, range.endDate);

    res.json(trend);
  } catch (error) {
    console.error('Analytics trend error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getResponseTimes = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const groupBy = String(req.query.groupBy || 'region').toLowerCase() === 'crisistype' ? 'crisisType' : 'region';
    const response = buildResponseGroups(snapshot.currentIncidents, groupBy);
    res.json(response);
  } catch (error) {
    console.error('Analytics response times error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getResourcesUsage = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const usage = buildResourceUsage(snapshot.resources);
    res.json(usage);
  } catch (error) {
    console.error('Analytics resource usage error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSeverityDistribution = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const severity = buildSeverityDistribution(snapshot.currentIncidents);
    res.json(severity);
  } catch (error) {
    console.error('Analytics severity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getInsights = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const { currentIncidents, previousIncidents, resources, geoIntelligence, range } = snapshot;
    const insights = buildInsights(currentIncidents, previousIncidents, resources, geoIntelligence);

    res.json({
      generatedAt: new Date().toISOString(),
      period: {
        label: range.label,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      insights,
      geoIntelligence,
    });
  } catch (error) {
    console.error('Analytics insights error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSummary = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const { metrics, context, geoIntelligence, range } = snapshot;
    const resourcesByType = buildResourceUsage(snapshot.resources).map((item) => ({
      _id: item.name,
      count: item.value,
      totalQty: item.stock,
    }));

    res.json({
      totalSOS: metrics.totalIncidents,
      resolvedSOS: snapshot.currentIncidents.filter((incident) => incident.status === 'resolved').length,
      pendingSOS: snapshot.currentIncidents.filter((incident) => incident.status === 'pending').length,
      inProgressSOS: snapshot.currentIncidents.filter((incident) => incident.status === 'in_progress').length,
      activeRescueTeams: context.activeTeams,
      activeAlerts: context.activeAlerts,
      totalResources: snapshot.resources.length,
      resourcesByType,
      geoIntelligence,
      period: range.label,
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSOSByDay = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const trend = buildTrendSeries(snapshot.currentIncidents, snapshot.range.startDate, snapshot.range.endDate);

    res.json(
      trend.map((row) => ({
        name: row.name,
        saved: row.resolved,
        target: Math.max(1, Math.round(row.total * 0.6)),
        total: row.total,
      }))
    );
  } catch (error) {
    console.error('SOS by day error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSOSbySeverity = async (req, res) => {
  try {
    const snapshot = await getCurrentSnapshot(req.query);
    const severity = buildSeverityDistribution(snapshot.currentIncidents).map((entry) => ({
      name: entry.name,
      value: entry.value,
    }));

    res.json(severity);
  } catch (error) {
    console.error('SOS severity error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getOverview,
  getIncidentsTrend,
  getResponseTimes,
  getResourcesUsage,
  getSeverityDistribution,
  getInsights,
  getSummary,
  getSOSByDay,
  getSOSbySeverity,
};
