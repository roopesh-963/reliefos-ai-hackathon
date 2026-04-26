const Resource = require('../models/Resource.model');

const STATUS_ORDER = {
  Critical: 0,
  Low: 1,
  Healthy: 2,
};

const CATEGORY_LIST = ['Medicine', 'Food', 'Water', 'Fuel', 'Equipment', 'Ambulance'];

const deriveStatusFromQuantity = (quantity) => {
  if (quantity <= 20) {
    return 'Critical';
  }
  if (quantity <= 100) {
    return 'Low';
  }
  return 'Healthy';
};

const normalizeStatus = (resource) => {
  const quantityStatus = deriveStatusFromQuantity(Number(resource.quantity || 0));
  if (resource.priority === 'Critical' && quantityStatus === 'Low') {
    return 'Critical';
  }
  if (resource.priority === 'Critical' && quantityStatus === 'Healthy' && Number(resource.quantity || 0) <= 150) {
    return 'Low';
  }
  if (resource.priority === 'High' && quantityStatus === 'Healthy' && Number(resource.quantity || 0) <= 120) {
    return 'Low';
  }

  // Use live derived status first, but still allow a manually escalated stored status.
  if (resource.status === 'Critical' || resource.status === 'Low') {
    return resource.status;
  }
  return quantityStatus;
};

const formatResource = (resourceDoc) => {
  const resource = typeof resourceDoc.toObject === 'function' ? resourceDoc.toObject() : resourceDoc;
  const status = normalizeStatus(resource);

  return {
    ...resource,
    category: resource.type,
    status,
    lastUpdated: resource.lastUpdated || resource.updatedAt || resource.lastChecked || resource.createdAt,
  };
};

const sortByLowStock = (a, b) => {
  const statusDiff = STATUS_ORDER[normalizeStatus(a)] - STATUS_ORDER[normalizeStatus(b)];
  if (statusDiff !== 0) {
    return statusDiff;
  }
  return (a.quantity || 0) - (b.quantity || 0);
};

const buildAISuggestions = (resources, lowStock, trendRows) => {
  const suggestions = [];

  const lowWater = lowStock.find((item) => item.type === 'Water' || item.name.toLowerCase().includes('water'));
  if (lowWater) {
    suggestions.push(`Send ${Math.max(100, lowWater.quantity * 3)} ${lowWater.unit} of water to East Shelter.`);
  }

  const lowMedicine = lowStock.find((item) => item.type === 'Medicine');
  if (lowMedicine) {
    suggestions.push(`Medicine shortage predicted in 4 hrs at ${lowMedicine.location}.`);
  }

  const lowFuel = lowStock.find((item) => item.type === 'Fuel' || item.name.toLowerCase().includes('fuel') || item.name.toLowerCase().includes('diesel'));
  if (lowFuel) {
    suggestions.push(`Fuel reserve needs replenishment at ${lowFuel.location}.`);
  }

  const deployed = resources.filter((resource) => resource.isDeployed && resource.deploymentTarget);
  if (deployed.length > 0) {
    const latest = deployed[0];
    suggestions.push(`Re-route truck from Depot 2 to ${latest.deploymentTarget}.`);
  }

  if (suggestions.length < 3 && trendRows.length > 0) {
    const peak = [...trendRows].sort((a, b) => b.allocated - a.allocated)[0];
    suggestions.push(`Consumption peak detected on ${peak.name}; pre-stage inventory before next cycle.`);
  }

  if (suggestions.length < 3) {
    suggestions.push('Maintain reserve buffer of 15% for top three critical resources.');
  }

  return suggestions.slice(0, 3);
};

