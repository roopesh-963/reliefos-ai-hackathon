/**
 * scripts/seed.js
 * ----------------
 * Seeds the database with sample data for testing.
 * Run once with: node scripts/seed.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Resource = require('../models/Resource.model');
const SOS = require('../models/SOS.model');
const Alert = require('../models/Alert.model');
const Supply = require('../models/Supply.model');
const connectDB = require('../config/db');

const DAY = 24 * 60 * 60 * 1000;

const seed = async () => {
  await connectDB();

  await User.deleteMany();
  await Resource.deleteMany();
  await SOS.deleteMany();
  await Alert.deleteMany();
  await Supply.deleteMany();
  console.log('Cleared existing data');

  const [admin, teamMember, citizen] = await User.create([
    { name: 'Admin User', email: 'admin@reliefos.com', password: 'admin123', role: 'admin' },
    { name: 'Rescue Team Alpha', email: 'rescue@reliefos.com', password: 'rescue123', role: 'rescue_team' },
    { name: 'John Citizen', email: 'john@reliefos.com', password: 'john123', role: 'citizen' },
  ]);
  console.log('Users seeded');

  const [medicine, food, backupMedicine, water, ventilators, fuel] = await Resource.create([
    { type: 'Medicine', name: 'Antiviral Batch X-4', quantity: 450, unit: 'units', status: 'Healthy', priority: 'High', location: 'Warehouse 01', addedBy: admin._id },
    { type: 'Food', name: 'Dry Ration Kits', quantity: 1200, unit: 'packs', status: 'Healthy', priority: 'Medium', location: 'Warehouse 02', addedBy: admin._id },
    { type: 'Medicine', name: 'Emergency Splints', quantity: 80, unit: 'units', status: 'Low', priority: 'Critical', location: 'Sector 4 Base', addedBy: admin._id },
    { type: 'Water', name: 'Canned Spring Water', quantity: 2400, unit: 'cans', status: 'Healthy', priority: 'High', location: 'Warehouse 01', addedBy: admin._id },
    { type: 'Equipment', name: 'Mobile Ventilators', quantity: 12, unit: 'units', status: 'Critical', priority: 'Critical', location: 'Central Hospital', addedBy: admin._id },
    { type: 'Fuel', name: 'Diesel Reserve Units', quantity: 220, unit: 'liters', status: 'Low', priority: 'High', location: 'Logistics Depot 7', addedBy: admin._id },
  ]);

  medicine.isDeployed = true;
  medicine.deploymentTarget = 'East Zone Relief Hub';
  medicine.allocations = [
    { target: 'East Zone Relief Hub', quantity: 60, notes: 'Initial triage support', allocatedAt: new Date(Date.now() - 3 * DAY), allocatedBy: admin._id },
  ];
  await medicine.save();

  food.allocations = [
    { target: 'Camp 4', quantity: 180, notes: 'High-density ration release', allocatedAt: new Date(Date.now() - 2 * DAY), allocatedBy: admin._id },
  ];
  await food.save();

  backupMedicine.allocations = [
    { target: 'North Medical Post', quantity: 24, notes: 'Surgical buffer', allocatedAt: new Date(Date.now() - 4 * DAY), allocatedBy: admin._id },
  ];
  await backupMedicine.save();

  water.isDeployed = true;
  water.deploymentTarget = 'Camp 4';
  water.allocations = [
    { target: 'Camp 4', quantity: 450, notes: 'Water resupply convoy', allocatedAt: new Date(Date.now() - DAY), allocatedBy: teamMember._id },
  ];
  await water.save();

  ventilators.allocations = [
    { target: 'Central Hospital', quantity: 4, notes: 'Critical respiratory support', allocatedAt: new Date(Date.now() - 5 * DAY), allocatedBy: teamMember._id },
  ];
  await ventilators.save();

  fuel.isDeployed = true;
  fuel.deploymentTarget = 'Mobile Command Unit';
  fuel.allocations = [
    { target: 'Mobile Command Unit', quantity: 120, notes: 'Generator support', allocatedAt: new Date(Date.now() - 4 * DAY), allocatedBy: admin._id },
  ];
  await fuel.save();
  console.log('Resources seeded');

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
  console.log('Alerts seeded');

  const now = Date.now();
  const sosSeed = [
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.6101, 12.9739], label: 'East Zone' },
      severity: 'critical',
      crisisType: 'flood',
      region: 'East Zone',
      message: 'Water levels rising rapidly in low-lying homes.',
      status: 'resolved',
      assignedTeam: 'Team Delta',
      resolvedAt: new Date(now - 90 * 60 * 1000),
      createdAt: new Date(now - 7 * DAY),
      updatedAt: new Date(now - 90 * 60 * 1000),
    },
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
      location: { type: 'Point', coordinates: [77.575, 12.984], label: 'North Medical Post' },
      severity: 'medium',
      crisisType: 'medical',
      region: 'North Medical Post',
      message: 'Need stretcher and oxygen support.',
      status: 'resolved',
      assignedTeam: 'Medical Unit 1',
      resolvedAt: new Date(now - 3 * 60 * 60 * 1000),
      createdAt: new Date(now - 4 * DAY),
      updatedAt: new Date(now - 3 * 60 * 60 * 1000),
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
      location: { type: 'Point', coordinates: [77.632, 12.988], label: 'East Shelter' },
      severity: 'critical',
      crisisType: 'flood',
      region: 'East Shelter',
      message: 'Basement water ingress and evacuation required.',
      status: 'resolved',
      assignedTeam: 'Team Alpha',
      resolvedAt: new Date(now - 30 * 60 * 1000),
      createdAt: new Date(now - 30 * 60 * 60 * 1000),
      updatedAt: new Date(now - 30 * 60 * 1000),
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
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.604, 12.975], label: 'West Shelter' },
      severity: 'medium',
      crisisType: 'fuel',
      region: 'West Shelter',
      message: 'Fuel shortage for evacuation vehicles.',
      status: 'resolved',
      assignedTeam: 'Logistics Team',
      resolvedAt: new Date(now - 2 * 60 * 60 * 1000),
      createdAt: new Date(now - 18 * 60 * 60 * 1000),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000),
    },
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.617, 12.979], label: 'Camp 4' },
      severity: 'critical',
      crisisType: 'medical',
      region: 'Camp 4',
      message: 'Pediatric medical support needed urgently.',
      status: 'resolved',
      assignedTeam: 'Medical Unit 2',
      resolvedAt: new Date(now - 45 * 60 * 1000),
      createdAt: new Date(now - 16 * 60 * 60 * 1000),
      updatedAt: new Date(now - 45 * 60 * 1000),
    },
    {
      submittedBy: citizen._id,
      location: { type: 'Point', coordinates: [77.607, 12.989], label: 'East Zone' },
      severity: 'medium',
      crisisType: 'flood',
      region: 'East Zone',
      message: 'Drainage channels blocked again overnight.',
      status: 'acknowledged',
      assignedTeam: 'Team Delta',
      createdAt: new Date(now - 8 * 60 * 60 * 1000),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000),
    },
  ];

  await SOS.create(sosSeed);
  console.log('SOS incidents seeded');

  await Supply.create([
    { trackingId: 'TRK-9021', cargoType: 'Medicine', destination: 'Sector 4 Base', status: 'En-route', progress: 75, eta: '12 min', warehouse: 'Central Hub', createdBy: teamMember._id },
    { trackingId: 'TRK-9022', cargoType: 'Food', destination: 'Central Shelter', status: 'Idle', progress: 0, eta: '-', warehouse: 'Warehouse 02', createdBy: teamMember._id },
    { trackingId: 'TRK-9025', cargoType: 'Water', destination: 'Coastal Region', status: 'En-route', progress: 32, eta: '45 min', warehouse: 'Shore Station', createdBy: teamMember._id },
    { trackingId: 'TRK-9029', cargoType: 'Medicine', destination: 'Zone 11 Clinic', status: 'Loading', progress: 10, eta: '1.2h', warehouse: 'Central Hub', createdBy: teamMember._id },
  ]);
  console.log('Supply deployments seeded');

  console.log('\nDatabase seeded successfully.\n');
  console.log('Test Credentials:');
  console.log('  Admin:       admin@reliefos.com   / admin123');
  console.log('  Rescue Team: rescue@reliefos.com  / rescue123');
  console.log('  Citizen:     john@reliefos.com    / john123\n');

  mongoose.connection.close();
};

seed().catch((err) => {
  console.error('Seeding failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
