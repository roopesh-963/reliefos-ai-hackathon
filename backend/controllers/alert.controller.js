/**
 * controllers/alert.controller.js
 * --------------------------------
 * Admin creates crisis alerts displayed on CrisisMap & Dashboard.
 *
 * On alert create → Socket.io emits 'new_alert' to all clients.
 * Your frontend's NotificationManager.tsx can listen for this
 * and show a notification toast automatically.
 */

const Alert = require('../models/Alert.model');

// ── POST /api/alerts ──────────────────────────────────────────────────────────
// Only admin can create alerts (enforced by authorize('admin') in router)
const createAlert = async (req, res) => {
  try {
    const { title, message, type, affectedCity, affectedCoordinates, expiresAt } = req.body;

    const alert = await Alert.create({
      title,
      message,
      type: type || 'warning',
      affectedCity: affectedCity || 'Global',
      affectedCoordinates: affectedCoordinates || {},
      expiresAt: expiresAt || null,
      createdBy: req.user._id,
    });

    // ── REAL-TIME: Broadcast to ALL connected clients (not just dashboard room) ─
    // This means every page with a Socket.io connection sees the alert instantly
    req.io.emit('new_alert', {
      id: alert._id,
      title: alert.title,
      message: alert.message,
      type: alert.type,
      affectedCity: alert.affectedCity,
      createdAt: alert.createdAt,
    });

    res.status(201).json({ message: 'Alert created', alert });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/alerts ───────────────────────────────────────────────────────────
// Returns all active alerts (sorted newest first)
const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ isActive: true })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/alerts/:id/deactivate ─────────────────────────────────────────
// Admin deactivates an alert (removes it from active list)
const deactivateAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    res.json({ message: 'Alert deactivated', alert });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createAlert, getAlerts, deactivateAlert };
