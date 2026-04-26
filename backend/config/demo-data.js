const User = require('../models/User.model');
const Resource = require('../models/Resource.model');
const SOS = require('../models/SOS.model');
const Alert = require('../models/Alert.model');
const Supply = require('../models/Supply.model');

const DAY = 24 * 60 * 60 * 1000;

const LOCATION_COORDS = {
  'Central Hub': { lat: 28.6139, lng: 77.209 },
  'East Depot': { lat: 28.7041, lng: 77.1025 },
  'North Warehouse': { lat: 28.5355, lng: 77.391 },
  'Coastal Depot': { lat: 19.076, lng: 72.8777 },
  'Camp 4': { lat: 12.9621, lng: 77.5984 },
  'East Zone': { lat: 12.9739, lng: 77.6101 },
  'West Shelter': { lat: 12.95, lng: 77.629 },
  'South District': { lat: 12.966, lng: 77.584 },
  'Zone C Shelter': { lat: 26.9124, lng: 75.7873 },
};

const resolveCoords = (label, fallback = { lat: 20.5937, lng: 78.9629 }) =>
  LOCATION_COORDS[label] || fallback;

const ensureDemoData = async () => {
  const demoMode = String(process.env.DEMO_MODE || '').toLowerCase() === 'true';
  if (!demoMode) {
    return;
  }

  const now = Date.now();

  await Promise.all([
    Supply.deleteMany({}),
    SOS.deleteMany({}),
    Alert.deleteMany({}),
    Resource.deleteMany({}),
    User.deleteMany({
      email: {
        $in: ['admin@reliefos.com', 'rescue@reliefos.com', 'john@reliefos.com'],
      },
    }),
  ]);

  const [admin, rescueTeam, citizen] = await User.create([
    { name: 'Admin User', email: 'admin@reliefos.com', password: 'admin123', role: 'admin' },
    { name: 'Rescue Team Alpha', email: 'rescue@reliefos.com', password: 'rescue123', role: 'rescue_team' },
    { name: 'John Citizen', email: 'john@reliefos.com', password: 'john123', role: 'citizen' },
  ]);

  const resources = await Resource.create([
    {
      type: 'Medicine',
      name: 'Antiviral Batch X-4',
      quantity: 530,
      unit: 'units',
      status: 'Healthy',
      priority: 'High',
      location: 'Central Hub',
      addedBy: admin._id,
    },
    {
      type: 'Food',
      name: 'Dry Ration Kits',
      quantity: 1200,
      unit: 'packs',
      status: 'Healthy',
      priority: 'Medium',
      location: 'East Depot',
      addedBy: admin._id,
    },
    {
      type: 'Water',
      name: 'Canned Spring Water',
      quantity: 2400,
      unit: 'cans',
      status: 'Healthy',
      priority: 'High',
      location: 'Central Hub',
      addedBy: admin._id,
    },
    {
      type: 'Fuel',
      name: 'Diesel Reserve Units',
      quantity: 220,
      unit: 'liters',
      status: 'Low',
      priority: 'High',
      location: 'North Warehouse',
      addedBy: admin._id,
    },
    {
      type: 'Equipment',
      name: 'Mobile Ventilators',
      quantity: 12,
      unit: 'units',
      status: 'Critical',
      priority: 'Critical',
      location: 'Camp 4',
      addedBy: rescueTeam._id,
    },
  ]);

  await Alert.create([
    {
      title: 'East Zone Flood Watch',
      message: 'River rise detected near East Zone embankments.',
      type: 'critical',
      affectedCity: 'East Zone',
      createdBy: admin._id,
    },
    {
      title: 'Camp 4 Water Advisory',
      message: 'Potable water shortages likely over the next 12 hours.',
      type: 'warning',
      affectedCity: 'Camp 4',
      createdBy: admin._id,
    },
  ]);

  await SOS.create([
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.5984, 12.9621], label: 'Camp 4' },
      severity: 'high',
      crisisType: 'medical',
      region: 'Camp 4',
      message: 'Medical assistance needed for multiple injuries.',
      status: 'in_progress',
      assignedTeam: 'Medical Unit 2',
      createdAt: new Date(now - 5 * DAY),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000),
    },
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.629, 12.95], label: 'West Shelter' },
      severity: 'critical',
      crisisType: 'fire',
      region: 'West Shelter',
      message: 'Fire in temporary accommodation block.',
      status: 'acknowledged',
      assignedTeam: 'Team Bravo',
      createdAt: new Date(now - 2 * DAY),
      updatedAt: new Date(now - 5 * 60 * 60 * 1000),
    },
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.641, 12.941], label: 'Camp 4' },
      severity: 'medium',
      crisisType: 'food',
      region: 'Camp 4',
      message: 'Ration queue is growing with elderly waiting.',
      status: 'pending',
      createdAt: new Date(now - 36 * 60 * 60 * 1000),
      updatedAt: new Date(now - 36 * 60 * 60 * 1000),
    },
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.584, 12.966], label: 'South District' },
      severity: 'high',
      crisisType: 'earthquake',
      region: 'South District',
      message: 'Structural cracks observed after aftershock.',
      status: 'in_progress',
      assignedTeam: 'Team Charlie',
      createdAt: new Date(now - 20 * 60 * 60 * 1000),
      updatedAt: new Date(now - 3 * 60 * 60 * 1000),
    },
  ]);

  await Supply.create([
    {
      shipmentId: 'SC-DEMO-001',
      trackingId: 'SC-DEMO-001',
      resourceType: 'Medicine',
      quantity: 20,
      unit: 'units',
      from: 'Central Hub',
      fromCoords: resolveCoords('Central Hub'),
      to: 'Camp 4',
      toCoords: resolveCoords('Camp 4'),
      currentCoords: resolveCoords('Central Hub'),
      vehicle: 'Truck 12',
      driver: 'Ananya Rao',
      status: 'In Transit',
      etaMinutes: 95,
      priority: 'High',
      routeState: 'Watch',
      destinationType: 'Camp',
      sourceResourceIds: [resources[0]._id],
      createdBy: rescueTeam._id,
    },
    {
      shipmentId: 'SC-DEMO-002',
      trackingId: 'SC-DEMO-002',
      resourceType: 'Water',
      quantity: 80,
      unit: 'cans',
      from: 'Central Hub',
      fromCoords: resolveCoords('Central Hub'),
      to: 'West Shelter',
      toCoords: resolveCoords('West Shelter'),
      currentCoords: resolveCoords('East Zone', resolveCoords('Central Hub')),
      vehicle: 'Truck 07',
      driver: 'Ravi Menon',
      status: 'Delayed',
      etaMinutes: 150,
      priority: 'Critical',
      routeState: 'Blocked',
      blockedReason: 'Road access flooded near East Zone.',
      destinationType: 'Shelter',
      sourceResourceIds: [resources[2]._id],
      createdBy: rescueTeam._id,
    },
  ]);

  console.log('DEMO_MODE data seeded deterministically.');
};

module.exports = { ensureDemoData };
