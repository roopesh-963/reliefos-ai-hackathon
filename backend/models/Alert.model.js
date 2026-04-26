/**
 * models/Alert.model.js
 * ---------------------
 * Crisis alerts created by admins.
 * Displayed on the Dashboard & CrisisMap pages.
 *
 * When an admin creates an alert:
 *   POST /api/alerts → saved here
 *   → Socket.io emits 'new_alert' to all connected clients
 *   → Notification toast appears in the frontend (NotificationManager.tsx)
 */

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Alert message is required'],
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'warning',
    },
    // Which city/region is affected — matches markers on CrisisMap.tsx
    affectedCity: {
      type: String,
      default: 'Global',
    },
    affectedCoordinates: {
      // Optional: pin the alert to a map location
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      default: null, // null = never expires
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
