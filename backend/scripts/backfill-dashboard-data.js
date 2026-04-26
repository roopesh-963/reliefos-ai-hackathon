const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User.model');
const SOS = require('../models/SOS.model');
const Alert = require('../models/Alert.model');

const DAY = 24 * 60 * 60 * 1000;

const ensureUsers = async () => {
  let admin = await User.findOne({ role: 'admin' });
  let rescue = await User.findOne({ role: 'rescue_team' });
  let citizen = await User.findOne({ role: 'citizen' });

  if (!admin) {
    admin = await User.create({
      name: 'Admin User',
      email: 'admin@reliefos.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('Created fallback admin user.');
  }

  if (!rescue) {
    rescue = await User.create({
      name: 'Rescue Team Alpha',
      email: 'rescue@reliefos.com',
      password: 'rescue123',
      role: 'rescue_team',
    });
    console.log('Created fallback rescue team user.');
  }

  if (!citizen) {
    citizen = await User.create({
      name: 'John Citizen',
      email: 'john@reliefos.com',
      password: 'john123',
      role: 'citizen',
    });
    console.log('Created fallback citizen user.');
  }

  return { admin, rescue, citizen };
};

const ensureAlerts = async (adminId) => {
  const alertCount = await Alert.countDocuments();
  if (alertCount > 0) {
    console.log(`Alerts already present (${alertCount}). Skipping alert backfill.`);
    return;
  }

  await Alert.create([
    {
      title: 'East Zone Flood Watch',
      message: 'River rise detected near East Zone embankments.',
      type: 'critical',
      affectedCity: 'East Zone',
      createdBy: adminId,
    },
    {
      title: 'Camp 4 Water Advisory',
      message: 'Potable water shortages likely over the next 12 hours.',
      type: 'warning',
      affectedCity: 'Camp 4',
      createdBy: adminId,
    },
  ]);

  console.log('Inserted sample alerts.');
};

const ensureSos = async (citizenId) => {
  const sosCount = await SOS.countDocuments();
  if (sosCount > 0) {
    console.log(`SOS incidents already present (${sosCount}). Skipping SOS backfill.`);
    return;
  }

  const now = Date.now();
  await SOS.create([
    {
      submittedBy: citizenId,
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
      submittedBy: citizenId,
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
      submittedBy: citizenId,
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
      submittedBy: citizenId,
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
      submittedBy: citizenId,
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

  console.log('Inserted sample SOS incidents.');
};

const run = async () => {
  await connectDB();
  const { admin, citizen } = await ensureUsers();
  await ensureAlerts(admin._id);
  await ensureSos(citizen._id);

  console.log('\nDashboard data backfill complete.\n');
  await mongoose.connection.close();
};

run().catch(async (error) => {
  console.error('Dashboard data backfill failed:', error);
  await mongoose.connection.close();
  process.exit(1);
});
