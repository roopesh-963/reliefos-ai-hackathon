const Supply = require('../models/Supply.model');
const Resource = require('../models/Resource.model');

const RESOURCE_TYPES = ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Blankets', 'Ambulance'];
const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_PROGRESS = {
  Queued: 8,
  'In Transit': 58,
  Delayed: 42,
  Rerouted: 64,
  Delivered: 100,
};
const LOCATION_COORDS = {
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resolveCoords = (label, fallback = { lat: 20.5937, lng: 78.9629 }) => {
  return LOCATION_COORDS[label] || fallback;
};

const isValidCoords = (value) =>
  Boolean(
    value &&
      typeof value.lat === 'number' &&
      Number.isFinite(value.lat) &&
      typeof value.lng === 'number' &&
      Number.isFinite(value.lng)
  );

const ensureCoords = (value, fallbackLabel, fallback) => {
  if (isValidCoords(value)) {
    return value;
  }
  if (fallbackLabel) {
    return resolveCoords(fallbackLabel, fallback);
  }
  return fallback;
};

const formatEta = (etaMinutes) => {
  if (etaMinutes <= 0) {
    return 'Arrived';
  }
  if (etaMinutes < 60) {
    return `${Math.round(etaMinutes)} min`;
  }
  const hours = Math.floor(etaMinutes / 60);
  const mins = Math.round(etaMinutes % 60);
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

const interpolatePoint = (from, to, progress) => {
  const safeFrom = ensureCoords(from, undefined, { lat: 20.5937, lng: 78.9629 });
  const safeTo = ensureCoords(to, undefined, safeFrom);

  return {
    lat: Number((safeFrom.lat + (safeTo.lat - safeFrom.lat) * progress).toFixed(5)),
    lng: Number((safeFrom.lng + (safeTo.lng - safeFrom.lng) * progress).toFixed(5)),
  };
};

const buildRoutePath = (shipment) => {
  const from = ensureCoords(shipment.fromCoords, shipment.from, { lat: 20.5937, lng: 78.9629 });
  const to = ensureCoords(shipment.toCoords, shipment.to, { lat: 24.8607, lng: 67.0011 });

  if (shipment.status === 'Rerouted' || shipment.routeState === 'Blocked') {
    const latOffset = from.lat <= to.lat ? 1.15 : -1.15;
    const lngOffset = from.lng <= to.lng ? 1.75 : -1.75;
    return [
      [from.lat, from.lng],
      [Number(((from.lat + to.lat) / 2 + latOffset).toFixed(5)), Number(((from.lng + to.lng) / 2 + lngOffset).toFixed(5))],
      [to.lat, to.lng],
    ];
  }

  return [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
};

const shipmentToClient = (shipmentDoc) => {
  const shipment = typeof shipmentDoc.toObject === 'function' ? shipmentDoc.toObject() : shipmentDoc;
  const fromLabel = shipment.from || shipment.warehouse || 'Central Hub';
  const toLabel = shipment.to || shipment.destination || 'Relief Zone';
  const fromCoords = ensureCoords(shipment.fromCoords, fromLabel, { lat: 20.5937, lng: 78.9629 });
  const toCoords = ensureCoords(shipment.toCoords, toLabel, { lat: 24.8607, lng: 67.0011 });
  const normalizedStatus =
    shipment.status === 'En-route'
      ? 'In Transit'
      : shipment.status === 'Idle' || shipment.status === 'Loading'
        ? 'Queued'
        : shipment.status === 'Cancelled'
          ? 'Delayed'
          : shipment.status || 'Queued';
  const etaMinutes =
    typeof shipment.etaMinutes === 'number'
      ? shipment.etaMinutes
      : (() => {
          const etaText = String(shipment.eta || '').trim().toLowerCase();
          if (!etaText || etaText === '-') {
            return normalizedStatus === 'Delivered' ? 0 : 90;
          }
          if (etaText.endsWith('min')) {
            return Number.parseInt(etaText, 10) || 0;
          }
          if (etaText.endsWith('h')) {
            return Math.round((Number.parseFloat(etaText) || 0) * 60);
          }
          return Number.parseInt(etaText, 10) || 90;
        })();
  const progress =
    normalizedStatus === 'Delivered'
      ? 1
      : typeof shipment.progress === 'number'
        ? clamp(shipment.progress / 100, 0.08, 0.95)
        : clamp(1 - etaMinutes / Math.max(etaMinutes + 90, 1), 0.08, 0.9);

  return {
    _id: String(shipment._id),
    shipmentId: shipment.shipmentId || shipment.trackingId || `SC-${String(shipment._id).slice(-3)}`,
    resourceType: shipment.resourceType || shipment.cargoType || 'Equipment',
    quantity: shipment.quantity,
    unit: shipment.unit || 'units',
    from: fromLabel,
    to: toLabel,
    vehicle: shipment.vehicle || shipment.assignedTruck || 'Field Vehicle',
    driver: shipment.driver || `${shipment.assignedTruck || 'Ops'} Driver`,
    status: normalizedStatus,
    etaMinutes,
    etaLabel: formatEta(etaMinutes),
    priority: shipment.priority || 'Medium',
    routeState: shipment.routeState || (normalizedStatus === 'Delayed' ? 'Blocked' : 'Clear'),
    blockedReason: shipment.blockedReason || '',
    destinationType: shipment.destinationType || 'Zone',
    progress: normalizedStatus === 'Delivered' ? 100 : Math.round(progress * 100),
    fromCoords,
    toCoords,
    currentCoords:
      normalizedStatus === 'Delivered'
        ? toCoords
        : ensureCoords(shipment.currentCoords, undefined, interpolatePoint(fromCoords, toCoords, progress)),
    routePath: buildRoutePath({
      ...shipment,
      status: normalizedStatus,
      fromCoords,
      toCoords,
      routeState: shipment.routeState || (normalizedStatus === 'Delayed' ? 'Blocked' : 'Clear'),
    }),
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    deliveredAt: shipment.deliveredAt,
    notes: shipment.notes,
  };
};

const toWarehouseKey = (name) => name.trim().toLowerCase();

const collectWarehouseStock = (resources) => {
  const warehouses = new Map();

  resources.forEach((resourceDoc) => {
    const resource = typeof resourceDoc.toObject === 'function' ? resourceDoc.toObject() : resourceDoc;
    const name = resource.location || 'Central Hub';
    const key = toWarehouseKey(name);
    const existing = warehouses.get(key) || {
      id: `wh-${key.replace(/[^a-z0-9]+/g, '-')}`,
      name,
      location: resolveCoords(name),
      stockLevels: { Water: 0, Food: 0, Medicine: 0, Fuel: 0, Blankets: 0 },
      capacity: 1200,
      usedCapacity: 0,
      lowStockWarnings: [],
      lastUpdated: resource.updatedAt || resource.lastUpdated || new Date(),
    };

    existing.usedCapacity += Number(resource.quantity || 0);
    const normalizedType = resource.type === 'Equipment' ? 'Blankets' : resource.type;
    if (Object.prototype.hasOwnProperty.call(existing.stockLevels, normalizedType)) {
      existing.stockLevels[normalizedType] += Number(resource.quantity || 0);
    }

    const updatedAt = new Date(resource.updatedAt || resource.lastUpdated || Date.now());
    if (updatedAt > new Date(existing.lastUpdated)) {
      existing.lastUpdated = updatedAt.toISOString();
    }

    warehouses.set(key, existing);
  });

  return Array.from(warehouses.values())
    .map((warehouse) => {
      const fillPercent = clamp(Math.round((warehouse.usedCapacity / warehouse.capacity) * 100), 0, 100);
      const lowStockWarnings = Object.entries(warehouse.stockLevels)
        .filter(([, value]) => Number(value) <= 120)
        .map(([type, value]) => `${type} at ${value} units`);

      return {
        ...warehouse,
        fillPercent,
        lowStockWarnings,
      };
    })
    .sort((a, b) => b.usedCapacity - a.usedCapacity);
};

const consumeInventory = async ({ resourceType, quantity, from, target, shipmentId, userId }) => {
  const resources = await Resource.find({ location: from, type: resourceType }).sort({ quantity: -1, updatedAt: 1 });
  const totalAvailable = resources.reduce((sum, resource) => sum + Number(resource.quantity || 0), 0);

  if (totalAvailable < quantity) {
    return { error: `Insufficient ${resourceType} stock at ${from}. Available ${totalAvailable}, requested ${quantity}.` };
  }

  let remaining = quantity;
  const updatedResources = [];
  const sourceResourceIds = [];

  for (const resource of resources) {
    if (remaining <= 0) {
      break;
    }

    const consumed = Math.min(Number(resource.quantity || 0), remaining);
    if (consumed <= 0) {
      continue;
    }

    resource.quantity -= consumed;
    resource.isDeployed = true;
    resource.deploymentTarget = target;
    resource.status = resource.quantity <= 20 ? 'Critical' : resource.quantity <= 100 ? 'Low' : 'Healthy';
    resource.lastUpdated = new Date();
    resource.lastChecked = new Date();
    resource.allocations.push({
      target,
      quantity: consumed,
      notes: `Shipment ${shipmentId} dispatched`,
      allocatedBy: userId || null,
      allocatedAt: new Date(),
    });

    await resource.save();
    updatedResources.push(resource);
    sourceResourceIds.push(resource._id);
    remaining -= consumed;
  }

  return { updatedResources, sourceResourceIds };
};

const buildOptimizationInsights = (shipments, warehouses) => {
  const insights = [];
  const delayed = shipments.filter((shipment) => shipment.status === 'Delayed' || shipment.routeState === 'Blocked');
  const criticalRoute = delayed[0];
  if (criticalRoute) {
    insights.push({
      id: `insight-${criticalRoute.shipmentId}-route`,
      title: `Reroute truck ${criticalRoute.shipmentId} due to blocked road`,
      message: criticalRoute.blockedReason || `${criticalRoute.to} is experiencing route friction. Shift convoy via alternate corridor.`,
      tone: 'critical',
    });
  }

  const medicineLow = warehouses.find((warehouse) => warehouse.stockLevels.Medicine <= 120);
  if (medicineLow) {
    insights.push({
      id: `insight-${medicineLow.id}-medicine`,
      title: `${medicineLow.name} medicine below threshold`,
      message: `Only ${medicineLow.stockLevels.Medicine} medicine units remain. Prioritize inbound replenishment.`,
      tone: 'warning',
    });
  }

  const zoneCShipment = shipments.find((shipment) => shipment.to.toLowerCase().includes('zone c'));
  if (zoneCShipment) {
    const nearestWarehouse = warehouses[0];
    if (nearestWarehouse) {
      insights.push({
        id: `insight-${zoneCShipment.shipmentId}-nearest`,
        title: `Use nearest warehouse for ${zoneCShipment.to}`,
        message: `${nearestWarehouse.name} is carrying the strongest reserve profile for ${zoneCShipment.resourceType}.`,
        tone: 'info',
      });
    }
  }

  const fuelDemand = shipments
    .filter((shipment) => shipment.resourceType === 'Fuel' && shipment.status !== 'Delivered')
    .reduce((sum, shipment) => sum + shipment.quantity, 0);
  if (fuelDemand > 180) {
    insights.push({
      id: 'insight-fuel-demand',
      title: 'Fuel demand spike expected in 3 hrs',
      message: `Open fuel commitments are at ${fuelDemand} units. Pre-stage reserves before peak dispatch.`,
      tone: 'warning',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'insight-balance',
      title: 'Network balanced',
      message: 'No critical route or stock pressure detected. Maintain live monitoring cadence.',
      tone: 'info',
    });
  }

  return insights.slice(0, 4);
};

const loadShipments = async () => {
  const shipments = await Supply.find().sort({ createdAt: -1 });
  return shipments.map(shipmentToClient);
};

const getShipments = async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (priority) {
      filter.priority = priority;
    }

    const base = await Supply.find(filter).sort({ createdAt: -1 });
    let shipments = base.map(shipmentToClient);

    if (search) {
      const term = String(search).trim().toLowerCase();
      shipments = shipments.filter((shipment) =>
        [
          shipment.shipmentId,
          shipment.resourceType,
          shipment.from,
          shipment.to,
          shipment.vehicle,
          shipment.driver,
          shipment.status,
        ].some((value) => String(value).toLowerCase().includes(term))
      );
    }

    res.json(shipments);
  } catch (error) {
    console.error('Get shipments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getWarehouses = async (_req, res) => {
  try {
    const resources = await Resource.find().sort({ updatedAt: -1 });
    res.json(collectWarehouseStock(resources));
  } catch (error) {
    console.error('Get warehouses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getSupplyAnalytics = async (_req, res) => {
  try {
    const [shipments, resources] = await Promise.all([loadShipments(), Resource.find().sort({ updatedAt: -1 })]);
    const warehouses = collectWarehouseStock(resources);

    const activeShipments = shipments.filter((shipment) => shipment.status !== 'Delivered').length;
    const deliveredToday = shipments.filter((shipment) => {
      if (!shipment.deliveredAt) {
        return false;
      }
      const delivered = new Date(shipment.deliveredAt);
      const now = new Date();
      return delivered.toDateString() === now.toDateString();
    }).length;
    const delayedDeliveries = shipments.filter((shipment) => shipment.status === 'Delayed').length;
    const avgEta = shipments.filter((shipment) => shipment.status !== 'Delivered');
    const avgEtaMinutes =
      avgEta.length > 0 ? Math.round(avgEta.reduce((sum, shipment) => sum + shipment.etaMinutes, 0) / avgEta.length) : 0;
    const criticalRoutes = shipments.filter(
      (shipment) => shipment.routeState === 'Blocked' || shipment.status === 'Delayed' || shipment.priority === 'Critical'
    ).length;
    const warehouseCapacity =
      warehouses.length > 0
        ? Math.round(warehouses.reduce((sum, warehouse) => sum + warehouse.fillPercent, 0) / warehouses.length)
        : 0;

    const byStatus = ['Queued', 'In Transit', 'Delayed', 'Rerouted', 'Delivered'].map((status) => ({
      name: status,
      value: shipments.filter((shipment) => shipment.status === status).length,
    }));

    const byPriority = ['Critical', 'High', 'Medium', 'Low'].map((priority) => ({
      name: priority,
      value: shipments.filter((shipment) => shipment.priority === priority).length,
    }));

    res.json({
      summary: {
        activeShipments,
        deliveredToday,
        delayedDeliveries,
        avgEtaMinutes,
        avgEtaLabel: formatEta(avgEtaMinutes),
        criticalRoutes,
        warehouseCapacity,
      },
      byStatus,
      byPriority,
      insights: buildOptimizationInsights(shipments, warehouses),
    });
  } catch (error) {
    console.error('Supply analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createShipment = async (req, res) => {
  try {
    const {
      resourceType,
      quantity,
      from,
      to,
      vehicle,
      driver,
      etaMinutes,
      priority,
      destinationType,
      unit,
      notes,
    } = req.body;

    const numericQuantity = Number(quantity || 0);
    const numericEtaMinutes = Number(etaMinutes || 0);
    if (!RESOURCE_TYPES.includes(resourceType) || numericQuantity <= 0 || numericEtaMinutes < 0 || !from || !to || !vehicle) {
      return res.status(400).json({ message: 'resourceType, quantity, from, to, vehicle, and etaMinutes are required' });
    }

    const provisionalShipment = new Supply({
      resourceType,
      quantity: numericQuantity,
      unit: unit || 'units',
      from,
      fromCoords: resolveCoords(from),
      to,
      toCoords: resolveCoords(to, { lat: 24.8607, lng: 67.0011 }),
      vehicle,
      driver: driver || `${vehicle} Driver`,
      status: 'In Transit',
      etaMinutes: numericEtaMinutes,
      priority: priority || 'High',
      routeState: numericEtaMinutes > 180 ? 'Watch' : 'Clear',
      destinationType: destinationType || 'Zone',
      notes: notes || '',
      createdBy: req.user?._id || null,
    });

    if (!provisionalShipment.shipmentId) {
      provisionalShipment.shipmentId = `SC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    }
    if (!provisionalShipment.trackingId) {
      provisionalShipment.trackingId = provisionalShipment.shipmentId;
    }

    const stockResult = await consumeInventory({
      resourceType,
      quantity: numericQuantity,
      from,
      target: to,
      shipmentId: provisionalShipment.shipmentId,
      userId: req.user?._id || null,
    });

    if (stockResult.error) {
      return res.status(400).json({ message: stockResult.error });
    }

    provisionalShipment.sourceResourceIds = stockResult.sourceResourceIds;
    await provisionalShipment.save();

    const shipment = shipmentToClient(provisionalShipment);
    req.io.to('dashboard').emit('shipment_created', shipment);
    req.io.to('dashboard').emit('new_deployment', shipment);
    stockResult.updatedResources.forEach((resource) => {
      req.io.to('dashboard').emit('resource_updated', resource);
    });

    const [warehouses, analytics] = await Promise.all([
      collectWarehouseStock(await Resource.find().sort({ updatedAt: -1 })),
      (async () => {
        const shipments = await loadShipments();
        const resources = await Resource.find().sort({ updatedAt: -1 });
        return {
          summary: {
            activeShipments: shipments.filter((item) => item.status !== 'Delivered').length,
            deliveredToday: shipments.filter((item) => item.deliveredAt).length,
            delayedDeliveries: shipments.filter((item) => item.status === 'Delayed').length,
            avgEtaMinutes:
              shipments.filter((item) => item.status !== 'Delivered').reduce((sum, item) => sum + item.etaMinutes, 0) /
                Math.max(shipments.filter((item) => item.status !== 'Delivered').length, 1) || 0,
            avgEtaLabel: '',
            criticalRoutes: shipments.filter((item) => item.routeState === 'Blocked' || item.status === 'Delayed').length,
            warehouseCapacity:
              collectWarehouseStock(resources).reduce((sum, warehouse) => sum + warehouse.fillPercent, 0) /
                Math.max(collectWarehouseStock(resources).length, 1) || 0,
          },
        };
      })(),
    ]);
    req.io.to('dashboard').emit('warehouse_updated', warehouses);
    req.io.to('dashboard').emit('shipment_analytics_updated', analytics);

    res.status(201).json({ message: 'Shipment created', shipment });
  } catch (error) {
    console.error('Create shipment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateShipment = async (req, res) => {
  try {
    const updates = { ...req.body };
    const existing = await Supply.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    if (typeof updates.etaMinutes !== 'undefined') {
      updates.etaMinutes = Number(updates.etaMinutes);
    }
    if (updates.status === 'Delivered') {
      updates.deliveredAt = new Date();
      updates.etaMinutes = 0;
      updates.currentCoords = existing.toCoords;
    }
    if (updates.status === 'Delayed' && !updates.routeState) {
      updates.routeState = 'Blocked';
    }
    if (updates.status === 'Rerouted' && !updates.routeState) {
      updates.routeState = 'Watch';
    }

    const shipmentDoc = await Supply.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    const shipment = shipmentToClient(shipmentDoc);
    req.io.to('dashboard').emit('shipment_updated', shipment);
    req.io.to('dashboard').emit('deployment_updated', shipment);

    res.json({ message: 'Shipment updated', shipment });
  } catch (error) {
    console.error('Update shipment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteShipment = async (req, res) => {
  try {
    const shipment = await Supply.findByIdAndDelete(req.params.id);
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    req.io.to('dashboard').emit('shipment_deleted', {
      id: String(shipment._id),
      shipmentId: shipment.shipmentId,
    });

    res.json({ message: 'Shipment removed' });
  } catch (error) {
    console.error('Delete shipment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const rerouteShipment = async (req, res) => {
  try {
    const { shipmentId, reason, etaAdjustmentMinutes } = req.body;
    if (!shipmentId) {
      return res.status(400).json({ message: 'shipmentId is required' });
    }

    const shipmentDoc = await Supply.findById(shipmentId);
    if (!shipmentDoc) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    shipmentDoc.status = 'Rerouted';
    shipmentDoc.routeState = 'Blocked';
    shipmentDoc.blockedReason = reason || 'Blocked corridor detected';
    shipmentDoc.etaMinutes = Number(shipmentDoc.etaMinutes || 0) + Number(etaAdjustmentMinutes || 18);
    shipmentDoc.currentCoords = interpolatePoint(
      ensureCoords(shipmentDoc.fromCoords, shipmentDoc.from, { lat: 20.5937, lng: 78.9629 }),
      ensureCoords(shipmentDoc.toCoords, shipmentDoc.to, { lat: 24.8607, lng: 67.0011 }),
      0.52
    );
    await shipmentDoc.save();

    const shipment = shipmentToClient(shipmentDoc);
    req.io.to('dashboard').emit('shipment_rerouted', shipment);
    req.io.to('dashboard').emit('shipment_updated', shipment);

    res.json({ message: 'Shipment rerouted', shipment });
  } catch (error) {
    console.error('Reroute shipment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getShipments,
  createShipment,
  updateShipment,
  deleteShipment,
  getWarehouses,
  getSupplyAnalytics,
  rerouteShipment,
};