const getResources = async (req, res) => {
  try {
    const { type, category, priority, status, search, sortLowStock } = req.query;
    const mappedType = category || type;

    const filter = {};
    if (mappedType) {
      filter.type = mappedType;
    }
    if (priority) {
      filter.priority = priority;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const resources = await Resource.find(filter).populate('addedBy', 'name').sort({ updatedAt: -1 });
    let normalized = resources.map(formatResource);

    if (status) {
      normalized = normalized.filter((resource) => resource.status === status);
    }

    if (String(sortLowStock) === 'true') {
      normalized.sort(sortByLowStock);
    }

    res.json(normalized);
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addResource = async (req, res) => {
  try {
    const {
      type,
      category,
      name,
      quantity,
      unit,
      priority,
      status,
      location,
      deploymentTarget,
    } = req.body;

    const resolvedType = category || type;
    if (!CATEGORY_LIST.includes(resolvedType)) {
      return res.status(400).json({ message: 'Invalid category/type' });
    }

    const numericQty = Number(quantity || 0);
    const resource = await Resource.create({
      type: resolvedType,
      name,
      quantity: numericQty,
      unit: unit || 'units',
      priority: priority || 'Medium',
      status: status || deriveStatusFromQuantity(numericQty),
      location: location || 'Warehouse 01',
      deploymentTarget: deploymentTarget || null,
      isDeployed: Boolean(deploymentTarget),
      addedBy: req.user?._id || null,
      lastUpdated: new Date(),
      lastChecked: new Date(),
    });

    const payload = formatResource(resource);
    req.io.to('dashboard').emit('resource_added', payload);
    res.status(201).json({ message: 'Resource added', resource: payload });
  } catch (error) {
    console.error('Add resource error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateResource = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.category && !updates.type) {
      updates.type = updates.category;
    }
    delete updates.category;

    if (updates.type && !CATEGORY_LIST.includes(updates.type)) {
      return res.status(400).json({ message: 'Invalid category/type' });
    }

    if (typeof updates.quantity !== 'undefined' && !updates.status) {
      updates.status = deriveStatusFromQuantity(Number(updates.quantity));
    }

    updates.lastUpdated = new Date();
    updates.lastChecked = new Date();

    const resource = await Resource.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const payload = formatResource(resource);
    req.io.to('dashboard').emit('resource_updated', payload);
    res.json({ message: 'Resource updated', resource: payload });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteResource = async (req, res) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    req.io.to('dashboard').emit('resource_deleted', { id: String(resource._id), name: resource.name });
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deployResource = async (req, res) => {
  try {
    const { deploymentTarget } = req.body;

    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      {
        isDeployed: true,
        deploymentTarget,
        lastUpdated: new Date(),
        lastChecked: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const payload = formatResource(resource);
    req.io.to('dashboard').emit('resource_deployed', {
      id: payload._id,
      name: payload.name,
      deploymentTarget: payload.deploymentTarget,
    });

    res.json({ message: 'Resource deployed', resource: payload });
  } catch (error) {
    console.error('Deploy resource error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const allocateResource = async (req, res) => {
  try {
    const { resourceId, target, quantity, notes } = req.body;
    const allocationQty = Number(quantity || 0);

    if (!resourceId || !target || allocationQty <= 0) {
      return res.status(400).json({ message: 'resourceId, target, and quantity are required' });
    }

    const resource = await Resource.findById(resourceId);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    if (resource.quantity < allocationQty) {
      return res.status(400).json({ message: 'Insufficient quantity for allocation' });
    }

    resource.quantity -= allocationQty;
    resource.isDeployed = true;
    resource.deploymentTarget = target;
    resource.allocations.push({
      target,
      quantity: allocationQty,
      notes: notes || '',
      allocatedBy: req.user?._id || null,
      allocatedAt: new Date(),
    });
    resource.status = deriveStatusFromQuantity(resource.quantity);
    resource.lastUpdated = new Date();
    resource.lastChecked = new Date();
    await resource.save();

    const payload = formatResource(resource);
    const eventPayload = {
      resourceId: String(resource._id),
      name: resource.name,
      target,
      quantity: allocationQty,
      remaining: resource.quantity,
      status: payload.status,
    };

    req.io.to('dashboard').emit('resource_allocated', eventPayload);
    req.io.to('dashboard').emit('resource_updated', payload);

    res.status(201).json({
      message: 'Resource allocated',
      allocation: eventPayload,
      resource: payload,
    });
  } catch (error) {
    console.error('Allocate resource error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getResourceAnalytics = async (_req, res) => {
  try {
    const resources = await Resource.find().sort({ updatedAt: -1 });
    const normalized = resources.map(formatResource);

    const lowStock = normalized
      .filter((resource) => resource.status === 'Critical' || resource.status === 'Low')
      .sort(sortByLowStock);

    const activeDeliveries = normalized.filter(
      (resource) => resource.isDeployed || Boolean(resource.deploymentTarget)
    ).length;

    const criticalTargets = new Set();
    normalized.forEach((resource) => {
      if (resource.status === 'Critical' || resource.priority === 'Critical') {
        if (resource.deploymentTarget) {
          criticalTargets.add(resource.deploymentTarget);
        }
        (resource.allocations || []).forEach((allocation) => {
          if (allocation.target) {
            criticalTargets.add(allocation.target);
          }
        });
      }
    });

    const categoryDistribution = CATEGORY_LIST.map((category) => {
      const items = normalized.filter((resource) => resource.type === category);
      return {
        name: category,
        value: items.length,
      };
    }).filter((item) => item.value > 0);

    const trendBucket = {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);

    normalized.forEach((resource) => {
      (resource.allocations || []).forEach((allocation) => {
        const allocatedAt = new Date(allocation.allocatedAt || allocation.createdAt || Date.now());
        if (allocatedAt >= cutoff) {
          const key = allocatedAt.toISOString().slice(0, 10);
          trendBucket[key] = (trendBucket[key] || 0) + (allocation.quantity || 0);
        }
      });
    });

    const consumptionTrend = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        allocated: trendBucket[key] || 0,
      };
    });

    const aiSuggestions = buildAISuggestions(normalized, lowStock, consumptionTrend);

    res.json({
      summary: {
        totalResources: normalized.length,
        lowStockItems: lowStock.length,
        activeDeliveries,
        criticalZones: criticalTargets.size,
      },
      categoryDistribution,
      lowStock: lowStock.slice(0, 8).map((item) => ({
        id: item._id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        status: item.status,
        priority: item.priority,
      })),
      consumptionTrend,
      aiSuggestions,
    });
  } catch (error) {
    console.error('Resource analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getResources,
  addResource,
  updateResource,
  deleteResource,
  deployResource,
  allocateResource,
  getResourceAnalytics,
};
