/**
 * models/SOS.model.js
 * -------------------
 * Stores emergency SOS requests submitted by citizens.
 * Maps directly to your SOSApp.tsx page.
 *
 * Flow:
 *   Citizen presses SOS button → POST /api/sos → saved here
 *   → Socket.io emits 'new_sos' to dashboard room
 *   → Dashboard shows the new SOS live
 *
 * Fields explained:
 *   submittedBy  → Reference to the User who triggered the SOS
 *   location     → GeoJSON Point for map display (lat/lng)
 *   severity     → How urgent is it?
 *   message      → What happened? (optional description)
 *   status       → Lifecycle of the SOS request
 *   assignedTeam → Which rescue team is handling it
 *   mediaUrl     → Optional photo/video upload URL
 */

const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema(
  {
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      // GeoJSON format — enables geospatial queries ("find all SOS near X")
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude] — GeoJSON is lng first!
        required: true,
      },
      label: { type: String, default: '' }, // Human-readable address / city name
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'high',
    },
    crisisType: {
      type: String,
      enum: ['flood', 'fire', 'medical', 'earthquake', 'food', 'fuel', 'other'],
      default: 'other',
    },
    region: {
      type: String,
      default: '',
      trim: true,
    },
    message: {
      type: String,
      maxlength: 500,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'acknowledged', 'in_progress', 'resolved'],
      default: 'pending',
    },
    assignedTeam: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Enable geospatial indexing on location field
// This powers "find SOS within 5km" queries
sosSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SOS', sosSchema);
