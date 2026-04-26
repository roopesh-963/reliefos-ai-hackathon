/**
 * controllers/sos.controller.js
 * --------------------------------
 * Handles SOS emergency requests from citizens.
 *
 * When a citizen presses the SOS button on SOSApp.tsx:
 *   → POST /api/sos is called
 *   → SOS is saved to MongoDB
 *   → Socket.io broadcasts 'new_sos' to ALL dashboard viewers instantly
 *   → Dashboard auto-updates without any page refresh
 *
 * This is the REALTIME magic: req.io.to('dashboard').emit(...)
 */

const SOS = require('../models/SOS.model');

const CRISIS_TYPE_RULES = [
  { type: 'flood', patterns: ['flood', 'water', 'rain', 'storm', 'cyclone', 'typhoon'] },
  { type: 'fire', patterns: ['fire', 'smoke', 'burn', 'wildfire', 'blaze'] },
  { type: 'medical', patterns: ['medical', 'injur', 'ambulance', 'hospital', 'patient', 'bleed'] },
  { type: 'earthquake', patterns: ['earthquake', 'quake', 'tremor', 'seismic'] },
  { type: 'food', patterns: ['food', 'hunger', 'ration', 'meal', 'supply'] },
  { type: 'fuel', patterns: ['fuel', 'diesel', 'petrol', 'gas', 'generator', 'power'] },
];
const ALLOWED_CRISIS_TYPES = new Set(['flood', 'fire', 'medical', 'earthquake', 'food', 'fuel', 'other']);

const inferCrisisType = (payload = {}) => {
  const tokens = `${payload.crisisType || ''} ${payload.message || ''} ${payload.locationLabel || ''}`
    .toLowerCase();

  const matchedRule = CRISIS_TYPE_RULES.find(({ patterns }) =>
    patterns.some((pattern) => tokens.includes(pattern))
  );

  if (matchedRule) {
    return matchedRule.type;
  }

  if (typeof payload.crisisType === 'string' && payload.crisisType.trim()) {
    const normalized = payload.crisisType.trim().toLowerCase();
    if (ALLOWED_CRISIS_TYPES.has(normalized)) {
      return normalized;
    }
  }

  return 'other';
};

// ── POST /api/sos ─────────────────────────────────────────────────────────────
// Submit a new SOS. Citizen must be logged in.
const submitSOS = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      locationLabel,
      severity,
      crisisType,
      region,
      message,
      mediaUrl,
    } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Location coordinates are required' });
    }

    const normalizedRegion = String(region || locationLabel || '').trim();
    const normalizedCrisisType = inferCrisisType({ crisisType, message, locationLabel: normalizedRegion });

    const sos = await SOS.create({
      submittedBy: req.user._id,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)], // GeoJSON: lng first
        label: locationLabel || '',
      },
      severity: severity || 'high',
      crisisType: normalizedCrisisType,
      region: normalizedRegion,
      message: message || '',
      mediaUrl: mediaUrl || null,
    });

    // Populate submittedBy so the dashboard gets the user name too
    await sos.populate('submittedBy', 'name email role');

    // ── REAL-TIME: Broadcast to everyone in the 'dashboard' room ─────────────
    // req.io is injected in server.js via the global middleware
    req.io.to('dashboard').emit('new_sos', {
      id: sos._id,
      submittedBy: sos.submittedBy,
      location: sos.location,
      severity: sos.severity,
      crisisType: sos.crisisType,
      region: sos.region,
      message: sos.message,
      status: sos.status,
      createdAt: sos.createdAt,
    });

    res.status(201).json({ message: 'SOS submitted successfully', sos });
  } catch (error) {
    console.error('SOS submit error:', error);
    res.status(500).json({ message: 'Server error while submitting SOS' });
  }
};

// ── GET /api/sos ──────────────────────────────────────────────────────────────
// Get all SOS requests. Supports filter by status or severity.
// Rescue teams and admins use this to see all incoming SOS.
const getAllSOS = async (req, res) => {
  try {
    const { status, severity, limit = 50 } = req.query;

    // Build a dynamic filter
    const filter = {};
    if (status)   filter.status   = status;
    if (severity) filter.severity = severity;

    const sosList = await SOS.find(filter)
      .populate('submittedBy', 'name email role') // Show who submitted
      .sort({ createdAt: -1 })                    // Newest first
      .limit(parseInt(limit));

    res.json(sosList);
  } catch (error) {
    console.error('Get SOS error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/sos/:id ──────────────────────────────────────────────────────────
const getSOSById = async (req, res) => {
  try {
    const sos = await SOS.findById(req.params.id).populate('submittedBy', 'name email role');
    if (!sos) return res.status(404).json({ message: 'SOS request not found' });
    res.json(sos);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/sos/:id/status ─────────────────────────────────────────────────
// Rescue team or admin updates the SOS status lifecycle:
//   pending → acknowledged → in_progress → resolved
const updateSOSStatus = async (req, res) => {
  try {
    const { status, assignedTeam } = req.body;

    const updatePayload = {
      status,
      assignedTeam,
    };

    if (status === 'resolved') {
      updatePayload.resolvedAt = new Date();
    }
    if (status !== 'resolved') {
      updatePayload.resolvedAt = null;
    }

    const sos = await SOS.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).populate('submittedBy', 'name email');

    if (!sos) return res.status(404).json({ message: 'SOS not found' });

    // Broadcast the status change to the dashboard too
    req.io.to('dashboard').emit('sos_updated', {
      id: sos._id,
      status: sos.status,
      assignedTeam: sos.assignedTeam,
      resolvedAt: sos.resolvedAt,
    });

    res.json({ message: 'SOS status updated', sos });
  } catch (error) {
    console.error('Update SOS error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { submitSOS, getAllSOS, getSOSById, updateSOSStatus };
